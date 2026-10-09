"""译前准备的总入口：按 translation.preparation 的档位生成 / 复用产物，并给出要注入的内容。

档位（权威集合见 llm/shared/control_context.py::_normalize_preparation_mode）：

    off             什么都不做（调用方根本不会进到这里）
    artifacts_only  生成并冻结 term-base.v1.json 与 style-guide.v1.json，不注入
    terms           生成并冻结 term-base.v1.json，按块命中注入抽取术语
    terms+style     两份产物都生成，术语按块注入，风格指南进 system 前缀

冻结：产物里记着 inputs_fingerprint。下次运行（续跑、重试）时指纹一致且 complete
的产物原样复用，不再调用模型；指纹变了（换模型、换术语表、换文档）才重新生成。
"""
from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
import hashlib
import json
from pathlib import Path
from typing import Any
from typing import Callable

from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress
from retainpdf_pipeline.translate.core.terms import GlossaryEntry
from retainpdf_pipeline.translate.core.terms import normalize_glossary_entries
from retainpdf_pipeline.translate.llm.shared.provider_runtime import normalize_base_url
from retainpdf_pipeline.translate.services.preparation.segments import PRESCAN_BATCH_MAX_SEGMENTS
from retainpdf_pipeline.translate.services.preparation.segments import PRESCAN_BATCH_MAX_TOKENS
from retainpdf_pipeline.translate.services.preparation.segments import SEGMENTATION_VERSION
from retainpdf_pipeline.translate.services.preparation.segments import build_prescan_batches
from retainpdf_pipeline.translate.services.preparation.segments import collect_prescan_segments
from retainpdf_pipeline.translate.services.preparation.style_guide import STYLE_GUIDE_FILE_NAME
from retainpdf_pipeline.translate.services.preparation.style_guide import STYLE_GUIDE_KEY_TERMS_LIMIT
from retainpdf_pipeline.translate.services.preparation.style_guide import STYLE_GUIDE_PROMPT_VERSION
from retainpdf_pipeline.translate.services.preparation.style_guide import STYLE_GUIDE_SAMPLE_MAX_CHARS
from retainpdf_pipeline.translate.services.preparation.style_guide import STYLE_GUIDE_SCHEMA
from retainpdf_pipeline.translate.services.preparation.style_guide import STYLE_GUIDE_SCHEMA_VERSION
from retainpdf_pipeline.translate.services.preparation.style_guide import baseline_rules_for
from retainpdf_pipeline.translate.services.preparation.style_guide import build_style_guide_messages
from retainpdf_pipeline.translate.services.preparation.style_guide import build_style_guide_payload
from retainpdf_pipeline.translate.services.preparation.style_guide import render_style_guidance
from retainpdf_pipeline.translate.services.preparation.style_guide import request_document_style
from retainpdf_pipeline.translate.services.preparation.style_guide import style_guide_request_sha256
from retainpdf_pipeline.translate.services.preparation.term_base import TERM_BASE_FILE_NAME
from retainpdf_pipeline.translate.services.preparation.term_base import build_term_base_payload
from retainpdf_pipeline.translate.services.preparation.term_base import build_term_base_terms
from retainpdf_pipeline.translate.services.preparation.term_base import file_sha256
from retainpdf_pipeline.translate.services.preparation.term_base import load_json_object
from retainpdf_pipeline.translate.services.preparation.term_base import load_term_base
from retainpdf_pipeline.translate.services.preparation.term_base import term_base_glossary_entries
from retainpdf_pipeline.translate.services.preparation.term_base import write_json_atomic
from retainpdf_pipeline.translate.services.preparation.term_prescan import PRESCAN_PROMPT_VERSION
from retainpdf_pipeline.translate.services.preparation.term_prescan import PrescanBatchStore
from retainpdf_pipeline.translate.services.preparation.term_prescan import run_term_prescan
from retainpdf_pipeline.translate.services.preparation.term_review import INJECTED_TREATMENTS
from retainpdf_pipeline.translate.services.preparation.term_review import TERM_REVIEW_PROMPT_VERSION
from retainpdf_pipeline.translate.services.preparation.term_review import review_term_base
from retainpdf_pipeline.translate.services.preparation.term_review import term_treatment

# editorial：terms+style 之外，预扫之后由术语专员审定分类（见 term_review.py）。
PREPARATION_MODE_EDITORIAL = "editorial"
PREPARATION_MODES_WITH_TERMS = frozenset({"artifacts_only", "terms", "terms+style", PREPARATION_MODE_EDITORIAL})
PREPARATION_MODES_WITH_STYLE = frozenset({"artifacts_only", "terms+style", PREPARATION_MODE_EDITORIAL})
PREPARATION_MODES_INJECT_TERMS = frozenset({"terms", "terms+style", PREPARATION_MODE_EDITORIAL})
PREPARATION_MODES_INJECT_STYLE = frozenset({"terms+style", PREPARATION_MODE_EDITORIAL})
PREPARATION_MODES_REVIEW_TERMS = frozenset({PREPARATION_MODE_EDITORIAL})


@dataclass(frozen=True)
class TranslationPreparation:
    mode: str
    term_base_path: Path | None = None
    style_guide_path: Path | None = None
    term_base_sha256: str = ""
    style_guide_sha256: str = ""
    # 真正注入的内容。artifacts_only 下两者都是空的。
    term_base_entries: list[GlossaryEntry] = field(default_factory=list)
    style_guidance: str = ""

    def identity(self) -> dict[str, str]:
        """进入翻译输入指纹（checkpoint identity）的部分。"""
        return {
            "mode": self.mode,
            "term_base_sha256": self.term_base_sha256,
            "style_guide_sha256": self.style_guide_sha256,
        }


BatchStoreFactory = Callable[[str], PrescanBatchStore]


def _sha256_json(payload: Any) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _glossary_identity(entries: list[GlossaryEntry]) -> list[dict[str, Any]]:
    return [
        {
            "source": entry.source,
            "target": entry.target,
            "level": entry.level,
            "match_mode": entry.match_mode,
            "context": entry.context,
        }
        for entry in entries
    ]


def _reusable(payload: dict[str, Any] | None, fingerprint: str) -> bool:
    return bool(payload) and payload.get("inputs_fingerprint") == fingerprint and payload.get("complete") is True


def _emit(message: str, *, phase: str) -> None:
    emit_stage_progress(
        stage="translation_prepare",
        substage="translation_prepare",
        message=message,
        progress_current=1,
        progress_total=1,
        payload={"user_stage": "translation", "progress_unit": "step", "preparation_phase": phase},
    )


def prepare_translation(
    *,
    mode: str,
    data: dict,
    page_indices,
    output_dir: Path,
    source_json_path: Path,
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
    domain_context: dict[str, Any],
    rule_profile_name: str,
    rule_guidance: str,
    custom_rules_text: str,
    user_glossary_entries: list[GlossaryEntry] | None,
    batch_store_factory: BatchStoreFactory,
    target_lang: str = "zh-CN",
    target_language_name: str = "简体中文",
    request_fn: Callable[..., str] | None = None,
) -> TranslationPreparation:
    output_dir = Path(output_dir)
    user_entries = normalize_glossary_entries(user_glossary_entries)
    segments = collect_prescan_segments(data, page_indices)
    page_list = list(page_indices)
    domain_label = str(domain_context.get("domain", "") or "").strip()
    document_sha256 = file_sha256(Path(source_json_path))

    term_base_path = output_dir / TERM_BASE_FILE_NAME
    term_base_payload: dict[str, Any] | None = None
    if mode in PREPARATION_MODES_WITH_TERMS:
        fingerprint_inputs: dict[str, Any] = {
            "schema": "term_base_v1",
            "segmentation_version": SEGMENTATION_VERSION,
            "prompt_version": PRESCAN_PROMPT_VERSION,
            "batch_max_tokens": PRESCAN_BATCH_MAX_TOKENS,
            "batch_max_segments": PRESCAN_BATCH_MAX_SEGMENTS,
            "model": model.strip(),
            "base_url": normalize_base_url(base_url),
            "normalized_document_sha256": document_sha256,
            "page_indices": page_list,
            "domain": domain_label,
            "target_lang": target_lang,
            "user_glossary": _glossary_identity(user_entries),
        }
        if mode in PREPARATION_MODES_REVIEW_TERMS:
            # 审定是术语表的一部分：开了审定的和没开的不能互相复用。只在开审定时加这一项，
            # 其它档位的指纹与以前逐字节相同（已冻结的术语表照常复用）。
            fingerprint_inputs["term_review"] = TERM_REVIEW_PROMPT_VERSION
        term_fingerprint = _sha256_json(fingerprint_inputs)
        existing = load_term_base(term_base_path)
        if _reusable(existing, term_fingerprint):
            print(f"term-base: frozen artifact reused terms={len(existing.get('terms', []))}", flush=True)
            term_base_payload = existing
        else:
            batches = build_prescan_batches(segments)
            results = run_term_prescan(
                batches,
                # 逐批 checkpoint 的文件头指纹故意比 term_fingerprint 窄：术语表、领域标签
                # 变了只影响命中它们的那几批（各批的 request_sha256 会变），其余批照样复用。
                store=batch_store_factory(
                    _sha256_json(
                        {
                            "segmentation_version": SEGMENTATION_VERSION,
                            "prompt_version": PRESCAN_PROMPT_VERSION,
                            "model": model.strip(),
                            "base_url": normalize_base_url(base_url),
                            "normalized_document_sha256": document_sha256,
                            "page_indices": page_list,
                        }
                    )
                ),
                api_key=api_key,
                model=model,
                base_url=base_url,
                workers=workers,
                target_lang=target_lang,
                target_language_name=target_language_name,
                domain=domain_label,
                user_entries=user_entries,
                request_fn=request_fn,
            )
            failed = [result.batch_id for result in results if not result.ok]
            terms = build_term_base_terms(batch_results=results, segments=segments, user_entries=user_entries)
            term_base_payload = build_term_base_payload(
                terms=terms,
                inputs_fingerprint=term_fingerprint,
                complete=not failed,
                preparation_mode=mode,
                extraction={
                    "model": model,
                    "prompt_version": PRESCAN_PROMPT_VERSION,
                    "segmentation_version": SEGMENTATION_VERSION,
                    "batch_max_tokens": PRESCAN_BATCH_MAX_TOKENS,
                    "batch_max_segments": PRESCAN_BATCH_MAX_SEGMENTS,
                    "batch_count": len(batches),
                    "reused_batch_count": sum(1 for result in results if result.reused),
                    "failed_batch_ids": failed,
                },
                source={
                    "normalized_document_sha256": document_sha256,
                    "page_indices": [page_list[0], page_list[-1]] if page_list else [],
                    "segment_count": len(segments),
                },
            )
            if mode in PREPARATION_MODES_REVIEW_TERMS:
                _emit("术语专员审定术语表", phase="term_review")
                review_term_base(
                    term_base_payload,
                    segments=segments,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    workers=workers,
                    domain=domain_label,
                    target_lang=target_lang,
                    target_language_name=target_language_name,
                    request_fn=request_fn,
                )
                review = term_base_payload["review"]
                print(
                    f"term-review: status={review['status']} by_treatment={review['by_treatment']} "
                    f"annotate={review['annotate_count']} unreviewed={review['unreviewed_count']}",
                    flush=True,
                )
                if review["status"] != "completed":
                    # 有批没审完：下次运行重新预扫 + 审定（和预扫失败一样不冻结）。
                    term_base_payload["complete"] = False
            write_json_atomic(term_base_path, term_base_payload)
            print(
                f"term-base: written terms={len(terms)} conflicts={term_base_payload['summary']['conflict_count']} "
                f"failed_batches={len(failed)}",
                flush=True,
            )
        _emit("译前术语库已就绪", phase="term_base")

    style_guide_path = output_dir / STYLE_GUIDE_FILE_NAME
    style_payload: dict[str, Any] | None = None
    if mode in PREPARATION_MODES_WITH_STYLE:
        key_terms = [
            {"source": str(item.get("source", "")), "target": str(item.get("target", ""))}
            for item in [
                term
                for term in (term_base_payload or {}).get("terms", [])
                if isinstance(term, dict) and term_treatment(term) in INJECTED_TREATMENTS
            ][:STYLE_GUIDE_KEY_TERMS_LIMIT]
        ]
        sample_parts: list[str] = []
        sample_chars = 0
        for segment in segments:
            if sample_chars >= STYLE_GUIDE_SAMPLE_MAX_CHARS:
                break
            sample_parts.append(segment.text)
            sample_chars += len(segment.text) + 1
        sample_text = "\n".join(sample_parts)[:STYLE_GUIDE_SAMPLE_MAX_CHARS]
        baseline_rules = baseline_rules_for(target_lang)
        messages = build_style_guide_messages(
            target_language_name=target_language_name,
            domain_context=domain_context,
            rule_profile_name=rule_profile_name,
            rule_guidance=rule_guidance,
            key_terms=key_terms,
            sample_text=sample_text,
            baseline_rules=baseline_rules,
        )
        digest = style_guide_request_sha256(messages, model=model)
        style_fingerprint = _sha256_json(
            {
                "schema": STYLE_GUIDE_SCHEMA,
                "schema_version": STYLE_GUIDE_SCHEMA_VERSION,
                "prompt_version": STYLE_GUIDE_PROMPT_VERSION,
                "base_url": normalize_base_url(base_url),
                "request_sha256": digest,
            }
        )
        existing_style = load_json_object(style_guide_path)
        if (
            existing_style is not None
            and existing_style.get("schema") == STYLE_GUIDE_SCHEMA
            and _reusable(existing_style, style_fingerprint)
        ):
            print("style-guide: frozen artifact reused", flush=True)
            style_payload = existing_style
        else:
            document_style = None
            llm_status = "ok"
            try:
                document_style = request_document_style(
                    messages,
                    digest=digest,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    request_fn=request_fn,
                )
            except Exception as exc:  # noqa: BLE001 - 失败只退回 baseline，不阻断翻译
                llm_status = "failed"
                print(f"style-guide: document rules skipped: {type(exc).__name__}: {exc}", flush=True)
            style_payload = build_style_guide_payload(
                inputs_fingerprint=style_fingerprint,
                target_lang=target_lang,
                target_language_name=target_language_name,
                domain_context=domain_context,
                rule_profile_name=rule_profile_name,
                custom_rules_text=custom_rules_text,
                baseline_rules=baseline_rules,
                document_style=document_style,
                llm_status=llm_status,
                model=model,
            )
            write_json_atomic(style_guide_path, style_payload)
            print(f"style-guide: written rules={len(style_payload['rules'])} llm_status={llm_status}", flush=True)
        _emit("译前风格指南已就绪", phase="style_guide")

    return TranslationPreparation(
        mode=mode,
        term_base_path=term_base_path if term_base_payload is not None else None,
        style_guide_path=style_guide_path if style_payload is not None else None,
        term_base_sha256=file_sha256(term_base_path) if term_base_payload is not None else "",
        style_guide_sha256=file_sha256(style_guide_path) if style_payload is not None else "",
        term_base_entries=(
            term_base_glossary_entries(term_base_payload) if mode in PREPARATION_MODES_INJECT_TERMS else []
        ),
        style_guidance=render_style_guidance(style_payload) if mode in PREPARATION_MODES_INJECT_STYLE else "",
    )


__all__ = [
    "BatchStoreFactory",
    "TranslationPreparation",
    "prepare_translation",
]
