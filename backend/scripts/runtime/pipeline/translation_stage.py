from __future__ import annotations

from pathlib import Path

from services.translation.ocr.json_extractor import get_page_count
from services.translation.ocr.json_extractor import load_ocr_json
from services.translation.diagnostics import TranslationRunDiagnostics
from services.translation.diagnostics import aggregate_payload_diagnostics
from services.translation.diagnostics import classify_provider_family
from services.translation.diagnostics import translation_run_diagnostics_scope
from services.translation.payload import write_translation_manifest
from services.translation.session_context import build_translation_context_from_policy
from services.translation.terms import GlossaryEntry
from services.translation.terms import summarize_glossary_usage
from runtime.pipeline.render_mode import resolve_page_range
from services.translation.llm import DEFAULT_BASE_URL
from services.translation.policy import build_book_translation_policy_config
from services.translation.workflow import default_page_translation_name
from runtime.pipeline.book_translation_flow import translate_book_with_global_continuations


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
    math_mode: str = "placeholder",
    classify_batch_size: int = 12,
    skip_title_translation: bool = False,
    model: str = "deepseek-chat",
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
    data = load_ocr_json(source_json_path)
    page_count = get_page_count(data)
    if not page_count:
        raise RuntimeError("No pages found in OCR JSON.")

    start, stop = resolve_page_range(page_count, start_page, end_page)
    page_indices = range(start, stop + 1)
    policy_config = build_book_translation_policy_config(
        data=data,
        mode=mode,
        math_mode=math_mode,
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
    translation_context = build_translation_context_from_policy(
        policy_config,
        glossary_entries=glossary_entries or [],
        model=model,
        base_url=base_url,
    )
    run_diagnostics = TranslationRunDiagnostics(
        provider_family=classify_provider_family(base_url=base_url, model=model),
        model=model,
        base_url=base_url,
        configured_workers=max(1, workers),
        configured_batch_size=max(1, batch_size),
        configured_classify_batch_size=max(1, classify_batch_size),
    )
    run_diagnostics.set_effective_settings(
        translation_workers=max(1, workers),
        policy_workers=max(1, workers),
        continuation_workers=min(max(1, workers), 8),
        mixed_split_workers=min(max(1, workers), 4),
        translation_batch_size=max(1, min(max(1, batch_size), translation_context.batch_policy.plain_batch_size)),
    )
    with translation_run_diagnostics_scope(run_diagnostics):
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
            translation_context=translation_context,
            run_diagnostics=run_diagnostics,
        )
    total_items = sum(item["total_items"] for item in summaries)
    translated_items = sum(item["translated_items"] for item in summaries)
    glossary_summary = summarize_glossary_usage(
        entries=glossary_entries or [],
        translated_pages_map=translated_pages_map,
        glossary_id=glossary_id,
        glossary_name=glossary_name,
        resource_entry_count=glossary_resource_entry_count,
        inline_entry_count=glossary_inline_entry_count,
        overridden_entry_count=glossary_overridden_entry_count,
    )
    _, diagnostics_summary = aggregate_payload_diagnostics(translated_pages_map)
    write_translation_manifest(
        output_dir,
        {
            page_idx: output_dir / default_page_translation_name(page_idx)
            for page_idx in translated_pages_map
        },
        glossary=glossary_summary,
        summary={
            "math_mode": math_mode,
            **diagnostics_summary,
            **({"invocation": invocation} if invocation else {}),
        },
    )
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
        "glossary": glossary_summary,
        "diagnostics_summary": diagnostics_summary,
        "invocation": invocation or {},
        "math_mode": math_mode,
        "translation_context": translation_context,
        "translation_run_diagnostics": run_diagnostics,
    }
