from __future__ import annotations

import logging
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Self

from .config_schema import StoreConfig
from .filters import (
    CorpusHitsFilterProtocol,
    RepoExcludeFilter,
    RepoPriorityFilter,
)
from .search_engine import StubCodeSearchEngine
from .utils import StubCodeRegistry

Logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from .selectors import Selector

SEARCH_FILTER_REGISTRY: dict[str, Callable[..., CorpusHitsFilterProtocol]] = {
    "repo_priority_order": RepoPriorityFilter,
    "exclude_repos": RepoExcludeFilter,
}


class SearchStoreService:
    """Public surface of the search_store module. Owns registry + engine factory."""

    def __init__(self, store_config: StoreConfig):
        self.store_config = store_config
        all_filters: list[CorpusHitsFilterProtocol] = []
        for filter_name, values in store_config.filters.model_dump().items():
            if filter_name not in SEARCH_FILTER_REGISTRY:
                raise ValueError(
                    f"The filter name {filter_name} not yet registerd ."
                    f"Available filter :-- {SEARCH_FILTER_REGISTRY.keys()}"
                    "PLEASE REGISTER BEFORE USING ........"
                )
            # TODO need to see how not to use values as a class can also not take naytng in constructor
            all_filters.append(SEARCH_FILTER_REGISTRY[filter_name](values))

        self.all_filters = all_filters
        Logger.info("SEARCH STORE CREATED")

    @classmethod
    def from_toml(cls, path: Path) -> Self:
        return cls(StoreConfig.from_toml(path))

    def build_stub_code_search_engine(
        self,
        *,
        encoder_name: str,
        subcorpus_groups: dict[str, Selector],
        cross_encoder_name: str | None = None,
    ) -> StubCodeSearchEngine:
        Logger.info(
            f"BUILDING STUB SEARCH ENGINE | ENCODER: {encoder_name} | "
            f"FILTERS: {self.store_config.filters.model_dump()} | "
            f"CROSS ENCODERS OR RERANKERS {cross_encoder_name} | "
            f"SUB-CORPUS GROUPS: {' , '.join(list(subcorpus_groups.keys()))}"
        )
        # if cross_encoder_name:  for the time beig no using
        #     cross_encoder

        encoder = self.store_config.build_encoder(encoder_name)
        registry = StubCodeRegistry(
            stub_index_path=self.store_config.store.stub_registry.stub_index_path,
            artifacts_path=self.store_config.store.artifacts_path,
        )
        registry.load_or_build()
        # building the suborpus
        for group_name, selector_fun in subcorpus_groups.items():
            registry.build_sub_corpus_groups(
                group_name=group_name, selector_fn=selector_fun
            )

        return StubCodeSearchEngine(
            registry=registry,
            artifacts_path=self.store_config.store.artifacts_path,
            encoder=encoder,
            # cross_encoder=
            corpus_filters=self.all_filters,
        )

    def build_search_vocabulary(self, registry: StubCodeRegistry) -> str:
        STOP_WORDS = {
            "get",
            "set",
            "is",
            "on",
            "from",
            "to",
            "via",
            "and",
            "the",
            "of",
            "for",
            "in",
            "by",
            "a",
            "an",
            "or",
            "not",
            "board",
            "device",
            "check",
            "verify",
            "status",
        }

        module_terms: dict[str, dict[str, int]] = {}

        for key in registry.search_corpus.keys:
            parsed = registry.parse_key(key)
            if parsed.category in ("other", "fixtures"):
                continue
            module = parsed.file_key.split("__")[-1]

            # ONLY function name words, no docstrings
            name_words = parsed.callable_name.lower().split("_")
            for w in name_words:
                if w not in STOP_WORDS and len(w) > 2:
                    module_terms.setdefault(module, {})
                    module_terms[module][w] = module_terms[module].get(w, 0) + 1

        lines = ["FRAMEWORK VOCABULARY:"]
        for module, term_counts in sorted(module_terms.items()):
            # Top 5 most frequent terms per module
            top = sorted(term_counts, key=term_counts.get, reverse=True)[:5]
            if top:
                lines.append(f"  {module}: {', '.join(top)}")

        return "\n".join(lines)
