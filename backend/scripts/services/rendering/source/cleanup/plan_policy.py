from __future__ import annotations

from services.rendering.source.cleanup.plan_types import RedactionPlan
from services.rendering.source.vector_profile import page_is_vector_heavy_count
from services.rendering.source.vector_profile import page_should_use_cover_only
from services.rendering.source.vector_profile import page_should_use_cover_only_count


def page_prefers_cover_only(plan: RedactionPlan) -> bool:
    return page_should_use_cover_only(plan.drawing_rects)


def page_prefers_cover_only_by_count(plan: RedactionPlan) -> bool:
    return page_should_use_cover_only_count(plan.drawing_count)


def page_is_vector_heavy_by_count(plan: RedactionPlan) -> bool:
    return page_is_vector_heavy_count(plan.drawing_count)
