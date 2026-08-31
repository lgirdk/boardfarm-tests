from __future__ import annotations

import logging
import sys
from typing import TYPE_CHECKING, Literal

from rich import print

from boardfarm_api.ai_engine.llm.data_containers import LLMCallSettings

from .code_generator import generate_code
from .context_assembler import assemble_context
from .data_models import CodegenDomainSetup, CodegenInput, IncludeEntry
from .enums import CodegenPromptStage, EntryKind, IncludeEntryResolveStrategy
from .exceptions import CallbackException
from .prompt.prompt_utils import PromptManager
from .protocols import ForceIncludeEntryHook, PostSearchEnricherHook
from .reasoning import run_reasoning
from .searcher_agent import SearcherAgent
from .skill_selector import run_skill_selection

# from configs.shared_state import SHARED_STATE

if TYPE_CHECKING:
    from boardfarm_api.ai_engine.search_store.search_engine import StubCodeSearchEngine

    from .data_models import ResolvedRuntimeCodeGenConfig
    from .enums import CodegenOutputType

LOGGER = logging.getLogger(__name__)


def deep_size(obj, seen=None):  # type: ignore[no-untyped-def]
    seen = seen or set()
    obj_id = id(obj)
    if obj_id in seen:
        return 0
    seen.add(obj_id)
    size = sys.getsizeof(obj)
    if isinstance(obj, dict):
        size += sum(deep_size(k, seen) + deep_size(v, seen) for k, v in obj.items())
    elif isinstance(obj, (list, tuple, set)):
        size += sum(deep_size(i, seen) for i in obj)
    elif hasattr(obj, "__dict__"):
        size += deep_size(obj.__dict__, seen)
    return size


class DriverAgent:
    def __init__(
        self,
        runtime_config: ResolvedRuntimeCodeGenConfig,
        search_engine: StubCodeSearchEngine,
    ):
        # TODO FOR FILTRATIONS OF THE SERCHED ENTRIES IN TEH SEARCH ENGINE, WILL CRETE FILTER OBJECTS
        # EACH FILTER OBJECT FILTES A SPECIFINC THISG ND THEN ALL TEH FILTER OBJECCTS ARE PROVIDED TO
        # THE SEAARCH ENGINE ND DURING THE ENGINE RUNS TEH OUTPUT ARE FILTERD .. AND TEH FLOW IS CONTROLLED BUY THE
        # THE DRIVR AGENT , THE FILTER CLSSES STAYS IN THE SEAARCH_STORE ONLY

        self._runtime_config = runtime_config

        self._reasoning_stage = runtime_config.stage_config.reasoning
        self._search_stage = runtime_config.stage_config.search
        self._generation_stage = runtime_config.stage_config.generation
        self._search_config = runtime_config.search_config
        self.search_engine = search_engine
        if runtime_config.domain_setup is None:
            LOGGER.warning("No domain setup provided — using empty defaults")
        self._domain_setup = runtime_config.domain_setup or CodegenDomainSetup(
            name="empty_default"
        )

        if self._domain_setup and not isinstance(
            self._domain_setup, CodegenDomainSetup
        ):
            raise TypeError(
                f"'{self._domain_setup}' must be a CodegenDomainSetup instance, "
                f"got {type(self._domain_setup).__name__!r}"
            )

        # prompt manager
        self._prompt_manager = PromptManager()
        self._prompt_manager.load_prompts(domain_setup=self._domain_setup)

        # Callbacks
        self._force_include_entry_hooks = self._domain_setup.force_include_entry_hooks
        self._post_search_enricher_hooks = self._domain_setup.post_search_enricher_hooks

        self._searcher = SearcherAgent(
            stage_config=self._search_stage,
            search_config=self._search_config,
            search_engine=search_engine,
            prompt_manager=self._prompt_manager,
            domain_setup=self._domain_setup,
        )

    def _resolve_post_search_enricher_hooks(
        self,
        analysis: str,
        input_text: str,
        selected_apis: set[str],
        matched_skills: list[str] | None = None,
    ) -> set[int]:
        """Runs all registered post-search enricher hooks and resolves their entries to indices.

        Called after semantic search — each hook receives the analysis, input text,
        and the set of API names already selected by search. Hooks can use this
        context to augment or adjust what gets included. All returned entries are
        forwarded to ``_resolve_include_entries`` for index resolution.

        Raises:
            CallbackException: if a hook does not implement ``PostSearchEnricherHook``
                or returns a non-``IncludeEntry`` item.
        """
        if not self._post_search_enricher_hooks:
            return set()
        all_entries: list[IncludeEntry] = []
        for hook_callback in self._post_search_enricher_hooks:
            if not isinstance(hook_callback, PostSearchEnricherHook):
                raise CallbackException(
                    f"the hook callback :- {hook_callback} "
                    "donot follow protocol PostSearchEnricherHook"
                )
            _i_entry = hook_callback(
                analysis=analysis,
                input_text=input_text,
                selected_apis=selected_apis,
                matched_skills=matched_skills or [],
            )
            for ie in _i_entry:
                if not isinstance(ie, IncludeEntry):
                    raise CallbackException(
                        f"Hook {hook_callback} didnot return a valid response"
                        "Excepted response is of type 'IncludeEntry' "
                        f"but returned : {type(ie)}"
                    )
            all_entries.extend(_i_entry)

        results = self._resolve_include_entries(all_entries=all_entries)
        return results

    def _resolve_include_entry_hooks(
        self,
        analysis: str,
        input_text: str,
        matched_skills: list[str] | None = None,
    ) -> set[int]:
        """Runs all registered force-include hooks and resolves their entries to indices.

        Each hook receives the analysis and input text, and returns a list of
        ``IncludeEntry`` objects. All entries are collected and forwarded to
        ``_resolve_include_entries`` for index resolution.

        Raises:
            CallbackException: if a hook does not implement ``ForceIncludeEntryHook``
                or returns a non-``IncludeEntry`` item.
        """
        if not self._force_include_entry_hooks:
            return set()

        all_entries: list[IncludeEntry] = []
        for hook_callback in self._force_include_entry_hooks:
            if not isinstance(hook_callback, ForceIncludeEntryHook):
                raise CallbackException(
                    f"the hook callback :- {hook_callback} "
                    "donot follow protocol ForceIncludeEntryHook"
                )
            _i_entry = hook_callback(analysis, input_text, matched_skills=matched_skills or [])
            for ie in _i_entry:
                if not isinstance(ie, IncludeEntry):
                    raise CallbackException(
                        f"Hook {hook_callback} didnot return a valid response"
                        "Excepted response is of type 'IncludeEntry' "
                        f"but returned : {type(ie)}"
                    )
            all_entries.extend(_i_entry)

        results = self._resolve_include_entries(all_entries=all_entries)
        return results

    def _resolve_include_entries(self, all_entries: list[IncludeEntry]) -> set[int]:
        """Resolves a list of ``IncludeEntry`` objects into a set of indices.

        For each entry, applies the primary resolution strategy (by name, category,
        or repo), then intersects with any additional refinement filters set on the
        entry (category, repo, entry type, parent class). Results across all entries
        are unioned into a single index set.
        """
        results: set[int] = set()
        for _entry in all_entries:
            candidate_indices: set[int] = set()
            match _entry.strategy:
                case IncludeEntryResolveStrategy.BY_API_NAMES:
                    # union all name lookups
                    for name in _entry.api_names:
                        candidate_indices.update(
                            self.search_engine.indices_by_name(name)
                        )

                case IncludeEntryResolveStrategy.BY_CATEGORY:
                    assert _entry.category is not None
                    candidate_indices = self.search_engine.indices_by_category(
                        _entry.category
                    )

                case IncludeEntryResolveStrategy.BY_REPO:
                    assert _entry.repo is not None
                    candidate_indices = self.search_engine.indices_by_repo(_entry.repo)

            # refinements based on all the set indices received
            # this will filter out things without needed to manually check
            # as te data structure is already built.
            #  intersect all that are set
            if _entry.category:
                candidate_indices &= self.search_engine.indices_by_category(
                    _entry.category
                )

            if _entry.repo:
                candidate_indices &= self.search_engine.indices_by_repo(_entry.repo)

            if _entry.entry_type:
                e_type: Literal["function", "class", "methods", "properties"] | None = (
                    None
                )
                match _entry.entry_type:
                    case EntryKind.CLASS:
                        e_type = "class"
                    case EntryKind.FUNCTION:
                        e_type = "function"
                    case EntryKind.METHOD:
                        e_type = "methods"
                    case EntryKind.PROPERTY:
                        e_type = "properties"
                if e_type:
                    candidate_indices &= self.search_engine.indices_by_type(e_type)

            if _entry.parent_class:
                candidate_indices &= self.search_engine.indices_by_owner_class(
                    _entry.parent_class
                )

            # inplace set union
            results |= candidate_indices

        return results

    def generate(
        self, input_: CodegenInput, output_task_type: CodegenOutputType
    ) -> str:
        # Stage 1: Reasoning
        analysis = run_reasoning(
            self._reasoning_stage,
            input_,
            self._prompt_manager,
            output_task_type,
            self._domain_setup,
        )

        # Stage 2: Skill/dynamic-rule selection
        # Reuses the reasoning stage's LLM with deterministic settings.
        # Returns [] if no dynamic rules are registered.
        selected_rule_names = run_skill_selection(
            stage_config=self._reasoning_stage,
            analysis=analysis,
            catalog=self._domain_setup.dynamic_rules_catalog,
        )
        breakpoint()

        # Stage 3: Pre-search forced inclusions (skill-aware)
        pre_included = self._resolve_include_entry_hooks(
            analysis, input_.full_prompt_text, matched_skills=selected_rule_names
        )
        LOGGER.info("Pre-included forced selection ids: %s", pre_included)

        # Stage 4: Search
        self._searcher.output_task_type = output_task_type
        selected_idx = self._searcher.select_stub(
            analysis=analysis, input_=input_, pre_included_indices=pre_included
        )
        resolved_stubs = self._searcher.resolves_stubs(list(selected_idx))

        # Stage 5: Context assembly
        assembled_context = assemble_context(resolved_stubs, input_, analysis)

        # Stage 6: Code generation (dynamic rules injected into framework_rules)
        _codegen_prompt_pair = self._prompt_manager.resolve_prompt(
            prompt_stage=CodegenPromptStage.CODEGEN,
            prompt_variant=self._generation_stage.prompt_variant,
            output_type=output_task_type,
        )
        code = generate_code(
            self._generation_stage,
            assembled_context,
            _codegen_prompt_pair,
            self._domain_setup,
            selected_rule_names=selected_rule_names,
        )
        print(code)
        return code

        # # Step 6 — validate and fix
        # validated = validate_and_fix(
        #     code, self.stub_registry, self.llm
        # )

        # return validated

    # def _get_module_search_hits(self,test_input:CodegenTestInput)->str:
    #     queries = [
    #         test_input.full_prompt_text,
    #         test_input.description or "",
    #         test_input.preconditions or "",
    #         test_input.formatted_steps,
    #     ]
    #     collected_data =  self.search_engine.module_context_search(
    #         queries=queries,
    #         faiss_top_k=4,
    #         faiss_threshold=35
    #         )
    #     return "\n".join(collected_data)


class CodeGenerationStep:
    SETTINGS = LLMCallSettings(temperature=0.2, max_tokens=8192)
