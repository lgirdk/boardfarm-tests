"""https://jira.lgi.io/browse/MVX_TST-607."""

import re

import pytest
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.lib.regexlib import AllValidIpv6AddressesRegex
from boardfarm3.templates.lan import LAN
from boardfarm3.templates.wan import WAN
from boardfarm3.use_cases.networking import get_nslookup_data
from pytest_boardfarm3.lib import TestLogger


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {"eRouter_Provisioning_mode": ["ipv4"], "lan_clients": [{}]}
        }
    }
)
def test_MVX_TST_607(device_manager: DeviceManager, bf_logger: TestLogger) -> None:
    """DNS Resolve -IPv4RG mode- CPE IPv4 address_Ethernet."""
    wan = device_manager.get_device_by_type(WAN)  # type:ignore[type-abstract]
    lan = device_manager.get_device_by_type(LAN)  # type:ignore[type-abstract]
    wan_ipv4 = wan.ipv4_addr
    wan_host = "wan.boardfarm.com"

    bf_logger.log_step("Step1: Verify that IPv6 domain name can be resolved to IP.")
    output = get_nslookup_data(lan, f"{wan_host}", opts="-q=AAAA")
    assert wan_host == output["domain_name"], f"nslookup failed for {wan_ipv4}"
    assert re.search(AllValidIpv6AddressesRegex, output["domain_ip_addr"][0]), (
        "DNS server fails to resolve IPv6 address"
    )
