from __future__ import annotations

from typing import TYPE_CHECKING, TypedDict

from boardfarm_api.ai_engine.search_store.enum_types import MemberType
from boardfarm_api.ai_engine.search_store.utils import extract_meaningful_doc

from .data_models import CodeGenContext

if TYPE_CHECKING:
    from boardfarm_api.ai_engine.search_store.data_models import (
        MethodStub,
        ParsedKey,
        PropertyStub,
        ResolvedIndexStubEntry,
        StubDetails,
    )

    from .data_models import CodegenInput


class _MappedIndexedStubEntry(TypedDict):
    parsed_key: ParsedKey
    root_stub: StubDetails
    selected_members: list[MethodStub | PropertyStub]


def consolidate_stubs(
    entries: list[ResolvedIndexStubEntry],
) -> list[_MappedIndexedStubEntry]:
    all_mapped_entries: list[_MappedIndexedStubEntry] = []
    selcted_class_members_map: dict[str, list[MethodStub | PropertyStub]] = {}
    all_selected_classes: dict[str, tuple[ParsedKey, StubDetails]] = {}
    directly_selected_classes = set()
    for entry in entries:
        if entry.has_type_class:
            if entry.is_member:
                assert entry.searched_details_if_is_member is not None
                selcted_class_members_map.setdefault(
                    entry.parsed_key.root_search_key, []
                ).append(entry.searched_details_if_is_member)
            else:
                directly_selected_classes.add(entry.parsed_key.root_search_key)
            if entry.parsed_key.root_search_key not in all_selected_classes:
                all_selected_classes[entry.parsed_key.root_search_key] = (
                    entry.parsed_key,
                    entry.root_stub,
                )
        else:
            all_mapped_entries.append(
                _MappedIndexedStubEntry(
                    parsed_key=entry.parsed_key,
                    root_stub=entry.root_stub,
                    selected_members=[],
                )
            )

    for key, _entry in all_selected_classes.items():
        if key in directly_selected_classes:
            selected_members = []  # force empty → formatter shows all
        else:
            selected_members = selcted_class_members_map.get(key, [])
        parsed_key, stub_entry = _entry
        all_mapped_entries.append(
            _MappedIndexedStubEntry(
                parsed_key=parsed_key,
                root_stub=stub_entry,
                selected_members=selected_members,
            )
        )

    return all_mapped_entries


def _format_template(stub: StubDetails) -> str:
    lines = []

    # Name + tags
    tag_str = f" [{', '.join(stub.tags)}]" if stub.tags else ""
    lines.append("---")
    lines.append(f"{stub.name}{tag_str}")
    lines.append("type: class")
    lines.append(f"import: {stub.import_stmt}")
    if stub.docstring:
        lines.append(f"docstring: {stub.docstring}")

    # Properties
    if stub.properties:
        lines.append("properties:")
        for p in stub.properties:
            p_tag = f" [{', '.join(p.tags)}]" if p.tags else ""
            lines.append(f"  {p.name} -> {p.signature}{p_tag}")

    # Methods
    # \n  doc:{' '.join((m.docstring or '').split(' ')[:20])}
    if stub.methods:
        lines.append("methods:")
        for m in stub.methods:
            m_tag = f" [{', '.join(m.tags)}]" if m.tags else ""
            lines.append(f"  {m.name}{m.signature}{m_tag}")

    return "\n".join(lines)


def _format_function(mapped_index: _MappedIndexedStubEntry) -> str:
    stub = mapped_index["root_stub"]
    lines = []

    # Name + tags
    tag_str = f" [{', '.join(stub.tags)}]" if stub.tags else ""
    lines.append("---")
    lines.append(f"{stub.name}{tag_str}")
    lines.append("type: function")
    lines.append(f"import: {stub.import_stmt}")
    if stub.signature:
        lines.append(f"signature: {stub.signature}")
    if stub.docstring:
        doc_ = extract_meaningful_doc(stub.docstring)
        hints = "\n".join(stub.hints)
        lines.append(f"docstring: {doc_}\n  {hints}")

    return "\n".join(lines)


def _format_class(mapped_index: _MappedIndexedStubEntry) -> str:
    stub = mapped_index["root_stub"]
    lines = []
    methods = []
    properties = []

    # Name + tags
    tag_str = f" [{', '.join(stub.tags)}]" if stub.tags else ""
    lines.append("---")
    lines.append(f"{stub.name}{tag_str}")
    lines.append("type: class")
    lines.append(f"import: {stub.import_stmt}")
    if stub.docstring:
        lines.append(f"docstring: {stub.docstring}")
    if stub.bases:
        lines.append(f"bases: {','.join(stub.bases)}")
    if stub.fields:
        f = []
        for field, ret in stub.fields.items():
            f.append(f"{field} -> {ret}")
        lines.append(f"class_variables: {','.join(f)}")
    # doc:{' '.join((mem.docstring or '').split(' ')[:20])}
    if mapped_index["selected_members"]:
        for mem in mapped_index["selected_members"]:
            if mem.type_ == MemberType.is_method:
                m_tag = f" [{', '.join(mem.tags)}]" if mem.tags else ""
                methods.append(f"  {mem.name}{mem.signature}{m_tag}")
            if mem.type_ == MemberType.is_property:
                p_tag = f" [{', '.join(mem.tags)}]" if mem.tags else ""
                properties.append(f"  {mem.name} -> {mem.signature}{p_tag}")
        lines.append("selected:")
        if properties:
            joined_property = "\n".join(properties)
            lines.append(joined_property)
        if methods:
            joined_meth = "\n".join(methods)
            lines.append(joined_meth)

        # TODO this need to chnge somehow .. we nneddd to decide on what to give the LLm properly
        # if mapped_index["parsed_key"].category == "templates":
        #     selected_names = {m.name for m in mapped_index["selected_members"]}
        #     others = [m.name for m in stub.methods if m.name not in selected_names]
        #     others += [p.name for p in stub.properties if p.name not in selected_names]
        #     if others:
        #         lines.append(f"other available: {', '.join(others)}")

    else:
        if stub.properties:
            lines.append("properties:")
            for p in stub.properties:
                p_tag = f" [{', '.join(p.tags)}]" if p.tags else ""
                lines.append(f"  {p.name} -> {p.signature}{p_tag}")
        #   doc:{' '.join((m.docstring or '').split(' ')[:20])}
        if stub.methods:
            lines.append("methods:")
            for m in stub.methods:
                m_tag = f" [{', '.join(m.tags)}]" if m.tags else ""
                lines.append(f"  {m.name}{m.signature}{m_tag}")

    return "\n".join(lines)


def _format_entry(mapped_index: _MappedIndexedStubEntry) -> str:
    """Format any entry by type — function or class."""
    stub = mapped_index["root_stub"]
    if stub.type == "function":
        return _format_function(mapped_index)
    return _format_class(mapped_index)


def assemble_context(
    stub_entries: list[ResolvedIndexStubEntry],
    input_obj: CodegenInput,
    analysis: str,
) -> CodeGenContext:

    stub_group: dict[str, list[str]] = {}
    all_import_paths: list[str] = []
    all_function_names: list[str] = []
    all_formatted = []

    for stub in consolidate_stubs(stub_entries):
        key = stub["parsed_key"]
        root_stub = stub["root_stub"]
        stub_group.setdefault(key.category, []).append(_format_entry(stub))
        if root_stub.import_stmt:
            all_import_paths.append(root_stub.import_stmt)
        all_function_names.append(root_stub.name)

    for category, entries in stub_group.items():
        section = f"[{category.upper()}]\n{'\n'.join(entries)}"
        all_formatted.append(section)

    return CodeGenContext(
        input_object=input_obj,
        analysis=analysis,
        retrieved_entries=all_formatted,
        example_test="",
        all_import_paths=all_import_paths,
        all_function_names=all_function_names,
    )
    # ls =  usecases  + templates + supporting_utils + fixtures
    # text  =  "\n".join(usecases  + templates + supporting_utils + fixtures)
