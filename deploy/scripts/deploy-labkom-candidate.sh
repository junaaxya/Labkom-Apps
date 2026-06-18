#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
# shellcheck disable=SC1091
source "$DEPLOY_DIR/scripts/resolve-deploy-paths.sh"
VERIFY_CANDIDATE_SCRIPT="$DEPLOY_DIR/scripts/verify-labkom-candidate.sh"
VERIFY_LIVE_SCRIPT="$DEPLOY_DIR/scripts/verify-labkom.sh"
COMPOSE_MAIN=(-f "$SERVER_DEPLOY_ROOT/docker-compose.yml" -f "$COMPOSE_OVERRIDE_FILE")
COMPOSE_CANDIDATE=(-f "$SERVER_DEPLOY_ROOT/docker-compose.yml" -f "$COMPOSE_OVERRIDE_FILE" -f "$DEPLOY_DIR/docker-compose.candidate.yml")
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

verify_running_service_image() {
  local service="$1"
  local expected_ref="$IMAGE_NAMESPACE/${service%%-candidate}:$IMAGE_TAG"
  local container_id
  local configured_ref
  local running_image_id
  local expected_image_id

  container_id="$(docker compose "${COMPOSE_CANDIDATE[@]}" --env-file "$ENV_IMAGE_FILE" ps -q "$service")"
  if [[ -z "$container_id" ]]; then
    echo "[FAIL] No running container found for service: $service"
    return 1
  fi

  configured_ref="$(docker inspect --format '{{.Config.Image}}' "$container_id")"
  running_image_id="$(docker inspect --format '{{.Image}}' "$container_id")"
  expected_image_id="$(docker image inspect --format '{{.Id}}' "$expected_ref")"

  if [[ "$configured_ref" != "$expected_ref" ]]; then
    echo "[FAIL] $service container configured image mismatch: expected $expected_ref, got $configured_ref"
    return 1
  fi

  if [[ "$running_image_id" != "$expected_image_id" ]]; then
    echo "[FAIL] $service running image ID mismatch for $expected_ref"
    echo "[FAIL] running=$running_image_id expected=$expected_image_id"
    return 1
  fi

  echo "[OK] $service running expected image: $expected_ref"
}

echo "[INFO] Pulling candidate images"
docker compose "${COMPOSE_CANDIDATE[@]}" --env-file "$ENV_IMAGE_FILE" pull backend-candidate frontend-candidate

echo "[INFO] Starting candidate services"
docker compose "${COMPOSE_CANDIDATE[@]}" --env-file "$ENV_IMAGE_FILE" up -d backend-candidate frontend-candidate

verify_running_service_image backend-candidate
verify_running_service_image frontend-candidate

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
  promoted_backend_id="$(docker compose "${COMPOSE_MAIN[@]}" --env-file "$ENV_IMAGE_FILE" ps -q backend)"
  promoted_frontend_id="$(docker compose "${COMPOSE_MAIN[@]}" --env-file "$ENV_IMAGE_FILE" ps -q frontend)"
  [[ -n "$promoted_backend_id" && -n "$promoted_frontend_id" ]] || { echo "[FAIL] Live promotion containers not running"; exit 1; }
  sleep 5
  "$VERIFY_LIVE_SCRIPT" "$PUBLIC_BASE_URL" "$PUBLIC_BACKEND_URL" "http://127.0.0.1:3002" "http://127.0.0.1:8004"
  echo "[OK] Live verification passed after promotion"
else
  echo "[INFO] PROMOTE_ON_SUCCESS=false — candidate verified only, live services unchanged"
fi
