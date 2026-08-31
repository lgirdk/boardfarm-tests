"""Tests for src/codegen/context_assembler.py."""

from __future__ import annotations

from boardfarm_api.api.schemas.codegen import CodegenTextInput
from boardfarm_api.ai_engine.codegen.context_assembler import (
    _format_class,
    _format_entry,
    _format_function,
    _format_template,
    assemble_context,
    consolidate_stubs,
)
from boardfarm_api.ai_engine.search_store.data_models import (
    MethodStub,
    ParsedKey,
    PropertyStub,
    ResolvedIndexStubEntry,
    StubDetails,
)


def _make_parsed_key(
    *,
    repo: str = "boardfarm",
    file_key: str = "my_module",
    category: str = "usecases",
    callable_name: str = "MyClass",
    member_type=None,
    member_name=None,
) -> ParsedKey:
    raw = f"{repo}@{file_key}::{category}::{callable_name}"
    if member_type and member_name:
        raw = f"{raw}::{member_type}::{member_name}"
    root = f"{repo}@{file_key}::{category}::{callable_name}"
    return ParsedKey(
        raw_key=raw,
        root_index_key=root,
        repo=repo,
        file_key=file_key,
        category=category,
        callable_name=callable_name,
        member_type=member_type,
        member_name=member_name,
    )


def _make_class_stub(
    name: str = "MyClass",
    methods: list | None = None,
    properties: list | None = None,
    **extra,
) -> StubDetails:
    return StubDetails(
        type="class",
        name=name,
        file=f"my_pkg/{name}.py",
        import_stmt=f"from my_pkg import {name}",
        methods=methods or [],
        properties=properties or [],
        **extra,
    )


def _make_function_stub(name: str = "do_thing", **extra) -> StubDetails:
    return StubDetails(
        type="function",
        name=name,
        file="my_pkg/funcs.py",
        import_stmt=f"from my_pkg.funcs import {name}",
        signature="(x: int) -> int",
        docstring="A function",
        **extra,
    )


# ----------------------------- consolidate_stubs -----------------------------


class TestConsolidateStubs:
    def test_empty_input_returns_empty_list(self):
        assert consolidate_stubs([]) == []

    def test_function_entries_passthrough(self):
        pk = _make_parsed_key(category="usecases", callable_name="do_thing")
        stub = _make_function_stub("do_thing")
        entry = ResolvedIndexStubEntry(parsed_key=pk, root_stub=stub)
        out = consolidate_stubs([entry])
        assert len(out) == 1
        assert out[0]["parsed_key"] is pk
        assert out[0]["root_stub"] is stub
        assert out[0]["selected_members"] == []

    def test_class_directly_selected_shows_empty_members(self):
        pk = _make_parsed_key()
        stub = _make_class_stub(
            methods=[MethodStub(name="m1", signature="()")],
        )
        entry = ResolvedIndexStubEntry(parsed_key=pk, root_stub=stub)
        out = consolidate_stubs([entry])
        assert len(out) == 1
        # directly_selected → empty selected_members so formatter shows all
        assert out[0]["selected_members"] == []

    def test_class_member_selected_collected_into_members(self):
        method = MethodStub(name="reboot", signature="()")
        pk = _make_parsed_key(member_type="methods", member_name="reboot")
        stub = _make_class_stub(methods=[method])
        entry = ResolvedIndexStubEntry(
            parsed_key=pk,
            root_stub=stub,
            searched_details_if_is_member=method,
        )
        out = consolidate_stubs([entry])
        assert len(out) == 1
        assert out[0]["selected_members"] == [method]

    def test_class_direct_plus_member_results_in_show_all(self):
        # If a class is directly selected AND has a member selected,
        # directly_selected wins → empty selected_members
        method = MethodStub(name="m1", signature="()")
        pk_root = _make_parsed_key()
        pk_member = _make_parsed_key(member_type="methods", member_name="m1")
        stub = _make_class_stub(methods=[method])
        entries = [
            ResolvedIndexStubEntry(parsed_key=pk_root, root_stub=stub),
            ResolvedIndexStubEntry(
                parsed_key=pk_member,
                root_stub=stub,
                searched_details_if_is_member=method,
            ),
        ]
        out = consolidate_stubs(entries)
        # Single entry for the class (deduplicated by root_search_key)
        assert len(out) == 1
        assert out[0]["selected_members"] == []  # show all because direct selection

    def test_multiple_member_selections_accumulate(self):
        m1 = MethodStub(name="m1", signature="()")
        m2 = MethodStub(name="m2", signature="()")
        stub = _make_class_stub(methods=[m1, m2])
        pk1 = _make_parsed_key(member_type="methods", member_name="m1")
        pk2 = _make_parsed_key(member_type="methods", member_name="m2")
        entries = [
            ResolvedIndexStubEntry(
                parsed_key=pk1, root_stub=stub, searched_details_if_is_member=m1
            ),
            ResolvedIndexStubEntry(
                parsed_key=pk2, root_stub=stub, searched_details_if_is_member=m2
            ),
        ]
        out = consolidate_stubs(entries)
        assert len(out) == 1
        assert out[0]["selected_members"] == [m1, m2]


# ----------------------------- _format_template -----------------------------


class TestFormatTemplate:
    def test_basic_class_template(self):
        stub = _make_class_stub(
            name="MyCls",
            docstring="doc",
            methods=[MethodStub(name="m", signature="(self)", tags=["x"])],
            properties=[PropertyStub(name="p", signature="str", tags=[])],
        )
        out = _format_template(stub)
        assert "MyCls" in out
        assert "type: class" in out
        assert "import:" in out
        assert "doc" in out
        assert "properties:" in out
        assert "p -> str" in out
        assert "methods:" in out
        assert "m(self) [x]" in out


# ----------------------------- _format_function -----------------------------


class TestFormatFunction:
    def test_with_docstring_and_hints(self):
        stub = _make_function_stub("fn", hints=["h1", "h2"])
        # Build a fake mapped entry
        mapped = {"parsed_key": None, "root_stub": stub, "selected_members": []}
        out = _format_function(mapped)
        assert "fn" in out
        assert "type: function" in out
        assert "signature: (x: int) -> int" in out
        assert "A function" in out
        assert "h1" in out

    def test_without_docstring(self):
        stub = StubDetails(
            type="function",
            name="fn",
            file="x.py",
            import_stmt="import x",
        )
        mapped = {"parsed_key": None, "root_stub": stub, "selected_members": []}
        out = _format_function(mapped)
        assert "fn" in out
        assert "docstring:" not in out


# ----------------------------- _format_class -----------------------------


class TestFormatClass:
    def test_class_with_no_selected_members_lists_all(self):
        stub = _make_class_stub(
            methods=[MethodStub(name="m1", signature="(self)")],
            properties=[PropertyStub(name="p1", signature="str")],
        )
        mapped = {"parsed_key": None, "root_stub": stub, "selected_members": []}
        out = _format_class(mapped)
        assert "MyClass" in out
        assert "type: class" in out
        assert "properties:" in out
        assert "p1 -> str" in out
        assert "methods:" in out
        assert "m1(self)" in out
        assert "selected:" not in out

    def test_class_with_selected_members_only(self):
        m1 = MethodStub(name="m1", signature="(self)")
        p1 = PropertyStub(name="p1", signature="str")
        stub = _make_class_stub(methods=[m1], properties=[p1])
        mapped = {
            "parsed_key": None,
            "root_stub": stub,
            "selected_members": [m1, p1],
        }
        out = _format_class(mapped)
        assert "selected:" in out
        assert "m1(self)" in out
        assert "p1 -> str" in out

    def test_class_with_bases_and_fields(self):
        stub = _make_class_stub(
            bases=["BaseA", "BaseB"],
            fields={"name": "str", "id": "int"},
            docstring="cls doc",
        )
        mapped = {"parsed_key": None, "root_stub": stub, "selected_members": []}
        out = _format_class(mapped)
        assert "bases: BaseA,BaseB" in out
        assert "class_variables:" in out
        assert "name -> str" in out


# ----------------------------- _format_entry dispatching -----------------------------


class TestFormatEntry:
    def test_dispatches_to_function(self):
        stub = _make_function_stub("fn")
        mapped = {"parsed_key": None, "root_stub": stub, "selected_members": []}
        out = _format_entry(mapped)
        assert "type: function" in out

    def test_dispatches_to_class(self):
        stub = _make_class_stub("Cls")
        mapped = {"parsed_key": None, "root_stub": stub, "selected_members": []}
        out = _format_entry(mapped)
        assert "type: class" in out


# ----------------------------- assemble_context -----------------------------


class TestAssembleContext:
    def test_groups_by_category(self):
        pk1 = _make_parsed_key(category="usecases", callable_name="fn1")
        pk2 = _make_parsed_key(category="templates", callable_name="Cls1")
        fn_stub = _make_function_stub("fn1")
        cls_stub = _make_class_stub("Cls1")
        entries = [
            ResolvedIndexStubEntry(parsed_key=pk1, root_stub=fn_stub),
            ResolvedIndexStubEntry(parsed_key=pk2, root_stub=cls_stub),
        ]

        text_input = CodegenTextInput(name="x", text="dummy")
        ctx = assemble_context(entries, text_input, "the analysis")

        assert ctx.input_object is text_input
        assert ctx.analysis == "the analysis"
        # Both categories present as section headers
        joined = "\n".join(ctx.retrieved_entries)
        assert "[USECASES]" in joined
        assert "[TEMPLATES]" in joined
        assert "fn1" in joined
        assert "Cls1" in joined
        # Imports collected
        assert any("fn1" in s for s in ctx.all_import_paths)
        assert "fn1" in ctx.all_function_names
        assert "Cls1" in ctx.all_function_names

    def test_empty_entries(self):
        text_input = CodegenTextInput(name="x", text="dummy")
        ctx = assemble_context([], text_input, "a")
        assert ctx.retrieved_entries == []
        assert ctx.all_import_paths == []
        assert ctx.all_function_names == []
        assert ctx.example_test == ""
