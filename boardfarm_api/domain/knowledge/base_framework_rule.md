## Use Cases First

For each test step, first check if a **use case** exists that implements the operation — check docstrings, not just names. Some docstrings have `.. hint::` sections that map test step phrases directly to the function. If a use case exists, use it. Templates, device APIs, and utilities are used **alongside** use cases as needed (for device types, attributes, parsing, retries) — but they don't replace a use case that covers the operation.

If you find yourself writing glue code that a use case could handle, check the stubs again.

## Test Steps Are Not 1:1

A single test step may need multiple functions or use cases composed together. Steps often depend on previous steps' output — data flows through the test. When implementing a step, think about what data it needs from earlier steps and what data it produces for later ones.

## Reading Stubs

- Read the **full signature** — match parameter names, types, defaults.
- Trust the **return type** — if it returns `list[dict]`, index the list and access keys. If `bool`, assert directly.
- **`[contextmanager]`** → use with `with`. It handles cleanup — never replicate manually.
- **`[fixture]`** → pass as function argument, never import.
- When a function takes `dict[str, Any]`, read the docstring for the expected key structure.

## Unknown Domain Values

If you need a domain-specific value (MIB name, event message, protocol constant, status code) that isn't in the stubs or test steps, add a `# TODO` comment rather than guessing. A wrong guess produces code that looks correct but fails at runtime.

## Device Retrieval

Always `# type:ignore[type-abstract]`. The template class and its import come from the stubs.
First check if a use case exists for getting devices (e.g., `get_lan_clients`).

## Provisioning Mode

When the test needs the current provisioning mode:
`boardfarm_config.get_prov_mode()` — from the `BoardfarmConfig` fixture parameter.

## Step Logging

Each test step gets a log call BEFORE the action:
`bf_logger.log_step("Step 1: Description matching the test step text")`
Teardown actions: `bf_logger.log_step("Teardown: Revert to original state")`

## Environment Requirement Marker

If the test preconditions specify device requirements or provisioning modes, add `@pytest.mark.env_req(...)` derived from those preconditions. If no preconditions are specified, no marker is needed.

## Setup/Teardown — Reason From the Test

**Does the test change persistent device state?**

- **YES** (config, firmware, mode, processes, network rules) → fixture with conditional teardown.
- **NO** (only reads/queries) → **no fixture**. Setup in the test body.

When a fixture IS needed:
1. Initialize bf_context flags to `False` (all flags need `# type: ignore[attr-defined]`)
2. Acquire devices and capture original state BEFORE yield
3. Set flag to `True` just BEFORE the mutating action — so if the action crashes, teardown still triggers
4. Teardown checks flags and reverts conditionally
5. Use `TeardownError` for unrecoverable failures in teardown

What teardown does depends on what changed: firmware → flash back, mode → revert and reboot and verify IP, pcap → copy to artifacts, config write → revert to original value.

**Context managers auto-handle cleanup.** If the only "cleanup" is stopping a process started with `with`, do NOT create a fixture for that.

## Resilient Operations

`retry_on_exception` is ONLY for hardware state transitions — boot wait, online check, IP acquisition after reboot/mode change.

After any operation that changes board state (reboot, firmware update, mode switch), the mandatory chain is: boot wait → online check → verify IP. Skipping any step causes the next one to fail.

**Do NOT** use retry for synchronous request-response: TR-069 RPCs, SNMP GET/SET/WALK, DMCLI calls. These succeed or fail immediately.

## What NOT to Do

- Do not invent framework functions — every call must come from the stubs
- Do not guess domain values — TODO if unknown
- Do not over-engineer — no extra assertions, no extra error handling, no retry around synchronous calls
- Do not create fixtures for read-only tests
- Do not add bf_context flags that no teardown checks
- Do not write explicit teardown for context manager resources
- Do not imitate other tests blindly — every line must trace to a test step requirement or a framework necessity
