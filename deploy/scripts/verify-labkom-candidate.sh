#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:13002}"
BACKEND_URL="${2:-http://127.0.0.1:18004}"
"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/verify-labkom.sh" "$BASE_URL" "$BACKEND_URL"
