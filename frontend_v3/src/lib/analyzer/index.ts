import type { AnalyzerClient } from "./AnalyzerClient";
import { MockAnalyzerClient } from "./MockAnalyzerClient";
import { HttpAnalyzerClient } from "./HttpAnalyzerClient";

export type { AnalyzerClient } from "./AnalyzerClient";
export { MockAnalyzerClient } from "./MockAnalyzerClient";
export { HttpAnalyzerClient } from "./HttpAnalyzerClient";

const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

export const analyzerClient: AnalyzerClient = useBackend
  ? new HttpAnalyzerClient()
  : new MockAnalyzerClient();
