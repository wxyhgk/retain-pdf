from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from orchestration.document_orchestrator import annotate_layout_zones_by_page
from orchestration.document_orchestrator import finalize_orchestration_metadata_by_page
from orchestration.document_orchestrator import review_candidate_continuation_pairs
from ocr.json_extractor import extract_text_items
from translation.continuations import annotate_continuation_context_global
from translation.continuations import summarize_continuation_decisions
from translation.payload_ops import GROUP_ITEM_PREFIX
from translation.payload_ops import apply_translated_text_map
from translation.payload_ops import pending_translation_items
from translation.payload_ops import summarize_payload
from translation.policy_config import TranslationPolicyConfig
from translation.policy_flow import apply_translation_policies
from translation.retrying_translator import translate_batch
from translation.translation_workflow import default_page_translation_name
from translation.translation_workflow import translate_items_to_path
from translation.translations import ensure_translation_template, load_translations, save_translations


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


def chunked(seq: list[dict], size: int) -> list[list[dict]]:
    return [seq[i : i + size] for i in range(0, len(seq), size)]


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


def apply_page_policies(
    *,
    page_payloads: dict[int, list[dict]],
    mode: str,
    classify_batch_size: int,
    api_key: str,
    model: str,
    base_url: str,
    skip_title_translation: bool,
    sci_cutoff_page_idx: int | None,
    sci_cutoff_block_idx: int | None,
    policy_config: TranslationPolicyConfig | None = None,
) -> int:
    classified_items = 0
    for page_idx in sorted(page_payloads):
        payload = page_payloads[page_idx]
        page_classified, _ = apply_translation_policies(
            payload=payload,
            mode=mode,
            classify_batch_size=classify_batch_size,
            api_key=api_key,
            model=model,
            base_url=base_url,
            skip_title_translation=skip_title_translation,
            page_idx=page_idx,
            sci_cutoff_page_idx=sci_cutoff_page_idx,
            sci_cutoff_block_idx=sci_cutoff_block_idx,
            policy_config=policy_config,
        )
        classified_items += page_classified
    return classified_items


def save_pages(
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    page_indices: set[int] | None = None,
) -> None:
    targets = sorted(page_payloads) if page_indices is None else sorted(page_indices)
    for page_idx in targets:
        save_translations(translation_paths[page_idx], page_payloads[page_idx])


def translate_pending_units(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    batch_size: int,
    workers: int,
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str = "",
) -> None:
    flat_payload: list[dict] = []
    item_to_page: dict[str, int] = {}
    unit_to_pages: dict[str, set[int]] = {}
    for page_idx in sorted(page_payloads):
        for item in page_payloads[page_idx]:
            flat_payload.append(item)
            item_to_page[item.get("item_id", "")] = page_idx
            unit_id = str(item.get("translation_unit_id") or item.get("item_id") or "")
            if unit_id:
                unit_to_pages.setdefault(unit_id, set()).add(page_idx)

    pending = pending_translation_items(flat_payload)
    batches = chunked(pending, max(1, batch_size))
    total_batches = len(batches)
    print(f"book: pending items={len(pending)} batches={total_batches} workers={max(1, workers)}", flush=True)
    if workers <= 1:
        for index, batch in enumerate(batches, start=1):
            batch_label = f"book: batch {index}/{total_batches}"
            translated = translate_batch(
                batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=batch_label,
                domain_guidance=domain_guidance,
            )
            apply_translated_text_map(flat_payload, translated)
            touched_pages = touched_pages_for_batch(translated, item_to_page, unit_to_pages)
            save_pages(page_payloads, translation_paths, touched_pages)
        return

    completed = 0
    with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
        futures = {
            executor.submit(
                translate_batch,
                batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"book: batch {index}/{total_batches}",
                domain_guidance=domain_guidance,
            ): (index, batch)
            for index, batch in enumerate(batches, start=1)
        }
        for future in as_completed(futures):
            translated = future.result()
            apply_translated_text_map(flat_payload, translated)
            completed += 1
            touched_pages = touched_pages_for_batch(translated, item_to_page, unit_to_pages)
            save_pages(page_payloads, translation_paths, touched_pages)
            print(f"book: completed batch {completed}/{total_batches}", flush=True)


def touched_pages_for_batch(
    translated: dict[str, str],
    item_to_page: dict[str, int],
    unit_to_pages: dict[str, set[int]],
) -> set[int]:
    touched_pages: set[int] = set()
    for item_id in translated:
        if item_id.startswith(GROUP_ITEM_PREFIX):
            touched_pages.update(unit_to_pages.get(item_id, set()))
        elif item_id in item_to_page:
            touched_pages.add(item_to_page[item_id])
    return touched_pages


def translate_book_with_global_continuations(
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
    sci_cutoff_page_idx: int | None,
    sci_cutoff_block_idx: int | None,
    policy_config: TranslationPolicyConfig | None = None,
    domain_guidance: str = "",
) -> tuple[dict[int, list[dict]], list[dict]]:
    if not domain_guidance and policy_config is not None:
        domain_guidance = policy_config.domain_guidance

    translation_paths, page_payloads = load_page_payloads(
        data=data,
        output_dir=output_dir,
        page_indices=page_indices,
    )
    annotate_layout_zones_by_page(page_payloads)
    finalize_orchestration_metadata_by_page(page_payloads)
    continuation_items = annotate_continuation_context_global(page_payloads)
    flat_payload = [item for page_idx in sorted(page_payloads) for item in page_payloads[page_idx]]
    continuation_summary = summarize_continuation_decisions(flat_payload)
    if continuation_items or continuation_summary["candidate_break_items"]:
        finalize_orchestration_metadata_by_page(page_payloads)
        save_pages(page_payloads, translation_paths)
        print(
            f"book: continuation joined={continuation_summary['joined_items']} "
            f"candidate_break={continuation_summary['candidate_break_items']}",
            flush=True,
        )
    if policy_config is None or policy_config.enable_candidate_continuation_review:
        review_candidate_continuation_pairs(
            page_payloads=page_payloads,
            translation_paths=translation_paths,
            api_key=api_key,
            model=model,
            base_url=base_url,
            workers=min(max(1, workers), 8),
            save_pages_fn=save_pages,
        )

    classified_items = apply_page_policies(
        page_payloads=page_payloads,
        mode=mode,
        classify_batch_size=max(1, classify_batch_size),
        api_key=api_key,
        model=model,
        base_url=base_url,
        skip_title_translation=skip_title_translation,
        sci_cutoff_page_idx=sci_cutoff_page_idx,
        sci_cutoff_block_idx=sci_cutoff_block_idx,
        policy_config=policy_config,
    )
    if classified_items:
        print(f"book: classified {classified_items} items", flush=True)
    finalize_orchestration_metadata_by_page(page_payloads)
    save_pages(page_payloads, translation_paths)

    translate_pending_units(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
        batch_size=batch_size,
        workers=max(1, workers),
        api_key=api_key,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
    )

    translated_pages_map = {page_idx: load_translations(translation_paths[page_idx]) for page_idx in sorted(page_payloads)}
    summaries = [
        summarize_payload(translated_pages_map[page_idx], str(translation_paths[page_idx]), page_idx, 0)
        for page_idx in sorted(translated_pages_map)
    ]
    return translated_pages_map, summaries
