from __future__ import annotations

import sqlite3
import sys
import time
from pathlib import Path

from .job_store import DB_PATH


SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.append(str(SCRIPTS_DIR))

from translation.policy.rule_profiles import KNOWN_RULE_PROFILE_NAMES
from translation.policy.rule_profiles import build_rule_profile_context
from translation.policy.rule_profiles import normalize_rule_profile_name


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_rule_profile_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS rule_profiles (
                name TEXT PRIMARY KEY,
                profile_text TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_rule_profiles_updated_at ON rule_profiles(updated_at DESC);
            """
        )


def _utc_now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _builtin_record(name: str) -> dict[str, str | bool]:
    context = build_rule_profile_context(name, "")
    return {
        "name": context.profile_name,
        "display_name": context.profile_name,
        "profile_text": context.profile_text,
        "description": "built-in",
        "built_in": True,
        "created_at": "",
        "updated_at": "",
    }


def list_rule_profiles() -> list[dict[str, str | bool]]:
    init_rule_profile_db()
    builtins = [_builtin_record(name) for name in sorted(name for name in KNOWN_RULE_PROFILE_NAMES if name != "general")]
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT name, profile_text, description, created_at, updated_at
            FROM rule_profiles
            ORDER BY updated_at DESC, name ASC
            """
        ).fetchall()
    custom = [
        {
            "name": row["name"],
            "display_name": row["name"],
            "profile_text": row["profile_text"],
            "description": row["description"],
            "built_in": False,
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]
    return builtins + custom


def load_rule_profile(name: str) -> dict[str, str | bool]:
    init_rule_profile_db()
    normalized = normalize_rule_profile_name(name)
    if normalized in KNOWN_RULE_PROFILE_NAMES:
        return _builtin_record(normalized)
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT name, profile_text, description, created_at, updated_at
            FROM rule_profiles
            WHERE name = ?
            """,
            (name.strip(),),
        ).fetchone()
    if row is None:
        raise KeyError(name)
    return {
        "name": row["name"],
        "display_name": row["name"],
        "profile_text": row["profile_text"],
        "description": row["description"],
        "built_in": False,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def save_rule_profile(name: str, profile_text: str, description: str = "") -> dict[str, str | bool]:
    init_rule_profile_db()
    normalized_name = (name or "").strip().lower().replace("-", "_")
    if not normalized_name:
        raise ValueError("rule profile name is required")
    if normalized_name in KNOWN_RULE_PROFILE_NAMES:
        raise ValueError("cannot overwrite built-in rule profile")
    now = _utc_now_iso()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO rule_profiles (name, profile_text, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                profile_text=excluded.profile_text,
                description=excluded.description,
                updated_at=excluded.updated_at
            """,
            (normalized_name, (profile_text or "").strip(), (description or "").strip(), now, now),
        )
    return load_rule_profile(normalized_name)


__all__ = [
    "init_rule_profile_db",
    "list_rule_profiles",
    "load_rule_profile",
    "save_rule_profile",
]
