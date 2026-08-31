import type { Bed } from "@/lib/contracts";

/**
 * Seeded bed inventory — mirrors what the backend derives from ams.json: each
 * bed is a physical board plus its connected devices (wan, lan, sipcenter…),
 * a location (cmts/mac-domain) and a live status. The mock IS the contract for
 * GET /api/beds.
 */
function bed(
  board_model: string,
  rack: number,
  slot: number,
  status: Bed["status"],
  features: string[],
  location: string,
  extra?: Partial<Bed>,
): Bed {
  const baseDevices = ["board", "wan", "lan", "tftp"];
  return {
    id: `${board_model}-${rack}-${slot}`,
    board_model,
    location,
    status,
    features,
    devices: features.includes("voice")
      ? [...baseDevices, "sipcenter", "softphone1"]
      : baseDevices,
    labels: [`Brd${board_model}`, `Rack${rack}`, ...features.map((f) => f)],
    ...extra,
  };
}

export const BEDS_SEED: Bed[] = [
  bed("CH7465LG", 3, 1, "free", ["voice", "docsis3.1"], "ams-cmts7-md1"),
  bed("CH7465LG", 3, 2, "in_use", ["voice", "docsis3.1"], "ams-cmts7-md1", {
    held_by: "skhan",
    held_run_id: "r-0140",
  }),
  bed("CH7465LG", 4, 1, "free", ["voice"], "ams-cmts7-md2"),
  bed("CH7465LG", 4, 2, "offline", ["voice"], "ams-cmts7-md2"),
  bed("F3896LG", 1, 1, "free", ["voice", "wifi", "docsis3.1"], "ams-cmts5-md1"),
  bed("F3896LG", 1, 2, "in_use", ["voice", "wifi", "docsis3.1"], "ams-cmts5-md1", {
    held_by: "you",
    held_run_id: "r-0141",
  }),
  bed("F3896LG", 2, 1, "maintenance", ["wifi"], "ams-cmts5-md2"),
  bed("TG2492LG", 6, 1, "free", ["wifi", "voice"], "ams-cmts3-md1"),
  bed("TG2492LG", 6, 2, "free", ["wifi", "voice"], "ams-cmts3-md1"),
  bed("F5685LGE", 8, 1, "in_use", ["wifi", "voice", "docsis3.1"], "ams-cmts9-md1", {
    held_by: "mkumar",
    held_run_id: "r-0139",
  }),
  bed("F5685LGE", 8, 2, "free", ["wifi", "voice", "docsis3.1"], "ams-cmts9-md1"),
];
