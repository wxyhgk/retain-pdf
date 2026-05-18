from __future__ import annotations

import fitz

from services.rendering.source.cleanup.empty_result import new_empty_redaction_result
from services.rendering.source.cleanup.plan_builder import build_redaction_plan
from services.rendering.source.cleanup.routes import apply_redaction_route


def execute_redaction_flow(
    page: fitz.Page,
    translated_items: list[dict],
    *,
    fill_background: bool | None = None,
    cover_only: bool = False,
    strategy: str | None = None,
) -> dict[str, object]:
    plan = build_redaction_plan(page, translated_items)
    valid_items = plan.valid_items
    if not valid_items:
        return new_empty_redaction_result(strategy)

    return apply_redaction_route(
        page,
        valid_items,
        fill_background=fill_background,
        cover_only=cover_only,
        strategy=strategy,
        plan=plan,
    )
