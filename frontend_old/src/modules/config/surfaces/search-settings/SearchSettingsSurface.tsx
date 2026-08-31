import { useMemo, useState } from "react";
import { useConfigDoc } from "../../useConfigDoc";
import { SaveBar } from "../../SaveBar";
import { NamedCollectionEditor } from "../../NamedCollectionEditor";
import { RecordForm } from "@/components/RecordForm";
import { validateRecord } from "@/lib/schema/toZod";
import { validateRef, type RefResolver } from "@/lib/schema/crossRefs";
import { getAtPath, setAtPath } from "@/lib/objectPath";
import { cn } from "@/lib/cn";
import { useRegistries } from "@/lib/registries";
import {
  defaultsSchema,
  encoderRefField,
  fullCorpusSchema,
  makeSubCorpusGroupSchema,
  newSubCorpusGroupRecord,
  strategySchema,
} from "@/schemas/search.schema";
import { validateSubCorpusAxes } from "./searchValidation";
import type {
  ConfigRecord,
  EnumOption,
  RefTarget,
} from "@/lib/schema/types";

type NamedMap = Record<string, ConfigRecord>;
type Tab = "settings" | "groups";

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
 * Search Settings surface (codegen/search.toml). The pipeline's own search
 * config — distinct from the Search Store. Loads store_config.toml read-only to
 * offer encoder names for the cross-file `encoder` reference (#1).
 *
 * The sub-corpus `categories` enum options come from the live backend
 * registries so they match what the stub index actually contains.
 */
export function SearchSettingsSurface() {
  const search = useConfigDoc("search");
  const store = useConfigDoc("store"); // read-only here, for encoder ref options
  const { registries } = useRegistries();
  const [tab, setTab] = useState<Tab>("settings");

  // Build the sub-corpus schema from live registries (memoised so children
  // don't re-render when unrelated state changes).
  const subCorpusGroupSchema = useMemo(
    () => makeSubCorpusGroupSchema(registries),
    [registries],
  );

  if (search.loading || !search.working || store.loading || !store.working) {
    return <p className="px-1 py-6 text-sm text-muted">Loading…</p>;
  }

  const working = search.working;
  const encoderKeys = Object.keys(
    (getAtPath(store.working, "encoders") as NamedMap) ?? {},
  );
  const resolver: RefResolver = {
    keysFor: (target) => (target === "store.encoders" ? encoderKeys : []),
  };
  const resolveRefOptions = (target: RefTarget): EnumOption[] =>
    resolver.keysFor(target).map((value) => ({ value }));

  function update(path: string, value: unknown) {
    search.setWorking(setAtPath(working, path, value));
  }

  function sectionForm(path: string, schema: typeof strategySchema) {
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

  const encoderValue = String(getAtPath(working, "encoder") ?? "");
  const encoderError = validateRef(
    encoderValue,
    "store.encoders",
    "encoder",
    resolver,
  );

  return (
    <div className="flex flex-col">
      <header className="mb-5">
        <h2 className="text-base font-semibold">Search (codegen)</h2>
        <p className="mt-1 text-sm text-muted">
          How the codegen pipeline retrieves relevant code stubs
          (configs/codegen/search.toml). This is the pipeline's search config —
          not the separate Search Store.
        </p>
      </header>

      <div className="mb-5 inline-flex gap-1 rounded-md border border-border p-0.5">
        {(
          [
            ["settings", "Settings"],
            ["groups", "Sub-corpus groups"],
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

      {tab === "settings" ? (
        <div className="flex flex-col gap-4">
          <Section title="encoder">
            <RecordForm
              fields={[encoderRefField]}
              record={{ encoder: encoderValue }}
              errors={encoderError ? { encoder: encoderError.message } : {}}
              onChange={(_key, value) => update("encoder", value)}
              resolveRefOptions={resolveRefOptions}
            />
          </Section>
          <Section title="strategy">{sectionForm("strategy", strategySchema)}</Section>
          <Section title="defaults">{sectionForm("defaults", defaultsSchema)}</Section>
          <Section title="full_corpus">
            {sectionForm("full_corpus", fullCorpusSchema)}
          </Section>
        </div>
      ) : (
        <NamedCollectionEditor
          value={(getAtPath(working, "sub_corpus_group") as NamedMap) ?? {}}
          itemSchema={subCorpusGroupSchema}
          keyLabel="group"
          newRecord={newSubCorpusGroupRecord}
          onChange={(next) => update("sub_corpus_group", next)}
          validateExtra={validateSubCorpusAxes}
        />
      )}

      <SaveBar doc={search} fileName="configs/codegen/search.toml" />
    </div>
  );
}
