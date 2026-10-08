from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sys
from typing import Any

from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_BASE_URL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_MODEL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import normalize_base_url
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
    # 译前准备档位（off / artifacts_only / terms / terms+style），默认 off 与改动前完全一致。
    preparation: str = "off"
    # 审校模型配置位：本期不调用，只透传。空值回退到翻译模型，见 resolve_reviewer_connection。
    reviewer_model: str = ""
    reviewer_base_url: str = ""
    reviewer_api_key: str = ""


@dataclass(frozen=True)
class ReviewerConnection:
    model: str
    base_url: str
    api_key: str
    # 三项是否全部来自翻译模型（即用户没配 reviewer）。
    inherited: bool


def resolve_reviewer_connection(request: TranslationExecutionRequest) -> ReviewerConnection:
    """审校模型连接：逐项回退到翻译模型。

    key 的回退有一条例外：reviewer_base_url 指向另一家端点、又没给 reviewer key 时，
    不把翻译 key 发过去——那等于把一家的 key 交给另一家。此时 api_key 留空，由调用方
    决定报错还是跳过。
    """
    model = request.reviewer_model.strip() or request.model
    reviewer_base_url = request.reviewer_base_url.strip()
    base_url = reviewer_base_url or request.base_url
    if request.reviewer_api_key.strip():
        api_key = request.reviewer_api_key.strip()
    elif not reviewer_base_url or normalize_base_url(reviewer_base_url) == normalize_base_url(request.base_url):
        api_key = request.api_key
    else:
        api_key = ""
    inherited = not (
        request.reviewer_model.strip() or reviewer_base_url or request.reviewer_api_key.strip()
    )
    return ReviewerConnection(model=model, base_url=base_url, api_key=api_key, inherited=inherited)


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
