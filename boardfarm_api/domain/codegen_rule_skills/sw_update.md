---
name: sw_update
description: Firmware upgrade/downgrade — TR-069 Download RPC or DOCSIS SNMP trigger, boot wait chain, version verification, image revert.
is_active: true
---

## Software Update / Firmware Upgrade

### The Composition Chain

After any firmware upgrade trigger, the board reboots. The mandatory sequence is:
1. **Boot wait** — `wait_for_board_boot_start` with retry (firmware flash takes longer than normal reboot — use higher retries, e.g., 15-20, tout=60)
2. **Online check** — `is_board_online_after_reset` with retry
3. **IP verification** — `verify_erouter_ip_address`

Skip any of these and the test will fail on the next step that touches the board.

### Two Trigger Paths

**TR-069 Download RPC:** Uses `download()` from TR-069 use cases. Takes `url`, `filetype="1 Firmware Upgrade Image"`, `commandkey`, and several empty/zero fields. The URL format is typically `http://wan.boardfarm.com:80/{filename}`.

**DOCSIS SNMP:** Uses `trigger_docsis_snmp_sw_update()` with server address, filename, protocol, admin status, and address type. Then `wait_for_update_to_complete()` polls the operation status.

### Build Preparation

`ensure_current_build_is_on_server(board, wan)` returns the current firmware filename.
`ensure_update_build_is_on_server(board, wan)` returns the update firmware filename.
These ensure the images are accessible on the server before triggering.

### Version Verification

After upgrade: `is_running_updated_version(board)` (TR-069 path) or `is_running_updated_version_via_docsis_snmp(board, wan, cmts)` (SNMP path — may need retry as version reporting lags).

### Teardown

Set `bf_context.revert_image = True` BEFORE triggering the upgrade. In teardown, re-trigger with the original firmware filename, then run the full boot→online→IP chain again with `TeardownError` on failure.
