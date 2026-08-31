import { useEffect, useState } from "react";
import { Copy, Play } from "lucide-react";
import { SlideOver } from "@/components/SlideOver";
import { CodeView } from "@/components/CodeView";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { useWorkbench } from "@/lib/workbench";
import { environmentsClient } from "@/lib/environments";
import { checkEnvironment, describeRequirement, resolveRequirement } from "@/lib/requirement";
import type { EnvConfig, TestAsset } from "@/lib/contracts";

/**
 * Review a single test before running it: recorded health, the human-readable
 * requirement + the raw env_req marker, recent runs, and source. Footer decides:
 * add to the selection, or set up a run for just this one.
 */
export function TestDetailDrawer() {
  const { detailTest, closeTest, has, toggle, runTests } = useWorkbench();
  const t = detailTest;

  return (
    <SlideOver
      open={!!t}
      onOpenChange={(o) => !o && closeTest()}
      title={t ? t.name : ""}
      description={t?.description}
      widthClass="w-[640px]"
      footer={
        t ? (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-faint">
              {t.suite} · {t.path}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => toggle(t)}>
                <Copy className="h-3.5 w-3.5" />
                {has(t.id) ? "Remove from selection" : "Add to selection"}
              </Button>
              <Button variant="primary" size="sm" onClick={() => runTests([t])}>
                <Play className="h-3.5 w-3.5" /> Run this test
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      {t && <Body t={t} />}
    </SlideOver>
  );
}

function Body({ t }: { t: TestAsset }) {
  const [envs, setEnvs] = useState<EnvConfig[]>([]);
  useEffect(() => {
    void environmentsClient.list().then(setEnvs);
  }, []);

  const health = t.health ?? [];
  const passes = health.filter((x) => x === 1).length;
  const pct = health.length ? Math.round((passes / health.length) * 100) : 100;
  const flaky = pct < 80;

  const req = resolveRequirement([t]);
  const needs = describeRequirement(req);
  const compatible = envs.filter((e) => checkEnvironment(e, req).ok).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[11px] border border-border bg-surface/40 p-3.5">
          <div className="text-[10.5px] uppercase tracking-[0.05em] text-faint">
            Recorded here · last {health.length || 8} runs
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              {health.map((v, i) => (
                <span key={i} className={cn("h-4 w-1 rounded-full", v ? "bg-ok" : "bg-danger")} />
              ))}
            </span>
            <b className={cn("text-[15px]", flaky ? "text-warning" : "text-ok")}>
              {passes}/{health.length || 8}
            </b>
          </div>
          <p className="mt-1.5 text-[11px] text-faint">
            {flaky
              ? "Fails intermittently — worth checking before you trust a red result."
              : "Stable so far."}{" "}
            Typical runtime {t.runtime}.
          </p>
        </div>

        <div className="rounded-[11px] border border-border bg-surface/40 p-3.5">
          <div className="text-[10.5px] uppercase tracking-[0.05em] text-faint">What it needs</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {needs.map((n) => (
              <span
                key={n}
                className="rounded-md border border-border bg-surface-raised px-1.5 py-0.5 text-[10.5px] text-muted"
              >
                {n}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-faint">
            Declared by its <span className="font-mono">env_req</span> marker. {compatible} saved
            environment{compatible === 1 ? "" : "s"} satisfy it.
          </p>
        </div>
      </div>

      <div>
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.05em] text-faint">env_req marker</div>
        <CodeView
          language="python"
          code={`@pytest.mark.env_req({
  "environment_def": {
    "board": {
      "eRouter_Provisioning_mode": [${t.env_modes.map((m) => `"${m}"`).join(", ")}],
      "lan_clients": [${Array(t.lan_clients).fill("{}").join(", ")}]${t.capabilities.includes("wifi5") ? `,\n      "wifi_clients": [{"band": "5"}]` : ""}
    }${t.capabilities.includes("tr069") ? `,\n    "tr-069": {}` : ""}${t.capabilities.includes("voice") ? `,\n    "voice": {"EXT_VOIP": [{"profile": "pjsip"}]}` : ""}
  }
})`}
        />
      </div>

      <div>
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.05em] text-faint">Recent runs of this test</div>
        <div className="overflow-hidden rounded-[9px] border border-border">
          {[
            ["r-0140", "8h ago", "completed", "CH7465LG-3-2"],
            ["r-0131", "2d ago", "completed", "F3896LG-1-1"],
            ["r-0119", "5d ago", flaky ? "failed" : "completed", "CH7465LG-3-1"],
          ].map(([id, ago, st, bed], i) => (
            <div
              key={id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-[11.5px]",
                i > 0 && "border-t border-border/60",
              )}
            >
              <span className="font-mono text-faint">{id}</span>
              <span className={cn(st === "failed" ? "text-danger" : "text-ok")}>{st}</span>
              <span className="font-mono text-muted">{bed}</span>
              <span className="ml-auto text-faint">{ago}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.05em] text-faint">
          Source · <span className="font-mono normal-case">{t.path}</span>
        </div>
        <CodeView
          language="python"
          code={`"""${t.description ?? ""}"""
import pytest
from boardfarm3.lib.device_manager import DeviceManager

def ${t.name}(setup_teardown, bf_logger, bf_context):
    board, wan, cmts = setup_teardown
${(t.steps ?? []).map((s, i) => `    bf_logger.log_step("Step${i + 1}: ${s}")`).join("\n")}
    ...`}
        />
      </div>
    </div>
  );
}
