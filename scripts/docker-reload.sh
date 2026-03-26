#!/usr/bin/env bash
set -euo pipefail

# Rebuild and restart only the app containers (backend + frontend)
# with latest code. Data services (mongo, minio) and their volumes
# are left untouched — no data loss.
#
# Prerequisites: the full stack must already be running (yarn docker:up).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Docker Compose is required." >&2
  exit 1
fi

# Verify infrastructure services are running before reload
REQUIRED_SERVICES=(mongo minio keycloak)
for svc in "${REQUIRED_SERVICES[@]}"; do
  if ! "${COMPOSE_CMD[@]}" ps --status running --format '{{.Service}}' 2>/dev/null | grep -q "^${svc}$"; then
    echo "Error: '$svc' is not running. Start the full stack first: yarn docker:up" >&2
    exit 1
  fi
done

BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:4100/health}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:5177}"

# Kill and restart native OCR/SLM processes (prompts/code may have changed)
RUN_DIR="$ROOT_DIR/.local-run"
stop_pid() {
  local label="$1" pidfile="$2"
  if [[ -f "$pidfile" ]]; then
    local pid; pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      echo "Stopping $label (pid $pid)..."
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi
}

stop_pid "OCR" "$RUN_DIR/ocr.pid"
stop_pid "SLM" "$RUN_DIR/slm.pid"
sleep 2

PYTHON_BIN="$ROOT_DIR/.venv-ml/bin/python"
if [[ -x "$PYTHON_BIN" ]]; then
  echo "Starting OCR..."
  "$PYTHON_BIN" scripts/start-detached.py --pid-file "$RUN_DIR/ocr.pid" --log-file "$RUN_DIR/ocr.log" --cwd "$ROOT_DIR" -- \
    "$PYTHON_BIN" -m uvicorn app.api:app --app-dir invoice-ocr --host 0.0.0.0 --port 8200 >/dev/null 2>&1 || true
  echo "Starting SLM..."
  "$PYTHON_BIN" scripts/start-detached.py --pid-file "$RUN_DIR/slm.pid" --log-file "$RUN_DIR/slm.log" --cwd "$ROOT_DIR" -- \
    "$PYTHON_BIN" -m uvicorn app.api:app --app-dir invoice-slm --host 0.0.0.0 --port 8300 >/dev/null 2>&1 || true
fi

# Build all images with no cache (backend, frontend, OCR proxy, SLM proxy)
echo "Building images (no cache)..."
"${COMPOSE_CMD[@]}" build --no-cache backend frontend invoice-ocr invoice-slm

# Swap containers
echo "Recreating containers..."
"${COMPOSE_CMD[@]}" up -d --no-deps --force-recreate backend frontend invoice-ocr invoice-slm

# Wait for backend health
echo "Waiting for backend..."
elapsed=0
while (( elapsed < 120 )); do
  body="$(curl -fsSL "$BACKEND_HEALTH_URL" 2>/dev/null || true)"
  if [[ "$body" == *'"ready":true'* ]]; then
    echo "Backend ready."
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done
if (( elapsed >= 120 )); then
  echo "Backend did not become ready within 120s. Recent logs:" >&2
  "${COMPOSE_CMD[@]}" logs --tail 30 backend >&2
  exit 1
fi

# Wait for frontend
echo "Waiting for frontend..."
elapsed=0
while (( elapsed < 60 )); do
  body="$(curl -fsSL "$FRONTEND_URL" 2>/dev/null || true)"
  if [[ "$body" == *"<html"* ]]; then
    echo "Frontend ready."
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done
if (( elapsed >= 60 )); then
  echo "Frontend did not become ready within 60s. Recent logs:" >&2
  "${COMPOSE_CMD[@]}" logs --tail 30 frontend >&2
  exit 1
fi

echo "Reload complete. Data volumes preserved."
