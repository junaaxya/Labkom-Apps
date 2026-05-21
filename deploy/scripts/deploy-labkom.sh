#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
# shellcheck disable=SC1091
source "$DEPLOY_DIR/scripts/resolve-deploy-paths.sh"
STATE_DIR="$STATE_ROOT"
HISTORY_DIR="$HISTORY_ROOT"
VERIFY_SCRIPT="$DEPLOY_DIR/scripts/verify-labkom.sh"
DIAGNOSE_SCRIPT="$DEPLOY_DIR/scripts/diagnose-labkom.sh"
COMPOSE_FILES=(-f "$SERVER_DEPLOY_ROOT/docker-compose.yml" -f "$COMPOSE_OVERRIDE_FILE")
IMAGE_NAMESPACE_DEFAULT="ghcr.io/junaaxya/labkom-apps"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-$IMAGE_NAMESPACE_DEFAULT}"
IMAGE_TAG="${IMAGE_TAG:-}"
REPO_NAME="${REPO_NAME:-junaaxya/Labkom-Apps}"
BRANCH_NAME="${BRANCH_NAME:-main}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://lab-ilkom.my.id}"
PUBLIC_BACKEND_URL="${PUBLIC_BACKEND_URL:-https://lab-ilkom.my.id/api/v1}"
INTERNAL_FRONTEND_URL="${INTERNAL_FRONTEND_URL:-http://127.0.0.1:3002}"
INTERNAL_BACKEND_URL="${INTERNAL_BACKEND_URL:-http://127.0.0.1:8004}"
AUTO_ROLLBACK_ON_FAIL="${AUTO_ROLLBACK_ON_FAIL:-true}"

if [[ -z "$IMAGE_TAG" ]]; then
  echo "IMAGE_TAG is required"
  exit 1
fi

mkdir -p "$STATE_DIR" "$HISTORY_DIR"

timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
release_id="${IMAGE_TAG}_${timestamp//[:]/-}"
current_state="$STATE_DIR/current-release.env"
previous_state="$STATE_DIR/previous-release.env"
history_file="$HISTORY_DIR/$release_id.log"

if [[ -f "$current_state" ]]; then
  cp "$current_state" "$previous_state"
fi

cat > "$ENV_IMAGE_FILE" <<EOF
IMAGE_NAMESPACE=$IMAGE_NAMESPACE
IMAGE_TAG=$IMAGE_TAG
EOF

wait_for_image() {
  local service="$1"
  local ref="$IMAGE_NAMESPACE/$service:$IMAGE_TAG"
  local retries="${IMAGE_WAIT_RETRIES:-12}"
  local sleep_seconds="${IMAGE_WAIT_SLEEP:-10}"

  for ((i=1; i<=retries; i++)); do
    echo "[INFO] Checking image availability ($i/$retries): $ref" | tee -a "$history_file"
    if docker manifest inspect "$ref" >/dev/null 2>&1; then
      echo "[OK] Image available: $ref" | tee -a "$history_file"
      return 0
    fi
    if (( i < retries )); then
      echo "[WARN] Image not ready yet: $ref — retrying in ${sleep_seconds}s" | tee -a "$history_file"
      sleep "$sleep_seconds"
    fi
  done

  echo "[FAIL] Image never became available: $ref" | tee -a "$history_file"
  return 1
}

pull_images_with_retry() {
  local retries="${PULL_RETRIES:-4}"
  local sleep_seconds="${PULL_RETRY_SLEEP:-15}"

  for ((i=1; i<=retries; i++)); do
    echo "[INFO] Pull attempt ($i/$retries): $IMAGE_NAMESPACE/*:$IMAGE_TAG" | tee -a "$history_file"
    if docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" pull backend frontend | tee -a "$history_file"; then
      return 0
    fi
    if (( i < retries )); then
      echo "[WARN] Pull failed — retrying in ${sleep_seconds}s" | tee -a "$history_file"
      sleep "$sleep_seconds"
    fi
  done

  echo "[FAIL] Unable to pull images after ${retries} attempts" | tee -a "$history_file"
  return 1
}

wait_for_image backend
wait_for_image frontend

echo "[INFO] Pulling images: $IMAGE_NAMESPACE/*:$IMAGE_TAG" | tee -a "$history_file"
pull_images_with_retry

echo "[INFO] Running prisma migrate deploy" | tee -a "$history_file"
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" run --rm backend sh -lc 'npx prisma migrate deploy' | tee -a "$history_file"

echo "[INFO] Updating backend/frontend services" | tee -a "$history_file"
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" up -d backend frontend | tee -a "$history_file"

echo "[INFO] Waiting for services to settle" | tee -a "$history_file"
sleep 5

set +e
"$VERIFY_SCRIPT" "$PUBLIC_BASE_URL" "$PUBLIC_BACKEND_URL" "$INTERNAL_FRONTEND_URL" "$INTERNAL_BACKEND_URL" | tee -a "$history_file"
verify_exit=${PIPESTATUS[0]}
set -e

if (( verify_exit != 0 )); then
  echo "[FAIL] Verification failed for $IMAGE_TAG" | tee -a "$history_file"
  diag_file="$($DIAGNOSE_SCRIPT)"
  echo "[INFO] Diagnostics captured at $diag_file" | tee -a "$history_file"

  if [[ "$AUTO_ROLLBACK_ON_FAIL" == "true" && -f "$previous_state" ]]; then
    echo "[INFO] Auto rollback enabled; attempting rollback" | tee -a "$history_file"
    if PUBLIC_BASE_URL="$PUBLIC_BASE_URL" PUBLIC_BACKEND_URL="$PUBLIC_BACKEND_URL" INTERNAL_FRONTEND_URL="$INTERNAL_FRONTEND_URL" INTERNAL_BACKEND_URL="$INTERNAL_BACKEND_URL" SERVER_DEPLOY_ROOT="$SERVER_DEPLOY_ROOT" "$DEPLOY_DIR/scripts/rollback-labkom.sh" | tee -a "$history_file"; then
      echo "[INFO] Auto rollback completed successfully" | tee -a "$history_file"
    else
      echo "[FAIL] Auto rollback failed — manual intervention required" | tee -a "$history_file"
    fi
  fi

  exit 1
fi

cat > "$current_state" <<EOF
REPO_NAME=$REPO_NAME
BRANCH_NAME=$BRANCH_NAME
IMAGE_NAMESPACE=$IMAGE_NAMESPACE
IMAGE_TAG=$IMAGE_TAG
DEPLOYED_AT=$timestamp
STATUS=success
HISTORY_FILE=$history_file
EOF

echo "[INFO] Deployment recorded in $current_state" | tee -a "$history_file"
