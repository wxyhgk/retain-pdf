from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Callable

from retainpdf_translation.core.orchestration.units import finalize_orchestration_metadata_by_page
from retainpdf_translation.llm.shared import upstream_resilience as _resilience
from retainpdf_translation.llm.shared.executor_context import execution_enabled
from retainpdf_translation.core.orchestration.units import finalize_payload_orchestration_metadata
from retainpdf_translation.core.orchestration.zones import annotate_payload_layout_zones
from retainpdf_translation.services.continuation.pairs import apply_candidate_pair_joins
from retainpdf_translation.services.continuation.pairs import candidate_continuation_pairs
from retainpdf_translation.services.continuation.review import review_candidate_pairs
from retainpdf_translation.services.continuation.rules import is_reading_boundary_cross_column_pair
from retainpdf_translation.services.continuation.rules import pair_break_score
from retainpdf_translation.services.continuation.rules import pair_join_score


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
        if bool(prev_item.get("provider_body_repair_applied")) or bool(next_item.get("provider_body_repair_applied")):
            continue

        if prev_page != next_page:
            boundary_pairs.append(pair)
            continue
        if prev_zone != next_zone:
            if is_reading_boundary_cross_column_pair(prev_item, next_item) or pair_join_score(prev_item, next_item) >= 0:
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
    request_chat_content_fn: Callable[..., str],
    progress_callback: Callable[[int, int], None] | None = None,
    review_memo: dict[tuple[str, str], bool] | None = None,
    on_batch_decided: Callable[[dict[tuple[str, str], bool]], None] | None = None,
) -> int:
    """`review_memo`：（前块, 后块）→ 模型判没判连上。OCR 和翻译并行时每来一批页都要在已知的页上重算一遍
    （规则那一遍会清掉上一轮的拼接），判过的对直接用记下的结论，只把新出现的对交给模型（`workflow/streaming_flow.py`）。

    `on_batch_decided(review_memo)`：每判完一批、memo 有了新结论就调一次，调用方在这里落盘。"""
    flat_payload = [item for page_idx in sorted(page_payloads) for item in page_payloads[page_idx]]
    pairs = candidate_continuation_pairs(flat_payload)
    boundary_pairs = _filter_boundary_candidate_pairs(flat_payload, pairs)
    if pairs and len(boundary_pairs) != len(pairs):
        print(f"book: continuation review filtered {len(pairs)} -> {len(boundary_pairs)} boundary pairs", flush=True)
    if not boundary_pairs:
        finalize_orchestration_metadata_by_page(page_payloads)
        return 0
    auto_join_pairs, review_pairs = _split_high_confidence_continuation_pairs(flat_payload, boundary_pairs)
    if review_memo is not None:
        remembered = [pair for pair in review_pairs if _pair_key(pair) in review_memo]
        auto_join_pairs = [*auto_join_pairs, *(_pair_key(pair) for pair in remembered if review_memo[_pair_key(pair)])]
        review_pairs = [pair for pair in review_pairs if _pair_key(pair) not in review_memo]
        if remembered:
            print(f"book: continuation review reused={len(remembered)} decided pairs", flush=True)
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

    def _run_review(batch_pairs: list[dict], index: int) -> dict[tuple[str, str], bool]:
        """返回这一批模型明确判过的对（连 / 不连）。解析不了的对不在里面：不能记成「不连」，下次照旧交给模型。"""
        labeled_pairs = []
        for offset, pair in enumerate(batch_pairs, start=1):
            pair = dict(pair)
            pair["pair_id"] = f"pair-{index:03d}-{offset:03d}"
            labeled_pairs.append(pair)
        request_label = f"continuation-review {index}/{len(batches)}"
        try:
            reviewed = review_candidate_pairs(
                labeled_pairs,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                request_chat_content_fn=request_chat_content_fn,
            )
        except Exception as exc:  # noqa: BLE001 - 只放过暂时性错误，其余照旧往外抛
            if not _review_failure_is_advisory(exc):
                raise
            # 复核只是顾问：一批碰上暂时性上游错误（重试已用完）时，这一批的候选对维持规则那一遍的结论（不连），
            # 也不记进 memo，下次照旧交给模型；别的批付钱判出的结论照常生效（2026-11-26，S11）
            print(
                f"{request_label}: continuation review gave up after transient upstream errors, "
                f"keeping rule decisions for {len(labeled_pairs)} pairs: {type(exc).__name__}: {exc}",
                flush=True,
            )
            return {}
        pair_map = {pair["pair_id"]: pair for pair in labeled_pairs}
        return {
            _pair_key(pair_map[pair_id]): decision == "join"
            for pair_id, decision in reviewed.items()
            if pair_id in pair_map
        }

    def _record(batch_decided: dict[tuple[str, str], bool]) -> None:
        """每判完一批就记下来：连上的进 approved，结论进 memo 并当场落盘（不等全部批做完）。"""
        approved.extend(key for key, join in batch_decided.items() if join)
        if review_memo is not None and batch_decided:
            review_memo.update(batch_decided)
            if on_batch_decided is not None:
                on_batch_decided(review_memo)

    completed_batches = 0
    if workers <= 1 or len(batches) == 1:
        for index, batch in enumerate(batches, start=1):
            _record(_run_review(batch, index))
            completed_batches += 1
            if progress_callback is not None:
                progress_callback(completed_batches, len(batches))
    else:
        first_error: BaseException | None = None
        with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
            futures = {
                executor.submit(_run_review, batch, index): index
                for index, batch in enumerate(batches, start=1)
            }
            for future in as_completed(futures):
                try:
                    batch_decided = future.result()
                except Exception as exc:  # noqa: BLE001 - 先把其余已在跑的批收完、记下，再抛第一个错
                    if first_error is None:
                        first_error = exc
                        for pending in futures:
                            pending.cancel()
                    continue
                # 出错以后还在跑的批照样付了钱，结论照样记下（只是不再拼接，整本照旧失败）
                _record(batch_decided)
                completed_batches += 1
                if progress_callback is not None and first_error is None:
                    progress_callback(completed_batches, len(batches))
        if first_error is not None:
            raise first_error

    applied = apply_candidate_pair_joins(flat_payload, approved)
    annotate_layout_zones_by_page(page_payloads)
    finalize_orchestration_metadata_by_page(page_payloads)
    if applied:
        save_pages_fn(page_payloads, translation_paths)
        print(f"book: continuation review approved={applied} items from pairs={len(approved)}", flush=True)
    return applied


def _review_failure_is_advisory(exc: BaseException) -> bool:
    """这一批的失败能不能只当「这一批没判」：暂时性上游错误（超时、429、5xx、连接断开，重试已用完）可以。
    余额、Key、权限这类不重试的错照旧往外抛；走 Rust 模型执行器时，失败记在执行器里、整本都会停，也照旧往外抛。"""
    if execution_enabled():
        return False
    if _resilience.is_non_retryable_client_error(exc):
        return False
    return _resilience.is_transient_upstream_error(exc)


def _pair_key(pair: dict) -> tuple[str, str]:
    return (str(pair.get("prev_item_id", "") or ""), str(pair.get("next_item_id", "") or ""))


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
