#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
SERVER_DEPLOY_ROOT="${SERVER_DEPLOY_ROOT:-/srv/apps/labkom-apps/deploy}"
STATE_ROOT="${DEPLOY_STATE_ROOT:-$SERVER_DEPLOY_ROOT/state}"
HISTORY_ROOT="$STATE_ROOT/deploy-history"
DIAG_ROOT="$STATE_ROOT/diagnostics"
ENV_IMAGE_FILE="${DEPLOY_ENV_IMAGE_FILE:-$SERVER_DEPLOY_ROOT/.env.images}"
COMPOSE_OVERRIDE_FILE="${DEPLOY_COMPOSE_OVERRIDE_FILE:-$SERVER_DEPLOY_ROOT/docker-compose.images.yml}"
BACKEND_ENV_FILE="${DEPLOY_BACKEND_ENV_FILE:-$SERVER_DEPLOY_ROOT/.env.backend}"
FRONTEND_ENV_FILE="${DEPLOY_FRONTEND_ENV_FILE:-$SERVER_DEPLOY_ROOT/.env.frontend}"
SHARED_ENV_FILE="${DEPLOY_SHARED_ENV_FILE:-$SERVER_DEPLOY_ROOT/.env}"

ensure_file() {
  local path="$1"
  local label="$2"
  if [[ ! -f "$path" ]]; then
    echo "Missing $label: $path" >&2
    exit 1
  fi
}

ensure_file "$COMPOSE_OVERRIDE_FILE" "compose override file"
ensure_file "$BACKEND_ENV_FILE" "backend env file"
ensure_file "$FRONTEND_ENV_FILE" "frontend env file"

mkdir -p "$STATE_ROOT" "$HISTORY_ROOT" "$DIAG_ROOT"

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      local key="${line%%=*}"
      local value="${line#*=}"
      export "$key=$value"
    fi
  done < "$file"
}

load_env_file "$BACKEND_ENV_FILE"
load_env_file "$SHARED_ENV_FILE"
load_env_file "$FRONTEND_ENV_FILE"

export SCRIPT_DIR DEPLOY_DIR REPO_ROOT SERVER_DEPLOY_ROOT STATE_ROOT HISTORY_ROOT DIAG_ROOT
export ENV_IMAGE_FILE COMPOSE_OVERRIDE_FILE BACKEND_ENV_FILE FRONTEND_ENV_FILE SHARED_ENV_FILE
