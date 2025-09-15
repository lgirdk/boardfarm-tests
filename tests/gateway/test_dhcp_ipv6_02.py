"""https://jira.lgi.io/browse/MVX_TST-32356."""

import tempfile
import time
from collections.abc import Iterator

import pytest
from boardfarm3.exceptions import TeardownError
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.lib.utils import get_pytest_name, retry_on_exception
from boardfarm3.templates.cpe.cpe import CPE
from boardfarm3.templates.provisioner import Provisioner
from boardfarm3.use_cases.cpe import factory_reset, get_cpe_provisioning_mode
from boardfarm3.use_cases.dhcpv6 import parse_dhcpv6_trace
from boardfarm3.use_cases.erouter import (
    get_erouter_addresses,
    verify_erouter_ip_address,
)
from boardfarm3.use_cases.networking import (
    copy_pcap_to_artifacts,
    tcpdump_on_device,
)
from boardfarm3.use_cases.online_usecases import (
    is_board_online_after_reset,
    power_cycle,
    wait_for_board_boot_start,
)
from nested_lookup import nested_lookup
from pytest_boardfarm3.lib import ContextStorage, TestLogger


def _verify_ia_pd_message(ia_pd_message: list, msg_type: str) -> None:
    assert ia_pd_message, f"DHCPv6 {msg_type} message do not contain IA_PD message"
    assert ia_pd_message[0]["dhcpv6.option.type"] == "25", (
        f"DHCPv6 {msg_type} message do not contain IA_PD option"
    )
    assert ia_pd_message[0]["IA Prefix"].get("dhcpv6.iaprefix.pref_addr"), (
        f"DHCPv6 {msg_type} message do not contain IA_PD Prefix address"
    )


def _extract_ia_pd_messages(dhcp_output: list) -> dict:
    msg_types = {"1": "Solicit", "2": "Advertise", "3": "Request", "7": "Reply"}
    results = {}
    for packet in dhcp_output:
        msg_type = nested_lookup("dhcpv6.msgtype", packet)
        for code, name in msg_types.items():
            if code in msg_type:
                results[name] = nested_lookup(
                    "Identity Association for Prefix Delegation", packet
                )
    return results


@pytest.fixture()
def setup_teardown(
    bf_context: ContextStorage, bf_logger: TestLogger, device_manager: DeviceManager
) -> Iterator[tuple[CPE, str, str, Provisioner]]:
    """Test setup and teardown."""
    (bf_context.check_after_reboot) = bf_context.pcap_started = (  # type: ignore[attr-defined]
        bf_context.success  # type: ignore[attr-defined]
    ) = False
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    tmp = tempfile.template
    pcap_fname = f"/{tmp}/{get_pytest_name().split('(')[0]}_{timestamp}.pcap"
    board = device_manager.get_device_by_type(CPE)  # type:ignore[type-abstract]
    provisioner = device_manager.get_device_by_type(Provisioner)  # type:ignore[type-abstract]
    mode = get_cpe_provisioning_mode(board)
    yield board, mode, pcap_fname, provisioner
    if bf_context.check_after_reboot:  # type: ignore[attr-defined]
        bf_logger.log_step(
            "Teardown: Rebooting as the DUT was not online after factory reset "
            "in test step."
        )
        power_cycle()
        if not retry_on_exception(is_board_online_after_reset, (), retries=5, tout=30):
            msg = "Board not online after reboot in Teardown"
            raise TeardownError(msg)
        if not verify_erouter_ip_address(mode, board, 9):
            msg = "DUt does not have erouter address after reboot in Teardown"
            raise TeardownError(msg)

    if bf_context.pcap_started:  # type: ignore[attr-defined]
        bf_logger.log_step(
            "Teardown: Copying pcap to results folder in case of testcase failure"
        )
        copy_pcap_to_artifacts(
            pcap_fname,
            provisioner,
            bf_context.success,  # type: ignore[attr-defined]
        )


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {
                "eRouter_Provisioning_mode": ["dual", "ipv6"],
                "lan_clients": [{}],
            }
        }
    }
)
def test_MVX_TST_32356(
    setup_teardown: tuple[CPE, str, str, Provisioner],  # pylint: disable=redefined-outer-name
    bf_logger: TestLogger,
    bf_context: ContextStorage,
) -> None:
    """ERouter WAN must request DHCPv6 prefix delegation during initial IP.

    acquisition (DHCPv6) process
    When CPE has completed provisioning Then eRouter must request Prefix Delegation
    using DHCPv6 process for its WAN interface And eRouter receives Prefix
    Delegation from WAN DHCPv6 Server.
    """
    board, mode, pcap_fname, provisioner = setup_teardown
    erouter_ips = get_erouter_addresses(board=board, retry_count=1)

    bf_logger.log_step(
        "Step 1: Make sure you can capture packets sent from and to eRouter "
        "WAN interface"
    )
    with tcpdump_on_device(
        device=provisioner,
        fname=pcap_fname,
        interface=provisioner.iface_dut,
        filters=None,
        additional_filters="-vv '(udp port 546 or port 547)'",
    ):
        bf_context.pcap_started = True  # type: ignore[attr-defined]

        bf_logger.log_step("Step 2: Factory reset the DUT")
        bf_context.check_after_reboot = True  # type: ignore[attr-defined]
        factory_reset(board)
        retry_on_exception(wait_for_board_boot_start, (), retries=5, tout=30)
        assert retry_on_exception(
            is_board_online_after_reset, (), retries=5, tout=30
        ), "Board is not online post factory reset"
        assert verify_erouter_ip_address(mode=mode, board=board, retry=9), (
            f"erouter interface doesn't have ip in required {mode} mode"
        )
        bf_context.check_after_reboot = False  # type: ignore[attr-defined]
        time.sleep(10)

    bf_logger.log_step(
        "Step 3.1: Verify that following in the packet capture: Solicit, Advertise,"
        " Request and Reply messages are exchanged between DUT's eRouter WAN interface"
        " and DHCPv6 server"
    )
    parsed_output = parse_dhcpv6_trace(
        provisioner,
        pcap_fname,
        180,
        (
            f"dhcpv6.peeraddr=={erouter_ips.link_local_ipv6!s} or"
            f" ipv6.addr=={erouter_ips.link_local_ipv6!s} "
        ),
    )
    assert parsed_output, "No dhcpv6 packets captured"
    dhcp_output = [packet.dhcpv6_packet for packet in parsed_output]
    ia_pd_messages = _extract_ia_pd_messages(dhcp_output)

    bf_logger.log_step(
        "Step 3.2: Verify that following in the packet capture: Solicit and Request"
        " messages (multicast) are sent with IA_PD option(25)from eRouter WAN interface"
    )
    for msg in ["Solicit", "Request"]:
        assert msg in ia_pd_messages, f"{msg} message not present in capture"
        _verify_ia_pd_message(ia_pd_messages[msg], msg)

    bf_logger.log_step(
        "Step 3.3: Verify that following in the packet capture: Advertise and Reply"
        " messages should be sent with IA_PD option(25) with Prefix address from WAN"
        " DHCPv6 Server to eRouter WAN interface"
    )
    for msg in ["Advertise", "Reply"]:
        assert msg in ia_pd_messages, f"{msg} message not present in capture"
        _verify_ia_pd_message(ia_pd_messages[msg], msg)

    bf_context.success = True  # type: ignore[attr-defined]

    bf_logger.log_step(
        "Step 4: Verify that DUT acquires global IPv6 address on its eRouter WAN "
        "interface."
    )
    assert get_erouter_addresses(board=board, retry_count=9).ipv6, (
        "DUT's eRouter WAN interface do not have global IPv6 address"
    )
