#!/usr/bin/env bash
set -Eeuo pipefail

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    -h|--help)
      echo "Usage: $0 [--dry-run]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

BACKUP_DIR="${BACKUP_DIR:-/var/backups/labkom}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
MIN_FREE_MB="${MIN_FREE_MB:-1024}"
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
GZIP_BIN="${GZIP_BIN:-gzip}"
RCLONE_BIN="${RCLONE_BIN:-rclone}"
BACKUP_REMOTE="${BACKUP_REMOTE:-}"
BACKUP_REMOTE_PATH="${BACKUP_REMOTE_PATH:-labkom/postgres}"
DATABASE_URL="${DATABASE_URL:-}"

# Validation of numbers
if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || [ "$RETENTION_DAYS" -le 0 ]; then
  echo "Error: RETENTION_DAYS must be a positive integer" >&2
  exit 1
fi

if ! [[ "$MIN_FREE_MB" =~ ^[0-9]+$ ]] || [ "$MIN_FREE_MB" -le 0 ]; then
  echo "Error: MIN_FREE_MB must be a positive integer" >&2
  exit 1
fi

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
ARCHIVE_NAME="labkom_pg_${TIMESTAMP}.sql.gz"
TARGET_FILE="${BACKUP_DIR}/${ARCHIVE_NAME}"

if [ "$DRY_RUN" = true ]; then
  echo "[DRY-RUN] Backup configuration verified."
  echo "[DRY-RUN] Directory: ${BACKUP_DIR}"
  echo "[DRY-RUN] Target archive: ${TARGET_FILE}"
  echo "[DRY-RUN] Retention: ${RETENTION_DAYS} days"
  echo "[DRY-RUN] Min free space requirement: ${MIN_FREE_MB} MB"
  if [ -n "$BACKUP_REMOTE" ]; then
    echo "[DRY-RUN] Remote upload target: ${BACKUP_REMOTE}:${BACKUP_REMOTE_PATH}/${ARCHIVE_NAME}"
  else
    echo "[DRY-RUN] Remote upload disabled."
  fi
  exit 0
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is required for real execution" >&2
  exit 1
fi

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Free space verification in target directory
FREE_MB=$(df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}')
if [ -n "$FREE_MB" ] && [ "$FREE_MB" -lt "$MIN_FREE_MB" ]; then
  echo "Error: Insufficient disk space on ${BACKUP_DIR}. Free: ${FREE_MB}MB, Required: ${MIN_FREE_MB}MB" >&2
  exit 1
fi

TMP_FILE="${TARGET_FILE}.tmp.$$"
trap 'rm -f "$TMP_FILE"' EXIT

echo "Starting PostgreSQL backup: ${ARCHIVE_NAME}"
"$PG_DUMP_BIN" --dbname="$DATABASE_URL" --format=plain --no-owner --no-privileges | "$GZIP_BIN" -c > "$TMP_FILE"

mv "$TMP_FILE" "$TARGET_FILE"
trap - EXIT
chmod 600 "$TARGET_FILE"
echo "Backup successfully saved to ${TARGET_FILE}"

# Optional remote upload
if [ -n "$BACKUP_REMOTE" ]; then
  echo "Uploading archive to remote: ${BACKUP_REMOTE}:${BACKUP_REMOTE_PATH}/"
  "$RCLONE_BIN" copyto "$TARGET_FILE" "${BACKUP_REMOTE}:${BACKUP_REMOTE_PATH}/${ARCHIVE_NAME}"
  echo "Remote upload completed."
fi

# Retention pruning
echo "Pruning archives older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
find "$BACKUP_DIR" -maxdepth 1 -type f -name "labkom_pg_*.sql.gz" -mtime +"$RETENTION_DAYS" -exec rm -f {} +
echo "Retention pruning completed."
