"""Tests for src/search_store/utils.py.

Covers checksum_encode_crc32, extract_meaningful_doc, key parsing, and
StubCodeRegistry build/load/lookup flows using a temp stubs JSON.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from boardfarm_api.ai_engine.search_store.data_models import SubCorpus
from boardfarm_api.ai_engine.search_store.utils import (
    GroupNameAlreadyExist,
    StubCodeRegistry,
    checksum_encode_crc32,
    extract_meaningful_doc,
)

# ----------------------------- Pure helpers -----------------------------


class TestChecksumEncodeCrc32:
    def test_returns_int(self):
        assert isinstance(checksum_encode_crc32("hello"), int)

    def test_deterministic(self):
        assert checksum_encode_crc32("x") == checksum_encode_crc32("x")

    def test_different_inputs_different_outputs(self):
        assert checksum_encode_crc32("a") != checksum_encode_crc32("b")

    def test_empty_string(self):
        assert checksum_encode_crc32("") == 0


class TestExtractMeaningfulDoc:
    def test_empty_returns_empty(self):
        assert extract_meaningful_doc("") == ""

    def test_simple_text_preserved(self):
        assert extract_meaningful_doc("Hello world.") == "Hello world."

    def test_stops_at_sphinx_field(self):
        text = "This is the doc.\n:param x: some param\nignored"
        out = extract_meaningful_doc(text)
        assert "This is the doc." in out
        assert "ignored" not in out
        assert "param" not in out

    def test_stops_at_sphinx_directive(self):
        text = "Real doc here.\n.. note::\nsome note"
        out = extract_meaningful_doc(text)
        assert "Real doc here." in out
        assert "note" not in out

    def test_truncates_at_50_words(self):
        text = " ".join(f"word{i}" for i in range(80))
        out = extract_meaningful_doc(text)
        assert len(out.split()) == 50

    def test_collapses_whitespace(self):
        out = extract_meaningful_doc("a   b\t\tc\n\nd")
        # Multiple spaces collapsed to one
        assert "  " not in out


# ----------------------------- StubCodeRegistry parse_key -----------------------------


class TestParseKey:
    def _reg(self, tmp_path: Path) -> StubCodeRegistry:
        # No need for stub_index_path to exist for parse_key
        return StubCodeRegistry(
            stub_index_path=tmp_path / "doesnt_exist.json",
            artifacts_path=tmp_path / "artifacts",
        )

    def test_root_key(self, tmp_path):
        reg = self._reg(tmp_path)
        pk = reg.parse_key("repo1@module__path::usecases::do_thing")
        assert pk.repo == "repo1"
        assert (
            pk.file_key == "module__path"
        )  # nope — KEY_PATTERN matches [\w]+ for file
        # Actually KEY_PATTERN file segment is [\w]+ which matches one segment
        # Wait: [\w]+ matches letters, digits, underscore — so "module__path" is one match
        assert pk.category == "usecases"
        assert pk.callable_name == "do_thing"
        assert pk.member_type is None
        assert pk.member_name is None

    def test_member_method_key(self, tmp_path):
        reg = self._reg(tmp_path)
        pk = reg.parse_key("repo@file::cat::Cls::methods::reboot")
        assert pk.member_type == "methods"
        assert pk.member_name == "reboot"
        assert pk.root_index_key == "repo@file::cat::Cls"

    def test_member_property_key(self, tmp_path):
        reg = self._reg(tmp_path)
        pk = reg.parse_key("r@f::c::Cls::properties::ip")
        assert pk.member_type == "properties"
        assert pk.member_name == "ip"

    def test_invalid_format_raises(self, tmp_path):
        reg = self._reg(tmp_path)
        with pytest.raises(ValueError, match="Invalid key format"):
            reg.parse_key("not a valid key")


# ----------------------------- StubCodeRegistry build/load -----------------------------


@pytest.fixture
def written_stub_index_with_class_and_function(tmp_path: Path) -> Path:
    """Stub JSON file with a class (with methods + properties) and a function."""
    data = {
        "use_cases": [
            {
                "type": "function",
                "name": "do_thing",
                "file": "my_pkg/usecases/things.py",
                "import": "from my_pkg.usecases.things import do_thing",
                "signature": "() -> None",
                "docstring": "Do a thing.",
            }
        ],
        "templates": [
            {
                "type": "class",
                "name": "MyDevice",
                "file": "my_pkg/templates/device.py",
                "import": "from my_pkg.templates.device import MyDevice",
                "docstring": "A device.",
                "methods": [
                    {
                        "name": "reboot",
                        "signature": "(self)",
                        "docstring": "Reboot.",
                    }
                ],
                "properties": [
                    {
                        "name": "ip",
                        "return_type": "str",
                        "docstring": "IP address.",
                    }
                ],
            }
        ],
        "_meta": [],  # underscore prefix → ignored
    }
    p = tmp_path / "stubs.json"
    p.write_text(json.dumps(data))
    return p


class TestStubCodeRegistryBuild:
    def test_properties_raise_before_load(self, tmp_path):
        reg = StubCodeRegistry(
            stub_index_path=tmp_path / "no.json",
            artifacts_path=tmp_path / "a",
        )
        with pytest.raises(ValueError, match="not build or loaded"):
            _ = reg.search_corpus
        with pytest.raises(ValueError, match="not build or loaded"):
            _ = reg.index_registry
        with pytest.raises(ValueError, match="not build or loaded"):
            _ = reg.module_corpus

    def test_sub_corpus_groups_initially_empty(self, tmp_path):
        reg = StubCodeRegistry(
            stub_index_path=tmp_path / "no.json",
            artifacts_path=tmp_path / "a",
        )
        assert reg.sub_corpus_groups == {}

    def test_registry_exists_false_initially(self, tmp_path):
        reg = StubCodeRegistry(
            stub_index_path=tmp_path / "no.json",
            artifacts_path=tmp_path / "a",
        )
        assert reg.registry_exists() is False

    def test_build_populates_corpora(
        self, written_stub_index_with_class_and_function, tmp_path
    ):
        reg = StubCodeRegistry(
            stub_index_path=written_stub_index_with_class_and_function,
            artifacts_path=tmp_path / "artifacts",
        )
        reg.build()
        sc = reg.search_corpus
        # function + class + 1 method + 1 property = 4 entries
        assert len(sc.documents) == 4
        assert len(sc.keys) == 4
        # Check that all keys parse
        for k in sc.keys:
            pk = reg.parse_key(k)
            assert pk.repo == "my_pkg"

    def test_build_skips_underscore_prefixed_categories(
        self, written_stub_index_with_class_and_function, tmp_path
    ):
        reg = StubCodeRegistry(
            stub_index_path=written_stub_index_with_class_and_function,
            artifacts_path=tmp_path / "artifacts",
        )
        reg.build()
        for k in reg.search_corpus.keys:
            assert "::_meta::" not in k

    def test_save_then_load(self, written_stub_index_with_class_and_function, tmp_path):
        reg1 = StubCodeRegistry(
            stub_index_path=written_stub_index_with_class_and_function,
            artifacts_path=tmp_path / "artifacts",
        )
        reg1.build()
        original_keys = reg1.search_corpus.keys
        original_docs = reg1.search_corpus.documents

        # New instance loads from disk
        reg2 = StubCodeRegistry(
            stub_index_path=written_stub_index_with_class_and_function,
            artifacts_path=tmp_path / "artifacts",
        )
        reg2.load_registry()
        assert reg2.search_corpus.keys == original_keys
        assert reg2.search_corpus.documents == original_docs

    def test_load_or_build_loads_if_present(
        self, written_stub_index_with_class_and_function, tmp_path
    ):
        reg1 = StubCodeRegistry(
            stub_index_path=written_stub_index_with_class_and_function,
            artifacts_path=tmp_path / "artifacts",
        )
        reg1.build()

        reg2 = StubCodeRegistry(
            stub_index_path=written_stub_index_with_class_and_function,
            artifacts_path=tmp_path / "artifacts",
        )
        reg2.load_or_build()
        assert len(reg2.search_corpus.keys) == 4

    def test_load_or_build_builds_if_missing(
        self, written_stub_index_with_class_and_function, tmp_path
    ):
        # No prebuilt files
        reg = StubCodeRegistry(
            stub_index_path=written_stub_index_with_class_and_function,
            artifacts_path=tmp_path / "artifacts",
        )
        reg.load_or_build()
        assert len(reg.search_corpus.keys) == 4
        assert reg.registry_exists()

    def test_load_registry_missing_files_raises(self, tmp_path):
        reg = StubCodeRegistry(
            stub_index_path=tmp_path / "stubs.json",
            artifacts_path=tmp_path / "empty_artifacts",
        )
        with pytest.raises(FileNotFoundError):
            reg.load_registry()

    def test_load_registry_corrupted_json_raises(
        self,
        written_stub_index_with_class_and_function,
        tmp_path,
    ):
        reg = StubCodeRegistry(
            stub_index_path=written_stub_index_with_class_and_function,
            artifacts_path=tmp_path / "artifacts",
        )
        reg.build()
        # Corrupt one of the registry files
        corrupted = tmp_path / "artifacts" / "STUB_CODE_REGISTRY" / "SEARCH_TEXT.JSON"
        corrupted.write_text("not valid json{{{")

        reg2 = StubCodeRegistry(
            stub_index_path=written_stub_index_with_class_and_function,
            artifacts_path=tmp_path / "artifacts",
        )
        with pytest.raises(ValueError, match="corrupted"):
            reg2.load_registry()


# ----------------------------- lookup_index_registry -----------------------------


class TestLookupIndexRegistry:
    @pytest.fixture
    def built_reg(self, written_stub_index_with_class_and_function, tmp_path):
        reg = StubCodeRegistry(
            stub_index_path=written_stub_index_with_class_and_function,
            artifacts_path=tmp_path / "artifacts",
        )
        reg.build()
        return reg

    def test_lookup_function_root(self, built_reg):
        key = "my_pkg@usecases__things::use_cases::do_thing"
        e = built_reg.lookup_index_registry(key, only_root=True)
        assert e["name"] == "do_thing"
        assert e["type"] == "function"

    def test_lookup_class_root(self, built_reg):
        key = "my_pkg@templates__device::templates::MyDevice"
        e = built_reg.lookup_index_registry(key, only_root=True)
        assert e["name"] == "MyDevice"
        assert e["type"] == "class"

    def test_lookup_method_member(self, built_reg):
        key = "my_pkg@templates__device::templates::MyDevice::methods::reboot"
        e = built_reg.lookup_index_registry(key, only_root=False)
        assert e["name"] == "reboot"
        assert "signature" in e

    def test_lookup_property_member(self, built_reg):
        key = "my_pkg@templates__device::templates::MyDevice::properties::ip"
        e = built_reg.lookup_index_registry(key, only_root=False)
        assert e["name"] == "ip"

    def test_lookup_unknown_member_raises_keyerror(self, built_reg):
        key = "my_pkg@templates__device::templates::MyDevice::methods::nope"
        with pytest.raises(KeyError):
            built_reg.lookup_index_registry(key, only_root=False)

    def test_lookup_with_parsed_key_directly(self, built_reg):
        pk = built_reg.parse_key("my_pkg@usecases__things::use_cases::do_thing")
        e = built_reg.lookup_index_registry(pk, only_root=True)
        assert e["name"] == "do_thing"


# ----------------------------- build_sub_corpus_groups -----------------------------


class TestBuildSubCorpusGroups:
    @pytest.fixture
    def built_reg(self, written_stub_index_with_class_and_function, tmp_path):
        reg = StubCodeRegistry(
            stub_index_path=written_stub_index_with_class_and_function,
            artifacts_path=tmp_path / "artifacts",
        )
        reg.build()
        return reg

    def test_creates_sub_corpus_with_matching_entries(self, built_reg):
        sc = built_reg.build_sub_corpus_groups(
            "use_cases_only",
            selector_fn=lambda pk: pk.category == "use_cases",
        )
        assert isinstance(sc, SubCorpus)
        assert len(sc.documents) == 1  # only the function
        assert len(sc.keys) == 1
        assert len(sc.parent_indices) == 1

    def test_empty_when_no_match(self, built_reg):
        sc = built_reg.build_sub_corpus_groups(
            "empty",
            selector_fn=lambda pk: pk.category == "nonexistent",
        )
        assert sc.documents == []
        assert sc.keys == []
        assert sc.parent_indices == []

    def test_rejects_duplicate_group_name(self, built_reg):
        built_reg.build_sub_corpus_groups("g1", selector_fn=lambda pk: True)
        with pytest.raises(GroupNameAlreadyExist):
            built_reg.build_sub_corpus_groups("g1", selector_fn=lambda pk: True)

    def test_parent_indices_correctly_map_back(self, built_reg):
        sc = built_reg.build_sub_corpus_groups(
            "use_cases_only",
            selector_fn=lambda pk: pk.category == "use_cases",
        )
        for local_idx, parent_idx in enumerate(sc.parent_indices):
            # Sub key matches the parent key at the parent_idx
            assert sc.keys[local_idx] == built_reg.search_corpus.keys[parent_idx]

    def test_stores_in_sub_corpus_groups_dict(self, built_reg):
        built_reg.build_sub_corpus_groups("g1", selector_fn=lambda pk: True)
        assert "g1" in built_reg.sub_corpus_groups
