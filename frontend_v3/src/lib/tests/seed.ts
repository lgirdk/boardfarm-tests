import type { TestAsset } from "@/lib/contracts";

/**
 * Seeded git test catalog. Each test carries its structured requirement
 * (env_modes / lan_clients / capabilities) so the platform can RESOLVE what a
 * selection needs, plus step text (what bf_logger.log_step emits) for search and
 * the current-test view, and a recorded health window for flaky detection. The
 * mock IS the contract for GET /api/tests.
 */
const now = Date.now();

function ago(s: string): number {
  const m = s.match(/(\d+)\s*([dhm])/);
  if (!m) return now;
  const n = Number(m[1]);
  const ms = m[2] === "d" ? 86_400_000 : m[2] === "h" ? 3_600_000 : 60_000;
  return now - n * ms;
}

const STEPS: Record<string, string[]> = {
  test_cm_status_online: [
    "Boot the DUT with max-config and wait for the CM to register",
    "Verify docsIfCmStatusValue reports operational",
    "Check the CMTS shows the modem online",
  ],
  test_MVX_TST_1985: [
    "Verify LLC filter values on DUT booted with max-config",
    "Verify reachability of eMTA & eRouter IPv4 from wan side",
    "SNMP set value 2 for cable interfaces",
    "Verify LLC filter values via SNMP",
    "Verify IPv4 reachability after applying LLC filter rule",
  ],
  test_wan_ipv4_after_reboot: [
    "Reboot the board and wait for it to come back online",
    "Ping the WAN gateway from the LAN client",
    "Verify the eRouter IPv4 address survived the reboot",
  ],
  test_lan_dhcp_lease_renew: [
    "Release the DHCP lease on the LAN client",
    "Request a new lease and verify the offer",
    "Ping from LAN client to WAN host 172.25.1.101",
  ],
  test_dns_resolution_lan_client: [
    "Resolve an external hostname from the LAN client",
    "Verify the answer comes from the configured DNS server",
  ],
  test_erouter_ipv6_prefix_delegation: [
    "Verify the eRouter received a delegated IPv6 prefix",
    "Ping6 from the LAN client out to the WAN side",
  ],
  test_voice_call_fxs_to_fxs: [
    "Register both FXS lines against the SIP proxy",
    "Place a call from line 1000 to line 2000",
    "Verify RTP flows in both directions",
    "Hang up and verify BYE is answered",
  ],
  test_wifi_5g_wpa2_client_connect: [
    "Associate the WLAN client to the 5GHz SSID",
    "Verify the client obtains a DHCP lease",
    "Ping from the wireless client to a WAN host",
  ],
  test_pcap_wan_dhcp_discover: [
    "Start tcpdump on the WAN interface",
    "Trigger a DHCP discover from the LAN side",
    "Parse the pcap and verify the discover reached the WAN",
  ],
};

const DESC: Record<string, string> = {
  test_cm_status_online:
    "Verify cable modem reaches Operational state and reports online on the CMTS after boot.",
  test_MVX_TST_1985:
    "LLC filter applies for IPv4; verify ARP behaviour on the Cable interface via SNMP set/get.",
  test_fw_upgrade_rollback:
    "Flash a new image, force a failure mid-upgrade, and verify the board rolls back to the previous bank.",
  test_voice_call_fxs_to_fxs:
    "Place a call between two FXS lines through the Kamailio SIP proxy and verify RTP flows both ways.",
  test_wifi_5g_wpa2_client_connect:
    "Associate a WLAN client to the 5GHz SSID using WPA2-PSK and verify DHCP + internet reachability.",
};

function T(
  name: string,
  suite: string,
  tags: string[],
  env_modes: string[],
  lan_clients: number,
  capabilities: string[],
  health: number[],
  upd: string,
  runtime: string,
): TestAsset {
  const path = `boardfarm/tests/${suite}/${name}.py`;
  return {
    id: path,
    name,
    path,
    suite,
    tags,
    env_req: env_modes[0],
    env_modes,
    lan_clients,
    capabilities,
    runtime,
    description:
      DESC[name] ?? `Verify ${name.replace(/^test_/, "").replace(/_/g, " ")} behaviour on the DUT.`,
    steps:
      STEPS[name] ?? [
        `Configure the board for ${env_modes[0]} mode`,
        `Exercise ${tags[0]} behaviour and verify the result`,
      ],
    health,
    source: "git",
    updated_at: ago(upd),
  };
}

export const TESTS_SEED: TestAsset[] = [
  T("test_cm_status_online", "docsis", ["docsis", "provisioning"], ["dual"], 1, [], [1, 1, 1, 1, 1, 1, 1, 1], "2d ago", "4m"),
  T("test_us_ofdma_lock", "docsis", ["docsis", "phy"], ["dual"], 0, [], [1, 1, 1, 1, 1, 1, 1, 1], "5d ago", "6m"),
  T("test_ds_ofdm_profile", "docsis", ["docsis", "phy"], ["dual"], 0, [], [1, 1, 0, 1, 1, 1, 1, 1], "5d ago", "7m"),
  T("test_MVX_TST_1985", "snmp", ["snmp", "llc", "filter"], ["ipv4"], 1, [], [1, 1, 1, 0, 1, 1, 1, 1], "1d ago", "9m"),
  T("test_snmp_docsdevfilter_walk", "snmp", ["snmp", "mib"], ["ipv4", "dual"], 1, [], [1, 1, 1, 1, 1, 1, 1, 1], "8d ago", "5m"),
  T("test_snmp_sysdescr_fields", "snmp", ["snmp"], ["dual"], 0, [], [1, 1, 1, 1, 1, 1, 1, 1], "12d ago", "3m"),
  T("test_fw_upgrade_rollback", "firmware", ["firmware", "sw-update"], ["dual"], 1, ["flash"], [1, 0, 1, 1, 0, 1, 1, 1], "20d ago", "28m"),
  T("test_fw_snmp_triggered_flash", "firmware", ["firmware", "snmp"], ["dual"], 1, ["flash"], [1, 1, 1, 1, 0, 1, 1, 1], "9d ago", "24m"),
  T("test_gui_login_default_creds", "gui", ["gui"], ["disabled"], 1, ["gui"], [1, 1, 1, 1, 1, 1, 1, 1], "6d ago", "3m"),
  T("test_gui_change_wifi_ssid", "gui", ["gui", "wifi"], ["dual"], 1, ["gui", "wifi5"], [0, 1, 1, 1, 1, 0, 1, 1], "7d ago", "8m"),
  T("test_gui_parental_control_block", "gui", ["gui", "security"], ["dual"], 2, ["gui"], [1, 1, 1, 1, 1, 1, 1, 1], "3d ago", "11m"),
  T("test_wan_ipv4_after_reboot", "networking", ["wan", "reboot"], ["dual", "ipv4"], 1, [], [1, 1, 1, 1, 1, 1, 1, 1], "1d ago", "12m"),
  T("test_lan_dhcp_lease_renew", "networking", ["dhcp", "lan"], ["ipv4", "dual"], 2, [], [1, 1, 1, 1, 1, 1, 1, 1], "4d ago", "6m"),
  T("test_dns_resolution_lan_client", "networking", ["dns", "lan"], ["dual"], 1, [], [1, 1, 1, 1, 1, 1, 1, 1], "6d ago", "4m"),
  T("test_dslite_aftr_tunnel", "networking", ["dslite", "ipv6"], ["dslite"], 1, [], [1, 1, 0, 0, 1, 1, 1, 1], "11d ago", "14m"),
  T("test_erouter_ipv6_prefix_delegation", "networking", ["ipv6", "erouter"], ["ipv6", "dual"], 1, [], [1, 1, 1, 1, 1, 1, 1, 1], "2d ago", "9m"),
  T("test_voice_call_fxs_to_fxs", "voice", ["voice", "sip"], ["dual"], 1, ["voice"], [1, 1, 1, 1, 1, 1, 1, 1], "3d ago", "13m"),
  T("test_voice_rtp_codec_g711a", "voice", ["voice", "rtp"], ["dual"], 1, ["voice"], [1, 0, 1, 1, 1, 1, 1, 1], "9d ago", "15m"),
  T("test_voice_call_hold_resume", "voice", ["voice", "sip"], ["dual"], 1, ["voice"], [1, 1, 1, 1, 1, 1, 1, 1], "5d ago", "12m"),
  T("test_wifi_5g_wpa2_client_connect", "wifi", ["wifi", "wpa2"], ["dual"], 1, ["wifi5"], [1, 1, 1, 1, 1, 1, 1, 1], "2d ago", "7m"),
  T("test_wifi_channel_change_24g", "wifi", ["wifi", "phy"], ["dual"], 1, ["wifi24"], [0, 1, 1, 0, 1, 1, 1, 1], "8d ago", "9m"),
  T("test_tr069_gpv_device_info", "tr069", ["tr069", "acs"], ["dual"], 1, ["tr069"], [1, 1, 1, 1, 1, 1, 1, 1], "1d ago", "5m"),
  T("test_tr069_spv_wifi_ssid", "tr069", ["tr069", "wifi"], ["dual"], 1, ["tr069", "wifi5"], [1, 1, 1, 1, 1, 1, 1, 1], "4d ago", "8m"),
  T("test_tr069_periodic_inform", "tr069", ["tr069"], ["dual"], 0, ["tr069"], [1, 1, 1, 1, 0, 1, 1, 1], "7d ago", "16m"),
  T("test_factory_reset_online", "provisioning", ["factory-reset"], ["dual"], 1, ["reset"], [1, 1, 1, 1, 1, 1, 1, 1], "2d ago", "18m"),
  T("test_provision_erouter_disabled_mode", "provisioning", ["provisioning"], ["disabled"], 1, [], [1, 1, 1, 1, 1, 1, 1, 1], "10d ago", "11m"),
  T("test_telemetry_odh_report_upload", "telemetry", ["telemetry", "odh"], ["dual"], 1, [], [1, 1, 1, 0, 1, 1, 1, 1], "14d ago", "10m"),
  T("test_pcap_wan_dhcp_discover", "packet-capture", ["pcap", "dhcp"], ["dual"], 1, [], [1, 1, 1, 1, 1, 1, 1, 1], "6d ago", "6m"),
];

