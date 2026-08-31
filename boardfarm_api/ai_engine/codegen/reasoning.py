from __future__ import annotations

from typing import TYPE_CHECKING

from .enums import CodegenPromptStage

# from .prompt.reasioning_prompts import SYSTEM_MINIMAL as SYSTEM_PROMPT ,USER  as USER_TEMPLATE
from .prompt.prompt_utils import PromptManager

if TYPE_CHECKING:
    from .data_models import CodegenDomainSetup, CodegenInput, ResolvedStage
    from .enums import CodegenOutputType
    from .prompt.prompt_utils import PromptManager


def run_reasoning(
    stage_config: ResolvedStage,
    input_: CodegenInput,
    prompt_manager: PromptManager,
    output_task_type: CodegenOutputType,
    domain_setup: CodegenDomainSetup,
    max_retries: int = 1,
) -> str:
    # SETTINGS = LLMCallSettings(temperature=0.7, max_tokens=1090)
    prompt_pair = prompt_manager.resolve_prompt(
        prompt_stage=CodegenPromptStage.REASONING,
        prompt_variant=stage_config.prompt_variant,
        output_type=output_task_type,
    )

    system = prompt_pair.format_system(domain_knowledge=domain_setup.domain_knowledge)
    user = prompt_pair.format_user(input_text=input_.full_prompt_text)
    for _ in range(max_retries + 1):
        response = stage_config.llm.call(
            system=system, user=user, settings=stage_config.settings
        )
        return str(response)

        # issues = _validate(response, test_steps) # TODO this is fragile . need to update
        # if not issues:
        #     return response

    # Validation failed after retries — return anyway with warning
    return response


def _validate(reasoning_text: str, test_steps: str) -> list:
    issues = []

    if not reasoning_text or len(reasoning_text.split()) < 50:
        issues.append("Reasoning too short or empty")
        return issues

    for i, step in enumerate(test_steps):
        step_num = i + 1
        step_mentioned = (
            f"step {step_num}" in reasoning_text.lower()
            or f"step{step_num}" in reasoning_text.lower()
        )
        if not step_mentioned:
            step_words = set(step.lower().split())
            reasoning_words = set(reasoning_text.lower().split())
            overlap = step_words.intersection(reasoning_words)
            if len(overlap) < 3:
                issues.append(f"Step {step_num} may not be covered")

    step_text = " ".join(test_steps).lower()
    reasoning_only_words = set(reasoning_text.lower().split()) - set(step_text.split())
    if len(reasoning_only_words) < 30:
        issues.append("Reasoning may be too generic")

    return issues
