"""Providers that routes pull in via Depends().

One rule: routes never construct anything. They declare needs,
this module satisfies them.
"""

from fastapi import Request


def get_ai_engine(request: Request):
    """Hand the route the single Orchestrator created at startup.

    It lives on app.state (set in app.py's lifespan). One instance,
    shared by every request — created once because init is expensive
    (loads encoders, builds index, inits LLM clients).
    """
    return request.app.state.ai_engine
