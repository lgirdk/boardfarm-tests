from __future__ import annotations

import importlib
import logging
from typing import TYPE_CHECKING, Self

from boardfarm_api.ai_engine.llm import LLM_CLIENT_REGISTRY
from boardfarm_api.ai_engine.llm.data_containers import LLMCallSettings

from .config_schema import CodeGenPipelineConfig, CodegenSearchSettings, StageSettings
from .data_models import (
    CodegenDomainSetup,
    ResolvedPipeline,
    ResolvedRuntimeCodeGenConfig,
    ResolvedStage,
)
from .driver_agent import DriverAgent

if TYPE_CHECKING:
    from pathlib import Path

    from boardfarm_api.ai_engine.llm import LLMPool
    from boardfarm_api.ai_engine.llm.templates import LLMClientTemplate
    from boardfarm_api.ai_engine.search_store import SearchStoreService

    from .data_models import CodegenInput
    from .enums import CodegenOutputType

Logger = logging.getLogger(__name__)


class CodegenApp:
    name = "codegen"

    def __init__(self, driver: DriverAgent):
        self.driver_agent = driver

    @classmethod
    def build(
        cls,
        *,
        pipeline_config_toml_path: Path,
        search_config_toml_path: Path,
        search_store: SearchStoreService,
        llm_pool: LLMPool,
    ) -> Self:

        codegen_config = CodeGenPipelineConfig.load_from_toml(pipeline_config_toml_path)
        search_config = CodegenSearchSettings.load_from_toml(search_config_toml_path)

        Logger.info(
            f"RESOLVING CODEGEN PIPELINE | STAGES: "
            f"{' , '.join(list(codegen_config.stages.model_dump().keys()))}"
        )

        stages_resolved = ResolvedPipeline.stage_names()
        stages_expected_in_config = CodeGenPipelineConfig.stage_names()
        if stages_resolved != stages_expected_in_config:
            raise ValueError(
                f"Unresolved stages: {stages_expected_in_config - stages_resolved}\n"
                "Check the implementation for the pydantic and the runtine config dataclass"
            )
        resolved_pipe_line = {}
        for stage, stage_conf in codegen_config.stages.model_dump().items():
            llm: str = stage_conf["llm"]
            _stage_profile: str = stage_conf["profile"]

            if llm not in LLM_CLIENT_REGISTRY:
                raise ValueError(
                    f"Stage '{stage}': LLM '{llm}' "
                    f"which has no registered implementation. "
                    f"Registered models: {LLM_CLIENT_REGISTRY.names}"
                )

            if llm not in llm_pool:
                raise ValueError(
                    f"Stage '{stage}' references LLM '{llm}' "
                    f"but it's not defined in app.toml [llm]. "
                    f"Available: {list(llm_pool.available())}"
                )
            client: LLMClientTemplate = llm_pool.get(llm)

            using_profile = codegen_config.profiles[_stage_profile]
            profile_settings_for_stage: StageSettings = getattr(using_profile, stage)
            llm_call_settings = LLMCallSettings(
                temperature=profile_settings_for_stage.temperature,
                max_tokens=profile_settings_for_stage.max_tokens,
            )
            resolved_pipe_line[stage] = ResolvedStage(
                llm=client,
                settings=llm_call_settings,
                prompt_variant=using_profile.prompt_variant,
            )
        domain_setup_entrypoint = codegen_config.domain_setup_entrypoint.strip()

        domain_setup: CodegenDomainSetup | None = None
        if domain_setup_entrypoint:
            module_path, application = domain_setup_entrypoint.split(":")
            try:
                module = importlib.import_module(module_path)
                domain_setup = getattr(module, application)
            except ImportError as e:
                raise ImportError(
                    f"Could not import module '{module_path}', error {e}"
                ) from e
            except AttributeError as ae:
                raise AttributeError(
                    f"'{application}' not found in module '{module_path}'"
                ) from ae

        runtime_config = ResolvedRuntimeCodeGenConfig(
            stage_config=ResolvedPipeline(**resolved_pipe_line),
            search_config=search_config,
            domain_setup=domain_setup,
        )
        Logger.info("CODEGEN PIPELINE CONFIG RESOLVED SUCCESSFULLY")
        sub_corpora = {
            name: sc.build_selector()
            for name, sc in search_config.sub_corpus_group.items()
            if sc.search_enabled
        }
        search_engine = search_store.build_stub_code_search_engine(
            encoder_name=search_config.encoder,
            subcorpus_groups=sub_corpora,
            cross_encoder_name=None,
        )
        Logger.info("SEARCH ENGINE BUILT SUCCESSFULLY")
        driver = DriverAgent(
            runtime_config=runtime_config,
            search_engine=search_engine,
        )
        Logger.info("CODEGEN DRIVER BUILT SUCCESSFULLY")
        return cls(driver=driver)

    def generate(
        self, input_: CodegenInput, output_task_type: CodegenOutputType
    ) -> str:
        return self.driver_agent.generate(input_, output_task_type)
