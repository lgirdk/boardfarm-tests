---
name: gui
description: GUI browser testing — browser_data fixture, Selenium page objects, DMCLI/TR-069 verification of GUI changes.
is_active: true
---

## GUI / Selenium / Page Object

### The browser_data Fixture (Not in Stubs)

GUI tests use `browser_data` — a conftest fixture, not found by search.
It yields: `(driver, gateway_ip, password)`.

- `driver` — Selenium `EventFiringWebDriver`. The fixture calls `driver.quit()` in teardown.
- `gateway_ip` — `IPv4Address` of the board's LAN gateway.
- `password` — GUI login password string.

### Page Object Pattern

Page objects from stubs take `(driver, gw_ip, password)` and optionally `fluent_wait` (seconds):
```python
page = SomePage(driver, gw_ip, password, 90)
```

Use `retry_on_exception` for flaky page loads — page constructors can timeout:
```python
page = retry_on_exception(SomePage, (driver, gw_ip, password, 90), 5, 30)
```

Common method patterns:
- `page.wait_until_loaded()` → bool (call after construction)
- `page.click_apply_changes()` → triggers form submission
- `page.wait_until_element_loaded(page.some_element)` → waits for dynamic content
- Getter methods return strings, state-check methods return bools.

### Verifying GUI Changes

After a GUI action, verify it took effect via DMCLI or TR-069:

**DMCLI:** `board.sw.dmcli.GPV(param)` returns an object with `.rval`.
`board.sw.dmcli.SPV(param, value, type_str)` sets a value.

**TR-069:** Use `get_parameter_values` / `set_parameter_values` from stubs.

### After Network-Changing Operations

If the GUI action changes network state (DHCP, mode switch), re-navigate:
```python
retry_on_exception(driver.get, (f"http://{gw_ip}",), retries=3, tout=20)
```

Allow settle time before re-instantiating page objects.

### Teardown

If the test changes device config through the GUI, revert via DMCLI or TR-069 SPV in teardown — not by navigating the GUI again. DMCLI/TR-069 is more reliable for teardown.
