/**
 * Schema-as-data: the types here describe each config surface declaratively
 * (keys, types, help text, cross-file references). The generic form engine
 * renders any descriptor, so adding a field is a data change, not a JSX change.
 *
 * Help text (`description`) is lifted from the load-bearing TOML comments.
 */
import type { ConfigFileId } from "@/lib/persistence/PersistenceAdapter";

export type FieldKind =
  | "string"
  | "int"
  | "float"
  | "bool"
  | "enum"
  | "list"
  | "ref";

/** A single record's worth of values (one `[table.<name>]` entry, or one table). */
export type ConfigRecord = Record<string, unknown>;

interface BaseField {
  /** TOML key. */
  key: string;
  label: string;
  /** Help text — sourced from TOML comments, surfaced in the form. */
  description?: string;
  required?: boolean;
  /**
   * Read-only display. The value is shown but cannot be edited — used for fields
   * that are documentation/derived rather than user-controlled (e.g. an LLM's
   * backing client implementation).
   */
  readOnly?: boolean;
  /**
   * Conditional visibility. Receives the current record; return false to hide.
   */
  visibleWhen?: (record: ConfigRecord) => boolean;
}

export interface StringField extends BaseField {
  kind: "string";
  /** Lightweight shape hint used by toZod for UX validation. */
  format?: "url" | "module-attr" | "env-var" | "path";
  placeholder?: string;
  /** Render a multi-line textarea instead of a single-line input. */
  multiline?: boolean;
}

export interface NumberField extends BaseField {
  kind: "int" | "float";
  min?: number;
  max?: number;
}

export interface BoolField extends BaseField {
  kind: "bool";
  default?: boolean;
}

export interface EnumOption {
  value: string;
  label?: string;
}

export interface EnumField extends BaseField {
  kind: "enum";
  options: EnumOption[];
}

export interface ListField extends BaseField {
  kind: "list";
  itemKind: "string" | "enum";
  /** Constrained values when itemKind === "enum" (e.g. the known categories). */
  options?: EnumOption[];
  /** Order is meaningful — render a reorderable control (e.g. repo_priority_order). */
  ordered?: boolean;
}

/**
 * Cross-file reference. The value must match a key in another file's collection.
 * Validated client-side now (crossRefs.ts) and authoritatively by Pydantic later.
 */
export interface RefField extends BaseField {
  kind: "ref";
  /** Logical id of the target collection, e.g. "store.encoders", "app.llm". */
  refTarget: RefTarget;
}

export type RefTarget = "app.llm" | "store.encoders" | "codegen.profiles";

export type FieldDescriptor =
  | StringField
  | NumberField
  | BoolField
  | EnumField
  | ListField
  | RefField;

/** A flat group of fields = one TOML table. */
export interface ObjectSchema {
  kind: "object";
  fields: FieldDescriptor[];
}

/**
 * A discriminated set of field groups, e.g. `[encoders.<name>]` whose fields
 * switch on `encoder_type`. (Type defined now; rendered in a later chunk.)
 */
export interface PolymorphicSchema {
  kind: "polymorphic";
  discriminator: string;
  /** Fields present regardless of variant (incl. the discriminator control). */
  common: FieldDescriptor[];
  variants: Array<{ value: string; label: string; fields: FieldDescriptor[] }>;
}

export type ItemSchema = ObjectSchema | PolymorphicSchema;

/** A dynamic, named collection: `[table.<name>]` mapping name → item. */
export interface NamedCollectionSchema {
  kind: "named-collection";
  /** Human label for the key, e.g. "LLM name", "Encoder name". */
  keyLabel: string;
  item: ItemSchema;
}

export type SurfaceSchema = ObjectSchema | NamedCollectionSchema | PolymorphicSchema;

/** Top-level descriptor for one editable config surface. */
export interface ConfigSurface {
  id: string;
  /** Which TOML file this surface reads/writes. */
  file: ConfigFileId;
  /** Dotted path within the file this surface owns, e.g. "llm". "" = whole file. */
  path: string;
  title: string;
  description?: string;
  schema: SurfaceSchema;
}
