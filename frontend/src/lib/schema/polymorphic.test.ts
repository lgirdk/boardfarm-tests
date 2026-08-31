import { describe, expect, it } from "vitest";
import { activeFields, switchVariant, validatePolymorphic } from "./polymorphic";
import { encoderSchema, newEncoderRecord } from "@/schemas/store.schema";

describe("encoder polymorphic schema", () => {
  it("exposes only the active variant's fields", () => {
    const st = activeFields(encoderSchema, {
      encoder_type: "sentence_transformer",
    }).map((f) => f.key);
    expect(st).toContain("model_path");
    expect(st).not.toContain("api_key_env");

    const openai = activeFields(encoderSchema, { encoder_type: "openai" }).map(
      (f) => f.key,
    );
    expect(openai).toContain("api_key_env");
    expect(openai).not.toContain("model_path");
  });

  it("validates the active variant's required fields", () => {
    const ok = validatePolymorphic(encoderSchema, {
      encoder_type: "openai",
      model: "text-embedding-3-small",
      api_key_env: "OPENAI_API_KEY",
    });
    expect(ok).toEqual({});

    const missing = validatePolymorphic(encoderSchema, {
      encoder_type: "openai",
      model: "x",
    });
    expect(missing.api_key_env).toBe("Required");
  });

  it("errors on a missing or unknown discriminator", () => {
    expect(validatePolymorphic(encoderSchema, {}).encoder_type).toBe("Required");
    expect(
      validatePolymorphic(encoderSchema, { encoder_type: "nope" }).encoder_type,
    ).toBe("Unknown type");
  });

  it("prunes stale keys when switching variant", () => {
    const start = newEncoderRecord(); // sentence_transformer with model_path etc.
    const switched = switchVariant(encoderSchema, start, "openai");
    expect(switched.encoder_type).toBe("openai");
    expect("model_path" in switched).toBe(false);
    expect("batch_size" in switched).toBe(false);
  });
});
