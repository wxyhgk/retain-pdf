from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from services.translation.llm.control_context import TranslationControlContext
from services.translation.llm.deepseek_client import is_transport_error
from services.translation.llm.placeholder_guard import has_formula_placeholders
from services.translation.llm.placeholder_guard import result_entry
from services.translation.llm.placeholder_guard import placeholder_sequence
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
    if str(item.get("math_mode", "placeholder") or "placeholder").strip() == "direct_typst":
        return False
    if str(item.get("continuation_group", "") or "").strip():
        return False
    if str(item.get("translation_unit_id", "") or "").startswith(GROUP_ITEM_PREFIX):
        return False
    if str(item.get("block_type", "") or "") != "text":
        return False
    if not should_force_translate_body_text(item):
        return False
    source = _source_text(item).strip()
    if not source:
        return False
    compact = _normalized_text_without_placeholders(item)
    if (
        len(compact) < translation_context.batch_policy.batch_low_risk_min_chars
        or len(compact) > translation_context.batch_policy.batch_low_risk_max_chars
    ):
        return False
    placeholder_count = len(placeholder_sequence(source))
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


def _is_batched_fast_batch(batch: list[dict]) -> bool:
    return bool(batch) and (
        len(batch) > 1 or any(item.get("_batched_plain_candidate") for item in batch)
    )


def _is_single_slow_batch(batch: list[dict]) -> bool:
    if len(batch) != 1:
        return False
    item = batch[0]
    return bool(item.get("_heavy_formula_split_applied"))


def _classify_translation_batches(
    batches: list[list[dict]],
) -> tuple[list[list[dict]], list[list[dict]], list[list[dict]]]:
    batched_fast_batches: list[list[dict]] = []
    single_fast_batches: list[list[dict]] = []
    single_slow_batches: list[list[dict]] = []
    for batch in batches:
        if _is_batched_fast_batch(batch):
            batched_fast_batches.append(batch)
        elif _is_single_slow_batch(batch):
            single_slow_batches.append(batch)
        else:
            single_fast_batches.append(batch)
    return batched_fast_batches, single_fast_batches, single_slow_batches


def _allocate_translation_queue_workers(
    total_workers: int,
    *,
    batched_fast_count: int,
    single_fast_count: int,
    single_slow_count: int,
) -> dict[str, int]:
    workers = max(1, total_workers)
    allocation = {
        "batched_fast": 0,
        "single_fast": 0,
        "single_slow": 0,
    }
    if workers == 1:
        if batched_fast_count > 0:
            allocation["batched_fast"] = 1
        elif single_fast_count > 0:
            allocation["single_fast"] = 1
        elif single_slow_count > 0:
            allocation["single_slow"] = 1
        return allocation

    if single_slow_count > 0:
        slow_cap = 1 if workers <= 8 else 2 if workers <= 24 else min(4, max(2, workers // 8))
        allocation["single_slow"] = min(single_slow_count, slow_cap, max(1, workers - 1))

    remaining = workers - allocation["single_slow"]
    fast_targets: list[tuple[str, int]] = []
    if batched_fast_count > 0:
        fast_targets.append(("batched_fast", batched_fast_count))
    if single_fast_count > 0:
        fast_targets.append(("single_fast", single_fast_count))

    if not fast_targets:
        allocation["single_slow"] = workers
        return allocation
    if len(fast_targets) == 1:
        allocation[fast_targets[0][0]] = remaining
        return allocation

    remaining_after_floor = remaining - len(fast_targets)
    for name, _count in fast_targets:
        allocation[name] = 1
    total_fast_batches = sum(count for _, count in fast_targets)
    if remaining_after_floor > 0 and total_fast_batches > 0:
        extras: dict[str, int] = {}
        assigned = 0
        for index, (name, count) in enumerate(fast_targets):
            if index == len(fast_targets) - 1:
                extra = remaining_after_floor - assigned
            else:
                extra = (remaining_after_floor * count) // total_fast_batches
                assigned += extra
            extras[name] = extra
        for name, extra in extras.items():
            allocation[name] += extra
    return allocation


def _submit_parallel_translation_batches(
    batches: list[list[dict]],
    *,
    worker_count: int,
    queue_name: str,
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    mode: str,
    translation_context: TranslationControlContext | None,
    executors: list[ThreadPoolExecutor],
) -> dict[object, tuple[str, list[dict]]]:
    if not batches:
        return {}
    executor = ThreadPoolExecutor(max_workers=max(1, worker_count))
    executors.append(executor)
    return {
            executor.submit(
                _translate_batch_or_keep_origin,
                batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"book: {queue_name} batch {index}/{len(batches)}",
                domain_guidance=domain_guidance,
                mode=mode,
                context=translation_context,
            ): (queue_name, batch)
            for index, batch in enumerate(batches, start=1)
        }


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


def _keep_origin_results_for_transport_batch(
    batch: list[dict],
    *,
    degradation_reason: str = "batch_transport_timeout_budget_exceeded",
) -> dict[str, dict[str, str]]:
    degraded: dict[str, dict[str, str]] = {}
    for item in batch:
        payload = result_entry("keep_origin", "")
        payload["error_taxonomy"] = "transport"
        payload["translation_diagnostics"] = {
            "item_id": item.get("item_id", ""),
            "page_idx": item.get("page_idx"),
            "route_path": ["block_level", "batched_plain", "keep_origin"],
            "output_mode_path": [],
            "error_trace": [{"type": "transport", "code": "BATCH_TRANSPORT_ERROR"}],
            "fallback_to": "keep_origin",
            "degradation_reason": degradation_reason,
            "final_status": "kept_origin",
        }
        degraded[str(item.get("item_id", "") or "")] = payload
    return degraded


def _translate_batch_or_keep_origin(
    batch: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    domain_guidance: str,
    mode: str,
    context: TranslationControlContext | None,
) -> dict[str, dict[str, str]]:
    try:
        return translate_batch(
            batch,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            domain_guidance=domain_guidance,
            mode=mode,
            context=context,
        )
    except Exception as exc:
        if not is_transport_error(exc):
            raise
        if request_label:
            print(
                f"{request_label}: transport failure, degrade batch to keep_origin: {type(exc).__name__}: {exc}",
                flush=True,
            )
        return _keep_origin_results_for_transport_batch(batch)


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
    batched_fast_batches, single_fast_batches, single_slow_batches = _classify_translation_batches(batches)
    total_batches = len(batches)
    flush_interval = _save_flush_interval(workers=workers, total_batches=total_batches)
    queue_workers = _allocate_translation_queue_workers(
        workers,
        batched_fast_count=len(batched_fast_batches),
        single_fast_count=len(single_fast_batches),
        single_slow_count=len(single_slow_batches),
    )
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
        print(
            "book: queue split "
            f"batched_fast={len(batched_fast_batches)} "
            f"single_fast={len(single_fast_batches)} "
            f"single_slow={len(single_slow_batches)} "
            f"workers(batched_fast={queue_workers['batched_fast']}, "
            f"single_fast={queue_workers['single_fast']}, "
            f"single_slow={queue_workers['single_slow']})",
            flush=True,
        )
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
            translated = _translate_batch_or_keep_origin(
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
            "fast_queue_batches": len(batched_fast_batches) + len(single_fast_batches),
            "slow_queue_batches": len(single_slow_batches),
            "batched_fast_batches": len(batched_fast_batches),
            "single_fast_batches": len(single_fast_batches),
            "single_slow_batches": len(single_slow_batches),
        }

    executors: list[ThreadPoolExecutor] = []
    futures: dict[object, tuple[str, list[dict]]] = {}
    futures.update(
        _submit_parallel_translation_batches(
            batched_fast_batches,
            worker_count=queue_workers["batched_fast"],
            queue_name="batched_fast",
            api_key=api_key,
            model=model,
            base_url=base_url,
            domain_guidance=domain_guidance,
            mode=mode,
            translation_context=translation_context,
            executors=executors,
        )
    )
    futures.update(
        _submit_parallel_translation_batches(
            single_fast_batches,
            worker_count=queue_workers["single_fast"],
            queue_name="single_fast",
            api_key=api_key,
            model=model,
            base_url=base_url,
            domain_guidance=domain_guidance,
            mode=mode,
            translation_context=translation_context,
            executors=executors,
        )
    )
    futures.update(
        _submit_parallel_translation_batches(
            single_slow_batches,
            worker_count=queue_workers["single_slow"],
            queue_name="single_slow",
            api_key=api_key,
            model=model,
            base_url=base_url,
            domain_guidance=domain_guidance,
            mode=mode,
            translation_context=translation_context,
            executors=executors,
        )
    )
    completed = 0
    try:
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
    finally:
        for executor in executors:
            executor.shutdown(wait=True, cancel_futures=False)
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
        "fast_queue_batches": len(batched_fast_batches) + len(single_fast_batches),
        "slow_queue_batches": len(single_slow_batches),
        "batched_fast_batches": len(batched_fast_batches),
        "single_fast_batches": len(single_fast_batches),
        "single_slow_batches": len(single_slow_batches),
    }
