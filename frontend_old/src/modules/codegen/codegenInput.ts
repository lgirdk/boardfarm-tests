import type { ConfigRecord, ObjectSchema } from "@/lib/schema/types";
import { validateRecord } from "@/lib/schema/toZod";
import type { CodegenGenerateInput } from "@/lib/contracts";

/**
 * Form schema + payload mapping for the Codegen input (CodegenGenerateInput).
 * The scalar spec fields reuse the generic form engine; steps are an ordered
 * list of structured records edited by StepsEditor.
 */

/** name / description / preconditions. */
export const specMetaSchema: ObjectSchema = {
  kind: "object",
  fields: [
    {
      kind: "string",
      key: "name",
      label: "Test name",
      required: true,
      placeholder: "verify_wan_ipv4_connectivity",
      description: "A short identifier for the generated test.",
    },
    {
      kind: "string",
      key: "description",
      label: "Description",
      multiline: true,
      description: "Optional summary of what the test verifies.",
    },
    {
      kind: "string",
      key: "preconditions",
      label: "Preconditions",
      multiline: true,
      description: "Optional setup/state required before the steps run.",
    },
  ],
};

/** One step (TestStep) — `step_num` is assigned from position at submit time. */
export const stepSchema: ObjectSchema = {
  kind: "object",
  fields: [
    {
      kind: "string",
      key: "instruction",
      label: "Instruction",
      required: true,
      multiline: true,
      placeholder: "Bring up the WAN interface and acquire an IPv4 lease",
      description: "What this step does.",
    },
    {
      kind: "string",
      key: "additional_info",
      label: "Additional info",
      description: "Optional extra context for this step.",
    },
    {
      kind: "string",
      key: "expected_result",
      label: "Expected result",
      description: "Optional expected outcome of this step.",
    },
  ],
};

export function newStep(): ConfigRecord {
  return { instruction: "", additional_info: "", expected_result: "" };
}

function trimOrNull(value: unknown): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s === "" ? null : s;
}

/**
 * Map form state → the CodegenGenerateInput payload: trims fields, drops empty
 * optionals to null, and numbers steps 1..n from their position.
 */
export function buildPayload(
  meta: ConfigRecord,
  steps: ConfigRecord[],
): CodegenGenerateInput {
  return {
    name: String(meta.name ?? "").trim(),
    description: trimOrNull(meta.description),
    preconditions: trimOrNull(meta.preconditions),
    steps: steps.map((s, i) => ({
      step_num: i + 1,
      instruction: String(s.instruction ?? "").trim(),
      additional_info: trimOrNull(s.additional_info),
      expected_result: trimOrNull(s.expected_result),
    })),
  };
}

export interface SpecValidation {
  metaErrors: Record<string, string>;
  stepErrors: Record<string, string>[];
  /** Form-level problem (e.g. no steps) shown near the Run button. */
  formError?: string;
  canRun: boolean;
}

/** Validate the whole spec for the Run button (UX gate; backend is authoritative). */
export function validateSpec(
  meta: ConfigRecord,
  steps: ConfigRecord[],
): SpecValidation {
  const metaErrors = validateRecord(specMetaSchema.fields, meta);
  const stepErrors = steps.map((s) => validateRecord(stepSchema.fields, s));

  let formError: string | undefined;
  if (steps.length === 0) formError = "Add at least one step.";

  const hasErrors =
    Object.keys(metaErrors).length > 0 ||
    stepErrors.some((e) => Object.keys(e).length > 0) ||
    formError !== undefined;

  return { metaErrors, stepErrors, formError, canRun: !hasErrors };
}
