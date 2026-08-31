from __future__ import annotations

import json
import logging
import re
import time
from typing import TYPE_CHECKING, Any, Literal

import jsonschema
from rich import print

from .data_models import SearchSelectionResult
from .enums import CodegenOutputType, CodegenPromptStage
from .schemas.search_agent_schemas import (
    CALL_SEARCH_SCHEMA_INITIATE,
    # CALL_1C_PASS1_SCHEMA,
    # CALL_1C_PASS2_SCHEMA,
    CALL_SEARCH_SCHEMA_KEEP,
    CALL_SEARCH_SCHEMA_REMOVE,
)

LOGGER = logging.getLogger(__name__)

if TYPE_CHECKING:
    from src.search_store.custome_types import CorpusHits
    from src.search_store.data_models import ResolvedIndexStubEntry
    from src.search_store.search_engine import StubCodeSearchEngine

    from .config_schema import CodegenSearchSettings
    from .data_models import CodegenDomainSetup, CodegenInput, ResolvedStage
    from .prompt.prompt_utils import PromptManager


class ValidationsError(Exception):
    """Raised when the json validation failed"""


class SchemaError(ValidationsError):
    """Fails when the schem is not properly matched."""


def strip_json_comments(text: str) -> str:
    """Remove // and # comments outside quoted strings."""
    return re.sub(
        r'("(?:[^"\\]|\\.)*")|(//[^\n]*|#[^\n]*)',
        lambda m: m.group(1) if m.group(1) else "",
        text,
    )


def extract_json_from_string(raw_text: str, schema: dict) -> dict:
    try:
        text = raw_text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        print("JSON BEFORE ========= \n", text)
        text = strip_json_comments(text=text)
        print("JSON AFTER  ========= \n", text)
        output: dict = json.loads(text.strip())
    except (json.JSONDecodeError, IndexError):
        LOGGER.error(text)
        raise ValidationsError("Invalid JSON") from None

    try:
        jsonschema.validate(output, schema)
    except jsonschema.ValidationError as e:
        LOGGER.error(text)
        raise SchemaError(f"Schema error: {e.message}") from None

    return output


class SearcherAgent:
    # SETTINGS = LLMCallSettings(temperature=0.4, max_tokens=2048)

    def __init__(
        self,
        stage_config: ResolvedStage,
        search_config: CodegenSearchSettings,
        search_engine: StubCodeSearchEngine,
        prompt_manager: PromptManager,
        domain_setup: CodegenDomainSetup,
    ):
        self.domain_context_data = domain_setup.domain_context_data

        self.prompt_manager = prompt_manager
        self.llm = stage_config.llm
        self.llm_call_settings = stage_config.settings
        self.prompt_variant = stage_config.prompt_variant
        self.search_engine = search_engine
        self.search_config = search_config
        self._output_task_type: CodegenOutputType | None = None

    @property
    def output_task_type(self) -> CodegenOutputType:
        if not self._output_task_type:
            raise ValueError("the output task type must be set and is needed")
        return self._output_task_type

    @output_task_type.setter
    def output_task_type(self, value: CodegenOutputType) -> None:
        if not isinstance(value, CodegenOutputType):
            raise ValueError(
                f"the provided task type {value} is not the type CodegenOutputType"
            )
        self._output_task_type = value

    def _prepare_index_for_llm(
        self, last_call_search_indexed: list[tuple[int, str]]
    ) -> str:
        lines = []
        for idx, val in enumerate(last_call_search_indexed):
            line = f"[{idx}] {val[1]}"
            lines.append(line)
        return "\n".join(lines)

    def _index_and_format_corpus_hits(
        self, current_search_results: CorpusHits, add_signature: bool = True
    ) -> list[tuple[int, str]]:
        curr_search_context = []
        for real_idx, v in current_search_results.items():
            doc = f"[{v['category'].strip('\n').strip(' ')}] {v['doc'].strip('\n').strip(' ')}\n"
            if v["signature"] and add_signature:
                doc = f"{doc.strip('\n')} | sig: {v['signature']}\n"
            curr_search_context.append((real_idx, doc))
        return curr_search_context

    def _route_search(
        self,
        corpus_name: str,
        queries: list[str],
        *,
        exclude_index: set[int],
        bm25_top_k: int,
        faiss_top_k: int,
        faiss_threshold: int,
    ) -> CorpusHits:
        """Route to full corpus or sub-corpus search."""
        if corpus_name == "_full":
            return self.search_engine.search_full_corpus(
                queries,
                exclude_index=exclude_index,
                bm25_top_k=bm25_top_k,
                faiss_top_k=faiss_top_k,
                faiss_threshold=faiss_threshold,
            )
        return self.search_engine.search_subcorpus(
            corpus_name,
            queries,
            exclude_index=exclude_index,
            bm25_top_k=bm25_top_k,
            faiss_top_k=faiss_top_k,
            faiss_threshold=faiss_threshold,
        )

    def _validate_output(
        self,
        response: str,
        schema: dict,
        search_style: str | None = None,
    ) -> tuple[dict, list[str]]:
        output = extract_json_from_string(response, schema)
        issues = []
        if output["action"] == "search":
            if not output.get("nouns") and not output.get("queries"):
                issues.append("Search action but no nouns or queries provided")
        elif output["action"] == "done" and search_style:
            selection_key = "remove" if search_style == "remove" else "keep"
            if selection_key not in output and "missing" not in output:
                issues.append(f"Done action but no {selection_key} or missing provided")
        return output, issues

    def _interactive_search_and_collect(
        self,
        analysis: str,
        input_prompt: str,
        *,
        initial_queries: dict,
        max_rounds: int = 4,
        search_style: Literal["keep", "remove"] = "keep",
        exclude_index: set[int] | None = None,
        processed_docs: list[str] | None = None,
    ) -> SearchSelectionResult:

        all_selected_index: set[int] = set()
        all_selected_doc: list[str] = [] if processed_docs is None else processed_docs
        all_visited_indexes: set[int] = set(exclude_index) if exclude_index else set()
        last_call_search_indexed: list[tuple[int, str]] = []

        def _make_result(missing: list | None = None) -> SearchSelectionResult:
            return SearchSelectionResult(
                selected_index=all_selected_index,
                selected_doc=all_selected_doc,
                visited_index=all_visited_indexes,
                missing=missing or [],
            )

        def _call_llm(system: str, user_msg: str) -> str:
            return self.llm.call(
                system=system,
                user=user_msg,
                settings=self.llm_call_settings,
            )

        def _search_and_update(
            nouns: list[str], queries: list[str], round_num: int
        ) -> CorpusHits:
            search_results: CorpusHits = {}
            for name, sc in self.search_config.sub_corpus_group.items():
                LOGGER.info(f"Round {round_num} | corpus= {name}")
                if not sc.search_enabled:
                    LOGGER.info(f"\t\t**SKIPPING CORPUS {name} AS CONFIGURED**")
                    continue
                # Nouns BM25 heavy
                _search_bm25 = self._route_search(
                    name,
                    nouns,
                    exclude_index=all_visited_indexes,
                    bm25_top_k=sc.bm25_top_k,
                    # faiss_top_k=max(1, sc.faiss_top_k - 2),  # lower FAISS for nouns
                    faiss_top_k=0,
                    faiss_threshold=sc.faiss_threshold,
                )
                search_results.update(_search_bm25)
                LOGGER.info(f"\t\t -- Noune hits for {name}: {len(_search_bm25)}")
                __debug_bm25 = "\t\t\t\n".join(
                    [f"{v['category']} | {v['doc']}" for v in _search_bm25.values()]
                )
                LOGGER.debug(f"\t\t * values {__debug_bm25}")

                # Queries FAISS heavy
                _search_queries = self._route_search(
                    name,
                    queries,
                    exclude_index=all_visited_indexes,
                    bm25_top_k=min(2, sc.bm25_top_k),
                    faiss_top_k=sc.faiss_top_k,
                    faiss_threshold=sc.faiss_threshold,
                )
                # self.search_engine.rerank_coupus_hits(queries=queries,corpus_hits=_search_queries)
                search_results.update(_search_queries)
                LOGGER.info(f"\t\t -- Queries hits for {name}: {len(_search_queries)}")
                __debug_faiss = "\t\t\t\n".join(
                    [f"{v['category']} | {v['doc']}" for v in _search_queries.values()]
                )
                LOGGER.debug(f"\t\t * values {__debug_faiss}")

            print(f"total search for all rounds {len(search_results)}")

            if self.search_config.full_corpus.search_enabled:
                fc = self.search_config.full_corpus
                hits = self._route_search(
                    "_full",
                    nouns + queries,
                    exclude_index=all_visited_indexes,
                    bm25_top_k=fc.bm25_top_k,
                    faiss_top_k=fc.faiss_top_k,
                    faiss_threshold=fc.faiss_threshold,
                )
                search_results.update(hits)
            return search_results

        if max_rounds == 0:
            return _make_result(missing=[])

        if search_style == "keep":
            STAGE = CodegenPromptStage.SEARCH_KEEP
            SCHEMA = CALL_SEARCH_SCHEMA_KEEP
        else:
            STAGE = CodegenPromptStage.SEARCH_REMOVE
            SCHEMA = CALL_SEARCH_SCHEMA_REMOVE

        # output = initial_queries
        prompt_pair = self.prompt_manager.resolve_prompt(
            prompt_stage=STAGE,
            prompt_variant=self.prompt_variant,
            output_type=self.output_task_type,
        )
        output_nouns = initial_queries.get("nouns", [])
        output_queries = initial_queries.get("queries", [])
        # Rounds 2+: search -> show results -> LLM reviews
        for round_num in range(max_rounds):
            time.sleep(1.5)
            LOGGER.info(f"Round {round_num} | style={search_style}")

            search_results = _search_and_update(
                nouns=output_nouns, queries=output_queries, round_num=round_num
            )

            all_visited_indexes.update(search_results.keys())
            search_results = self.search_engine.run_filters_on_corpushits(
                search_results
            )
            if not search_results:
                LOGGER.info(
                    f"No new results found in round {round_num}, stopping search"
                )
                break
            last_call_search_indexed = self._index_and_format_corpus_hits(
                search_results
            )

            # Show results to LLM
            formatted = self._prepare_index_for_llm(last_call_search_indexed)
            selected_summary = "\n\n".join(all_selected_doc) or "None yet"
            variables: dict[str, Any] = {
                "analysis": analysis,
                "input_text": input_prompt,
                "selected_names_list": selected_summary,
                "formatted_new_results_indexed_from_zero": formatted,
                **self.domain_context_data,  # type: ignore[dict-item]
            }
            system = prompt_pair.format_system(**variables)
            user_msg = prompt_pair.format_user(**variables)
            response = _call_llm(system, user_msg)

            output, issues = self._validate_output(
                response, schema=SCHEMA, search_style=search_style
            )
            if issues:
                break

            # Apply keep/remove selection
            if "remove" in output and last_call_search_indexed:
                remove_set = set(output.get("remove", []))
                for idx, (real_idx, doc) in enumerate(last_call_search_indexed):
                    if idx not in remove_set:
                        all_selected_index.add(real_idx)
                        all_selected_doc.append(doc.strip("\n"))

            elif "keep" in output and last_call_search_indexed:
                for idx in output["keep"]:
                    if idx < len(last_call_search_indexed):
                        real_idx, doc = last_call_search_indexed[idx]
                        all_selected_index.add(real_idx)
                        all_selected_doc.append(doc.strip("\n"))

            if output["action"] == "done":
                LOGGER.info(f"Search complete | selected=\n{all_selected_doc}")
                result = _make_result(missing=output.get("missing", []))
                return result

            # No new queries — stop
            if not output.get("nouns") and not output.get("queries"):
                break

            output_nouns = output.get("nouns", [])
            output_queries = output.get("queries", [])

        LOGGER.info(f"Max rounds reached | selected={all_selected_doc}")
        result = _make_result(missing=[{"need": "max rounds reached"}])
        return result

    def _generate_initial_queries(
        self, analysis: str, input_prompt: str, add_raw_queries: list[str] | None = None
    ) -> dict | None:
        """Generate initial nouns + queries from analysis. Called ONCE.(query decomposition)."""
        initiate_pair = self.prompt_manager.resolve_prompt(
            prompt_stage=CodegenPromptStage.SEARCH_INITIATE,
            prompt_variant=self.prompt_variant,
            output_type=self.output_task_type,
        )
        variables: dict[str, Any] = {
            "analysis": analysis,
            "input_text": input_prompt,
            # "num_steps": str(len(input_prompt.raw_search_texts)),
            **self.domain_context_data,  # type: ignore[dict-item]
        }
        system = initiate_pair.format_system(**variables)
        user = initiate_pair.format_user(**variables)

        response = self.llm.call(
            system=system, user=user, settings=self.llm_call_settings
        )
        output, issues = self._validate_output(response, CALL_SEARCH_SCHEMA_INITIATE)
        if issues:
            LOGGER.warning(f"Initial query generation failed: {issues}")
            return None
        if add_raw_queries:
            output["queries"] = output.get("queries", []) + list(add_raw_queries)
        print(output)
        return output

    def select_stub(
        self,
        *,
        analysis: str,
        input_: CodegenInput,
        pre_included_indices: set[int] | None = None,
    ) -> set[int]:
        all_selected_indices: set[int] = set()
        all_visited_indices: set[int] = (
            set(pre_included_indices) if pre_included_indices else set()
        )
        all_selected_doc: list[str] = []

        # processing pre included indices

        if pre_included_indices:
            _hits = self.search_engine.get_corpus_hits(pre_included_indices)
            _hits = self.search_engine.run_filters_on_corpushits(_hits)
            for _raw_idx, _doc in self._index_and_format_corpus_hits(_hits):
                all_selected_doc.append(_doc.strip("\n"))
                all_selected_indices.add(_raw_idx)

        # TODO Initial query generatinos should happen pnly once both for keep and remove . need
        # to strip it out
        # VRI IMPORT OPTIMIZTINOS
        # Pre-pass: raw step text as direct queries (if enbled)
        raw_queries = (
            input_.raw_search_texts
            if self.search_config.strategy.include_raw_search_text
            else None
        )
        initial_output = self._generate_initial_queries(
            analysis, input_.full_prompt_text, raw_queries
        )
        if initial_output is None:
            return all_selected_indices

        # KEEP STRATEGY
        if self.search_config.strategy.keep_rounds > 0:
            res_keep = self._interactive_search_and_collect(
                analysis,
                input_.full_prompt_text,
                initial_queries=initial_output,
                max_rounds=self.search_config.strategy.keep_rounds,
                search_style="keep",
                exclude_index=all_visited_indices,
                processed_docs=all_selected_doc,
            )
            # all_selected_doc.extend(res_keep.selected_doc)
            all_visited_indices.update(res_keep.visited_index)
            all_selected_indices.update(res_keep.selected_index)

        # REMOVE STRATEGY
        if self.search_config.strategy.remove_rounds > 0:
            res_remove = self._interactive_search_and_collect(
                analysis,
                input_.full_prompt_text,
                initial_queries=initial_output,
                max_rounds=self.search_config.strategy.remove_rounds,
                search_style="remove",
                exclude_index=all_selected_indices,
                processed_docs=all_selected_doc,
            )
            # all_selected_doc.extend(res_remove.selected_doc)
            all_visited_indices.update(res_remove.visited_index)
            all_selected_indices.update(res_remove.selected_index)
        # if self.search_config.strategy.final_review_enabled:
        #     all_selected = self._final_review(all_selected, analysis, test_input)
        return all_selected_indices

    def resolves_stubs(self, idx: list[int]) -> list[ResolvedIndexStubEntry]:
        return self.search_engine.resolve_all_index_entries(idx)


#     def _verify_and_fill_gaps(self,analysis:str, test_steps:str, selected_index:set[int])->set[int]:
#         """Verify selected entries and fill gaps LLM calls."""

#         # TODO  rate  tst stp object nd use that evrywhere ...... DO A PROPER SAANITY

#         SETTINGS_PASS1 = LLMCallSettings(temperature=0.3, max_tokens=4096)
#         SETTINGS_PASS2 = LLMCallSettings(temperature=0.2, max_tokens=1024)

#         corpus_hit_search = self.search_engine.get_corpus_hits(selected_index)
#         formatted_hits  =  self._index_and_format_corpus_hits(corpus_hit_search,add_signature=True)
#         selected_entries_format_str = "\n\n".join([f[1].strip("\n") for f in formatted_hits ] )
#         print("HRD CODED THIS .. BDDD VERY BDDDD     step_count = 12  # TODO   need to get ot from teh steps  MODULARIZE IT ")
#         # Pass 1: Identify gaps and noise
#         user_msg = search_agent_prompts.USER_CALL_1C_PASS_1.format(
#             impl_analysis_from_reasoning=analysis,
#             test_steps=test_steps,
#             selected_entries_with_full_signatures=selected_entries_format_str,
#             step_count = 12  # TODO   need to get ot from teh steps
#         )

#         for _ in range(3):
#             response = self.llm.call(
#                 system=search_agent_prompts.SYSTEM_CALL_1C_PASS_1,
#                 user=user_msg,
#                 settings=SETTINGS_PASS1
#             )

#             print(f"=================formatted docs for call pss1 below ================\n{selected_entries_format_str}")
#             pass1_output = extract_json_from_string(response,schema=CALL_1C_PASS1_SCHEMA)
#             step_review =  pass1_output.get("step_review", [])
#             # TODO  need to vrify tst stps properly  ..... nd g th needs ..
#             print("VERIFY TEST STEPS REVIEW AND THE RESULT VALIDAATION ITSSSSSSSS PENDIGGGGGGG,,,,,,,,,, OR YOU WILL FORGET ,,,,,LATTR,,,,,,,,,")
#             print("CREATRE THE OUTPUT STRUUTRE CONTEINER  FOR THE OUTPUTS PRESIZELY YYYYY FOR CHECK" )
#             if step_review:
#                 break

#         gaps = pass1_output.get("gaps", [])

#         # If no gaps, return as-is with noise removed
#         if not gaps:
#             return {
#                 "selected_index" : selected_index,
#                 "step_review": step_review
#             }

# #       # Search for gaps — FRESH search space, no exclusions
#         gaps_identified:list[str] = []
#         all_hits:CorpusHits =  {}
#         for gap in gaps:
#             search_query =  gap["search_for"]
#             reason =   gap["reason"]
#             gaps_identified.append(reason)

#             all_hits.update(self.search_engine.hybrid_search(
#                 queries=search_query,
#                 bm25_top_k=5,
#                 faiss_top_k=5
#             )
#             )
#         corpus_indexed = self._index_and_format_corpus_hits(all_hits,add_signature=True)
#         formatted_new_results_indexed_from_zero = self._prepare_index_for_llm(corpus_indexed)
#         gaps_from_pass1 = "\n".join(gaps_identified)

#         # Pass 2: LLM keeps relevant entries from gap results
#         user_msg = search_agent_prompts.USER_CALL_1C_PASS_2.format(
#             test_steps=test_steps,
#             selected_names_summary=selected_entries_format_str,
#             gaps_from_pass1=gaps_from_pass1,
#             formatted_new_results_indexed_from_zero=formatted_new_results_indexed_from_zero
#         )

#         response = self.llm.call(
#             system=search_agent_prompts.SYSTEM_CALL_1C_PASS_2,
#             user=user_msg,
#             settings=SETTINGS_PASS2
#         )

#         pass2_output = extract_json_from_string(response,schema=CALL_1C_PASS2_SCHEMA)
#         keep =  pass2_output["keep"]
#         for idx in keep:
#             selected_index.add(corpus_indexed[idx][0])

#         return {
#                 "selected_index" : selected_index,
#                 "step_review": step_review
#             }
