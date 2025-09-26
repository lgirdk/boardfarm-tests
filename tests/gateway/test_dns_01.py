"""https://jira.lgi.io/browse/MVX_TST-598."""

import re
from collections.abc import Iterator

import pytest
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.lib.regexlib import AllValidIpv6AddressesRegex
from boardfarm3.templates.lan import LAN
from boardfarm3.use_cases.networking import (
    dhcp_renew_ipv4_and_get_ipv4,
    get_nslookup_data,
)
from pytest_boardfarm3.lib import ContextStorage, TestLogger


@pytest.fixture()
def setup_teardown(
    bf_context: ContextStorage, bf_logger: TestLogger, device_manager: DeviceManager
) -> Iterator[LAN]:
    """Set up teardown function."""
    bf_context.enable_ipv6 = False  # type: ignore[attr-defined]
    lan = device_manager.get_device_by_type(LAN)  # type:ignore[type-abstract]
    yield lan
    if bf_context.enable_ipv6:  # type: ignore[attr-defined]
        bf_logger.log_step("Teardown: Enable the IPv6 on Lan client")
        lan.enable_ipv6()


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {"eRouter_Provisioning_mode": ["dual"], "lan_clients": [{}]}
        }
    }
)
def test_MVX_TST_598(
    setup_teardown: LAN,  # pylint: disable=redefined-outer-name
    bf_logger: TestLogger,
    bf_context: ContextStorage,
) -> None:
    """DNS Resolve - CPE IPv4 address_Ethernet."""
    lan = setup_teardown

    bf_logger.log_step(
        "Step1: Disable IPv6 on lan client and make sure that lan client gets IPv4 "
        "address only."
    )
    lan.disable_ipv6()
    bf_context.enable_ipv6 = True  # type: ignore[attr-defined]
    assert lan.ipv4_addr, "Lan client doesn't have IPv4 address"
    assert (
        lan.ipv6_addr == ""
    ), f"IPv6 address still present in {lan.iface_dut} interface on LAN"

    bf_logger.log_step("Step2: Verify that IPv6 domain name can be resolved to IP.")
    dhcp_renew_ipv4_and_get_ipv4(lan)
    domain = "ipv6wan.boardfarm.com"
    output = get_nslookup_data(lan, domain, opts="-q=AAAA")
    assert domain == output["domain_name"], f"nslookup failed for {domain}"
    assert re.search(
        AllValidIpv6AddressesRegex, output["domain_ip_addr"][0]
    ), "DNS server fails to resolve IPv6 address"
