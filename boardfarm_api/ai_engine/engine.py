"""AI Engine bootstrap — initializes LLM pool, search store, and codegen app
from TOML configuration. This is the entry point for all AI-powered features
(code generation, log analysis, planning)."""

from __future__ import annotations

import logging
import tomllib
from pathlib import Path

from pydantic import BaseModel, ConfigDict, field_validator

from boardfarm_api.ai_engine.codegen.codegen_app import CodegenApp
from boardfarm_api.ai_engine.llm import LLM_CLIENT_REGISTRY, LLMPool
from boardfarm_api.ai_engine.llm.anthropic import AnthropicClient
from boardfarm_api.ai_engine.llm.config_schema import LLMConfig
from boardfarm_api.ai_engine.llm.custome_openi_gpt4o_client import CustomeOpenAIGPT4oClient
from boardfarm_api.ai_engine.llm.openai_llm import OpenAIClient
from boardfarm_api.ai_engine.search_store import SearchStoreService

LOGGER = logging.getLogger(__name__)

# ======================================= REGISTRY =========================================

LLM_CLIENT_REGISTRY.register("sonnet", AnthropicClient, override=True)
LLM_CLIENT_REGISTRY.register("custome_gpt4o", CustomeOpenAIGPT4oClient, override=True)
LLM_CLIENT_REGISTRY.register("openai_llm", OpenAIClient, override=True)
LLM_CLIENT_REGISTRY.register("gemma4_26B_8bit", CustomeOpenAIGPT4oClient, override=True)

# ===========================================================================================


class _StrictModelParam(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SearchStoreConfigPath(_StrictModelParam):
    store_config_path: Path

    @field_validator("store_config_path")
    @classmethod
    def must_exist(cls, v: Path) -> Path:
        if not v.exists():
            raise ValueError(f"Path does not exist: {v}")
        return v

class CodegenConfigPath(_StrictModelParam):
    """All the app level path configs."""
    pipeline_config_path: Path
    search_settings_path: Path

    @field_validator("pipeline_config_path", "search_settings_path")
    @classmethod
    def must_exist(cls, v: Path) -> Path:
        if not v.exists():
            raise ValueError(f"Path does not exist: {v}")
        return v

class AppConfig(_StrictModelParam):
    llm: dict[str, LLMConfig]
    search_store: SearchStoreConfigPath
    codegen: CodegenConfigPath


class Engine:
    """AI Engine — the entry point for code generation, search, and analysis.

    Initializes the LLM pool, search store, and codegen app from TOML config.
    Created once during app lifespan, shared across all requests via app.state.
    """

    def __init__(self, app_config_path: str | Path) -> None:
        LOGGER.info(
            "**** INITIALIZING THE AI ENGINE *****\n"
            f"LOADING APP CONFIG FROM: {app_config_path}"
        )
        self.app_config_path = app_config_path
        with open(app_config_path, "rb") as fd:
            self.app_config = AppConfig.model_validate(tomllib.load(fd))

        # getting the infra services
        LOGGER.info("***** GETTING LLM POOL *****")
        self.llm_pool = LLMPool(configs=self.app_config.llm)
        LOGGER.info("***** GETTING STORE SERVICE *****")
        self.search_store_service = SearchStoreService.from_toml(
            path=self.app_config.search_store.store_config_path
        )

        # building codegen app
        LOGGER.info("***** BUILDING CODEGEN APP *****")

        self.codegen_app = CodegenApp.build(
            pipeline_config_toml_path=self.app_config.codegen.pipeline_config_path,
            search_config_toml_path=self.app_config.codegen.search_settings_path,
            search_store=self.search_store_service,
            llm_pool=self.llm_pool,
        )

        LOGGER.info("*** AI ENGINE INITIALIZED SUCCESSFULLY ***")


# Backward compat alias
Orchestrator = Engine


if __name__ == "__main__":
    Engine("configs/app.toml")
