import type { EnvConfig } from "@/lib/contracts";

/**
 * Descriptor of the editable surface of an environment, per board model. Groups
 * mirror the environment_def sections; each field declares how it renders and
 * whether it maps back to a core EnvConfig field (core) or is reference-only.
 */
export type FieldType = "enum" | "count" | "bool" | "path" | "blob" | "list" | "text";

export interface EnvField {
  key: string;
  label: string;
  type: FieldType;
  /** Maps back to EnvConfig when true; otherwise reference/display only. */
  core: boolean;
  options?: string[];
  unit?: string;
  hint?: string;
}

export interface EnvGroup {
  name: string;
  fields: EnvField[];
}

const PROV = ["ipv4", "ipv6", "dual", "dslite", "disabled"];

export function descriptorFor(model: string): EnvGroup[] {
  const supports6 = model === "F5685LGE" || model === "F3896LG";
  return [
    {
      name: "Provisioning",
      fields: [
        {
          key: "prov_mode",
          label: "eRouter mode",
          type: "enum",
          options: PROV,
          core: true,
          hint: "eRouter_Provisioning_mode",
        },
        { key: "sku", label: "SKU", type: "text", core: true },
        { key: "country", label: "Country", type: "text", core: false },
      ],
    },
    {
      name: "Clients & radios",
      fields: [
        { key: "lan", label: "LAN clients", type: "count", unit: "clients", core: true },
        {
          key: "wifi_bands",
          label: "WiFi radios",
          type: "list",
          options: supports6 ? ["2.4", "5", "6"] : ["2.4", "5"],
          core: true,
        },
      ],
    },
    {
      name: "Software",
      fields: [
        {
          key: "firmware",
          label: "Firmware image",
          type: "path",
          core: true,
          hint: "flashed before the run",
        },
        {
          key: "flash_strategy",
          label: "Flash strategy",
          type: "enum",
          options: ["all", "primary", "none"],
          core: false,
        },
        { key: "reset", label: "Factory reset first", type: "bool", core: true },
      ],
    },
    {
      name: "Services",
      fields: [
        { key: "voice", label: "Voice (eMTA)", type: "bool", core: true },
        { key: "tr069", label: "TR-069 / ACS", type: "bool", core: true },
      ],
    },
    {
      name: "Reference files",
      fields: [
        { key: "boot_file", label: "boot_file", type: "blob", core: false },
        {
          key: "boot_file_mta",
          label: "boot_file_mta",
          type: "blob",
          core: false,
          hint: "only when voice is on",
        },
      ],
    },
  ];
}

export function bootFileFor(e: EnvConfig): string {
  return [
    `# ${e.board_model} · ${e.sku} · ${e.prov_mode}`,
    "Main",
    "{",
    "  NetworkAccess 1;",
    "  DsServiceFlow { QosParamSetType 7; MaxRateSustained 1000000000; }",
    "  UsServiceFlow { QosParamSetType 7; MaxRateSustained 50000000; }",
    "  GlobalPrivacyEnable 1;",
    "}",
  ].join("\n");
}

export function bootFileMtaFor(e: EnvConfig): string {
  if (!e.voice) return "# no eMTA — voice is off for this environment";
  return [
    `# eMTA config · ${e.board_model}`,
    "MtaConfigDelimiter 1;",
    "VoiceService {",
    "  D_LINE 1 { CallSignaling { NCS { } } }",
    "  D_LINE 2 { CallSignaling { NCS { } } }",
    "}",
    "MtaConfigDelimiter 255;",
  ].join("\n");
}
