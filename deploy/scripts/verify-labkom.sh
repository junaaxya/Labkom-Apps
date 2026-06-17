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
  local retries="${4:-1}"
  local sleep_seconds="${5:-0}"
  local code

  for ((attempt=1; attempt<=retries; attempt++)); do
    code=$(curl -k -sS -L --connect-timeout 10 --max-time 30 -o "$TMP_OUT" -w '%{http_code}' "$url" || true)
    if [[ "$code" == "$expected" ]]; then
      echo "[OK]   $name -> $url (HTTP $code)"
      return 0
    fi

    if (( attempt < retries )); then
      echo "[WARN] $name -> $url (HTTP $code, expected $expected) — retrying in ${sleep_seconds}s"
      sleep "$sleep_seconds"
    fi
  done

  echo "[FAIL] $name -> $url (HTTP $code, expected $expected)"
  [[ -f "$TMP_OUT" ]] && tail -c 300 "$TMP_OUT" || true
  return 1
}

check_hosting_route() {
  local name="$1"
  local url="$2"
  local retries="${3:-1}"
  local sleep_seconds="${4:-0}"
  local code

  for ((attempt=1; attempt<=retries; attempt++)); do
    code=$(curl -k -sS -L --connect-timeout 10 --max-time 30 \
      -o "$TMP_OUT" \
      -w '%{http_code}' \
      -X POST \
      -H 'Content-Type: application/json' \
      -d '{}' \
      "$url" || true)

    case "$code" in
      200|201|400|401|403|405)
        echo "[OK]   $name -> $url (HTTP $code)"
        return 0
        ;;
      404)
        ;;
      *)
        ;;
    esac

    if (( attempt < retries )); then
      echo "[WARN] $name -> $url (HTTP $code, expected non-404 mounted route) - retrying in ${sleep_seconds}s"
      sleep "$sleep_seconds"
    fi
  done

  echo "[FAIL] $name -> $url (HTTP $code, expected mounted route with non-404 response)"
  [[ -f "$TMP_OUT" ]] && tail -c 300 "$TMP_OUT" || true
  return 1
}

if [[ -n "$INTERNAL_BACKEND_URL" ]]; then
  check "internal backend health" "$INTERNAL_BACKEND_URL/api/v1/health"
  check_hosting_route "internal hosting transactions route" "$INTERNAL_BACKEND_URL/api/v1/hosting/transactions"
fi

if [[ -n "$INTERNAL_FRONTEND_URL" ]]; then
  check "internal frontend root" "$INTERNAL_FRONTEND_URL/"
  check "internal dashboard" "$INTERNAL_FRONTEND_URL/dashboard"
fi

check "public backend health" "$BACKEND_URL/health" 200 "${PUBLIC_VERIFY_RETRIES:-3}" "${PUBLIC_VERIFY_SLEEP:-5}"
check "public frontend root" "$BASE_URL/" 200 "${PUBLIC_VERIFY_RETRIES:-3}" "${PUBLIC_VERIFY_SLEEP:-5}"
check "public dashboard" "$BASE_URL/dashboard" 200 "${PUBLIC_VERIFY_RETRIES:-3}" "${PUBLIC_VERIFY_SLEEP:-5}"
check "public sw.js" "$BASE_URL/sw.js" 200 "${PUBLIC_VERIFY_RETRIES:-3}" "${PUBLIC_VERIFY_SLEEP:-5}"
check "public manifest" "$BASE_URL/manifest.json" 200 "${PUBLIC_VERIFY_RETRIES:-3}" "${PUBLIC_VERIFY_SLEEP:-5}"
check_hosting_route "public hosting transactions route" "$BACKEND_URL/hosting/transactions" "${PUBLIC_VERIFY_RETRIES:-3}" "${PUBLIC_VERIFY_SLEEP:-5}"

echo "All Labkom verification checks passed."
