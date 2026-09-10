from __future__ import annotations

import hashlib
import json
from typing import TYPE_CHECKING, Any

from retainpdf_pipeline.translate.core.engine_identity import translation_engine_identity

if TYPE_CHECKING:
    from retainpdf_pipeline.translate.workflow.execution import TranslationExecutionRequest
    from retainpdf_pipeline.translate.workflow.execution_plan import TranslationExecutionPlan


def _sha256_file(path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _sha256_json(payload: object) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def build_translation_identity(
    request: TranslationExecutionRequest,
    plan: TranslationExecutionPlan,
) -> dict[str, Any]:
    resolved_policy = dict(vars(plan.policy_config))
    parameters = {
        "start_page": plan.start,
        "end_page": plan.stop,
        "mode": request.mode,
        "math_mode": request.math_mode,
        "batch_size": max(1, request.batch_size),
        "classify_batch_size": max(1, request.classify_batch_size),
        "skip_title_translation": bool(request.skip_title_translation),
        "model": request.model,
        "base_url": request.base_url,
        "rule_profile_name": plan.policy_config.rule_profile_name,
        "custom_rules_text": plan.policy_config.custom_rules_text,
        "resolved_policy_sha256": _sha256_json(resolved_policy),
        "context_mode": request.context_mode,
        "glossary_mode": request.glossary_mode,
        "memory_mode": request.memory_mode,
        "translation_engine": translation_engine_identity(mode=request.mode),
        "glossary": [
            {
                "source": entry.source,
                "target": entry.target,
                "level": entry.level,
                "match_mode": entry.match_mode,
                "context": entry.context,
                "note": entry.note,
            }
            for entry in plan.glossary_entries
        ],
    }
    fingerprint_payload = {
        "normalized_document_sha256": _sha256_file(request.source_json_path),
        "parameters_sha256": _sha256_json(parameters),
    }
    return {
        **fingerprint_payload,
        "fingerprint": _sha256_json(fingerprint_payload),
    }
