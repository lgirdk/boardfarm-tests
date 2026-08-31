from __future__ import annotations

import tomllib
from pathlib import Path
from typing import TYPE_CHECKING, Annotated, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Discriminator,
    Tag,
    model_validator,
    field_validator,
)

from src.search_store.selectors import (
    combine_and,
    select_by_categories,
    select_by_modules,
    select_by_repos,
)

from .enums import CodegenPromptVariant

if TYPE_CHECKING:
    from src.search_store import Selector


class _strictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _TomlLoadMixin(_strictModel):
    @classmethod
    def load_from_toml(cls, path: str | Path) -> Self:
        with open(path, "rb") as f:
            return cls.model_validate(tomllib.load(f))


#### configuratinos verifications ####

# ── codegen.toml ──────────────────────────────────────────────────────────────


class StageConfig(_strictModel):
    llm: str
    profile: str


class StageSettings(_strictModel):
    temperature: float
    max_tokens: int


def _discriminate(v):  # type: ignore[no-untyped-def]
    if isinstance(v, dict):
        return "config" if "llm" in v else "settings"
    return "config" if isinstance(v, StageConfig) else "settings"


_StageField = Annotated[
    Annotated[StageConfig, Tag("config")] | Annotated[StageSettings, Tag("settings")],
    Discriminator(_discriminate),
]


class _CodegenStages(_strictModel):
    reasoning: _StageField
    search: _StageField
    generation: _StageField


class _ProfileConfig(_CodegenStages):
    description: str
    compatible_models: list[str]
    prompt_variant: CodegenPromptVariant


class CodeGenPipelineConfig(_TomlLoadMixin):
    domain_setup_entrypoint:str
    stages: _CodegenStages
    profiles: dict[str, _ProfileConfig]

    @model_validator(mode="after")
    def validate_stages(self) -> Self:
        for stage_name in _CodegenStages.model_fields:
            stage = getattr(self.stages, stage_name)
            if not isinstance(stage, StageConfig):
                continue
            if stage.profile not in self.profiles:
                raise ValueError(f"'{stage_name}': unknown profile '{stage.profile}'")
            profile = self.profiles[stage.profile]
            profile_settings = getattr(profile, stage_name)
            if not isinstance(profile_settings, StageSettings):
                raise ValueError(
                    f"'{stage_name}': profile '{stage.profile}' missing settings for this stage"
                )
        return self
    
    @field_validator("domain_setup_entrypoint")
    @classmethod
    def must_be_module_to_app_resolvable(cls, v: str) -> str:

        if v.strip() and (len(v.split(":")) != 2):
            raise ValueError(
                f"Invalid entrypoint '{v}' :-  must be in format 'module.path:object'"
                " or 'module:object' follow the paterns for uvicorn"
            )
        return v

    @classmethod
    def stage_names(cls) -> set[str]:
        return set(_CodegenStages.model_fields.keys())


# ── search.toml ──────────────────────────────────────────────────────────────

class _SearchStrategy(_strictModel):
    use_rrf_scoring: bool = True
    include_raw_search_text: bool = True
    final_review_enabled: bool = True
    keep_rounds: int = 0
    remove_rounds: int = 0


class _FullCorpusConfig(_strictModel):
    search_enabled: bool = True
    bm25_top_k: int = 10
    faiss_top_k: int = 10
    faiss_threshold: int = 35


class _SubCorpusGroupConfig(_strictModel):
    # Selectors available
    categories: list[str]
    repos: list[str]
    module_patterns: list[str]
    ### search tuning
    search_enabled: bool = True
    bm25_top_k: int = 5
    faiss_top_k: int = 5
    faiss_threshold: int = 45

    @model_validator(mode="after")
    def at_least_one_selector(self) -> Self:
        if not any((self.categories, self.repos, self.module_patterns)):
            raise ValueError(
                "At least one of categories, repos, or module_patterns must be provided"
            )
        return self

    def build_selector(self) -> Selector:
        selectors: list[Selector] = []
        if self.categories:
            selectors.append(select_by_categories(self.categories))
        if self.repos:
            selectors.append(select_by_repos(self.repos))
        if self.module_patterns:
            selectors.append(select_by_modules(self.module_patterns))
        if len(selectors) == 1:
            return selectors[0]
        return combine_and(*selectors)


class CodegenSearchSettings(_TomlLoadMixin):
    encoder: str
    strategy: _SearchStrategy
    full_corpus: _FullCorpusConfig
    sub_corpus_group: dict[str, _SubCorpusGroupConfig] = {}  # keyed by group name
