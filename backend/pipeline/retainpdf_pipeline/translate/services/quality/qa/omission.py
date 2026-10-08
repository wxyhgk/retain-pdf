"""漏译疑点：句数 + 长度比的粗筛，按整组比。

阈值刻意放得很保守，只抓「明显少了一截」的单元；所有阈值原样写进报告元数据。
长度只算叙述文字：原文是英文单词（≥2 个字母、不含 LaTeX 命令名）的字母数，译文是汉字数加英文单词字母数；
公式（$…$ 里的，以及 OCR 没包进 $ 的裸 LaTeX）、数字、单字母变量都不计。英译中科技文一般在 0.3–0.6 之间。

- 长度比 < LENGTH_RATIO_MAJOR（且原文至少 MIN_SOURCE_CHARS 个可见字符）→ major 疑点；
- 长度比 < LENGTH_RATIO_CRITICAL（且原文至少 CRITICAL_MIN_SOURCE_CHARS）→ critical（基本等于没译）；
- 原文 ≥ MIN_SOURCE_SENTENCES 句、译文句数 ≤ 原文一半且少了至少 2 句，同时长度比 < SENTENCE_RATIO_GUARD
  → major 疑点（单看句数会误伤合并长句的正常译法，所以必须同时偏短）。
"""
from __future__ import annotations

import re

from retainpdf_pipeline.translate.services.quality.qa.models import QaViolation
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_CRITICAL
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_MAJOR
from retainpdf_pipeline.translate.services.quality.qa.models import excerpt
from retainpdf_pipeline.translate.services.quality.qa.text import cjk_count
from retainpdf_pipeline.translate.services.quality.qa.text import prose_text
from retainpdf_pipeline.translate.services.quality.qa.units import QaUnit


CHECK_OMISSION = "omission"

MIN_SOURCE_CHARS = 80
LENGTH_RATIO_MAJOR = 0.18
CRITICAL_MIN_SOURCE_CHARS = 200
LENGTH_RATIO_CRITICAL = 0.08
MIN_SOURCE_SENTENCES = 3
SENTENCE_RATIO_GUARD = 0.28

OMISSION_THRESHOLDS = {
    "min_source_chars": MIN_SOURCE_CHARS,
    "length_ratio_major": LENGTH_RATIO_MAJOR,
    "critical_min_source_chars": CRITICAL_MIN_SOURCE_CHARS,
    "length_ratio_critical": LENGTH_RATIO_CRITICAL,
    "min_source_sentences": MIN_SOURCE_SENTENCES,
    "sentence_ratio_guard": SENTENCE_RATIO_GUARD,
    "length_unit": "叙述文字长度：英文单词字母数（≥2 字母，不含 LaTeX 命令与公式）+ 汉字数",
}

_ABBREVIATIONS = (
    "e.g.", "i.e.", "et al.", "etc.", "fig.", "figs.", "eq.", "eqs.", "eqn.", "sec.", "ch.", "no.", "vs.",
    "cf.", "dr.", "mr.", "mrs.", "ms.", "prof.", "approx.", "ref.", "refs.", "vol.", "pp.", "p.", "tab.",
)
_EN_SENTENCE_END_RE = re.compile(r"[.!?](?=\s+[\"'(\[]?[A-Z0-9]|\s*$)")
_ZH_SENTENCE_END_RE = re.compile(r"[。！？!?]|\.(?=\s|$)")


_LATEX_COMMAND_RE = re.compile(r"\\[A-Za-z]+")
_PROSE_WORD_RE = re.compile(r"[A-Za-z]{2,}")


def _visible_len(text: str) -> int:
    prose = _LATEX_COMMAND_RE.sub(" ", prose_text(text))
    return cjk_count(prose) + sum(len(word) for word in _PROSE_WORD_RE.findall(prose))


def count_source_sentences(text: str) -> int:
    # OCR 没包进 $ 的裸 LaTeX（「1 . 7 8 6 5」「\\mathrm { e q }」）会被句点切成一堆「句子」，先剥掉。
    value = " ".join(_LATEX_COMMAND_RE.sub(" ", prose_text(text)).split())
    if not value:
        return 0
    lowered = value.casefold()
    for abbreviation in _ABBREVIATIONS:
        lowered = lowered.replace(abbreviation, abbreviation.replace(".", "_"))
    pieces = _EN_SENTENCE_END_RE.split(lowered)
    return sum(1 for piece in pieces if len(re.findall(r"[a-z]{2,}", piece)) >= 3)


def count_translation_sentences(text: str) -> int:
    value = prose_text(text).strip()
    if not value:
        return 0
    pieces = _ZH_SENTENCE_END_RE.split(value)
    return sum(1 for piece in pieces if cjk_count(piece) >= 4 or len(re.findall(r"[A-Za-z]+", piece)) >= 3)


def check_unit_omission(unit: QaUnit) -> list[QaViolation]:
    source_chars = _visible_len(unit.source)
    if source_chars < MIN_SOURCE_CHARS:
        return []
    translation_chars = _visible_len(unit.translated)
    ratio = translation_chars / source_chars if source_chars else 1.0
    source_sentences = count_source_sentences(unit.source)
    translation_sentences = count_translation_sentences(unit.translated)
    evidence = {
        "length_ratio": round(ratio, 4),
        "source_chars": source_chars,
        "translation_chars": translation_chars,
        "source_sentences": source_sentences,
        "translation_sentences": translation_sentences,
        "source_excerpt": excerpt(unit.source),
        "translation_excerpt": excerpt(unit.translated),
    }
    if source_chars >= CRITICAL_MIN_SOURCE_CHARS and ratio < LENGTH_RATIO_CRITICAL:
        return [_violation(unit, "translation_nearly_empty", SEVERITY_CRITICAL, "译文长度不到原文的 8%，基本等于整段漏译", evidence)]
    if ratio < LENGTH_RATIO_MAJOR:
        return [_violation(unit, "length_ratio_low", SEVERITY_MAJOR, f"译文明显偏短（长度比 {ratio:.2f}），疑似漏译", evidence)]
    if (
        source_sentences >= MIN_SOURCE_SENTENCES
        and translation_sentences * 2 <= source_sentences
        and source_sentences - translation_sentences >= 2
        and ratio < SENTENCE_RATIO_GUARD
    ):
        return [
            _violation(
                unit,
                "sentence_count_low",
                SEVERITY_MAJOR,
                f"原文 {source_sentences} 句、译文只有 {translation_sentences} 句且偏短，疑似漏句",
                evidence,
            )
        ]
    return []


def _violation(unit: QaUnit, violation_type: str, severity: str, message: str, evidence: dict) -> QaViolation:
    return QaViolation(
        check=CHECK_OMISSION,
        type=violation_type,
        severity=severity,
        message=message,
        item_ids=unit.item_ids,
        page_number=unit.first.page_number,
        block_idx=unit.first.block_idx,
        unit_id=unit.unit_id,
        evidence=evidence,
    )


__all__ = [
    "CHECK_OMISSION",
    "OMISSION_THRESHOLDS",
    "check_unit_omission",
    "count_source_sentences",
    "count_translation_sentences",
]
