from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sys
from typing import Any

from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_BASE_URL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_MODEL
from retainpdf_pipeline.translate.services.terms import GlossaryEntry
from retainpdf_pipeline.translate.workflow.execution_plan import build_translation_execution_plan
from retainpdf_pipeline.translate.workflow.execution_runner import run_translation_execution_plan
from retainpdf_pipeline.translate.workflow.execution_plan import TranslationExecutionPlan
from retainpdf_pipeline.translate.workflow.checkpoint.store import CheckpointStore
from retainpdf_pipeline.translate.workflow.checkpoint.contract import translation_checkpoint_path


@dataclass(frozen=True)
class TranslationExecutionRequest:
    source_json_path: Path
    output_dir: Path
    api_key: str
    start_page: int = 0
    end_page: int = -1
    batch_size: int = 8
    workers: int = 1
    mode: str = "fast"
    math_mode: str = "direct_typst"
    classify_batch_size: int = 12
    skip_title_translation: bool = False
    model: str = DEFAULT_MODEL
    base_url: str = DEFAULT_BASE_URL
    source_pdf_path: Path | None = None
    rule_profile_name: str = "general_sci"
    custom_rules_text: str = ""
    glossary_id: str = ""
    glossary_name: str = ""
    glossary_resource_entry_count: int = 0
    glossary_inline_entry_count: int = 0
    glossary_overridden_entry_count: int = 0
    glossary_entries: list[GlossaryEntry] | None = None
    context_mode: str = "needed"
    glossary_mode: str = "matched"
    memory_mode: str = "matched"
    invocation: dict[str, Any] | None = None


def execute_translation_request(request: TranslationExecutionRequest) -> dict:
    from retainpdf_pipeline.translate.llm.shared.executor_context import raise_if_executor_failed
    raise_if_executor_failed()
    # Own output before opening its journal or performing domain inference.
    store = CheckpointStore(translation_checkpoint_path(request.output_dir))
    store.acquire()
    plan = None
    try:
        plan = build_translation_execution_plan(request)
        raise_if_executor_failed()
        return run_translation_execution_plan(request, plan, checkpoint_store=store)
    finally:
        active_error = sys.exc_info()[0] is not None
        try:
            if plan is not None and plan.run_diagnostics.request_journal is not None:
                try:
                    plan.run_diagnostics.request_journal.close()
                except Exception:
                    if not active_error:
                        raise
        finally:
            cleanup_error = sys.exc_info()[0] is not None
            try:
                store.close()
            except Exception:
                if not cleanup_error:
                    raise
