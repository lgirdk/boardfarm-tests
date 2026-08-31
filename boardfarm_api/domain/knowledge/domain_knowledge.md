# Boardfarm Test Framework — Domain Knowledge

## 1. The Framework Shape

Boardfarm is a layered test automation framework for CPE (Customer Premises Equipment) / cable modem devices operating in DOCSIS broadband networks. The layers are:

- **Templates** (`boardfarm3.templates.*`, `boardfarm3_docsis.templates.*`) — abstract Python ABC classes that define what a device *can do*. Each template declares methods (e.g., `ping`, `is_online`, `flash_via_snmp`) without implementation. Templates are the contract a device type exposes to the rest of the system.

- **Use Cases** (`boardfarm3.use_cases.*`, `boardfarm3_docsis.use_cases.*`, `boardfarm3_lgi_shared.use_cases.*`) — functions that carry out the intent of a test step. A use case operates on one or more template instances to perform a high-level action (e.g., "start HTTP server on WAN", "verify board is online after reset", "flash firmware via SNMP"). Use cases are the primary API tests call.

- **Devices** (`boardfarm3.devices.*`, vendor-specific repos like `boardfarm3_cbn`, `boardfarm3_intel`, etc.) — concrete implementations of templates for real hardware. Tests never reference device classes directly; they interact through templates and use cases.

- **Libraries / Utilities** (`boardfarm3.lib.*`) — supporting classes and helpers: device management (`DeviceManager`), configuration (`BoardfarmConfig`), networking utilities (`HTTPResult`, `IptablesFirewall`, `NSLookup`), SNMP driver (`SNMPv2`), MIB compilation (`MibsCompiler`), dmcli access (`DMCLIAPI`), WiFi HAL (`WiFiHal`), DOCSIS config encoding (`DocsisConfigEncoder` — converts text config to binary .cfg files), retry logic (`retry_on_exception`), connection factory (SSH/Telnet/Serial/Ser2net), exception hierarchy (`BoardfarmException` → `TeardownError`, `UseCaseFailure`, `TR069FaultCode`, `VoiceError`, `SNMPError`, etc.), and data classes for packets and addresses.

- **Test Framework** (`pytest-boardfarm` / `pytest_boardfarm3`) — pytest fixtures that inject devices, loggers, configuration, and context into tests. Key fixtures: `device_manager` (provides `DeviceManager`), `bf_logger` (provides `TestLogger`), `bf_context` (provides `ContextStorage` for inter-step state), `boardfarm_config` (provides `BoardfarmConfig`).

**How they connect:** A test function receives fixtures (device manager, logger, context). It retrieves devices via `device_manager.get_device_by_type(TemplateClass)`. It calls use case functions, passing those template instances as arguments. Use cases internally call template methods. Templates are realized at runtime by concrete device classes matched to the physical lab.

---

## 2. The Devices / Components

### 2.1 The CPE (Device Under Test)

The **CPE** (Customer Premises Equipment) is the device being tested — typically a cable modem / residential gateway. In the framework it is represented by `CPE` (base) and `CableModem` (DOCSIS-specific subclass). The CPE is a composite with two sub-templates:

- **CPEHW / CableModemHW** — the hardware layer. Holds the MAC address (`mac_address`), WAN interface name (`wan_iface`), MTA interface name (`mta_iface`). Provides `power_cycle()` (via PDU), `flash_via_bootloader()`, and console connections.

- **CPESW / CableModemSW** — the software layer. Holds the current software `version`, `erouter_iface` name, `lan_iface` name, `dmcli` (TR-181 data model CLI), `wifi` (WiFi HAL), `mibs` (SNMP MIB definitions). Provides `reset()`, `factory_reset()`, `wait_for_boot()`, `is_online()`, `get_provision_mode()`, `flash_via_snmp()`, `provision_cable_modem()`, `is_tr069_connected()`, boot file access (`get_boot_file()`, `get_mta_boot_file()`), and console/log reading.

Within the CPE, there are logically distinct functional components:

| Component | What It Is |
|-----------|------------|
| **eCM** (embedded Cable Modem) | The DOCSIS modem function. Registers with the CMTS, obtains a DOCSIS channel, handles the RF/MAC layer. Identified by its MAC address. |
| **eRouter** | The router function within the CPE. Provides IP connectivity (IPv4/IPv6) to the LAN side. Has its own interface (`erouter0` typically), its own IP addresses, and operates in a provisioning mode (IPv4-only, IPv6-only, dual-stack, or bridge). |
| **eMTA** (embedded Multimedia Terminal Adapter) | The voice/telephony function. Handles SIP registration and phone calls via the FXS ports. Has its own interface (`mta0`), its own IP address, and its own boot file. |

These three components (eCM, eRouter, eMTA) coexist within a single physical CPE device. Each has distinct IP addresses, interface names, and boot/config files. Tests may target any combination.

### 2.2 Head-End and Infrastructure

| Device | Template | Role |
|--------|----------|------|
| **CMTS** (Cable Modem Termination System) | `CMTS` (extends `LTS`) | The head-end equipment the cable modem registers with. Provides `is_cable_modem_online()`, `clear_cm_reset()`, channel value queries (`get_downstream_channel_value`, `get_upstream_channel_value`), eRouter/MTA IP lookups from its perspective. |
| **LTS** (Line Termination System) | `LTS` | Abstract base for head-end equipment. CMTS is the DOCSIS variant; OLT is the GPON variant. |
| **OLT** (Optical Line Terminal) | `OLT` (in boardfarm-lgi-shared) | The GPON/fiber head-end equivalent of CMTS. Used in FTTH (Fiber to the Home) deployments. |
| **Provisioner** | `Provisioner` (base), DOCSIS `Provisioner` | The DHCP/provisioning server. Manages DHCP host reservations for CPE MAC addresses. Provides `provision_cpe()` and `provision_cable_modem()` (with boot file paths, TFTP addresses). |
| **ACS** (Auto Configuration Server) | `ACS` | The TR-069 management server. Executes TR-069 RPCs: `GPV` (GetParameterValues), `SPV` (SetParameterValues), `GPN` (GetParameterNames), `GPA`/`SPA` (Get/SetParameterAttributes), `Download`, `Reboot`, `FactoryReset`, `ScheduleInform`, `AddObject`, `DelObject`. Central to remote management tests. |
| **TFTP** | `TFTP` | TFTP/HTTP file server for firmware images and config files. Provides `download_image_from_uri()`, `get_eth_interface_ipv4_address()`, `restart_lighttpd()`. |

### 2.3 Client Devices (Test Endpoints)

| Device | Template | Role |
|--------|----------|------|
| **LAN** (LAN Client) | `LAN` | A wired client connected to the CPE's LAN-side Ethernet ports. Sits behind the eRouter. Used to test downstream connectivity, DHCP, DNS, HTTP access, traffic generation (iPerf), packet capture, port scanning (nmap), UPnP, etc. |
| **WAN** (WAN Client) | `WAN` | A client/server on the WAN/Internet side of the network. Sits upstream of the CMTS. Used to test upstream connectivity, host HTTP/TFTP servers, run SNMP commands against the CPE, generate traffic, perform reverse SSH, etc. Also serves as TFTP server in many setups. |
| **WLAN** (Wireless Client) | `WLAN` | A WiFi client that connects to the CPE's wireless network. Has WiFi-specific capabilities: `wifi_client_connect()`, `list_wifi_ssids()`, `enable_monitor_mode()`, band/network/authentication/protocol properties. Shares many capabilities with LAN (ping, traffic, packet capture). |
| **SIPPhone** | `SIPPhone` | A SIP phone endpoint (typically an FXS adapter). Provides voice call operations: `off_hook()`, `on_hook()`, `dial()`, `answer()`, plus state queries: `is_idle()`, `is_ringing()`, `is_connected()`, `is_onhold()`, `is_in_conference()`, `is_call_waiting()`, `is_line_busy()`. Supports multi-line operation via `active_line`. |
| **SIPServer** | `SIPServer` | The SIP registrar/proxy server. Manages user registration (`add_user`, `remove_endpoint`, `allocate_number`), server lifecycle (`start`, `stop`, `restart`), and call forwarding VSC (Vertical Service Code) prefixes. |

### 2.4 Supporting Infrastructure

| Device | Template | Role |
|--------|----------|------|
| **PDU** (Power Distribution Unit) | `PDU` | Controls power to the CPE. Provides `power_on()`, `power_off()`, `power_cycle()`. Used for hard reboot scenarios. |
| **AFTR** (Address Family Transition Router) | `AFTR` | DS-Lite tunnel endpoint for IPv4-over-IPv6 translation. Configured to work with WAN for IPv4 connectivity in IPv6-only deployments. |
| **FXS** | `FXS` (in boardfarm-lgi-shared) | Foreign Exchange Subscriber — the physical phone line interface adapter. |

### 2.5 Network Topology

```
                    [Internet/WAN side]
                          |
                     [ WAN Client ]
                          |
                     [   CMTS   ]  ←→  [ Provisioner ] [ ACS ] [ TFTP ]
                          |
                    [ Cable/DOCSIS ]
                          |
    +-----------[ CPE / Cable Modem ]----------+
    |  eCM (DOCSIS modem)                      |
    |  eRouter (IPv4/IPv6 router)              |
    |  eMTA (voice/telephony)                  |
    +---+------------------+-------------------+
        |                  |           |
   [ LAN Client ]   [ WLAN Client ]  [ SIPPhone ]
                                       |
                                  [ SIPServer ]
```

---

## 3. Vocabulary and Domain Phrases

### 3.1 Phrases That Expand to Sequences

| Phrase | What It Actually Means |
|--------|----------------------|
| **"Board comes online"** / **"DUT comes back online"** | A multi-step sequence: (1) wait for the board boot process to start (`wait_for_board_boot_start`), (2) verify the board is online on the CMTS (`is_board_online_after_reset` — must be retried, hardware is unreliable), (3) verify eRouter IP addresses are acquired (`verify_erouter_ip_address`). Skipping any step produces flaky tests. |
| **"Perform a reboot"** / **"Power cycle"** | Power off → power on → wait for boot → verify online → verify IP. The use case `power_cycle_board` encapsulates power cycle + boot wait. |
| **"Firmware upgrade"** / **"Firmware downgrade"** | Obtain the target image filename (`get_update_filename` for upgrade, also for downgrade — the name refers to "the version you're updating TO"), initiate the flash (via SNMP, TR-069, or bootloader), wait for reboot, verify new version is running (`is_running_updated_version`). Always requires capturing the original filename for teardown. |
| **"Provisioning"** / **"CM provisioning"** | The process by which the cable modem (eCM) registers with the CMTS and obtains its configuration. Involves DHCP exchange, boot file download (via TFTP), and config file application. The `provision_cable_modem` use case handles this. |
| **"Switch provisioning mode"** | Change the eRouter's operating mode (e.g., from IPv4-only to dual-stack). This is done via config file swap (`switch_prov_mode_via_config`) or dmcli/TR-069. Requires reprovisioning, reboot, and IP verification. Persistent state change. |
| **"HTTP server is accessible"** | Start an HTTP service on a device → from another device, perform an HTTP GET (curl) to the first device's IP → verify the response. The use cases `start_http_server` (context manager) and `http_get` handle this. |
| **"Verify connectivity"** | Typically: ping from LAN/WAN to the other side via the eRouter IP. May also mean: HTTP GET, DNS lookup, or traceroute. |
| **"Make a call"** / **"Call from A to B"** | A multi-step voice sequence: caller goes off-hook → dial tone detected → caller dials callee's number → callee rings → callee answers → both connected. Each step has state verification (e.g., `is_playing_dialtone()`, `is_ringing()`, `is_connected()`). The `call_a_phone` use case encapsulates this. |
| **"Enable call forwarding"** | Dial a VSC code on the phone (e.g., `*21*{target_number}#` for CFU). The `enable_call_forwarding_busy`/`unconditional`/`no_answer` use cases handle this. Requires the SIP server to provide the correct VSC prefix. |

### 3.2 Framework-Specific Terms

| Term | Meaning |
|------|---------|
| **update / current / alternative** (firmware versions) | Three version concepts for software update tests. **current** = the version the DUT is running right now. **update** = the version the test will flash TO (could be newer OR older). **alternative** = a third distinct version. Function names follow this: `get_current_filename()`, `get_update_filename()`, `get_alternative_image_version()`. |
| **bootfile / config file** | The configuration file the cable modem downloads from TFTP during provisioning. Determines operating mode, features, and policies. A CM bootfile configures the eCM; an MTA bootfile configures the eMTA. Different bootfiles → different provisioning modes. |
| **TLV** (Type-Length-Value) | The encoding format within DOCSIS config/boot files. TLVs define individual configuration parameters (e.g., max downstream rate, allowed channels). Referenced in provisioning and config-file operations. |
| **provisioning mode** / **prov_mode** | The eRouter's IP operating mode. Values include: `ipv4` (IPv4 only), `ipv6` (IPv6 only), `dualstack` (dual-stack — both IPv4 and IPv6), `dslite` (DS-Lite — IPv4 tunneled over IPv6 via AFTR), `disabled` (eRouter off, bridge mode). Obtained via `boardfarm_config.get_prov_mode()` or `board.sw.get_provision_mode()`. |
| **bonded channels** / **channel bonding** | Multiple DOCSIS channels combined for higher throughput. The CMTS reports downstream and upstream channel counts per modem (`get_downstream_channel_value`, `get_upstream_channel_value`, `get_cm_channel_values`). |
| **golden frequency** | The initial downstream frequency the cable modem tunes to when booting. Retrieved via `get_golden_ds_freq_list()`. |
| **bf_context** | A `ContextStorage` object passed between setup, test, and teardown. Used to track what the test changed (via boolean flags like `bf_context.revert_image`, `bf_context.reboot_required`, `bf_context.pcap_started`). Teardown reads these flags to decide what to undo. |
| **DUT** | Device Under Test — synonym for CPE / board / cable modem. |
| **board** | Common variable name for the CPE device instance in tests. |

### 3.3 Protocol and Interface Terms

| Term | Meaning |
|------|---------|
| **erouter0** | The eRouter's WAN-facing network interface on the CPE. Carries the eRouter's IPv4/IPv6 addresses. |
| **wan0** | The eCM's (cable modem's) WAN-facing interface. Carries the CM's DOCSIS IP address. |
| **mta0** | The eMTA's network interface. Carries the MTA's IP address for voice services. |
| **iface_dut** | Property on LAN/WAN/WLAN templates — the name of the network interface that faces the DUT (CPE). |
| **MIB / OID** | SNMP Management Information Base / Object Identifier. MIBs define manageable parameters (e.g., firmware filename, admin status). OIDs are numeric paths to specific MIB entries. Used extensively in SNMP-based firmware updates and status queries. |
| **dmcli** | The TR-181 Data Model CLI on the CPE. A local command-line interface for getting/setting TR-181 parameters directly on the device (as opposed to via ACS remotely). |
| **VSC** (Vertical Service Code) | Phone feature codes (e.g., `*63*` to enable call forwarding busy, `#63#` to disable). Used in voice tests via `SIPPhone.dial()` and `SIPServer.get_vsc_prefix()`. |
| **BPI** (Baseline Privacy Interface) | DOCSIS encryption mechanism. `GlobalPrivacyEnable`: 0 = disabled, 1 = enabled. Controls whether traffic between CM and CMTS is encrypted. |
| **CFU / CFB / CFNA** | Call forwarding types: CFU = unconditional (always forward), CFB = forward when busy, CFNA = forward on no answer. Each has enable/disable VSC prefixes. |
| **DTMF codes** | Dual-Tone Multi-Frequency — touch-tone codes for activating voice features. Locale-dependent (e.g., Polish `"PL"` codes differ from Dutch). Accessed via `cpe.sw.voice.dtmf_codes["locale"]`. |
| **TR069FaultCode** | Error response from TR-069 operations. Common fault codes: 9005 = invalid parameter name, 9008 = attempt to set a read-only parameter. Raised as exceptions in use cases. |
| **env_req** | Pytest marker (`@pytest.mark.env_req`) that declares which devices and configurations a test requires (e.g., specific provisioning mode, specific board model, presence of ACS). The framework uses these to match tests to compatible lab environments. |
| **traffic endpoint** | Specialized device types for performance testing: `WanTrafficEndpoint`, `LanTrafficEndpoint`, `WlanTrafficEndpoint`. Used with the Excentis ByteBlower traffic generator for throughput/flow tests. |
| **MV1 / MV2 / MV2P / MV3** | Hardware platform variants of CPE devices. MV1 is an older generation; MV2/MV2P are mid-generation (DOCSIS cable); MV3/MV3ETH are newer (may include fiber/GPON). Different variants have different component names for logging (e.g., MV1 supports "voice", "docsis", "common_components", "gw", "vfe", "vendor_cbn", "pacm"; MV2P supports "voice" and "pacm"). |
| **DS-Lite** | Dual-Stack Lite — an IPv6 transition technology. IPv4 traffic is tunneled over IPv6 via the AFTR device. The CPE has an `aftr_iface` for this. Used in IPv6-only provisioning with IPv4 connectivity. |
| **DFS** (Dynamic Frequency Selection) | WiFi mechanism for 5GHz channels shared with radar. When radar is detected, the CPE must vacate the channel. `trigger_radar_event()` simulates this in tests. |
| **SSM / ASM** | Source-Specific Multicast / Any-Source Multicast — two multicast addressing modes. SSM uses a specific source+group pair; ASM uses only the group address. Tests join/leave these via `join_iperf_multicast_ssm_group()` / `join_iperf_multicast_asm_group()`. |
| **RTP / RTCP** | Real-time Transport Protocol / RTP Control Protocol — the media and control protocols for voice calls. Packet captures during voice tests filter for RTP/RTCP to verify call quality and signaling. |
| **Secondary WAN / Static IPv4** | eRouter can have a secondary WAN IPv4 address. Modes: Multi-Static (multiple static IPs), Single-Static (one static IP), Disabled. Configured via TR-069 or dmcli. |

---

## 4. Management Planes / Mechanisms

### 4.1 SNMP (Simple Network Management Protocol)
- **What it is:** A protocol for querying and modifying device parameters using MIBs/OIDs. Executed from the WAN side via `wan.execute_snmp_command()`.
- **When used:** Firmware updates via SNMP (`flash_via_snmp`), reading DOCSIS event logs (`get_docsis_EventEntry`), checking modem status, setting software update parameters (server address, filename, protocol, admin status).
- **"via SNMP" in test steps** signals that the operation uses SNMP SET/GET commands to MIB objects rather than TR-069 or direct console access.
- **Key values:** Protocol field: 1 = TFTP, 2 = HTTP. Admin status: 1 = upgradeFromMgt, 2 = allowProvisioningUpgrade, 3 = ignoreProvisioningUpgrade. Address type: 1 = IPv4, 2 = IPv6. Method: 1 = secure, 2 = unsecure.

### 4.2 TR-069 (CWMP)
- **What it is:** The CPE WAN Management Protocol. The ACS (Auto Configuration Server) communicates with the CPE's TR-069 agent to read/write parameters and trigger operations.
- **When used:** Remote parameter configuration (WiFi settings, firewall rules, diagnostics), firmware download (`ACS.Download()`), factory reset (`ACS.FactoryReset()`), reboot (`ACS.Reboot()`), provisioning via TR-069.
- **"via TR-069" / "via ACS"** in test steps signals that the operation goes through the ACS server using TR-069 RPCs (GPV, SPV, etc.) rather than SNMP or direct console.
- **Key RPCs:** GPV (GetParameterValues), SPV (SetParameterValues), GPN (GetParameterNames), GPA/SPA (Get/SetParameterAttributes), Download, Reboot, FactoryReset, ScheduleInform, AddObject, DelObject.

### 4.3 Console / Direct Access
- **What it is:** Direct command-line access to the CPE's Linux console. Used for operations that can't be done remotely.
- **When used:** Reading logs (`get_board_logs`, `read_event_logs`), checking process state, reading interface status, executing dmcli commands, verifying boot messages.
- **"from console"** / **"via CLI"** in test steps signals direct device access.

### 4.4 dmcli (Data Model CLI)
- **What it is:** A command-line tool on the CPE that directly reads/writes TR-181 data model parameters (same parameters as TR-069, but locally).
- **When used:** Setting provisioning modes, WiFi parameters, firewall rules, and other configuration when direct local access is preferred over remote ACS.
- **"via dmcli"** signals a local data model operation on the CPE.

### 4.5 DHCP
- **What it is:** Dynamic Host Configuration Protocol. Used for IP address assignment during provisioning and by LAN/WLAN clients.
- **When used:** CPE provisioning (eCM gets IP from CMTS, eRouter gets IP from WAN), LAN client IP renewal (`start_ipv4_lan_client`, `renew_dhcp`, `release_dhcp`), DHCPv4/DHCPv6 option verification.

### 4.6 GUI (Web Interface)
- **What it is:** The CPE's web-based management interface (typically accessible from LAN at the gateway IP).
- **When used:** Some tests verify settings or perform actions through the GUI. The `gui_password` property on CPESW provides login credentials.

---

## 5. Operation Categories

### 5.1 Connectivity / Online Verification
**Modules:** `boardfarm3_docsis.use_cases.connectivity`, `boardfarm3_lgi_shared.use_cases.online_usecases`

Operations that verify the CPE is operational and connected. Includes: waiting for board boot (`wait_for_board_boot_start`), checking board online status via CMTS (`is_board_online_after_reset`), power cycling (`power_cycle_board`). These operations involve hardware state and are inherently unreliable — they require retry logic.

**Test step phrases:** "Verify CM is online", "Reboot the DUT", "Power cycle the board", "DUT comes back online".

### 5.2 eRouter / IP Address Operations
**Modules:** `boardfarm3_docsis.use_cases.erouter`, `boardfarm3_lgi_shared.use_cases.erouter`

Operations on the eRouter component. Includes: verifying eRouter IP addresses (`verify_erouter_ip_address`), getting WAN interface IPs (`get_wan_iface_ip_addresses`), getting MTA IPs, getting secondary IPv4, getting eRouter IPv6. Used after any state change (reboot, firmware update, provisioning mode switch) to confirm IP connectivity is restored.

**Test step phrases:** "Check if eRouter gets an IP address", "Verify eRouter WAN Interface acquires IPv4 and IPv6", "Check eRouter IP".

### 5.3 Software Update / Firmware
**Modules:** `boardfarm3_docsis.use_cases.software_update`, `boardfarm3_lgi_shared.use_cases.software_update`

Operations for firmware upgrade/downgrade. Includes: getting version info (`get_update_filename`, `get_current_filename`, `get_update_image_version`, `get_alternative_image_version`), checking running version (`is_running_updated_version_via_docsis_snmp`), initiating flash via SNMP (`flash_image_via_docsis_snmp`), getting current CM config.

**Test step phrases:** "Initiate firmware upgrade", "Verify DUT's current firmware version", "Firmware downgrade from latest to last stable".

### 5.4 SNMP Operations
**Modules:** `boardfarm3_docsis.use_cases.snmp`, `boardfarm3_lgi_shared.use_cases.snmp`

Operations for SNMP queries and sets. Includes: SNMP walk, SNMP get/set, reading DOCSIS event entries (`get_docsis_EventEntry`), MIB-based queries.

**Test step phrases:** "Read SNMP MIB", "Verify via SNMP", "Check event log via SNMP".

### 5.5 TR-069 Operations
**Modules:** `boardfarm3_docsis.use_cases.tr069`, `boardfarm3_lgi_shared.use_cases.tr069`

Operations through the ACS using TR-069 protocol. Wraps ACS template RPCs into higher-level use cases.

**Test step phrases:** "Configure via TR-069", "Set parameter via ACS", "Trigger firmware download via TR-069".

### 5.6 DOCSIS Operations
**Modules:** `boardfarm3_docsis.use_cases.docsis`, `boardfarm3_lgi_shared.use_cases.docsis`

DOCSIS-specific operations. Includes: provisioning mode switching (`switch_prov_mode_via_config`), boot file management, DOCSIS channel queries, CM config verification, event log reading.

**Test step phrases:** "Switch provisioning mode", "Verify CM config file", "Check downstream bonding".

### 5.7 Networking / HTTP / DNS
**Modules:** `boardfarm3.use_cases.networking`, `boardfarm3_docsis.use_cases.networking`, `boardfarm3_lgi_shared.use_cases.networking`

General networking operations. Includes: starting HTTP servers (`start_http_server` — context manager), HTTP GET verification (`http_get`), packet capture management (`start_tcpdump_and_verify_packets`, `copy_pcap_to_artifacts`), DNS operations, nmap port scanning, ping, blocking/unblocking traffic, ICMP packet verification.

**Test step phrases:** "Start HTTP server on WAN", "Verify HTTP server is accessible", "Start packet capture", "Block ACS IPv4 address".

### 5.8 DHCP Operations
**Modules:** `boardfarm3.use_cases.dhcp`, `boardfarm3_lgi_shared.use_cases.dhcp`, `boardfarm3_lgi_shared.use_cases.dhcpv6`

DHCP client and server operations. Includes: starting DHCP clients (`start_dhclient`), verifying DHCP options, renewing/releasing leases, DHCPv6 prefix delegation.

**Test step phrases:** "Renew DHCP lease", "Verify DHCP options", "Start DHCPv6 client".

### 5.9 Traffic Generation / iPerf
**Modules:** `boardfarm3.use_cases.iperf`, `boardfarm3_lgi_shared.use_cases.traffic`, `boardfarm3_excentis.use_cases.traffic`

Traffic generation and measurement. Includes: starting iPerf3 servers/clients (`start_iperf_server`, `start_iperf_client`), stopping traffic, parsing results, TCP/UDP throughput testing.

**Test step phrases:** "Generate traffic", "Start iPerf", "Measure throughput", "Verify bandwidth".

### 5.10 Voice / SIP Operations
**Modules:** `boardfarm3.use_cases.voice`, `boardfarm3_lgi_shared.use_cases.voice`

Voice/telephony operations. Includes: making calls, answering calls, verifying call states (ringing, connected, on-hold, conference), call forwarding (busy, no answer, unconditional), three-way calling, call waiting.

**Test step phrases:** "Make a call from phone A to phone B", "Verify phone is ringing", "Put call on hold", "Enable call forwarding".

### 5.11 WiFi Operations
**Modules:** `boardfarm3.use_cases.wifi`, `boardfarm3_lgi_shared.use_cases.wifi`

WiFi configuration and verification. Includes: connecting/disconnecting WLAN clients, scanning SSIDs, verifying WiFi settings, configuring bands/channels/security via ACS or dmcli.

**Test step phrases:** "Connect WiFi client", "Verify SSID is visible", "Change WiFi channel", "Enable 5GHz band".

### 5.12 CPE Operations
**Modules:** `boardfarm3.use_cases.cpe`, `boardfarm3_lgi_shared.use_cases.cpe`

General CPE operations. Includes: CPU/memory usage queries, UPnP rules, NTP synchronization, log enabling, provisioning mode reading, rebooting from console.

**Test step phrases:** "Get CPU usage", "Verify NTP is synchronized", "Create UPnP rule".

### 5.13 Other Specialized Categories

| Module | Purpose |
|--------|---------|
| `multicast` | Multicast/IGMP/MLD operations |
| `ripv2` | RIPv2 routing protocol operations |
| `image_comparison` | Visual comparison (GUI screenshots) |
| `iproute` | IP routing table operations |
| `plume` | Plume cloud WiFi mesh operations |
| `reverse_ssh` | Reverse SSH tunnel operations |
| `tunnel_security` | DS-Lite / tunnel security |
| `gpon` | GPON (fiber) operations via OLT |
| `health_check` | Device health verification |
| `telemetry` | Telemetry data collection |
| `family_time` | Parental control features |
| `vmb_mode` | VMB (Voice Management Bridge) mode |
| `net_tools` | Network utility wrappers (netstat, iptables/firewall) as classes |
| `boot_file_helper` | CM boot file manipulation (add TLVs, update eRouter mode, extract vendor ID) |
| `provision_helper` | Provisioning helper utilities |
| `nw_utility_helper` | Network utility helpers |
| `sam_knows` | SamKnows speed test cloud integration |
| `reporting` | Test result reporting |
| `online_usecases` | Board online verification (connectivity checks) |
| `device_getters` | Device retrieval by type/count (`get_lan_clients`, `get_wan_clients`) |
| `device_utilities` | Device date/time get/set operations |

---

## 6. State Semantics

### 6.1 Operations That Change Persistent Device State

| Operation | What Changes | Persistence |
|-----------|-------------|-------------|
| **Firmware flash** (via SNMP, TR-069, or bootloader) | The software image on the device. The device reboots into new firmware. | Persistent across reboots. The old firmware is gone unless reflashed. |
| **Provisioning mode switch** | The eRouter operating mode (IPv4/IPv6/dual/bridge). Requires config file swap, reprovisioning, and reboot. | Persistent until explicitly changed again. |
| **Factory reset** | All configuration reverts to factory defaults. | Persistent — cannot be undone except by reconfiguring. |
| **TR-069 SPV** (SetParameterValues) | Device parameters (WiFi settings, firewall rules, etc.) are modified. | Persistent — values remain until changed again or factory reset. |
| **dmcli set** | Same as SPV but via local CLI. | Persistent. |
| **ACS AddObject / DelObject** | Creates or removes objects in the data model (e.g., WiFi SSIDs, port mappings). | Persistent. |

### 6.2 Operations That Create Running Processes

| Operation | What Is Created | Lifetime |
|-----------|----------------|----------|
| **Start HTTP server** (`start_http_server`) | An HTTP service process on a device. | Lives until explicitly stopped. The use case is a context manager — entering starts it, exiting stops it. |
| **Start iPerf server/client** | An iPerf3 traffic process. | Lives until explicitly stopped (`stop_traffic`). |
| **Start tcpdump / packet capture** | A tcpdump process capturing packets to a pcap file. | Lives until explicitly stopped (`stop_tcpdump`). The pcap file persists on the device. |
| **Start nping** | A network probing process. | Lives until stopped. |

### 6.3 Operations That Change Transient State (Reverts on Reboot)

| Operation | What Changes |
|-----------|-------------|
| **Board reboot / power cycle** | Device restarts. All running processes are lost. The board re-provisions. Persistent config survives; transient state does not. |
| **DHCP release / renew** on LAN/WLAN client | IP addresses change temporarily. |
| **IP route add / delete** | Routing table entries. Lost on reboot. |
| **ARP cache flush** | Cleared temporarily. |
| **Link state changes** (interface up/down) | Interface status. Reverts on reboot. |

### 6.4 Read-Only Operations (No State Change)

| Operation | What It Does |
|-----------|-------------|
| **SNMP walk / get** | Reads MIB values. Changes nothing. |
| **Ping, traceroute, DNS lookup** | Network diagnostic queries. No persistent effect. |
| **HTTP GET** (to verify accessibility) | Reads a response. No device state change. |
| **nmap port scan** | Probes ports. No device state change. |
| **Read event logs, board logs** | Reads existing logs. No change. |
| **Get CPU/memory usage** | Reads current utilization. No change. |
| **Get IP addresses, interface status** | Reads current network state. No change. |
| **Get firmware version** | Reads the running version. No change. |
| **NTP sync check** | Reads synchronization status. No change. |
| **Check if board is online** | Queries CMTS for CM status. No change. |
| **GPV** (GetParameterValues via ACS) | Reads parameters. No change. |
| **GPN** (GetParameterNames) | Discovers parameters. No change. |
| **Voice state queries** (is_idle, is_ringing, etc.) | Reads phone state. No change. |
