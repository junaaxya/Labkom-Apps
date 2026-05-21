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
sleep 5
"$VERIFY_SCRIPT" "$PUBLIC_BASE_URL" "$PUBLIC_BACKEND_URL" "$INTERNAL_FRONTEND_URL" "$INTERNAL_BACKEND_URL"

if [[ -f "$CURRENT_STATE" ]]; then
  cp "$CURRENT_STATE" "$STATE_DIR/rollback-from.env"
fi
cp "$PREVIOUS_STATE" "$CURRENT_STATE"
echo "[INFO] Rollback complete. Current release restored from previous state."
