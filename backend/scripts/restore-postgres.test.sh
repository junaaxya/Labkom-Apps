#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
RESTORE_SCRIPT="${SCRIPT_DIR}/restore-postgres.sh"

echo "=== Test 1: Dry Run Output and Zero-Side-Effect ==="
DRY_OUT=$("$RESTORE_SCRIPT" --dry-run --file /tmp/test-archive.sql.gz)
echo "$DRY_OUT" | grep -q "\[DRY-RUN\] Restore parameters verified"
echo "$DRY_OUT" | grep -q "Target archive file: /tmp/test-archive.sql.gz"
echo "PASS: Basic dry-run"

echo "=== Test 2: Argument Validation ==="
set +e
MISSING_FILE_OUT=$("$RESTORE_SCRIPT" 2>&1)
EXIT_CODE=$?
set -e
if [ $EXIT_CODE -eq 0 ]; then
  echo "FAIL: Expected failure when no file is specified"
  exit 1
fi
echo "$MISSING_FILE_OUT" | grep -q "Either --file or --remote-file must be specified"

set +e
MISSING_FORCE_OUT=$("$RESTORE_SCRIPT" --file /tmp/fake.sql.gz 2>&1)
EXIT_CODE=$?
set -e
if [ $EXIT_CODE -eq 0 ]; then
  echo "FAIL: Expected failure when DATABASE_URL is missing"
  exit 1
fi
echo "$MISSING_FORCE_OUT" | grep -q "DATABASE_URL environment variable is required"

set +e
MISSING_FORCE_OUT2=$(DATABASE_URL="postgres://user:pass@localhost:5432/db" "$RESTORE_SCRIPT" --file /tmp/fake.sql.gz 2>&1)
EXIT_CODE=$?
set -e
if [ $EXIT_CODE -eq 0 ]; then
  echo "FAIL: Expected failure when --force is missing"
  exit 1
fi
echo "$MISSING_FORCE_OUT2" | grep -q "Pass --force to confirm execution"
echo "PASS: Argument validation & safety checks"

echo "=== Test 3: Synthetic Restore Execution With Mocks ==="
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

MOCK_BIN_DIR="${TMP_DIR}/bin"
mkdir -p "$MOCK_BIN_DIR"

# Mock psql
cat << 'EOF' > "${MOCK_BIN_DIR}/psql"
#!/usr/bin/env bash
cat > /dev/null
echo "MOCK_PSQL_INVOKED"
EOF
chmod +x "${MOCK_BIN_DIR}/psql"

# Mock rclone
cat << 'EOF' > "${MOCK_BIN_DIR}/rclone"
#!/usr/bin/env bash
DEST="$3"
echo "MOCK_BACKUP_CONTENT" | gzip -c > "$DEST"
echo "MOCK_RCLONE_DOWNLOADED"
EOF
chmod +x "${MOCK_BIN_DIR}/rclone"

# Prepare valid local archive
VALID_ARCHIVE="${TMP_DIR}/valid_backup.sql.gz"
echo "CREATE TABLE mock_table (id int);" | gzip -c > "$VALID_ARCHIVE"

# Run local restore
LOCAL_RUN_OUT=$(
  PATH="${MOCK_BIN_DIR}:$PATH" \
  DATABASE_URL="postgres://user:pass@localhost:5432/labkom" \
  PSQL_BIN="${MOCK_BIN_DIR}/psql" \
  "$RESTORE_SCRIPT" --file "$VALID_ARCHIVE" --force
)
echo "$LOCAL_RUN_OUT" | grep -q "Archive integrity verified"
echo "$LOCAL_RUN_OUT" | grep -q "Restore successfully completed"
echo "PASS: Local restore execution"

# Run remote restore
REMOTE_RUN_OUT=$(
  PATH="${MOCK_BIN_DIR}:$PATH" \
  DATABASE_URL="postgres://user:pass@localhost:5432/labkom" \
  PSQL_BIN="${MOCK_BIN_DIR}/psql" \
  RCLONE_BIN="${MOCK_BIN_DIR}/rclone" \
  "$RESTORE_SCRIPT" --remote-file "s3remote:labkom/postgres/backup.sql.gz" --force
)
echo "$REMOTE_RUN_OUT" | grep -q "Downloading backup from remote: s3remote:labkom/postgres/backup.sql.gz"
echo "$REMOTE_RUN_OUT" | grep -q "Restore successfully completed"
echo "PASS: Remote restore execution"

echo "ALL RESTORE TESTS PASSED"
