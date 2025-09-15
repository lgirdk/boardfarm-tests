"""https://jira.lgi.io/browse/MVX_TST-35578."""

import pytest
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.templates.acs import ACS
from boardfarm3.templates.cpe.cpe import CPE
from boardfarm3.templates.lan import LAN
from boardfarm3.use_cases.tr069 import get_parameter_values
from pytest_boardfarm3.lib import TestLogger


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {"eRouter_Provisioning_mode": ["dual"], "lan_clients": [{}]},
            "tr-069": {},
        }
    }
)
def test_MVX_TST_35578(device_manager: DeviceManager, bf_logger: TestLogger) -> None:
    """The purpose of this test case is to verify the ethernet LAN hosts information.

    through below TR181 data model parameters.
    Device.Hosts.Host.{i}.PhysAddress
    Device.Hosts.Host.{i}.Active
    Device.Hosts.Host.{i}.AssociatedDevice
    Device.Hosts.Host.{i}.Layer1Interface
    Device.Hosts.Host.{i}.HostName
    Device.Hosts.Host.{i}.IPAddress
    Device.Hosts.Host.{i}.IPv6Address.IPAddress
    """
    board = device_manager.get_device_by_type(CPE)  # type:ignore[type-abstract]
    acs = device_manager.get_device_by_type(ACS)  # type:ignore[type-abstract]
    lan = device_manager.get_device_by_type(LAN)  # type:ignore[type-abstract]
    lan_mac_addr = lan.get_interface_macaddr(lan.iface_dut).upper()

    bf_logger.log_step(
        "Step 1 : Make sure that DUT is registered on the ACS - "
        "Handled in pre-condition"
    )

    bf_logger.log_step(
        "Step 2 : Execute GetParameterValues RPC by providing parameter name "
        "as 'Device.Hosts.Host.(i).PhysAddress'"
    )
    phys_add_val = get_parameter_values("Device.Hosts.Host.1.PhysAddress", acs, board)[
        0
    ]["value"]
    assert phys_add_val.upper() == lan.get_interface_macaddr(lan.iface_dut).upper(), (
        "Fail : GetParameterValues is fail and not returns the MAC"
        "address of ethernet device"
    )

    bf_logger.log_step(
        "Step 3 : Execute GetParameterValues RPC by providing parameter name "
        "as 'Device.Hosts.Host.(i).Active'"
    )
    assert (
        get_parameter_values("Device.Hosts.Host.1.Active", acs, board)[0]["value"] == 1
    ), f"LAN client 1 having mac {lan_mac_addr} is not active from acs"

    bf_logger.log_step(
        "Step 4 : Execute GetParameterValues RPC by providing parameter"
        "name as 'Device.Hosts.Host.(i).AssociatedDevice'"
    )
    assert (
        get_parameter_values("Device.Hosts.Host.1.AssociatedDevice", acs, board)[0][
            "value"
        ]
        == ""
    ), "Fail : GetParamterValues is fail and not returns an empty string"

    bf_logger.log_step(
        "Step 5 : Execute GetParameterValues RPC by providing parameter"
        "name as 'Device.Hosts.Host.(i).Layer1Interface'"
    )
    interface_val = get_parameter_values(
        "Device.Hosts.Host.1.Layer1Interface", acs, board
    )[0]["value"]
    assert interface_val in (
        "Device.Ethernet.Interface.1",
        "Device.Ethernet.Interface.2",
    ), (
        "Fail: GetParameterValues is fail and not returns a string "
        "Device.Ethernet.Interface.1 or Device.Ethernet.Interface.2"
    )

    bf_logger.log_step(
        "Step 6 : Execute GetParameterValues RPC by providing parameter"
        "name as 'Device.Hosts.Host.(i).HostName'"
    )
    hostname = get_parameter_values("Device.Hosts.Host.1.HostName", acs, board)[0][
        "value"
    ]
    assert hostname == lan.get_hostname(), (
        "Fail: GPV fail and not returns Ethernet client device's host name."
    )

    bf_logger.log_step(
        "Step 7 : Execute GetParameterValues RPC by providing "
        "below parameter names: "
        "'Device.Hosts.Host.{i}.IPAddress'"
        "'Device.Hosts.Host.{i}.IPv6Address.' "
        "i: instance of Ethernet client device"
    )
    host_ip_address = get_parameter_values("Device.Hosts.Host.1.IPAddress", acs, board)[
        0
    ]["value"]
    host_ipv6_address = get_parameter_values(
        "Device.Hosts.Host.1.IPv6Address.", acs, board
    )[0]["value"]
    assert host_ip_address == lan.ipv4_addr, (
        "Fail : Device.Hosts.Host.1.IPv4Address.1.IPAddress is"
        "different than on interface"
    )
    assert host_ipv6_address == lan.get_interface_link_local_ipv6addr(lan.iface_dut), (
        "Fail : Device.Hosts.Host.1.IPv6Address.1.IPAddress is different"
        "than on interface"
    )
