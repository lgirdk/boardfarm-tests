"""https://jira.lgi.io/browse/MVX_TST-603."""

import re
from collections.abc import Iterator

import pytest
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.lib.regexlib import AllValidIpv6AddressesRegex
from boardfarm3.templates.lan import LAN
from boardfarm3.templates.wan import WAN
from boardfarm3.use_cases.networking import get_nslookup_data
from pytest_boardfarm3.lib import ContextStorage, TestLogger


@pytest.fixture()
def setup_teardown(
    bf_context: ContextStorage, bf_logger: TestLogger, device_manager: DeviceManager
) -> Iterator[tuple[LAN, WAN]]:
    """Set up teardown function."""
    bf_context.enable_ipv4 = False  # type: ignore[attr-defined]
    lan = device_manager.get_device_by_type(LAN)  # type:ignore[type-abstract]
    wan = device_manager.get_device_by_type(WAN)  # type:ignore[type-abstract]
    yield lan, wan
    if bf_context.enable_ipv4:  # type: ignore[attr-defined]
        bf_logger.log_step("Teardown: Enable the IPv4 on Lan client")
        lan.renew_dhcp(lan.iface_dut)


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {"eRouter_Provisioning_mode": ["dual"], "lan_clients": [{}]}
        }
    }
)
def test_MVX_TST_603(
    setup_teardown: tuple[LAN, WAN],  # pylint: disable=redefined-outer-name
    bf_logger: TestLogger,
    bf_context: ContextStorage,
) -> None:
    """DNS Resolve - CPE IPv6 address_Ethernet."""
    lan, wan = setup_teardown
    wan_ipv6 = wan.ipv6_addr
    bf_logger.log_step(
        "Step1: Disable IPv4 on lan client and make sure that lan client gets IPv6 "
        "address only."
    )
    lan.release_dhcp(lan.iface_dut)
    bf_context.enable_ipv4 = True  # type: ignore[attr-defined]
    assert lan.ipv6_addr, "Lan client doesn't have IPv6 address"
    assert lan.ipv4_addr == "", (
        f"IPv4 address still present in {lan.iface_dut} interface on LAN"
    )

    bf_logger.log_step("Step2: Verify that IPv6 domain name can be resolved to IP.")
    domain = "ipv6wan.boardfarm.com"
    output = get_nslookup_data(lan, f"{domain} {wan_ipv6}", opts="-q=AAAA")
    assert domain == output["domain_name"], f"nslookup failed for {wan_ipv6}"
    assert re.search(AllValidIpv6AddressesRegex, output["domain_ip_addr"][0]), (
        "DNS server fails to resolve IPv6 address"
    )
