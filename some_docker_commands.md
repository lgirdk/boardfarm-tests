Day-to-day operations

# Code changed → rebuild and restart
DOCKER_BUILDKIT=0 docker compose up --build -d

# Config/secret changed (.env, TOML via mount) → restart only
docker compose down && docker compose up -d

# Watch logs (live, follow mode)
docker logs -f boardfarm-ai

# Watch last 50 lines only
docker logs --tail 50 boardfarm-ai

# Stop everything
docker compose down

# Start without rebuild
docker compose up -d

# Restart without recreating (does NOT re-read .env)
docker compose restart

========================================================================================================

Debugging inside the container

# Get a shell inside running container
docker exec -it boardfarm-ai bash

# Run a one-off command without entering shell
docker exec boardfarm-ai python -c "print('hello')"

# Check env vars
docker exec boardfarm-ai env | grep PROXY

# Check if a file exists inside container
docker exec boardfarm-ai ls -la /app/configs/

========================================================================================================

Building images

# Build via compose (preferred — uses your compose args automatically)
DOCKER_BUILDKIT=0 docker compose up --build -d

# Build via docker directly (when you need manual control)
DOCKER_BUILDKIT=0 docker build -t boardfarm-ai:latest \
  --build-arg HTTPS_PROXY=http://172.30.180.23:8080/ \
  --build-arg HTTP_PROXY=http://172.30.180.23:8080/ \
  --build-arg APP_USER_ID=1000 \
  --build-arg APP_GROUP_ID=1000 \
  .

# Build the base image (rarely — only when Python/uv/certs change)
cd ~/AI_POC/py313-uv
DOCKER_BUILDKIT=0 docker build -t py313-uv:latest \
  --build-arg HTTPS_PROXY=http://172.30.180.23:8080/ \
  --build-arg HTTP_PROXY=http://172.30.180.23:8080/ \
  --build-arg NO_PROXY=10.64.38.13,localhost,127.0.0.1 \
  .


Inspecting images and containers

# List all images
docker images

# List running containers
docker ps

# List ALL containers (including stopped/crashed)
docker ps -a

# See container's status, port mappings, health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# See what env vars a running container actually has
docker exec boardfarm-ai env

# See container resource usage (CPU, RAM)
docker stats boardfarm-ai

Cleanup

# Remove dangling images (<none>:<none>)
docker image prune -f

# Remove a specific image
docker rmi <image-id>

# Remove stopped containers
docker container prune -f

# Nuclear option: remove ALL unused images, containers, networks
docker system prune -f
# ⚠ careful — this removes everything not currently running


Volumes and mounts
# Check what's mounted in a running container
docker inspect boardfarm-ai --format '{{json .Mounts}}' | python -m json.tool

# Quick verify: does the container see your host files?
docker exec boardfarm-ai ls -la /app/.models/
docker exec boardfarm-ai ls -la /app/artifacts/
docker exec boardfarm-ai ls -la /app/configs/



When something goes wrong

# Container keeps restarting? Check why:
docker logs --tail 30 boardfarm-ai

# Container won't start at all? Check its state:
docker ps -a | grep boardfarm

# Stuck build? Kill it and retry:
# Ctrl+C, then:
DOCKER_BUILDKIT=0 docker compose up --build -d

# Port conflict? Find what's using it:
sudo lsof -i :9090