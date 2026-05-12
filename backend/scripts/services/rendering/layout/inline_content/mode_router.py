from __future__ import annotations

from services.rendering.layout.inline_content.core.markdown import build_direct_typst_passthrough_text
from services.rendering.layout.inline_content.fallback.placeholder_markdown import build_markdown_from_parts


DEFAULT_RENDER_MATH_MODE = "placeholder"
DIRECT_TYPST_MATH_MODE = "direct_typst"


def item_render_math_mode(item: dict) -> str:
    return str(item.get("math_mode", DEFAULT_RENDER_MATH_MODE) or DEFAULT_RENDER_MATH_MODE).strip() or DEFAULT_RENDER_MATH_MODE


def is_direct_typst_math_mode(item: dict) -> bool:
    return item_render_math_mode(item) == DIRECT_TYPST_MATH_MODE


def build_render_markdown(
    protected_text: str,
    formula_map: list[dict],
    *,
    math_mode: str,
) -> str:
    normalized_mode = str(math_mode or DEFAULT_RENDER_MATH_MODE).strip() or DEFAULT_RENDER_MATH_MODE
    if normalized_mode == DIRECT_TYPST_MATH_MODE:
        return build_direct_typst_passthrough_text(protected_text)
    return build_markdown_from_parts(
        protected_text,
        formula_map,
    )


def build_item_render_markdown(
    item: dict,
    protected_text: str,
    formula_map: list[dict],
) -> str:
    return build_render_markdown(
        protected_text,
        formula_map,
        math_mode=item_render_math_mode(item),
    )
