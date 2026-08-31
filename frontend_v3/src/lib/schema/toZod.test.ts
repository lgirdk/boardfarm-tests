import { describe, expect, it } from "vitest";
import { validateRecord } from "./toZod";
import { llmItemSchema } from "@/schemas/app.schema";
import type { FieldDescriptor } from "./types";

describe("validateRecord (LLM schema)", () => {
  it("accepts a valid anthropic entry", () => {
    const errors = validateRecord(llmItemSchema.fields, {
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      api_key_env: "ANTHROPIC_API_KEY",
    });
    expect(errors).toEqual({});
  });

  it("flags a missing required model", () => {
    const errors = validateRecord(llmItemSchema.fields, {
      provider: "anthropic",
      model: "",
    });
    expect(errors.model).toBe("Required");
  });

  it("validates the endpoint URL format (always shown; empty is allowed)", () => {
    const bad = validateRecord(llmItemSchema.fields, {
      provider: "openai",
      model: "gpt-4o",
      endpoint: "not a url",
    });
    expect(bad.endpoint).toBe("Must be a valid URL");

    const good = validateRecord(llmItemSchema.fields, {
      provider: "anthropic",
      model: "claude",
      endpoint: "", // optional — anthropic leaves it blank
    });
    expect(good.endpoint).toBeUndefined();
  });

  it("rejects a malformed env-var name", () => {
    const errors = validateRecord(llmItemSchema.fields, {
      provider: "anthropic",
      model: "claude",
      api_key_env: "lower case",
    });
    expect(errors.api_key_env).toMatch(/UPPER_SNAKE_CASE/);
  });
});

describe("validateRecord (numeric + enum primitives)", () => {
  const fields: FieldDescriptor[] = [
    { kind: "int", key: "k", label: "K", required: true, min: 1, max: 10 },
    {
      kind: "enum",
      key: "mode",
      label: "Mode",
      required: true,
      options: [{ value: "a" }, { value: "b" }],
    },
  ];

  it("enforces integer bounds", () => {
    expect(validateRecord(fields, { k: 0, mode: "a" }).k).toMatch(/≥ 1/);
    expect(validateRecord(fields, { k: 11, mode: "a" }).k).toMatch(/≤ 10/);
    expect(validateRecord(fields, { k: 5, mode: "a" }).k).toBeUndefined();
  });

  it("rejects an out-of-set enum value", () => {
    expect(validateRecord(fields, { k: 5, mode: "z" }).mode).toBe(
      "Not an allowed value",
    );
  });
});

describe("validateRecord (visibleWhen)", () => {
  const fields: FieldDescriptor[] = [
    {
      kind: "enum",
      key: "kind",
      label: "Kind",
      required: true,
      options: [{ value: "a" }, { value: "b" }],
    },
    {
      kind: "string",
      key: "extra",
      label: "Extra",
      required: true,
      visibleWhen: (r) => r.kind === "b",
    },
  ];

  it("skips validation of a hidden field", () => {
    // `extra` is hidden when kind === "a", so its missing required value is ignored
    expect(validateRecord(fields, { kind: "a", extra: "" })).toEqual({});
  });

  it("validates the field once it becomes visible", () => {
    expect(validateRecord(fields, { kind: "b", extra: "" }).extra).toBe("Required");
  });
});
