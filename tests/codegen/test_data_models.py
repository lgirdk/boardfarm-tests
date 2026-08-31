"""Tests for src/codegen/data_models.py."""

from __future__ import annotations

import pytest

from boardfarm_api.api.schemas.codegen import (
    CodegenJiraTestInputSchema as CodegenTestInput,
)
from boardfarm_api.api.schemas.codegen import (
    CodegenTextInput,
    _TestStep,
)
from boardfarm_api.ai_engine.codegen.data_models import (
    CodegenDomainSetup,
    CodegenPromptPair,
    ForceIncludeEntryHooksRegistry,
    IncludeEntry,
    PostSearchEntryHooksRegistry,
    _safe_format,
)
from boardfarm_api.ai_engine.codegen.enums import (
    CodegenOutputType,
    CodegenPromptStage,
    CodegenPromptVariant,
    EntryKind,
    IncludeEntryResolveStrategy,
)
from boardfarm_api.ai_engine.codegen.exceptions import IncludeEntryConfigChainError

# ----------------------------- IncludeEntry -----------------------------


class TestIncludeEntryBuilders:
    def test_by_api_names_single(self):
        e = IncludeEntry.by_api_names("foo")
        assert e.strategy == IncludeEntryResolveStrategy.BY_API_NAMES
        assert e.api_names == ("foo",)
        assert e.category is None
        assert e.repo is None

    def test_by_api_names_multiple(self):
        e = IncludeEntry.by_api_names("a", "b", "c")
        assert e.api_names == ("a", "b", "c")

    def test_by_api_names_empty_returns_tuple(self):
        e = IncludeEntry.by_api_names()
        assert e.api_names == ()

    def test_api_names_when_internal_is_none_returns_empty_tuple(self):
        e = IncludeEntry.by_category("foo")
        # _api_names is None for the by_category path
        assert e.api_names == ()

    def test_by_category(self):
        e = IncludeEntry.by_category("usecases")
        assert e.strategy == IncludeEntryResolveStrategy.BY_CATEGORY
        assert e.category == "usecases"

    def test_by_repo(self):
        e = IncludeEntry.by_repo("boardfarm")
        assert e.strategy == IncludeEntryResolveStrategy.BY_REPO
        assert e.repo == "boardfarm"

    def test_by_module_not_implemented(self):
        with pytest.raises(NotImplementedError):
            IncludeEntry.by_module("some.path")


class TestIncludeEntryChainModifiers:
    def test_of_type(self):
        e = IncludeEntry.by_api_names("foo").of_type(EntryKind.METHOD)
        assert e.entry_type == EntryKind.METHOD

    def test_in_category_chained_after_by_api_names(self):
        e = IncludeEntry.by_api_names("foo").in_category("usecases")
        assert e.category == "usecases"

    def test_in_category_rejects_when_already_in_by_category(self):
        e = IncludeEntry.by_category("usecases")
        with pytest.raises(IncludeEntryConfigChainError):
            e.in_category("other")

    def test_in_repo_chained_after_by_api_names(self):
        e = IncludeEntry.by_api_names("foo").in_repo("repo1")
        assert e.repo == "repo1"

    def test_in_repo_rejects_when_already_in_by_repo(self):
        e = IncludeEntry.by_repo("repo1")
        with pytest.raises(IncludeEntryConfigChainError):
            e.in_repo("repo2")

    def test_belongs_to_class_requires_method_or_property_kind(self):
        e = IncludeEntry.by_api_names("foo")
        with pytest.raises(IncludeEntryConfigChainError):
            e.belongs_to_class("MyClass")  # no kind set

        e2 = IncludeEntry.by_api_names("foo").of_type(EntryKind.CLASS)
        with pytest.raises(IncludeEntryConfigChainError):
            e2.belongs_to_class("MyClass")  # wrong kind

    def test_belongs_to_class_accepts_method(self):
        e = (
            IncludeEntry.by_api_names("foo")
            .of_type(EntryKind.METHOD)
            .belongs_to_class("MyClass")
        )
        assert e.parent_class == "MyClass"

    def test_belongs_to_class_accepts_property(self):
        e = (
            IncludeEntry.by_api_names("foo")
            .of_type(EntryKind.PROPERTY)
            .belongs_to_class("MyClass")
        )
        assert e.parent_class == "MyClass"

    def test_repr_includes_set_fields(self):
        e = (
            IncludeEntry.by_api_names("foo", "bar")
            .of_type(EntryKind.METHOD)
            .in_category("usecases")
            .in_repo("r1")
        )
        r = repr(e)
        assert "IncludeEntry" in r
        assert "api_names" in r
        assert "usecases" in r
        assert "r1" in r


# ----------------------------- CodegenTestInput / CodegenTextInput -----------------------------


class TestCodegenTestInput:
    def test_minimal(self):
        i = CodegenTestInput(
            name="t1",
            steps=[_TestStep(step_num=1, instruction="do thing")],
        )
        assert i.name == "t1"
        assert len(i.steps) == 1

    def test_full_prompt_text_includes_name_and_steps(self):
        i = CodegenTestInput(
            name="My test",
            description="A description",
            preconditions="pre",
            steps=[
                _TestStep(step_num=1, instruction="step one"),
                _TestStep(
                    step_num=2,
                    instruction="step two",
                    additional_info="extra",
                    expected_result="ok",
                ),
            ],
        )
        out = i.full_prompt_text
        assert "TEST NAME: My test" in out
        assert "DESCRIPTION: A description" in out
        assert "PRECONDITIONS: pre" in out
        assert "Step 1: step one" in out
        assert "Step 2: step two" in out
        assert "Additional Info: extra" in out
        assert "Expected Result: ok" in out

    def test_raw_search_texts_returns_instructions(self):
        i = CodegenTestInput(
            name="t",
            steps=[
                _TestStep(step_num=1, instruction="alpha"),
                _TestStep(step_num=2, instruction="beta"),
            ],
        )
        assert i.raw_search_texts == ["alpha", "beta"]

    def test_extra_fields_forbidden(self):
        with pytest.raises(Exception):  # noqa: B017
            CodegenTestInput(name="t", steps=[], unexpected="x")


class TestCodegenTextInput:
    def test_full_prompt_text(self):
        i = CodegenTextInput(name="task", text="raw body")
        assert i.full_prompt_text == "TASK: task\n\nraw body"

    def test_raw_search_texts(self):
        i = CodegenTextInput(name="task", text="content")
        assert i.raw_search_texts == ["content"]


# ----------------------------- _safe_format -----------------------------


class TestSafeFormat:
    def test_substitutes_known_keys(self):
        assert _safe_format("hello {name}", {"name": "world"}) == "hello world"

    def test_leaves_unknown_keys_intact(self):
        assert _safe_format("hi {missing}", {}) == "hi {missing}"

    def test_does_not_match_non_identifier_braces(self):
        # JSON-like content should be left alone
        text = '{"key": "value"}'
        assert _safe_format(text, {"key": "X"}) == text

    def test_does_not_match_braces_starting_with_digit(self):
        # `{1foo}` is not a valid identifier
        assert _safe_format("{1foo}", {"1foo": "x"}) == "{1foo}"

    def test_multiple_placeholders(self):
        out = _safe_format("{a}-{b}-{a}", {"a": "X", "b": "Y"})
        assert out == "X-Y-X"

    def test_substitutes_non_str_values_via_str(self):
        assert _safe_format("{n}", {"n": 42}) == "42"


# ----------------------------- CodegenPromptPair -----------------------------


class TestCodegenPromptPair:
    def test_format_system_substitutes(self):
        p = CodegenPromptPair(system_prompt="sys {x}", user_prompt="usr {x}")
        assert p.format_system(x="X") == "sys X"

    def test_format_user_substitutes(self):
        p = CodegenPromptPair(system_prompt="sys {x}", user_prompt="usr {x}")
        assert p.format_user(x="X") == "usr X"

    def test_unknown_placeholder_left_intact(self):
        p = CodegenPromptPair(system_prompt="{unknown}", user_prompt="{also}")
        assert p.format_system() == "{unknown}"
        assert p.format_user() == "{also}"


# ----------------------------- Hook registries -----------------------------


class TestForceIncludeEntryHooksRegistry:
    def test_register_appends(self):
        reg = ForceIncludeEntryHooksRegistry("test")

        def hook(analysis: str, input_text: str):
            return []

        result = reg.register(hook)
        assert result is hook  # decorator behavior
        assert reg.hooks == [hook]

    def test_register_multiple(self):
        reg = ForceIncludeEntryHooksRegistry("test")

        def h1(analysis: str, input_text: str):
            return []

        def h2(analysis: str, input_text: str):
            return []

        reg.register(h1)
        reg.register(h2)
        assert reg.hooks == [h1, h2]


class TestPostSearchEntryHooksRegistry:
    def test_register_appends(self):
        reg = PostSearchEntryHooksRegistry("test")

        def hook(analysis: str, input_text: str, selected_apis: set):
            return []

        result = reg.register(hook)
        assert result is hook
        assert reg.hooks == [hook]


# ----------------------------- CodegenDomainSetup -----------------------------


class TestCodegenDomainSetup:
    def test_defaults(self):
        ds = CodegenDomainSetup("boardfarm")
        assert ds.name == "boardfarm"
        assert ds.prompt_overrides == {}
        assert ds.force_include_entry_hooks == []
        assert ds.post_search_enricher_hooks == []
        assert ds.domain_knowledge is None
        assert ds.framework_rules is None

    def test_domain_context_data_default_placeholder(self):
        ds = CodegenDomainSetup("d")
        assert ds.domain_context_data == {
            "domain_knowledge": "Not Avaialble",
            "framework_rules": "Not Avaialble",
        }

    def test_set_domain_knowledge_and_framework_rules(self):
        ds = CodegenDomainSetup("d")
        ds.set_domain_knowledge("KNOW")
        ds.set_framework_rules("RULES")
        assert ds.domain_knowledge == "KNOW"
        assert ds.framework_rules == "RULES"
        assert ds.domain_context_data == {
            "domain_knowledge": "KNOW",
            "framework_rules": "RULES",
        }

    def test_register_force_include_entry_hook(self):
        ds = CodegenDomainSetup("d")

        def h(analysis: str, input_text: str):
            return []

        ret = ds.register_force_include_entry_hook(h)
        assert ret is h
        assert ds.force_include_entry_hooks == [h]

    def test_register_post_search_enricher_hook(self):
        ds = CodegenDomainSetup("d")

        def h(analysis: str, input_text: str, selected_apis: set):
            return []

        ret = ds.register_post_search_enricher_hook(h)
        assert ret is h
        assert ds.post_search_enricher_hooks == [h]

    def test_register_prompts(self):
        ds = CodegenDomainSetup("d")
        ds.register_prompts(
            prompt_stage=CodegenPromptStage.REASONING,
            prompt_variant=CodegenPromptVariant.STANDARD_BIG_MODELS,
            output_task_type=CodegenOutputType.PYTEST,
            system_prompt="sys",
            user_prompt="usr",
        )
        key = (
            CodegenPromptVariant.STANDARD_BIG_MODELS,
            CodegenPromptStage.REASONING,
            CodegenOutputType.PYTEST,
        )
        assert key in ds.prompt_overrides
        pair = ds.prompt_overrides[key]
        assert pair.system_prompt == "sys"
        assert pair.user_prompt == "usr"

    def test_register_hook_instance_absorbs_force_include(self):
        ds = CodegenDomainSetup("d")
        pre = ForceIncludeEntryHooksRegistry("pre")

        def h(analysis: str, input_text: str):
            return []

        pre.register(h)
        ds.register_hook_instance(pre)
        assert ds.force_include_entry_hooks == [h]

    def test_register_hook_instance_absorbs_post_search(self):
        ds = CodegenDomainSetup("d")
        post = PostSearchEntryHooksRegistry("post")

        def h(analysis: str, input_text: str, selected_apis: set):
            return []

        post.register(h)
        ds.register_hook_instance(post)
        assert ds.post_search_enricher_hooks == [h]

    def test_register_hook_instance_mixed(self):
        ds = CodegenDomainSetup("d")
        pre = ForceIncludeEntryHooksRegistry("pre")
        post = PostSearchEntryHooksRegistry("post")

        def h1(analysis: str, input_text: str):
            return []

        def h2(analysis: str, input_text: str, selected_apis: set):
            return []

        pre.register(h1)
        post.register(h2)

        ds.register_hook_instance(pre, post)
        assert ds.force_include_entry_hooks == [h1]
        assert ds.post_search_enricher_hooks == [h2]

    def test_register_hook_instance_rejects_unknown_type(self):
        ds = CodegenDomainSetup("d")
        with pytest.raises(TypeError, match="Expected"):
            ds.register_hook_instance("not a registry")  # type: ignore[arg-type]

    def test_set_prompt_enhancer_injector_before_codegen_not_implemented(self):
        ds = CodegenDomainSetup("d")
        with pytest.raises(NotImplementedError):
            ds.set_prompt_enhancer_injector_before_codegen()


# ----------------------------- CodegenInput abstract -----------------------------


class TestCodegenInputAbstractMethods:
    def test_full_prompt_text_raises_on_base(self):
        from boardfarm_api.ai_engine.codegen.data_models import CodegenInput

        i = CodegenInput(name="x")
        with pytest.raises(NotImplementedError):
            _ = i.full_prompt_text

    def test_raw_search_texts_raises_on_base(self):
        from boardfarm_api.ai_engine.codegen.data_models import CodegenInput

        i = CodegenInput(name="x")
        with pytest.raises(NotImplementedError):
            _ = i.raw_search_texts
