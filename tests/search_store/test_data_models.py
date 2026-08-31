"""Tests for src/search_store/data_models.py."""

from __future__ import annotations

import pytest

from boardfarm_api.ai_engine.search_store.data_models import (
    IndexEntryModel,
    MethodEntryModel,
    ParsedKey,
    PropertyEntryModel,
    PropertyStub,
    RawStubIndex,
    ResolvedIndexStubEntry,
    RootIndexStubEntry,
    SearchPairs,
    StubDetails,
    SubCorpus,
)

# ----------------------------- ParsedKey -----------------------------


class TestParsedKey:
    def _make_root(self) -> ParsedKey:
        return ParsedKey(
            raw_key="repo1@my__module::usecases::do_thing",
            root_index_key="repo1@my__module::usecases::do_thing",
            repo="repo1",
            file_key="my__module",
            category="usecases",
            callable_name="do_thing",
        )

    def _make_member(self) -> ParsedKey:
        return ParsedKey(
            raw_key="repo1@my__module::templates::MyCls::methods::do_x",
            root_index_key="repo1@my__module::templates::MyCls",
            repo="repo1",
            file_key="my__module",
            category="templates",
            callable_name="MyCls",
            member_type="methods",
            member_name="do_x",
        )

    def test_is_member_false_for_root(self):
        assert self._make_root().is_member is False

    def test_is_member_true_for_member(self):
        assert self._make_member().is_member is True

    def test_parent_search_key_for_root_is_none(self):
        assert self._make_root().parent_search_key is None

    def test_parent_search_key_for_member_returns_root(self):
        m = self._make_member()
        assert m.parent_search_key == "repo1@my__module::templates::MyCls"

    def test_root_search_key_always_returns_root(self):
        assert (
            self._make_root().root_search_key == "repo1@my__module::usecases::do_thing"
        )
        assert (
            self._make_member().root_search_key == "repo1@my__module::templates::MyCls"
        )

    def test_search_key_returns_raw(self):
        assert self._make_member().search_key == self._make_member().raw_key

    def test_file_path_replaces_separator(self):
        assert self._make_root().file_path == "my/module"

    def test_file_name_returns_last_segment(self):
        assert self._make_root().file_name == "module"


# ----------------------------- SearchPairs / SubCorpus -----------------------------


class TestSearchPairs:
    def test_construction(self):
        sp = SearchPairs(documents=["d1"], keys=["k1"])
        assert sp.documents == ["d1"]
        assert sp.keys == ["k1"]

    def test_frozen(self):
        sp = SearchPairs(documents=[], keys=[])
        with pytest.raises(Exception):  # noqa: B017
            sp.documents = ["x"]  # type: ignore[misc]


class TestSubCorpus:
    def test_to_parent_index(self):
        sc = SubCorpus(documents=[], keys=[], parent_indices=[10, 20, 30])
        assert sc.to_parent_index(0) == 10
        assert sc.to_parent_index(2) == 30

    def test_to_search_pairs(self):
        sc = SubCorpus(documents=["a"], keys=["k"], parent_indices=[0])
        sp = sc.to_search_pairs()
        assert isinstance(sp, SearchPairs)
        assert sp.documents == ["a"]
        assert sp.keys == ["k"]

    def test_to_dict_and_from_dict_roundtrip(self):
        sc = SubCorpus(documents=["d"], keys=["k"], parent_indices=[5])
        d = sc.to_dict()
        sc2 = SubCorpus.from_dict(d)
        assert sc2 == sc


# ----------------------------- Pydantic models -----------------------------


class TestPydanticEntryModels:
    def test_property_entry_model_defaults(self):
        m = PropertyEntryModel(name="x")
        assert m.return_type is None
        assert m.tags == []

    def test_method_entry_model_defaults(self):
        m = MethodEntryModel(name="x")
        assert m.signature is None
        assert m.docstring is None

    def test_index_entry_model_uses_import_alias(self):
        m = IndexEntryModel.model_validate(
            {
                "type": "class",
                "name": "Cls",
                "file": "f.py",
                "import": "from m import Cls",
            }
        )
        assert m.import_ == "from m import Cls"

    def test_index_entry_model_full(self):
        m = IndexEntryModel.model_validate(
            {
                "type": "function",
                "name": "fn",
                "file": "x.py",
                "import": "import x",
                "signature": "() -> None",
                "docstring": "d",
                "module": "x",
                "hints": ["h"],
                "tags": ["t"],
            }
        )
        assert m.signature == "() -> None"
        assert m.hints == ["h"]


class TestRawStubIndex:
    def test_validates_dict_of_categories(self):
        data = {
            "usecases": [
                {
                    "type": "function",
                    "name": "fn",
                    "file": "f.py",
                    "import": "import fn",
                }
            ]
        }
        idx = RawStubIndex.model_validate(data)
        assert "usecases" in idx.root
        assert len(idx.root["usecases"]) == 1


# ----------------------------- StubDetails -----------------------------


class TestStubDetailsFromIndexEntry:
    def test_function_minimal(self):
        entry = {
            "type": "function",
            "name": "fn",
            "file": "f.py",
            "import_": "import fn",
        }
        sd = StubDetails.from_index_entry(entry)
        assert sd.type == "function"
        assert sd.name == "fn"
        assert sd.signature == ""
        assert sd.methods == []
        assert sd.properties == []

    def test_class_with_methods_and_properties(self):
        entry = {
            "type": "class",
            "name": "Cls",
            "file": "f.py",
            "import_": "import Cls",
            "methods": [
                {"name": "m1", "signature": "(self)", "docstring": "d", "tags": ["a"]}
            ],
            "properties": [
                {"name": "p1", "return_type": "str", "docstring": "doc", "tags": []}
            ],
            "bases": ["Base"],
            "fields": {"f": "int"},
            "hints": ["h"],
        }
        sd = StubDetails.from_index_entry(entry)
        assert sd.methods[0].name == "m1"
        assert sd.methods[0].signature == "(self)"
        # Property's signature comes from return_type
        assert sd.properties[0].signature == "str"
        assert sd.bases == ["Base"]
        assert sd.fields == {"f": "int"}


# ----------------------------- RootIndexStubEntry / ResolvedIndexStubEntry -----------------------------


class TestRootIndexStubEntry:
    def test_has_type_class(self):
        pk = ParsedKey(
            raw_key="r@f::c::n",
            root_index_key="r@f::c::n",
            repo="r",
            file_key="f",
            category="c",
            callable_name="n",
        )
        cls_stub = StubDetails(
            type="class", name="C", file="x.py", import_stmt="import C"
        )
        fn_stub = StubDetails(
            type="function", name="f", file="x.py", import_stmt="import f"
        )
        assert (
            RootIndexStubEntry(parsed_key=pk, root_stub=cls_stub).has_type_class is True
        )
        assert (
            RootIndexStubEntry(parsed_key=pk, root_stub=fn_stub).has_type_class is False
        )


class TestResolvedIndexStubEntryBuild:
    def test_root_function_no_member(self):
        entry = {
            "type": "function",
            "name": "fn",
            "file": "x.py",
            "import_": "import fn",
        }
        pk = ParsedKey(
            raw_key="r@x::c::fn",
            root_index_key="r@x::c::fn",
            repo="r",
            file_key="x",
            category="c",
            callable_name="fn",
        )
        r = ResolvedIndexStubEntry.build(entry, pk)
        assert r.searched_details_if_is_member is None
        assert r.is_member is False
        assert r.has_type_class is False

    def test_member_method_found(self):
        entry = {
            "type": "class",
            "name": "Cls",
            "file": "x.py",
            "import_": "import Cls",
            "methods": [{"name": "do_x", "signature": "(self)"}],
            "properties": [],
        }
        pk = ParsedKey(
            raw_key="r@x::c::Cls::methods::do_x",
            root_index_key="r@x::c::Cls",
            repo="r",
            file_key="x",
            category="c",
            callable_name="Cls",
            member_type="methods",
            member_name="do_x",
        )
        r = ResolvedIndexStubEntry.build(entry, pk)
        assert r.is_member is True
        assert r.searched_details_if_is_member is not None
        assert r.searched_details_if_is_member.name == "do_x"

    def test_member_property_found(self):
        entry = {
            "type": "class",
            "name": "Cls",
            "file": "x.py",
            "import_": "import Cls",
            "methods": [],
            "properties": [{"name": "ip", "return_type": "str"}],
        }
        pk = ParsedKey(
            raw_key="r@x::c::Cls::properties::ip",
            root_index_key="r@x::c::Cls",
            repo="r",
            file_key="x",
            category="c",
            callable_name="Cls",
            member_type="properties",
            member_name="ip",
        )
        r = ResolvedIndexStubEntry.build(entry, pk)
        assert isinstance(r.searched_details_if_is_member, PropertyStub)
        assert r.searched_details_if_is_member.name == "ip"

    def test_member_not_found_returns_none(self):
        entry = {
            "type": "class",
            "name": "Cls",
            "file": "x.py",
            "import_": "import Cls",
            "methods": [],
            "properties": [],
        }
        pk = ParsedKey(
            raw_key="r@x::c::Cls::methods::missing",
            root_index_key="r@x::c::Cls",
            repo="r",
            file_key="x",
            category="c",
            callable_name="Cls",
            member_type="methods",
            member_name="missing",
        )
        r = ResolvedIndexStubEntry.build(entry, pk)
        assert r.searched_details_if_is_member is None
