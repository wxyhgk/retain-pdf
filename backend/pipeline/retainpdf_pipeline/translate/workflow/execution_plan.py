from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from retainpdf_pipeline.translate.artifacts import TranslationRunDiagnostics
from retainpdf_pipeline.translate.artifacts import TRANSLATION_REQUEST_JOURNAL_FILE_NAME
from retainpdf_pipeline.translate.artifacts import TranslationRequestJournal
from retainpdf_pipeline.translate.artifacts import translation_run_diagnostics_scope
from retainpdf_pipeline.translate.artifacts import classify_provider_family
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.core.ocr.json_extractor import get_page_count
from retainpdf_pipeline.translate.core.ocr.json_extractor import load_ocr_json
from retainpdf_pipeline.translate.services.policy import TranslationPolicyConfig
from retainpdf_pipeline.translate.services.policy import build_book_translation_policy_config
from retainpdf_pipeline.translate.services.context.session_context import build_translation_context_from_policy
from retainpdf_pipeline.translate.services.terms import GlossaryEntry
from retainpdf_pipeline.translate.services.terms import normalize_glossary_entries
from retainpdf_pipeline.translate.workflow.scheduling.allocation import adaptive_floor_limit
from retainpdf_pipeline.translate.workflow.scheduling.allocation import prefix_cache_warmup_enabled
from retainpdf_pipeline.translate.workflow.scheduling.allocation import provider_adaptive_initial_limit
from retainpdf_pipeline.translate.workflow.page_range import resolve_page_range
from retainpdf_pipeline.translate.workflow.batching.plan import effective_translation_batch_size

if TYPE_CHECKING:
    from retainpdf_pipeline.translate.workflow.execution import TranslationExecutionRequest


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


def _build_translation_execution_plan(request, journals) -> TranslationExecutionPlan:
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

    translation_context = build_translation_context_from_policy(
        policy_config,
        glossary_entries=glossary_entries,
        model=request.model,
        base_url=request.base_url,
        context_mode=request.context_mode,
        glossary_mode=request.glossary_mode,
        memory_mode=request.memory_mode,
    )
    effective_workers = max(1, request.workers)
    initial_concurrency_limit = provider_adaptive_initial_limit(
        workers=effective_workers,
        provider_family=provider_family,
    )
    run_diagnostics.configure_adaptive_concurrency(
        initial_limit=initial_concurrency_limit,
        floor_limit=adaptive_floor_limit(effective_workers),
        warmup=prefix_cache_warmup_enabled(provider_family),
    )
    run_diagnostics.set_effective_settings(
        translation_workers=effective_workers,
        policy_workers=effective_workers,
        continuation_workers=min(effective_workers, 8),
        mixed_split_workers=min(effective_workers, 4),
        translation_batch_size=effective_translation_batch_size(
            batch_size=request.batch_size,
            model=request.model,
            base_url=request.base_url,
            translation_context=translation_context,
        ),
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
    )
