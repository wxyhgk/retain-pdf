from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

from retainpdf_translation.core.engine_identity import translation_engine_identity

if TYPE_CHECKING:
    from retainpdf_translation.workflow.execution import TranslationExecutionRequest
    from retainpdf_translation.workflow.execution_plan import TranslationExecutionPlan


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


def build_document_identity(
    *,
    normalized_document_path: Path,
    parameters_sha256: str,
) -> dict[str, str]:
    """Bind normalized document bytes to an existing translation parameter identity."""
    payload = {
        "normalized_document_sha256": _sha256_file(normalized_document_path),
        "parameters_sha256": parameters_sha256,
    }
    return {**payload, "fingerprint": _sha256_json(payload)}


def resumes_streamed_attempt(previous: dict, identity: dict, source_pdf_path: str | Path | None) -> bool:
    """跟着 OCR 翻的那次留下的检查点，能不能让这次不跟着 OCR 的接着用。

    跟着 OCR 翻时指纹按原文 PDF 算（归一化文档每来一批页都在变），OCR 做完以后再翻（重试翻译）指纹按规范化文档算，
    两种指纹永远对不上：以前跟着 OCR 翻了 6.86 万条的书一重试就从头翻（2026-11-03，任务 20261103044311-4bdc13）。
    翻译参数一样、原文 PDF 是同一份就接得上；页里每一条照旧按条目指纹核对（`_replay_durable_checkpoint`），
    原文变了的页不会沿用。
    """
    streamed_pdf_sha256 = str(previous.get("ocr_stream_source_pdf_sha256") or "")
    if not streamed_pdf_sha256 or "ocr_stream_source_pdf_sha256" in identity:
        return False
    if not previous.get("parameters_sha256") or previous.get("parameters_sha256") != identity.get("parameters_sha256"):
        return False
    if source_pdf_path is None:
        return False
    path = Path(source_pdf_path)
    return path.is_file() and _sha256_file(path) == streamed_pdf_sha256


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
        "translate_tables": bool(request.translate_tables),
        "model": request.model,
        "base_url": request.base_url,
        "rule_profile_name": plan.policy_config.rule_profile_name,
        "custom_rules_text": plan.policy_config.custom_rules_text,
        "resolved_policy_sha256": _sha256_json(resolved_policy),
        "context_mode": request.context_mode,
        "glossary_mode": request.glossary_mode,
        "memory_mode": request.memory_mode,
        "translation_engine": _engine_identity(request),
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
    preparation = getattr(plan, "preparation", None)
    if preparation is not None:
        # 只有开了译前准备才加这个键：off 时参数集合与改动前逐字节相同，
        # 旧 checkpoint 照常续跑。冻结产物的哈希进指纹，产物换了就不能拿旧译文续跑。
        parameters["preparation"] = preparation.identity()
    if getattr(request, "ocr_stream_dir", None) is not None and request.source_pdf_path is not None:
        # 跟着 OCR 翻：归一化文档每来一批页都在变，按原文 PDF 认（OCR 断点续跑时同一份原文出同样的页，见 glm_ocr_driver）。
        payload = {
            "ocr_stream_source_pdf_sha256": _sha256_file(Path(request.source_pdf_path)),
            "parameters_sha256": _sha256_json(parameters),
        }
        return {**payload, "fingerprint": _sha256_json(payload)}
    return build_document_identity(
        normalized_document_path=request.source_json_path,
        parameters_sha256=_sha256_json(parameters),
    )


def _engine_identity(request) -> dict:
    """换引擎不能沿用另一个引擎的 checkpoint。legacy 的身份保持原样（不加键），正在跑的旧任务续跑不受影响。"""
    identity = translation_engine_identity(mode=request.mode)
    engine = getattr(request, "engine", "legacy") or "legacy"
    if engine != "legacy":
        from retainpdf_translation.core.engine_identity import agent_engine_identity

        identity = {**identity, "engine": engine, **agent_engine_identity()}
    return identity
