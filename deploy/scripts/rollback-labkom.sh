#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$DEPLOY_DIR/state"
VERIFY_SCRIPT="$DEPLOY_DIR/scripts/verify-labkom.sh"
CURRENT_STATE="$STATE_DIR/current-release.env"
PREVIOUS_STATE="$STATE_DIR/previous-release.env"
ENV_IMAGE_FILE="$DEPLOY_DIR/.env.images"
COMPOSE_FILES=(-f "$DEPLOY_DIR/docker-compose.yml" -f "$DEPLOY_DIR/docker-compose.images.yml")

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

echo "[INFO] Rolling back to $IMAGE_NAMESPACE:$IMAGE_TAG"
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" pull backend frontend
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" up -d backend frontend
sleep 5
"$VERIFY_SCRIPT" "http://127.0.0.1" "http://127.0.0.1:8004"

if [[ -f "$CURRENT_STATE" ]]; then
  cp "$CURRENT_STATE" "$STATE_DIR/rollback-from.env"
fi
cp "$PREVIOUS_STATE" "$CURRENT_STATE"
echo "[INFO] Rollback complete. Current release restored from previous state."
