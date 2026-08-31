import type { Bed, BoardTypeAvailability } from "@/lib/contracts";
import type { BedsClient } from "./BedsClient";
import { BEDS_SEED } from "./seed";

/** In-browser bed inventory (deep-cloned so callers can't mutate the seed). */
export class MockBedsClient implements BedsClient {
  constructor(
    private readonly seed: Bed[] = BEDS_SEED,
    private readonly delayMs = 120,
  ) {}

  async list(): Promise<Bed[]> {
    if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs));
    return structuredClone(this.seed);
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
}
