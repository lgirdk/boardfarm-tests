from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field, fields
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, Self

import yaml

from src.lib_utils import split_frontmatter

from .exceptions import RuleNameCollision

_LOG = logging.getLogger(__name__)


from pydantic import BaseModel, ConfigDict

from .enums import (
    CodegenOutputType,
    CodegenPromptStage,
    CodegenPromptVariant,
    EntryKind,
    IncludeEntryResolveStrategy,
)
from .exceptions import IncludeEntryConfigChainError
from .protocols import ForceIncludeEntryHook, PostSearchEnricherHook

if TYPE_CHECKING:
    from src.llm.data_containers import LLMCallSettings
    from src.llm.templates import LLMClientTemplate

    from .config_schema import CodegenSearchSettings


class _SafeDict(dict):
    """Returns placeholder unchanged if key not provided."""

    def __missing__(self, key: str | int) -> str:
        return f"{{{key}}}"


class IncludeEntry:
    __slots__ = (
        "_api_names",
        "_belongs_to_class",
        "_category",
        "_kind",
        "_repo",
        "_strategy",
    )

    def __init__(
        self,
        *,
        _strategy: IncludeEntryResolveStrategy,
        _api_names: tuple[str, ...] | None = None,
        _category_name: str | None = None,
        _repo: str | None = None,
    ):
        self._api_names = _api_names
        self._category = _category_name
        self._repo = _repo
        self._kind: EntryKind | None = None
        self._belongs_to_class: str | None = None
        self._strategy: IncludeEntryResolveStrategy = _strategy

    @property
    def api_names(self) -> tuple[str, ...]:
        if self._api_names is None:
            return ()
        return self._api_names

    @property
    def category(self) -> str | None:
        return self._category

    @property
    def repo(self) -> str | None:
        return self._repo

    @property
    def entry_type(self) -> EntryKind | None:
        return self._kind

    @property
    def strategy(self) -> IncludeEntryResolveStrategy:
        return self._strategy

    @property
    def parent_class(self) -> str | None:
        return self._belongs_to_class

    # entry points

    @classmethod
    def by_api_names(cls, *names: str) -> Self:
        return cls(_api_names=names, _strategy=IncludeEntryResolveStrategy.BY_API_NAMES)

    @classmethod
    def by_category(cls, name: str) -> Self:
        return cls(
            _category_name=name, _strategy=IncludeEntryResolveStrategy.BY_CATEGORY
        )

    @classmethod
    def by_repo(cls, name: str) -> Self:
        return cls(_repo=name, _strategy=IncludeEntryResolveStrategy.BY_REPO)

    @classmethod
    def by_module(cls, path: str) -> Self:
        raise NotImplementedError("thinking .......")

    # build on top of the entrypoint

    def of_type(self, kind: EntryKind) -> Self:
        self._kind = kind
        return self

    def in_category(self, name: str) -> Self:
        if self.category:
            raise IncludeEntryConfigChainError(
                "Cannot chain a category inside a by_category"
            )

        self._category = name
        return self

    def in_repo(self, name: str) -> Self:
        if self.repo:
            raise IncludeEntryConfigChainError("Cannot chain a repo inside a by_repo.")
        self._repo = name
        return self

    def belongs_to_class(self, name: str) -> Self:
        if self._kind not in (EntryKind.PROPERTY, EntryKind.METHOD):
            raise IncludeEntryConfigChainError(
                "Set the of_kind to METHOD OR PROPERTY  before assigning a parent."
            )
        self._belongs_to_class = name
        return self

    def __repr__(self) -> str:
        parts = []
        if self._api_names:
            parts.append(f"api_names={self._api_names}")
        if self._category:
            parts.append(f"category={self._category!r}")
        if self._repo:
            parts.append(f"repo={self._repo!r}")
        if self._kind:
            parts.append(f"kind={self._kind}")
        return f"IncludeEntry({', '.join(parts)})"

    # def __eq__(self, other):
    #     if not isinstance(other, EntryRequirement):
    #         return NotImplemented
    #     return (self._api_name, self._category, self._kind, self._repo) == \
    #            (other._api_name, other._category, other._kind, other._repo)

    # def __hash__(self):
    #     return hash((self._api_name, self._category, self._kind, self._repo))


##################### INPUT MODELS ##########################
class CodegenInput(BaseModel):
    """Base input to the codegen pipeline.
    Subclass and implement full_prompt_text and raw_search_texts."""

    model_config = ConfigDict(extra="forbid")

    name: str

    @property
    def full_prompt_text(self) -> str:
        raise NotImplementedError("Subclass must implement full_prompt_text")

    @property
    def raw_search_texts(self) -> list[str]:
        raise NotImplementedError("Subclass must implement raw_search_texts")


###################################################3


@dataclass
class CodeGenContext:
    input_object: CodegenInput
    analysis: str
    retrieved_entries: list[
        str
    ]  # one field, dynamically assembled with [category] tags
    example_test: str
    all_import_paths: list[str] = field(default_factory=list)
    all_function_names: list[str] = field(default_factory=list)


@dataclass
class ResolvedStage:
    llm: LLMClientTemplate
    settings: LLMCallSettings
    prompt_variant: CodegenPromptVariant


@dataclass
class ResolvedPipeline:
    reasoning: ResolvedStage
    search: ResolvedStage
    generation: ResolvedStage

    @classmethod
    def stage_names(cls) -> set[str]:
        names = [f.name for f in fields(cls)]
        return set(names)


@dataclass
class SearchSelectionResult:
    selected_index: set[int]
    selected_doc: list[str]
    visited_index: set[int]
    missing: list = field(default_factory=list)


_PLACEHOLDER = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def _safe_format(template: str, values: dict[str, str]) -> str:
    """Substitute {placeholder} tokens with values from the dict.

    Only matches placeholders that are valid Python identifiers.
    JSON, code blocks, and any non-identifier content inside braces
    is left untouched. Unknown placeholders are preserved as-is.
    """

    def _replacer(match: re.Match[str]) -> str:
        key = match.group(1)
        if key in values:
            return str(values[key])
        return match.group(0)

    return _PLACEHOLDER.sub(_replacer, template)


@dataclass
class CodegenPromptPair:
    """A matched system and user prompt template for a single pipeline stage."""

    system_prompt: str
    user_prompt: str

    def format_system(self, **values: Any) -> str:
        # safe  = _SafeDict(**values)
        return _safe_format(self.system_prompt, values)
        # return self.system_prompt.format_map(safe)

    def format_user(self, **values: Any) -> str:
        # safe  = _SafeDict(**values)
        return _safe_format(self.user_prompt, values)
        # return self.user_prompt.format_map(safe)


############################################### Domain setup ########################################

type PromptRegistry = dict[
    tuple[CodegenPromptVariant, CodegenPromptStage, CodegenOutputType],
    CodegenPromptPair,
]


class ForceIncludeEntryHooksRegistry:
    """Collects pre-search hooks that inject entries based on input analysis.

    Use when hooks are spread across multiple files and need to be
    aggregated before passing to CodegenDomainSetup.

    Usage::

        pre_hooks = ForceIncludeEntryHooksRegistry(
            "boardfarm_pre_search"
        )


        @pre_hooks.register
        def add_all_fixtures(
            analysis: str, input_text: str
        ) -> list[IncludeEntry]:
            results = []
            results.append(IncludeEntry.by_category("fixtures"))
            return results


        # Later, in domain setup:
        codegen_setup.register_hook_instance(pre_hooks)
    """

    def __init__(self, name: str):
        self.name = name
        self._hooks: list[ForceIncludeEntryHook] = []

    @property
    def hooks(self) -> list[ForceIncludeEntryHook]:
        return self._hooks

    def register(self, hook: ForceIncludeEntryHook) -> ForceIncludeEntryHook:
        """Register a pre-search hook. Works as decorator or direct call."""
        self._hooks.append(hook)
        return hook


class PostSearchEntryHooksRegistry:
    """Collects post-search hooks that add companion entries for selected results.

    Use when companion resolution logic is spread across multiple files
    and needs to be aggregated before passing to CodegenDomainSetup.

    Usage::

        post_hooks = PostSearchEntryHooksRegistry(
            "boardfarm_companions"
        )


        @post_hooks.register
        def companion_resolver(
            analysis: str, input_text: str, selected_apis: set[str]
        ) -> set[str]:
            additions = set()
            for name in selected_apis:
                if name in COMPANIONS:
                    additions.update(
                        COMPANIONS[name] - selected_apis
                    )
            return additions


        # Later, in domain setup:
        codegen_setup.register_hook_instance(post_hooks)
    """

    def __init__(self, name: str):
        self.name = name
        self._hooks: list[PostSearchEnricherHook] = []

    @property
    def hooks(self) -> list[PostSearchEnricherHook]:
        return self._hooks

    def register(self, hook: PostSearchEnricherHook) -> PostSearchEnricherHook:
        """Register a post-search hook. Works as decorator or direct call."""
        self._hooks.append(hook)
        return hook


############################################ Dynamic Rules Registry ############################################


@dataclass(frozen=True)
class DynamicRule:
    """A single domain-specific rule loaded from a markdown file.

    ``content`` is the markdown body (frontmatter stripped). It is appended
    to the static ``framework_rules`` at codegen time for whichever rules the
    LLM selector chose for the current test.
    """

    name: str
    description: str
    content: str


class DynamicRulesRegistry:
    """Holds all active dynamic rules loaded from the domain's rules folder.

    Populated at startup by ``CodegenDomainSetup.register_dynamic_rules()``.

    Three surfaces exposed to the pipeline:

    ``catalog``
        One-line per rule (``- name: description``).  Fed into the LLM
        selector prompt so the LLM knows what rules are available.

    ``names``
        Set of all active rule names.  Hooks query this to decide which
        APIs to force-include.

    ``compose(selected_names)``
        Combines the content of the selected rules into a single string,
        ready to be appended to ``{framework_rules}``.
    """

    def __init__(self) -> None:
        self._rules: dict[str, DynamicRule] = {}

    def register(self, rule: DynamicRule) -> None:
        if rule.name in self._rules:
            msg = f"DynamicRulesRegistry: rule {rule.name!r} already registered — name collision"
            _LOG.warning(msg)
            raise RuleNameCollision(msg)
        self._rules[rule.name] = rule

    @property
    def catalog(self) -> str:
        """Formatted catalog for the LLM selector prompt."""
        if not self._rules:
            return ""
        return "\n".join(
            f"- {r.name}: {r.description}" for r in self._rules.values()
        )

    @property
    def names(self) -> set[str]:
        """Names of all registered active rules."""
        return set(self._rules.keys())

    def compose(self, selected_names: list[str]) -> str:
        """Combine content of selected rules in the order given.

        Rules not found in the registry are silently skipped with a debug log.
        Returns empty string if nothing matched.
        """
        parts: list[str] = []
        for name in selected_names:
            rule = self._rules.get(name)
            if rule is None:
                _LOG.debug(
                    "DynamicRulesRegistry: rule %r selected but not registered — skipping",
                    name,
                )
                continue
            parts.append(rule.content)
        return "\n\n---\n\n".join(parts) if parts else ""


class CodegenDomainSetup:
    """Domain configuration entry point for the codegen pipeline.

    Created by a framework author to customize how code generation
    behaves for their specific framework. The domain author registers
    prompt overrides, hook callbacks, and framework context through
    this class, then exposes it as an entry point via domain config.

    The orchestrator loads this at startup and injects its contents
    into the codegen pipeline — the pipeline never imports from the
    domain directly.

    Usage by a domain author::

        domain = CodegenDomainSetup("boardfarm")
        domain.set_domain_knowledge(
            Path("domain_knowledge.md").read_text()
        )
        domain.set_framework_rules(
            Path("framework_rules.md").read_text()
        )

        domain.register_prompts(
            prompt_stage=CodegenPromptStage.REASONING,
            prompt_variant=CodegenPromptVariant.STANDARD,
            output_task_type=CodegenOutputType.PYTEST,
            system_prompt=Path("reasoning_system.md").read_text(),
            user_prompt=Path("reasoning_user.md").read_text(),
        )


        @domain.register_force_include_entry_hook
        def boardfarm_includes(
            analysis: str, input_text: str
        ) -> list[IncludeEntry]: ...
    """

    def __init__(self, name: str):
        self.name = name
        self._prompts: PromptRegistry = {}
        self._force_include_entry_hooks: list[ForceIncludeEntryHook] = []
        self._post_search_enricher_hooks: list[PostSearchEnricherHook] = []
        self._domain_knowledge: str | None = None
        self._framework_rules: str | None = None
        self._dynamic_rules = DynamicRulesRegistry()

    @property
    def domain_context_data(
        self,
    ) -> dict[Literal["domain_knowledge", "framework_rules"], str]:
        return {
            "domain_knowledge": self.domain_knowledge or "Not Avaialble",
            "framework_rules": self.framework_rules or "Not Avaialble",
        }

    @property
    def prompt_overrides(self) -> PromptRegistry:
        """Prompt templates registered by the domain, keyed by (variant, stage, output_type)."""
        return self._prompts

    @property
    def force_include_entry_hooks(self) -> list[ForceIncludeEntryHook]:
        """Hook callbacks that inject required entries into the generation context."""
        return self._force_include_entry_hooks

    @property
    def post_search_enricher_hooks(self) -> list[PostSearchEnricherHook]:
        """Hook callbacks that validates the search and adds dpendancy.
        Called after serach.
        """
        return self._post_search_enricher_hooks

    @property
    def domain_knowledge(self) -> str | None:
        """Framework domain knowledge text injected into prompt placeholders."""
        return self._domain_knowledge

    @property
    def framework_rules(self) -> str | None:
        """Framework coding rules and conventions injected into prompt placeholders."""
        return self._framework_rules

    def register_force_include_entry_hook(
        self, hook: ForceIncludeEntryHook
    ) -> ForceIncludeEntryHook:
        """Register a pre-search hook that injects entries based on input analysis.

        The hook inspects the analysis and input text, returns entry names
        to force-include in the generation context before search runs.

        Works as decorator or direct call::

            @codegen_setup.register_force_include_entry_hook
            def my_hook(analysis: str, input_text: str) -> set[str]: ...


            codegen_setup.register_force_include_entry_hook(
                existing_hook
            )
        """
        self._force_include_entry_hooks.append(hook)
        return hook

    def register_post_search_enricher_hook(
        self, hook: PostSearchEnricherHook
    ) -> PostSearchEnricherHook:
        """Register a post-search hook that adds companion entries.

        The hook inspects what the search selected and returns additional
        entry names that must accompany them — encoding framework-specific
        companion relationships the search cannot infer.

        Works as decorator or direct call::

            @codegen_setup.register_post_search_hook
            def companions(
                analysis: str, input_text: str, selected_apis: set[str]
            ) -> set[str]: ...
        """
        self._post_search_enricher_hooks.append(hook)
        return hook

    def register_hook_instance(
        self, *registries: ForceIncludeEntryHooksRegistry | PostSearchEntryHooksRegistry
    ) -> None:
        """Absorb hooks from one or more registry instances.

        Use when hooks are collected in separate registry objects
        (typically across multiple files) and need to be merged
        into this domain setup.

        Args:
            *registries: one or more ForceIncludeEntryHooksRegistry or
                PostSearchEntryHooksRegistry instances to absorb.

        Raises:
            TypeError: if a registry is not a recognized hook registry type.

        Usage::

            pre = ForceIncludeEntryHooksRegistry("pre")
            post = PostSearchEntryHooksRegistry("post")
            codegen_setup.register_hook_instance(pre, post)
        """
        for registry in registries:
            if isinstance(registry, ForceIncludeEntryHooksRegistry):
                self._force_include_entry_hooks.extend(registry.hooks)
            elif isinstance(registry, PostSearchEntryHooksRegistry):
                self._post_search_enricher_hooks.extend(registry.hooks)
            else:
                raise TypeError(
                    f"Expected ForceIncludeEntryHooksRegistry or PostSearchEntryHooksRegistry, "
                    f"got {type(registry).__name__!r} (name={getattr(registry, 'name', '?')})"
                )

    def set_prompt_enhancer_injector_before_codegen(self) -> None:
        """Register a callback to programmatically modify prompts before generation.

        TODO: Hook point for dynamic prompt modification — allows the domain
        to alter assembled prompts based on runtime context before the
        generation LLM call.
        """
        raise NotImplementedError("NOT IMPLEMENTED P........")

    def register_prompts(
        self,
        *,
        prompt_stage: CodegenPromptStage,
        prompt_variant: CodegenPromptVariant,
        output_task_type: CodegenOutputType,
        system_prompt: str,
        user_prompt: str,
    ) -> None:
        """Register a prompt pair that overrides the pipeline default for a stage.

        The codegen pipeline checks domain overrides first. If a prompt pair
        is registered for the requested (variant, stage, output_type) combination,
        it is used instead of the built-in default.

        Prompt templates may contain placeholders that the pipeline fills
        at call time. Required placeholders per stage are validated by the
        prompt manager at startup.
        """
        prompt_key = (prompt_variant, prompt_stage, output_task_type)
        self._prompts[prompt_key] = CodegenPromptPair(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

    def set_domain_knowledge(self, knowledge: str) -> None:
        """Set the framework's domain knowledge text.

        This content is available as the {domain_knowledge} placeholder
        in prompt templates. Typically loaded from a markdown file
        containing framework concepts, architecture, and terminology.
        """
        self._domain_knowledge = knowledge

    def set_framework_rules(self, rules: str) -> None:
        """Set the framework's coding rules and conventions.

        This content is available as the {framework_rules} placeholder
        in prompt templates. Typically loaded from a markdown file
        containing import conventions, naming patterns, and code style.
        """
        self._framework_rules = rules

    # ── Dynamic rules (category-specific rules, selected per test) ──────────

    def register_dynamic_rules(self, folder: Path) -> None:
        """Load all active dynamic rules from a folder of markdown files.

        Each ``.md`` file in ``folder`` must have YAML frontmatter with:

        - ``name: str``        — unique identifier used by hooks and the LLM selector
        - ``description: str`` — one-line description for the LLM selector catalog
        - ``is_active: bool``  — files with ``is_active: false`` are skipped

        Files that are missing frontmatter or required fields are skipped with a
        warning log rather than raising, so a bad rule file does not break the pipeline.

        Typical domain-side call in ``domain_setup.py``::

            codegen_setup.register_dynamic_rules(
                Path(__file__).parent / "codegen_dynamic_rules"
            )
        """
        if not folder.is_dir():
            _LOG.warning(
                "register_dynamic_rules: folder %r does not exist — no rules loaded", folder
            )
            return

        loaded = 0
        skipped = 0
        for md_file in sorted(folder.glob("*.md")):
            try:
                raw = md_file.read_text(encoding="utf-8")
                header_str, body = split_frontmatter(raw)
            except ValueError:
                _LOG.warning(
                    "register_dynamic_rules: %r has no valid frontmatter — skipping", md_file.name
                )
                skipped += 1
                continue

            fm: dict[str, Any] = yaml.safe_load(header_str) or {}

            # Skip inactive rules
            if not fm.get("is_active", True):
                _LOG.debug("register_dynamic_rules: %r is inactive — skipping", md_file.name)
                skipped += 1
                continue

            name = fm.get("name")
            description = fm.get("description")
            if not name or not description:
                _LOG.warning(
                    "register_dynamic_rules: %r missing 'name' or 'description' — skipping",
                    md_file.name,
                )
                skipped += 1
                continue

            self._dynamic_rules.register(
                DynamicRule(name=str(name), description=str(description), content=body)
            )
            loaded += 1

        _LOG.info(
            "register_dynamic_rules: loaded %d rules, skipped %d from %r",
            loaded,
            skipped,
            str(folder),
        )

    @property
    def dynamic_rules_catalog(self) -> str:
        """One-line per rule for the LLM selector prompt.

        Empty string if no dynamic rules were registered.
        """
        return self._dynamic_rules.catalog

    @property
    def active_dynamic_rule_names(self) -> set[str]:
        """Names of all registered active dynamic rules.

        Pre-search hooks use this to validate that a selected rule name
        actually exists before force-including its APIs.
        """
        return self._dynamic_rules.names

    def compose_dynamic_rules(self, selected_names: list[str]) -> str:
        """Build the enriched framework_rules string for codegen.

        Appends the content of the selected dynamic rules to the static
        ``framework_rules``.  The combined string overrides ``{framework_rules}``
        in the codegen prompt so the LLM receives both the generic rules and
        the category-specific guidance for this test.

        If ``selected_names`` is empty or none match, returns the static
        ``framework_rules`` unchanged.
        """
        base = self._framework_rules or ""
        dynamic = self._dynamic_rules.compose(selected_names)
        if not dynamic:
            return base
        separator = "\n\n---\n\n"
        return base + separator + dynamic


##############  RUNTIME CONFIG ####################
@dataclass
class ResolvedRuntimeCodeGenConfig:
    stage_config: ResolvedPipeline
    search_config: CodegenSearchSettings
    domain_setup: CodegenDomainSetup | None
