# Boardfarm Framework — Deep Understanding

This document explains the Boardfarm test automation framework in full detail. You have NO code access — everything you need is here.

---

## What Boardfarm Is

Boardfarm is a **pytest-based hardware test automation framework** for CPE (Customer Premises Equipment) — cable modems, routers, set-top boxes. Think: real physical devices in a lab, connected to real networks, tested by real pytest scripts.

It's used by Liberty Global (LGI) teams across Europe for testing devices like:
- **CH7465LG** (Compal cable modem, Ziggo/UPC)
- **F3896LG** (Sagemcom cable gateway, Sunrise/UPC)
- **TG2492LG** (Arris cable modem)

---

## Core Concepts

### Board / DUT (Device Under Test)
A physical device in the lab. Has a MAC address, serial connection, power port (for remote power cycling), and SSH access.

### Bed / Resource
A complete test setup = one board + ALL supporting devices needed to test it:
- **board**: The DUT (e.g., CH7465LG modem)
- **wan**: Emulated WAN (Linux box simulating the ISP side)
- **lan**: Emulated LAN client (Linux box on the LAN side)
- **lan2**: Second LAN client
- **tftp**: TFTP server for firmware images
- **sipcenter**: SIP server (Kamailio) for voice testing
- **softphone1/2**: PJSIP softphones for making/receiving calls
- **fxs1/2**: FXS (Foreign Exchange Subscriber) phone line emulators
- **cmts**: Cable Modem Termination System (headend)
- **acs**: Auto Configuration Server (TR-069 management)
- **odh**: Operational Data Hub (telemetry)
- **aftr**: Address Family Transition Router (DS-Lite)

A bed is identified by a resource name like `CH7465LG-3-1` (model-rack-slot). Each bed has labels like `["Voice", "WiFiNo", "BrdCbnCH7465LG"]` for filtering.

### Inventory (ams.json)
A large JSON file listing ALL available beds in the lab. Here's one real bed entry (abbreviated):

```json
{
  "CH7465LG-3-1": {
    "devices": [
      {
        "name": "board",
        "type": "CH7465LG",
        "manufacturer": "COMPAL",
        "model": "CH7465LG",
        "cm_mac": "68:02:b8:02:c8:17",
        "hardware_version": "5.02",
        "feature": ["voice"],
        "conn_cmd": ["ssh 10.64.38.34 -p 3001", "ssh 10.64.38.34 -p 3002"],
        "connection_type": "ldap_authenticated_serial",
        "powerport": "px2://10.64.36.36; 24",
        "sku": "UPC",
        "mirror": "http://10.64.36.100/"
      },
      {
        "name": "wan",
        "type": "debian_wan",
        "ipaddr": "10.64.38.19",
        "port": 4101,
        "connection_type": "authenticated_ssh",
        "http_proxy": "10.64.38.19:10101",
        "options": "tftpd-server, dns-server, mgmt_dns: 10.64.36.53, wan-static-ip:172.25.1.101/24, wan-no-dhcp-server, wan-static-ipv6:2001:dead:beef:2::101/64, static-route:0.0.0.0/0-172.25.1.1"
      },
      {
        "name": "lan",
        "type": "debian_lan",
        "ipaddr": "10.64.37.161",
        "port": 5001,
        "connection_type": "authenticated_ssh",
        "options": "mgmt_dns: 8.8.8.8"
      },
      {
        "name": "sipcenter",
        "type": "kamailio",
        "ipaddr": "10.64.38.19",
        "port": 4301,
        "numbers": ["1000", "2000", "3000", "4000"]
      },
      {
        "name": "softphone1",
        "type": "pjsip",
        "number": "3000",
        "port": 4201
      },
      {
        "name": "fxs1",
        "type": "debian_fxs",
        "number": "1000",
        "fxs_port": "1",
        "usb_port": "1-4"
      }
    ],
    "labels": ["BrdCbnCH7465LG", "LocEcxRack3", "Tm1fw", "BrdCons", "WiFiNo", "Voice"],
    "location": "ams-cmts7-md1"
  }
}
```

The inventory has dozens of beds across multiple board models. Beds are **read-only** — the user doesn't edit them. APIs exist to check if a bed is locked (reserved by another user's test run) or available.

### Environment JSON
Tells boardfarm HOW to configure the bed for a specific test run. Key fields:

```json
{
  "environment_def": {
    "CMTS": {
      "model": "CC8800",
      "type": "topvision"
    },
    "board": {
      "model": "F3896LG",
      "SKU": "Sunrise",
      "country": "CH",
      "eRouter_Provisioning_mode": "disabled",
      "GUI_Language": "en",
      "boot_file": "Main { ... DOCSIS TLV configuration ... }",
      "software": {
        "factory_reset": true,
        "flash_strategy": "meta_build",
        "image_uri": "/F3896LG/ofw/dailies/2025-03/10/ofw-f3896lg-r22-20250310.bin"
      },
      "emta": {
        "boot_file_mta": "Main { ... MTA/voice configuration ... }"
      },
      "lan_clients": [{}, {}],
      "wifi_clients": [
        { "band": "5", "authentication": "WPA-PSK", "connect_wifi": true }
      ],
      "install_applications": [
        "http://10.64.38.100/F3896LG/tftp",
        "http://10.64.38.100/F3896LG/tcpdump"
      ]
    },
    "provisioner": {},
    "tr-069": {},
    "voice": {
      "EXT_VOIP": [
        { "profile": "pjsip", "type": "debian" },
        { "profile": "pjsip", "type": "debian" }
      ]
    },
    "securingsam": {
      "host": "https://internal-isp-gateway.digitalsecurity-sit.appdev.io"
    }
  },
  "version": "2.45"
}
```

**Key fields explained:**
- `eRouter_Provisioning_mode`: `"disabled"`, `"ipv4"`, `"ipv6"`, `"dual"`, `"dslite"` — how the modem's router is provisioned
- `SKU`: Operator/region — `"Ziggo"`, `"Sunrise"`, `"UPC"`, `"VMIE"` — affects device behavior
- `boot_file`: DOCSIS configuration (TLV-encoded MIB values) — the modem's config file
- `software.image_uri`: Firmware image to flash onto the board
- `software.factory_reset`: Whether to factory-reset before testing
- `lan_clients`: How many LAN clients to allocate from the bed's available devices
- `wifi_clients`: WiFi client requirements (band, authentication, protocol)
- `voice.EXT_VOIP`: Voice/SIP configuration for telephony tests
- `boot_file` and `boot_file_mta` are HUGE strings (4000-8000+ chars) containing DOCSIS MIB configs

Environments are **user-configurable** — users can:
1. Select from existing env JSON files
2. Create new ones (via a form or raw JSON editor)
3. Potentially auto-generate from test requirements

---

## How a Test Run Works

```
User provides:
  - Board TYPE (e.g., "CH7465LG") — NOT a specific bed
  - Environment JSON (selected or created)
  - Test(s) to run

Boardfarm execution sequence:
  1. RESERVE: Find an available bed of the requested type from the pool, lock it
  2. PARSE CONFIG: Merge inventory (bed's device details) + environment JSON
  3. SETUP ENVIRONMENT:
     a. Flash firmware (image_uri) → 5-10 minutes
     b. Factory reset if configured → 2-3 minutes
     c. Provision the board (DOCSIS provisioning, eRouter mode) → 2-5 minutes
     d. Configure supporting devices (WAN, LAN, voice)
     e. Wait for board to come online, verify IP addresses
  4. RUN TESTS: Execute pytest against the configured board
     - Tests access devices via DeviceManager fixture
     - Each test logs steps via bf_logger.log_step()
     - Setup/teardown fixtures handle per-test state
  5. COLLECT RESULTS: Logs, pcap files, artifacts
  6. RELEASE: Unlock the bed back to the pool

Total time: 10-30 minutes depending on setup + test complexity
```

Boardfarm produces logs internally — the UI just displays them. The setup phase is significant and visible to the user (they watch firmware flash progress, provisioning status, etc.).

---

## Test Structure

### Test Requirements (env_req marker)

Every test declares what environment it needs:

```python
@pytest.mark.env_req({
    "environment_def": {
        "board": {
            "eRouter_Provisioning_mode": ["ipv4"],
            "lan_clients": [{}],
        }
    }
})
def test_MVX_TST_1985(setup_teardown, bf_logger, bf_context):
    """LLC filter applies for IPv4, ARP on Cable interface."""
    ...
```

This means: "I need a board in ipv4 mode with at least 1 LAN client." The selected environment JSON must satisfy this. Lists mean OR logic — `["dual", "ipv4"]` means either mode works.

More complex requirements:
```python
@pytest.mark.env_req({
    "environment_def": {
        "board": {
            "eRouter_Provisioning_mode": ["dual", "ipv4", "ipv6"],
            "lan_clients": [{}, {}],
            "wifi_clients": [{"band": "5"}],
        },
        "tr-069": {},
        "voice": {"EXT_VOIP": [{"profile": "pjsip"}]},
    }
})
```
This needs: dual/ipv4/ipv6 mode, 2 LAN clients, a 5GHz WiFi client, TR-069 support, and voice with PJSIP.

### Complete Test Example (SNMP LLC Filter Test)

```python
"""https://jira.lgi.io/browse/MVX_TST-1985."""
from collections.abc import Iterator
import pytest
from boardfarm3.lib.device_manager import DeviceManager
from boardfarm3.templates.wan import WAN
from boardfarm3_docsis.templates.cmts import CMTS
from boardfarm3_lgi_shared.templates.cpe import CPE
from boardfarm3_lgi_shared.use_cases.erouter import get_erouter_addresses, get_mta_iface_ip_addresses
from boardfarm3_lgi_shared.use_cases.networking import ping
from boardfarm3_lgi_shared.use_cases.snmp import get_mib_oid, snmp_get, snmp_set, snmp_walk
from pytest_boardfarm3.lib import ContextStorage, TestLogger

@pytest.fixture()
def setup_teardown(bf_context, device_manager, bf_logger):
    """Get devices and teardown SNMP changes."""
    bf_context.change_interface = False
    board = device_manager.get_device_by_type(CPE)
    cmts = device_manager.get_device_by_type(CMTS)
    wan = device_manager.get_device_by_type(WAN)

    yield board, wan, cmts, "docsDevFilterLLCUnmatchedAction", "docsDevFilterLLCEntry"

    if bf_context.change_interface:
        bf_logger.log_step("Teardown: Set the change back to default index")
        for i in range(1, 3):
            snmp_set("docsDevFilterLLCIfIndex", value="0", stype="i",
                     wan=wan, board=board, cmts=cmts, index=i)

@pytest.mark.env_req({"environment_def": {"board": {"eRouter_Provisioning_mode": ["ipv4"], "lan_clients": [{}]}}})
def test_MVX_TST_1985(setup_teardown, bf_logger, bf_context):
    board, wan, cmts, llc_unmatch, llc_entry = setup_teardown

    bf_logger.log_step("Step1: Verify LLC filter values on DUT booted with max-config.")
    # ... SNMP walk and verify ...

    bf_logger.log_step("Step2: Verify reachability of eMTA & eRouter IPv4 from wan side.")
    erouter_v4 = str(get_erouter_addresses(retry_count=2, board=board).ipv4)
    mta_ip = get_mta_iface_ip_addresses(board=board, retry_count=2).ipv4
    # ... ping tests ...

    bf_logger.log_step("Step3: SNMP Set value to 2 for Cable interfaces")
    for i in range(1, 3):
        snmp_set("docsDevFilterLLCIfIndex", index=i, value="2", stype="i", wan=wan, board=board, cmts=cmts)
    bf_context.change_interface = True  # flag for teardown

    bf_logger.log_step("Step4: Verify LLC filter values via SNMP.")
    # ... SNMP get and assert ...

    bf_logger.log_step("Step5: Verify IPv4 reachability after applying LLC filter rule.")
    # ... ping tests expecting failure ...
```

### Key Conftest Fixtures

**GUI tests** use `browser_data` fixture (not in stubs — defined in conftest.py):
```python
@pytest.fixture()
def browser_data(device_manager, boardfarm_config, request):
    lan = device_manager.get_device_by_type(LAN)
    board = device_manager.get_device_by_type(CPE)
    driver = GuiHelper(lan).get_web_driver()
    gateway_ipv4 = board.lan_private_gateway if mode == "disabled" else board.lan_gateway
    yield driver, gateway_ipv4, board.gui_password
    driver.quit()
```

**Voice tests** use `voice_resources` fixture (not in stubs — defined in conftest.py):
```python
@pytest.fixture()
def voice_resources(scenario):
    # Initialize SIP phones, get SIP proxy, create pcap filename
    yield initialized_clients, sip_proxy, pcap_fname, state
    # Teardown: shutdown phones, copy pcap to artifacts
```

### Test Categories (2000+ tests)

| Category | Count | Examples |
|----------|-------|---------|
| TR-069 | 1290 | GPV/SPV parameter management via ACS |
| GUI | 483 | Selenium page objects, browser automation |
| Packet capture | 485 | tcpdump, pcap analysis |
| DHCP | 371 | DHCPv4/v6 lease operations |
| Factory reset | 163 | Reset + verify online |
| WiFi | 119 | SSID/channel config, WLAN clients |
| Firmware update | 112 | SNMP or TR-069 triggered flash |
| SNMP | 107 | snmp_walk/get/set, MIB operations |
| Voice | 86 | SIP calls, RTP verification |
| DNS | 90 | DNS resolution |
| Telemetry | 53 | ODH/DCM configuration |
| Stability | 10 | 24-hour uptime monitoring |

Tests are organized in folders: `tr069/`, `gui/`, `voice/`, `wifi/`, `sw_update/`, `telemetry/`, `stability/`, `ssam/`, `reverse_ssh/`, `samknows/`, `ripv2/`, and root-level (DOCSIS, SNMP, networking).

---

## The Code Generation Pipeline

We built an AI-powered code generator that produces boardfarm pytest tests. Located at `src/codegen/`.

### Pipeline Flow
```
Specification (Jira ticket or manual steps)
  → Reasoning (LLM analyzes test intent)
  → Skill Selection (LLM picks domain-specific rules: voice, tr069, snmp, etc.)
  → Query Generation (LLM creates search terms)
  → Hybrid Search (BM25 + FAISS over ~4000 API stubs)
  → Keep/Remove Selection (LLM filters relevant APIs)
  → Context Assembly (format selected APIs by category)
  → Code Generation (LLM writes pytest code)
```

### Key Design Decisions
- **Stubs over raw code**: The search indexes structured API documentation (name, signature, import path, docstring), not implementation code
- **Hybrid search**: BM25Plus + FAISS with bge-base-en-v1.5 embeddings
- **Dynamic rules (skills)**: Domain-specific rules (voice.md, tr069.md, snmp.md, etc.) selected per test by the LLM, injected into the codegen prompt alongside static framework rules
- **Pre-search hooks**: Force-include APIs that search might miss (e.g., voice skill → always include `call_a_phone`, `parse_sip_trace`)
- **Stateless LLM calls**: No chat history between pipeline stages

### Input Model
```python
class CodegenTestInput:
    name: str                    # e.g., "test_MVX_TST_1985"
    description: str | None      # test description
    preconditions: str | None    # environment requirements
    steps: list[TestStep]        # ordered test steps
        # step_num, instruction, additional_info, expected_result
```

### Output
Generated Python code — a complete pytest test file with imports, fixtures, env_req marker, and test function.

---

## Team Dynamics

- Multiple engineers share the same lab infrastructure
- Boards/beds are **shared physical resources** — only one test can run on a bed at a time
- When one user locks a bed, others must wait or use a different bed
- Tests in the git repository are visible to the entire team
- AI-generated test drafts are **private to the user** until published
- Publishing means: create a PR → merge to git → becomes an official team test
