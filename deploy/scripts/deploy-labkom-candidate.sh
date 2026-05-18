#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERIFY_CANDIDATE_SCRIPT="$DEPLOY_DIR/scripts/verify-labkom-candidate.sh"
VERIFY_LIVE_SCRIPT="$DEPLOY_DIR/scripts/verify-labkom.sh"
COMPOSE_MAIN=(-f "$DEPLOY_DIR/docker-compose.yml" -f "$DEPLOY_DIR/docker-compose.images.yml")
COMPOSE_CANDIDATE=(-f "$DEPLOY_DIR/docker-compose.yml" -f "$DEPLOY_DIR/docker-compose.images.yml" -f "$DEPLOY_DIR/docker-compose.candidate.yml")
ENV_IMAGE_FILE="$DEPLOY_DIR/.env.images"
IMAGE_NAMESPACE_DEFAULT="ghcr.io/junaaxya/labkom-apps"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-$IMAGE_NAMESPACE_DEFAULT}"
IMAGE_TAG="${IMAGE_TAG:-}"
PROMOTE_ON_SUCCESS="${PROMOTE_ON_SUCCESS:-false}"

if [[ -z "$IMAGE_TAG" ]]; then
  echo "IMAGE_TAG is required"
  exit 1
fi

cat > "$ENV_IMAGE_FILE" <<EOF
IMAGE_NAMESPACE=$IMAGE_NAMESPACE
IMAGE_TAG=$IMAGE_TAG
EOF

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
"$VERIFY_CANDIDATE_SCRIPT" "http://127.0.0.1:13002" "http://127.0.0.1:18004"

echo "[OK] Candidate verification passed"

if [[ "$PROMOTE_ON_SUCCESS" == "true" ]]; then
  echo "[INFO] Promoting candidate image to live services"
  docker compose "${COMPOSE_MAIN[@]}" --env-file "$ENV_IMAGE_FILE" up -d backend frontend
  sleep 5
  "$VERIFY_LIVE_SCRIPT" "http://127.0.0.1" "http://127.0.0.1:8004"
  echo "[OK] Live verification passed after promotion"
else
  echo "[INFO] PROMOTE_ON_SUCCESS=false — candidate verified only, live services unchanged"
fi
