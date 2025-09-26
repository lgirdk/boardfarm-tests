"""[SCMv3]: GetParameterValues RPC on "Device." object."""

from collections.abc import Iterator

import pytest
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.templates.acs import ACS
from boardfarm3.templates.cpe import CPE
from boardfarm3.use_cases.tr069 import (
    get_ccsptr069_pid,
    get_parameter_values,
    set_parameter_values,
)
from pytest_boardfarm3.boardfarm_fixtures import ContextStorage
from pytest_boardfarm3.lib.test_logger import TestLogger


@pytest.fixture()
def setup_teardown(
    bf_context: ContextStorage,
    bf_logger: TestLogger,
    device_manager: DeviceManager,
) -> Iterator[tuple[str, CPE, ACS]]:
    """Test setup and teardown."""
    bf_context.spv_success = False  # type: ignore[attr-defined]
    board = device_manager.get_device_by_type(CPE)  # type:ignore[type-abstract]
    acs = device_manager.get_device_by_type(ACS)  # type:ignore[type-abstract]
    dns_param = "Device.DNS.Diagnostics.NSLookupDiagnostics.NumberOfRepetitions"
    default_value = get_parameter_values(dns_param, acs, board)[0]["value"]

    yield dns_param, board, acs

    if bf_context.spv_success:  # type: ignore[attr-defined]
        bf_logger.log_step(f"Teardown: Set {dns_param} value to default")
        set_parameter_values([{dns_param: default_value}], acs, board)


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {"lan_clients": [{}]},
            "tr-069": {},
        }
    }
)
def test_MVX_TST_105789(
    setup_teardown: tuple[str, CPE, ACS],  # pylint: disable=redefined-outer-name
    bf_logger: TestLogger,
    bf_context: ContextStorage,
) -> None:
    """[SCMv3]: GetParameterValues RPC on "Device." object."""
    dns_param, board, acs = setup_teardown
    dns_value = 4

    bf_logger.log_step("Step 1: Perform GPV on: Device.")
    assert get_parameter_values("Device.WiFi.", acs, board), "GPV is unsuccessful"

    bf_logger.log_step("Step 2: Check CCSPTr069 process")
    assert get_ccsptr069_pid(board), "CCSPTr069 process is not running"

    bf_logger.log_step(
        f"Step 3: Execute SPV RPC by providing parameter name as: {dns_param} and "
        "value as 4"
    )
    assert set_parameter_values([{dns_param: dns_value}], acs, board) in [
        0,
        1,
    ], f"Failed to set {dns_param} value to 4"
    bf_context.spv_success = True  # type: ignore[attr-defined]

    bf_logger.log_step(
        f"Step 4: Execute GPV RPC by providing parameter name as: {dns_param}"
    )
    assert (
        get_parameter_values(dns_param, acs, board)[0]["value"] == dns_value
    ), "GPV is unsuccessful and did not returned value as 4"
