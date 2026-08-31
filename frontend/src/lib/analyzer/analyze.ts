import type { LogAnalysis } from "@/lib/contracts";

/**
 * The mock analysis engine — keyword triage that mimics what the real analyzer
 * backend returns. Kept pure and separate so MockAnalyzerClient is a thin
 * wrapper and this can be deleted wholesale when the backend lands.
 */
export function analyzeLog(text: string): LogAnalysis {
  const m = text.toLowerCase();

  if (/sip|register|pjsip|kamailio|voice|\baor\b|softphone/.test(m)) {
    return {
      severity: "critical",
      headline: "SIP registration never completed on softphone1",
      detail:
        "The board came up and provisioned normally, but pjsip on softphone1 got no 200 OK for its REGISTER within the 30s window. Every later step failed as a consequence of this one.",
      evidence: [
        { ts: "02:31:04", src: "softphone1", level: "info", text: "REGISTER sip:1000@10.64.38.19 → sent" },
        { ts: "02:31:34", src: "softphone1", level: "err", text: "No response after 30000ms, giving up" },
        { ts: "02:31:34", src: "kamailio", level: "warn", text: "auth: no matching AOR for 1000 in location table" },
      ],
      likely_cause:
        "The MTA boot file provisioned line 1 with a number the SIP center doesn't know about. Compare boot_file_mta in this environment against the numbers registered on sipcenter (1000, 2000, 3000, 4000).",
      actions: [
        { label: "Open the environment", kind: "open_environment" },
        { label: "Jump to line in console", kind: "jump_console" },
        { label: "Compare with last passing run", kind: "compare" },
      ],
    };
  }

  if (/offline|console|\bt3\b|ranging|lost|unreachable/.test(m)) {
    return {
      severity: "critical",
      headline: "Device console dropped mid-run",
      detail:
        "The bed lost connectivity to the device during execution — a DOCSIS ranging / T3 timeout took the console offline, so every step after it failed as a consequence.",
      evidence: [
        { ts: "—", src: "cmts", level: "warn", text: "CM 68:02:b8:02:c8:17 T3 time-out during ranging" },
        { ts: "—", src: "connection", level: "err", text: "serial console unreachable" },
      ],
      likely_cause:
        "Bed offline or RF/console instability. Retry on another bed of the same model; if it recurs on the same bed, flag it for maintenance.",
      actions: [
        { label: "Open the board", kind: "open_board" },
        { label: "Retry on another bed", kind: "retry" },
      ],
    };
  }

  if (/timeout|timed out|deadline|exceeded/.test(m)) {
    return {
      severity: "major",
      headline: "A step exceeded its time budget",
      detail:
        "An operation timed out before the device reached the expected state. The rest of the run was skipped once the deadline passed.",
      evidence: [
        { ts: "01:58:40", src: "acs", level: "err", text: "timed out waiting for ACS response (30000ms)" },
      ],
      likely_cause:
        "Slow provisioning or an unresponsive service — check DHCP / ACS reachability from the WAN side.",
      actions: [
        { label: "Open the environment", kind: "open_environment" },
        { label: "Jump to line in console", kind: "jump_console" },
      ],
    };
  }

  const firstErr = text.split("\n").find((l) => /error|fail|assert|traceback/i.test(l)) ?? "";
  return {
    severity: "major",
    headline: firstErr ? firstErr.trim().slice(0, 80) : "No obvious failure signature",
    detail: firstErr
      ? "The analyzer matched a generic failure line. Review the surrounding console for the failing assertion or trace."
      : "Nothing in this log matches a known failure signature. Paste more of the boardfarm output, or point it at a failed run.",
    evidence: firstErr
      ? [{ ts: "—", src: "pytest", level: "err", text: firstErr.trim().slice(0, 120) }]
      : [],
    likely_cause: firstErr
      ? "See the boardfarm console around this line for the failing assertion or traceback."
      : "—",
    actions: [{ label: "Jump to line in console", kind: "jump_console" }],
  };
}
