---
name: snmp
description: SNMP operations — snmp_walk/get/set return structures, stype values, MIB OID handling, LLC filters, DOCSIS MIBs.
is_active: true
---

## SNMP Operations

### Return Structures (Non-Obvious)

**snmp_walk** returns a **tuple**: `(dict, formatted_string)`.
- `[0]` is a dict: keys are OID strings, values are lists `[value, metadata]`.
  To get a clean value dict: `{k: v[0].replace("\r", "") for k, v in output.items()}`
- `[1]` is a formatted string for quick pattern assertions.

**snmp_get** returns a **string** (may include type prefix like `"INTEGER: 2"`).
Cast with `int()` if you need a number.

**snmp_set** returns a **tuple** — extract `[0]` for the set value.

### stype Parameter

`snmp_set` requires `stype`: `"i"` for integer, `"s"` for string.
The `value` parameter must always be a **string** — use `str(numeric_value)`.

### Index Handling

- Indexed MIBs: `index=1`, `index=2`, etc.
- Non-indexed MIBs (e.g., `sysContact`): `index=0`.
- Optional: `community="private"`, `cmd_timeout=30`.

### get_mib_oid

Translates a MIB name to numeric OID. Used for building expected verification dicts:
`f"{get_mib_oid(mib_name, board)}.{index}"`

### LLC Filter Status Codes

`docsDevFilterLLCStatus`: `1`=active, `4`=createAndGo (create entry), `6`=destroy (delete entry).

### DOCSIS Software Update MIBs

The `software_update` use cases wrap DOCSIS SNMP MIBs. The composition chain after triggering an update: `wait_for_update_to_complete` → boot wait → online check → verify IP → verify version. Operation status codes: `1`=idle, `2`=completeFromProvisioning, `3`=completeFromMgt, `4`=failed.

### SNMPError

Operations on non-existent OIDs or with wrong community strings raise `SNMPError`. Use `pytest.raises(SNMPError)` when the test expects failure.

### No retry_on_exception

SNMP GET/SET/WALK are synchronous. Don't retry unless the test specifically polls for a value to transition (e.g., waiting for software update status).
