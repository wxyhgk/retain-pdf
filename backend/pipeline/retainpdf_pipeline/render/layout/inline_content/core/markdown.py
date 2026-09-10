import re

from retainpdf_pipeline.render.layout.inline_content.core.inline_math import apply_to_non_math_segments
from retainpdf_pipeline.render.layout.inline_content.core.inline_math import build_direct_typst_passthrough_markdown
from retainpdf_pipeline.render.layout.inline_content.core.inline_math import demote_text_heavy_inline_math
from retainpdf_pipeline.render.layout.inline_content.core.inline_math import escape_markdown_literal_asterisks
from retainpdf_pipeline.render.layout.inline_content.core.inline_math import surround_inline_math_with_spaces
from retainpdf_pipeline.render.layout.inline_content.fallback.latex_normalizer import normalize_formula_for_latex_math
from retainpdf_pipeline.render.layout.text_analysis import analyze_text


def _normalize_text_chunk(text: str) -> str:
    normalized_lines = [re.sub(r"[ \t\r\f\v]+", " ", line).strip() for line in (text or "").strip().split("\n")]
    return "\n".join(line for line in normalized_lines if line)


def _sanitize_existing_inline_math_for_markdown(text: str) -> str:
    chunks: list[str] = []
    analysis = analyze_text(text or "")
    inline_by_start = {segment.start: segment for segment in analysis.inline_math_segments}
    for token in analysis.tokens:
        segment = inline_by_start.get(token.start)
        if segment is None:
            chunks.append(token.value)
            continue
        expr = segment.body
        if not expr:
            chunks.append(token.value)
            continue
        expr = normalize_formula_for_latex_math(expr)
        chunks.append(f"${expr}$")
    return "".join(chunks)


def build_markdown_from_direct_text(
    text: str,
    *,
    normalize_existing_inline_math: bool = False,
) -> str:
    markdown = _normalize_text_chunk(text)
    markdown = demote_text_heavy_inline_math(markdown)
    markdown = apply_to_non_math_segments(markdown, escape_markdown_literal_asterisks)
    if normalize_existing_inline_math:
        markdown = _sanitize_existing_inline_math_for_markdown(markdown)
    markdown = surround_inline_math_with_spaces(markdown)
    markdown = re.sub(
        r"\\textcircled\s*\{\s*\\scriptsize\s*\{\s*\\parallel\s*\}\s*\}",
        r"$\\circ$",
        markdown,
    )
    markdown = re.sub(r"\\textcircled\s*\{\s*\\parallel\s*\}", r"$\\circ$", markdown)
    markdown = re.sub(r"\\textcircled\s*\{\s*\\times\s*\}", r"$\\otimes$", markdown)
    return markdown


def build_markdown_paragraph(item: dict) -> str:
    protected = item.get("protected_translated_text") or item.get("protected_source_text", "")
    from retainpdf_pipeline.render.layout.inline_content.mode_router import build_item_render_markdown

    return build_item_render_markdown(
        item,
        protected,
        item.get("formula_map", []),
    )


def build_direct_typst_passthrough_text(text: str) -> str:
    return build_direct_typst_passthrough_markdown(text or "")


def build_plain_text(item: dict) -> str:
    text = (item.get("translated_text") or item.get("source_text") or "").strip()
    return build_plain_text_from_text(text)


def build_plain_text_from_text(text: str) -> str:
    normalized_lines = [re.sub(r"[ \t\r\f\v]+", " ", line).strip() for line in (text or "").strip().split("\n")]
    return "\n".join(line for line in normalized_lines if line)
