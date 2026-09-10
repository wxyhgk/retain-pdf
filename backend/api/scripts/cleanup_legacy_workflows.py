#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import sqlite3
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Clean legacy workflow values from rust_api jobs.db"
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=Path("data/db/jobs.db"),
        help="Path to jobs.db",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Do not create a .bak file before mutating the database",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only print what would change",
    )
    return parser.parse_args()


def scalar(conn: sqlite3.Connection, sql: str) -> int:
    row = conn.execute(sql).fetchone()
    return int(row[0] if row else 0)


def main() -> int:
    args = parse_args()
    db_path = args.db.resolve()
    if not db_path.exists():
        raise SystemExit(f"database not found: {db_path}")

    if not args.no_backup and not args.dry_run:
        backup_path = db_path.with_suffix(db_path.suffix + ".bak")
        shutil.copy2(db_path, backup_path)
        print(f"backup created: {backup_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        legacy_jobs = scalar(
            conn, """select count(*) from jobs where workflow='\"mineru\"';"""
        )
        legacy_request_json = scalar(
            conn,
            """select count(*) from jobs where request_json like '%"workflow":"mineru"%';""",
        )
        legacy_event_payloads = scalar(
            conn,
            """select count(*) from events where payload_json like '%"workflow":"mineru"%';""",
        )

        print(f"legacy jobs.workflow rows: {legacy_jobs}")
        print(f"legacy jobs.request_json rows: {legacy_request_json}")
        print(f"legacy events.payload_json rows: {legacy_event_payloads}")

        if args.dry_run:
            return 0

        with conn:
            conn.execute(
                """
                update jobs
                   set workflow='\"book\"'
                 where workflow='\"mineru\"';
                """
            )
            conn.execute(
                """
                update jobs
                   set request_json=replace(request_json, '"workflow":"mineru"', '"workflow":"book"')
                 where request_json like '%"workflow":"mineru"%';
                """
            )
            conn.execute(
                """
                update events
                   set payload_json=replace(payload_json, '"workflow":"mineru"', '"workflow":"book"')
                 where payload_json like '%"workflow":"mineru"%';
                """
            )

        remaining_jobs = scalar(
            conn, """select count(*) from jobs where workflow='\"mineru\"';"""
        )
        remaining_request_json = scalar(
            conn,
            """select count(*) from jobs where request_json like '%"workflow":"mineru"%';""",
        )
        remaining_event_payloads = scalar(
            conn,
            """select count(*) from events where payload_json like '%"workflow":"mineru"%';""",
        )

        print(f"remaining jobs.workflow rows: {remaining_jobs}")
        print(f"remaining jobs.request_json rows: {remaining_request_json}")
        print(f"remaining events.payload_json rows: {remaining_event_payloads}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
