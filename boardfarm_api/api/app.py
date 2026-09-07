"""FastAPI application factory.

Run from the REPO ROOT (the project's one invariant):
    uvicorn api.app:app --host 0.0.0.0 --port 8080
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from boardfarm_api.ai_engine.engine import Engine as AIEngine

# from .middleware import make_auth_middleware
from .routers import codegen, login, runs

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
    logger.info("Initializing  AI ENGINE...")
    orc = AIEngine("configs/app.toml")  # CWD-relative: we always run from root
    app.state.ai_engine = orc
    logger.info(" AI ENGINE ready.")
    yield
    # ── SHUTDOWN: cleanup hooks go here if the engine ever needs them ──


app = FastAPI(
    title="boardfarm-api",
    version="0.1.0",
    description="Api layer for boardfarm",
    # lifespan=lifespan,
)

# app.middleware("http")(make_auth_middleware())   # auth first, before routing
app.include_router(login.router, prefix="/api")
app.include_router(codegen.router,prefix="/api")
app.include_router(runs.router,prefix="/api")


@app.get("/health")
def health():
    """Public liveness probe — Docker HEALTHCHECK hits this."""
    return {"status": "ok"}
