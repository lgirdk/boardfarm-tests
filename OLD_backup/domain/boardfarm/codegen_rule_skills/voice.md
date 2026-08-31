---
name: voice
description: SIP/RTP telephony call testing — voice_resources fixture, SIP call sequences, RTP verification, call hold/waiting/forwarding.
is_active: true
---

## Voice / SIP / Telephony

### The voice_resources Fixture (Not in Stubs)

Voice tests use `voice_resources` — a conftest fixture, not found by search.
It yields a tuple:

```python
phones_list, sip_proxy, pcap_fname, state = voice_resources
```

- `phones_list` — list of SIPPhone objects. Access `.ip_addr`, `.number`.
- `sip_proxy` — SIPServer. Used for tcpdump and SIP trace parsing.
- `pcap_fname` — pre-generated filename for packet capture.
- `state` — object with `.passed` attribute. **Must set `state.passed = True` at test end** — the fixture uses it for pcap artifact handling.

Two-phone tests: `phone_a, phone_b = phones_list[0], phones_list[1]`
Three-phone tests (hold, forwarding, waiting): add `phones_list[2]`.

Do NOT create a `setup_teardown` fixture for pure voice tests — `voice_resources` handles phone lifecycle and pcap cleanup. Only add a wrapping fixture if the test also changes device configuration (e.g., TR-069 SPV to disable call waiting).

### Tcpdump + Parse Flow

All voice operations happen INSIDE `tcpdump(sip_proxy, pcap_fname)`.
SIP trace parsing happens AFTER the context exits (pcap file is complete):

```python
with tcpdump(sip_proxy, pcap_fname):
    # ... all call operations here ...
matched_seq = parse_sip_trace(sip_proxy, pcap_fname, expected_call_seq)
assert is_sip_sequence_matching(matched_seq)
```

### sleep() Timing

- `sleep(5)` after call is connected — allows RTP packets to be captured.
- `sleep(5)` after disconnect — allows RTCP close packets.
- `sleep(45)` for ring timeout tests — wait for no-answer timeout.

Without these, RTP verification will fail because there aren't enough packets.

### Expected Call Sequence

A list of tuples: `(source_ip, dest_ip, sip_contact_number, sip_message)`.
Each call goes through the proxy, so every message appears twice (caller→proxy, proxy→callee).

- `"RTP_CHECK"` entries use `None` for contact number. They're markers for RTP verification, not actual SIP messages.
- `is_rtp_trace_found` / `is_rtp_trace_not_found` take `start_index` and `end_index` that must match the positions of `RTP_CHECK` entries in the sequence.

### Call Hold: Media Attributes

Hold uses SIP re-INVITE with media direction attributes appended after a colon:
- `"INVITE:sendonly"` — caller puts callee on hold
- `"200 OK:recvonly"` — callee acknowledges hold
- `"INVITE:sendrecv"` / `"200 OK:sendrecv"` — call resumed

### Combining Voice With Configuration Changes

If the test modifies parameters (e.g., disable call waiting via TR-069), wrap `voice_resources` in a `setup_teardown` fixture that captures original values and reverts in teardown. The voice fixture still manages phone lifecycle.

### Gotchas

- **state.passed is mandatory** — forgetting it means pcap is always marked as failed.
- **Phone unpacking order** must match the scenario/CSV order.
- **Call operations go inside tcpdump context; parsing goes outside.**
- **FXS-specific operations** (`press_R_button`, `put_phone_offhook`) only work on FXS endpoints, not softphones.
- **Authentication flows** include a `"407 Proxy Authentication Required"` challenge, followed by a re-INVITE with `":sendrecv"` appended.
