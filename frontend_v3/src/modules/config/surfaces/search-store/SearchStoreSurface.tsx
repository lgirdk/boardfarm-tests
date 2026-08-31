import { useMemo, useState } from "react";
import { useConfigDoc } from "../../useConfigDoc";
import { SaveBar } from "../../SaveBar";
import { NamedCollectionEditor } from "../../NamedCollectionEditor";
import { RecordForm } from "@/components/RecordForm";
import { validateRecord } from "@/lib/schema/toZod";
import { getAtPath, setAtPath } from "@/lib/objectPath";
import { cn } from "@/lib/cn";
import { useRegistries } from "@/lib/registries";
import {
  encoderSchema,
  filtersSchema,
  newEncoderRecord,
  storeRootSchema,
  stubRegistrySchema,
} from "@/schemas/store.schema";
import type { ConfigRecord, ObjectSchema } from "@/lib/schema/types";

type NamedMap = Record<string, ConfigRecord>;
type Tab = "store" | "encoders" | "filters";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-surface-raised/40 p-4">
      <h3 className="mb-3 font-mono text-sm text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Search Store surface (search_store/store_config.toml) — the separate store
 * config: artifact paths, the polymorphic encoder registry, and corpus filters.
 *
 * Encoder TYPES and filter NAMES come from the live backend registries; the UI
 * surfaces a warning if the backend reports a type/name the UI doesn't have a
 * variant for (means the frontend hasn't been updated to render it).
 */
export function SearchStoreSurface() {
  const store = useConfigDoc("store");
  const { registries } = useRegistries();
  const [tab, setTab] = useState<Tab>("store");

  // Cross-check: encoder types the backend knows about vs the variants the UI
  // has rendering support for.
  const encoderTypeMismatch = useMemo(() => {
    const uiKnown = new Set(encoderSchema.variants.map((v) => v.value));
    return registries.encoder_types.filter((t) => !uiKnown.has(t));
  }, [registries.encoder_types]);

  // Same for filters — they're a fixed set in the file, but if the backend adds
  // a new filter type the frontend doesn't render it.
  const filterMismatch = useMemo(() => {
    const uiKnown = new Set(filtersSchema.fields.map((f) => f.key));
    return registries.search_filters.filter((f) => !uiKnown.has(f));
  }, [registries.search_filters]);

  if (store.loading || !store.working) {
    return <p className="px-1 py-6 text-sm text-muted">Loading…</p>;
  }

  const working = store.working;

  function update(path: string, value: unknown) {
    store.setWorking(setAtPath(working, path, value));
  }

  function sectionForm(path: string, schema: ObjectSchema) {
    const record = (getAtPath(working, path) as ConfigRecord) ?? {};
    return (
      <RecordForm
        fields={schema.fields}
        record={record}
        errors={validateRecord(schema.fields, record)}
        onChange={(key, value) => update(`${path}.${key}`, value)}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <header className="mb-5">
        <h2 className="text-base font-semibold">Search Store</h2>
        <p className="mt-1 text-sm text-muted">
          The search store config (search_store/store_config.toml): artifact
          paths, the encoder registry, and corpus filters.
        </p>
      </header>

      {tab === "encoders" && encoderTypeMismatch.length > 0 && (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Backend supports encoder type(s) the UI cannot edit yet:{" "}
          {encoderTypeMismatch.map((t) => (
            <code key={t} className="ml-1 font-mono">
              {t}
            </code>
          ))}
        </div>
      )}

      {tab === "filters" && filterMismatch.length > 0 && (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Backend supports filter(s) the UI cannot edit yet:{" "}
          {filterMismatch.map((f) => (
            <code key={f} className="ml-1 font-mono">
              {f}
            </code>
          ))}
        </div>
      )}

      <div className="mb-5 inline-flex gap-1 rounded-md border border-border p-0.5">
        {(
          [
            ["store", "Store"],
            ["encoders", "Encoders"],
            ["filters", "Filters"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded px-3 py-1.5 text-sm transition",
              tab === t
                ? "bg-accent/15 text-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "store" && (
        <div className="flex flex-col gap-4">
          <Section title="store">{sectionForm("store", storeRootSchema)}</Section>
          <Section title="store.stub_registry">
            {sectionForm("store.stub_registry", stubRegistrySchema)}
          </Section>
        </div>
      )}

      {tab === "encoders" && (
        <NamedCollectionEditor
          value={(getAtPath(working, "encoders") as NamedMap) ?? {}}
          itemSchema={encoderSchema}
          keyLabel="encoder"
          newRecord={newEncoderRecord}
          onChange={(next) => update("encoders", next)}
        />
      )}

      {tab === "filters" && (
        <Section title="filters">{sectionForm("filters", filtersSchema)}</Section>
      )}

      <SaveBar doc={store} fileName="configs/search_store/store_config.toml" />
    </div>
  );
}
