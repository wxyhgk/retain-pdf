from __future__ import annotations

import re


DISPLAY_MATH_MARKERS = (
    "$$",
    "\\[",
    "\\]",
    "\\begin{equation",
    "\\begin{align",
    "\\begin{gather",
    "\\begin{multline",
)
FORMULA_SPAN_TYPES = frozenset(
    {
        "formula",
        "math",
        "inline_formula",
        "display_formula",
    }
)


def item_has_unresolved_embedded_formula(item: dict) -> bool:
    return source_text_has_display_math(item_source_text(item)) or lines_have_formula_spans(item)


def source_text_has_display_math(text: str) -> bool:
    if not text:
        return False
    return any(marker in text for marker in DISPLAY_MATH_MARKERS) or any(
        line_is_standalone_math(line)
        for line in text.splitlines()
    )


def line_is_standalone_math(line: str) -> bool:
    stripped = line.strip()
    if len(stripped) < 3 or not stripped.startswith("$") or not stripped.endswith("$"):
        return False
    words = re.findall(r"[A-Za-z]{3,}", stripped)
    return len(words) <= 2


def lines_have_formula_spans(item: dict) -> bool:
    lines = item.get("lines")
    if not isinstance(lines, list):
        return False
    return any(line_has_formula_role(line) for line in lines if isinstance(line, dict))


def line_has_formula_role(line: dict) -> bool:
    if value_is_formula_role(line.get("type") or line.get("kind") or line.get("role")):
        return True
    spans = line.get("spans")
    if not isinstance(spans, list):
        return False
    return any(span_has_formula_role(span) for span in spans if isinstance(span, dict))


def span_has_formula_role(span: dict) -> bool:
    return value_is_formula_role(span.get("type") or span.get("kind") or span.get("role"))


def value_is_formula_role(value: object) -> bool:
    return str(value or "").strip().lower() in FORMULA_SPAN_TYPES


def item_source_text(item: dict) -> str:
    return str(
        item.get("source_text")
        or item.get("protected_source_text")
        or item.get("translation_unit_protected_source_text")
        or ""
    )
