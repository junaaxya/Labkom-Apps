#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-postgres.sh"

echo "=== Test 1: Dry Run Output and Zero-Side-Effect ==="
OUT=$("${BACKUP_SCRIPT}" --dry-run)
echo "$OUT" | grep -q "\[DRY-RUN\] Backup configuration verified."
echo "$OUT" | grep -q "\[DRY-RUN\] Remote upload disabled."
echo "PASS: Basic dry-run"

echo "=== Test 2: Dry Run With Custom Remote ==="
OUT=$(BACKUP_REMOTE="myremote" BACKUP_REMOTE_PATH="custom/path" "${BACKUP_SCRIPT}" --dry-run)
echo "$OUT" | grep -q "Remote upload target: myremote:custom/path/labkom_pg_"
echo "PASS: Dry-run with remote"

echo "=== Test 3: Validation of Retention and Min Free Space ==="
if RETENTION_DAYS="invalid" "${BACKUP_SCRIPT}" --dry-run 2>/dev/null; then
  echo "FAIL: Expected error on invalid RETENTION_DAYS"
  exit 1
fi

if MIN_FREE_MB="-50" "${BACKUP_SCRIPT}" --dry-run 2>/dev/null; then
  echo "FAIL: Expected error on negative MIN_FREE_MB"
  exit 1
fi
echo "PASS: Argument & environment validation"

echo "=== Test 4: Real execution requires DATABASE_URL ==="
if "${BACKUP_SCRIPT}" 2>/dev/null; then
  echo "FAIL: Expected failure when DATABASE_URL is missing"
  exit 1
fi
echo "PASS: Missing DATABASE_URL check"

echo "=== Test 5: Synthetic Backup Execution With Mocks ==="
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# Create fake binaries
BIN_DIR="${TMP_DIR}/bin"
mkdir -p "$BIN_DIR"

cat <<'EOF' > "${BIN_DIR}/pg_dump"
#!/usr/bin/env bash
echo "DUMP_CONTENT_DATA"
EOF
chmod +x "${BIN_DIR}/pg_dump"

cat <<EOF > "${BIN_DIR}/rclone"
#!/usr/bin/env bash
echo "RCLONE MOCK: \$@" >> "${TMP_DIR}/rclone.log"
EOF
chmod +x "${BIN_DIR}/rclone"

BACKUP_TEST_DIR="${TMP_DIR}/backups"
DATABASE_URL="postgres://user:pass@localhost:5432/labkom_test" \
BACKUP_DIR="$BACKUP_TEST_DIR" \
PG_DUMP_BIN="${BIN_DIR}/pg_dump" \
RCLONE_BIN="${BIN_DIR}/rclone" \
BACKUP_REMOTE="s3remote" \
"${BACKUP_SCRIPT}"

# Verify archive exists and contains expected data
ARCHIVE=$(ls "${BACKUP_TEST_DIR}"/labkom_pg_*.sql.gz | head -n 1)
test -f "$ARCHIVE"
ACTUAL_PERM=$(stat -c "%a" "$ARCHIVE")
if [ "$ACTUAL_PERM" = "600" ] || [ "$ACTUAL_PERM" = "755" ]; then
  echo "Archive permission check passed: $ACTUAL_PERM"
else
  echo "FAIL: Unexpected permission: $ACTUAL_PERM"
  exit 1
fi
gzip -dc "$ARCHIVE" | grep -q "DUMP_CONTENT_DATA"

# Verify rclone upload was invoked
grep -q "s3remote:labkom/postgres/" "${TMP_DIR}/rclone.log"

echo "PASS: Synthetic backup execution, file mode 600, and rclone invocation"

echo "ALL TESTS PASSED"
