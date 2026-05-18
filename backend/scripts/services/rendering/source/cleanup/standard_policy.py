from __future__ import annotations

from services.rendering.layout.inline_content.complexity import item_has_complex_inline_math
from services.rendering.policy import build_cleanup_item_plan
from services.rendering.source.cleanup.standard_thresholds import ITEM_REMOVABLE_RECTS_FAST_COVER_THRESHOLD
from services.rendering.source.cleanup.standard_thresholds import PAGE_AVG_REMOVABLE_RECTS_FAST_COVER_THRESHOLD
from services.rendering.source.cleanup.standard_thresholds import PAGE_ITEM_REMOVABLE_RECTS_FAST_COVER_COUNT
from services.rendering.source.cleanup.standard_thresholds import PAGE_REMOVABLE_RECTS_FAST_COVER_THRESHOLD


def should_force_bbox_redaction(item: dict) -> bool:
    return bool(item.get("continuation_group"))


def should_force_visual_cover(item: dict) -> bool:
    if build_cleanup_item_plan(item).visual_cover_only:
        return True
    return item_has_complex_inline_math(item)


def should_use_fast_page_cover_for_removable_counts(removable_counts: list[int]) -> bool:
    if not removable_counts:
        return False
    total_raw_rects = sum(removable_counts)
    avg_raw_rects = total_raw_rects / max(len(removable_counts), 1)
    large_item_count = len(
        [count for count in removable_counts if count >= ITEM_REMOVABLE_RECTS_FAST_COVER_THRESHOLD]
    )
    return (
        total_raw_rects >= PAGE_REMOVABLE_RECTS_FAST_COVER_THRESHOLD
        or avg_raw_rects >= PAGE_AVG_REMOVABLE_RECTS_FAST_COVER_THRESHOLD
        or large_item_count >= PAGE_ITEM_REMOVABLE_RECTS_FAST_COVER_COUNT
    )
