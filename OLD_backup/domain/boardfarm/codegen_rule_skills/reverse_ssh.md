---
name: reverse_ssh
description: Reverse SSH tunnel testing — context manager enable/disable, jumpserver connectivity, interface verification via pcap.
is_active: true
---

## Reverse SSH Tunnel

### Context Manager Pattern

`reverse_ssh_enabled_via_tr069(board, acs, jumpserver)` is a context manager that yields the SSH `port`. The tunnel is active inside the context and automatically disabled on exit.

Verify inside: `get_reverse_ssh_status(board, acs)` should return `"ACTIVE"`.
Test connectivity: `is_rssh_to_cpe_from_jumpserver_successful(jumpserver, board, port)`.

After context exit, SSH should fail — verify with the same call expecting `False`.

### Jumpserver Is the WAN Device

The jumpserver is typically `device_manager.get_device_by_type(WAN)`.

### Nested with TCPDUMP

TCPDUMP context can wrap the reverse SSH context. Add `time.sleep(15)` before exiting the TCPDUMP context to ensure packets are captured. Parse with `jumpserver.tshark_read_pcap(pcap_file, additional_args="-Y 'ssh && ...'")`.

### Interface Verification

To verify which interface carried the SSH traffic, compare IPs in the pcap against:
- CM interface: `get_wan_iface_ip_addresses(board, 1)`
- eRouter: `get_erouter_addresses(1, board)`
- MTA: `get_mta_iface_ip_addresses(board, 1)`

### No Fixture for Simple Tests

The context manager handles enable/disable — most reverse SSH tests don't need a `setup_teardown` fixture. Only add one if the test also does pcap capture that needs artifact copy in teardown.
