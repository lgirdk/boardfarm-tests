from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING, Literal

import numpy as np

from .bm25_search import BM25SearchEngine
from .data_models import CorpusIndexEngine, ParsedKey, ResolvedIndexStubEntry, SubCorpus
from .faiss_embeddings import FaissIndexManager
from .filters import CorpusHitsFilterProtocol

if TYPE_CHECKING:
    from .custome_types import CorpusHits, IndexEntry
    from .encoders import CrossEncoderModelProtocol, EncoderModelProtocol
    from .utils import StubCodeRegistry

LOGGER = logging.getLogger(__name__)


class ImplCodeSearchEngine:
    """Works on the implementation registry can be helpfull for debugger agents."""


class StubCodeSearchEngine:
    def __init__(
        self,
        *,
        registry: StubCodeRegistry,
        artifacts_path: Path,
        encoder: EncoderModelProtocol,
        cross_encoder: CrossEncoderModelProtocol | None = None,
        corpus_filters: list[CorpusHitsFilterProtocol] | None = None,
    ) -> None:
        if corpus_filters is None:
            corpus_filters = []
        for f in corpus_filters:
            if not isinstance(f, CorpusHitsFilterProtocol):
                raise ValueError(
                    f"filter must implement CorpusHitsFilterProtocol, got {type(f).__name__}"
                )
        self._faiss_index_folder = "stub_faiss_index"
        self._cross_encoder = cross_encoder
        ################################  TODO/FIXME nneeddd to remove
        # self._cross_encoder = BasicCrossEncoderReranker(
        #     model_path="/home/ahazra/workspace/claude_test/.models/bge-reranker-base",
        #     local_files_only=True,
        #     max_length=512,
        # )
        # # breakpoint()
        ######################################################
        _faiss_index_path = artifacts_path / self._faiss_index_folder
        self._registry = registry
        self.corpus_filters = corpus_filters
        LOGGER.info("** BUILDING CORPUS ENGINE **")
        self._full_corpus_engine = CorpusIndexEngine(
            bm25_engine=BM25SearchEngine(self._registry.search_corpus),
            faiss_engine=FaissIndexManager(
                index_name="full_corpus", index_path=_faiss_index_path, encoder=encoder
            ),
        )
        self._full_corpus_engine.faiss_engine.load_or_build(
            self._registry.search_corpus
        )
        self._sub_corpus_engines: dict[str, CorpusIndexEngine] = {}
        for corpus_group, sub_corpus in self._registry.sub_corpus_groups.items():
            LOGGER.info(f"** BUILDING SUB-CORPUS ENGINE: {corpus_group}")
            bm25_eng = BM25SearchEngine(sub_corpus)
            faiss_eng = FaissIndexManager(
                index_name=f"subcorpus_{corpus_group}",
                index_path=_faiss_index_path,
                encoder=encoder,
            )
            faiss_eng.load_or_build(sub_corpus)
            self._sub_corpus_engines[corpus_group] = CorpusIndexEngine(
                bm25_engine=bm25_eng, faiss_engine=faiss_eng
            )
        # create group searches...
        self._indices_by_name: dict[str, set[int]] = {}
        self._indices_by_category: dict[str, set[int]] = {}
        self._indices_by_repo: dict[str, set[int]] = {}
        self._indices_by_type: dict[
            Literal["function", "class", "methods", "properties"], set[int]
        ] = {}
        self._indices_by_owner_class: dict[str, set[int]] = {}

        for raw_idx, key_entry in enumerate(self._registry.search_corpus.keys):
            parsed_key = self._registry.parse_key(key_entry)
            name = ""
            class_name = ""
            type_: Literal["function", "class", "methods", "properties"] | None = None

            category = parsed_key.category
            repo_name = parsed_key.repo

            if parsed_key.is_member:
                assert parsed_key.member_name is not None
                name = parsed_key.member_name
                if parsed_key.member_type == "methods":
                    type_ = "methods"
                elif parsed_key.member_type == "properties":
                    type_ = "properties"
                class_name = parsed_key.callable_name
            else:
                root_index_lookup: IndexEntry = self._registry.lookup_index_registry(
                    parsed_key, only_root=True
                )
                name = parsed_key.callable_name
                if root_index_lookup["type"] == "class":
                    class_name = parsed_key.callable_name
                    type_ = "class"
                elif root_index_lookup["type"] == "function":
                    type_ = "function"

            self._indices_by_name.setdefault(name, set()).add(raw_idx)
            self._indices_by_category.setdefault(category, set()).add(raw_idx)
            self._indices_by_repo.setdefault(repo_name, set()).add(raw_idx)
            if type_:
                self._indices_by_type.setdefault(type_, set()).add(raw_idx)
            if class_name:
                self._indices_by_owner_class.setdefault(class_name, set()).add(raw_idx)

    def _update_corpushits(
        self,
        results: CorpusHits,
        idx: int,
        doc: str,
        signature: str,
        parsed_key: ParsedKey,
    ) -> None:

        if idx not in results:
            results[idx] = {
                "doc": doc,
                "category": parsed_key.category,
                "signature": signature,
                "repo_name": parsed_key.repo,
                "root_name": parsed_key.callable_name,
                "file_path": parsed_key.file_path,
                "file_name": parsed_key.file_name,
            }

    def resolve_single_index_entry(self, idx: int) -> ResolvedIndexStubEntry:
        parsed_key = self._registry.parse_key(self._registry.search_corpus.keys[idx])
        root_stub = self._registry.lookup_index_registry(parsed_key, only_root=True)
        return ResolvedIndexStubEntry.build(root_stub, parsed_key)

    def resolve_all_index_entries(
        self, idx_list: list[int]
    ) -> list[ResolvedIndexStubEntry]:
        entry = []
        for idx in idx_list:
            entry.append(self.resolve_single_index_entry(idx=idx))
        return entry

    def get_stubs_by_category(self, category_name: str) -> list[ResolvedIndexStubEntry]:
        all_categories: list[ResolvedIndexStubEntry] = []
        root_key_visited = set()
        for key, _ in self._registry.index_registry.items():
            root_key = self._registry.parse_key(key).root_search_key
            if root_key in root_key_visited:
                continue
            r_p_key = self._registry.parse_key(root_key)
            if r_p_key.category == category_name:
                root_key_visited.add(r_p_key.root_search_key)
                root_stub = self._registry.lookup_index_registry(
                    r_p_key, only_root=True
                )
                all_categories.append(ResolvedIndexStubEntry.build(root_stub, r_p_key))

        return all_categories

    def run_filters_on_corpushits(self, c_hits: CorpusHits) -> CorpusHits:
        filtered_hits = c_hits
        for _filter in self.corpus_filters:
            filtered_hits = _filter(filtered_hits)
        return filtered_hits

    def get_corpus_hits(self, indices: set[int]) -> CorpusHits:
        hits: CorpusHits = {}
        for idx in indices:
            parsed_key = self._registry.parse_key(
                self._registry.search_corpus.keys[idx]
            )
            _entry = self._registry.lookup_index_registry(
                key=parsed_key, only_root=False
            )
            if parsed_key.is_member and parsed_key.member_type == "properties":
                signature = _entry.get("return_type", "")
            else:
                signature = _entry.get("signature", "")
            doc = self._registry.search_corpus.documents[idx]
            self._update_corpushits(hits, idx, doc, signature, parsed_key)  # type: ignore[arg-type]

        return hits

    def indices_by_name(self, name: str) -> set[int]:
        """Return registry indices matching the given API name."""
        return self._indices_by_name.get(name, set())

    def indices_by_category(self, category: str) -> set[int]:
        """Return registry indices belonging to the given category."""
        return self._indices_by_category.get(category, set())

    def indices_by_repo(self, repo: str) -> set[int]:
        """Return registry indices belonging to the given repository."""
        return self._indices_by_repo.get(repo, set())

    def indices_by_type(
        self, type_: Literal["function", "class", "methods", "properties"]
    ) -> set[int]:
        """Return registry indices matching the given entry type."""
        return self._indices_by_type.get(type_, set())

    def indices_by_owner_class(self, class_name: str) -> set[int]:
        """Return registry indices for members belonging to the given class."""
        return self._indices_by_owner_class.get(class_name, set())

    def search_full_corpus(
        self,
        queries: list[str],
        *,
        exclude_index: set[int] | None = None,
        bm25_top_k: int = 5,
        faiss_top_k: int = 5,
        faiss_threshold: int = 45,
    ) -> CorpusHits:
        return self._hybrid_search(
            search_engines=self._full_corpus_engine,
            queries=queries,
            exclude_index=exclude_index,
            bm25_top_k=bm25_top_k,
            faiss_top_k=faiss_top_k,
            faiss_threshold=faiss_threshold,
            sub_corpus=None,  # no sub corpus this is a full search
        )

    def search_subcorpus(
        self,
        corpus_name: str,
        queries: list[str],
        *,
        exclude_index: set[int] | None = None,
        bm25_top_k: int = 5,
        faiss_top_k: int = 5,
        faiss_threshold: int = 45,
    ) -> CorpusHits:
        if corpus_name not in self._sub_corpus_engines:
            raise ValueError(
                f"Sub-corpus '{corpus_name}' not found. Available: {list(self._sub_corpus_engines.keys())}"
            )
        sub_corpus = self._registry.sub_corpus_groups[corpus_name]
        return self._hybrid_search(
            search_engines=self._sub_corpus_engines[corpus_name],
            queries=queries,
            exclude_index=exclude_index,
            bm25_top_k=bm25_top_k,
            faiss_top_k=faiss_top_k,
            faiss_threshold=faiss_threshold,
            sub_corpus=sub_corpus,  # maps local -> global s this is a sub copus seaarch
        )

    def _hybrid_search(
        self,
        *,
        search_engines: CorpusIndexEngine,
        queries: list[str],
        exclude_index: set[int] | None = None,
        bm25_top_k: int = 5,
        faiss_top_k: int = 5,
        faiss_threshold: int = 45,
        sub_corpus: SubCorpus | None = None,
    ) -> CorpusHits:
        """Unified search: nouns through BM25 heavy, queries through FAISS heavy."""
        exclude_index = exclude_index or set()
        results: CorpusHits = {}

        def _update_results_with_search(local_idx: int) -> None:
            _index = sub_corpus.to_parent_index(local_idx) if sub_corpus else local_idx
            if _index not in exclude_index:
                doc = self._registry.search_corpus.documents[_index]
                parsed_key = self._registry.parse_key(
                    self._registry.search_corpus.keys[_index]
                )
                sig_key = (
                    "return_type"
                    if parsed_key.member_type == "properties"
                    else "signature"
                )
                index_obj_signature = self._registry.lookup_index_registry(
                    key=parsed_key
                ).get(sig_key, "")
                self._update_corpushits(
                    results,
                    _index,
                    doc,
                    index_obj_signature,
                    parsed_key,  # type: ignore[arg-type]
                )

        if bm25_top_k:
            for query in queries:
                for idx, _ in search_engines.bm25_engine.search(
                    query, top_k=bm25_top_k
                ):
                    _update_results_with_search(idx)

        # breakpoint()
        if faiss_top_k:
            faiss_hits = search_engines.faiss_engine.search(
                queries, top_k=faiss_top_k, threshold_percent=faiss_threshold
            )
            for _, hit_indexes in faiss_hits:
                for idx in hit_indexes:
                    _update_results_with_search(idx)

        return results

    def rerank_coupus_hits(
        self,
        queries: list[str],
        corpus_hits: CorpusHits,
        rerank_top_k: int = 10,
    ) -> None:
        items_list = list(corpus_hits.items())
        documents = [entry["doc"] for _, entry in items_list]
        # Every query paired with every doc
        query_doc_pairs = [(q, doc) for q in queries for doc in documents]
        # new_q_p =[("search for reboot device wait for DOCSIS registration online",d) for d in documents]

        # total pairs = len(queries) * len(documents)

        # all scores
        # [0.9, 0.1, 0.3, ..., 0.2, 0.8, 0.1, ...]  shape: (n_queries * n_docs,)
        if not self._cross_encoder:
            raise Exception(
                "CROSS ENDODER NOT DEFINED .. THIS IS NEEDED TO BE IMPLEMENTE I FORGOT "
            )
        flat_scores = self._cross_encoder.predict(
            query_doc_pairs, show_progress_bar=True
        )
        # flat_scores = self._cross_encoder.predict(new_q_p,show_progress_bar=True)

        # Reshape flat scores into a grid of (queries `x` docs)
        #           doc_0   doc_1   doc_2  ...
        # query_0  [[ 0.9,    0.1,    0.3,   ...],
        # query_1   [ 0.2,    0.8,    0.1,   ...],]
        scores_per_query = flat_scores.reshape(len(queries), len(documents))

        # doc_0 got [0.9, 0.2, 0.1] from 3 queries → keep 0.9
        # "relevant if ANY query matches"
        best_score_per_doc = scores_per_query.max(axis=0)  # shape: (n_docs,)

        # Get doc indices sorted by score, highest first
        # [0, 1, 3, 2] means: doc_0 is best, then doc_1, then doc_3, then doc_2
        ranked_doc_indices = np.argsort(best_score_per_doc)[::-1][:rerank_top_k]

        reranked: CorpusHits = {}
        for i in ranked_doc_indices:
            corpus_index, entry = items_list[i]  # map back to original corpus index
            reranked[corpus_index] = entry

    # def module_context_search(self,queries:list[str],faiss_top_k=4,faiss_threshold=35):s
    #     seen_idx = set()
    #     retrived_context: list[str] = []
    #     faiss_hits = self.module_faiss_engine.search(
    #         queries, top_k=faiss_top_k,threshold_percent=faiss_threshold
    #         )
    #     for _, hit_indexes in faiss_hits:
    #         for idx in hit_indexes:
    #             if idx  not in seen_idx:
    #                 seen_idx.add(idx)
    #             retrived_context.append(self._registry.module_corpus.documents[idx])
    #     return retrived_context
