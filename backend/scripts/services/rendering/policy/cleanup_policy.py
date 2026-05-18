from __future__ import annotations

import fitz

from foundation.config import layout
from services.rendering.policy.geometry import item_rect
from services.rendering.policy.geometry import x_overlap_ratio
from services.rendering.policy.models import RenderItemPolicy
from services.rendering.policy.models import RenderPagePolicy
from services.translation.item_reader import item_block_kind


FORMULA_NEIGHBOR_X_OVERLAP_RATIO = 0.18
FORMULA_NEIGHBOR_MAX_GAP_PT = 72.0


def item_has_formula_region(item: dict) -> bool:
    normalized_sub_type = str(item.get("normalized_sub_type") or "").strip().lower()
    raw_block_type = str(item.get("raw_block_type") or "").strip().lower()
    block_type = str(item.get("block_type") or "").strip().lower()
    return (
        item_block_kind(item) == "formula"
        or block_type == "formula"
        or raw_block_type == "display_formula"
        or normalized_sub_type == "display_formula"
    )


def page_has_formula_region(translated_items: list[dict]) -> bool:
    return any(item_has_formula_region(item) and item_rect(item) is not None for item in translated_items)


def page_should_skip_bbox_text_strip(translated_items: list[dict]) -> bool:
    return page_has_formula_region(translated_items)


def formula_neighbor_text_item_ids(translated_items: list[dict]) -> set[str]:
    formula_rects = _page_formula_rects(translated_items)
    if not formula_rects:
        return set()
    return _formula_neighbor_text_item_ids(formula_rects, translated_items)


def build_render_page_policy(translated_items: list[dict]) -> RenderPagePolicy:
    if layout.use_typst_fill_cleanup():
        return _build_typst_fill_page_policy(translated_items)
    has_formula = page_has_formula_region(translated_items)
    neighbor_ids = formula_neighbor_text_item_ids(translated_items) if has_formula else set()
    policies: dict[str, RenderItemPolicy] = {}
    for item in translated_items:
        item_id = str(item.get("item_id") or "").strip()
        if not item_id:
            continue
        if item_id in neighbor_ids:
            policies[item_id] = RenderItemPolicy(
                item_id=item_id,
                cleanup_mode="visual_cover",
                overlay_fill="white",
                formula_protection_role="neighbor",
                reason="display_formula_neighbor",
            )
        elif has_formula and item_block_kind(item) == "text":
            policies[item_id] = RenderItemPolicy(
                item_id=item_id,
                cleanup_mode="visual_cover",
                overlay_fill="white",
                formula_protection_role="page",
                reason="display_formula_page",
            )
    return RenderPagePolicy(
        page_has_formula_region=has_formula,
        item_policies=policies,
    )


def _build_typst_fill_page_policy(translated_items: list[dict]) -> RenderPagePolicy:
    policies: dict[str, RenderItemPolicy] = {}
    neighbor_ids = formula_neighbor_text_item_ids(translated_items) if page_has_formula_region(translated_items) else set()
    for item in translated_items:
        item_id = str(item.get("item_id") or "").strip()
        if not item_id or item_block_kind(item) != "text":
            continue
        if item_id in neighbor_ids:
            policies[item_id] = RenderItemPolicy(
                item_id=item_id,
                cleanup_mode="visual_cover",
                overlay_fill="white",
                formula_protection_role="neighbor",
                reason="display_formula_neighbor",
            )
            continue
        policies[item_id] = RenderItemPolicy(
            item_id=item_id,
            cleanup_mode="visual_cover",
            overlay_fill="white",
            reason="typst_fill_default",
        )
    return RenderPagePolicy(
        page_has_formula_region=page_has_formula_region(translated_items),
        item_policies=policies,
    )


def apply_render_page_policy_fields(translated_items: list[dict]) -> list[dict]:
    policy = build_render_page_policy(translated_items)
    if not policy.item_policies:
        return translated_items
    patched: list[dict] = []
    for item in translated_items:
        item_id = str(item.get("item_id") or "").strip()
        item_policy = policy.item_policies.get(item_id)
        if item_policy is None:
            patched.append(item)
            continue
        patched.append(apply_render_item_policy_fields(item, item_policy))
    return patched


def apply_render_pages_policy_fields(translated_pages: dict[int, list[dict]]) -> dict[int, list[dict]]:
    return {
        page_idx: apply_render_page_policy_fields(items)
        for page_idx, items in translated_pages.items()
    }


def apply_typst_cover_fallback_fields(
    translated_pages: dict[int, list[dict]],
    page_indices: frozenset[int],
) -> dict[int, list[dict]]:
    if not page_indices:
        return translated_pages
    patched_pages: dict[int, list[dict]] = {}
    for page_idx, items in translated_pages.items():
        if page_idx not in page_indices:
            patched_pages[page_idx] = items
            continue
        patched_items: list[dict] = []
        for item in items:
            if item_block_kind(item) == "text":
                patched_items.append(
                    apply_render_item_policy_fields(
                        item,
                        RenderItemPolicy(
                            item_id=str(item.get("item_id") or ""),
                            overlay_fill="white",
                            reason="typst_cover_fallback",
                        ),
                    )
                )
            else:
                patched_items.append(item)
        patched_pages[page_idx] = patched_items
    return patched_pages


def apply_render_item_policy_fields(item: dict, item_policy: RenderItemPolicy) -> dict:
    patched_item = dict(item)
    patched_item["_render_policy"] = item_policy.to_payload()
    return patched_item


def item_has_render_source_or_output_text(item: dict) -> bool:
    return bool(item_render_output_text(item) or item_render_source_text(item))


def item_render_output_text(item: dict) -> str:
    return str(
        item.get("protected_translated_text")
        or item.get("translated_text")
        or item.get("render_text")
        or ""
    ).strip()


def item_render_source_text(item: dict) -> str:
    return str(
        item.get("translation_unit_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    ).strip()


def item_should_bbox_text_strip(item: dict, *, skip_item_ids: set[str] | None = None) -> bool:
    if skip_item_ids and str(item.get("item_id") or "").strip() in skip_item_ids:
        return False
    return item_block_kind(item) == "text" and item_has_render_source_or_output_text(item)


def _page_formula_rects(items: list[dict]) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    for item in items:
        if not item_has_formula_region(item):
            continue
        rect = item_rect(item)
        if rect is not None:
            rects.append(rect)
    return rects


def _formula_neighbor_text_item_ids(formula_rects: list[fitz.Rect], items: list[dict]) -> set[str]:
    text_entries: list[tuple[str, fitz.Rect]] = []
    for item in items:
        if item_block_kind(item) != "text":
            continue
        item_id = str(item.get("item_id") or "").strip()
        if not item_id:
            continue
        rect = item_rect(item)
        if rect is not None:
            text_entries.append((item_id, rect))
    if not text_entries:
        return set()

    neighbor_ids: set[str] = set()
    for formula in formula_rects:
        same_column = [
            (item_id, rect)
            for item_id, rect in text_entries
            if x_overlap_ratio(rect, formula) >= FORMULA_NEIGHBOR_X_OVERLAP_RATIO
        ]
        above = [
            (item_id, rect)
            for item_id, rect in same_column
            if rect.y1 <= formula.y0 and formula.y0 - rect.y1 <= FORMULA_NEIGHBOR_MAX_GAP_PT
        ]
        below = [
            (item_id, rect)
            for item_id, rect in same_column
            if rect.y0 >= formula.y1 and rect.y0 - formula.y1 <= FORMULA_NEIGHBOR_MAX_GAP_PT
        ]
        neighbor_ids.update(item_id for item_id, rect in same_column if not (rect & formula).is_empty)
        if above:
            neighbor_ids.add(max(above, key=lambda entry: entry[1].y1)[0])
        if below:
            neighbor_ids.add(min(below, key=lambda entry: entry[1].y0)[0])
    return neighbor_ids
