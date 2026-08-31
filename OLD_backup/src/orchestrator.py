"""This file has the orchestrator class that manages codegemeratinos agens , env generation  and log analysys all separately"""

from __future__ import annotations

import logging
import tomllib
from pathlib import Path

from pydantic import BaseModel, ConfigDict, field_validator

from src.codegen.codegen_app import CodegenApp
from src.llm import LLM_CLIENT_REGISTRY, LLMPool
from src.llm.anthropic import AnthropicClient
from src.llm.config_schema import LLMConfig
from src.llm.custome_openi_gpt4o_client import CustomeOpenAIGPT4oClient
from src.llm.openai_llm import OpenAIClient
from src.search_store import SearchStoreService

LOGGER = logging.getLogger(__name__)

# TODO noisy libraries  will hcekc and silense it latter
# logging.getLogger("faiss.loader").setLevel(logging.WARNING)
# logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
# ======================================= REGISTRY =========================================

LLM_CLIENT_REGISTRY.register("sonnet", AnthropicClient, override=True)
LLM_CLIENT_REGISTRY.register("custome_gpt4o", CustomeOpenAIGPT4oClient, override=True)
LLM_CLIENT_REGISTRY.register("openai_llm", OpenAIClient, override=True)
LLM_CLIENT_REGISTRY.register("gemma4_26B_8bit", CustomeOpenAIGPT4oClient, override=True)

# ===========================================================================================


class _strictModelParam(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SearchStoreConfigPath(_strictModelParam):
    store_config_path: Path

    @field_validator("store_config_path")
    @classmethod
    def must_exist(cls, v: Path) -> Path:
        if not v.exists():
            raise ValueError(f"Path does not exist: {v}")
        return v

class CodegenConfigPath(_strictModelParam):
    """All the app level path configs."""
    pipeline_config_path: Path
    search_settings_path: Path

    @field_validator("pipeline_config_path", "search_settings_path")
    @classmethod
    def must_exist(cls, v: Path) -> Path:
        if not v.exists():
            raise ValueError(f"Path does not exist: {v}")
        return v    

class AppConfig(_strictModelParam):
    llm: dict[str, LLMConfig]
    search_store: SearchStoreConfigPath
    codegen: CodegenConfigPath


class Orchestrator:

    def __init__(self, app_config_path: str | Path) -> None:
        LOGGER.info(
            "**** INITIALIZING THE ORCHESTRATOR *****\n"
            f"LOADING APP CONFIG FROM: {app_config_path}"
        )
        self.app_config_path =  app_config_path
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

        LOGGER.info("*** ORCHESTRATOR INITIALIZED SUCCESSFULLY ***")

    # @property
    # def registry_config_file_map(self)->dict:
    #     res =  {}
    #     res["main_app"] = self.app_config_path
    #     for _ 

if __name__ == "__main__":
    Orchestrator("~/configs/app.toml")
