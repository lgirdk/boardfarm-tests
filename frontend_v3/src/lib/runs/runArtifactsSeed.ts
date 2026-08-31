import type { RunArtifact } from "@/lib/contracts";

/**
 * Seed run-output artifacts (pcap, log, serial dump). These are presentation-
 * layer files produced by a boardfarm collect step — distinct from the git-
 * backed code Artifacts in lib/artifacts.
 *
 * Replace with real data by wiring HttpRunsClient.runArtifacts to the backend.
 */
export const RUN_ARTIFACTS_SEED: RunArtifact[] = [
  { name: "wan_dhcp_capture.pcap", size: "2.4 MB", description: "packet capture from the WAN side" },
  { name: "boardfarm_run.log", size: "812 KB", description: "full framework log" },
  { name: "console_serial.txt", size: "44 KB", description: "raw serial console dump" },
];
