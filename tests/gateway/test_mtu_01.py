"""https://jira.lgi.io/browse/MVX_TST-106953."""

import secrets
import tempfile
import time
from collections.abc import Iterator

import pytest
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.lib.utils import get_pytest_name
from boardfarm3.templates.acs import ACS
from boardfarm3.templates.cpe import CPE
from boardfarm3.templates.lan import LAN
from boardfarm3.use_cases.networking import (
    copy_pcap_to_artifacts,
    parse_icmp_trace,
)
from boardfarm3.use_cases.tr069 import (
    get_parameter_values,
    set_parameter_values,
)
from pytest_boardfarm3.lib import ContextStorage, TestLogger


@pytest.fixture()
def setup_teardown(
    bf_context: ContextStorage, bf_logger: TestLogger, device_manager: DeviceManager
) -> Iterator[tuple[str, LAN, str, str, CPE, ACS]]:
    """Test setup and teardown."""
    bf_context.spv_success = (  # type: ignore[attr-defined]
        bf_context.pcap_started  # type: ignore[attr-defined]
    ) = bf_context.success = False  # type: ignore[attr-defined]
    tmp = tempfile.template
    pcap_file = (
        f"/{tmp}/{get_pytest_name().split('(')[0]}_"
        f"{time.strftime('%Y%m%d_%H%M%S')}.pcap"
    )
    ra_param = "Device.RouterAdvertisement.InterfaceSetting.1.AdvLinkMTU"
    lan = device_manager.get_device_by_type(LAN)  # type:ignore[type-abstract]
    board = device_manager.get_device_by_type(CPE)  # type:ignore[type-abstract]
    acs = device_manager.get_device_by_type(ACS)  # type:ignore[type-abstract]
    default_ra_mtu_value = get_parameter_values(ra_param, acs, board)[0]["value"]
    yield pcap_file, lan, ra_param, default_ra_mtu_value, board, acs
    if bf_context.spv_success:  # type: ignore[attr-defined]
        bf_logger.log_step("Teardown: Setting ra mtu value to default")
        set_parameter_values([{ra_param: default_ra_mtu_value}], acs, board)
    if bf_context.pcap_started:  # type: ignore[attr-defined]
        bf_logger.log_step(
            "Teardown: Copying pcap to results folder in case of testcase failure"
        )
        copy_pcap_to_artifacts(pcap_file, lan, bf_context.success)  # type: ignore[attr-defined]


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {
                "eRouter_Provisioning_mode": ["dual", "ipv4", "ipv6"],
                "lan_clients": [{}],
            },
            "tr-069": {},
        }
    }
)
def test_MVX_TST_106953(
    setup_teardown: tuple[str, LAN, str, str, CPE, ACS],  # pylint: disable=redefined-outer-name
    bf_logger: TestLogger,
    bf_context: ContextStorage,
) -> None:
    """MTU path announcement in IPv6 RA messages.

    The purpose of this testcase is to verify that the MTU path
    announcement must be present in IPv6 RAs.
    """
    pcap_file, lan, ra_param, default_ra_mtu_value, board, acs = setup_teardown
    option_list_to_match = []

    def _generate_random_no() -> int:
        random_no = secrets.choice(range(1280, 1500))
        if random_no == default_ra_mtu_value:
            return_value = _generate_random_no()
        else:
            return_value = random_no
        return return_value

    bf_logger.log_step("Step1: Make sure to start the packet capture on LAN side")
    with lan.tcpdump_capture(fname=pcap_file, interface=lan.iface_dut):
        bf_context.pcap_started = True  # type: ignore[attr-defined]

        bf_logger.log_step(
            f"Step2: Execute SPV on {ra_param} with valid value within range 1280-1500"
        )
        ra_value = _generate_random_no()
        assert set_parameter_values([{ra_param: ra_value}], acs, board) in [
            0,
            1,
        ], f"SPV unsuccessful in setting {ra_param} to {ra_value}"
        bf_context.spv_success = True  # type: ignore[attr-defined]
        time.sleep(10)

        bf_logger.log_step(f"Step3: Execute GPV on {ra_param}")
        assert get_parameter_values(ra_param, acs, board)[0]["value"] == ra_value, (
            f"GPV on {ra_param} didn't returned value set in step2"
        )
        time.sleep(180)

    bf_logger.log_step(
        "Step4: Check from the packet capture that the configured MTU path "
        "announcement is present in IPv6 Router Advertisement message"
    )
    output_lan = parse_icmp_trace(lan, pcap_file, "-V -Y 'icmpv6.type == 134'")
    assert output_lan, (
        "Router Advertisement packets are not found in pcap data captured on lan"
    )
    option_list_to_match = [
        options.strip() if isinstance(options, str) else options
        for options in output_lan
    ]
    assert f"ICMPv6 Option (MTU : {ra_value})" in option_list_to_match, (
        "Configured MTU is not present in IPv6 Router Advertisement message"
    )
    bf_context.success = True  # type: ignore[attr-defined]
