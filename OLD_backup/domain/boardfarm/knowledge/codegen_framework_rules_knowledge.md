## The Stubs Are Your Framework API

The stub entries provided are the available framework functions, classes, and 
methods for this test. All framework imports and function calls must come from 
these stubs - do not invent framework functions, methods, or attributes that 
aren't documented in the stubs.

The implementation analysis is background context — it describes what each 
step needs to achieve, not how to implement it. The stubs define how. 
Always choose your implementation approach from the stubs, not from the 
analysis.

Standard Python is yours to use freely - variables, conditionals, loops, 
assertions, string operations, list and dict access, context managers, 
f-strings. Use these to implement test logic, connect steps, extract values 
from function returns, and build assertions.

When working with return values, trust the signature. If a function returns 
`list[dict[str, Any]]`, access the list and dict normally. If it returns 
`bool`, assert on it directly. Do not assume attributes or methods on return 
values that the signature doesn't indicate.

If you need a domain-specific value (event message, MIB name, protocol 
constant) that isn't in the stubs or test steps, add a TODO comment rather 
than guessing.

## What This Project Is

This project writes pytest-based hardware test automation for CPE/cable modem 
devices. Tests use three categories of building blocks:

- **Use Cases** - high-level operations that implement test step actions. These 
  are the primary building blocks. Always look for a use case first.
- **Templates** - abstract device interfaces. Use cases accept templates as 
  parameters. They define what devices can do.
- **Supporting Utilities** - helpers that work alongside use cases: retry 
  wrappers, data extraction, parsing, validation. They support the test flow 
  but don't implement test steps on their own.

Tests use use cases and templates only, never concrete device implementations.

## How Test Steps Map to Code

Test steps are not a 1:1 map to functions. A step might need use cases and 
supporting utilities working together. Steps often depend on previous steps' 
output - data flows through the test.

For each step:
1. Look for a USE CASE that implements the step's intent - check the docstring, 
   not just the name. Names can be counterintuitive; the docstring is the contract.
2. Identify the TEMPLATE types from the use case's parameter signature
3. If no single use case covers the step, compose multiple use cases and 
   supporting utilities
4. If writing glue code that a use case could handle, check the stubs again. 
   If nothing exists, write minimal code to bridge the gap.

## Reading Stub Entries

Each stub entry shows a function or class with its signature, import path, and 
docstring. Pay attention to:

- **Signatures** - read the full signature: parameter names, types, defaults, 
  return type. Match your calls to what the signature expects.
- **Return types** - work with what the function actually returns. Do not assume 
  or invent structure beyond what the signature and docstring describe.
- **Tags** - `[contextmanager]` means use with a `with` statement. The context 
  manager handles setup and cleanup automatically - do not manually replicate 
  what it does and do not write explicit teardown for it. `[fixture]` means pass 
  as function argument, never import. `[staticmethod]` means call on the class.
- **Docstrings** - the docstring is the contract. Read it fully. Some functions 
  have `.. hint::` sections that map test step phrases directly to the function.

When a function takes generic dict parameters (dict[str, Any]), read the full 
docstring for expected key-value structure. If ambiguous, check the example 
test for the actual calling pattern.

When working with return values, follow the signature. If it returns bool, 
assert on the bool. If it returns int, do not assume it maps to status codes 
unless the docstring says so. Do not invent attributes on return values.

## Device Retrieval

First check if a use case exists for getting devices (e.g., `get_lan_clients`). 
If no specialized use case exists, use the direct pattern:
```python
board = device_manager.get_device_by_type(CableModem)  # type:ignore[type-abstract]
```
Always add `# type:ignore[type-abstract]`. The device template class and its 
import come from the DEVICE TEMPLATES section of the stubs.

## Provisioning Mode

When the test needs the current provisioning mode:
```python
mode = boardfarm_config.get_prov_mode()
```

## Resilient Operations

Retry wrapping is for operations where the device is transitioning between 
states and the result depends on timing — boot sequences, online checks, 
IP acquisition after reboot or mode change:
```python
retry_on_exception(wait_for_board_boot_start, args=(board,), retries=10, tout=10)
assert retry_on_exception(
    is_board_online_after_reset, args=(), retries=10, tout=10
), "Board not online post reboot"
```
After any operation that changes board state (reboot, firmware update, mode 
switch), verify IP acquisition:
```python
verify_erouter_ip_address(mode=mode, board=board, retry=9)

Synchronous request-response operations (TR-069 RPCs, SNMP GET/SET/WALK, 
direct device commands) do not need retry wrapping — they succeed or fail 
immediately. Only add retry to these if the test step specifically requires 
polling for a value to change over time.

## Step Logging

```python
bf_logger.log_step("Step 1: Description closely matching the test step text")
```

## Environment Requirement Marker

If the test preconditions specify device requirements or provisioning modes, 
add the `env_req` marker derived from those preconditions. If no preconditions 
are specified, no marker is needed.

## Setup/Teardown - Reason From the Test

Ask: does this test change persistent device state?

If the test MODIFIES anything - configuration, firmware, mode, running processes, 
network rules - teardown must revert it. If the test only READS or QUERIES - 
no teardown needed.

Common examples (not exhaustive): firmware changed → flash back, mode changed → 
revert and reboot and verify IP, pcap started → copy to artifacts, traffic 
started → stop processes. Any configuration write (SNMP SET, TR-069 SPV, dmcli, 
firewall, WiFi, routing, VLAN, DNS) needs reverting.

**If nothing needs teardown, do NOT create a setup_teardown fixture.** Do setup 
directly in the test body. A read-only test with an unnecessary fixture is 
over-engineering.

Do not add teardown because other tests have it. Do not imitate.

When teardown IS needed, follow this structure - adapt it to your test's 
specific needs, do not copy it literally:
```python
@pytest.fixture()
def setup_teardown(
    bf_context: ContextStorage,
    device_manager: DeviceManager,
    bf_logger: TestLogger,
) -> Iterator[tuple[...]]:
    bf_context.some_flag = False  # type: ignore[attr-defined]
    board = device_manager.get_device_by_type(...)  # type:ignore[type-abstract]
    
    # Capture original state BEFORE yield
    original_value = get_current_something(board)
    
    yield devices_and_precomputed_values
    
    if bf_context.some_flag:
        bf_logger.log_step("Teardown: Revert to original state")
        # revert, wait for boot, verify online, verify IP
```

Key principles:
- Capture original state BEFORE yield - teardown needs it even if test fails
- Set `bf_context.flag = True` just BEFORE the mutating action, not after
- Only revert what was modified (check bf_context flags)
- Use `retry_on_exception` for hardware operations in teardown
- Raise `TeardownError` on unrecoverable failure

## Framework Fixture Imports

These are always available and never found through stub search:
```python
import pytest
from collections.abc import Iterator
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.lib.boardfarm_config import BoardfarmConfig
from boardfarm3.lib.utils import retry_on_exception
from boardfarm3.exceptions import TeardownError
from pytest_boardfarm3.lib import ContextStorage, TestLogger
```
Include only what the test actually uses.

## Common Calling Patterns

Packet capture on a device (LAN, WAN, ACS):
    device = device_manager.get_device_by_type(LAN)
    with tcpdump_on_device(device=device, fname=pcap_file, interface=device.iface_dut):

SPV parameter format:
    set_parameter_values([{"Device.Path.Param": value}], acs=acs, board=board)
    NOT: [{"name": "...", "value": "..."}]

GPV result parsing:
    result = get_parameter_values("Device.Path.", acs=acs, board=board)
    value_dict = {p["key"]: p["value"] for p in result}

Copy pcap to artifacts in teardown:
    copy_pcap_to_artifacts(pcap_file, device, bf_context.success)


## What NOT to Do

Do not invent framework functions, methods, or attributes. Every framework 
import and call must come from the stubs. Standard Python and local test 
logic are fine.

Do not over-engineer. No assertions the step doesn't ask for. No bf_context 
flags that no teardown checks. No fixtures the test doesn't use. No 
retry_on_exception around synchronous calls (TR-069 RPCs, SNMP operations) — 
retry is only for hardware state transitions (boot, online check, IP 
acquisition).

Do not imitate blindly. Every line must trace to a test step requirement or 
a framework necessity.