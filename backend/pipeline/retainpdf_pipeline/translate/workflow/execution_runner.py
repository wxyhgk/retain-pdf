from __future__ import annotations

from typing import TYPE_CHECKING
from retainpdf_pipeline.translate.llm.shared.executor_context import raise_if_executor_failed

from retainpdf_pipeline.translate.artifacts import aggregate_payload_diagnostics
from retainpdf_pipeline.translate.artifacts import blocking_untranslated_items
from retainpdf_pipeline.translate.artifacts import translation_run_diagnostics_scope
from retainpdf_pipeline.translate.artifacts import get_active_translation_run_diagnostics
from retainpdf_pipeline.translate.services.agents.review_artifact import build_translation_review
from retainpdf_pipeline.translate.core.payload import write_translation_manifest
from retainpdf_pipeline.translate.services.terms import summarize_glossary_usage
from retainpdf_pipeline.translate.workflow.translation_workflow import default_page_translation_name
from retainpdf_pipeline.translate.workflow.checkpoint import TranslationCheckpointSession
from retainpdf_pipeline.translate.workflow.checkpoint import ResumeCandidateFingerprintMismatch
from retainpdf_pipeline.translate.workflow.checkpoint import discard_copied_resume_candidate
from retainpdf_pipeline.translate.workflow.checkpoint.store import CheckpointStore

def _record_committed_pages(pages):
    diagnostics = get_active_translation_run_diagnostics()
    if diagnostics is not None:
        diagnostics.record_committed_pages(pages)


if TYPE_CHECKING:
    from retainpdf_pipeline.translate.workflow.execution import TranslationExecutionRequest
    from retainpdf_pipeline.translate.workflow.execution_plan import TranslationExecutionPlan


def run_translation_execution_plan(
    request: TranslationExecutionRequest,
    plan: TranslationExecutionPlan,
    *,
    checkpoint_store: CheckpointStore | None = None,
) -> dict:
    # Import lazily to keep services.translation.workflow importable without pulling runtime.pipeline.
    from retainpdf_pipeline.translate.workflow.book_flow import translate_book_with_global_continuations

    glossary_entries = plan.glossary_entries

    try:
        checkpoint_session = TranslationCheckpointSession.acquire(request, plan, store=checkpoint_store)
    except ResumeCandidateFingerprintMismatch as mismatch:
        discard_copied_resume_candidate(
            request.output_dir,
            source_attempt_id=mismatch.source_attempt_id,
            store=checkpoint_store,
        )
        print(
            "book: copied translation checkpoint fingerprint mismatch; starting a fresh attempt",
            flush=True,
        )
        checkpoint_session = TranslationCheckpointSession.acquire(request, plan, store=checkpoint_store)

    plan.run_diagnostics.set_checkpoint_metrics_provider(checkpoint_session.metrics)
    with checkpoint_session as checkpoint:
        checkpoint.on_pages_committed = _record_committed_pages
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
                checkpoint=checkpoint,
            )
        raise_if_executor_failed()
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
        review_summary = build_translation_review(
            translated_pages_map=translated_pages_map,
            translation_context=plan.translation_context,
        )
        blocking = blocking_untranslated_items(translated_pages_map)
        if blocking:
            preview = ", ".join(
                f"p{int(item['page_idx']) + 1}:{item['item_id']}:{item['reason']}"
                for item in blocking[:8]
            )
            raise RuntimeError(
                "translation export gate blocked: "
                f"unresolved_translation_count={len(blocking)} preview={preview}"
            )
        manifest_path = write_translation_manifest(
            request.output_dir,
            {
                page_idx: request.output_dir / default_page_translation_name(page_idx)
                for page_idx in translated_pages_map
            },
            glossary=glossary_summary,
            summary={
                "math_mode": request.math_mode,
                **diagnostics_summary,
                "review_issue_count": review_summary.get("issue_count", 0),
                "review_has_errors": review_summary.get("has_errors", False),
                **({"invocation": request.invocation} if request.invocation else {}),
            },
        )
        checkpoint.complete(manifest_path)
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
        "translation_review": review_summary,
        "invocation": request.invocation or {},
        "math_mode": request.math_mode,
        "translation_context": plan.translation_context,
        "translation_run_diagnostics": plan.run_diagnostics,
    }
