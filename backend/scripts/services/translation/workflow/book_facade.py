from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from services.translation.llm.shared.provider_runtime import DEFAULT_BASE_URL
from services.translation.llm.shared.provider_runtime import DEFAULT_MODEL
from services.translation.terms import GlossaryEntry


@dataclass(frozen=True)
class BookRequest:
    source_json_path: Path
    source_pdf_path: Path
    output_dir: Path
    output_pdf_path: Path
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
    render_mode: str = "auto"
    rule_profile_name: str = "general_sci"
    custom_rules_text: str = ""
    glossary_id: str = ""
    glossary_name: str = ""
    glossary_resource_entry_count: int = 0
    glossary_inline_entry_count: int = 0
    glossary_overridden_entry_count: int = 0
    glossary_entries: list[GlossaryEntry] | None = None
    compile_workers: int | None = None
    typst_font_family: str = ""
    pdf_compress_dpi: int = 144
    invocation: dict[str, Any] | None = None


@dataclass(frozen=True)
class BookResult:
    output_dir: Path
    output_pdf_path: Path
    pages_processed: int
    translated_items_total: int
    rule_profile_name: str
    custom_rules_text: str
    glossary: dict
    translate_elapsed: float
    save_elapsed: float
    total_elapsed: float
    effective_render_mode: str
    translation_diagnostics_path: str
    translation_debug_index_path: str
    translation_provider_family: str
    translation_peak_inflight_requests: int
    translation_timeout_attempts: int
    translation_retrying_items: int
    invocation: dict

    @classmethod
    def from_mapping(cls, value: dict) -> "BookResult":
        return cls(
            output_dir=Path(value["output_dir"]),
            output_pdf_path=Path(value["output_pdf_path"]),
            pages_processed=int(value["pages_processed"]),
            translated_items_total=int(value["translated_items_total"]),
            rule_profile_name=value.get("rule_profile_name", ""),
            custom_rules_text=value.get("custom_rules_text", ""),
            glossary=value.get("glossary", {}),
            translate_elapsed=float(value.get("translate_elapsed", 0.0)),
            save_elapsed=float(value.get("save_elapsed", 0.0)),
            total_elapsed=float(value.get("total_elapsed", 0.0)),
            effective_render_mode=value.get("effective_render_mode", ""),
            translation_diagnostics_path=value.get("translation_diagnostics_path", ""),
            translation_debug_index_path=value.get("translation_debug_index_path", ""),
            translation_provider_family=value.get("translation_provider_family", ""),
            translation_peak_inflight_requests=int(value.get("translation_peak_inflight_requests", 0)),
            translation_timeout_attempts=int(value.get("translation_timeout_attempts", 0)),
            translation_retrying_items=int(value.get("translation_retrying_items", 0)),
            invocation=value.get("invocation", {}),
        )

    def to_mapping(self) -> dict:
        return {
            "output_dir": self.output_dir,
            "output_pdf_path": self.output_pdf_path,
            "pages_processed": self.pages_processed,
            "translated_items_total": self.translated_items_total,
            "rule_profile_name": self.rule_profile_name,
            "custom_rules_text": self.custom_rules_text,
            "glossary": self.glossary,
            "translate_elapsed": self.translate_elapsed,
            "save_elapsed": self.save_elapsed,
            "total_elapsed": self.total_elapsed,
            "effective_render_mode": self.effective_render_mode,
            "translation_diagnostics_path": self.translation_diagnostics_path,
            "translation_debug_index_path": self.translation_debug_index_path,
            "translation_provider_family": self.translation_provider_family,
            "translation_peak_inflight_requests": self.translation_peak_inflight_requests,
            "translation_timeout_attempts": self.translation_timeout_attempts,
            "translation_retrying_items": self.translation_retrying_items,
            "invocation": self.invocation,
        }


@dataclass(frozen=True)
class TranslationRequest:
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


@dataclass(frozen=True)
class TranslationResult:
    output_dir: Path
    start_page: int
    end_page: int
    page_count: int
    total_items: int
    translated_items: int
    translated_pages_map: dict[int, list[dict]]
    summaries: list[dict]
    domain_context: dict
    rule_profile_name: str
    custom_rules_text: str
    glossary: dict
    diagnostics_summary: dict
    invocation: dict
    math_mode: str
    translation_context: object
    translation_run_diagnostics: object

    @classmethod
    def from_mapping(cls, value: dict) -> "TranslationResult":
        return cls(
            output_dir=Path(value["output_dir"]),
            start_page=int(value["start_page"]),
            end_page=int(value["end_page"]),
            page_count=int(value["page_count"]),
            total_items=int(value["total_items"]),
            translated_items=int(value["translated_items"]),
            translated_pages_map=value["translated_pages_map"],
            summaries=value["summaries"],
            domain_context=value.get("domain_context", {}),
            rule_profile_name=value.get("rule_profile_name", ""),
            custom_rules_text=value.get("custom_rules_text", ""),
            glossary=value.get("glossary", {}),
            diagnostics_summary=value.get("diagnostics_summary", {}),
            invocation=value.get("invocation", {}),
            math_mode=value.get("math_mode", ""),
            translation_context=value.get("translation_context"),
            translation_run_diagnostics=value.get("translation_run_diagnostics"),
        )

    def to_mapping(self) -> dict:
        return {
            "output_dir": self.output_dir,
            "start_page": self.start_page,
            "end_page": self.end_page,
            "page_count": self.page_count,
            "total_items": self.total_items,
            "translated_items": self.translated_items,
            "translated_pages_map": self.translated_pages_map,
            "summaries": self.summaries,
            "domain_context": self.domain_context,
            "rule_profile_name": self.rule_profile_name,
            "custom_rules_text": self.custom_rules_text,
            "glossary": self.glossary,
            "diagnostics_summary": self.diagnostics_summary,
            "invocation": self.invocation,
            "math_mode": self.math_mode,
            "translation_context": self.translation_context,
            "translation_run_diagnostics": self.translation_run_diagnostics,
        }


def translate_book(request: TranslationRequest) -> TranslationResult:
    # Import lazily to keep this facade independent from runtime.pipeline at module import time.
    from runtime.pipeline.translation_stage import translate_book_pipeline

    return TranslationResult.from_mapping(
        translate_book_pipeline(
            source_json_path=request.source_json_path,
            output_dir=request.output_dir,
            api_key=request.api_key,
            start_page=request.start_page,
            end_page=request.end_page,
            batch_size=request.batch_size,
            workers=request.workers,
            mode=request.mode,
            math_mode=request.math_mode,
            classify_batch_size=request.classify_batch_size,
            skip_title_translation=request.skip_title_translation,
            model=request.model,
            base_url=request.base_url,
            source_pdf_path=request.source_pdf_path,
            rule_profile_name=request.rule_profile_name,
            custom_rules_text=request.custom_rules_text,
            glossary_id=request.glossary_id,
            glossary_name=request.glossary_name,
            glossary_resource_entry_count=request.glossary_resource_entry_count,
            glossary_inline_entry_count=request.glossary_inline_entry_count,
            glossary_overridden_entry_count=request.glossary_overridden_entry_count,
            glossary_entries=request.glossary_entries,
            invocation=request.invocation,
        )
    )


def run_book(request: BookRequest) -> BookResult:
    # Import lazily to keep this facade independent from runtime.pipeline at module import time.
    from runtime.pipeline.book_pipeline import run_book_pipeline

    return BookResult.from_mapping(
        run_book_pipeline(
            source_json_path=request.source_json_path,
            source_pdf_path=request.source_pdf_path,
            output_dir=request.output_dir,
            output_pdf_path=request.output_pdf_path,
            api_key=request.api_key,
            start_page=request.start_page,
            end_page=request.end_page,
            batch_size=request.batch_size,
            workers=request.workers,
            model=request.model,
            base_url=request.base_url,
            mode=request.mode,
            math_mode=request.math_mode,
            classify_batch_size=request.classify_batch_size,
            skip_title_translation=request.skip_title_translation,
            render_mode=request.render_mode,
            rule_profile_name=request.rule_profile_name,
            custom_rules_text=request.custom_rules_text,
            glossary_id=request.glossary_id,
            glossary_name=request.glossary_name,
            glossary_resource_entry_count=request.glossary_resource_entry_count,
            glossary_inline_entry_count=request.glossary_inline_entry_count,
            glossary_overridden_entry_count=request.glossary_overridden_entry_count,
            glossary_entries=request.glossary_entries,
            compile_workers=request.compile_workers,
            typst_font_family=request.typst_font_family,
            pdf_compress_dpi=request.pdf_compress_dpi,
            invocation=request.invocation,
        )
    )
