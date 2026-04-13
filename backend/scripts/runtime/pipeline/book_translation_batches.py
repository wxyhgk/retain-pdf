from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from services.translation.llm.control_context import TranslationControlContext
from services.translation.llm.placeholder_guard import result_entry
from services.translation.llm.placeholder_guard import should_force_translate_body_text
from services.translation.llm.placeholder_guard import strip_placeholders
from services.translation.policy.metadata_filter import looks_like_hard_nontranslatable_metadata
from services.translation.payload import apply_translated_text_map
from services.translation.payload import pending_translation_items
from services.translation.payload.parts.common import GROUP_ITEM_PREFIX
from services.translation.llm import translate_batch

from runtime.pipeline.book_translation_pages import save_pages


def chunked(seq: list[dict], size: int) -> list[list[dict]]:
    return [seq[i : i + size] for i in range(0, len(seq), size)]


def _save_flush_interval(*, workers: int, total_batches: int) -> int:
    if total_batches <= 1:
        return 1
    return max(2, min(12, max(1, workers) * 2))


def _effective_translation_batch_size(
    *,
    batch_size: int,
    model: str,
    base_url: str,
    translation_context: TranslationControlContext | None,
) -> int:
    configured = max(1, batch_size)
    if translation_context is None:
        return configured
    return max(configured, max(1, translation_context.batch_policy.plain_batch_size))


def _source_text(item: dict) -> str:
    return str(
        item.get("translation_unit_protected_source_text")
        or item.get("group_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    )


def _normalized_text_without_placeholders(item: dict) -> str:
    return " ".join(strip_placeholders(_source_text(item)).split())


def _dedupe_signature(item: dict) -> str | None:
    item_id = str(item.get("item_id", "") or "")
    if item_id.startswith(GROUP_ITEM_PREFIX):
        return None
    if item.get("continuation_group"):
        return None
    if item.get("formula_map") or item.get("translation_unit_formula_map"):
        return None
    if item.get("protected_map") or item.get("translation_unit_protected_map"):
        return None
    source = _source_text(item).strip()
    if not source:
        return None
    payload = {
        "block_type": str(item.get("block_type", "") or ""),
        "source": source,
        "mixed_literal_action": str(item.get("mixed_literal_action", "") or ""),
        "mixed_literal_prefix": str(item.get("mixed_literal_prefix", "") or ""),
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def _dedupe_pending_items(pending: list[dict]) -> tuple[list[dict], dict[str, list[dict]]]:
    unique: list[dict] = []
    duplicates_by_rep_id: dict[str, list[dict]] = {}
    representative_by_signature: dict[str, dict] = {}
    for item in pending:
        signature = _dedupe_signature(item)
        if signature is None:
            unique.append(item)
            continue
        representative = representative_by_signature.get(signature)
        if representative is None:
            representative_by_signature[signature] = item
            unique.append(item)
            continue
        rep_id = str(representative.get("item_id", "") or "")
        duplicates_by_rep_id.setdefault(rep_id, []).append(item)
    return unique, duplicates_by_rep_id


def _clone_result_for_item(payload: dict[str, str], *, item: dict) -> dict[str, str]:
    cloned = dict(payload)
    diagnostics = dict(cloned.get("translation_diagnostics") or {})
    if diagnostics:
        diagnostics["item_id"] = item.get("item_id", "")
        diagnostics["page_idx"] = item.get("page_idx")
        cloned["translation_diagnostics"] = diagnostics
    return cloned


def _expand_duplicate_results(
    translated: dict[str, dict[str, str]],
    *,
    duplicate_items_by_rep_id: dict[str, list[dict]],
) -> dict[str, dict[str, str]]:
    if not duplicate_items_by_rep_id:
        return translated
    expanded = dict(translated)
    for rep_id, duplicate_items in duplicate_items_by_rep_id.items():
        rep_payload = translated.get(rep_id)
        if not rep_payload:
            continue
        for duplicate_item in duplicate_items:
            expanded[str(duplicate_item.get("item_id", "") or "")] = _clone_result_for_item(
                rep_payload,
                item=duplicate_item,
            )
    return expanded


def _fast_path_keep_origin_result(item: dict, reason: str) -> dict[str, dict[str, str]]:
    payload = result_entry("keep_origin", "")
    payload["translation_diagnostics"] = {
        "item_id": item.get("item_id", ""),
        "page_idx": item.get("page_idx"),
        "route_path": ["block_level", "fast_path_keep_origin"],
        "output_mode_path": [],
        "fallback_to": "keep_origin",
        "degradation_reason": reason,
        "final_status": "kept_origin",
    }
    return {str(item.get("item_id", "") or ""): payload}


def _is_fast_path_keep_origin_item(item: dict) -> tuple[bool, str]:
    source = _source_text(item)
    compact = _normalized_text_without_placeholders(item)
    block_type = str(item.get("block_type", "") or "").strip().lower()
    metadata = item.get("metadata", {}) or {}
    structure_role = str(metadata.get("structure_role", "") or "").strip().lower()
    layout_zone = str(item.get("layout_zone", "") or "").strip().lower()
    if not source.strip():
        return True, "empty_source_text"
    if not compact:
        return True, "placeholder_only"
    if looks_like_hard_nontranslatable_metadata(item):
        return True, "hard_metadata_fragment"
    if (
        len(compact) <= 4
        and compact.replace(" ", "").isalnum()
        and block_type in {"image_caption", "table_caption", "table_footnote"}
    ):
        return True, "short_non_body_label"
    if (
        len(compact) <= 4
        and compact.replace(" ", "").isalnum()
        and structure_role in {"caption", "image_caption", "table_caption", "metadata"}
        and layout_zone == "non_flow"
    ):
        return True, "short_non_body_label"
    return False, ""


def _is_low_risk_batchable_item(item: dict, *, translation_context: TranslationControlContext | None) -> bool:
    if translation_context is None:
        return False
    if str(item.get("block_type", "") or "") != "text":
        return False
    if not should_force_translate_body_text(item):
        return False
    if item.get("continuation_group"):
        return False
    if item.get("formula_map") or item.get("translation_unit_formula_map"):
        return False
    source = _source_text(item).strip()
    if not source:
        return False
    compact = _normalized_text_without_placeholders(item)
    if len(compact) < 40 or len(compact) > translation_context.batch_policy.batch_low_risk_max_chars:
        return False
    placeholder_count = len(re.findall(r"<[a-z]\d+-[0-9a-z]{3}/>", source))
    if placeholder_count > translation_context.batch_policy.batch_low_risk_max_placeholders:
        return False
    return True


def _build_translation_batches(
    pending: list[dict],
    *,
    effective_batch_size: int,
    translation_context: TranslationControlContext | None,
) -> tuple[list[list[dict]], list[dict[str, dict[str, str]]]]:
    immediate_results: list[dict[str, dict[str, str]]] = []
    batchable: list[dict] = []
    singles: list[dict] = []
    for item in pending:
        should_skip, reason = _is_fast_path_keep_origin_item(item)
        if should_skip:
            immediate_results.append(_fast_path_keep_origin_result(item, reason))
            continue
        if _is_low_risk_batchable_item(item, translation_context=translation_context):
            tagged_item = dict(item)
            tagged_item["_batched_plain_candidate"] = True
            batchable.append(tagged_item)
        else:
            singles.append(item)

    batches: list[list[dict]] = []
    if batchable:
        batches.extend(chunked(batchable, effective_batch_size))
    for item in singles:
        batches.append([item])
    return batches, immediate_results


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
    mode: str = "fast",
    translation_context: TranslationControlContext | None = None,
) -> dict[str, int]:
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
    pending, duplicate_items_by_rep_id = _dedupe_pending_items(pending)
    effective_batch_size = _effective_translation_batch_size(
        batch_size=batch_size,
        model=model,
        base_url=base_url,
        translation_context=translation_context,
    )
    batches, immediate_results = _build_translation_batches(
        pending,
        effective_batch_size=effective_batch_size,
        translation_context=translation_context,
    )
    total_batches = len(batches)
    flush_interval = _save_flush_interval(workers=workers, total_batches=total_batches)
    print(
        f"book: pending items={len(pending)} batches={total_batches} workers={max(1, workers)} "
        f"mode={mode} effective_batch_size={effective_batch_size}",
        flush=True,
    )
    if immediate_results:
        print(f"book: fast-path keep_origin items={len(immediate_results)}", flush=True)
    duplicate_count = sum(len(items) for items in duplicate_items_by_rep_id.values())
    if duplicate_count:
        print(f"book: deduped duplicate items={duplicate_count}", flush=True)
    if total_batches:
        print(f"book: save flush interval={flush_interval} batches", flush=True)
    dirty_pages: set[int] = set()
    for immediate in immediate_results:
        immediate = _expand_duplicate_results(immediate, duplicate_items_by_rep_id=duplicate_items_by_rep_id)
        apply_translated_text_map(flat_payload, immediate)
        dirty_pages.update(touched_pages_for_batch(immediate, item_to_page, unit_to_pages))
    if immediate_results and not batches and dirty_pages:
        save_started = time.perf_counter()
        save_pages(page_payloads, translation_paths, dirty_pages)
        print(
            f"book: final flush pages={len(dirty_pages)} for fast-path items in {time.perf_counter() - save_started:.2f}s",
            flush=True,
        )
        dirty_pages.clear()
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
                mode=mode,
                context=translation_context,
            )
            translated = _expand_duplicate_results(translated, duplicate_items_by_rep_id=duplicate_items_by_rep_id)
            apply_translated_text_map(flat_payload, translated)
            dirty_pages.update(touched_pages_for_batch(translated, item_to_page, unit_to_pages))
            if index % flush_interval == 0 and dirty_pages:
                save_started = time.perf_counter()
                save_pages(page_payloads, translation_paths, dirty_pages)
                print(
                    f"book: flushed pages={len(dirty_pages)} after batch {index}/{total_batches} in "
                    f"{time.perf_counter() - save_started:.2f}s",
                    flush=True,
                )
                dirty_pages.clear()
        if dirty_pages:
            save_started = time.perf_counter()
            save_pages(page_payloads, translation_paths, dirty_pages)
            print(
                f"book: final flush pages={len(dirty_pages)} in {time.perf_counter() - save_started:.2f}s",
                flush=True,
            )
        return {
            "pending_items": len(pending),
            "total_batches": total_batches,
            "effective_batch_size": effective_batch_size,
            "flush_interval": flush_interval,
            "effective_workers": max(1, workers),
        }

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
                mode=mode,
                context=translation_context,
            ): (index, batch)
            for index, batch in enumerate(batches, start=1)
        }
        for future in as_completed(futures):
            translated = future.result()
            translated = _expand_duplicate_results(translated, duplicate_items_by_rep_id=duplicate_items_by_rep_id)
            apply_translated_text_map(flat_payload, translated)
            completed += 1
            dirty_pages.update(touched_pages_for_batch(translated, item_to_page, unit_to_pages))
            if completed % flush_interval == 0 and dirty_pages:
                save_started = time.perf_counter()
                save_pages(page_payloads, translation_paths, dirty_pages)
                print(
                    f"book: flushed pages={len(dirty_pages)} after completed batch {completed}/{total_batches} in "
                    f"{time.perf_counter() - save_started:.2f}s",
                    flush=True,
                )
                dirty_pages.clear()
            print(f"book: completed batch {completed}/{total_batches}", flush=True)
    if dirty_pages:
        save_started = time.perf_counter()
        save_pages(page_payloads, translation_paths, dirty_pages)
        print(
            f"book: final flush pages={len(dirty_pages)} in {time.perf_counter() - save_started:.2f}s",
            flush=True,
        )
    return {
        "pending_items": len(pending),
        "total_batches": total_batches,
        "effective_batch_size": effective_batch_size,
        "flush_interval": flush_interval,
        "effective_workers": max(1, workers),
    }
