from __future__ import annotations

import argparse
import contextlib
import json
import os
import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.foundation.shared.stage_specs import TranslateStageSpec
from retainpdf_pipeline.foundation.shared.stage_specs import resolve_credential_ref
from retainpdf_pipeline.services.pipeline_shared.io import save_json
from retainpdf_pipeline.translate.services.agents.repair import RepairAgent
from retainpdf_pipeline.translate.services.agents.repair import TranslationRepairRequest
from retainpdf_pipeline.translate.artifacts.review import TRANSLATION_REVIEW_FILE_NAME
from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content
from retainpdf_pipeline.translate.core.payload import load_translation_manifest_file
from retainpdf_pipeline.translate.services.quality import TranslationQualityIssue


TRANSLATION_REPAIR_PLAN_FILE_NAME = "translation_repair_plan.json"
TRANSLATION_REPAIR_PREVIEW_FILE_NAME = "translation_repair_preview.json"
TRANSLATION_REPAIR_PLAN_SCHEMA = "translation_repair_plan_v1"
TRANSLATION_REPAIR_PREVIEW_SCHEMA = "translation_repair_preview_v1"


RequestChatContentFn = Callable[..., str]


@dataclass(frozen=True)
class TranslationRepairInputs:
    job_root: Path
    spec: TranslateStageSpec
    review: dict
    items_by_id: dict[str, dict]
    item_locations: dict[str, dict[str, object]]


def _preview_text(text: str, *, limit: int = 220) -> str:
    compact = " ".join(str(text or "").split()).strip()
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "..."


def _job_root_from_arg(value: str) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = (REPO_SCRIPTS_ROOT.parents[1] / "data" / "jobs" / value).resolve()
    return path.resolve()


def _load_translate_spec(job_root: Path) -> TranslateStageSpec:
    return TranslateStageSpec.load(job_root / "specs" / "translate.spec.json")


def _load_review(job_root: Path) -> dict:
    review_path = job_root / "artifacts" / TRANSLATION_REVIEW_FILE_NAME
    if not review_path.exists():
        raise RuntimeError(f"translation review artifact not found: {review_path}")
    payload = json.loads(review_path.read_text(encoding="utf-8"))
    if str(payload.get("schema", "") or "") != "translation_review_v1":
        raise RuntimeError(f"Unsupported translation review schema: {payload.get('schema') or '<missing>'}")
    return payload


def _load_translated_items(job_root: Path) -> tuple[dict[str, dict], dict[str, dict[str, object]]]:
    manifest_path = job_root / "translated" / "translation-manifest.json"
    manifest = load_translation_manifest_file(manifest_path, translations_dir=manifest_path.parent)
    items_by_id: dict[str, dict] = {}
    item_locations: dict[str, dict[str, object]] = {}
    for page_idx, payload_path in sorted(manifest.items()):
        payload = json.loads(payload_path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            raise RuntimeError(f"invalid translation payload: {payload_path}")
        for block_idx, item in enumerate(payload):
            if not isinstance(item, dict):
                continue
            item_id = str(item.get("item_id", "") or "")
            if not item_id:
                continue
            items_by_id[item_id] = item
            item_locations[item_id] = {
                "page_idx": int(item.get("page_idx", page_idx) or page_idx),
                "page_number": int(item.get("page_idx", page_idx) or page_idx) + 1,
                "block_idx": int(item.get("block_idx", block_idx) if item.get("block_idx") is not None else block_idx),
                "payload_path": str(payload_path),
            }
    return items_by_id, item_locations


def load_translation_repair_inputs(job_root: Path) -> TranslationRepairInputs:
    resolved_job_root = Path(job_root).resolve()
    spec = _load_translate_spec(resolved_job_root)
    review = _load_review(resolved_job_root)
    items_by_id, item_locations = _load_translated_items(resolved_job_root)
    return TranslationRepairInputs(
        job_root=resolved_job_root,
        spec=spec,
        review=review,
        items_by_id=items_by_id,
        item_locations=item_locations,
    )


def _issue_from_dict(payload: dict) -> TranslationQualityIssue:
    return TranslationQualityIssue(
        item_id=str(payload.get("item_id", "") or ""),
        kind=str(payload.get("kind", "") or ""),
        severity=str(payload.get("severity", "") or "warning"),
        message=str(payload.get("message", "") or ""),
        retryable=bool(payload.get("retryable", True)),
        details=dict(payload.get("details") or {}) if isinstance(payload.get("details"), dict) else None,
    )


def _issues_by_item(review: dict) -> dict[str, list[TranslationQualityIssue]]:
    grouped: dict[str, list[TranslationQualityIssue]] = {}
    for raw_issue in review.get("issues") or []:
        if not isinstance(raw_issue, dict):
            continue
        issue = _issue_from_dict(raw_issue)
        if not issue.item_id:
            continue
        grouped.setdefault(issue.item_id, []).append(issue)
    return grouped


def _translated_result_from_item(item: dict) -> dict[str, str]:
    return {
        "decision": str(item.get("decision", "") or "translate"),
        "translated_text": str(
            item.get("translated_text")
            or item.get("protected_translated_text")
            or item.get("translation_unit_translated_text")
            or item.get("translation_unit_protected_translated_text")
            or ""
        ),
    }


def _plan_item(
    *,
    item_id: str,
    item: dict | None,
    location: dict[str, object],
    issues: list[TranslationQualityIssue],
    repairable: list[TranslationQualityIssue],
    task_metadata: dict[str, object] | None,
) -> dict[str, object]:
    current_translation = ""
    source_text = ""
    final_status = ""
    if item:
        current_translation = _translated_result_from_item(item)["translated_text"]
        source_text = str(
            item.get("translation_unit_protected_source_text")
            or item.get("translation_unit_source_text")
            or item.get("protected_source_text")
            or item.get("source_text")
            or ""
        )
        final_status = str(item.get("final_status", "") or "")
    skip_reason = ""
    if item is None:
        skip_reason = "translated_item_not_found"
    elif not repairable:
        skip_reason = "no_repairable_issues"
    return {
        "item_id": item_id,
        "page_idx": location.get("page_idx"),
        "page_number": location.get("page_number"),
        "block_idx": location.get("block_idx"),
        "payload_path": location.get("payload_path", ""),
        "source_preview": _preview_text(source_text),
        "current_translation_preview": _preview_text(current_translation),
        "final_status": final_status,
        "issue_kinds": [issue.kind for issue in issues],
        "issues": [issue.as_dict() for issue in issues],
        "repairable": bool(item is not None and repairable),
        "repairable_issue_kinds": [issue.kind for issue in repairable],
        "skip_reason": skip_reason,
        "task_metadata": task_metadata or {},
    }


def build_translation_repair_plan(inputs: TranslationRepairInputs) -> dict[str, object]:
    agent = RepairAgent(glossary_entries=list(inputs.spec.params.glossary_entries or []))
    grouped_issues = _issues_by_item(inputs.review)
    plan_items: list[dict[str, object]] = []
    repairable_count = 0
    for item_id, issues in sorted(grouped_issues.items()):
        item = inputs.items_by_id.get(item_id)
        location = dict(inputs.item_locations.get(item_id) or {})
        if not location:
            issue_payload = next((raw for raw in inputs.review.get("issues") or [] if str(raw.get("item_id", "") or "") == item_id), {})
            location = {
                "page_idx": issue_payload.get("page_idx"),
                "page_number": issue_payload.get("page_number"),
                "block_idx": issue_payload.get("block_idx"),
                "payload_path": "",
            }
        repairable = agent.repairable_issues(issues) if item is not None else []
        task_metadata: dict[str, object] | None = None
        if item is not None and repairable:
            task = agent.build_task(
                TranslationRepairRequest(
                    item=item,
                    translated_result=_translated_result_from_item(item),
                    issues=issues,
                    glossary_entries=list(inputs.spec.params.glossary_entries or []),
                ),
                model=inputs.spec.params.model,
                base_url=inputs.spec.params.base_url,
            )
            task_metadata = dict(task.metadata)
            repairable_count += 1
        plan_items.append(
            _plan_item(
                item_id=item_id,
                item=item,
                location=location,
                issues=issues,
                repairable=repairable,
                task_metadata=task_metadata,
            )
        )

    return {
        "schema": TRANSLATION_REPAIR_PLAN_SCHEMA,
        "schema_version": 1,
        "job_id": str(inputs.spec.job.job_id or inputs.job_root.name),
        "job_root": str(inputs.job_root),
        "review_issue_count": int(inputs.review.get("issue_count", len(inputs.review.get("issues") or [])) or 0),
        "plan_item_count": len(plan_items),
        "repairable_item_count": repairable_count,
        "items": plan_items,
    }


def _job_db_path() -> Path:
    return REPO_SCRIPTS_ROOT.parents[1] / "data" / "db" / "jobs.db"


def _load_translation_api_key_from_job_db(job_id: str) -> str:
    db_path = _job_db_path()
    if not db_path.exists():
        return ""
    with sqlite3.connect(str(db_path)) as conn:
        row = conn.execute(
            "SELECT request_json FROM jobs WHERE job_id = ?1 ORDER BY updated_at DESC LIMIT 1",
            (job_id,),
        ).fetchone()
    if not row or not row[0]:
        return ""
    try:
        payload = json.loads(str(row[0]))
    except Exception:
        return ""
    return str((((payload or {}).get("translation") or {}).get("api_key") or "")).strip()


def _resolve_api_key(credential_ref: str, *, job_id: str = "") -> str:
    raw_ref = str(credential_ref or "").strip()
    if raw_ref:
        try:
            return resolve_credential_ref(raw_ref)
        except Exception:
            if raw_ref.startswith("env:"):
                env_name = raw_ref.split(":", 1)[1].strip()
                if env_name == "RETAIN_TRANSLATION_API_KEY" and job_id:
                    recovered_key = _load_translation_api_key_from_job_db(job_id)
                    if recovered_key:
                        os.environ[env_name] = recovered_key
                        return recovered_key
            raise
    fallback_key = str(os.environ.get("RETAIN_TRANSLATION_API_KEY", "") or "").strip()
    if fallback_key:
        return fallback_key
    return ""


def build_translation_repair_preview(
    inputs: TranslationRepairInputs,
    plan: dict[str, object],
    *,
    request_chat_content_fn: RequestChatContentFn = request_chat_content,
    max_items: int | None = None,
) -> dict[str, object]:
    agent = RepairAgent(glossary_entries=list(inputs.spec.params.glossary_entries or []))
    api_key = _resolve_api_key(
        str(inputs.spec.params.credential_ref or ""),
        job_id=str(inputs.spec.job.job_id or inputs.job_root.name),
    )
    preview_items: list[dict[str, object]] = []
    executed = 0
    for plan_item in plan.get("items") or []:
        if not isinstance(plan_item, dict) or not plan_item.get("repairable"):
            continue
        if max_items is not None and executed >= max_items:
            break
        item_id = str(plan_item.get("item_id", "") or "")
        item = inputs.items_by_id.get(item_id)
        issues = _issues_by_item(inputs.review).get(item_id, [])
        if item is None:
            continue
        result_payload: dict[str, object] | None = None
        error_payload: dict[str, str] | None = None
        try:
            result = agent.repair_with_llm(
                TranslationRepairRequest(
                    item=item,
                    translated_result=_translated_result_from_item(item),
                    issues=issues,
                    glossary_entries=list(inputs.spec.params.glossary_entries or []),
                ),
                request_chat_content_fn=request_chat_content_fn,
                api_key=api_key,
                model=inputs.spec.params.model,
                base_url=inputs.spec.params.base_url,
            )
            result_payload = result.as_dict()
        except Exception as exc:  # noqa: BLE001
            error_payload = {"type": type(exc).__name__, "message": str(exc)}
        preview_items.append(
            {
                **plan_item,
                "repair_result": result_payload,
                "repair_error": error_payload,
            }
        )
        executed += 1
    return {
        "schema": TRANSLATION_REPAIR_PREVIEW_SCHEMA,
        "schema_version": 1,
        "job_id": str(inputs.spec.job.job_id or inputs.job_root.name),
        "job_root": str(inputs.job_root),
        "preview_item_count": len(preview_items),
        "items": preview_items,
    }


def write_translation_repair_plan(job_root: Path) -> dict[str, object]:
    inputs = load_translation_repair_inputs(job_root)
    plan = build_translation_repair_plan(inputs)
    save_json(inputs.job_root / "artifacts" / TRANSLATION_REPAIR_PLAN_FILE_NAME, plan)
    return plan


def write_translation_repair_preview(
    job_root: Path,
    *,
    max_items: int | None = None,
    request_chat_content_fn: RequestChatContentFn = request_chat_content,
) -> dict[str, object]:
    inputs = load_translation_repair_inputs(job_root)
    plan = build_translation_repair_plan(inputs)
    save_json(inputs.job_root / "artifacts" / TRANSLATION_REPAIR_PLAN_FILE_NAME, plan)
    preview = build_translation_repair_preview(
        inputs,
        plan,
        request_chat_content_fn=request_chat_content_fn,
        max_items=max_items,
    )
    save_json(inputs.job_root / "artifacts" / TRANSLATION_REPAIR_PREVIEW_FILE_NAME, preview)
    return preview


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build an offline translation repair plan from translation_review.json. "
            "Default mode never mutates translated page artifacts."
        )
    )
    parser.add_argument(
        "--job-root",
        type=str,
        required=True,
        help="Absolute job root path or job id under data/jobs.",
    )
    parser.add_argument(
        "--execute-preview",
        action="store_true",
        help="Call the configured LLM and write translation_repair_preview.json. Does not mutate translations.",
    )
    parser.add_argument(
        "--max-items",
        type=int,
        default=None,
        help="Maximum repairable items to execute in preview mode.",
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    with contextlib.redirect_stdout(sys.stderr):
        job_root = _job_root_from_arg(args.job_root)
        if args.execute_preview:
            payload = write_translation_repair_preview(job_root, max_items=args.max_items)
        else:
            payload = write_translation_repair_plan(job_root)
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2 if args.pretty else None)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
