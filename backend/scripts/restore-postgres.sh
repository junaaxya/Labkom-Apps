#!/usr/bin/env bash
set -Eeuo pipefail

DRY_RUN=false
FORCE=false
LOCAL_FILE=""
REMOTE_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --file)
      LOCAL_FILE="${2:-}"
      shift 2 || true
      ;;
    --remote-file)
      REMOTE_FILE="${2:-}"
      shift 2 || true
      ;;
    -h|--help)
      echo "Usage: $0 [--file <archive.sql.gz>] [--remote-file <remote:path>] [--dry-run] [--force]"
      exit 0
      ;;
    *)
      if [ -z "$LOCAL_FILE" ]; then
        LOCAL_FILE="$1"
        shift
      else
        echo "Unknown argument: $1" >&2
        exit 1
      fi
      ;;
  esac
done

PSQL_BIN="${PSQL_BIN:-psql}"
GZIP_BIN="${GZIP_BIN:-gzip}"
RCLONE_BIN="${RCLONE_BIN:-rclone}"
DATABASE_URL="${DATABASE_URL:-}"

if [ -z "$LOCAL_FILE" ] && [ -z "$REMOTE_FILE" ]; then
  echo "Error: Either --file or --remote-file must be specified." >&2
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  echo "[DRY-RUN] Restore parameters verified."
  if [ -n "$REMOTE_FILE" ]; then
    echo "[DRY-RUN] Remote source: ${REMOTE_FILE}"
  fi
  echo "[DRY-RUN] Target archive file: ${LOCAL_FILE:-<temporary download>}"
  echo "[DRY-RUN] Decompression binary: ${GZIP_BIN}"
  echo "[DRY-RUN] Database client: ${PSQL_BIN}"
  echo "[DRY-RUN] Database restore command would execute via gunzip | psql"
  exit 0
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is required for real execution" >&2
  exit 1
fi

if [ "$FORCE" != true ]; then
  echo "Error: Real restore will overwrite database contents. Pass --force to confirm execution." >&2
  exit 1
fi

TEMP_DIR=""
RESTORE_FILE="$LOCAL_FILE"

if [ -n "$REMOTE_FILE" ]; then
  TEMP_DIR=$(mktemp -d /tmp/labkom_restore.XXXXXX)
  trap 'rm -rf "$TEMP_DIR"' EXIT
  DOWNLOAD_DEST="${TEMP_DIR}/$(basename "$REMOTE_FILE")"
  echo "Downloading backup from remote: ${REMOTE_FILE}..."
  "$RCLONE_BIN" copyto "$REMOTE_FILE" "$DOWNLOAD_DEST"
  RESTORE_FILE="$DOWNLOAD_DEST"
fi

if [ ! -f "$RESTORE_FILE" ]; then
  echo "Error: Archive file not found: ${RESTORE_FILE}" >&2
  exit 1
fi

echo "Verifying archive integrity..."
"$GZIP_BIN" -t "$RESTORE_FILE"
echo "Archive integrity verified."

echo "Restoring database from ${RESTORE_FILE}..."
"$GZIP_BIN" -dc "$RESTORE_FILE" | "$PSQL_BIN" --dbname="$DATABASE_URL" --single-transaction --set ON_ERROR_STOP=on
echo "Restore successfully completed."
