from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any


PROMPTFOO_DIR = Path(__file__).resolve().parent

if str(PROMPTFOO_DIR) not in sys.path:
    sys.path.insert(0, str(PROMPTFOO_DIR))

from common import count_math_spans
from common import load_saved_translation_item
from common import preview_text
from common import read_fixture_rows


ASSERTIONS = [
    "file://assertions.py:check_min_output_length",
    "file://assertions.py:check_cjk_if_required",
    "file://assertions.py:check_expected_contains",
    "file://assertions.py:check_required_terms",
    "file://assertions.py:check_forbidden_substrings",
    "file://assertions.py:check_math_delimiters",
]


def _fixtures_path() -> Path:
    override = os.environ.get("PROMPTFOO_TRANSLATION_FIXTURES", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return (PROMPTFOO_DIR / "fixtures" / "cases.csv").resolve()


def _default_math_expectation(source_text: str, explicit_value: Any) -> int | None:
    if explicit_value not in (None, ""):
        return int(explicit_value)
    inline_count, block_count = count_math_spans(source_text)
    del block_count
    if inline_count > 0:
        return inline_count
    return None


def _default_block_math_expectation(source_text: str, explicit_value: Any) -> int | None:
    if explicit_value not in (None, ""):
        return int(explicit_value)
    inline_count, block_count = count_math_spans(source_text)
    del inline_count
    if block_count > 0:
        return block_count
    return None


def _json_safe_vars(values: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in values.items() if value is not None}


def generate_tests(config: dict[str, Any] | None = None, **_: Any) -> list[dict[str, Any]]:
    rows = [row for row in read_fixture_rows(_fixtures_path()) if row.get("enabled", True)]
    tests: list[dict[str, Any]] = []
    for row in rows:
        payload = load_saved_translation_item(
            str(row["job_root"]),
            str(row["item_id"]),
            str(row.get("case_artifact") or ""),
        )
        source_text = str(payload["source_text"])
        saved_text = str(payload["translated_text"])
        vars_payload = _json_safe_vars(
            {
                "job_root": row["job_root"],
                "item_id": row["item_id"],
                "case_artifact": str(row.get("case_artifact") or ""),
                "source_text": source_text,
                "saved_text": saved_text,
                "source_excerpt": str(row.get("source_excerpt") or preview_text(source_text)),
                "expected_contains": list(row.get("expected_contains", []) or []),
                "required_terms": list(row.get("required_terms", []) or []),
                "forbidden_substrings": list(row.get("forbidden_substrings", []) or []),
                "require_cjk": bool(row.get("require_cjk", False)),
                "min_cjk_chars": row.get("min_cjk_chars") if row.get("min_cjk_chars") is not None else 1,
                "min_output_chars": row.get("min_output_chars"),
                "expected_inline_math_count": _default_math_expectation(
                    source_text,
                    row.get("expected_inline_math_count"),
                ),
                "expected_block_math_count": _default_block_math_expectation(
                    source_text,
                    row.get("expected_block_math_count"),
                ),
                "notes": row.get("notes", ""),
            }
        )
        tests.append(
            {
                "description": row.get("description") or f'{row["job_root"]}:{row["item_id"]}',
                "vars": vars_payload,
                "assert": [{"type": "python", "value": assertion} for assertion in ASSERTIONS],
                "tags": [str(row["job_root"]), str(row["item_id"])],
            }
        )
    return tests
