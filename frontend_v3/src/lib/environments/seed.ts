import type { EnvConfig, EnvProvMode } from "@/lib/contracts";

/**
 * Seeded environment catalog — mirrors the CH7465LG json_payload variants:
 * per SKU × provisioning mode × wifi/voice. Each carries a pretty-printed
 * environment_def and the env_tags used to match a test's env_req. The mock IS
 * the contract for GET /api/environments.
 */
const day = 86_400_000;
const now = Date.now();

export function buildEnvContent(p: {
  board_model: string;
  sku: string;
  prov_mode: EnvProvMode;
  wifi: boolean;
  voice: boolean;
}): string {
  const def: Record<string, unknown> = {
    environment_def: {
      CMTS: { model: "CC8800", type: "topvision" },
      board: {
        model: p.board_model,
        SKU: p.sku,
        country: "PL",
        eRouter_Provisioning_mode: p.prov_mode,
        software: { flash_strategy: "all", factory_reset: true },
        wifi: { radios: p.wifi ? ["2.4GHz", "5GHz"] : [] },
        lan_clients: [{}, {}],
      },
      ...(p.voice
        ? { voice: { EXT_VOIP: [{ profile: "pjsip", type: "debian" }] } }
        : {}),
    },
    version: "2.31",
  };
  return JSON.stringify(def, null, 2);
}

interface EnvParams {
  board_model: string;
  sku: string;
  prov_mode: EnvProvMode;
  lan: number;
  voice: boolean;
  tr069: boolean;
  wifi_bands: string[];
  firmware?: string | null;
  reset?: boolean;
}

function env(
  id: string,
  name: string,
  p: EnvParams,
  visibility: EnvConfig["visibility"],
  owner: string,
  ageDays: number,
): EnvConfig {
  const wifi = p.wifi_bands.length > 0;
  const env_tags = [
    p.prov_mode,
    ...(wifi ? ["wifi"] : []),
    ...(p.voice ? ["voice"] : []),
  ];
  return {
    id,
    name,
    board_model: p.board_model,
    sku: p.sku,
    prov_mode: p.prov_mode,
    wifi,
    voice: p.voice,
    lan: p.lan,
    tr069: p.tr069,
    wifi_bands: p.wifi_bands,
    firmware: p.firmware ?? null,
    reset: p.reset ?? false,
    visibility,
    owner,
    updated_at: now - ageDays * day,
    env_tags,
    content: buildEnvContent({
      board_model: p.board_model,
      sku: p.sku,
      prov_mode: p.prov_mode,
      wifi,
      voice: p.voice,
    }),
  };
}

export const ENVIRONMENTS_SEED: EnvConfig[] = [
  env(
    "env-ch7465-upc-dual-voice",
    "CH7465LG · UPC dual + voice",
    { board_model: "CH7465LG", sku: "UPC", prov_mode: "dual", lan: 2, voice: true, tr069: true, wifi_bands: [], firmware: "ofw-ch7465lg-r18-20250812.bin", reset: true },
    "published",
    "team",
    2,
  ),
  env(
    "env-ch7465-ipv4-minimal",
    "CH7465LG · UPC IPv4 minimal",
    { board_model: "CH7465LG", sku: "UPC", prov_mode: "ipv4", lan: 1, voice: false, tr069: false, wifi_bands: [] },
    "published",
    "team",
    6,
  ),
  env(
    "env-ch7465-sunrise-ipv6",
    "CH7465LG · Sunrise IPv6",
    { board_model: "CH7465LG", sku: "Sunrise", prov_mode: "ipv6", lan: 1, voice: false, tr069: false, wifi_bands: [] },
    "published",
    "team",
    9,
  ),
  env(
    "env-ch7465-dslite",
    "CH7465LG · UPC DS-Lite",
    { board_model: "CH7465LG", sku: "UPC", prov_mode: "dslite", lan: 1, voice: false, tr069: false, wifi_bands: [] },
    "published",
    "team",
    16,
  ),
  env(
    "env-f3896-sunrise-wifi5-tr069",
    "F3896LG · Sunrise wifi5 + tr069",
    { board_model: "F3896LG", sku: "Sunrise", prov_mode: "dual", lan: 2, voice: false, tr069: true, wifi_bands: ["5"], firmware: "ofw-f3896lg-r22-20250310.bin", reset: true },
    "published",
    "team",
    1,
  ),
  env(
    "env-f3896-gui-disabled",
    "F3896LG · Sunrise disabled router",
    { board_model: "F3896LG", sku: "Sunrise", prov_mode: "disabled", lan: 1, voice: false, tr069: false, wifi_bands: [], reset: true },
    "published",
    "team",
    8,
  ),
  env(
    "env-tg2492-vm-dual-voice-wifi",
    "TG2492LG · Virgin dual + voice + wifi",
    { board_model: "TG2492LG", sku: "Virgin Media", prov_mode: "dual", lan: 2, voice: true, tr069: false, wifi_bands: ["5", "2.4"] },
    "published",
    "team",
    5,
  ),
  env(
    "env-f5685-telenet-dual-full",
    "F5685LGE · Telenet dual + voice + wifi + tr069",
    { board_model: "F5685LGE", sku: "Telenet", prov_mode: "dual", lan: 2, voice: true, tr069: true, wifi_bands: ["5", "2.4"] },
    "published",
    "team",
    4,
  ),
  env(
    "env-my-ch7465-ipv6-scratch",
    "CH7465LG · Ziggo IPv6 (my scratch)",
    { board_model: "CH7465LG", sku: "Ziggo", prov_mode: "ipv6", lan: 1, voice: false, tr069: false, wifi_bands: [] },
    "private",
    "you",
    0,
  ),
];
