from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import PurePosixPath
from pathlib import Path


PROMPTFOO_DIR = Path(__file__).resolve().parent
SCRIPTS_ROOT = PROMPTFOO_DIR.parents[1]
REPO_ROOT = SCRIPTS_ROOT.parents[1]

if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from services.translation.payload import load_translation_manifest_file
from services.translation.payload import load_translations


LIST_SEPARATOR = "||"
FIXTURE_HEADERS = [
    "enabled",
    "job_root",
    "item_id",
    "description",
    "source_excerpt",
    "expected_contains",
    "required_terms",
    "forbidden_substrings",
    "require_cjk",
    "min_cjk_chars",
    "min_output_chars",
    "expected_inline_math_count",
    "expected_block_math_count",
    "case_artifact",
    "notes",
]


def resolve_job_root(value: str) -> Path:
    raw = str(value or "").strip()
    if not raw:
        raise RuntimeError("missing job_root")
    path = Path(raw).expanduser()
    if not path.is_absolute():
        path = (REPO_ROOT / "data" / "jobs" / raw).resolve()
    return path.resolve()


def preview_text(text: str, *, limit: int = 180) -> str:
    compact = " ".join(str(text or "").split()).strip()
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "…"


def _string(value: object) -> str:
    return str(value or "").strip()


def _bool(value: object, *, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    raw = _string(value).lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "y", "on"}


def _slug(value: object) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "-", _string(value))
    safe = safe.strip("-")
    return safe or "unknown"


def split_list(value: str) -> list[str]:
    return [part.strip() for part in str(value or "").split(LIST_SEPARATOR) if part.strip()]


def join_list(values: list[str]) -> str:
    return LIST_SEPARATOR.join(str(value or "").strip() for value in values if str(value or "").strip())


def parse_bool(value: str, *, default: bool = False) -> bool:
    raw = str(value or "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "y", "on"}


def parse_int(value: str) -> int | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    return int(raw)


def count_math_spans(text: str) -> tuple[int, int]:
    raw = str(text or "")
    block_count = len(re.findall(r"\$\$(.+?)\$\$", raw, flags=re.S))
    inline_source = re.sub(r"\$\$(.+?)\$\$", " ", raw, flags=re.S)
    inline_count = len(re.findall(r"(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)", inline_source, flags=re.S))
    return inline_count, block_count


def load_saved_translation_items(job_root_value: str) -> list[dict[str, object]]:
    job_root = resolve_job_root(job_root_value)
    manifest_path = job_root / "translated" / "translation-manifest.json"
    manifest = load_translation_manifest_file(manifest_path, translations_dir=manifest_path.parent)
    items: list[dict[str, object]] = []
    for page_idx, payload_path in sorted(manifest.items()):
        payload = load_translations(payload_path)
        for item in payload:
            items.append(
                {
                    "job_root": str(job_root),
                    "job_id": job_root.name,
                    "page_idx": int(item.get("page_idx", page_idx) or page_idx),
                    "page_number": int(item.get("page_idx", page_idx) or page_idx) + 1,
                    "page_path": str(payload_path),
                    "item": item,
                    "source_text": str(item.get("source_text", "") or ""),
                    "translated_text": str(item.get("translated_text", "") or ""),
                }
            )
    return items


def default_case_artifact_relative_path(job_root_value: str, item_id: str) -> str:
    job_root = resolve_job_root(job_root_value)
    return str(PurePosixPath("cases") / f"{_slug(job_root.name)}--{_slug(item_id)}.json")


def resolve_case_artifact_path(job_root_value: str, item_id: str, case_artifact: str = "") -> Path:
    raw = _string(case_artifact)
    if raw:
        path = Path(raw).expanduser()
        if not path.is_absolute():
            path = (PROMPTFOO_DIR / "fixtures" / raw).resolve()
        return path.resolve()
    return (PROMPTFOO_DIR / "fixtures" / default_case_artifact_relative_path(job_root_value, item_id)).resolve()


def load_case_artifact_bundle(job_root_value: str, item_id: str, case_artifact: str = "") -> dict[str, object] | None:
    artifact_path = resolve_case_artifact_path(job_root_value, item_id, case_artifact)
    if not artifact_path.exists():
        return None
    try:
        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _saved_payload_from_case_artifact(
    bundle: dict[str, object],
    *,
    fallback_job_root: str,
    item_id: str,
) -> dict[str, object]:
    saved = dict(bundle.get("saved") or {})
    snapshot = dict(saved.get("snapshot") or {})
    item = dict(saved.get("item") or {})
    resolved_page_idx = snapshot.get("page_idx")
    if resolved_page_idx is None:
        resolved_page_idx = item.get("page_idx")
    resolved_page_number = snapshot.get("page_number")
    if resolved_page_number is None and resolved_page_idx is not None:
        resolved_page_number = int(resolved_page_idx) + 1
    source_text = _string(snapshot.get("source_text")) or _string(item.get("source_text"))
    translated_text = _string(snapshot.get("translated_text")) or _string(item.get("translated_text"))
    return {
        "job_root": _string(snapshot.get("job_root")) or fallback_job_root,
        "job_id": _string(snapshot.get("job_id")) or Path(fallback_job_root).name,
        "page_idx": resolved_page_idx,
        "page_number": resolved_page_number,
        "page_path": _string(snapshot.get("page_path")),
        "item": item,
        "source_text": source_text,
        "translated_text": translated_text,
    }


def load_saved_translation_item(job_root_value: str, item_id: str, case_artifact: str = "") -> dict[str, object]:
    job_root = resolve_job_root(job_root_value)
    manifest_path = job_root / "translated" / "translation-manifest.json"
    if manifest_path.exists():
        manifest = load_translation_manifest_file(manifest_path, translations_dir=manifest_path.parent)
        for page_idx, payload_path in sorted(manifest.items()):
            payload = load_translations(payload_path)
            for item in payload:
                if str(item.get("item_id", "") or "") == item_id:
                    return {
                        "job_root": str(job_root),
                        "job_id": job_root.name,
                        "page_idx": int(item.get("page_idx", page_idx) or page_idx),
                        "page_number": int(item.get("page_idx", page_idx) or page_idx) + 1,
                        "page_path": str(payload_path),
                        "item": item,
                        "source_text": str(item.get("source_text", "") or ""),
                        "translated_text": str(item.get("translated_text", "") or ""),
                    }
    bundle = load_case_artifact_bundle(job_root_value, item_id, case_artifact)
    if bundle is not None:
        return _saved_payload_from_case_artifact(
            bundle,
            fallback_job_root=str(job_root_value),
            item_id=item_id,
        )
    raise RuntimeError(f"translation item not found: {job_root}/{item_id}")


def build_saved_case_snapshot(payload: dict[str, object]) -> dict[str, object]:
    item = dict(payload.get("item") or {})
    source_text = _string(payload.get("source_text"))
    translated_text = _string(payload.get("translated_text"))
    return {
        "job_root": _string(payload.get("job_root")),
        "job_id": _string(payload.get("job_id")),
        "item_id": _string(item.get("item_id")),
        "page_idx": payload.get("page_idx"),
        "page_number": payload.get("page_number"),
        "page_path": _string(payload.get("page_path")),
        "block_idx": item.get("block_idx"),
        "block_type": _string(item.get("block_type")),
        "math_mode": _string(item.get("math_mode")),
        "source_text": source_text,
        "translated_text": translated_text,
        "source_preview": preview_text(source_text),
        "translated_preview": preview_text(translated_text) if translated_text else "",
        "classification_label": _string(item.get("classification_label")),
        "should_translate": _bool(item.get("should_translate"), default=True),
        "skip_reason": _string(item.get("skip_reason")),
        "final_status": _string(item.get("final_status")),
        "translation_diagnostics": item.get("translation_diagnostics") or {},
    }


def build_case_drift_summary(
    saved_payload: dict[str, object],
    replay_payload: dict[str, object] | None = None,
) -> dict[str, object]:
    saved_snapshot = build_saved_case_snapshot(saved_payload)
    replay_payload = dict(replay_payload or {})
    replay_result = dict(replay_payload.get("replay_result") or {})
    replay_error = dict(replay_payload.get("replay_error") or {})
    policy_before = dict(replay_payload.get("policy_before") or {})
    policy_after = dict(replay_payload.get("policy_after") or {})
    replay_translated_text = _string(replay_result.get("translated_text"))
    saved_translated_text = _string(saved_snapshot.get("translated_text"))

    saved_should_translate = _bool(saved_snapshot.get("should_translate"), default=True)
    replay_should_translate = (
        _bool(policy_after.get("should_translate"), default=True)
        if policy_after
        else None
    )

    reason_tags: list[str] = []
    if replay_error:
        reason_tags.append("replay_error")
    if policy_before != policy_after and (policy_before or policy_after):
        reason_tags.append("policy_changed")
    if replay_should_translate is not None and replay_should_translate != saved_should_translate:
        reason_tags.append("should_translate_changed")
    if _string(policy_before.get("classification_label")) != _string(
        policy_after.get("classification_label")
    ):
        reason_tags.append("classification_changed")
    if _string(policy_before.get("skip_reason")) != _string(policy_after.get("skip_reason")):
        reason_tags.append("skip_reason_changed")
    if _string(saved_snapshot.get("final_status")) != _string(replay_result.get("final_status")):
        if _string(replay_result.get("final_status")):
            reason_tags.append("final_status_changed")
    if bool(saved_translated_text) != bool(replay_translated_text):
        reason_tags.append("translation_presence_changed")
    if saved_translated_text and replay_translated_text and saved_translated_text != replay_translated_text:
        reason_tags.append("translation_text_changed")

    return {
        "saved_final_status": _string(saved_snapshot.get("final_status")),
        "replay_policy_final_status": _string(policy_after.get("final_status")),
        "replay_result_final_status": _string(replay_result.get("final_status")),
        "saved_should_translate": saved_should_translate,
        "replay_should_translate": replay_should_translate,
        "saved_skip_reason": _string(saved_snapshot.get("skip_reason")),
        "replay_skip_reason": _string(policy_after.get("skip_reason")),
        "saved_classification_label": _string(saved_snapshot.get("classification_label")),
        "replay_classification_label": _string(policy_after.get("classification_label")),
        "saved_has_translation": bool(saved_translated_text),
        "replay_has_translation": bool(replay_translated_text),
        "replay_error_type": _string(replay_error.get("type")),
        "policy_changed": "policy_changed" in reason_tags,
        "drifted": bool(reason_tags),
        "reason_tags": reason_tags,
    }


def read_fixture_rows(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        return []
    rows: list[dict[str, object]] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for raw_row in reader:
            if not raw_row:
                continue
            if not any(str(value or "").strip() for value in raw_row.values()):
                continue
            rows.append(
                {
                    "enabled": parse_bool(raw_row.get("enabled", ""), default=True),
                    "job_root": str(raw_row.get("job_root", "") or "").strip(),
                    "item_id": str(raw_row.get("item_id", "") or "").strip(),
                    "description": str(raw_row.get("description", "") or "").strip(),
                    "source_excerpt": str(raw_row.get("source_excerpt", "") or "").strip(),
                    "expected_contains": split_list(raw_row.get("expected_contains", "")),
                    "required_terms": split_list(raw_row.get("required_terms", "")),
                    "forbidden_substrings": split_list(raw_row.get("forbidden_substrings", "")),
                    "require_cjk": parse_bool(raw_row.get("require_cjk", ""), default=False),
                    "min_cjk_chars": parse_int(raw_row.get("min_cjk_chars", "")),
                    "min_output_chars": parse_int(raw_row.get("min_output_chars", "")),
                    "expected_inline_math_count": parse_int(raw_row.get("expected_inline_math_count", "")),
                    "expected_block_math_count": parse_int(raw_row.get("expected_block_math_count", "")),
                    "case_artifact": str(raw_row.get("case_artifact", "") or "").strip(),
                    "notes": str(raw_row.get("notes", "") or "").strip(),
                }
            )
    return rows


def write_fixture_rows(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIXTURE_HEADERS)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "enabled": "1" if bool(row.get("enabled", True)) else "0",
                    "job_root": str(row.get("job_root", "") or ""),
                    "item_id": str(row.get("item_id", "") or ""),
                    "description": str(row.get("description", "") or ""),
                    "source_excerpt": str(row.get("source_excerpt", "") or ""),
                    "expected_contains": join_list(list(row.get("expected_contains", []) or [])),
                    "required_terms": join_list(list(row.get("required_terms", []) or [])),
                    "forbidden_substrings": join_list(list(row.get("forbidden_substrings", []) or [])),
                    "require_cjk": "1" if bool(row.get("require_cjk", False)) else "0",
                    "min_cjk_chars": str(row.get("min_cjk_chars", "") or ""),
                    "min_output_chars": str(row.get("min_output_chars", "") or ""),
                    "expected_inline_math_count": str(row.get("expected_inline_math_count", "") or ""),
                    "expected_block_math_count": str(row.get("expected_block_math_count", "") or ""),
                    "case_artifact": str(row.get("case_artifact", "") or ""),
                    "notes": str(row.get("notes", "") or ""),
                }
            )
