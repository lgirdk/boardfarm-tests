import type { ConfigRecord, FieldDescriptor, PolymorphicSchema } from "./types";
import { validateRecord } from "./toZod";

/** The variant matching the record's current discriminator value, if any. */
export function variantFor(schema: PolymorphicSchema, record: ConfigRecord) {
  const disc = String(record[schema.discriminator] ?? "");
  return schema.variants.find((v) => v.value === disc);
}

/** Fields currently in play: common fields plus the active variant's fields. */
export function activeFields(
  schema: PolymorphicSchema,
  record: ConfigRecord,
): FieldDescriptor[] {
  const variant = variantFor(schema, record);
  return [...schema.common, ...(variant?.fields ?? [])];
}

/**
 * Switch the record to a new variant: keep the discriminator + common + any
 * values whose keys are valid in the new variant; drop keys belonging only to
 * the old variant so stale fields aren't serialized back to TOML.
 */
export function switchVariant(
  schema: PolymorphicSchema,
  record: ConfigRecord,
  newValue: string,
): ConfigRecord {
  const variant = schema.variants.find((v) => v.value === newValue);
  const allowed = new Set([
    schema.discriminator,
    ...schema.common.map((f) => f.key),
    ...(variant?.fields.map((f) => f.key) ?? []),
  ]);
  const next: ConfigRecord = {};
  for (const key of Object.keys(record)) {
    if (allowed.has(key)) next[key] = record[key];
  }
  next[schema.discriminator] = newValue;
  return next;
}

/** Validate a polymorphic record: discriminator presence + active fields. */
export function validatePolymorphic(
  schema: PolymorphicSchema,
  record: ConfigRecord,
): Record<string, string> {
  const disc = String(record[schema.discriminator] ?? "");
  if (!disc) return { [schema.discriminator]: "Required" };
  if (!schema.variants.some((v) => v.value === disc)) {
    return { [schema.discriminator]: "Unknown type" };
  }
  return validateRecord(activeFields(schema, record), record);
}
