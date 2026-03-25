from __future__ import annotations

from pathlib import Path

from translation.ocr.json_extractor import load_ocr_json
from pipeline.render_mode import resolve_page_range
from translation.llm import DEFAULT_BASE_URL
from translation.policy import build_book_translation_policy_config
from pipeline.book_translation_flow import translate_book_with_global_continuations


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
    classify_batch_size: int = 12,
    skip_title_translation: bool = False,
    model: str = "deepseek-chat",
    base_url: str = DEFAULT_BASE_URL,
    source_pdf_path: Path | None = None,
    rule_profile_name: str = "general_sci",
    custom_rules_text: str = "",
) -> dict:
    data = load_ocr_json(source_json_path)
    pages = data.get("pdf_info", [])
    if not pages:
        raise RuntimeError("No pages found in OCR JSON.")

    start, stop = resolve_page_range(len(pages), start_page, end_page)
    page_indices = range(start, stop + 1)
    policy_config = build_book_translation_policy_config(
        data=data,
        mode=mode,
        skip_title_translation=skip_title_translation,
        source_pdf_path=source_pdf_path,
        api_key=api_key,
        model=model,
        base_url=base_url,
        output_dir=output_dir,
        rule_profile_name=rule_profile_name,
        custom_rules_text=custom_rules_text,
    )
    if policy_config.domain_context.get("domain") or policy_config.domain_context.get("translation_guidance"):
        print(
            f"sci domain: {policy_config.domain_context.get('domain', '').strip() or 'unknown'}",
            flush=True,
        )
    print(f"rule profile: {policy_config.rule_profile_name}", flush=True)
    translated_pages_map, summaries = translate_book_with_global_continuations(
        data=data,
        output_dir=output_dir,
        page_indices=page_indices,
        api_key=api_key,
        batch_size=batch_size,
        workers=max(1, workers),
        model=model,
        base_url=base_url,
        mode=mode,
        classify_batch_size=max(1, classify_batch_size),
        skip_title_translation=skip_title_translation,
        sci_cutoff_page_idx=policy_config.sci_cutoff_page_idx,
        sci_cutoff_block_idx=policy_config.sci_cutoff_block_idx,
        policy_config=policy_config,
        domain_guidance=policy_config.domain_guidance,
    )
    total_items = sum(item["total_items"] for item in summaries)
    translated_items = sum(item["translated_items"] for item in summaries)
    return {
        "output_dir": output_dir,
        "start_page": start,
        "end_page": stop,
        "page_count": len(summaries),
        "total_items": total_items,
        "translated_items": translated_items,
        "translated_pages_map": translated_pages_map,
        "summaries": summaries,
        "domain_context": policy_config.domain_context,
        "rule_profile_name": policy_config.rule_profile_name,
        "custom_rules_text": policy_config.custom_rules_text,
    }
