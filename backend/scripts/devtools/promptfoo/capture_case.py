from __future__ import annotations

import argparse
import copy
from datetime import datetime
from datetime import timezone
import json
import sys
from pathlib import Path


PROMPTFOO_DIR = Path(__file__).resolve().parent
if str(PROMPTFOO_DIR) not in sys.path:
    sys.path.insert(0, str(PROMPTFOO_DIR))

from common import build_case_drift_summary
from common import build_saved_case_snapshot
from common import count_math_spans
from common import default_case_artifact_relative_path
from common import load_saved_translation_item
from common import preview_text
from common import read_fixture_rows
from common import resolve_job_root
from common import write_fixture_rows
from foundation.shared.stage_specs import TranslateStageSpec
from devtools.replay_translation_item import replay_translation_item
from services.translation.payload import load_translations


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Capture a translation item into promptfoo fixture CSV.")
    parser.add_argument("--job-root", required=True, help="Absolute job root path or job id under data/jobs.")
    parser.add_argument("--item-id", required=True, help="Translation item id.")
    parser.add_argument("--description", required=True, help="Short case label shown in promptfoo.")
    parser.add_argument("--expected-contains", action="append", default=[], help="Substring that should appear in translated output.")
    parser.add_argument("--required-term", action="append", default=[], help="Term that must be preserved verbatim.")
    parser.add_argument("--forbidden-substring", action="append", default=[], help="Substring that must not appear in output.")
    parser.add_argument("--note", default="", help="Optional free-form note.")
    parser.add_argument("--min-output-chars", type=int, default=None, help="Minimum output length assertion.")
    parser.add_argument("--min-cjk-chars", type=int, default=1, help="Minimum CJK chars when require_cjk is enabled.")
    parser.add_argument("--require-cjk", dest="require_cjk", action="store_true", default=True, help="Require Chinese characters in output.")
    parser.add_argument("--no-require-cjk", dest="require_cjk", action="store_false", help="Disable CJK assertion for this case.")
    parser.add_argument("--skip-replay", action="store_true", help="Only capture the saved artifact, do not replay the current translation path.")
    parser.add_argument("--no-write-artifact", dest="write_artifact", action="store_false", default=True, help="Do not write a JSON case artifact under promptfoo/fixtures.")
    parser.add_argument(
        "--case-artifact",
        default="",
        help="Optional case artifact path. Defaults to promptfoo/fixtures/cases/<job>--<item>.json",
    )
    parser.add_argument(
        "--fixtures",
        type=str,
        default=str((PROMPTFOO_DIR / "fixtures" / "cases.csv").resolve()),
        help="Fixture CSV path.",
    )
    return parser.parse_args()


def _job_root_for_fixture(job_root: Path) -> str:
    repo_jobs_root = (PROMPTFOO_DIR.parents[3] / "data" / "jobs").resolve()
    try:
        return str(job_root.relative_to(repo_jobs_root))
    except ValueError:
        return str(job_root)


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _resolve_case_artifact_path(fixtures_path: Path, job_root: Path, item_id: str, override: str) -> tuple[Path, str]:
    if str(override or "").strip():
        candidate = Path(str(override).strip()).expanduser()
        artifact_path = candidate if candidate.is_absolute() else (fixtures_path.parent / candidate)
    else:
        artifact_path = fixtures_path.parent / default_case_artifact_relative_path(str(job_root), item_id)
    artifact_path = artifact_path.resolve()
    try:
        artifact_rel = str(artifact_path.relative_to(fixtures_path.parent).as_posix())
    except ValueError:
        artifact_rel = str(artifact_path)
    return artifact_path, artifact_rel


def _relativize_to_job_root(path_value: object, job_root: Path) -> str:
    raw = str(path_value or "").strip()
    if not raw:
        return ""
    path = Path(raw)
    try:
        return str(path.resolve().relative_to(job_root.resolve()).as_posix())
    except Exception:
        return raw


def _load_translate_spec(job_root: Path) -> TranslateStageSpec:
    return TranslateStageSpec.load(job_root / "specs" / "translate.spec.json")


def _build_replay_input(job_root: Path, saved_payload: dict[str, object]) -> dict[str, object]:
    spec = _load_translate_spec(job_root)
    page_path = Path(str(saved_payload.get("page_path") or "")).resolve()
    page_payload = load_translations(page_path)
    return {
        "job_root": job_root.name,
        "job_id": spec.job.job_id,
        "item_id": str((saved_payload.get("item") or {}).get("item_id") or ""),
        "page_idx": saved_payload.get("page_idx"),
        "page_path": _relativize_to_job_root(page_path, job_root),
        "spec": {
            "mode": spec.params.mode,
            "math_mode": spec.params.math_mode,
            "skip_title_translation": spec.params.skip_title_translation,
            "rule_profile_name": spec.params.rule_profile_name,
            "custom_rules_text": spec.params.custom_rules_text,
            "classify_batch_size": spec.params.classify_batch_size,
            "workers": spec.params.workers,
            "model": spec.params.model,
            "base_url": spec.params.base_url,
            "glossary_entries": list(spec.params.glossary_entries or []),
            "credential_ref": spec.params.credential_ref,
        },
        "page_payload": page_payload,
    }


def build_case_artifact(
    fixture_row: dict[str, object],
    saved_payload: dict[str, object],
    replay_payload: dict[str, object] | None,
) -> dict[str, object]:
    job_root = resolve_job_root(str(saved_payload.get("job_root") or fixture_row["job_root"]))
    saved_snapshot = build_saved_case_snapshot(saved_payload)
    saved_snapshot["job_root"] = fixture_row["job_root"]
    saved_snapshot["page_path"] = _relativize_to_job_root(saved_snapshot.get("page_path"), job_root)

    replay_section = copy.deepcopy(replay_payload)
    if isinstance(replay_section, dict):
        replay_section["job_root"] = fixture_row["job_root"]
        replay_section["page_path"] = _relativize_to_job_root(
            replay_section.get("page_path"),
            job_root,
        )

    return {
        "schema": "translation_case_bundle_v1",
        "captured_at": _now_iso(),
        "fixture": {
            "job_root": fixture_row["job_root"],
            "item_id": fixture_row["item_id"],
            "description": fixture_row["description"],
            "case_artifact": fixture_row.get("case_artifact", ""),
            "expected_contains": list(fixture_row.get("expected_contains", []) or []),
            "required_terms": list(fixture_row.get("required_terms", []) or []),
            "forbidden_substrings": list(fixture_row.get("forbidden_substrings", []) or []),
            "require_cjk": bool(fixture_row.get("require_cjk", False)),
            "min_cjk_chars": fixture_row.get("min_cjk_chars"),
            "min_output_chars": fixture_row.get("min_output_chars"),
            "notes": fixture_row.get("notes", ""),
        },
        "saved": {
            "snapshot": saved_snapshot,
            "item": saved_payload.get("item") or {},
        },
        "replay_input": _build_replay_input(job_root, saved_payload),
        "replay": replay_section,
        "drift": build_case_drift_summary(saved_payload, replay_payload),
    }


def main() -> int:
    args = parse_args()
    job_root = resolve_job_root(args.job_root)
    payload = load_saved_translation_item(str(job_root), args.item_id)
    source_text = str(payload["source_text"])
    inline_count, block_count = count_math_spans(source_text)
    fixtures_path = Path(args.fixtures).expanduser().resolve()
    rows = read_fixture_rows(fixtures_path)
    artifact_path, artifact_rel = _resolve_case_artifact_path(
        fixtures_path,
        job_root,
        args.item_id,
        args.case_artifact,
    )

    replay_payload = None if args.skip_replay else replay_translation_item(job_root, args.item_id)

    row = {
        "enabled": True,
        "job_root": _job_root_for_fixture(job_root),
        "item_id": args.item_id,
        "description": args.description,
        "source_excerpt": preview_text(source_text),
        "expected_contains": args.expected_contains,
        "required_terms": args.required_term,
        "forbidden_substrings": args.forbidden_substring,
        "require_cjk": args.require_cjk,
        "min_cjk_chars": args.min_cjk_chars if args.require_cjk else None,
        "min_output_chars": args.min_output_chars,
        "expected_inline_math_count": inline_count,
        "expected_block_math_count": block_count,
        "case_artifact": artifact_rel if args.write_artifact else "",
        "notes": args.note,
    }

    replaced = False
    for index, existing in enumerate(rows):
        if (
            str(existing.get("job_root", "") or "").strip() == row["job_root"]
            and str(existing.get("item_id", "") or "").strip() == row["item_id"]
        ):
            rows[index] = row
            replaced = True
            break
    if not replaced:
        rows.append(row)
    write_fixture_rows(fixtures_path, rows)

    if args.write_artifact:
        artifact_payload = build_case_artifact(row, payload, replay_payload)
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        artifact_path.write_text(
            json.dumps(artifact_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    print(
        json.dumps(
            {
                "fixture_path": str(fixtures_path),
                "job_root": row["job_root"],
                "item_id": row["item_id"],
                "description": row["description"],
                "replaced": replaced,
                "case_artifact": row.get("case_artifact", ""),
                "replay_captured": replay_payload is not None,
                "drift": build_case_drift_summary(payload, replay_payload),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
