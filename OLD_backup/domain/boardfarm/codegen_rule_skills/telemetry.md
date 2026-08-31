---
name: telemetry
description: Telemetry event configuration — CDN/ODH devices, DCM config markers, enable/disable flow, log retrieval, timing delays.
is_active: true
---

## Telemetry / DCM / ODH

### Specialized Devices

Telemetry tests need `CDN` and `ODH` devices (from `boardfarm3_lgi_shared.devices`), in addition to standard CPE and ACS.

### Enable/Disable Flow

1. Get DCM URL: `get_dcm_config_file_url(board, cdn, mode)`
2. Enable: `enable_telemetry_via_tr069(dcm_url, board, acs)` — returns execution timestamp
3. **Sleep 120 seconds** — ACS needs time to update download status
4. Verify download status: `get_dcm_config_file_download_status_via_tr069(board, acs)`
5. Disable in teardown: `disable_telemetry_via_tr069(board, acs)`

### DCM Event Marker (Context Manager)

`add_event_marker_to_dcm_config(cdn, event_marker)` is a context manager. The `event_marker` dict has keys: `content`, `header`, `pollingFrequency`, `type` (log file path).

Extract polling frequency from the yielded config:
`int(re.findall(r"\d+", schedule_data)[0]) * 60`

### Log Retrieval from ODH

`get_telemetry_logs(odh, time_to_poll, mac_address)` — the MAC comes from `get_interface_mac_addr(board, board.erouter_iface)`. Logs may take multiple attempts to appear.

### Timing

- 120s after enable before checking download status
- Upload status takes ~17 minutes (1020s) in normal scenarios
- Download status delay is ~2s
- Log injection content format: `"00/00/00 00:00:00 <error>   {message}"` (3 spaces before message)
