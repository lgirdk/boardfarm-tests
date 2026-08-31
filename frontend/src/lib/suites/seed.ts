/**
 * MOCK SEED DATA — used by MockSuitesClient when VITE_USE_BACKEND !== "1".
 * To switch to real data, set VITE_USE_BACKEND=1 and wire HttpSuitesClient
 * to the backend API. This file is only loaded in mock mode.
 */
import type { TestSuite } from "@/lib/contracts";

const day = 86_400_000;
const now = Date.now();

/** A couple of seeded suites so the Library isn't empty on first load. */
export const SUITES_SEED: TestSuite[] = [
  {
    id: "suite-docsis-sanity",
    name: "DOCSIS sanity",
    test_ids: [
      "boardfarm/tests/docsis/test_cm_status_online.py",
      "boardfarm/tests/docsis/test_us_ofdma_lock.py",
      "boardfarm/tests/docsis/test_ds_ofdm_profile.py",
    ],
    owner: "team",
    visibility: "published",
    updated_at: now - 3 * day,
  },
  {
    id: "suite-wan-smoke",
    name: "WAN smoke",
    test_ids: [
      "boardfarm/tests/networking/test_wan_ipv4_after_reboot.py",
      "boardfarm/tests/networking/test_lan_dhcp_lease_renew.py",
    ],
    owner: "you",
    visibility: "private",
    updated_at: now - 1 * day,
  },
];
