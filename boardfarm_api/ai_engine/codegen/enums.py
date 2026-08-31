from enum import StrEnum


class EntryKind(StrEnum):
    CLASS = "class"
    FUNCTION = "function"
    METHOD = "method"
    PROPERTY = "property"


class IncludeEntryResolveStrategy(StrEnum):
    BY_API_NAMES = "by_names"
    BY_CATEGORY = "by_category"
    BY_REPO = "by_repo"


class CodegenPromptStage(StrEnum):
    REASONING = "reasoning"
    SEARCH_INITIATE = "search_initiate"
    SEARCH_KEEP = "search_keep"
    SEARCH_REMOVE = "search_remove"
    CODEGEN = "codegen"
    REVIEW = "review"


class CodegenPromptVariant(StrEnum):
    STANDARD_BIG_MODELS = (
        "standard"  # Sonnet, GPT-4, Opus — verbose, detailed instructions
    )
    COMPACT_SMALL_MODELS = "compact"  # 14B-27B models — shorter, example-driven


class CodegenOutputType(StrEnum):
    PYTEST = "pytest"
    ROBOT = "robot"


## TODO i will see will need these for  variable validations from custome doman prompts

STAGE_VARIABLES: dict[CodegenPromptStage, set[str]] = {
    CodegenPromptStage.REASONING: {"domain_knowledge", "framework_rules", "input_text"},
    CodegenPromptStage.SEARCH_INITIATE: {
        "analysis",
        "input_text",
        "num_steps",
        "domain_knowledge",
        "framework_rules",
    },
    CodegenPromptStage.SEARCH_KEEP: {
        "analysis",
        "input_text",
        "num_steps",
        "selected_names",
        "new_results",
        "domain_knowledge",
        "framework_rules",
    },
    CodegenPromptStage.SEARCH_REMOVE: {
        "analysis",
        "input_text",
        "num_steps",
        "selected_names",
        "new_results",
        "domain_knowledge",
        "framework_rules",
    },
    CodegenPromptStage.CODEGEN: {
        "analysis",
        "input_text",
        "retrieved_entries",
        "example_test",
        "domain_knowledge",
        "framework_rules",
    },
    CodegenPromptStage.REVIEW: {
        "analysis",
        "input_text",
        "generated_code",
        "validation_errors",
        "framework_rules",
    },
}
