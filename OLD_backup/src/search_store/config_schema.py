from __future__ import annotations

import tomllib
from pathlib import Path
from typing import TYPE_CHECKING, Annotated, Literal, Protocol, Self, runtime_checkable

from pydantic import BaseModel, ConfigDict, Discriminator, field_validator

from .encoders import OpenAIEncoder, SentenceTransformerEncoder

if TYPE_CHECKING:
    from .encoders import EncoderModelProtocol


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


# STORE SETTINGS


class _StubRegistryConfig(_StrictModel):
    stub_index_path: Path

    @field_validator("stub_index_path")
    @classmethod
    def must_exist(cls, v: Path) -> Path:
        if not v.exists():
            raise ValueError(f"Path does not exist: {v}")
        return v


class _StoreConfig(_StrictModel):
    artifacts_path: Path
    stub_registry: _StubRegistryConfig


# ENCODER CONFIGS — one per encoder


@runtime_checkable
class EncoderConfigProtocol(Protocol):
    def build(self) -> EncoderModelProtocol: ...


class _SentenceTransformerConfig(_StrictModel):
    encoder_type: Literal["sentence_transformer"] = "sentence_transformer"
    model_path: str
    local_files_only: bool = False
    batch_size: int = 32
    query_prefix: str = ""
    passage_prefix: str = ""

    def build(self) -> EncoderModelProtocol:
        return SentenceTransformerEncoder(
            model_path=self.model_path,
            local_files_only=self.local_files_only,
            batch_size=self.batch_size,
            query_prefix=self.query_prefix,
            passage_prefix=self.passage_prefix,
        )


class _OpenAIEncoderConfig(_StrictModel):
    encoder_type: Literal["openai"] = "openai"
    model: str = "text-embedding-3-small"
    api_key_env: str
    # future: dimensions, encoding_format, etc.

    def build(self) -> EncoderModelProtocol:
        return OpenAIEncoder(model=self.model, api_key_env=self.api_key_env)


_EncoderEntry = Annotated[
    _SentenceTransformerConfig | _OpenAIEncoderConfig,
    Discriminator("encoder_type"),
]


class _SearchFilter(_StrictModel):
    repo_priority_order: list[str]
    exclude_repos: list[str]


# ROOT CONFIG


class StoreConfig(_StrictModel):
    store: _StoreConfig
    encoders: dict[str, _EncoderEntry]
    filters: _SearchFilter

    @classmethod
    def from_toml(cls, path: str | Path) -> Self:
        with open(path, "rb") as f:
            data = tomllib.load(f)
        return cls.model_validate(data)

    def build_encoder(self, encoder_name: str) -> EncoderModelProtocol:
        if encoder_name not in self.encoders:
            raise ValueError(
                f"Encoder name'{encoder_name}' not found in store_config. "
                f"Available encoders: {list(self.encoders.keys())}. "
                f"Add it under [encoders.*] in store_config.toml."
            )
        selected_encoder = self.encoders[encoder_name]
        if not isinstance(selected_encoder, EncoderConfigProtocol):
            raise RuntimeError(
                f"Encoder config '{encoder_name}' does not implement build(). "
                f"All encoder config classes must have a build() method."
            )
        return selected_encoder.build()
