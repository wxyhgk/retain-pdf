from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from retainpdf_pipeline.translate.core.item_reader import item_block_kind
from retainpdf_pipeline.translate.core.item_reader import item_is_bodylike
from retainpdf_pipeline.translate.llm.validation.english_residue import should_force_translate_body_text
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import placeholder_sequence
from retainpdf_pipeline.translate.llm.placeholder_transform import has_formula_placeholders
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.core.payload.parts.common import GROUP_ITEM_PREFIX
from retainpdf_pipeline.translate.core.execution_policy import strategy
from retainpdf_pipeline.translate.workflow.scheduling.optimization import page_local_batches


@dataclass(frozen=True)
class _BatchabilityRule:
    predicate: Callable[[object, TranslationControlContext], bool]


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
    del model, base_url
    configured = max(1, batch_size)
    if translation_context is None:
        return configured
    return max(configured, max(1, translation_context.batch_policy.plain_batch_size))


def _math_mode(item: dict) -> str:
    return str(item.get("math_mode", "placeholder") or "placeholder").strip()


def _is_within_batch_text_size(view, context: TranslationControlContext) -> bool:
    return (
        context.batch_policy.batch_low_risk_min_chars
        <= len(view.compact)
        <= context.batch_policy.batch_low_risk_max_chars
    )


def _has_acceptable_placeholder_count(view, context: TranslationControlContext) -> bool:
    return len(placeholder_sequence(view.source)) <= context.batch_policy.batch_low_risk_max_placeholders


def _has_no_formula_payload(view, _context: TranslationControlContext) -> bool:
    return not (
        view.item.get("formula_map")
        or view.item.get("translation_unit_formula_map")
        or view.item.get("group_formula_map")
        or has_formula_placeholders(view.item)
    )


_LOW_RISK_BATCHABILITY_RULES: tuple[_BatchabilityRule, ...] = (
    _BatchabilityRule(lambda view, _context: not str(view.item.get("continuation_group", "") or "").strip()),
    _BatchabilityRule(lambda view, _context: not str(view.item.get("translation_unit_id", "") or "").startswith(GROUP_ITEM_PREFIX)),
    _BatchabilityRule(lambda view, _context: item_block_kind(view.item) == "text"),
    _BatchabilityRule(lambda view, _context: item_is_bodylike(view.item)),
    _BatchabilityRule(lambda view, _context: should_force_translate_body_text(view.item)),
    _BatchabilityRule(lambda view, _context: bool(view.source.strip())),
    _BatchabilityRule(_has_no_formula_payload),
    _BatchabilityRule(_is_within_batch_text_size),
    _BatchabilityRule(_has_acceptable_placeholder_count),
)


def _is_low_risk_batchable_item(
    item: dict,
    *,
    translation_context: TranslationControlContext | None,
    plan_item_view_fn,
) -> bool:
    if translation_context is None:
        return False
    view = plan_item_view_fn(item)
    return all(rule.predicate(view, translation_context) for rule in _LOW_RISK_BATCHABILITY_RULES)


def _build_translation_batches(
    pending: list[dict],
    *,
    effective_batch_size: int,
    translation_context: TranslationControlContext | None,
    is_fast_path_keep_origin_item_fn,
    fast_path_keep_origin_result_fn,
    plan_item_view_fn,
) -> tuple[list[list[dict]], list[dict[str, dict[str, str]]]]:
    immediate_results: list[dict[str, dict[str, str]]] = []
    batchable: list[dict] = []
    singles: list[dict] = []
    for item in pending:
        should_skip, reason = is_fast_path_keep_origin_item_fn(item)
        if should_skip:
            immediate_results.append(fast_path_keep_origin_result_fn(item, reason))
            continue
        # 批大小 1(批处理退役)时所有条目都走单条路径,不再标记批候选
        if effective_batch_size > 1 and _is_low_risk_batchable_item(
            item,
            translation_context=translation_context,
            plan_item_view_fn=plan_item_view_fn,
        ):
            tagged_item = dict(item)
            tagged_item["_batched_plain_candidate"] = True
            batchable.append(tagged_item)
        else:
            singles.append(item)

    batches: list[list[dict]] = []
    if batchable:
        if strategy() == "page_local_v1":
            batches.extend(page_local_batches(batchable, effective_batch_size, lambda item: plan_item_view_fn(item).source))
        else:
            batches.extend(chunked(batchable, effective_batch_size))
    for item in singles:
        batches.append([item])
    return batches, immediate_results


def _is_batched_fast_batch(batch: list[dict]) -> bool:
    return len(batch) > 1


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
