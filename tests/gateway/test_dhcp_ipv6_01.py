"""https://jira.lgi.io/browse/MVX_TST-17969."""

import tempfile
import time
from collections.abc import Iterator
from typing import Any

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
    get_interface_mac_addr,
    tcpdump_on_device,
)
from boardfarm3.use_cases.online_usecases import (
    is_board_online_after_reset,
    power_cycle,
    wait_for_board_boot_start,
)
from nested_lookup import nested_lookup
from pytest_boardfarm3.lib import ContextStorage, TestLogger


@pytest.fixture()
def setup_teardown(
    bf_context: ContextStorage,
    device_manager: DeviceManager,
    bf_logger: TestLogger,
) -> Iterator[tuple[str, str, CPE, Provisioner, Any]]:
    """Test setup and teardown."""
    bf_context.pcap_started = (  # type: ignore[attr-defined]
        bf_context.success  # type: ignore[attr-defined]
    ) = bf_context.reboot_required = False  # type: ignore[attr-defined]
    board = device_manager.get_device_by_type(CPE)  # type:ignore[type-abstract]
    provisioner = device_manager.get_device_by_type(
        Provisioner  # type:ignore[type-abstract]
    )
    mode = get_cpe_provisioning_mode(board)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    tmp = tempfile.template
    pcap_file = f"/{tmp}/{get_pytest_name().split('(')[0]}_{mode}_{timestamp}.pcap"

    def _verify_erouter_mode(mode: str) -> bool:
        verify_erouter_ip = verify_erouter_ip_address(mode, board, 5)
        if not verify_erouter_ip:
            # Loop is added as Arris MV1 takes 12mins to get erouter ip address
            for _ in range(18):
                erouter_ip = verify_erouter_ip_address(mode, board, 5)
                if erouter_ip:
                    break
                time.sleep(40)  # time to fetch erouter ip address
            return erouter_ip
        return verify_erouter_ip

    yield mode, pcap_file, board, provisioner, _verify_erouter_mode

    if bf_context.reboot_required:  # type: ignore[attr-defined]
        bf_logger.log_step(
            "Teardown: Rebooting the DUT, as it was not online post "
            "Factory Reset done in test step"
        )
        power_cycle()
        if not retry_on_exception(is_board_online_after_reset, (), retries=5, tout=30):
            msg = "Board not online after reboot in Teardown"
            raise TeardownError(msg)
        if not _verify_erouter_mode(mode):
            msg = "Dut does not have erouter address after reboot in Teardown"
            raise TeardownError(msg)

    if bf_context.pcap_started:  # type: ignore[attr-defined]
        bf_logger.log_step(
            "Teardown: Copying pcap to results folder in case of testcase failure"
        )
        copy_pcap_to_artifacts(
            pcap_file,
            provisioner,
            bf_context.success,  # type: ignore[attr-defined]
        )


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {
                "eRouter_Provisioning_mode": ["dual", "ipv4", "ipv6"],
                "lan_clients": [{}],
            }
        }
    }
)
def test_MVX_TST_17969(
    setup_teardown: tuple[str, str, CPE, Provisioner, Any],  # pylint: disable=redefined-outer-name
    bf_logger: TestLogger,
    bf_context: ContextStorage,
) -> None:
    """ERouter must send DUID type Link-layer address (3).

    Purpose of this test case is to verify that eRouter sends DUID type :
    Link-layer address (3) during DHCPv6 provisioning for its WAN interface
    after CM has completed provisioning
    """
    mode, pcap_file, board, provisioner, _verify_erouter_mode = setup_teardown
    erouter_link_local_ipv6 = get_erouter_addresses(
        retry_count=1, board=board
    ).link_local_ipv6
    erouter_mac_addr = get_interface_mac_addr(board, board.sw.erouter_iface)
    dhcpv6_msg: dict[str, Any] = {}

    def _verify_dhcpv6_msg(msg_type: str) -> None:
        msg = "SOLICIT" if msg_type == "1" else "REQUEST"
        duid_type = nested_lookup("dhcpv6.duid.type", dhcpv6_msg[msg_type])
        assert duid_type[0] == "3", f"DUID type is not 3 in {msg} message"
        linklayer_addr = nested_lookup(
            "dhcpv6.duidll.link_layer_addr", dhcpv6_msg[msg_type]
        )
        assert linklayer_addr[0] == erouter_mac_addr, (
            f"Link Layer address {linklayer_addr[0]} is not same as "
            f"erouter wan mac {erouter_mac_addr} in {msg} message"
        )

    bf_logger.log_step("Step 1: Start packet capture on DHCP server")
    with tcpdump_on_device(
        device=provisioner,
        fname=pcap_file,
        interface=provisioner.iface_dut,
        filters=None,
        additional_filters="-vv '(udp port 546 or port 547)'",
    ):
        bf_context.pcap_started = True  # type: ignore[attr-defined]

        bf_logger.log_step("Step 2: Factory reset the DUT")
        bf_context.reboot_required = True  # type: ignore[attr-defined]
        factory_reset(board)

        bf_logger.log_step(
            "Step 3: Wait for 180 seconds for CM to be Operational and eRouter WAN"
            " Interface to come up"
        )
        retry_on_exception(wait_for_board_boot_start, (), retries=2, tout=1)
        assert retry_on_exception(
            is_board_online_after_reset, (), retries=5, tout=1
        ), "Board is not online post factory reset"
        assert _verify_erouter_mode(
            mode
        ), "Erouter does not have ip address after Factory Reset"
        bf_context.reboot_required = False  # type: ignore[attr-defined]

        time.sleep(30)  # wait for packet capture to complete

    bf_logger.log_step(
        "Step 4: Verify that following messages are exchanged between DUT's eRouter WAN"
        " interface and DHCPv6 server\n * DUT sends Solicit message to DHCPv6"
        " server by including DUID type: Link-layer address (3) and Link-layer address"
        " : <eRouter WAN MAC address>\n * DUT receives advertise from DHCPv6 Server\n *"
        " DUT sends Request message to DHCPv6 server by including DUID type:"
        " Link-layer address (3) and Link-layer address : <eRouter WAN MAC"
        " address>\n * DUT receives Reply from DHCPv6 Server"
    )
    dhcp_output = parse_dhcpv6_trace(
        provisioner,
        pcap_file,
        300,
    )
    for packet in dhcp_output:
        peeraddr = nested_lookup("dhcpv6.peeraddr", packet.dhcpv6_packet)
        if peeraddr[0] == str(erouter_link_local_ipv6):
            lookup = nested_lookup("dhcpv6.msgtype", packet.dhcpv6_packet)
            if lookup[-1] in ["1", "2", "3", "7"]:
                dhcpv6_msg[lookup[-1]] = packet.dhcpv6_packet

    assert "1" in dhcpv6_msg, "solicit message not present in capture"
    assert "2" in dhcpv6_msg, "advertise message not present in capture"
    assert "3" in dhcpv6_msg, "request message not present in capture"
    assert "7" in dhcpv6_msg, "reply message not present in capture"

    _verify_dhcpv6_msg("1")
    _verify_dhcpv6_msg("3")

    bf_context.success = True  # type: ignore[attr-defined]
