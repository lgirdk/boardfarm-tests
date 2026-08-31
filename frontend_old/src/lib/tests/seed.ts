import type { TestAsset } from "@/lib/contracts";

/**
 * Seeded git test catalog — mirrors what the backend would return from reading
 * the boardfarm test repo: tests organized by suite/area, each with tags and
 * its env_req marker. The mock IS the contract for GET /api/tests.
 */
const day = 86_400_000;
const now = Date.now();

function t(
  suite: string,
  name: string,
  tags: string[],
  env_req: string | undefined,
  ageDays: number,
): TestAsset {
  return {
    id: `boardfarm/tests/${suite}/${name}.py`,
    name,
    path: `boardfarm/tests/${suite}/${name}.py`,
    suite,
    tags,
    env_req,
    source: "git",
    updated_at: now - ageDays * day,
  };
}

export const TESTS_SEED: TestAsset[] = [
  t("docsis", "test_cm_status_online", ["docsis", "provisioning"], "dual", 2),
  t("docsis", "test_us_ofdma_lock", ["docsis", "phy"], "dual", 5),
  t("docsis", "test_ds_ofdm_profile", ["docsis", "phy"], "dual", 5),
  t("networking", "test_wan_ipv4_after_reboot", ["wan", "reboot"], "dual", 1),
  t("networking", "test_ipv6_prefix_delegation", ["wan", "ipv6"], "ipv6", 8),
  t("networking", "test_lan_dhcp_renew", ["lan", "dhcp"], "dual", 3),
  t("wifi", "test_wifi_2g_wpa2_assoc", ["wifi", "2.4g"], "wifi", 4),
  t("wifi", "test_wifi_5g_wpa3_assoc", ["wifi", "5g"], "wifi", 4),
  t("voice", "test_voice_line_register", ["voice", "sip"], "voice", 10),
  t("voice", "test_voice_call_hold", ["voice", "sip"], "voice", 12),
  t("gui", "test_gui_login_default_creds", ["gui"], undefined, 6),
  t("gui", "test_gui_change_wifi_ssid", ["gui", "wifi"], "wifi", 7),
  t("firmware", "test_fw_upgrade_rollback", ["firmware"], "dual", 20),
];
