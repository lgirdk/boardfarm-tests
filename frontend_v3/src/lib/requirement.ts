import type { EnvConfig, Requirement, TestAsset } from "@/lib/contracts";

/**
 * Requirement resolution — the load-bearing logic. `env_req` is machine-readable,
 * so the system computes (not asks) what a set of tests needs. Pure functions,
 * no UI. Semantics from the boardfarm env_req marker:
 *  - modes are OR within a test; intersected across tests (empty = conflict)
 *  - lan_clients is a minimum → take the max
 *  - capability blocks (voice, tr069, wifi…) are unions
 */
export const CAPABILITY_LABEL: Record<string, string> = {
  voice: "voice (PJSIP)",
  tr069: "TR-069 / ACS",
  gui: "GUI browser",
  wifi5: "5GHz WiFi client",
  wifi24: "2.4GHz WiFi client",
  flash: "firmware flash",
  reset: "factory reset",
};

export function resolveRequirement(tests: TestAsset[]): Requirement | null {
  if (!tests.length) return null;
  let modes: Set<string> | null = null;
  let lanClients = 0;
  const capabilities = new Set<string>();
  let conflict = false;

  for (const t of tests) {
    const m = new Set<string>(t.env_modes ?? (t.env_req ? [t.env_req] : []));
    if (modes === null) {
      modes = m;
    } else {
      const current: Set<string> = modes;
      const inter = new Set<string>();
      current.forEach((x) => {
        if (m.has(x)) inter.add(x);
      });
      if (inter.size === 0) conflict = true;
      else modes = inter;
    }
    lanClients = Math.max(lanClients, t.lan_clients ?? 0);
    for (const c of t.capabilities ?? []) capabilities.add(c);
  }

  return {
    modes: [...(modes ?? [])],
    lanClients,
    capabilities: [...capabilities],
    conflict,
  };
}

/** Human-readable chips for a requirement, e.g. ["dual or ipv4 provisioning", …]. */
export function describeRequirement(req: Requirement | null): string[] {
  if (!req) return [];
  const out: string[] = [];
  out.push(
    req.conflict
      ? "conflicting provisioning modes"
      : `${req.modes.join(" or ")} provisioning`,
  );
  if (req.lanClients)
    out.push(`${req.lanClients} LAN client${req.lanClients > 1 ? "s" : ""}`);
  for (const c of req.capabilities) out.push(CAPABILITY_LABEL[c] ?? c);
  return out;
}

/** Whether an environment satisfies a requirement, with a reason on failure. */
export function checkEnvironment(
  env: EnvConfig,
  req: Requirement | null,
): { ok: true } | { ok: false; reason: string } {
  if (!req || req.conflict) return { ok: false, reason: "requirement set conflicts" };
  if (!req.modes.includes(env.prov_mode))
    return { ok: false, reason: `provides ${env.prov_mode} only` };
  if ((env.lan ?? 0) < req.lanClients)
    return { ok: false, reason: `only ${env.lan ?? 0} LAN client${(env.lan ?? 0) === 1 ? "" : "s"}` };
  if (req.capabilities.includes("voice") && !env.voice)
    return { ok: false, reason: "no voice profile" };
  if (req.capabilities.includes("tr069") && !env.tr069)
    return { ok: false, reason: "no TR-069 block" };
  if (req.capabilities.includes("wifi5") && !(env.wifi_bands ?? []).includes("5"))
    return { ok: false, reason: "no 5GHz WiFi client" };
  if (req.capabilities.includes("wifi24") && !(env.wifi_bands ?? []).includes("2.4"))
    return { ok: false, reason: "no 2.4GHz WiFi client" };
  return { ok: true };
}
