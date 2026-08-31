import type { Bed, BoardTypeAvailability } from "@/lib/contracts";
import type { BedsClient } from "./BedsClient";
import type { ImportResult } from "./inventoryParser";
import { BEDS_SEED } from "./seed";

/** In-browser bed inventory — mutable so import can replace the data. */
export class MockBedsClient implements BedsClient {
  private beds: Bed[];

  constructor(seed: Bed[] = BEDS_SEED, private readonly delayMs = 120) {
    this.beds = structuredClone(seed);
  }

  async list(): Promise<Bed[]> {
    if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs));
    return structuredClone(this.beds);
  }

  async availability(): Promise<BoardTypeAvailability[]> {
    const beds = await this.list();
    const byModel = new Map<string, BoardTypeAvailability>();
    for (const b of beds) {
      const row =
        byModel.get(b.board_model) ??
        ({
          board_model: b.board_model,
          total: 0,
          free: 0,
          in_use: 0,
          offline: 0,
          features: [],
        } satisfies BoardTypeAvailability);
      row.total += 1;
      if (b.status === "free") row.free += 1;
      else if (b.status === "in_use") row.in_use += 1;
      else row.offline += 1; // offline + maintenance count as not-runnable
      row.features = [...new Set([...row.features, ...b.features])].sort();
      byModel.set(b.board_model, row);
    }
    return [...byModel.values()].sort((a, b) =>
      a.board_model.localeCompare(b.board_model),
    );
  }

  async importInventory(beds: Bed[]): Promise<ImportResult> {
    if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs));
    this.beds = structuredClone(beds);
    const models = new Map<string, number>();
    for (const b of beds) {
      models.set(b.board_model, (models.get(b.board_model) ?? 0) + 1);
    }
    return { beds, models, totalParsed: beds.length, skipped: [] };
  }
}
