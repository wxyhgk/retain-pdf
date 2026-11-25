from __future__ import annotations

from pathlib import Path

from retainpdf_translation.public import GlossaryEntry
from retainpdf_translation.public import DEFAULT_BASE_URL
from retainpdf_translation.public import DEFAULT_MODEL
from retainpdf_translation.public import TranslationExecutionRequest
from retainpdf_translation.public import execute_translation_request

from retainpdf_pipeline.translate.tables_stage import translate_tables
from retainpdf_pipeline.translate.toc_stage import toc_fixed_translations_fn


def translate_book_pipeline(
    *,
    source_json_path: Path,
    output_dir: Path,
    api_key: str,
    start_page: int = 0,
    end_page: int = -1,
    batch_size: int = 8,
    workers: int = 1,
    mode: str = "fast",
    math_mode: str = "direct_typst",
    classify_batch_size: int = 12,
    skip_title_translation: bool = False,
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    source_pdf_path: Path | None = None,
    rule_profile_name: str = "general_sci",
    custom_rules_text: str = "",
    glossary_id: str = "",
    glossary_name: str = "",
    glossary_resource_entry_count: int = 0,
    glossary_inline_entry_count: int = 0,
    glossary_overridden_entry_count: int = 0,
    glossary_entries: list[GlossaryEntry] | None = None,
    context_mode: str = "needed",
    glossary_mode: str = "matched",
    memory_mode: str = "matched",
    invocation: dict | None = None,
    preparation: str = "off",
    reviewer_model: str = "",
    reviewer_base_url: str = "",
    reviewer_api_key: str = "",
    engine: str = "legacy",
    ocr_stream_dir: Path | None = None,
    tables: str = "keep",
    toc: str = "agent",
) -> dict:
    result = execute_translation_request(
        TranslationExecutionRequest(
            source_json_path=source_json_path,
            output_dir=output_dir,
            api_key=api_key,
            start_page=start_page,
            end_page=end_page,
            batch_size=batch_size,
            workers=workers,
            mode=mode,
            math_mode=math_mode,
            classify_batch_size=classify_batch_size,
            skip_title_translation=skip_title_translation,
            source_pdf_path=source_pdf_path,
            model=model,
            base_url=base_url,
            rule_profile_name=rule_profile_name,
            custom_rules_text=custom_rules_text,
            glossary_id=glossary_id,
            glossary_name=glossary_name,
            glossary_resource_entry_count=glossary_resource_entry_count,
            glossary_inline_entry_count=glossary_inline_entry_count,
            glossary_overridden_entry_count=glossary_overridden_entry_count,
            glossary_entries=glossary_entries,
            context_mode=context_mode,
            glossary_mode=glossary_mode,
            memory_mode=memory_mode,
            invocation=invocation,
            preparation=preparation,
            reviewer_model=reviewer_model,
            reviewer_base_url=reviewer_base_url,
            reviewer_api_key=reviewer_api_key,
            engine=engine,
            ocr_stream_dir=ocr_stream_dir,
            # 目录 agent 和普通翻译同步跑（translate/toc_stage.py，默认 agent）；translate 时为 None，和以前一样
            fixed_translations_fn=toc_fixed_translations_fn(
                mode=toc,
                output_dir=output_dir,
                api_key=api_key,
                model=model,
                base_url=base_url,
                glossary_entries=glossary_entries,
                skip_titles=skip_title_translation,
            ),
        )
    )
    if tables == "translate":
        # 表格翻译（T3）：正文翻完再翻表格，术语记忆用上正文定下的译法。结果在 translated/tables.v1.json。
        document_path = source_json_path
        if ocr_stream_dir is not None:
            # 跟着 OCR 翻：正文翻完时 OCR 也做完了，表格用整本的最终文档
            from retainpdf_base.ocr_stream import wait_for_ocr_stream

            state = wait_for_ocr_stream(ocr_stream_dir)
            while not state.done:
                state = wait_for_ocr_stream(ocr_stream_dir, after_seq=state.seq)
            document_path = state.document_path
        result["tables"] = translate_tables(
            source_json_path=document_path,
            source_pdf_path=source_pdf_path,
            output_dir=output_dir,
            api_key=api_key,
            model=model,
            base_url=base_url,
            glossary_entries=glossary_entries,
            start_page=start_page,
            end_page=end_page,
        )
    return result
