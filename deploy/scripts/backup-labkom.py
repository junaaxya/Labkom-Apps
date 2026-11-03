#!/usr/bin/env python3
"""Create and verify an atomic PostgreSQL custom-format backup for LabKom."""
import argparse
import datetime as dt
import os
from pathlib import Path
import subprocess
import sys

BACKUP_DIR = Path("/mnt/data/backups/labkom")
CONTAINER = "labkom-postgres"
DATABASE = "lab_management"
DATABASE_USER = "labkom_prod"


def run_backup(report: bool = False) -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone(dt.timedelta(hours=7))).strftime("%Y%m%d-%H%M%S")
    final_path = BACKUP_DIR / f"labkom-auto-{timestamp}.dump"
    partial_path = BACKUP_DIR / f"labkom-auto-{timestamp}.dump.partial"

    with partial_path.open("wb") as output:
        result = subprocess.run(
            ["docker", "exec", CONTAINER, "pg_dump", "-U", DATABASE_USER, "-d", DATABASE, "-Fc"],
            stdout=output,
            stderr=subprocess.PIPE,
            check=False,
        )
    if result.returncode != 0:
        raise RuntimeError(f"pg_dump gagal (exit {result.returncode})")
    if partial_path.stat().st_size < 1024:
        raise RuntimeError("hasil pg_dump terlalu kecil")

    with partial_path.open("rb") as source:
        verify = subprocess.run(
            ["docker", "exec", "-i", CONTAINER, "pg_restore", "--list"],
            stdin=source,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            check=False,
        )
    if verify.returncode != 0:
        raise RuntimeError(f"verifikasi pg_restore gagal (exit {verify.returncode})")

    os.chmod(partial_path, 0o600)
    os.replace(partial_path, final_path)
    if report:
        print(f"backup_ok={final_path}|bytes={final_path.stat().st_size}")
    return final_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args()
    try:
        run_backup(args.report)
    except Exception as error:
        print(f"ALERT: Backup PostgreSQL LabKom gagal: {error}", file=sys.stderr)
        raise SystemExit(1)
