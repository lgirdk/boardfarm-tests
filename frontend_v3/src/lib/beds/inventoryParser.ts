import type { Bed } from "@/lib/contracts";

/**
 * Raw shape of a single board entry in boardfarm's station file (ams.json).
 * The file is `Record<boardId, StationEntry>` at the top level, where
 * the key is the board ID like "CH7465LG-3-1".
 */
interface StationDevice {
  name: string;
  type: string;
  ipaddr?: string;
  port?: number;
  cm_mac?: string;
  manufacturer?: string;
  sku?: string;
  feature?: string[];
  numbers?: string[];
  number?: string;
  connection_type?: string;
  [key: string]: unknown;
}

interface StationEntry {
  devices: StationDevice[];
  location?: string;
  labels?: string[];
}

export interface ImportResult {
  beds: Bed[];
  models: Map<string, number>;
  totalParsed: number;
  skipped: string[];
}

/**
 * Parse a boardfarm station file (ams.json) into Bed records.
 *
 * Extracts:
 *  - Board model from the key (e.g. "CH7465LG-3-1" → "CH7465LG")
 *  - Features from the board device's `feature` array + inferred from device presence
 *  - Device list (names of all connected devices)
 *  - Location, labels, manufacturer, SKU, MAC from the JSON
 *
 * All imported beds start as status "free" with no holder — runtime state
 * is managed by the application, not the station file.
 */
export function parseStationFile(raw: unknown): ImportResult {
  if (!raw || typeof raw !== "object") {
    return { beds: [], models: new Map(), totalParsed: 0, skipped: [] };
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  const beds: Bed[] = [];
  const models = new Map<string, number>();
  const skipped: string[] = [];

  for (const [key, value] of entries) {
    // Skip non-board entries (e.g. "locations" metadata)
    if (!value || typeof value !== "object" || !("devices" in (value as Record<string, unknown>))) {
      skipped.push(key);
      continue;
    }

    const entry = value as StationEntry;
    if (!Array.isArray(entry.devices) || entry.devices.length === 0) {
      skipped.push(key);
      continue;
    }

    const boardDevice = entry.devices.find((d) => d.name === "board");
    if (!boardDevice) {
      skipped.push(key);
      continue;
    }

    // Extract model from key: "CH7465LG-3-1" → "CH7465LG"
    // Convention: everything before the last two dash-separated segments
    const parts = key.split("-");
    const board_model =
      parts.length >= 3 ? parts.slice(0, -2).join("-") : boardDevice.type || key;

    // Collect features
    const features = new Set<string>(boardDevice.feature ?? []);

    // Infer features from device presence
    const deviceNames = entry.devices.map((d) => d.name);
    if (deviceNames.includes("sipcenter") || deviceNames.includes("softphone1")) {
      features.add("voice");
    }
    // Check labels for WiFi
    const labelsLower = (entry.labels ?? []).map((l) => l.toLowerCase());
    if (labelsLower.some((l) => l.includes("wifi"))) {
      features.add("wifi");
    }
    // Check if any device has wifi in type
    if (entry.devices.some((d) => d.type?.toLowerCase().includes("wifi"))) {
      features.add("wifi");
    }
    // Infer docsis version from labels
    if (labelsLower.some((l) => l.includes("docsis3.1") || l.includes("d31"))) {
      features.add("docsis3.1");
    }

    const bed: Bed = {
      id: key,
      board_model,
      location: entry.location ?? "",
      status: "free",
      features: [...features].sort(),
      devices: entry.devices.map((d) => d.name),
      labels: entry.labels,
    };

    beds.push(bed);
    models.set(board_model, (models.get(board_model) ?? 0) + 1);
  }

  return {
    beds: beds.sort((a, b) => a.id.localeCompare(b.id)),
    models,
    totalParsed: beds.length,
    skipped,
  };
}
