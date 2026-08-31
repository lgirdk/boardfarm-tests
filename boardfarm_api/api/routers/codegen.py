"""Codegen HTTP endpoints."""

from __future__ import annotations

import logging
import threading
from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, HTTPException
from boardfarm_api.ai_engine.codegen.enums import CodegenOutputType

from ..dependencies import get_ai_engine
from ..schemas.codegen import GenerateResponseSchema,CodegenJiraTestInputSchema

if TYPE_CHECKING:
    from boardfarm_api.ai_engine.engine import Engine as Orchestrator


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/boardfarm", tags=["bordfarm-codegen"])

_generate_lock = threading.Lock()


@router.post("/generate", response_model=GenerateResponseSchema)
def generate(
    payload: CodegenJiraTestInputSchema,
    orc: Orchestrator = Depends(get_ai_engine),
):
    # logger.info("generate: domain=%s task=%s", payload.domain, payload.task_type)
    try:
        with _generate_lock:
            code = orc.codegen_app.generate(
                payload, output_task_type=CodegenOutputType.PYTEST
            )
        return GenerateResponseSchema(status="ok", generated_code=str(code))
    except ValueError as e:
        # Bad input the schema couldn't catch (domain-level validation)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception:
        logger.exception("generation failed")
        # Don't leak internals to clients; the traceback is in the logs.
        raise HTTPException(
            status_code=500, detail="Generation failed. See server logs."
        ) from None
