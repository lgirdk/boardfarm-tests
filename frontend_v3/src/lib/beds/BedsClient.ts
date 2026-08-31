import type { Bed, BoardTypeAvailability } from "@/lib/contracts";
import type { ImportResult } from "./inventoryParser";

/**
 * Read-only view of the physical bed inventory. Users never edit beds — they
 * see availability and pick a board TYPE; boardfarm reserves a free bed from
 * the matching pool. Backed by the lab inventory (ams.json) via the backend.
 */
export interface BedsClient {
  list(): Promise<Bed[]>;
  /** Availability rolled up per board model — what the run picker needs. */
  availability(): Promise<BoardTypeAvailability[]>;
  /** Import beds from a parsed station file (ams.json). Replaces the inventory. */
  importInventory(beds: Bed[]): Promise<ImportResult>;
}
