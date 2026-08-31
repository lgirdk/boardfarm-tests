---
name: wifi
description: WiFi configuration and WLAN client testing — connect/disconnect flow, SSID/BSSID handling, guest network, beacon capture.
is_active: true
---

## WiFi / WLAN / Wireless

### WLAN Client Acquisition

For multiple WLAN clients, `get_devices_by_type(WLAN)` returns a dict of named devices — access by index on `.values()`.

### WiFi Connection Flow

The typical chain: get SSID → get BSSID → get passphrase → connect → verify.
`get_ssid` / `get_bssid` take `(network_type, band, board)` — e.g., `"private"`, `"5"`.
`get_passphrase` takes `(network_type, board)`.

`connect_wifi_client(wlan, board, ssid, passphrase, bssid)` connects.
`is_wifi_connected(wlan)` verifies. `disconnect_wifi_client(who_to_disconnect=wlan)` for cleanup.

### WiFi Config Parameters

Common TR-069 paths:
- `Device.WiFi.Radio.10100.*` — 5GHz radio
- `Device.WiFi.Radio.10000.*` — 2.4GHz radio
- `Device.WiFi.SSID.10101.*` / `Device.WiFi.SSID.10001.*` — SSIDs

DMCLI access: `board.sw.dmcli.GPV(param)` returns object with `.rval`.

### SSID Broadcasting

`wifi_check_ssid(wlan, ssid_name)` checks if the SSID is visible from the client side.

### Beacon Frame Capture

Uses `tcpdump_on_device` on the WLAN client with `enable_and_disable_monitor_mode` context manager, then `parse_pcap_via_tshark` with display filters for beacon fields.

### Guest Network

If the test uses GUI page objects for guest network, the page object methods handle radio enable/disable and apply changes. Verify state changes via TR-069 GPV.
