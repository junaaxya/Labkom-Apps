#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$DEPLOY_DIR/state"
HISTORY_DIR="$STATE_DIR/deploy-history"
VERIFY_SCRIPT="$DEPLOY_DIR/scripts/verify-labkom.sh"
COMPOSE_FILES=(-f "$DEPLOY_DIR/docker-compose.yml" -f "$DEPLOY_DIR/docker-compose.images.yml")
ENV_IMAGE_FILE="$DEPLOY_DIR/.env.images"
IMAGE_NAMESPACE_DEFAULT="ghcr.io/junaaxya/labkom-apps"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-$IMAGE_NAMESPACE_DEFAULT}"
IMAGE_TAG="${IMAGE_TAG:-}"
REPO_NAME="${REPO_NAME:-junaaxya/Labkom-Apps}"
BRANCH_NAME="${BRANCH_NAME:-main}"

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

echo "[INFO] Pulling images: $IMAGE_NAMESPACE/*:$IMAGE_TAG" | tee -a "$history_file"
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" pull backend frontend | tee -a "$history_file"

echo "[INFO] Running prisma migrate deploy" | tee -a "$history_file"
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" run --rm backend sh -lc 'npx prisma migrate deploy' | tee -a "$history_file"

echo "[INFO] Updating backend/frontend services" | tee -a "$history_file"
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_IMAGE_FILE" up -d backend frontend | tee -a "$history_file"

echo "[INFO] Waiting for services to settle" | tee -a "$history_file"
sleep 5

"$VERIFY_SCRIPT" "http://127.0.0.1" "http://127.0.0.1:8004" | tee -a "$history_file"

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
