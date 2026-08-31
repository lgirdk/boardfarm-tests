---
name: stability
description: Long-duration stability tests — timeout(0) marker, polling loops, uptime tracking, failure collection.
is_active: true
---

## Stability / Long-Duration Tests

### Timeout Marker

Always `@pytest.mark.timeout(0)` — stability tests run for hours.

### Loop Structure

Use `datetime.now(tz=timezone.utc)` with `timedelta(hours=DURATION)` for the loop boundary. Track iteration count and failures in a list. Sleep between iterations.

### Uptime Guard

Capture `board.get_seconds_uptime()` before the loop. Assert it's still increasing each iteration — detects unexpected reboots/crashes.

### Failure Handling

Catch `AssertionError` and `BoardfarmException` per iteration — append to a failed list instead of immediately failing. Assert on the failed list after the loop ends. This gives a complete picture of stability over the duration.

### Reboot Stability

Set `bf_context.reboot_required = True` before risky operations, clear it after verification succeeds. Teardown power-cycles and verifies if the flag is still set.
