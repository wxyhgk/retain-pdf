from __future__ import annotations

from retainpdf_pipeline.render.layout.inline_content.core.cjk_text import normalize_cjk_markdown
from retainpdf_pipeline.render.layout.inline_content.core.markdown import build_direct_typst_passthrough_text
from retainpdf_pipeline.render.layout.inline_content.fallback.placeholder_markdown import build_markdown_from_parts


# 渲染侧同理:条目上没写 math_mode 时按 direct_typst 处理。placeholder 那条
# 路径靠 LATEX_FORMULA_RE 在无定界符的 OCR 散文里猜公式边界,原理上做不到可靠,
# 生产里也从未启用过。
DEFAULT_RENDER_MATH_MODE = "direct_typst"
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
    # 中文排版的文字规范化（不可断空格、引号、括号……），Typst 和 rpr 引擎两条路线都经过这里
    return normalize_cjk_markdown(build_render_markdown(
        protected_text,
        formula_map,
        math_mode=item_render_math_mode(item),
    ))
