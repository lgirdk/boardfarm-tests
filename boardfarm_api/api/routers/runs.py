from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/runs", tags=["executions"])

RUNS_DIR = Path("runs_data")
RUNS_DIR.mkdir(exist_ok=True)
_CHUNK = 64 * 1024




class CreateRunRequest(BaseModel):
    tests: list[str] = Field(..., min_length=1)
    board_name: str = Field(default="CH7465LG-3-1")
    env_config: str | None = None


class RunState(BaseModel):
    id: str
    status: str 
    tests: list[str]
    board_name: str
    created_at: float
    console_lines: int = 0

_runs: dict[str, dict] = {}
_tasks: dict[str, asyncio.Task] = {}


def _log_path(run_id: str) -> Path:
    return RUNS_DIR / run_id / "console.log"

async def _execute(run_id: str) -> None:
    state = _runs[run_id]
    state["status"] = "running"
    ######
    # we can construct the pytest commnad here pytest command
    # cmd = ["pytest", f"--board-name={state['board_name']}"]
    # if state.get("env_config"):
    #     cmd.append(f"--env-config={state['env_config']}")
    # cmd.extend(state["tests"])

    breakpoint()
    # this is for testing 
    cmd =  [
    "timeout",
    "30",
    "bash",
    "-c",
    'i=1; while true; do echo "INFO: Testing streaming output $i"; i=$((i+1)); sleep 0.5; done'
    ]
    ########
    log_file = _log_path(run_id)
    log_file.parent.mkdir(parents=True, exist_ok=True)

    with open(log_file, "w") as f:
        f.write(f"$ {' '.join(cmd)}\n")

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=os.getcwd(),
        )

        async for raw in proc.stdout:
            line = raw.decode(errors="replace").rstrip()
            with open(log_file, "a") as f:
                f.write(line + "\n")
            state["console_lines"] += 1

        exit_code = await proc.wait()
        state["status"] = "passed" if exit_code == 0 else "failed"

    except asyncio.CancelledError:
        state["status"] = "failed"
    except Exception as e:
        raise RuntimeError("smthings went wrong") from e 

@router.post("", response_model=RunState)
async def create_run(req: CreateRunRequest) -> RunState:
    run_id = f"r-{uuid.uuid4().hex[:6]}"

    state = {
        "id": run_id,
        "status": "queued",
        "tests": req.tests,
        "board_name": req.board_name,
        "env_config": req.env_config,
        "created_at": time.time(),
        "console_lines": 0,
    }
    _runs[run_id] = state

    task = asyncio.create_task(_execute(run_id))
    _tasks[run_id] = task
    task.add_done_callback(lambda _: _tasks.pop(run_id, None))

    return RunState(**state)


@router.get("", response_model=list[RunState])
async def list_runs() -> list[RunState]:
    """List all runs, newest first."""
    return [
        RunState(**r)
        for r in sorted(_runs.values(), key=lambda r: r["created_at"], reverse=True)
    ]


@router.get("/{run_id}", response_model=RunState)
async def get_run(run_id: str) -> RunState:
    if run_id not in _runs:
        raise HTTPException(404, f"Run {run_id} not found")
    return RunState(**_runs[run_id])

@router.get("/{run_id}/console")
async def get_console(run_id: str, offset: int = Query(default=0, ge=0)):

    if run_id not in _runs:
        raise HTTPException(404, f"Run {run_id} not found")

    path = _log_path(run_id)
    done = _runs[run_id]["status"] not in ("queued", "running")

    if not path.exists():
        return {"lines": [], "offset": 0, "done": done}

    with open(path) as f:
        f.seek(offset)
        limit = 1024 * 1024 if done else _CHUNK
        raw = f.read(limit)

    new_offset = offset + len(raw)
    # lines = [l for l in raw.split("\n") if l]    will see if i need it or not ????
    return {"lines": raw, "offset": new_offset, "done": done}




@router.post("/{run_id}/cancel")
async def cancel_run(run_id: str):
    if run_id not in _runs:
        raise HTTPException(404, f"Run {run_id} not found")
    task = _tasks.get(run_id)
    if task and not task.done():
        task.cancel()
    _runs[run_id]["status"] = "failed"
    return {"id": run_id, "status": "failed"}
