"""LAN services - HTTP access using IPv6."""

import pytest
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.templates.lan import LAN
from boardfarm3.use_cases.networking import http_get, start_http_server
from pytest_boardfarm3.lib.test_logger import TestLogger


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {
                "eRouter_Provisioning_mode": ["dual", "ipv6", "disabled"],
                "lan_clients": [{}, {}],
            },
        },
    }
)
def test_MVX_TST_744(bf_logger: TestLogger, device_manager: DeviceManager) -> None:
    """LAN services - HTTP access using IPv6."""
    port = "9000"
    lan1, lan2, *_ = device_manager.get_devices_by_type(
        LAN  # type: ignore[type-abstract]
    ).values()
    bf_logger.log_step("Step1: Start the HTTP server on the CPE2 client")
    lan2_ip = lan2.get_interface_ipv6addr(lan2.iface_dut)
    with start_http_server(lan2, port=port, ip_version="6"):
        bf_logger.log_step(
            "Step2: From CPE1, access the http server on CPE2 using IPv6 address."
        )
        assert http_get(lan1, f"-k -m 10 http://[{lan2_ip}]:{port}"), (
            "lan1 is unable to reach the HTTP server on lan2 using IPv6 address."
        )
