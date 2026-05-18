from __future__ import annotations

from dataclasses import dataclass

from services.rendering.policy.compat import item_requires_visual_cover_only
from services.rendering.policy.compat import item_uses_white_overlay_fill


@dataclass(frozen=True)
class RenderCleanupItemPlan:
    visual_cover_only: bool
    white_overlay_fill: bool
    bbox_text_strip_allowed: bool


def build_cleanup_item_plan(item: dict, *, bbox_text_strip_allowed: bool = True) -> RenderCleanupItemPlan:
    visual_cover_only = item_requires_visual_cover_only(item)
    return RenderCleanupItemPlan(
        visual_cover_only=visual_cover_only,
        white_overlay_fill=item_uses_white_overlay_fill(item),
        bbox_text_strip_allowed=bbox_text_strip_allowed and not visual_cover_only,
    )
