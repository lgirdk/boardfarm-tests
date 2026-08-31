from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Literal, Self

from pydantic import BaseModel, Field, RootModel

from .enum_types import MemberType

if TYPE_CHECKING:
    from .bm25_search import BM25SearchEngine
    from .custome_types import IndexEntry, SubCorpusPairType
    from .faiss_embeddings import FaissIndexManager


#  these re used during validtinson of build phase
class PropertyEntryModel(BaseModel):
    model_config = {"extra": "allow"}
    name: str
    return_type: str | None = None
    docstring: str | None = None
    tags: list[str] = []


class MethodEntryModel(BaseModel):
    model_config = {"extra": "allow"}
    name: str
    signature: str | None = None
    docstring: str | None = None
    tags: list[str] = []


class IndexEntryModel(BaseModel):
    model_config = {"populate_by_name": True, "extra": "allow"}

    # mandatory
    type: Literal["function", "class"]
    name: str
    file: str
    import_: str = Field(alias="import")  #  change "import" to "import_"
    # optional
    docstring: str | None = None
    signature: str | None = None
    module: str | None = None
    hints: list[str] = []
    bases: list[str] = []
    tags: list[str] = []
    fields: dict[str, str] = {}
    methods: list[MethodEntryModel] = []
    properties: list[PropertyEntryModel] = []


# top level: category
RawStubIndex = RootModel[dict[str, list[IndexEntryModel]]]
#############


@dataclass(frozen=True)
class SearchPairs:
    """Two parallel lists aligned by position for any search backend.

    documents[i] and keys[i] always refer to the same entry.
    Compatible with FAISS, BM25, vector embeddings, KV stores, etc.

    Anyone can build on top of this — the structure only guarantees
    positional alignment between a searchable string and its key.
    """

    documents: list[str]
    keys: list[str]


@dataclass(frozen=True)
class SubCorpus(SearchPairs):
    """Filtered view of main search corpus for one category."""

    parent_indices: list[int]  # maps back to main search_corpus positions

    def to_parent_index(self, local_index: int) -> int:
        return self.parent_indices[local_index]

    def to_search_pairs(self) -> SearchPairs:
        """For passing to FaissIndexManager.load_or_build()"""
        return SearchPairs(documents=self.documents, keys=self.keys)

    def to_dict(self) -> dict:
        return {
            "documents": self.documents,
            "keys": self.keys,
            "parent_indices": self.parent_indices,
        }

    @classmethod
    def from_dict(cls, data: SubCorpusPairType) -> Self:
        return cls(**data)


@dataclass
class ParsedKey:
    raw_key: str
    root_index_key: str  # set by StubRegistry at parse time
    repo: str
    file_key: str
    category: str
    callable_name: str
    member_type: Literal["methods", "properties"] | None = None
    member_name: str | None = None
    file_path_sep: str = "__"

    @property
    def is_member(self) -> bool:
        return self.member_type is not None

    @property
    def parent_search_key(self) -> str | None:
        """Returns parent root key if this is a member, else None."""
        return self.root_index_key if self.is_member else None

    @property
    def root_search_key(self) -> str:
        """Always returns the root/parent search key.
        - member → parent class key
        - root   → itself
        """
        return self.root_index_key  # always root, never member key

    @property
    def search_key(self) -> str:
        """The exact key in the search corpus (FAISS/BM25).
        - member → member key
        - root   → root key
        """
        return self.raw_key

    @property
    def file_path(self) -> str:
        return self.file_key.replace(self.file_path_sep, "/")

    @property
    def file_name(self) -> str:
        return self.file_key.split(self.file_path_sep)[-1]


@dataclass
class PropertyStub:
    name: str
    signature: str = ""
    docstring: str = ""
    tags: list[str] = field(default_factory=list)
    type_: MemberType = MemberType.is_property


@dataclass
class MethodStub:
    name: str
    signature: str = ""
    docstring: str = ""
    tags: list[str] = field(default_factory=list)
    type_: MemberType = MemberType.is_method


@dataclass
class StubDetails:
    # mandatory
    type: Literal["function", "class"]
    name: str
    file: str
    # optional
    signature: str = ""
    docstring: str = ""
    module: str = ""
    import_stmt: str = ""  # renamed from 'import'
    hints: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    bases: list[str] = field(default_factory=list)
    fields: dict[str, str] = field(default_factory=dict)
    methods: list[MethodStub] = field(default_factory=list)
    properties: list[PropertyStub] = field(default_factory=list)

    @classmethod
    def from_index_entry(cls, entry: IndexEntry) -> Self:
        return cls(
            type=entry["type"],
            name=entry["name"],
            file=entry["file"],
            signature=entry.get("signature", ""),
            docstring=entry.get("docstring", ""),
            module=entry.get("module", ""),
            import_stmt=entry["import_"],
            hints=entry.get("hints", []),
            tags=entry.get("tags", []),
            bases=entry.get("bases", []),
            fields=entry.get("fields", {}),
            methods=[
                MethodStub(
                    name=m["name"],
                    signature=m.get("signature", ""),
                    docstring=m.get("docstring", ""),
                    tags=m.get("tags", []),
                )
                for m in entry.get("methods", [])
            ],
            properties=[
                PropertyStub(
                    name=p["name"],
                    signature=p.get("return_type", ""),
                    docstring=p.get("docstring", ""),
                    tags=p.get("tags", []),
                )
                for p in entry.get("properties", [])
            ],
        )


@dataclass
class RootIndexStubEntry:
    parsed_key: ParsedKey
    root_stub: StubDetails  # root class/function

    @property
    def has_type_class(self) -> bool:
        return self.root_stub.type == "class"


@dataclass
class ResolvedIndexStubEntry(RootIndexStubEntry):
    searched_details_if_is_member: MethodStub | PropertyStub | None = (
        None  # specific method if member_typess
    )

    @property
    def is_member(self) -> bool:
        return self.parsed_key.is_member

    @classmethod
    def build(cls, index_entry: IndexEntry, p_key: ParsedKey) -> Self:
        root_stub = StubDetails.from_index_entry(index_entry)

        searched: MethodStub | PropertyStub | None = None
        if p_key.is_member:
            if p_key.member_type == "methods":
                searched = next(
                    (m for m in root_stub.methods if m.name == p_key.member_name), None
                )
            else:
                searched = next(
                    (p for p in root_stub.properties if p.name == p_key.member_name),
                    None,
                )

        return cls(
            parsed_key=p_key,
            root_stub=root_stub,
            searched_details_if_is_member=searched,
        )


@dataclass
class CorpusIndexEngine:
    bm25_engine: BM25SearchEngine
    faiss_engine: FaissIndexManager
