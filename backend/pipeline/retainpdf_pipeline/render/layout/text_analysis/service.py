from __future__ import annotations

from collections.abc import Callable
from functools import lru_cache
import re

from retainpdf_pipeline.render.layout.text_analysis.models import AnalyzedText
from retainpdf_pipeline.render.layout.text_analysis.models import FormulaSegment
from retainpdf_pipeline.render.layout.text_analysis.models import TextAnalysisStats
from retainpdf_pipeline.render.layout.text_analysis.models import TextSegment
from retainpdf_pipeline.render.layout.text_tokens import FORMULA_TOKEN_KINDS
from retainpdf_pipeline.render.layout.text_tokens import RAW_MATH_TOKEN_KINDS
from retainpdf_pipeline.render.layout.text_tokens import TextToken
from retainpdf_pipeline.render.layout.text_tokens import TextTokenKind
from retainpdf_pipeline.render.layout.text_tokens import classify_token_value
from retainpdf_pipeline.render.layout.text_tokens import iter_text_tokens
from retainpdf_pipeline.render.layout.text_tokens import math_token_body as _math_token_body


COMPLEX_INLINE_MATH_RE = re.compile(
    r"\\(?:sqrt|frac|dfrac|tfrac|cfrac|sum|prod|int|iint|iiint|oint|lim|left|right|begin|overline|underline|underbrace|overbrace|widehat|widetilde|binom|choose|substack|cases|matrix|pmatrix|bmatrix|vmatrix)\b"
)
LATEX_COMMAND_RE = re.compile(r"\\[A-Za-z]+")


def analyze_text(text: str) -> AnalyzedText:
    source = str(text or "")
    return _analyze_text_cached(source)


@lru_cache(maxsize=8192)
def _analyze_text_cached(source: str) -> AnalyzedText:
    tokens = tuple(iter_text_tokens(source))
    plain_segments = _plain_segments(tokens)
    formula_segments = tuple(_formula_segments(tokens))
    inline_segments = tuple(
        segment for segment in formula_segments if segment.kind == TextTokenKind.INLINE_MATH
    )
    display_segments = tuple(
        segment for segment in formula_segments if segment.kind == TextTokenKind.DISPLAY_MATH
    )
    stats = TextAnalysisStats(
        word_count=sum(1 for token in tokens if token.kind == TextTokenKind.WORD),
        zh_char_count=sum(1 for token in tokens if token.kind == TextTokenKind.ZH_CHAR),
        formula_count=len(formula_segments),
        raw_math_count=sum(1 for token in tokens if token.kind in RAW_MATH_TOKEN_KINDS),
        latex_command_count=len(LATEX_COMMAND_RE.findall(source)),
        placeholder_count=sum(1 for token in tokens if token.kind == TextTokenKind.FORMULA_PLACEHOLDER),
        protected_formula_count=sum(1 for token in tokens if token.kind == TextTokenKind.PROTECTED_FORMULA),
    )
    return AnalyzedText(
        source=source,
        tokens=tokens,
        plain_text="".join(segment.value for segment in plain_segments),
        plain_segments=plain_segments,
        formula_segments=formula_segments,
        inline_math_segments=inline_segments,
        display_math_segments=display_segments,
        stats=stats,
        has_complex_inline_math=any(_is_complex_inline_math(segment.body) for segment in inline_segments),
        formula_visible_units=sum(_formula_visible_units(segment.body) for segment in formula_segments),
    )


def analyze_render_item_text(item: dict) -> dict[str, AnalyzedText]:
    return {
        "render": analyze_text(str(item.get("render_protected_text") or "")),
        "source": analyze_text(str(item.get("render_source_text") or item.get("protected_source_text") or item.get("source_text") or "")),
    }


def tokenize_text(text: str) -> list[str]:
    return [token.value for token in analyze_text(text).tokens]


def tokenize_direct_math_text(text: str) -> list[str]:
    return [token.value for token in analyze_text(text).tokens if token.value]


def strip_formula_tokens(text: str, *, replacement: str = " ") -> str:
    return "".join(
        replacement if token.kind in FORMULA_TOKEN_KINDS else token.value
        for token in analyze_text(text).tokens
    )


def replace_non_formula_segments(text: str, replacer: Callable[[str], str]) -> str:
    chunks: list[str] = []
    plain: list[str] = []
    for token in analyze_text(text).tokens:
        if token.kind in RAW_MATH_TOKEN_KINDS:
            if plain:
                chunks.append(replacer("".join(plain)))
                plain.clear()
            chunks.append(token.value)
            continue
        plain.append(token.value)
    if plain:
        chunks.append(replacer("".join(plain)))
    return "".join(chunks)


def is_formula_token(token: str) -> bool:
    return classify_token_value(token) in FORMULA_TOKEN_KINDS


def math_token_body(token: TextToken | FormulaSegment | str) -> str:
    if isinstance(token, FormulaSegment):
        return token.body
    return _math_token_body(token)


def inline_math_segments(text: str) -> list[str]:
    return [segment.body for segment in analyze_text(text).inline_math_segments]


def normalize_direct_typst_math_boundaries(text: str) -> str:
    source = str(text or "")
    if not source:
        return ""
    return _wrap_parenthesized_inline_math(source)


def formula_texts_for_render(text: str, formula_map: list[dict] | None) -> list[str]:
    formulas = [
        str(entry.get("formula_text") or entry.get("latex") or "").strip()
        for entry in formula_map or []
        if isinstance(entry, dict)
    ]
    formulas.extend(segment.body for segment in analyze_text(str(text or "")).formula_segments)
    return [formula for formula in formulas if formula]


def _formula_segments(tokens: tuple[TextToken, ...]) -> list[FormulaSegment]:
    return [
        FormulaSegment(
            kind=token.kind,
            value=token.value,
            body=_math_token_body(token),
            start=token.start,
            end=token.end,
        )
        for token in tokens
        if token.kind in FORMULA_TOKEN_KINDS
    ]


def _plain_segments(tokens: tuple[TextToken, ...]) -> tuple[TextSegment, ...]:
    segments: list[TextSegment] = []
    current: list[str] = []
    start = 0
    end = 0
    for token in tokens:
        if token.kind in FORMULA_TOKEN_KINDS:
            if current:
                segments.append(TextSegment("".join(current), start, end))
                current.clear()
            continue
        if not current:
            start = token.start
        current.append(token.value)
        end = token.end
    if current:
        segments.append(TextSegment("".join(current), start, end))
    return tuple(segments)


def _formula_visible_units(formula_text: str) -> float:
    compact = re.sub(r"\\[A-Za-z]+|[{}\s]", "", formula_text or "")
    return max(0.0, len(compact) * 0.42)


def _is_complex_inline_math(formula_text: str) -> bool:
    expr = formula_text or ""
    if COMPLEX_INLINE_MATH_RE.search(expr):
        return True
    if len(expr) >= 48 and LATEX_COMMAND_RE.search(expr):
        return True
    return ("_" in expr or "^" in expr) and LATEX_COMMAND_RE.search(expr)


def _wrap_parenthesized_inline_math(source: str) -> str:
    chunks: list[str] = []
    cursor = 0
    tokens = analyze_text(source).tokens
    for token in tokens:
        if token.kind != TextTokenKind.INLINE_MATH:
            continue
        while cursor < token.start:
            chunks.append(source[cursor])
            cursor += 1
        open_index = token.start - 1
        while open_index >= 0 and source[open_index].isspace():
            open_index -= 1
        close_index = token.end
        while close_index < len(source) and source[close_index].isspace():
            close_index += 1
        if (
            open_index >= 0
            and close_index < len(source)
            and source[open_index] == "("
            and source[close_index] == ")"
        ):
            expr = math_token_body(token).strip()
            while len(chunks) > 0 and cursor > open_index:
                chunks.pop()
                cursor -= 1
            chunks.append(f"$({expr})$")
            cursor = close_index + 1
            continue
        chunks.append(token.value)
        cursor = token.end
    chunks.append(source[cursor:])
    return "".join(chunks)
