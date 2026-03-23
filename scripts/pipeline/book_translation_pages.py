from __future__ import annotations

from pathlib import Path

from translation.ocr.json_extractor import extract_text_items
from translation.policy import TranslationPolicyConfig
from translation.workflow import default_page_translation_name
from translation.workflow import translate_items_to_path
from translation.payload import ensure_translation_template
from translation.payload import load_translations
from translation.payload import save_translations


def translate_book_pages(
    *,
    data: dict,
    output_dir: Path,
    page_indices: range,
    api_key: str,
    batch_size: int,
    workers: int,
    model: str,
    base_url: str,
    mode: str,
    classify_batch_size: int,
    skip_title_translation: bool,
    progress_prefix: str,
    sci_cutoff_page_idx: int | None = None,
    sci_cutoff_block_idx: int | None = None,
    policy_config: TranslationPolicyConfig | None = None,
) -> tuple[dict[int, list[dict]], list[dict]]:
    pages = data.get("pdf_info", [])
    summaries: list[dict] = []
    translated_pages_map: dict[int, list[dict]] = {}

    output_dir.mkdir(parents=True, exist_ok=True)
    for page_idx in page_indices:
        items = extract_text_items(data, page_idx=page_idx)
        translation_path = output_dir / default_page_translation_name(page_idx)
        summary = translate_items_to_path(
            items=items,
            translation_path=translation_path,
            page_idx=page_idx,
            api_key=api_key,
            batch_size=batch_size,
            workers=max(1, workers),
            model=model,
            base_url=base_url,
            progress_label=f"{progress_prefix} {page_idx + 1}/{len(pages)}",
            mode=mode,
            classify_batch_size=max(1, classify_batch_size),
            skip_title_translation=skip_title_translation,
            sci_cutoff_page_idx=sci_cutoff_page_idx,
            sci_cutoff_block_idx=sci_cutoff_block_idx,
            policy_config=policy_config,
        )
        summaries.append(summary)
        translated_pages_map[page_idx] = load_translations(translation_path)
    return translated_pages_map, summaries


def load_page_payloads(
    *,
    data: dict,
    output_dir: Path,
    page_indices: range,
) -> tuple[dict[int, Path], dict[int, list[dict]]]:
    translation_paths: dict[int, Path] = {}
    page_payloads: dict[int, list[dict]] = {}
    output_dir.mkdir(parents=True, exist_ok=True)
    for page_idx in page_indices:
        items = extract_text_items(data, page_idx=page_idx)
        translation_path = output_dir / default_page_translation_name(page_idx)
        ensure_translation_template(items, translation_path, page_idx=page_idx)
        translation_paths[page_idx] = translation_path
        page_payloads[page_idx] = load_translations(translation_path)
    return translation_paths, page_payloads


def save_pages(
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    page_indices: set[int] | None = None,
) -> None:
    targets = sorted(page_payloads) if page_indices is None else sorted(page_indices)
    for page_idx in targets:
        save_translations(translation_paths[page_idx], page_payloads[page_idx])
