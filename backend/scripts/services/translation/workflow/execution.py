from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from services.translation.llm.shared.provider_runtime import DEFAULT_BASE_URL
from services.translation.llm.shared.provider_runtime import DEFAULT_MODEL
from services.translation.terms import GlossaryEntry
from services.translation.workflow.execution_plan import build_translation_execution_plan
from services.translation.workflow.execution_runner import run_translation_execution_plan
from services.translation.workflow.execution_plan import TranslationExecutionPlan


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
    invocation: dict[str, Any] | None = None
    render_prewarm_output_pdf_path: Path | None = None
    render_prewarm_artifacts_dir: Path | None = None
    render_prewarm_mode: str = "auto"
    render_prewarm_pdf_compress_dpi: int = 0
    render_prewarm_source_cleanup_strategy: str = "pikepdf_text_strip"


def execute_translation_request(request: TranslationExecutionRequest) -> dict:
    plan = build_translation_execution_plan(request)
    return run_translation_execution_plan(request, plan)
