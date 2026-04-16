from __future__ import annotations

import argparse
import copy
import contextlib
import json
import os
import sqlite3
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from foundation.shared.stage_specs import TranslateStageSpec
from foundation.shared.stage_specs import resolve_credential_ref
from services.translation.llm import translate_batch
from services.translation.payload import load_translation_manifest_file
from services.translation.payload import load_translations
from services.translation.policy import apply_translation_policies
from services.translation.policy import build_translation_policy_config
from services.translation.session_context import build_translation_context_from_policy


def _preview_text(text: str, *, limit: int = 220) -> str:
    compact = " ".join(str(text or "").split()).strip()
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "…"


def _job_root_from_arg(value: str) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = (REPO_SCRIPTS_ROOT.parents[1] / "data" / "jobs" / value).resolve()
    return path.resolve()


def _load_translate_spec(job_root: Path) -> TranslateStageSpec:
    spec_path = job_root / "specs" / "translate.spec.json"
    return TranslateStageSpec.load(spec_path)


def _load_manifest(job_root: Path) -> dict[int, Path]:
    manifest_path = job_root / "translated" / "translation-manifest.json"
    return load_translation_manifest_file(manifest_path, translations_dir=manifest_path.parent)


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


def _ensure_translation_credential_env(job_root: Path, spec: TranslateStageSpec) -> None:
    credential_ref = str(spec.params.credential_ref or "").strip()
    if not credential_ref.startswith("env:"):
        return
    env_name = credential_ref.split(":", 1)[1].strip()
    if not env_name or str(os.environ.get(env_name, "")).strip():
        return
    if env_name != "RETAIN_TRANSLATION_API_KEY":
        return
    recovered_key = _load_translation_api_key_from_job_db(spec.job.job_id or job_root.name)
    if recovered_key:
        os.environ[env_name] = recovered_key


def _find_item_payload(job_root: Path, item_id: str) -> tuple[int, Path, list[dict], dict]:
    manifest = _load_manifest(job_root)
    for page_idx, payload_path in sorted(manifest.items()):
        payload = load_translations(payload_path)
        for item in payload:
            if str(item.get("item_id", "") or "") == item_id:
                return page_idx, payload_path, payload, item
    raise RuntimeError(f"translation item not found: {item_id}")


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
    raise RuntimeError("missing translation API key")


def _policy_snapshot(item: dict) -> dict[str, object]:
    diagnostics = dict(item.get("translation_diagnostics") or {})
    return {
        "item_id": str(item.get("item_id", "") or ""),
        "page_idx": item.get("page_idx"),
        "block_idx": item.get("block_idx"),
        "classification_label": str(item.get("classification_label", "") or ""),
        "should_translate": bool(item.get("should_translate", True)),
        "skip_reason": str(item.get("skip_reason", "") or ""),
        "mixed_literal_action": str(item.get("mixed_literal_action", "") or ""),
        "mixed_literal_prefix": str(item.get("mixed_literal_prefix", "") or ""),
        "final_status": str(item.get("final_status", "") or ""),
        "route_path": [str(part or "").strip() for part in (diagnostics.get("route_path") or []) if str(part or "").strip()],
        "fallback_to": str(diagnostics.get("fallback_to", "") or ""),
        "degradation_reason": str(diagnostics.get("degradation_reason", "") or ""),
    }


def _run_replay(
    *,
    item_id: str,
    page_idx: int,
    page_path: str,
    payload: list[dict],
    saved_item: dict,
    mode: str,
    math_mode: str,
    skip_title_translation: bool,
    rule_profile_name: str,
    custom_rules_text: str,
    classify_batch_size: int,
    workers: int,
    model: str,
    base_url: str,
    glossary_entries: list[dict] | None,
    credential_ref: str,
    job_root_label: str,
    job_id: str,
) -> dict[str, object]:
    payload_copy = copy.deepcopy(payload)
    policy_config = build_translation_policy_config(
        mode=mode,
        math_mode=math_mode,
        skip_title_translation=skip_title_translation,
        rule_profile_name=rule_profile_name,
        custom_rules_text=custom_rules_text,
    )
    apply_translation_policies(
        payload=payload_copy,
        mode=mode,
        classify_batch_size=max(1, classify_batch_size),
        workers=max(1, workers),
        api_key="",
        model=model,
        base_url=base_url,
        skip_title_translation=skip_title_translation,
        page_idx=page_idx,
        sci_cutoff_page_idx=None,
        sci_cutoff_block_idx=None,
        policy_config=policy_config,
    )
    replay_item = next(
        item for item in payload_copy if str(item.get("item_id", "") or "") == item_id
    )

    policy_before = _policy_snapshot(saved_item)
    policy_after = _policy_snapshot(replay_item)
    context = build_translation_context_from_policy(
        policy_config,
        glossary_entries=glossary_entries,
        model=model,
        base_url=base_url,
    )

    result_payload: dict[str, object] | None = None
    replay_error: dict[str, str] | None = None
    if bool(replay_item.get("should_translate", True)):
        try:
            translated = translate_batch(
                [copy.deepcopy(replay_item)],
                api_key=_resolve_api_key(credential_ref, job_id=job_id),
                model=model,
                base_url=base_url,
                request_label=f"replay {item_id}",
                mode=mode,
                context=context,
            )
            result_payload = dict(translated.get(item_id, {}) or {})
        except Exception as exc:
            replay_error = {
                "type": type(exc).__name__,
                "message": str(exc),
            }

    return {
        "job_root": job_root_label,
        "job_id": job_id,
        "item_id": item_id,
        "page_idx": page_idx,
        "page_path": page_path,
        "source_preview": _preview_text(str(saved_item.get("source_text", "") or "")),
        "saved_item": copy.deepcopy(saved_item),
        "policy_before": policy_before,
        "policy_after": policy_after,
        "replay_result": result_payload,
        "replay_error": replay_error,
    }


def replay_translation_item(job_root: Path, item_id: str) -> dict[str, object]:
    job_root = Path(job_root).resolve()
    with contextlib.redirect_stdout(sys.stderr):
        spec = _load_translate_spec(job_root)
        _ensure_translation_credential_env(job_root, spec)
        page_idx, payload_path, payload, saved_item = _find_item_payload(job_root, item_id)
        return _run_replay(
            item_id=item_id,
            page_idx=page_idx,
            page_path=str(payload_path),
            payload=payload,
            saved_item=saved_item,
            mode=spec.params.mode,
            math_mode=spec.params.math_mode,
            skip_title_translation=spec.params.skip_title_translation,
            rule_profile_name=spec.params.rule_profile_name,
            custom_rules_text=spec.params.custom_rules_text,
            classify_batch_size=spec.params.classify_batch_size,
            workers=spec.params.workers,
            model=spec.params.model,
            base_url=spec.params.base_url,
            glossary_entries=list(spec.params.glossary_entries or []),
            credential_ref=str(spec.params.credential_ref or ""),
            job_root_label=str(job_root),
            job_id=str(spec.job.job_id or job_root.name),
        )


def replay_translation_case_artifact(case_artifact_path: Path, item_id: str | None = None) -> dict[str, object]:
    case_artifact_path = Path(case_artifact_path).resolve()
    with contextlib.redirect_stdout(sys.stderr):
        bundle = json.loads(case_artifact_path.read_text(encoding="utf-8"))
        replay_input = dict(bundle.get("replay_input") or {})
        if not replay_input:
            fixture = dict(bundle.get("fixture") or {})
            replay_saved = dict((bundle.get("replay") or {}).get("saved_item") or {})
            resolved_item_id = str(item_id or fixture.get("item_id") or replay_saved.get("item_id") or "").strip()
            return {
                "job_root": str(fixture.get("job_root") or ""),
                "job_id": str(fixture.get("job_root") or ""),
                "item_id": resolved_item_id,
                "page_idx": replay_input.get("page_idx"),
                "page_path": str(replay_input.get("page_path") or ""),
                "source_preview": _preview_text(str(replay_saved.get("source_text", "") or "")),
                "saved_item": replay_saved,
                "policy_before": dict((bundle.get("replay") or {}).get("policy_before") or {}),
                "policy_after": {},
                "replay_result": None,
                "replay_error": {
                    "type": "MissingReplayInput",
                    "message": f"case artifact missing replay_input: {case_artifact_path}",
                },
            }

        spec = dict(replay_input.get("spec") or {})
        payload = list(replay_input.get("page_payload") or [])
        resolved_item_id = str(item_id or replay_input.get("item_id") or "").strip()
        saved_item = next(
            item for item in payload if str(item.get("item_id", "") or "") == resolved_item_id
        )
        return _run_replay(
            item_id=resolved_item_id,
            page_idx=int(replay_input.get("page_idx") or saved_item.get("page_idx") or 0),
            page_path=str(replay_input.get("page_path") or case_artifact_path.name),
            payload=payload,
            saved_item=saved_item,
            mode=str(spec.get("mode") or "sci"),
            math_mode=str(spec.get("math_mode") or "direct_typst"),
            skip_title_translation=bool(spec.get("skip_title_translation", False)),
            rule_profile_name=str(spec.get("rule_profile_name") or ""),
            custom_rules_text=str(spec.get("custom_rules_text") or ""),
            classify_batch_size=int(spec.get("classify_batch_size") or 12),
            workers=int(spec.get("workers") or 1),
            model=str(spec.get("model") or "deepseek-chat"),
            base_url=str(spec.get("base_url") or "https://api.deepseek.com/v1"),
            glossary_entries=list(spec.get("glossary_entries") or []),
            credential_ref=str(spec.get("credential_ref") or ""),
            job_root_label=str(replay_input.get("job_root") or ""),
            job_id=str(replay_input.get("job_id") or replay_input.get("job_root") or ""),
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Replay a single translated item without mutating job artifacts.")
    parser.add_argument("--job-root", type=str, required=True, help="Absolute job root path or job id under data/jobs.")
    parser.add_argument("--item-id", type=str, required=True, help="Translation item id.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = replay_translation_item(_job_root_from_arg(args.job_root), args.item_id)
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2 if args.pretty else None)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
