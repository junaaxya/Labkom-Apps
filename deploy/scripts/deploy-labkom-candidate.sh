#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
# shellcheck disable=SC1091
source "$DEPLOY_DIR/scripts/resolve-deploy-paths.sh"
VERIFY_CANDIDATE_SCRIPT="$DEPLOY_DIR/scripts/verify-labkom-candidate.sh"
VERIFY_LIVE_SCRIPT="$DEPLOY_DIR/scripts/verify-labkom.sh"
COMPOSE_MAIN=(-f "$REPO_ROOT/docker-compose.yml" -f "$COMPOSE_OVERRIDE_FILE")
COMPOSE_CANDIDATE=(-f "$REPO_ROOT/docker-compose.yml" -f "$COMPOSE_OVERRIDE_FILE" -f "$DEPLOY_DIR/docker-compose.candidate.yml")
IMAGE_NAMESPACE_DEFAULT="ghcr.io/junaaxya/labkom-apps"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-$IMAGE_NAMESPACE_DEFAULT}"
IMAGE_TAG="${IMAGE_TAG:-}"
PROMOTE_ON_SUCCESS="${PROMOTE_ON_SUCCESS:-false}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://lab-ilkom.my.id}"
PUBLIC_BACKEND_URL="${PUBLIC_BACKEND_URL:-https://lab-ilkom.my.id/api/v1}"

if [[ -z "$IMAGE_TAG" ]]; then
  echo "IMAGE_TAG is required"
  exit 1
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
    echo "[INFO] Checking image availability ($i/$retries): $ref"
    if docker manifest inspect "$ref" >/dev/null 2>&1; then
      echo "[OK] Image available: $ref"
      return 0
    fi
    if (( i < retries )); then
      echo "[WARN] Image not ready yet: $ref — retrying in ${sleep_seconds}s"
      sleep "$sleep_seconds"
    fi
  done

  echo "[FAIL] Image never became available: $ref"
  return 1
}

wait_for_image backend
wait_for_image frontend

echo "[INFO] Pulling candidate images"
docker compose "${COMPOSE_CANDIDATE[@]}" --env-file "$ENV_IMAGE_FILE" pull backend-candidate frontend-candidate

echo "[INFO] Starting candidate services"
docker compose "${COMPOSE_CANDIDATE[@]}" --env-file "$ENV_IMAGE_FILE" up -d backend-candidate frontend-candidate

cleanup() {
  echo "[INFO] Cleaning up candidate services"
  docker compose "${COMPOSE_CANDIDATE[@]}" --env-file "$ENV_IMAGE_FILE" rm -sf backend-candidate frontend-candidate >/dev/null 2>&1 || true
}

trap cleanup EXIT

sleep 5
"$VERIFY_CANDIDATE_SCRIPT" "http://127.0.0.1:13002" "http://127.0.0.1:18004" "http://127.0.0.1:13002" "http://127.0.0.1:18004"

echo "[OK] Candidate verification passed"

if [[ "$PROMOTE_ON_SUCCESS" == "true" ]]; then
  echo "[INFO] Promoting candidate image to live services"
  docker compose "${COMPOSE_MAIN[@]}" --env-file "$ENV_IMAGE_FILE" up -d backend frontend
  sleep 5
  "$VERIFY_LIVE_SCRIPT" "$PUBLIC_BASE_URL" "$PUBLIC_BACKEND_URL" "http://127.0.0.1:3002" "http://127.0.0.1:8004"
  echo "[OK] Live verification passed after promotion"
else
  echo "[INFO] PROMOTE_ON_SUCCESS=false — candidate verified only, live services unchanged"
fi
