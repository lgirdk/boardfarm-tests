from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.codegen import PromptRegistry


def register_to(registry: PromptRegistry)->None:
    """Register all standard-variant pytest prompts."""
    from src.codegen import (
        CodegenOutputType as Output,
    )
    from src.codegen import CodegenPromptPair
    from src.codegen import (
        CodegenPromptStage as Stage,
    )
    from src.codegen import (
        CodegenPromptVariant as Variant,
    )

    from .code_generator_prompt import CODEGEN_SYSTEM, CODEGEN_USER
    from .reasoning_prompts import (
        SYSTEM_MINIMAL as REASONING_SYSTEM,
    )
    from .reasoning_prompts import (
        USER as REASONING_USER,
    )
    from .search_agent_prompts import (
        SEARCH_INITIATE_SYSTEM,
        SEARCH_INITIATE_USER,
        SEARCH_STYLE_KEEP_SYSTEM,
        SEARCH_STYLE_KEEP_USER,
        SEARCH_STYLE_REMOVE_SYSTEM,
        SEARCH_STYLE_REMOVE_USER,
    )

    _V = Variant.STANDARD_BIG_MODELS
    _O = Output.PYTEST

    registry[(_V, Stage.REASONING, _O)] = CodegenPromptPair(
        system_prompt=REASONING_SYSTEM, user_prompt=REASONING_USER
    )

    registry[(_V, Stage.SEARCH_INITIATE, _O)] = CodegenPromptPair(
        system_prompt=SEARCH_INITIATE_SYSTEM, user_prompt=SEARCH_INITIATE_USER
    )

    registry[(_V, Stage.SEARCH_KEEP, _O)] = CodegenPromptPair(
        system_prompt=SEARCH_STYLE_KEEP_SYSTEM, user_prompt=SEARCH_STYLE_KEEP_USER
    )

    registry[(_V, Stage.SEARCH_REMOVE, _O)] = CodegenPromptPair(
        system_prompt=SEARCH_STYLE_REMOVE_SYSTEM, user_prompt=SEARCH_STYLE_REMOVE_USER
    )

    registry[(_V, Stage.CODEGEN, _O)] = CodegenPromptPair(
        system_prompt=CODEGEN_SYSTEM, user_prompt=CODEGEN_USER
    )

    # registry[(_V, Stage.REVIEW, _O)] = CodegenPromptPair(
    #     system_prompt=REVIEW_SYSTEM, user_prompt=REVIEW_USER
    # )
