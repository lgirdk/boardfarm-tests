"""FastAPI application factory.

Run from the REPO ROOT (the project's one invariant):
    uvicorn api.app:app --host 0.0.0.0 --port 8080
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.orchestrator import Orchestrator

# from .middleware import make_auth_middleware
from .routers import codegen

# loggging  .....
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP: same init as main.py, once, before first request ──
    logger.info("Initializing orchestrator...")
    orc = Orchestrator("configs/app.toml")  # CWD-relative: we always run from root
    app.state.orchestrator = orc
    logger.info("Orchestrator ready.")
    yield
    # ── SHUTDOWN: cleanup hooks go here if the engine ever needs them ──


app = FastAPI(
    title="boardfarm-ai",
    version="0.1.0",
    description="Code generation engine — HTTP interface",
    lifespan=lifespan,
)

# app.middleware("http")(make_auth_middleware())   # auth first, before routing
app.include_router(codegen.router)  # like include('codegen.urls')


@app.get("/health")
def health():
    """Public liveness probe — Docker HEALTHCHECK hits this."""
    return {"status": "ok"}
