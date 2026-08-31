from __future__ import annotations

from typing import TYPE_CHECKING

from ..data_models import CodegenPromptPair
from ..enums import CodegenOutputType, CodegenPromptStage, CodegenPromptVariant

if TYPE_CHECKING:
    from ..data_models import CodegenDomainSetup, PromptRegistry


class PromptManager:
    def __init__(self)->None:
        self._prompt_registry: PromptRegistry = {}

    def load_prompts(self, domain_setup: CodegenDomainSetup | None = None)->None:
        from .pytest import compact_variant, standard_variant

        compact_variant.register_to(self._prompt_registry)
        standard_variant.register_to(self._prompt_registry)

        if domain_setup:
            self._prompt_registry.update(domain_setup.prompt_overrides)

    def resolve_prompt(
        self,
        *,
        prompt_stage: CodegenPromptStage,
        prompt_variant: CodegenPromptVariant,
        output_type: CodegenOutputType,
    ) -> CodegenPromptPair:
        key = (prompt_variant, prompt_stage, output_type)
        if key not in self._prompt_registry:
            raise KeyError(
                f"No prompt registered for "
                f"variant={prompt_variant.value}, "
                f"stage={prompt_stage.value}, "
                f"output={output_type.value}"
            )
        return self._prompt_registry[key]
