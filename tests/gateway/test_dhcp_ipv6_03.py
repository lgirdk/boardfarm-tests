"""https://jira.lgi.io/browse/MVX_TST-92486."""

import tempfile
import time
from collections.abc import Iterator

import pytest
from boardfarm3.exceptions import TeardownError
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.lib.utils import get_pytest_name, retry_on_exception
from boardfarm3.templates.acs import ACS
from boardfarm3.templates.cpe import CPE
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
from boardfarm3.use_cases.tr069 import get_parameter_values
from nested_lookup import nested_lookup
from pytest_boardfarm3.lib import ContextStorage, TestLogger


@pytest.fixture()
def setup_teardown(
    bf_context: ContextStorage, bf_logger: TestLogger, device_manager: DeviceManager
) -> Iterator[tuple[CPE, ACS, Provisioner, str, str]]:
    """Test setup and teardown."""
    bf_context.tcpdump_started = (  # type: ignore[attr-defined]
        bf_context.success  # type: ignore[attr-defined]
    ) = bf_context.reboot_required = False  # type: ignore[attr-defined]
    board = device_manager.get_device_by_type(CPE)  # type:ignore[type-abstract]
    acs = device_manager.get_device_by_type(ACS)  # type:ignore[type-abstract]
    provisioner = device_manager.get_device_by_type(Provisioner)  # type:ignore[type-abstract]
    mode = get_cpe_provisioning_mode(board)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    tmp = tempfile.template
    pcap_name = f"/{tmp}/{get_pytest_name().split('(')[0]}_{mode}_{timestamp}.pcap"

    yield board, acs, provisioner, pcap_name, mode

    if bf_context.reboot_required:  # type: ignore[attr-defined]
        bf_logger.log_step(
            "Teardown: Rebooting as the DUT was not online after reboot in test step."
        )
        power_cycle()
        if not is_board_online_after_reset():
            msg = "Board not online after reboot in teardown."
            raise TeardownError(msg)
        if not verify_erouter_ip_address(mode=mode, board=board, retry=9):
            msg = f"erouter does not get ip in required mode {mode}"
            raise TeardownError(msg)

    if bf_context.tcpdump_started:  # type: ignore[attr-defined]
        bf_logger.log_step(
            "TearDown: Copy the pcap file to artifacts in case of failure"
        )
        copy_pcap_to_artifacts(
            pcap_name,
            provisioner,
            bf_context.success,  # type: ignore[attr-defined]
        )


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {
                "eRouter_Provisioning_mode": ["dual", "ipv6"],
                "lan_clients": [{}],
            },
            "provisioner": {
                "dhcp_options": {
                    "dhcpv6": {
                        "vivso": {
                            "sub-options": [
                                {
                                    "data": "http://acs_server.boardfarm.com:9675/",
                                    "name": "acs-url",
                                    "sub-option-code": 1,
                                }
                            ],
                            "vendor-id": 3561,
                        }
                    }
                }
            },
        }
    }
)
def test_MVX_TST_92486(
    setup_teardown: tuple[CPE, ACS, Provisioner, str, str],  # pylint: disable=redefined-outer-name
    bf_logger: TestLogger,
    bf_context: ContextStorage,
) -> None:
    """Support to acquire ManagementServer.URL via DHCPv6 process."""
    board, acs, provisioner, pcap_name, mode = setup_teardown
    link_local_ipv6 = get_erouter_addresses(retry_count=3, board=board).link_local_ipv6
    acs_url = "http://acs_server.boardfarm.com:9675/"

    bf_logger.log_step("Step 1: Start packet capture on DHCP server")
    with tcpdump_on_device(
        device=provisioner,
        fname=pcap_name,
        interface=provisioner.iface_dut,
        filters=None,
    ):
        bf_context.tcpdump_started = True  # type: ignore[attr-defined]

        bf_logger.log_step("Step 2: Perform factory reset on the CPE")
        bf_context.reboot_required = True  # type: ignore[attr-defined]
        factory_reset(board=board)
        retry_on_exception(wait_for_board_boot_start, (), retries=5, tout=30)
        assert retry_on_exception(
            is_board_online_after_reset, (), retries=5, tout=30
        ), "Board is not online post factory reset"
        assert verify_erouter_ip_address(mode=mode, board=board, retry=9), (
            f"erouter interface doesn't have ip in required mode {mode}"
        )
        bf_context.reboot_required = False  # type: ignore[attr-defined]

    bf_logger.log_step("Step 3: Verify ManagementServer.URL in SARR packets")
    output = parse_dhcpv6_trace(
        provisioner,
        pcap_name,
        60,
        (
            f"dhcpv6.peeraddr=={link_local_ipv6} or "
            f"ipv6.addr=={link_local_ipv6} "
            "and dhcpv6.msgtype == 2"
        ),
    )
    assert output, "dhcpv6 packets are not received from pcap file"
    parsed_output = output[0].dhcpv6_packet
    relay_option_data = nested_lookup("Vendor-specific Information", parsed_output)
    relay_option_data = relay_option_data[0]["option"][
        "dhcpv6.vendoropts.enterprise.option_data"
    ]
    assert (
        bytes.fromhex(relay_option_data.replace(":", "")).decode("utf8") == acs_url
    ), "Management server URL not present"
    bf_context.success = True  # type: ignore[attr-defined]

    bf_logger.log_step(
        "Step 4: Verify ACS connectivity to ManagementServer.URL obtained via DHCP"
        " process"
    )
    assert (
        get_parameter_values("Device.ManagementServer.URL", acs, board)[0]["value"]
        == acs_url
    ), "ManagementServer URL not present"
