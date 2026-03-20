#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"

COMPOSE_FILE="$PROJECT_ROOT/infra/tests/docker-compose.localstack.yml"
KEEP_LOCALSTACK="${KEEP_LOCALSTACK:-false}"

cleanup() {
  if [ "$KEEP_LOCALSTACK" != "true" ]; then
    echo "Tearing down LocalStack..."
    docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
  fi
}

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "LocalStack compose file not found at $COMPOSE_FILE"
  echo "Starting LocalStack directly..."
  docker run -d --name localstack-integration -p 4566:4566 localstack/localstack:latest
  trap 'docker rm -f localstack-integration 2>/dev/null || true' EXIT
else
  trap cleanup EXIT
  echo "Starting LocalStack..."
  docker compose -f "$COMPOSE_FILE" up -d
fi

echo "Waiting for LocalStack to be ready..."
for i in $(seq 1 30); do
  if curl -s http://localhost:4566/_localstack/health | grep -q '"s3"'; then
    echo "LocalStack is ready."
    break
  fi
  sleep 1
done

echo "Running integration tests..."
cd "$BACKEND_DIR"
export LOCALSTACK_ENDPOINT=http://localhost:4566

yarn test:integration

echo "Running LocalStack E2E deployment test..."
yarn jest --config jest.config.cjs --runInBand src/e2e/localstackDeploy.e2e.test.ts
