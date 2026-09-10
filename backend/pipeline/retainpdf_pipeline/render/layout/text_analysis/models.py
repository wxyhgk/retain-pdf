from __future__ import annotations

from dataclasses import dataclass

from retainpdf_pipeline.render.layout.text_tokens import TextToken
from retainpdf_pipeline.render.layout.text_tokens import TextTokenKind


@dataclass(frozen=True)
class TextSegment:
    value: str
    start: int
    end: int


@dataclass(frozen=True)
class FormulaSegment:
    kind: TextTokenKind
    value: str
    body: str
    start: int
    end: int


@dataclass(frozen=True)
class TextAnalysisStats:
    word_count: int
    zh_char_count: int
    formula_count: int
    raw_math_count: int
    latex_command_count: int
    placeholder_count: int
    protected_formula_count: int


@dataclass(frozen=True)
class AnalyzedText:
    source: str
    tokens: tuple[TextToken, ...]
    plain_text: str
    plain_segments: tuple[TextSegment, ...]
    formula_segments: tuple[FormulaSegment, ...]
    inline_math_segments: tuple[FormulaSegment, ...]
    display_math_segments: tuple[FormulaSegment, ...]
    stats: TextAnalysisStats
    has_complex_inline_math: bool
    formula_visible_units: float

    @property
    def word_count(self) -> int:
        return self.stats.word_count

    @property
    def zh_char_count(self) -> int:
        return self.stats.zh_char_count

    @property
    def formula_count(self) -> int:
        return self.stats.formula_count

    @property
    def raw_math_count(self) -> int:
        return self.stats.raw_math_count

    @property
    def latex_command_count(self) -> int:
        return self.stats.latex_command_count

    @property
    def placeholder_count(self) -> int:
        return self.stats.placeholder_count

    @property
    def protected_formula_count(self) -> int:
        return self.stats.protected_formula_count

    @property
    def has_display_math(self) -> bool:
        return bool(self.display_math_segments)

    @property
    def has_inline_math(self) -> bool:
        return bool(self.inline_math_segments)
