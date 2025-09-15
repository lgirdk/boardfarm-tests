"""MVX_TST-113350."""

from collections.abc import Iterator

import pytest
from boardfarm3.exceptions import TeardownError
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.lib.utils import retry, retry_on_exception
from boardfarm3.templates.acs import ACS
from boardfarm3.templates.cpe.cpe import CPE
from boardfarm3.use_cases.cpe import get_cpe_provisioning_mode
from boardfarm3.use_cases.erouter import verify_erouter_ip_address
from boardfarm3.use_cases.online_usecases import (
    is_board_online_after_reset,
    power_cycle,
)
from boardfarm3.use_cases.tr069 import (
    factory_reset,
    get_parameter_values,
    is_dut_online_on_acs,
)
from pytest_boardfarm3.lib.test_logger import TestLogger
from pytest_boardfarm3.lib.utils import ContextStorage


@pytest.fixture()
def setup_teardown(
    bf_context: ContextStorage,
    device_manager: DeviceManager,
    bf_logger: TestLogger,
) -> Iterator[tuple[str, CPE, ACS]]:
    """Test fixture."""
    bf_context.check_after_reboot = False  # type: ignore[attr-defined]
    board = device_manager.get_device_by_type(CPE)  # type:ignore[type-abstract]
    acs = device_manager.get_device_by_type(ACS)  # type:ignore[type-abstract]
    mode = get_cpe_provisioning_mode(board=board)

    yield mode, board, acs

    if bf_context.check_after_reboot:  # type: ignore[attr-defined]
        bf_logger.log_step(
            "Teardown: Rebooting as the DUT was not online after factory reset "
            "in test step."
        )
        power_cycle(board)
        if not retry_on_exception(is_board_online_after_reset, (), 5, 15):
            msg = "Board not online after reboot in teardown"
            raise TeardownError(msg)
        if not verify_erouter_ip_address(mode=mode, board=board, retry=9):
            msg = f"erouter does not get ip in required mode {mode}"
            raise TeardownError(msg)


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {
                "eRouter_Provisioning_mode": ["ipv6", "dual", "ipv4"],
                "lan_clients": [{}],
            },
            "tr-069": {},
        }
    }
)
def test_MVX_TST_113350(
    setup_teardown: tuple[str, CPE, ACS],  # pylint: disable=redefined-outer-name
    bf_logger: TestLogger,
    bf_context: ContextStorage,
) -> None:
    """ACS connectivity after performing factory reset on the CPE."""
    mode, board, acs = setup_teardown
    param = "Device.ManagementServer.URL"

    bf_logger.log_step(f"Step1: Perform GPV RPC by providing parameter name as {param}")
    acs_url = get_parameter_values(param, acs, board)[0]["value"]
    assert acs_url, f"acs url from gpv of {param} does not match expected url {acs_url}"

    bf_logger.log_step(
        "Step2: Perform a factory reset on the CPE and wait till CPE comes online"
    )
    bf_context.check_after_reboot = True  # type: ignore[attr-defined]
    factory_reset(acs, board)
    bf_context.check_after_reboot = False  # type: ignore[attr-defined]
    assert verify_erouter_ip_address(mode=mode, board=board, retry=9), (
        f"erouter didn't get erouter ip for {mode}"
    )

    bf_logger.log_step("Step3: Verify the DUT registration status on the ACS")
    assert retry(is_dut_online_on_acs, 6, acs, board), (
        "DUT is not online on ACS after factory reset"
    )

    bf_logger.log_step(
        f"Step4: Verify ACS Connectivity by performing GPV RPC on {param}"
    )
    assert get_parameter_values(param, acs, board)[0]["value"] == acs_url, (
        f"acs url from gpv of {param} does not match expected url {acs_url}"
    )
