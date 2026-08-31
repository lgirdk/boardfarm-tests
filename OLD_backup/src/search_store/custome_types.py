from typing import Literal, TypedDict


class PropertyEntry(TypedDict):
    name: str
    return_type: str
    docstring: str
    tags: list[str]


class MethodEntry(TypedDict):
    name: str
    signature: str
    docstring: str
    tags: list[str]


class BaseIndexEntry(TypedDict):
    # mandatory
    type: Literal["function", "class"]
    name: str
    import_: str  # 'import' is reserved
    file: str


class IndexEntry(BaseIndexEntry, total=False):
    # optional — not always present
    signature: str
    docstring: str
    module: str
    hints: list[str]

    bases: list[str]
    tags: list[str]
    fields: dict[str, str]
    properties: list[PropertyEntry]
    methods: list[MethodEntry]


# outer dict
Index = dict[str, IndexEntry]


class _CorpusHitEntry(TypedDict):
    doc: str  # this is the doccument tht is used aginst  search
    category: str
    signature: str
    repo_name: str
    root_name: str
    file_name: str
    file_path: str


CorpusHits = dict[int, _CorpusHitEntry]


class SubCorpusPairType(TypedDict):
    documents: list[str]
    keys: list[str]
    parent_indices: list[int]
