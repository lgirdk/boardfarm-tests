from __future__ import annotations

import json
import logging
import re
import zlib
from collections.abc import Callable
from pathlib import Path
from typing import Literal, cast, overload

from .custome_types import Index, IndexEntry, MethodEntry, PropertyEntry
from .data_models import ParsedKey, RawStubIndex, SearchPairs, SubCorpus

LOGGER = logging.getLogger(__name__)


def checksum_encode_crc32(string: str) -> int:
    return zlib.crc32(string.encode("utf-8"))


class GroupNameAlreadyExist(Exception):
    """Raised when the group name is already present in the corpus."""


def extract_meaningful_doc(docstring: str) -> str:
    if not docstring:
        return ""
    # Stop at any line that starts with : followed by a word (sphinx field)
    # or .. followed by a word (sphinx directive)
    lines = docstring.split("\n")
    meaningful_lines = []

    for line in lines:
        stripped = line.strip()
        # Sphinx field — :param, :type, :return, :raises, :var, :meta, etc.
        if re.match(r"^:", stripped):
            break
        # Sphinx directive — .. hint::, .. code-block::, .. note::, etc.
        if re.match(r"^\.\.\s+\w+", stripped):
            break
        meaningful_lines.append(stripped)

    text = " ".join(meaningful_lines).strip()
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text)
    # Truncate if too long
    words = text.split()
    if len(words) > 50:
        text = " ".join(words[:50])

    return text


class ImplCodeRegistry:
    """code implementatinos registry and utilities."""


class StubCodeRegistry:
    KEY_PATTERN = re.compile(
        r"^(?P<repo>[\w*-]+)@(?P<file>[\w]+)::(?P<category>[\w]+)::(?P<name>[\w]+)(?:::(?P<member_type>methods|properties)::(?P<member_name>[\w]+))?$"
    )
    REGISTRY_FOLDER = "STUB_CODE_REGISTRY"
    SEARCH_TEXT = "SEARCH_TEXT.JSON"
    SEARCH_KEY = "SEARCH_KEY.JSON"
    INDEX_REGISTRY = "INDEX_REGISTRY.JSON"
    MODULE_SEARCH_TEXT = "MODULE_SEARCH_TEXT.JSON"
    MODULE_SEARCH_KEY = "MODULE_SEARCH_KEY.JSON"
    SEARCH_DOC_TEXT_SEP = " | "
    # SUB_CORPORA_FILE = "SUB_CORPORA.JSON"

    def __init__(self, *, stub_index_path: Path, artifacts_path: Path):
        self.registry_path: Path = artifacts_path / self.REGISTRY_FOLDER
        self._stub_index_path = stub_index_path

        self._index_registry: Index = {}
        self._search_corpus: SearchPairs | None = None
        self._module_corpus: SearchPairs | None = None
        self._sub_corpora: dict[str, SubCorpus] = {}

    @property
    def search_corpus(self) -> SearchPairs:
        if not self._search_corpus:
            raise ValueError("registry not build or loaded")
        return self._search_corpus

    @property
    def index_registry(self) -> Index:
        if not self._index_registry:
            raise ValueError("registry not build or loaded")
        return self._index_registry

    @property
    def module_corpus(self) -> SearchPairs:
        if not self._module_corpus:
            raise ValueError("registry not build or loaded")
        return self._module_corpus

    @property
    def sub_corpus_groups(self) -> dict[str, SubCorpus]:
        return self._sub_corpora

    def registry_exists(self) -> bool:
        """Check if all registry files are present on disk."""
        return all(
            (self.registry_path / f).exists()
            for f in (self.SEARCH_TEXT, self.SEARCH_KEY, self.INDEX_REGISTRY)
        )

    def load_registry(self) -> None:
        """Loads the available registry from artifacts into memory."""

        search_text_path = self.registry_path / self.SEARCH_TEXT
        search_key_path = self.registry_path / self.SEARCH_KEY
        index_registry_path = self.registry_path / self.INDEX_REGISTRY
        module_search_key_path = self.registry_path / self.MODULE_SEARCH_KEY
        module_search_text_path = self.registry_path / self.MODULE_SEARCH_TEXT
        # sub_corpora_path =  self.registry_path / self.SUB_CORPORA_FILE

        for path in (
            search_text_path,
            search_key_path,
            index_registry_path,
            module_search_key_path,
            module_search_text_path,
        ):
            if not path.exists():
                raise FileNotFoundError(
                    f"Registry file not found at {path}. Run build() first."
                )

        try:
            self._search_corpus = SearchPairs(
                documents=json.loads(search_text_path.read_text()),
                keys=json.loads(search_key_path.read_text()),
            )
            self._index_registry = json.loads(index_registry_path.read_text())
            self._module_corpus = SearchPairs(
                documents=json.loads(module_search_text_path.read_text()),
                keys=json.loads(module_search_key_path.read_text()),
            )

            # category_data:dict[str,SubCorpusPairType] =  json.loads(sub_corpora_path.read_text())
            # for category ,values in category_data.items():
            #     self._sub_corpora[category] = SubCorpus.from_dict(values)

        except json.JSONDecodeError as e:
            raise ValueError(
                f"Registry files corrupted at {self.registry_path}. "
                f"Run build() first. Details: {e}"
            ) from None

    def build(self) -> None:
        self._build_registry()
        self._save_registry()

    def load_or_build(self) -> None:
        """Load registry from disk if available, otherwise build fresh."""
        try:
            self.load_registry()
            LOGGER.info("*********** Registry loaded from disk.***********")
        except FileNotFoundError as e:
            LOGGER.info(f"*********** Registry not found — building.{e}***********")
            self.build()

    def build_sub_corpus_groups(
        self,
        group_name: str,
        selector_fn: Callable[[ParsedKey], bool],
    ) -> SubCorpus:
        if group_name in self._sub_corpora:
            raise GroupNameAlreadyExist(
                f"The name {group_name} alredy exists, clean the corpa"
            )

        doc = []
        s_key = []
        parent_idx = []
        for idx, value in enumerate(
            zip(self.search_corpus.keys, self.search_corpus.documents, strict=True)
        ):
            key, value_text = value
            p_key = self.parse_key(key=key)
            if selector_fn(p_key):
                doc.append(value_text)
                s_key.append(key)
                parent_idx.append(idx)
        self._sub_corpora[group_name] = SubCorpus(
            documents=doc, keys=s_key, parent_indices=parent_idx
        )
        return self._sub_corpora[group_name]

    def _save_registry(self) -> None:
        """Saves the registry artifacts to disk."""

        search_text_path = self.registry_path / self.SEARCH_TEXT
        search_key_path = self.registry_path / self.SEARCH_KEY
        index_registry_path = self.registry_path / self.INDEX_REGISTRY
        module_search_key = self.registry_path / self.MODULE_SEARCH_KEY
        module_search_text = self.registry_path / self.MODULE_SEARCH_TEXT
        # SUB_corpora_path =  self.registry_path / self.SUB_CORPORA_FILE

        self.registry_path.mkdir(parents=True, exist_ok=True)

        try:
            with open(search_text_path, "w") as f:
                json.dump(self.search_corpus.documents, f, indent=4)

            with open(search_key_path, "w") as f:
                json.dump(self.search_corpus.keys, f, indent=4)

            with open(index_registry_path, "w") as f:
                json.dump(self.index_registry, f, indent=4)

            with open(module_search_key, "w") as f:
                json.dump(self.module_corpus.keys, f, indent=4)

            with open(module_search_text, "w") as f:
                json.dump(self.module_corpus.documents, f, indent=4)

            # with open(SUB_corpora_path, "w") as f:
            #     _category_dump:dict[str,SubCorpusPairType] = {}
            #     for key, value in self._sub_corpora.items():
            #         _category_dump[key] = value.to_dict()

            #     json.dump(_category_dump, f, indent=4)

        except OSError as e:
            raise OSError(
                f"Failed to save registry to {self.registry_path}. Details: {e}"
            ) from e

    def _build_embed_text(
        self, code_obj: IndexEntry | MethodEntry | PropertyEntry, parent: str = ""
    ) -> str:
        """Build the text string that gets embedded for semantic search."""
        name = code_obj.get("name", "")
        hints = self.SEARCH_DOC_TEXT_SEP.join(code_obj.get("hints") or [])  # type: ignore[arg-type]
        docstring = code_obj.get("docstring") or ""
        # docstring = docstring.strip().split(".")[0].strip()
        docstring = extract_meaningful_doc(docstring)
        full_name = f"{parent}.{name}" if parent else name

        parts = [full_name]
        if docstring:
            parts.append(docstring)
        if hints:
            parts.append(hints)

        return self.SEARCH_DOC_TEXT_SEP.join(parts)

    def _build_stub_key(
        self,
        code_obj: IndexEntry | MethodEntry | PropertyEntry,
        category: str,
        parent: str = "",
    ) -> str:
        """Build unique hierarchical key for this entry."""
        name = code_obj.get("name", "")

        if parent:
            return f"{category}::{parent}::{name}"
        return f"{category}::{name}"

    def _build_module_pairs(self) -> SearchPairs:
        LOGGER.info("======== building the module pairs ===============")
        modules_to_entry_map: dict[str, list[str]] = {}
        _doccuments = []
        _keys = []
        for index_key, entry_value in self.index_registry.items():
            key = self.parse_key(index_key)
            callable_name = key.callable_name
            file_path_key = key.file_path
            # docstring  =  extract_meaningful_doc(entry_value['docstring'] if entry_value["docstring"] else "")
            docstring = (
                entry_value["docstring"].split(".")[0]
                if entry_value["docstring"]
                else ""
            )
            search_key = f"{callable_name}: {docstring}" if docstring else callable_name
            modules_to_entry_map.setdefault(file_path_key, []).append(search_key)

        for k, value in modules_to_entry_map.items():
            _keys.append(k)
            _doccuments.append(". ".join(list(value)))

        return SearchPairs(documents=_doccuments, keys=_keys)

    def parse_key(self, key: str) -> ParsedKey:
        matched = self.KEY_PATTERN.match(key)
        if not matched:
            raise ValueError(f"Invalid key format: '{key}'")

        repo = matched.group("repo")
        file_key = matched.group("file")
        category = matched.group("category")
        callable_name = matched.group("name")
        member_type = cast(
            Literal["methods", "properties"] | None, matched.group("member_type")
        )
        member_name = matched.group("member_name")
        return ParsedKey(
            raw_key=key,
            root_index_key=f"{repo}@{file_key}::{category}::{callable_name}",
            repo=repo,
            file_key=file_key,
            category=category,
            callable_name=callable_name,
            member_type=member_type,
            member_name=member_name,
            file_path_sep="__",
        )

    @overload
    def lookup_index_registry(
        self,
        key: str | ParsedKey,
        only_root: Literal[True],  # no default
    ) -> IndexEntry: ...

    @overload
    def lookup_index_registry(
        self,
        key: str | ParsedKey,
        only_root: Literal[False] = ...,  # default here
    ) -> IndexEntry | MethodEntry | PropertyEntry: ...

    def lookup_index_registry(
        self, key: str | ParsedKey, only_root: bool = False
    ) -> IndexEntry | MethodEntry | PropertyEntry:
        if not isinstance(key, ParsedKey):
            p_key = self.parse_key(key)
        else:
            p_key = key

        if only_root or not p_key.is_member:
            return self._index_registry[p_key.root_index_key]

        if p_key.member_type is None:
            raise Exception(f"for the key {key} the membertype is not found or None")

        members = self._index_registry[p_key.root_index_key][p_key.member_type]
        for member in members:
            if member["name"] == p_key.member_name:
                return member
        else:
            raise KeyError(f"{key} not found in the index corpus")

    def _build_registry(self) -> None:
        """
        Walk the stub index and produce two parallel lists:
        search_texts[i] → the string to embed
        search_keys[i]   → the unique key to look up after FAISS|BM25 returns position i

        These lists are positionally aligned:
        search_texts[5] and search_keys[5] refer to the same stub entry.

        key_styles
        repo @ file :: category :: name :: member_type :: member_name
        """
        LOGGER.info(
            "================= building the stub registry ========================="
        )
        with open(self._stub_index_path) as fd:
            raw_data: dict[str, list[dict]] = json.load(fd)

        clean = {k: v for k, v in raw_data.items() if not k.startswith("_")}
        stub_idx = RawStubIndex.model_validate(clean).root

        search_texts: list[str] = []
        search_keys: list[str] = []

        for category, code_list in stub_idx.items():
            for code_obj_model in code_list:
                code_obj: IndexEntry = code_obj_model.model_dump(by_alias=False)  # type: ignore[assignment]
                file_path = code_obj.get("file", "")
                file_parts = Path(file_path).parts
                repo = file_parts[0] if file_path else "unknown"
                file_name = (
                    "__".join(p.split(".")[0] for p in file_parts[1:])
                    if file_path
                    else "unknown"
                )
                scoped_category = f"{repo}@{file_name}::{category}"
                name = code_obj["name"]
                _search_key = self._build_stub_key(code_obj, scoped_category)
                self._index_registry[_search_key] = code_obj
                search_texts.append(self._build_embed_text(code_obj))
                search_keys.append(_search_key)

                for method in code_obj.get("methods") or []:
                    parent = f"{name}::methods"
                    search_texts.append(self._build_embed_text(method, parent=name))
                    search_keys.append(
                        self._build_stub_key(method, scoped_category, parent=parent)
                    )

                for prop in code_obj.get("properties") or []:
                    parent = f"{name}::properties"
                    search_texts.append(self._build_embed_text(prop, parent=name))
                    search_keys.append(
                        self._build_stub_key(prop, scoped_category, parent=parent)
                    )

        assert len(search_texts) == len(search_keys), (
            f"Mismatch: {len(search_texts)} texts vs {len(search_keys)} keys"
        )
        self._search_corpus = SearchPairs(documents=search_texts, keys=search_keys)
        self._module_corpus = self._build_module_pairs()
