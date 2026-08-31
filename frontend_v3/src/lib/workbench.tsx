import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TestAsset } from "@/lib/contracts";

/**
 * The workbench: the selection that powers the tray, plus the overlay state for
 * the test-detail drawer and the "Set up run" composer. Lives above the router
 * so the selection survives navigation (that's the whole point of the tray).
 */
interface WorkbenchValue {
  selected: TestAsset[];
  has: (id: string) => boolean;
  toggle: (t: TestAsset) => void;
  add: (tests: TestAsset[]) => void;
  setSelection: (tests: TestAsset[]) => void;
  remove: (id: string) => void;
  clear: () => void;

  detailTest: TestAsset | null;
  openTest: (t: TestAsset) => void;
  closeTest: () => void;

  composerOpen: boolean;
  openComposer: () => void;
  closeComposer: () => void;

  /** Set the selection to exactly these tests and open the composer. */
  runTests: (tests: TestAsset[]) => void;
}

const Ctx = createContext<WorkbenchValue | null>(null);

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<TestAsset[]>([]);
  const [detailTest, setDetailTest] = useState<TestAsset | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const value = useMemo<WorkbenchValue>(
    () => ({
      selected,
      has: (id) => selected.some((t) => t.id === id),
      toggle: (t) =>
        setSelected((p) =>
          p.some((x) => x.id === t.id) ? p.filter((x) => x.id !== t.id) : [...p, t],
        ),
      add: (tests) =>
        setSelected((p) => {
          const ids = new Set(p.map((x) => x.id));
          return [...p, ...tests.filter((t) => !ids.has(t.id))];
        }),
      setSelection: (tests) => setSelected(tests),
      remove: (id) => setSelected((p) => p.filter((x) => x.id !== id)),
      clear: () => setSelected([]),

      detailTest,
      openTest: (t) => setDetailTest(t),
      closeTest: () => setDetailTest(null),

      composerOpen,
      openComposer: () => setComposerOpen(true),
      closeComposer: () => setComposerOpen(false),

      runTests: (tests) => {
        setSelected(tests);
        setDetailTest(null);
        setComposerOpen(true);
      },
    }),
    [selected, detailTest, composerOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkbench(): WorkbenchValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkbench must be used within WorkbenchProvider");
  return v;
}
