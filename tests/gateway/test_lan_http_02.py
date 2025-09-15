"""[MV3]LAN to WAN IPv6 connectivity."""

import pytest
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.templates.lan import LAN
from boardfarm3.templates.wan import WAN
from boardfarm3.use_cases.networking import http_get, start_http_server
from pytest_boardfarm3.lib.test_logger import TestLogger


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {
                "eRouter_Provisioning_mode": ["dual", "ipv6"],
                "model": ["F5685LGB", "F5685LGE"],
                "lan_clients": [{}],
            }
        }
    }
)
def test_MVX_TST_69262(bf_logger: TestLogger, device_manager: DeviceManager) -> None:
    """LAN to WAN IPv6 connectivity."""
    wan = device_manager.get_device_by_type(WAN)  # type:ignore[type-abstract]
    lan = device_manager.get_device_by_type(LAN)  # type:ignore[type-abstract]
    wan_ip = wan.get_eth_interface_ipv6_address()

    bf_logger.log_step("Step1: Start the HTTP server on the WAN client")
    with start_http_server(wan, port="9001", ip_version=6):
        bf_logger.log_step(
            "Step2: Verify that the HTTP server running on the WAN "
            "client is accessible using IPv6."
        )
        result = http_get(lan, url=f"http://[{wan_ip}]:9001")
    assert result, "IPv6 connectivity from LAN client to WAN is not successful."
