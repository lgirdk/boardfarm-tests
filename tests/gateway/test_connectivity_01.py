"""LAN to WAN IPv4 connectivity (MVX_TST-533)."""

import pytest
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.templates.lan import LAN
from boardfarm3.templates.wan import WAN
from boardfarm3.use_cases.networking import start_http_server
from boardfarm3.use_cases.online_usecases import is_wan_accessible_on_client
from pytest_boardfarm3.lib.test_logger import TestLogger


@pytest.mark.env_req({"environment_def": {"board": {"lan_clients": [{}]}}})
def test_LAN_to_WAN_IPv4_connectivity(
    bf_logger: TestLogger,
    device_manager: DeviceManager,
) -> None:
    """LAN to WAN IPv4 connectivity."""
    port = 9000
    wan = device_manager.get_device_by_type(WAN)  # type:ignore[type-abstract]
    lan = device_manager.get_device_by_type(LAN)  # type:ignore[type-abstract]

    bf_logger.log_step("STEP 1: Start the HTTP server on the WAN client")
    with start_http_server(wan, port=port, ip_version="4"):
        bf_logger.log_step(
            "STEP 2: Verify that the HTTP server running on the WAN "
            "client is accessible using IPv4"
        )
        assert is_wan_accessible_on_client(
            lan, port, wan=wan
        ), "WAN is not accessible on LAN client via IPv4"
