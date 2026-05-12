from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from runtime.pipeline.render_mode import resolve_page_range
from services.translation.diagnostics import TranslationRunDiagnostics
from services.translation.diagnostics import classify_provider_family
from services.translation.llm.shared.control_context import TranslationControlContext
from services.translation.ocr.json_extractor import get_page_count
from services.translation.ocr.json_extractor import load_ocr_json
from services.translation.policy import TranslationPolicyConfig
from services.translation.policy import build_book_translation_policy_config
from services.translation.session_context import build_translation_context_from_policy

if TYPE_CHECKING:
    from services.translation.workflow.execution import TranslationExecutionRequest


@dataclass(frozen=True)
class TranslationExecutionPlan:
    data: dict
    start: int
    stop: int
    page_indices: range
    policy_config: TranslationPolicyConfig
    translation_context: TranslationControlContext
    run_diagnostics: TranslationRunDiagnostics


def build_translation_execution_plan(request: TranslationExecutionRequest) -> TranslationExecutionPlan:
    data = load_ocr_json(request.source_json_path)
    page_count = get_page_count(data)
    if not page_count:
        raise RuntimeError("No pages found in OCR JSON.")

    start, stop = resolve_page_range(page_count, request.start_page, request.end_page)
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

    translation_context = build_translation_context_from_policy(
        policy_config,
        glossary_entries=request.glossary_entries or [],
        model=request.model,
        base_url=request.base_url,
    )
    run_diagnostics = TranslationRunDiagnostics(
        provider_family=classify_provider_family(base_url=request.base_url, model=request.model),
        model=request.model,
        base_url=request.base_url,
        configured_workers=max(1, request.workers),
        configured_batch_size=max(1, request.batch_size),
        configured_classify_batch_size=max(1, request.classify_batch_size),
    )
    run_diagnostics.set_effective_settings(
        translation_workers=max(1, request.workers),
        policy_workers=max(1, request.workers),
        continuation_workers=min(max(1, request.workers), 8),
        mixed_split_workers=min(max(1, request.workers), 4),
        translation_batch_size=max(
            1,
            min(max(1, request.batch_size), translation_context.batch_policy.plain_batch_size),
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
    )
