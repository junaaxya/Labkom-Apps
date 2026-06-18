#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
# shellcheck disable=SC1091
source "$DEPLOY_DIR/scripts/resolve-deploy-paths.sh"
STATE_DIR="$STATE_ROOT"
VERIFY_SCRIPT="$DEPLOY_DIR/scripts/verify-labkom.sh"
CURRENT_STATE="$STATE_DIR/current-release.env"
PREVIOUS_STATE="$STATE_DIR/previous-release.env"
COMPOSE_FILES=(-f "$SERVER_DEPLOY_ROOT/docker-compose.yml" -f "$COMPOSE_OVERRIDE_FILE")
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://lab-ilkom.my.id}"
PUBLIC_BACKEND_URL="${PUBLIC_BACKEND_URL:-https://lab-ilkom.my.id/api/v1}"
INTERNAL_FRONTEND_URL="${INTERNAL_FRONTEND_URL:-http://127.0.0.1:3002}"
INTERNAL_BACKEND_URL="${INTERNAL_BACKEND_URL:-http://127.0.0.1:8004}"

if [[ ! -f "$PREVIOUS_STATE" ]]; then
  echo "No previous release state found at $PREVIOUS_STATE"
  exit 1
fi

# shellcheck disable=SC1090
source "$PREVIOUS_STATE"

if [[ -z "${IMAGE_NAMESPACE:-}" || -z "${IMAGE_TAG:-}" ]]; then
  echo "Previous release state is incomplete"
  exit 1
fi

verify_running_service_image() {
  local service="$1"
  local expected_ref="$IMAGE_NAMESPACE/$service:$IMAGE_TAG"
  local container_id
  local configured_ref
  local running_image_id
  local expected_image_id

  container_id="$(docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" ps -q "$service")"
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

cat > "$ENV_IMAGE_FILE" <<EOF
IMAGE_NAMESPACE=$IMAGE_NAMESPACE
IMAGE_TAG=$IMAGE_TAG
EOF

pull_previous_images_if_needed() {
  local backend_ref="$IMAGE_NAMESPACE/backend:$IMAGE_TAG"
  local frontend_ref="$IMAGE_NAMESPACE/frontend:$IMAGE_TAG"

  if docker image inspect "$backend_ref" >/dev/null 2>&1 && docker image inspect "$frontend_ref" >/dev/null 2>&1; then
    echo "[INFO] Previous images already available locally; skipping registry pull"
    return 0
  fi

  echo "[INFO] Pulling previous images from registry"
  docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" pull backend frontend
}

echo "[INFO] Rolling back to $IMAGE_NAMESPACE:$IMAGE_TAG"
pull_previous_images_if_needed
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" up -d backend frontend
verify_running_service_image backend
verify_running_service_image frontend
sleep 5
"$VERIFY_SCRIPT" "$PUBLIC_BASE_URL" "$PUBLIC_BACKEND_URL" "$INTERNAL_FRONTEND_URL" "$INTERNAL_BACKEND_URL"

if [[ -f "$CURRENT_STATE" ]]; then
  cp "$CURRENT_STATE" "$STATE_DIR/rollback-from.env"
fi
cp "$PREVIOUS_STATE" "$CURRENT_STATE"
echo "[INFO] Rollback complete. Current release restored from previous state."
