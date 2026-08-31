import { z } from "zod";
import type { ConfigRecord, FieldDescriptor } from "./types";

/**
 * Derives a zod validator from a single field descriptor. This drives INSTANT,
 * client-side UX feedback only. Pydantic remains the authoritative gate on real
 * save — we deliberately keep one source of truth for record validation and use
 * zod purely for fast inline hints.
 */
export function fieldToZod(field: FieldDescriptor): z.ZodTypeAny {
  switch (field.kind) {
    case "string":
    case "ref": {
      let schema: z.ZodTypeAny = z.string();
      if (field.kind === "string") {
        if (field.format === "url") {
          schema = schema.refine(
            (v) => v === "" || isUrl(v),
            "Must be a valid URL",
          );
        } else if (field.format === "module-attr") {
          schema = schema.refine(
            (v) => v === "" || /^[\w.]+:[\w]+$/.test(v),
            'Must be "module.path:attribute"',
          );
        } else if (field.format === "env-var") {
          schema = schema.refine(
            (v) => v === "" || /^[A-Z_][A-Z0-9_]*$/.test(v),
            "Must be an UPPER_SNAKE_CASE env var name",
          );
        }
      }
      if (field.required) {
        schema = schema.refine(
          (v) => typeof v === "string" && v.length > 0,
          "Required",
        );
      }
      return schema;
    }

    case "int": {
      let n = z.number({ invalid_type_error: "Must be a number" }).int("Must be an integer");
      if (field.min !== undefined) n = n.min(field.min, `Must be ≥ ${field.min}`);
      if (field.max !== undefined) n = n.max(field.max, `Must be ≤ ${field.max}`);
      return n;
    }

    case "float": {
      let n = z.number({ invalid_type_error: "Must be a number" });
      if (field.min !== undefined) n = n.min(field.min, `Must be ≥ ${field.min}`);
      if (field.max !== undefined) n = n.max(field.max, `Must be ≤ ${field.max}`);
      return n;
    }

    case "bool":
      return z.boolean();

    case "enum": {
      const values = field.options.map((o) => o.value);
      const e = z.string().refine(
        (v) => v === "" || values.includes(v),
        "Not an allowed value",
      );
      return field.required ? e.refine((v) => v !== "", "Required") : e;
    }

    case "list": {
      const arr = z.array(z.string());
      return field.required ? arr.min(1, "Add at least one") : arr;
    }
  }
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a record against its visible fields, returning a map of
 * fieldKey → error message (empty when valid). Hidden fields (visibleWhen ===
 * false) are skipped so conditional fields don't block save.
 */
export function validateRecord(
  fields: FieldDescriptor[],
  record: ConfigRecord,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.visibleWhen && !field.visibleWhen(record)) continue;
    const value = record[field.key];
    // An absent optional field is valid; only required fields error on absence.
    if (value === undefined && !field.required) continue;
    const result = fieldToZod(field).safeParse(value);
    if (!result.success) {
      errors[field.key] = result.error.issues[0]?.message ?? "Invalid";
    }
  }
  return errors;
}
