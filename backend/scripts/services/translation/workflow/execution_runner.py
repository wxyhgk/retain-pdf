from __future__ import annotations

from typing import TYPE_CHECKING

from services.translation.diagnostics import aggregate_payload_diagnostics
from services.translation.diagnostics import translation_run_diagnostics_scope
from services.translation.payload import write_translation_manifest
from services.translation.terms import summarize_glossary_usage
from services.translation.workflow.translation_workflow import default_page_translation_name

if TYPE_CHECKING:
    from services.translation.workflow.execution import TranslationExecutionRequest
    from services.translation.workflow.execution_plan import TranslationExecutionPlan


def run_translation_execution_plan(
    request: TranslationExecutionRequest,
    plan: TranslationExecutionPlan,
) -> dict:
    # Import lazily to keep services.translation.workflow importable without pulling runtime.pipeline.
    from runtime.pipeline.book_translation_flow import translate_book_with_global_continuations

    glossary_entries = request.glossary_entries or []
    with translation_run_diagnostics_scope(plan.run_diagnostics):
        translated_pages_map, summaries = translate_book_with_global_continuations(
            data=plan.data,
            output_dir=request.output_dir,
            page_indices=plan.page_indices,
            api_key=request.api_key,
            batch_size=request.batch_size,
            workers=max(1, request.workers),
            model=request.model,
            base_url=request.base_url,
            mode=request.mode,
            classify_batch_size=max(1, request.classify_batch_size),
            skip_title_translation=request.skip_title_translation,
            sci_cutoff_page_idx=plan.policy_config.sci_cutoff_page_idx,
            sci_cutoff_block_idx=plan.policy_config.sci_cutoff_block_idx,
            policy_config=plan.policy_config,
            domain_guidance=plan.policy_config.domain_guidance,
            translation_context=plan.translation_context,
            run_diagnostics=plan.run_diagnostics,
        )
    total_items = sum(item["total_items"] for item in summaries)
    translated_items = sum(item["translated_items"] for item in summaries)
    glossary_summary = summarize_glossary_usage(
        entries=glossary_entries,
        translated_pages_map=translated_pages_map,
        glossary_id=request.glossary_id,
        glossary_name=request.glossary_name,
        resource_entry_count=request.glossary_resource_entry_count,
        inline_entry_count=request.glossary_inline_entry_count,
        overridden_entry_count=request.glossary_overridden_entry_count,
    )
    _, diagnostics_summary = aggregate_payload_diagnostics(translated_pages_map)
    write_translation_manifest(
        request.output_dir,
        {
            page_idx: request.output_dir / default_page_translation_name(page_idx)
            for page_idx in translated_pages_map
        },
        glossary=glossary_summary,
        summary={
            "math_mode": request.math_mode,
            **diagnostics_summary,
            **({"invocation": request.invocation} if request.invocation else {}),
        },
    )
    return {
        "output_dir": request.output_dir,
        "start_page": plan.start,
        "end_page": plan.stop,
        "page_count": len(summaries),
        "total_items": total_items,
        "translated_items": translated_items,
        "translated_pages_map": translated_pages_map,
        "summaries": summaries,
        "domain_context": plan.policy_config.domain_context,
        "rule_profile_name": plan.policy_config.rule_profile_name,
        "custom_rules_text": plan.policy_config.custom_rules_text,
        "glossary": glossary_summary,
        "diagnostics_summary": diagnostics_summary,
        "invocation": request.invocation or {},
        "math_mode": request.math_mode,
        "translation_context": plan.translation_context,
        "translation_run_diagnostics": plan.run_diagnostics,
    }
