"""https://jira.lgi.io/browse/MVX_TST-6559."""

import re
import tempfile
import time
from collections.abc import Iterator
from typing import Any

import pytest
from boardfarm3.exceptions import TeardownError
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.lib.utils import get_pytest_name, retry
from boardfarm3.templates.acs import ACS
from boardfarm3.templates.cpe.cpe import CPE
from boardfarm3.use_cases.cpe import get_cpe_provisioning_mode
from boardfarm3.use_cases.erouter import (
    get_erouter_addresses,
    verify_erouter_ip_address,
)
from boardfarm3.use_cases.networking import (
    copy_pcap_to_artifacts,
    tcpdump_on_device,
)
from boardfarm3.use_cases.online_usecases import (
    is_board_online_after_reset,
    power_cycle,
)
from boardfarm3.use_cases.tr069 import is_dut_online_on_acs
from pytest_boardfarm3.lib.test_logger import TestLogger
from pytest_boardfarm3.lib.utils import ContextStorage


@pytest.fixture()
def setup_teardown(
    bf_context: ContextStorage,
    device_manager: DeviceManager,
    bf_logger: TestLogger,
) -> Iterator[tuple[CPE, ACS, str, str, Any]]:
    """Test setup_teardown."""
    (bf_context.tcpdump_started) = bf_context.success = (  # type: ignore[attr-defined]
        bf_context.check_after_reboot  # type: ignore[attr-defined]
    ) = False
    acs = device_manager.get_device_by_type(ACS)  # type:ignore[type-abstract]
    board = device_manager.get_device_by_type(CPE)  # type:ignore[type-abstract]
    mode = get_cpe_provisioning_mode(board=board)
    tmp = tempfile.template
    pcap_file = (
        f"/{tmp}/{get_pytest_name().split('(')[0]}_{mode}_"
        f"{time.strftime('%Y%m%d_%H%M%S')}.pcap"
    )

    def _board_reset() -> bool:
        power_cycle()
        return is_board_online_after_reset()

    yield board, acs, pcap_file, mode, _board_reset

    if bf_context.check_after_reboot:  # type: ignore[attr-defined]
        bf_logger.log_step(
            "Teardown: Rebooting as the DUT was not online after reboot in test step."
        )
        if not _board_reset():
            msg = "Board not online after reboot in teardown."
            raise TeardownError(msg)
        if not verify_erouter_ip_address(mode=mode, board=board, retry=9):
            msg = f"erouter does not get ip in required mode {mode}"
            raise TeardownError(msg)

    if bf_context.tcpdump_started:  # type: ignore[attr-defined]
        bf_logger.log_step("Teardown: Copy pcap file to results.")
        copy_pcap_to_artifacts(
            pcap_file,
            acs,
            bf_context.success,  # type: ignore[attr-defined]
        )


@pytest.mark.env_req(
    {
        "environment_def": {
            "board": {
                "eRouter_Provisioning_mode": ["dual", "ipv4", "ipv6"],
                "lan_clients": [{}],
            },
            "tr-069": {},
        }
    }
)
def test_MVX_TST_6559(
    setup_teardown: tuple[CPE, ACS, str, str, Any],  # pylint: disable=redefined-outer-name
    bf_logger: TestLogger,
    bf_context: ContextStorage,
) -> None:
    """DUT must send Inform RPC and establish a connection to the ACS when DUT reboots.

    from Console
    The purpose of this test to verify that DUT must establish a connection to the ACS
    and issue the Inform RPC when DUT is rebooted from ARM/ATOM Console.
    """
    board, acs, pcap_file, mode, _board_reset = setup_teardown
    erouter_ips = get_erouter_addresses(retry_count=3, board=board)
    ipv4, ipv6 = erouter_ips.ipv4, erouter_ips.ipv6
    erouter_ip = str(ipv4) if mode == "ipv4" else str(ipv6)
    read_filter = (
        f"host {erouter_ip} or {ipv4!s}" if mode == "dual" else f"host {erouter_ip}"
    )

    bf_logger.log_step(
        "Step 1: Make sure you can read the Inform message being sent from the "
        "DUT to the ACS. "
    )
    with tcpdump_on_device(
        device=acs,
        fname=pcap_file,
        interface="any",
        filters=None,
    ):
        bf_context.tcpdump_started = True  # type: ignore[attr-defined]

        bf_logger.log_step("Step 2: Reboot the DUT from its Console. ")
        bf_context.check_after_reboot = True  # type: ignore[attr-defined]
        assert _board_reset(), "DUT did not come online after reboot"

        bf_logger.log_step(
            "Step 3: Verify DUT comes back online and eRouter gets an IP address."
        )
        assert verify_erouter_ip_address(
            mode=mode, board=board, retry=9
        ), f"erouter does not get ip in required mode {mode}"
        bf_context.check_after_reboot = False  # type: ignore[attr-defined]
        time.sleep(60)  # wait for packet capture to complete

    bf_logger.log_step(
        "Step 4: Verify the DUT should establish a connection to the ACS and "
        "issue the Inform message after reboot. "
    )
    assert retry(
        is_dut_online_on_acs, 5, acs, board
    ), "DUT is not online on ACS after reboot"
    tcpdump_output = acs.tcpdump_read_pcap(  # type: ignore[attr-defined]
        fname=pcap_file, additional_args=f"-A {read_filter}", timeout=90
    )
    output = tcpdump_output.replace("\r", "").replace("\n", "").replace("\t", "")
    eventcode_result = re.search(
        r"\<cwmp:Inform\>.*<EventCode>1 BOOT</EventCode>", output
    )
    assert (
        eventcode_result
    ), "Inform message with '1 BOOT' event is not present in pcap data"
    bf_context.success = True  # type: ignore[attr-defined]
