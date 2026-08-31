from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .data_models import (
        CodeGenContext,
        CodegenDomainSetup,
        CodegenPromptPair,
        ResolvedStage,
    )


def generate_code(
    stage_config: ResolvedStage,
    context: CodeGenContext,
    prompt_pair: CodegenPromptPair,
    domain_setup: CodegenDomainSetup,
    selected_rule_names: list[str] | None = None,
) -> str:
    """Generate code from assembled context using the resolved prompt pair.

    ``selected_rule_names`` — dynamic rule names chosen by the skill selector.
    When provided, ``{framework_rules}`` in the prompt is replaced by the
    static framework rules combined with the content of the selected rules.
    When absent (or empty), the static framework rules are used unchanged.
    """
    variables: dict[str, str] = {
        "analysis": context.analysis,
        "input_text": context.input_object.full_prompt_text,
        "retrieved_entries": "\n\n".join(context.retrieved_entries),
        "example_test": context.example_test or "No example available.",
        **domain_setup.domain_context_data,  # type: ignore[dict-item]
    }

    # If dynamic rules were selected, override the static framework_rules
    # with the enriched version (static + selected dynamic rule content).
    if selected_rule_names:
        variables["framework_rules"] = domain_setup.compose_dynamic_rules(selected_rule_names)

    system = prompt_pair.format_system(**variables)
    user = prompt_pair.format_user(**variables)

    response = stage_config.llm.call(
        system=system,
        user=user,
        settings=stage_config.settings,
    )
    return response
