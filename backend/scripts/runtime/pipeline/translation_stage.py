from __future__ import annotations

from pathlib import Path

from services.translation.terms import GlossaryEntry
from services.translation.llm.shared.provider_runtime import DEFAULT_BASE_URL
from services.translation.llm.shared.provider_runtime import DEFAULT_MODEL
from services.translation.workflow import TranslationExecutionRequest
from services.translation.workflow import execute_translation_request


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
    invocation: dict | None = None,
) -> dict:
    return execute_translation_request(
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
            invocation=invocation,
        )
    )
