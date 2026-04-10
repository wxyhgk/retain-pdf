from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from services.translation.orchestration.units import finalize_orchestration_metadata_by_page
from services.translation.orchestration.units import finalize_payload_orchestration_metadata
from services.translation.orchestration.zones import annotate_payload_layout_zones
from services.translation.continuation import apply_candidate_pair_joins
from services.translation.continuation import candidate_continuation_pairs
from services.translation.continuation import pair_break_score
from services.translation.continuation import pair_join_score
from services.translation.continuation import review_candidate_pairs


def annotate_layout_zones_by_page(page_payloads: dict[int, list[dict]]) -> None:
    for page_idx in sorted(page_payloads):
        annotate_payload_layout_zones(page_payloads[page_idx])


def _is_boundary_role(role: str) -> bool:
    return role in {"head", "tail", "single"}


def _filter_boundary_candidate_pairs(flat_payload: list[dict], pairs: list[dict]) -> list[dict]:
    item_by_id = {str(item.get("item_id", "") or ""): item for item in flat_payload}
    boundary_pairs: list[dict] = []
    for pair in pairs:
        prev_item = item_by_id.get(str(pair.get("prev_item_id", "") or ""))
        next_item = item_by_id.get(str(pair.get("next_item_id", "") or ""))
        if not prev_item or not next_item:
            continue
        prev_page = prev_item.get("page_idx", -1)
        next_page = next_item.get("page_idx", -1)
        prev_zone = str(prev_item.get("layout_zone", "") or "")
        next_zone = str(next_item.get("layout_zone", "") or "")
        prev_role = str(prev_item.get("layout_boundary_role", "") or "")
        next_role = str(next_item.get("layout_boundary_role", "") or "")

        if prev_page != next_page:
            boundary_pairs.append(pair)
            continue
        if prev_zone != next_zone:
            boundary_pairs.append(pair)
            continue
        if _is_boundary_role(prev_role) or _is_boundary_role(next_role):
            boundary_pairs.append(pair)
    return boundary_pairs


def review_candidate_continuation_pairs(
    *,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
    save_pages_fn,
    batch_size: int = 24,
) -> int:
    flat_payload = [item for page_idx in sorted(page_payloads) for item in page_payloads[page_idx]]
    pairs = candidate_continuation_pairs(flat_payload)
    boundary_pairs = _filter_boundary_candidate_pairs(flat_payload, pairs)
    if pairs and len(boundary_pairs) != len(pairs):
        print(f"book: continuation review filtered {len(pairs)} -> {len(boundary_pairs)} boundary pairs", flush=True)
    if not boundary_pairs:
        finalize_orchestration_metadata_by_page(page_payloads)
        return 0
    auto_join_pairs, review_pairs = _split_high_confidence_continuation_pairs(flat_payload, boundary_pairs)
    if auto_join_pairs or len(review_pairs) != len(boundary_pairs):
        print(
            f"book: continuation review short-circuit auto_join={len(auto_join_pairs)} "
            f"skip_review={len(boundary_pairs) - len(review_pairs) - len(auto_join_pairs)} "
            f"remaining_review={len(review_pairs)}",
            flush=True,
        )
    if not review_pairs:
        applied = apply_candidate_pair_joins(flat_payload, auto_join_pairs)
        annotate_layout_zones_by_page(page_payloads)
        finalize_orchestration_metadata_by_page(page_payloads)
        if applied:
            save_pages_fn(page_payloads, translation_paths)
            print(f"book: continuation review approved={applied} items from auto-joined pairs={len(auto_join_pairs)}", flush=True)
        return applied

    def chunked(seq: list[dict], size: int) -> list[list[dict]]:
        return [seq[i : i + size] for i in range(0, len(seq), size)]

    batches = chunked(review_pairs, max(1, batch_size))
    approved: list[tuple[str, str]] = list(auto_join_pairs)

    def _run_review(batch_pairs: list[dict], index: int) -> list[tuple[str, str]]:
        labeled_pairs = []
        for offset, pair in enumerate(batch_pairs, start=1):
            pair = dict(pair)
            pair["pair_id"] = f"pair-{index:03d}-{offset:03d}"
            labeled_pairs.append(pair)
        reviewed = review_candidate_pairs(
            labeled_pairs,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=f"continuation-review {index}/{len(batches)}",
        )
        pair_map = {pair["pair_id"]: pair for pair in labeled_pairs}
        return [
            (pair_map[pair_id]["prev_item_id"], pair_map[pair_id]["next_item_id"])
            for pair_id, decision in reviewed.items()
            if decision == "join" and pair_id in pair_map
        ]

    if workers <= 1 or len(batches) == 1:
        for index, batch in enumerate(batches, start=1):
            approved.extend(_run_review(batch, index))
    else:
        with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
            futures = {
                executor.submit(_run_review, batch, index): index
                for index, batch in enumerate(batches, start=1)
            }
            for future in as_completed(futures):
                approved.extend(future.result())

    applied = apply_candidate_pair_joins(flat_payload, approved)
    annotate_layout_zones_by_page(page_payloads)
    finalize_orchestration_metadata_by_page(page_payloads)
    if applied:
        save_pages_fn(page_payloads, translation_paths)
        print(f"book: continuation review approved={applied} items from pairs={len(approved)}", flush=True)
    return applied


def _split_high_confidence_continuation_pairs(
    flat_payload: list[dict],
    pairs: list[dict],
) -> tuple[list[tuple[str, str]], list[dict]]:
    item_by_id = {str(item.get("item_id", "") or ""): item for item in flat_payload}
    auto_join: list[tuple[str, str]] = []
    needs_review: list[dict] = []
    for pair in pairs:
        prev_item = item_by_id.get(str(pair.get("prev_item_id", "") or ""))
        next_item = item_by_id.get(str(pair.get("next_item_id", "") or ""))
        if not prev_item or not next_item:
            continue
        join_score = pair_join_score(prev_item, next_item)
        break_score = pair_break_score(prev_item, next_item)
        if join_score >= 7 and join_score >= break_score + 4:
            auto_join.append((str(pair.get("prev_item_id", "")), str(pair.get("next_item_id", ""))))
            continue
        if break_score >= 6 and break_score >= join_score + 3:
            continue
        needs_review.append(pair)
    return auto_join, needs_review
