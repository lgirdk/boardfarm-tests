---
name: ssam
description: SSAM digital security — enable/disable via TR-069, blocking verification, iptables checks, agent status monitoring.
is_active: true
---

## SSAM / Digital Security

### Enable/Disable

`enable_via_tr_069(ssam, board, acs)` — optionally with `max_start_delay` parameter.
`disable_via_tr_069(board, acs)` in teardown.

**Sleep 30 seconds after enable** before checking status — SSAM needs activation time.

### Status Verification

The status parameter path is `Device.X_LGI-COM_DigitalSecurity.Status`.
Values: `"connected"` when active, `"failed_jwt"` when credentials are wrong.

`check_ssam_params_via_tr_069(ssam, board, acs)` verifies the full parameter set.

### Blocking Verification

`is_blocked_by_ssam(blocked_client)` — the blocked client is typically a LAN device. Optional `url` and `timeout` parameters for specific domains.

### Timing Delays

- 30s after `enable_via_tr_069` before status check
- 30s after SPV to SSAM parameters
- 120s after reboot before checking iptables rules
- 10s after disabling before checking disconnected status

### IPTables Check

`get_iptables_list(board)` returns a dict — check that no keys contain `"sam_"` after SSAM is disabled.

### SSam Device

The `SSam` template (from `boardfarm3_lgi_shared.templates.ssam`) is required for `enable_via_tr_069` and `check_ssam_params_via_tr_069` — it's a separate device, not the board.
