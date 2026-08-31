import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { registriesClient } from "./index";
import { REGISTRIES_SEED } from "./seed";
import type { Registries } from "./RegistriesClient";

/**
 * Wraps the active RegistriesClient in a React context so the catalog is
 * fetched once at app start and consumed via useRegistries() everywhere it's
 * needed (LLM surface, encoders, search settings, codegen schema, …).
 *
 * Failure mode: on fetch error, the seeded mock data is used as a fallback
 * and a non-blocking banner is shown (the banner is rendered by the consumer
 * via `useRegistries().error`). This lets the UI stay usable even when the
 * backend is unreachable mid-session.
 */

interface RegistriesContextValue {
  /** Loaded catalog (or the seeded fallback if the fetch failed). */
  registries: Registries;
  /** True while the initial fetch is in flight. */
  loading: boolean;
  /** Populated when the fetch failed and the seeded fallback is being used. */
  error: string | null;
  /** Force a refresh (e.g. after the backend restarts). */
  refresh: () => Promise<void>;
}

const RegistriesContext = createContext<RegistriesContextValue | null>(null);

export interface RegistriesProviderProps {
  children: ReactNode;
  /** Optional override for tests. Defaults to the active client. */
  client?: { fetch: () => Promise<Registries> };
}

export function RegistriesProvider({
  children,
  client = registriesClient,
}: RegistriesProviderProps) {
  const [registries, setRegistries] = useState<Registries>(REGISTRIES_SEED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const active = { current: true };

    async function load() {
      try {
        const data = await client.fetch();
        if (!active.current) return;
        setRegistries(data);
        setError(null);
      } catch (e) {
        if (!active.current) return;
        // Keep the seeded fallback already in state; surface the error.
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active.current) setLoading(false);
      }
    }

    void load();
    return () => {
      active.current = false;
    };
  }, [client]);

  const value = useMemo<RegistriesContextValue>(
    () => ({
      registries,
      loading,
      error,
      refresh: async () => {
        setLoading(true);
        try {
          const data = await client.fetch();
          setRegistries(data);
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setLoading(false);
        }
      },
    }),
    [registries, loading, error, client],
  );

  return (
    <RegistriesContext.Provider value={value}>
      {children}
    </RegistriesContext.Provider>
  );
}

/** Access the loaded registries. Throws if used outside the provider. */
export function useRegistries(): RegistriesContextValue {
  const ctx = useContext(RegistriesContext);
  if (!ctx) {
    throw new Error("useRegistries must be used inside <RegistriesProvider>");
  }
  return ctx;
}
