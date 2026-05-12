from __future__ import annotations

from lxml import etree

from backend.scripts.devtools.word_export.math_omml import MathRegistry
from backend.scripts.devtools.word_export.math_omml import iter_marked_text
from backend.scripts.devtools.word_export.math_omml import mark_math_tokens
from backend.scripts.devtools.word_export.math_omml import omml_math_from_latex


def _xml(node) -> str:
    return etree.tostring(node, encoding="unicode")


def test_math_registry_marks_inline_and_display_math() -> None:
    registry = MathRegistry()

    text = mark_math_tokens("A $x^2$ B $$\\frac{a}{b}$$", registry)

    assert text == "A @@MATH:INLINE:0@@ B @@MATH:DISPLAY:1@@"
    assert list(iter_marked_text(text)) == [
        ("text", "A "),
        ("math", "@@MATH:INLINE:0@@"),
        ("text", " B "),
        ("math", "@@MATH:DISPLAY:1@@"),
    ]
    assert registry.get("@@MATH:INLINE:0@@").source == "x^2"
    assert registry.get("@@MATH:DISPLAY:1@@").source == "\\frac{a}{b}"


def test_omml_renderer_builds_common_formula_structures() -> None:
    xml = _xml(omml_math_from_latex("\\frac{x_1}{\\sqrt{y^2}}", font_family="SimSun"))

    assert "<m:oMath" in xml
    assert "<m:f>" in xml
    assert "<m:sSub>" in xml
    assert "<m:rad>" in xml
    assert "<m:sSup>" in xml
    assert "SimSun" in xml
