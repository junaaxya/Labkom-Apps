#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1}"
BACKEND_URL="${2:-http://127.0.0.1:8004}"

check() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"
  local code
  code=$(curl -k -sS -o /tmp/labkom-check.out -w '%{http_code}' "$url" || true)
  if [[ "$code" != "$expected" ]]; then
    echo "[FAIL] $name -> $url (HTTP $code, expected $expected)"
    [[ -f /tmp/labkom-check.out ]] && tail -c 300 /tmp/labkom-check.out || true
    return 1
  fi
  echo "[OK]   $name -> $url (HTTP $code)"
}

check "backend health" "$BACKEND_URL/api/v1/health"
check "frontend root" "$BASE_URL/"
check "dashboard" "$BASE_URL/dashboard"
check "sw.js" "$BASE_URL/sw.js"
check "manifest" "$BASE_URL/manifest.json"

echo "All Labkom verification checks passed."
