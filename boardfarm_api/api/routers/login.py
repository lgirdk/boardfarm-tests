
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/login", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("")
async def login(body: LoginRequest) -> dict[str, Any]:
    """Accept any credentials and return a success response."""
    return {"success": True, "username": body.username}
