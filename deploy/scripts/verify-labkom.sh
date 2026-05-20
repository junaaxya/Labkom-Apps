#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://lab-ilkom.my.id}"
BACKEND_URL="${2:-https://lab-ilkom.my.id/api/v1}"
INTERNAL_FRONTEND_URL="${3:-}"
INTERNAL_BACKEND_URL="${4:-}"

TMP_OUT="$(mktemp)"
trap 'rm -f "$TMP_OUT"' EXIT

check() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"
  local code
  code=$(curl -k -sS -L -o "$TMP_OUT" -w '%{http_code}' "$url" || true)
  if [[ "$code" != "$expected" ]]; then
    echo "[FAIL] $name -> $url (HTTP $code, expected $expected)"
    [[ -f "$TMP_OUT" ]] && tail -c 300 "$TMP_OUT" || true
    return 1
  fi
  echo "[OK]   $name -> $url (HTTP $code)"
}

if [[ -n "$INTERNAL_BACKEND_URL" ]]; then
  check "internal backend health" "$INTERNAL_BACKEND_URL/api/v1/health"
fi

if [[ -n "$INTERNAL_FRONTEND_URL" ]]; then
  check "internal frontend root" "$INTERNAL_FRONTEND_URL/"
  check "internal dashboard" "$INTERNAL_FRONTEND_URL/dashboard"
fi

check "public backend health" "$BACKEND_URL/health"
check "public frontend root" "$BASE_URL/"
check "public dashboard" "$BASE_URL/dashboard"
check "public sw.js" "$BASE_URL/sw.js"
check "public manifest" "$BASE_URL/manifest.json"

echo "All Labkom verification checks passed."
