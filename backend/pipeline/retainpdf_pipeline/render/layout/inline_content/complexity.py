from __future__ import annotations

import re

from retainpdf_pipeline.render.layout.text_analysis import inline_math_segments as analyzed_inline_math_segments

COMPLEX_INLINE_MATH_RE = re.compile(
    r"\\(?:sqrt|frac|dfrac|tfrac|cfrac|sum|prod|int|iint|iiint|oint|lim|left|right|begin|overline|underline|underbrace|overbrace|widehat|widetilde|binom|choose|substack|cases|matrix|pmatrix|bmatrix|vmatrix)\b"
)


def inline_math_segments(text: str) -> list[str]:
    return analyzed_inline_math_segments(text)


def has_complex_inline_math_text(text: str) -> bool:
    return any(COMPLEX_INLINE_MATH_RE.search(segment) for segment in inline_math_segments(text))


def item_has_complex_inline_math(item: dict) -> bool:
    candidates = (
        item.get("render_protected_text"),
        item.get("translation_unit_protected_translated_text"),
        item.get("protected_translated_text"),
        item.get("translated_text"),
        item.get("translation_unit_protected_source_text"),
        item.get("protected_source_text"),
        item.get("source_text"),
    )
    return any(has_complex_inline_math_text(str(candidate or "")) for candidate in candidates)
