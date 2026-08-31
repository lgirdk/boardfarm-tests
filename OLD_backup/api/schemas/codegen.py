from pydantic import BaseModel, StrictStr,ConfigDict
from src.codegen.data_models import CodegenInput

class GenerateResponseSchema(BaseModel):
    status: str
    generated_code: StrictStr


class _TestStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    step_num: int
    instruction: str
    additional_info: str | None = None
    expected_result: str | None = None


class CodegenJiraTestInputSchema(CodegenInput):
    """Structured test steps — from Jira/Xray."""

    description: str | None = None
    preconditions: str | None = None
    steps: list[_TestStep]

    @property
    def formatted_steps(self) -> str:
        lines = []
        for step in self.steps:
            lines.append(f"Step {step.step_num}: {step.instruction}")
            if step.additional_info:
                lines.append(f"  - Additional Info: {step.additional_info}")
            if step.expected_result:
                lines.append(f"  - Expected Result: {step.expected_result}")
        return "\n".join(lines)

    @property
    def full_prompt_text(self) -> str:
        lines = []
        if self.name:
            lines.append(f"TEST NAME: {self.name}")
        if self.description:
            lines.append(f"DESCRIPTION: {self.description}")
        if self.preconditions:
            lines.append(f"PRECONDITIONS: {self.preconditions}")
        lines.append(f"TEST STEPS:\n{self.formatted_steps}")
        return "\n\n".join(lines)

    @property
    def raw_search_texts(self) -> list[str]:
        return [step.instruction for step in self.steps]


class CodegenTextInput(CodegenInput):
    """Plain text specification — no structured steps."""

    text: str

    @property
    def full_prompt_text(self) -> str:
        return f"TASK: {self.name}\n\n{self.text}"

    @property
    def raw_search_texts(self) -> list[str]:
        return [self.text]
