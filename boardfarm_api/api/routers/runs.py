from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import time
import uuid
from pathlib import Path
from textwrap import indent
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/runs", tags=["executions"])

RUNS_DIR = Path("runs_data")
RUNS_DIR.mkdir(exist_ok=True)
_CHUNK = 64 * 1024


class CreateRunRequest(BaseModel):
    tests: list[str] = Field(..., min_length=1)
    board_name: str = Field(default="")
    env_config: dict[str, Any] | None = None
    inventory_config: dict[str, Any] | None = None


class RunState(BaseModel):
    id: str
    status: str
    tests: list[str]
    board_name: str
    created_at: float
    console_lines: int = 0


_runs: dict[str, dict] = {}
_tasks: dict[str, asyncio.Task] = {}


def _run_id_path(run_id: str) -> Path:
    return RUNS_DIR / run_id


def _log_path(run_id: str) -> Path:
    return _run_id_path(run_id) / "console.log"


def _env_path(run_id: str) -> Path:
    return _run_id_path(run_id) / "env_config.json"


def _inv_path(run_id: str) -> Path:
    return _run_id_path(run_id) / "inv_config.json"


async def _execute(run_id: str) -> None:
    state = _runs[run_id]
    state["status"] = "running"
    log_file = _log_path(run_id)
    log_file.parent.mkdir(parents=True, exist_ok=True)

    ######
    # we can construct the pytest commnad here pytest command
    # cmd = ["pytest", f"--board-name={state['board_name']}"]
    # if state.get("env_config"):
    #     cmd.append(f"--env-config={state['env_config']}")
    # cmd.extend(state["tests"])

    # this is for testing

    # _prefix_dir = "../boardfarm/boardfarm3/configs"
    # env_conf = f"{_prefix_dir}/{state['env_config']}"
    # inventory_config = f"{_prefix_dir}/boardfarm_multiple_vcpe_rdkb_config_example.json"
    # cmd = [
    #     "bash",
    #     "-c",
    #     "source ./.venv/bin/activate && pytest "
    #     f"--board-name {state['board_name']} "
    #     f"--env-config {env_conf} "
    #     f"--inventory-config {inventory_config} "
    #     f"--save-console-logs ./results_{run_id}/ "
    #     "tests/gateway/ "
    #     f'--test-names "{" ".join(state["tests"])}" '
    #     f"--self-contained-html --html ./test_run_{run_id}.html",
    # ]

    with open(env_conf := _env_path(run_id), "w", encoding="utf-8") as f:
        json.dump(state["env_config"], f, indent=4)

    with open(inv_conf := _inv_path(run_id), "w", encoding="utf-8") as f:
        json.dump(state["inv_config"], f, indent=4)

    cmd = [
        "bash",
        "-c",
        "source ./.venv/bin/activate && pytest "
        f"--board-name {state['board_name']} "
        f"--env-config {env_conf} "
        f"--inventory-config {inv_conf} "
        f"--save-console-logs {_run_id_path(run_id).as_posix()} "
        f"--self-contained-html --html {_run_id_path(run_id).as_posix()}/test_run.html "
        f"{' '.join(state['tests'])} ",
    ]

    with open(log_file, "w", encoding="utf-8") as f:
        f.write(f"$ {' '.join(cmd)}\n")

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=os.getcwd(),
        )

        if proc.stdout is None:
            msg = "'proc.stdout' is None!"
            raise ValueError(msg)

        async for raw in proc.stdout:
            line = raw.decode(errors="replace").rstrip()
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(line + "\n")
            state["console_lines"] += 1

        exit_code = await proc.wait()
        state["status"] = "completed" if exit_code == 0 else "failed"

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
        "inv_config": req.inventory_config,
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
async def get_console(
    run_id: str, offset: int = Query(default=0, ge=0)
) -> dict[str, Any]:

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
async def cancel_run(run_id: str) -> dict[str, Any]:
    """Cancel the given run.

    :param run_id: _description_
    :type run_id: str
    :raises HTTPException: _description_
    :return: _description_
    :rtype: dict[str, Any]
    """
    if run_id not in _runs:
        raise HTTPException(404, f"Run {run_id} not found")
    task = _tasks.get(run_id)
    if task and not task.done():
        task.cancel()
    _runs[run_id]["status"] = "failed"
    return {"id": run_id, "status": "failed"}


@router.post("/{run_id}/remove")
async def remove_run(run_id: str) -> dict[str, Any]:
    """Remove the  given run files and dir."""
    if run_id not in _runs:
        return {"Failed": f"Run {run_id} not found"}

    path = _run_id_path(run_id)
    if not path.exists():
        return {"Failed": f"Run {run_id} not found on local filesystem"}

    done = _runs[run_id]["status"] not in ("queued", "running")
    if not done:
        return {"Failed": f"Run {run_id} not completed, cancel it first!"}

    try:
        shutil.rmtree(path)
    except OSError as exc:
        return {"Failed": str(exc)}
    return {"Success": f"Run {run_id} deleted!"}
