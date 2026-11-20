from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from retainpdf_base.ocr_stream import OcrStreamState
from retainpdf_base.ocr_stream import wait_for_ocr_stream
from retainpdf_translation.artifacts import TranslationRunDiagnostics
from retainpdf_translation.artifacts import TRANSLATION_REQUEST_JOURNAL_FILE_NAME
from retainpdf_translation.artifacts import TranslationRequestJournal
from retainpdf_translation.artifacts import translation_run_diagnostics_scope
from retainpdf_translation.artifacts import classify_provider_family
from retainpdf_translation.llm.shared.control_context import TranslationControlContext
from retainpdf_translation.llm.shared.control_context import normalize_preparation_mode
from retainpdf_translation.core.ocr.json_extractor import get_page_count
from retainpdf_translation.core.ocr.json_extractor import load_ocr_json
from retainpdf_translation.services.policy import TranslationPolicyConfig
from retainpdf_translation.services.policy import build_book_translation_policy_config
from retainpdf_translation.services.context.session_context import build_translation_context_from_policy
from retainpdf_translation.services.terms import GlossaryEntry
from retainpdf_translation.services.terms import normalize_glossary_entries
from retainpdf_translation.workflow.scheduling.allocation import adaptive_floor_limit
from retainpdf_translation.llm.shared import model_wire
from retainpdf_translation.workflow.scheduling.allocation import prefix_cache_warmup_enabled
from retainpdf_translation.workflow.scheduling.allocation import provider_adaptive_initial_limit
from retainpdf_translation.workflow.page_range import resolve_page_range
from retainpdf_translation.workflow import engines
from typing import Any

if TYPE_CHECKING:
    from retainpdf_translation.workflow.execution import TranslationExecutionRequest


@dataclass(frozen=True)
class TranslationExecutionPlan:
    data: dict
    start: int
    stop: int
    page_indices: range
    policy_config: TranslationPolicyConfig
    translation_context: TranslationControlContext
    run_diagnostics: TranslationRunDiagnostics
    glossary_entries: list[GlossaryEntry]
    # translation.preparation=off 时为 None：不生成产物、不注入、不进输入指纹。
    # 普通翻译引擎的 services.preparation.TranslationPreparation；底座只读它的属性，不 import 引擎（2026-11-20 拆包）
    preparation: Any | None = None
    # 跟着 OCR 翻时建计划那会儿等到的那一版清单（data 是它的前缀文档）；整本翻时为 None。
    ocr_stream: OcrStreamState | None = None


def build_translation_execution_plan(request: TranslationExecutionRequest) -> TranslationExecutionPlan:
    journals = []
    try:
        return _build_translation_execution_plan(request, journals)
    except BaseException:
        for journal in journals:
            try:
                journal.close()
            except Exception:
                pass  # Preserve the plan-construction failure.
        raise


ANTHROPIC_CACHE_WARMUP_MAX_WAIT_S = 2.5


def _anthropic_prompt_cache_warmup(request) -> bool:
    """Anthropic 协议开了提示词缓存时，先只放 1 个请求、它回来再放开全并发：缓存条目要等第一个响应开始后才能用，
    开局 32 路同时发会全部没命中（``model_wire.anthropic_system_blocks``）。"""
    profile = model_wire.resolve_profile(base_url=request.base_url, model=request.model)
    return profile.protocol == model_wire.PROTOCOL_ANTHROPIC and model_wire.prompt_cache_enabled()


def _build_translation_execution_plan(request, journals) -> TranslationExecutionPlan:
    ocr_stream = None
    if getattr(request, "ocr_stream_dir", None) is not None:
        # 跟着 OCR 翻：等 OCR 公布第一批页。页数取清单里的全书页数，领域识别读原文 PDF 前两页（OCR 期间多半已经预热好）。
        ocr_stream = wait_for_ocr_stream(request.ocr_stream_dir)
        data = load_ocr_json(ocr_stream.document_path)
        page_count = ocr_stream.total_pages
        print(f"book: following OCR stream ready={ocr_stream.ready_pages}/{page_count}", flush=True)
    else:
        data = load_ocr_json(request.source_json_path)
        page_count = get_page_count(data)
    if not page_count:
        raise RuntimeError("No pages found in OCR JSON.")

    start, stop = resolve_page_range(page_count, request.start_page, request.end_page)
    provider_family = classify_provider_family(base_url=request.base_url, model=request.model)
    journal = TranslationRequestJournal(
        request.output_dir / TRANSLATION_REQUEST_JOURNAL_FILE_NAME,
        attempt_id=request.output_dir.parent.name,
    )
    journals.append(journal)
    run_diagnostics = TranslationRunDiagnostics(
        provider_family=provider_family,
        model=request.model,
        base_url=request.base_url,
        configured_workers=max(1, request.workers),
        configured_batch_size=max(1, request.batch_size),
        configured_classify_batch_size=max(1, request.classify_batch_size),
        request_journal=journal,
    )
    with translation_run_diagnostics_scope(run_diagnostics):
        policy_config = build_book_translation_policy_config(
            data=data,
            mode=request.mode,
            math_mode=request.math_mode,
            skip_title_translation=request.skip_title_translation,
            source_pdf_path=request.source_pdf_path,
            api_key=request.api_key,
            model=request.model,
            base_url=request.base_url,
            output_dir=request.output_dir,
            rule_profile_name=request.rule_profile_name,
            custom_rules_text=request.custom_rules_text,
        )
    if policy_config.domain_context.get("domain") or policy_config.domain_context.get("translation_guidance"):
        print(
            f"sci domain: {policy_config.domain_context.get('domain', '').strip() or 'unknown'}",
            flush=True,
        )
    print(f"rule profile: {policy_config.rule_profile_name}", flush=True)

    glossary_entries = normalize_glossary_entries(request.glossary_entries or [])

    preparation = _run_translation_preparation(
        request,
        data=data,
        page_indices=range(start, stop + 1),
        policy_config=policy_config,
        glossary_entries=glossary_entries,
        run_diagnostics=run_diagnostics,
    )
    translation_context = build_translation_context_from_policy(
        policy_config,
        glossary_entries=glossary_entries,
        model=request.model,
        base_url=request.base_url,
        context_mode=request.context_mode,
        glossary_mode=request.glossary_mode,
        memory_mode=request.memory_mode,
        style_guidance=preparation.style_guidance if preparation is not None else "",
        term_base_entries=preparation.term_base_entries if preparation is not None else None,
    )
    effective_workers = max(1, request.workers)
    initial_concurrency_limit = provider_adaptive_initial_limit(
        workers=effective_workers,
        provider_family=provider_family,
    )
    run_diagnostics.configure_adaptive_concurrency(
        initial_limit=initial_concurrency_limit,
        floor_limit=adaptive_floor_limit(effective_workers),
        warmup=prefix_cache_warmup_enabled(provider_family) or _anthropic_prompt_cache_warmup(request),
        warmup_max_wait_s=None if prefix_cache_warmup_enabled(provider_family) else ANTHROPIC_CACHE_WARMUP_MAX_WAIT_S,
    )
    run_diagnostics.set_effective_settings(
        translation_workers=effective_workers,
        policy_workers=effective_workers,
        continuation_workers=min(effective_workers, 8),
        mixed_split_workers=min(effective_workers, 4),
        translation_batch_size=_effective_batch_size(request, translation_context),
    )
    return TranslationExecutionPlan(
        data=data,
        start=start,
        stop=stop,
        page_indices=range(start, stop + 1),
        policy_config=policy_config,
        translation_context=translation_context,
        run_diagnostics=run_diagnostics,
        glossary_entries=glossary_entries,
        preparation=preparation,
        ocr_stream=ocr_stream,
    )


def _run_translation_preparation(
    request,
    *,
    data: dict,
    page_indices: range,
    policy_config: TranslationPolicyConfig,
    glossary_entries: list[GlossaryEntry],
    run_diagnostics: TranslationRunDiagnostics,
):
    """译前准备是普通翻译引擎的事（agent 引擎在 execution 里强制关掉）：按登记表调引擎的实现。"""
    mode = normalize_preparation_mode(getattr(request, "preparation", "off"))
    if mode == "off":
        return None
    ref = engines.engine_spec(getattr(request, "engine", "legacy")).run_preparation
    if not ref:
        raise ValueError(f"translation engine {request.engine!r} does not support translation.preparation={mode!r}")
    return engines.load(ref)(
        request,
        mode=mode,
        data=data,
        page_indices=page_indices,
        policy_config=policy_config,
        glossary_entries=glossary_entries,
        run_diagnostics=run_diagnostics,
    )


def _effective_batch_size(request, translation_context: TranslationControlContext) -> int:
    """写进运行诊断的实际批大小：引擎登了就按引擎算（普通翻译按模型、协议调整），没登的（agent）照请求里的。"""
    ref = engines.engine_spec(getattr(request, "engine", "legacy")).effective_batch_size
    if not ref:
        return max(1, int(request.batch_size or 1))
    return engines.load(ref)(
        batch_size=request.batch_size,
        model=request.model,
        base_url=request.base_url,
        translation_context=translation_context,
    )
