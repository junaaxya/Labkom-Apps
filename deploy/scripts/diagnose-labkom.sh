#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
# shellcheck disable=SC1091
source "$DEPLOY_DIR/scripts/resolve-deploy-paths.sh"
STATE_DIR="$STATE_ROOT"
DIAG_DIR="$DIAG_ROOT"
COMPOSE_FILES=(-f "$SERVER_DEPLOY_ROOT/docker-compose.yml" -f "$COMPOSE_OVERRIDE_FILE")
mkdir -p "$DIAG_DIR"

stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
out="$DIAG_DIR/$stamp.log"

{
  echo "== Labkom diagnostics: $stamp =="
  echo
  echo "-- docker ps --"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}' || true
  echo
  echo "-- compose ps --"
  docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" ps || true
  echo
  echo "-- backend logs (tail 120) --"
  docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" logs --tail 120 backend || true
  echo
  echo "-- frontend logs (tail 120) --"
  docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" logs --tail 120 frontend || true
  echo
  echo "-- public health --"
  curl -k -sS -D - https://lab-ilkom.my.id/api/v1/health -o /dev/null || true
  echo
  echo "-- public root --"
  curl -k -sS -D - https://lab-ilkom.my.id/ -o /dev/null || true
} > "$out" 2>&1

echo "$out"
