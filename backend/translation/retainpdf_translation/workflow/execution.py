from __future__ import annotations

from dataclasses import dataclass
from dataclasses import replace
from pathlib import Path
import sys
from typing import Any

from retainpdf_translation.llm.shared.control_context import normalize_preparation_mode
from retainpdf_translation.llm.shared.provider_runtime import DEFAULT_BASE_URL
from retainpdf_translation.llm.shared.provider_runtime import DEFAULT_MODEL
from retainpdf_translation.llm.shared.provider_runtime import normalize_base_url
from retainpdf_translation.services.terms import GlossaryEntry
from retainpdf_translation.workflow.execution_plan import build_translation_execution_plan
from retainpdf_translation.workflow.execution_runner import run_translation_execution_plan
from retainpdf_translation.workflow.execution_plan import TranslationExecutionPlan
from retainpdf_translation.workflow.checkpoint.store import CheckpointStore
from retainpdf_translation.workflow.checkpoint.contract import translation_checkpoint_path


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
    # 翻译引擎：legacy（现有流程）/ agent（retainpdf-translation-agent，见 workflow/agent_flow.py）
    engine: str = "legacy"
    # OCR 流式公布的目录（任务的 ocr/，见 retainpdf_base.ocr_stream）。给了就跟着 OCR 翻（workflow/streaming_flow.py），
    # 不用等 OCR 做完；source_json_path 是 OCR 最后写的整份文档，这时可能还不存在。
    ocr_stream_dir: Path | None = None


TRANSLATION_ENGINES = ("legacy", "agent")


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


def _wait_for_whole_document_if_needed(request: TranslationExecutionRequest) -> TranslationExecutionRequest:
    """跟着 OCR 翻只支持 legacy、不做译前准备：agent 要先通读全书，译前准备要扫全书的术语。这两种等 OCR 做完，按整本翻。"""
    if request.ocr_stream_dir is None:
        return request
    if request.engine == "legacy" and normalize_preparation_mode(request.preparation) == "off":
        return request
    from retainpdf_base.ocr_stream import wait_for_ocr_stream

    print(f"book: engine={request.engine} preparation={request.preparation} needs the whole document; waiting for OCR", flush=True)
    state = wait_for_ocr_stream(request.ocr_stream_dir)
    while not state.done:
        state = wait_for_ocr_stream(request.ocr_stream_dir, after_seq=state.seq)
    return replace(request, source_json_path=state.document_path, ocr_stream_dir=None)


def execute_translation_request(request: TranslationExecutionRequest) -> dict:
    from retainpdf_translation.llm.shared.executor_context import raise_if_executor_failed
    raise_if_executor_failed()
    if request.engine not in TRANSLATION_ENGINES:
        raise ValueError(f"unknown translation engine {request.engine!r} (expected one of {', '.join(TRANSLATION_ENGINES)})")
    if request.engine == "agent":
        # agent 收的原文是 "$…$" 直写公式，不认占位符；它自带通读（体裁、术语、人名、标题），
        # 译前准备（术语预扫、术语审定）的结果用不上，跑了只是白花钱
        request = replace(request, math_mode="direct_typst", preparation="off")
    request = _wait_for_whole_document_if_needed(request)
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
