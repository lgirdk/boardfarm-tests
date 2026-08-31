import { describe, expect, it } from "vitest";
import { buildPayload, validateSpec } from "./codegenInput";

describe("buildPayload", () => {
  it("numbers steps from position and trims fields", () => {
    const payload = buildPayload(
      { name: "  my_test  ", description: "  d  ", preconditions: "" },
      [
        { instruction: " step one ", additional_info: "", expected_result: "ok" },
        { instruction: "step two", additional_info: "note", expected_result: "" },
      ],
    );
    expect(payload.name).toBe("my_test");
    expect(payload.description).toBe("d");
    expect(payload.preconditions).toBeNull(); // empty → null
    expect(payload.steps).toEqual([
      { step_num: 1, instruction: "step one", additional_info: null, expected_result: "ok" },
      { step_num: 2, instruction: "step two", additional_info: "note", expected_result: null },
    ]);
  });
});

describe("validateSpec", () => {
  it("requires a name and at least one step with an instruction", () => {
    const empty = validateSpec({ name: "" }, []);
    expect(empty.canRun).toBe(false);
    expect(empty.metaErrors.name).toBe("Required");
    expect(empty.formError).toMatch(/at least one step/i);

    const noInstruction = validateSpec({ name: "t" }, [{ instruction: "" }]);
    expect(noInstruction.canRun).toBe(false);
    expect(noInstruction.stepErrors[0]?.instruction).toBe("Required");
  });

  it("passes a complete spec", () => {
    const v = validateSpec({ name: "t" }, [{ instruction: "do it" }]);
    expect(v.canRun).toBe(true);
    expect(v.formError).toBeUndefined();
  });
});
