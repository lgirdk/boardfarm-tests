import { useCallback, useEffect, useMemo, useState } from "react";
import {
  persistence,
  type ConfigDoc,
  type ConfigFileId,
  type SaveResult,
} from "@/lib/persistence";
import { serializeToml } from "@/lib/toml";

export interface UseConfigDoc {
  original: ConfigDoc | null;
  working: ConfigDoc | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  /** Serialized TOML of original/working — used for the pre-save diff. */
  beforeToml: string;
  afterToml: string;
  setWorking: (next: ConfigDoc) => void;
  reset: () => void;
  save: () => Promise<SaveResult>;
}

/**
 * Loads one config file into an editable working copy and tracks dirty state by
 * comparing serialized TOML (semantic, order-stable). Shared by every config
 * surface so load/edit/diff/save behave identically.
 */
export function useConfigDoc(file: ConfigFileId): UseConfigDoc {
  const [original, setOriginal] = useState<ConfigDoc | null>(null);
  const [working, setWorking] = useState<ConfigDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    persistence.load(file).then((doc) => {
      if (!active) return;
      setOriginal(doc);
      setWorking(structuredClone(doc));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [file]);

  const beforeToml = useMemo(
    () => (original ? serializeToml(original) : ""),
    [original],
  );
  const afterToml = useMemo(
    () => (working ? serializeToml(working) : ""),
    [working],
  );
  const dirty = beforeToml !== afterToml;

  const reset = useCallback(() => {
    setWorking(original ? structuredClone(original) : null);
  }, [original]);

  const save = useCallback(async (): Promise<SaveResult> => {
    if (!working) return { ok: false };
    setSaving(true);
    try {
      const result = await persistence.save(file, working);
      if (result.ok) setOriginal(structuredClone(working));
      return result;
    } finally {
      setSaving(false);
    }
  }, [file, working]);

  return {
    original,
    working,
    loading,
    saving,
    dirty,
    beforeToml,
    afterToml,
    setWorking,
    reset,
    save,
  };
}
