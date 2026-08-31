FROM py314-uv:latest

# Build-time proxy settings
ARG HTTPS_PROXY
ARG HTTP_PROXY
ARG NO_PROXY
ARG APP_USER_ID
ARG APP_GROUP_ID
ENV https_proxy=$HTTPS_PROXY http_proxy=$HTTP_PROXY no_proxy=$NO_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY HTTP_PROXY=$HTTP_PROXY NO_PROXY=$NO_PROXY

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app
# ↑ THE invariant. CWD = /app = repo root. Your ./configs/..., ./artifacts,
#   ./.models paths and `from boardfarm_api...` imports all resolve because of this line.

# uv dependencies
# Copied ALONE first so editing code doesn't re-trigger a dep install.
COPY pyproject.toml uv.lock /app/
RUN uv sync --frozen --no-dev --no-install-project
# --frozen: respect uv.lock exactly (reproducible builds)
# --no-install-project: install deps only; your app runs from source

ENV PATH="/app/.venv/bin:${PATH}"
# uv sync made /app/.venv; putting it on PATH means "uvicorn" just works.

# Layer 2: code (rebuilt on every code change fast)
COPY boardfarm_api/ /app/boardfarm_api/
COPY domain/        /app/domain/
COPY configs/       /app/configs/
# NOTE: .models/ and artifacts/ are deliberately NOT copied — they're mounts.

# Non-root user (containers shouldn't run as root)
RUN groupadd --gid ${APP_GROUP_ID} app && \
    useradd --create-home --uid ${APP_USER_ID} --gid ${APP_GROUP_ID} --shell /bin/bash app && \
    chown -R app:app /app
USER app

# Kill build-time proxy; runtime proxy comes from compose env
ENV https_proxy="" http_proxy="" no_proxy="" \
    HTTPS_PROXY="" HTTP_PROXY="" NO_PROXY=""

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request as u; \
        exit(0 if u.urlopen('http://127.0.0.1:8080/health', timeout=3).status==200 else 1)"
# start-period=60s, not 10s: your lifespan loads encoders + builds the index
# before the app answers. Don't let Docker kill it for being slow to boot.

CMD ["uvicorn", "boardfarm_api.api.app:app", "--host", "0.0.0.0", "--port", "8080", \
     "--workers", "1", "--access-log"]
# workers=1 on purpose: your generate-lock lives in process memory; multiple
# worker PROCESSES would each have their own lock AND their own engine
# (RAM x N, lock useless across processes). One worker until phase 2.
