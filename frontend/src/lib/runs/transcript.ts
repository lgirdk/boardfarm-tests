import type { ConsoleLine, ConsoleLevel, Run } from "@/lib/contracts";

/**
 * Reconstruct a console transcript from a run's step progression. Used by the
 * MockRunsClient; a real backend streams actual stdout instead.
 *
 * The logic here is an exact lift of the former inline `buildTranscript` from
 * RunDetailPage — same output, just callable from the client layer.
 */
export function buildTranscript(run: Run): ConsoleLine[] {
  const base = run.started_at ?? run.created_at;
  const names = (run.input?.test_names as string[] | undefined) ?? [];
  const out: ConsoleLine[] = [];

  run.steps.forEach((s, i) => {
    if (s.state === "pending" || s.state === "skipped") return;
    const ts = s.started_at ?? base + i * 2000;
    const done = s.state === "completed";
    const push = (src: string, level: ConsoleLevel, text: string) =>
      out.push({ ts, src, level, text });

    switch (s.name) {
      case "reserve":
        push("boardfarm", "i", `Resource lock acquired: ${String(run.input?.bed ?? "bed")}`);
        push("boardfarm", "i", "Parsing inventory ams.json :: 1 board, 6 devices");
        break;
      case "flash":
        push("tftp", "i", `Image staged: ${String(s.details?.image ?? "image.bin")}`);
        push("CPE", "i", "Download 61% (29.4/48.2 MB)");
        if (done) push("CPE", "ok", "Image written to bank B, CRC verified");
        break;
      case "factory_reset":
        push("CPE", "i", "Issuing factory reset — board will reboot");
        if (done) push("CPE", "ok", "Board back online after reset");
        break;
      case "provision":
        push("provision", "i", "DOCSIS registration started, boot_file = 128 TLVs");
        push("cmts", "i", "CM 68:02:b8:02:c8:17 :: init(rc) → init(d) → online");
        if (done) {
          const ip = String(s.details?.erouter_ipv4 ?? "172.25.1.114");
          push("provision", "ok", `eRouter provisioned :: ${ip} / 2001:dead:beef:2::114`);
        }
        break;
      case "execute":
        push("pytest", "i", `collected ${names.length || 1} items`);
        (names.length ? names : ["test"]).forEach((n, idx, arr) => {
          push("pytest", "i", `tests/${n}.py::${n}`);
          if (done || idx < arr.length - 1)
            push("pytest", "ok", `PASSED [ ${Math.round(((idx + 1) / arr.length) * 100)}% ]`);
        });
        break;
      case "collect":
        push("boardfarm", "i", "Collecting pcaps, logs and serial dumps");
        if (done) push("boardfarm", "ok", "3 artifacts collected");
        break;
      case "release":
        push("boardfarm", "i", "Releasing bed and tearing down services");
        if (done) push("boardfarm", "ok", "Bed released");
        break;
      default:
        push("boardfarm", "i", s.title);
    }
    if (s.state === "failed") push("boardfarm", "e", s.summary ?? "step failed");
  });

  if (run.error)
    out.push({ ts: run.finished_at ?? Date.now(), src: "boardfarm", level: "e", text: run.error.message });
  return out;
}
