"""[SEC] PortScan - IPv4RG Mode - Port scan eRouter WAN IP from WAN (MVX_TST-371)."""

from typing import Any

import pytest
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.templates.cpe import CPE
from boardfarm3.templates.wan import WAN
from boardfarm3.use_cases.networking import create_tcp_udp_session
from pytest_boardfarm3.lib import TestLogger


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {
                "eRouter_Provisioning_mode": ["ipv4"],
                "lan_clients": [{}],
            }
        }
    }
)
def test_IPv4RG_Mode_Port_scan_eRouter_WAN_IP_from_WAN(
    device_manager: DeviceManager,
    bf_logger: TestLogger,
) -> None:
    """[SEC] PortScan - IPv4RG Mode - Port scan eRouter WAN IP from WAN.

    The objective of this test case is to verify that None of the ports should be open
    by default on Erouter WAN IP when tried from WAN Client in IPv4 mode.
    """
    wan = device_manager.get_device_by_type(WAN)  # type:ignore[type-abstract]
    board = device_manager.get_device_by_type(CPE)  # type:ignore[type-abstract]

    def _output_validation(nmap_output: dict[str, Any]) -> None:
        tcp_port_state = nmap_output["nmaprun"]["host"]["ports"]["port"][0]["state"][
            "@state"
        ]
        udp_port_state = nmap_output["nmaprun"]["host"]["ports"]["port"][1]["state"][
            "@state"
        ]
        assert tcp_port_state == "filtered", "tcp ports are opened"
        assert udp_port_state == "open|filtered", "udp ports are opened"

    bf_logger.log_step(
        "Step 1:  Run nmap to erouter WAN IP from WAN Client and verify that "
        "no ports are open. "
    )
    nmap_output = create_tcp_udp_session(wan, board, "ipv4", 65535, 4, timeout=30)
    assert "Nmap done" in str(nmap_output), "NMAP is not successful"
    assert "1 IP address (1 host up)" in str(
        nmap_output
    ), "Expected host status not found in Nmap output"
    _output_validation(nmap_output)
