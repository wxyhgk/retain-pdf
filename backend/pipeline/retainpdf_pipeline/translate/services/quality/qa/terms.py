"""术语一致与首现括注。

术语来源依次是：
1. translated/term-base.v1.json（译前术语表，可能不存在；存在则视为锁定术语）；
2. 用户术语表（core/terms/glossary.py 的 GlossaryEntry，同源词以用户条目为准）；
3. 从全书译文里统计出来的「同一源词多种处理」：同一个英文词在有的地方原样保留、
   有的地方译成了中文。没有对照表，只能看出「不一致」，看不出哪种译法对，所以只报 minor。

命中判断与 translation_review 的 glossary_term_missing 同口径：源词用 matched_glossary_entries
匹配，期望译法 preserve 级是源词本身、其余是 target，译文里（忽略大小写）出现即算命中。
区别只在范围：QA 按整组比，review 按单块比。

首现括注：「卷积神经网络（convolutional neural network，CNN）」这种写法。检查三件事：
已知术语的首现处有没有括注（覆盖率）；括注是不是出现在源词首现处；同一括注有没有重复出现。
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from dataclasses import field
import json
from pathlib import Path
import re
from typing import Any

from retainpdf_pipeline.translate.core.terms import GlossaryEntry
from retainpdf_pipeline.translate.core.terms import matched_glossary_entries
from retainpdf_pipeline.translate.core.terms import normalize_glossary_entries
from retainpdf_pipeline.translate.services.quality.qa.models import QaViolation
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_MAJOR
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_MINOR
from retainpdf_pipeline.translate.services.quality.qa.models import excerpt
from retainpdf_pipeline.translate.services.quality.qa.text import CJK_CLASS
from retainpdf_pipeline.translate.services.quality.qa.text import strip_math
from retainpdf_pipeline.translate.services.quality.qa.units import QaUnit


CHECK_TERMS = "terms"
CHECK_ANNOTATIONS = "annotations"
TERM_BASE_FILE_NAME = "term-base.v1.json"
STYLE_GUIDE_FILE_NAME = "style-guide.v1.json"
FIRST_MENTION_GLOSS_RULE_ID = "first_mention_gloss"


def load_style_guide_qa_rules(path: Path | None) -> dict[str, Any]:
    """读风格指南里 apply="qa" 的规则（它们没有进 prompt，专门留给 QA）。缺省时照常检查。"""
    if path is None or not path.is_file():
        return {"status": "missing", "path": str(path) if path else ""}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return {"status": "unreadable", "path": str(path), "error": type(exc).__name__}
    rules = payload.get("rules") if isinstance(payload, dict) else None
    qa_rules = [
        {key: rule.get(key) for key in ("id", "category", "rule") if key in rule}
        for rule in (rules or [])
        if isinstance(rule, dict) and str(rule.get("apply", "") or "") == "qa"
    ]
    return {"status": "loaded", "path": str(path), "qa_rules": qa_rules}

ORIGIN_TERM_BASE = "term_base"
ORIGIN_GLOSSARY = "glossary"
ORIGIN_DERIVED = "derived"

_ANNOTATION_RE = re.compile(
    rf"(?P<zh>[{CJK_CLASS}][{CJK_CLASS}\-·]{{0,15}})\s*[（(]\s*"
    r"(?P<en>[A-Za-z][A-Za-z0-9 \-'’/.]*?[A-Za-z0-9.])"
    r"(?:\s*[,，;；]\s*(?P<abbr>[A-Za-z][A-Za-z0-9\-]*))?\s*[）)]"
)
_LATIN_LETTER = "A-Za-zÀ-ÖØ-öø-ÿ\u0100-\u017F"
_LATIN_CHUNK_RE = re.compile(
    rf"[{_LATIN_LETTER}][{_LATIN_LETTER}'’\-]*[{_LATIN_LETTER}](?:\s+[{_LATIN_LETTER}][{_LATIN_LETTER}'’\-]*[{_LATIN_LETTER}]){{0,3}}"
)
_STOPWORDS = frozenset(
    """a an the of and or to in on at by for with from as is are was were be been being this that these
    those it its we our you your they their he she his her which who whom whose what when where why how
    not no nor but if then than so such into onto over under about above below between through during
    can could may might must shall should will would do does did done have has had also only just more most
    very each both all any some other another same one two three first second next last let see note thus
    hence where while however therefore solution example problem figure table equation section chapter
    and/or vs via per eg ie etc al""".split()
)


@dataclass
class TermSpec:
    source: str
    target: str
    origin: str
    level: str
    locked: bool
    entry: GlossaryEntry
    occurrences: list[QaUnit] = field(default_factory=list)
    hits: list[QaUnit] = field(default_factory=list)
    misses: list[QaUnit] = field(default_factory=list)

    @property
    def expected(self) -> str:
        return self.source if self.level == "preserve" else self.target

    @property
    def expects_annotation(self) -> bool:
        return self.level != "preserve" and self.target.casefold() != self.source.casefold()


def load_term_base(path: Path | None) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """读取译前术语表。文件格式由另一个模块定义，这里尽量宽松地取「源词 → 译法」。"""
    if path is None:
        return {"status": "not_configured"}, []
    if not path.exists():
        return {"status": "missing", "path": str(path)}, []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return {"status": "unreadable", "path": str(path), "error": f"{type(exc).__name__}: {exc}"}, []
    raw_entries: Any = payload
    if isinstance(payload, dict):
        for key in ("terms", "entries", "items"):
            if isinstance(payload.get(key), list):
                raw_entries = payload[key]
                break
    if not isinstance(raw_entries, list):
        return {"status": "unrecognized", "path": str(path)}, []
    entries: list[dict[str, str]] = []
    for raw in raw_entries:
        if not isinstance(raw, dict):
            continue
        source = _first_text(raw, ("source", "term", "src", "source_term"))
        target = _first_text(raw, ("target", "translation", "tgt", "target_term"))
        if source and target:
            entries.append(
                {
                    "source": source,
                    "target": target,
                    "level": str(raw.get("level") or "canonical"),
                    "origin": str(raw.get("origin") or ""),
                }
            )
    meta: dict[str, Any] = {"status": "loaded", "path": str(path), "entry_count": len(entries)}
    if isinstance(payload, dict):
        meta["schema"] = str(payload.get("schema", "") or "")
        # complete=false：译前预扫没跑完，术语一致率只反映已抽到的那部分。
        complete = payload.get("complete")
        meta["complete"] = True if complete is None else bool(complete)
        if not meta["complete"]:
            meta["note"] = "术语表不完整（译前预扫未跑完），术语一致检查只覆盖已抽取的术语"
    return meta, entries


def _first_text(raw: dict, keys: tuple[str, ...]) -> str:
    for key in keys:
        value = raw.get(key)
        if isinstance(value, list) and value:
            value = value[0]
        if isinstance(value, dict):
            value = value.get("text") or value.get("target") or value.get("value")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def build_term_specs(
    glossary_entries: list[GlossaryEntry | dict] | None,
    term_base_entries: list[dict[str, str]],
) -> list[TermSpec]:
    specs: list[TermSpec] = []
    seen: set[str] = set()
    for entry in normalize_glossary_entries(glossary_entries):
        key = entry.source.casefold()
        if key in seen:
            continue
        seen.add(key)
        specs.append(
            TermSpec(
                source=entry.source,
                target=entry.target,
                origin=ORIGIN_GLOSSARY,
                level=entry.level,
                locked=entry.level in {"preserve", "canonical"},
                entry=entry,
            )
        )
    # 术语表条目沿用 glossary 的三级：preserve / canonical 视为锁定（违反记 major），
    # preferred 是软约束（记 minor）。匹配一律不分大小写：预扫抽出来的是小写词形。
    term_base = normalize_glossary_entries(
        [
            {
                "source": item["source"],
                "target": item["target"],
                "level": item.get("level") or "canonical",
                "match_mode": "case_insensitive",
            }
            for item in term_base_entries
        ]
    )
    for entry in term_base:
        key = entry.source.casefold()
        if key in seen:
            continue  # 用户术语表优先
        seen.add(key)
        specs.append(
            TermSpec(
                source=entry.source,
                target=entry.target,
                origin=ORIGIN_TERM_BASE,
                level=entry.level,
                locked=entry.level in {"preserve", "canonical"},
                entry=entry,
            )
        )
    return specs


@dataclass
class Annotation:
    key: str
    en: str
    zh: str
    unit: QaUnit
    raw: str
    mirrors_source: bool = False


def _norm_key(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").replace("’", "'")).strip().casefold()


def _source_has_word(source: str, needle: str, *, case_sensitive: bool = False) -> bool:
    if not needle:
        return False
    pattern = rf"(?<![{_LATIN_LETTER}0-9_]){re.escape(needle)}(?![{_LATIN_LETTER}0-9_])"
    flags = 0 if case_sensitive else re.IGNORECASE
    return re.search(pattern, source.replace("’", "'"), flags) is not None


def _derived_present(text: str, chunk: str) -> bool:
    """派生术语在一段文字里出没出现。单个专名式单词区分大小写（Hermite ≠ hermite、
    Layout ≠ page_layout）；复数缩写认单数（CSFs ↔ CSF）；人名串里的 and 可能被译成「和」，
    只要每个大写实词都在就算保留了英文。"""
    words = chunk.split()
    if len(words) == 1:
        if _source_has_word(text, chunk, case_sensitive=True):
            return True
        return chunk.endswith("s") and len(chunk) > 3 and _source_has_word(text, chunk[:-1], case_sensitive=True)
    if _source_has_word(text, chunk):
        return True
    content = [word for word in words if word.casefold() not in _STOPWORDS]
    return len(content) < len(words) and all(
        word[:1].isupper() and _source_has_word(text, word, case_sensitive=True) for word in content
    )


def extract_annotations(unit: QaUnit) -> list[Annotation]:
    translation = strip_math(unit.translated)
    source_folded = _norm_key(unit.source)
    found: list[Annotation] = []
    for match in _ANNOTATION_RE.finditer(translation):
        en = match.group("en").strip()
        letters = sum(ch.isalpha() for ch in en)
        if letters < 3 or not re.search(r"[A-Za-z]{3,}", en):
            continue
        key = _norm_key(en)
        # 原文自己就带这个括号（「World Health Organization (WHO)」）：照录原文。它算首现括注，
        # 但原文本身重复引入时，译文跟着重复不算问题。
        mirrors = f"({key})" in source_folded.replace("( ", "(").replace(" )", ")")
        found.append(
            Annotation(
                key=key, en=en, zh=match.group("zh"), unit=unit, raw=match.group(0), mirrors_source=mirrors
            )
        )
    return found


class TermChecker:
    def __init__(
        self,
        *,
        glossary_entries: list[GlossaryEntry | dict] | None,
        term_base_path: Path | None,
        annotation_rule_id: str = "",
    ) -> None:
        self.annotation_rule_id = annotation_rule_id
        self.term_base_meta, term_base_entries = load_term_base(term_base_path)
        self.specs = build_term_specs(glossary_entries, term_base_entries)
        self._entries = [spec.entry for spec in self.specs]
        self._spec_by_key = {
            (spec.entry.source.casefold(), spec.entry.target.casefold(), spec.entry.level): spec for spec in self.specs
        }
        self.glossary_entry_count = sum(1 for spec in self.specs if spec.origin == ORIGIN_GLOSSARY)
        self.annotations: list[Annotation] = []
        self._units: list[QaUnit] = []

    def check_unit(self, unit: QaUnit) -> list[QaViolation]:
        self._units.append(unit)
        self.annotations.extend(extract_annotations(unit))
        if not self._entries:
            return []
        violations: list[QaViolation] = []
        translated_folded = unit.translated.casefold()
        for entry in matched_glossary_entries(self._entries, unit.source):
            spec = self._spec_by_key.get((entry.source.casefold(), entry.target.casefold(), entry.level))
            if spec is None:
                continue
            spec.occurrences.append(unit)
            expected = spec.expected
            if expected and expected.casefold() in translated_folded:
                spec.hits.append(unit)
                continue
            spec.misses.append(unit)
            violations.append(
                QaViolation(
                    check=CHECK_TERMS,
                    type="term_violation" if spec.locked else "term_preferred_missing",
                    severity=SEVERITY_MAJOR if spec.locked else SEVERITY_MINOR,
                    message=f"术语「{spec.source}」应译为「{expected}」，译文未采用",
                    item_ids=unit.item_ids,
                    page_number=unit.first.page_number,
                    block_idx=unit.first.block_idx,
                    unit_id=unit.unit_id,
                    evidence={
                        "term_source": spec.source,
                        "expected": expected,
                        "origin": spec.origin,
                        "level": spec.level,
                        "source_excerpt": excerpt(unit.source, spec.source),
                        "translation_excerpt": excerpt(unit.translated),
                    },
                )
            )
        return violations

    # ---- 全书收尾：首现括注、派生的不一致 -------------------------------------------

    def finalize(self) -> tuple[list[QaViolation], dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
        violations: list[QaViolation] = []
        annotation_violations, annotation_summary = self._finalize_annotations()
        if self.annotation_rule_id:
            annotation_summary["style_rule_id"] = self.annotation_rule_id
            for violation in annotation_violations:
                violation.evidence["style_rule_id"] = self.annotation_rule_id
        violations.extend(annotation_violations)
        derived_violations, derived_terms = self._finalize_derived()
        violations.extend(derived_violations)
        term_rows = [self._spec_row(spec) for spec in self.specs if spec.occurrences]
        term_rows.extend(derived_terms)
        return violations, self._consistency_summary(derived_terms), annotation_summary, term_rows

    def _first_source_unit(self, needle: str) -> QaUnit | None:
        for unit in self._units:
            if _source_has_word(unit.source, needle):
                return unit
        return None

    def _finalize_annotations(self) -> tuple[list[QaViolation], dict[str, Any]]:
        violations: list[QaViolation] = []
        by_key: dict[str, list[Annotation]] = defaultdict(list)
        for annotation in self.annotations:
            by_key[annotation.key].append(annotation)
        at_first = 0
        for key, group in by_key.items():
            first_annotation = group[0]
            first_source = self._first_source_unit(first_annotation.en)
            if first_source is None or first_source.order >= first_annotation.unit.order:
                at_first += 1
            else:
                violations.append(
                    QaViolation(
                        check=CHECK_ANNOTATIONS,
                        type="annotation_not_at_first_occurrence",
                        severity=SEVERITY_MINOR,
                        message=f"「{first_annotation.en}」的括注没有放在首次出现处",
                        item_ids=first_source.item_ids,
                        page_number=first_source.first.page_number,
                        block_idx=first_source.first.block_idx,
                        unit_id=first_source.unit_id,
                        evidence={
                            "term_source": first_annotation.en,
                            "annotation": first_annotation.raw,
                            "annotated_at_item_id": first_annotation.unit.first.item_id,
                            "annotated_at_page_number": first_annotation.unit.first.page_number,
                            "source_excerpt": excerpt(first_source.source, first_annotation.en),
                            "translation_excerpt": excerpt(first_source.translated),
                        },
                    )
                )
            seen_units = {first_annotation.unit.unit_id}
            for duplicate in group[1:]:
                if duplicate.unit.unit_id in seen_units or duplicate.mirrors_source:
                    continue
                seen_units.add(duplicate.unit.unit_id)
                violations.append(
                    QaViolation(
                        check=CHECK_ANNOTATIONS,
                        type="annotation_duplicate",
                        severity=SEVERITY_MINOR,
                        message=f"「{duplicate.en}」已在首现处括注，此处重复括注",
                        item_ids=duplicate.unit.item_ids,
                        page_number=duplicate.unit.first.page_number,
                        block_idx=duplicate.unit.first.block_idx,
                        unit_id=duplicate.unit.unit_id,
                        evidence={
                            "term_source": duplicate.en,
                            "annotation": duplicate.raw,
                            "first_annotated_item_id": first_annotation.unit.first.item_id,
                            "translation_excerpt": excerpt(duplicate.unit.translated, duplicate.raw),
                        },
                    )
                )

        # 已知术语（术语表 / 用户术语表里需要翻译的词）的首现括注覆盖率。
        expected_terms = [spec for spec in self.specs if spec.occurrences and spec.expects_annotation]
        covered = 0
        for spec in expected_terms:
            first = spec.occurrences[0]
            pattern = re.compile(
                rf"{re.escape(spec.target)}\s*[（(]\s*{re.escape(spec.source)}", re.IGNORECASE
            )
            if pattern.search(strip_math(first.translated).replace("’", "'")):
                covered += 1
                continue
            violations.append(
                QaViolation(
                    check=CHECK_ANNOTATIONS,
                    type="annotation_missing",
                    severity=SEVERITY_MINOR,
                    message=f"术语「{spec.source}」首次出现时缺少括注，应写作「{spec.target}（{spec.source}）」",
                    item_ids=first.item_ids,
                    page_number=first.first.page_number,
                    block_idx=first.first.block_idx,
                    unit_id=first.unit_id,
                    evidence={
                        "term_source": spec.source,
                        "expected": f"{spec.target}（{spec.source}）",
                        "origin": spec.origin,
                        "source_excerpt": excerpt(first.source, spec.source),
                        "translation_excerpt": excerpt(first.translated, spec.target),
                    },
                )
            )
        duplicate_count = sum(1 for violation in violations if violation.type == "annotation_duplicate")
        summary = {
            "annotated_term_count": len(by_key),
            "annotated_at_first_occurrence": at_first,
            "annotation_first_occurrence_rate": _rate(at_first, len(by_key)),
            "duplicate_annotation_count": duplicate_count,
            "known_term_count": len(expected_terms),
            "known_term_annotated_at_first": covered,
            "known_term_coverage_rate": _rate(covered, len(expected_terms)),
        }
        return violations, summary

    def _finalize_derived(self) -> tuple[list[QaViolation], list[dict[str, Any]]]:
        """同一英文源词：有的地方原样保留、有的地方译掉了 —— 全书处理不一致。"""
        known = {spec.source.casefold() for spec in self.specs}
        annotated = {annotation.key for annotation in self.annotations}
        candidates: dict[str, str] = {}
        for unit in self._units:
            if unit.is_reference:
                continue
            translation = _ANNOTATION_RE.sub(" ", strip_math(unit.translated))
            for match in _LATIN_CHUNK_RE.finditer(translation):
                chunk = match.group(0).strip()
                words = chunk.split()
                content = [word for word in words if word.casefold().strip("'’") not in _STOPWORDS]
                if not content or sum(len(word) for word in content) < 4:
                    continue
                if len(words) == 1 and (len(chunk) < 4 or chunk.isupper() or not chunk[:1].isupper()):
                    # 变量、缩写、化学式不算；单个小写普通词（cycle、molecule）多半是单位或残留，
                    # 归残留英文检查管，这里只看专名式的单词（Hermite、Morse）和多词术语。
                    continue
                key = _norm_key(chunk)
                if key in known or key in annotated:
                    continue
                if _derived_present(unit.source, chunk):
                    candidates.setdefault(key, chunk)
        rows: list[dict[str, Any]] = []
        violations: list[QaViolation] = []
        consumed: set[str] = set()
        for key in sorted(candidates, key=len, reverse=True):
            chunk = candidates[key]
            if any(key in longer for longer in consumed):
                continue
            kept: list[QaUnit] = []
            translated: list[QaUnit] = []
            for unit in self._units:
                if unit.is_reference or not _derived_present(unit.source, chunk):
                    continue
                if _derived_present(strip_math(unit.translated), chunk):
                    kept.append(unit)
                else:
                    translated.append(unit)
            total = len(kept) + len(translated)
            if total < 2:
                continue
            consumed.add(key)
            consistent = max(len(kept), len(translated))
            rows.append(
                {
                    "source": chunk,
                    "origin": ORIGIN_DERIVED,
                    "occurrences": total,
                    "kept_in_english": len(kept),
                    "translated": len(translated),
                    "consistent": consistent,
                    "consistency_rate": _rate(consistent, total),
                }
            )
            if not kept or not translated:
                continue
            # 打平时报「保留英文」那一侧：出版体例上术语应译，保留英文的那几处更可能要改。
            if len(kept) <= len(translated):
                minority = kept
                majority_label = "两种处理各半" if len(kept) == len(translated) else "多数处已译成中文"
            else:
                minority, majority_label = translated, "多数处保留英文原文"
            for unit in minority:
                violations.append(
                    QaViolation(
                        check=CHECK_TERMS,
                        type="term_inconsistent_rendering",
                        severity=SEVERITY_MINOR,
                        message=f"「{chunk}」全书处理不一致：{len(kept)} 处保留英文、{len(translated)} 处译成中文（{majority_label}）",
                        item_ids=unit.item_ids,
                        page_number=unit.first.page_number,
                        block_idx=unit.first.block_idx,
                        unit_id=unit.unit_id,
                        evidence={
                            "term_source": chunk,
                            "origin": ORIGIN_DERIVED,
                            "kept_in_english": len(kept),
                            "translated": len(translated),
                            "kept_item_ids": [u.first.item_id for u in kept[:10]],
                            "translated_item_ids": [u.first.item_id for u in translated[:10]],
                            "source_excerpt": excerpt(unit.source, chunk),
                            "translation_excerpt": excerpt(unit.translated, chunk),
                        },
                    )
                )
        return violations, rows

    def _spec_row(self, spec: TermSpec) -> dict[str, Any]:
        return {
            "source": spec.source,
            "target": spec.target,
            "expected": spec.expected,
            "origin": spec.origin,
            "level": spec.level,
            "locked": spec.locked,
            "occurrences": len(spec.occurrences),
            "hits": len(spec.hits),
            "consistency_rate": _rate(len(spec.hits), len(spec.occurrences)),
            "first_item_id": spec.occurrences[0].first.item_id if spec.occurrences else "",
            "missed_item_ids": [unit.first.item_id for unit in spec.misses[:20]],
        }

    def _consistency_summary(self, derived_rows: list[dict[str, Any]]) -> dict[str, Any]:
        def _bucket(specs: list[TermSpec]) -> dict[str, Any]:
            occurrences = sum(len(spec.occurrences) for spec in specs)
            hits = sum(len(spec.hits) for spec in specs)
            return {
                "term_count": len(specs),
                "matched_term_count": sum(1 for spec in specs if spec.occurrences),
                "occurrences": occurrences,
                "hits": hits,
                "consistency_rate": _rate(hits, occurrences),
            }

        locked = _bucket([spec for spec in self.specs if spec.locked])
        preferred = _bucket([spec for spec in self.specs if not spec.locked])
        derived_occurrences = sum(row["occurrences"] for row in derived_rows)
        derived_consistent = sum(row["consistent"] for row in derived_rows)
        total_occurrences = locked["occurrences"] + preferred["occurrences"] + derived_occurrences
        total_consistent = locked["hits"] + preferred["hits"] + derived_consistent
        return {
            "overall_consistency_rate": _rate(total_consistent, total_occurrences),
            "locked": locked,
            "preferred": preferred,
            "derived": {
                "term_count": len(derived_rows),
                "inconsistent_term_count": sum(
                    1 for row in derived_rows if row["kept_in_english"] and row["translated"]
                ),
                "occurrences": derived_occurrences,
                "consistent": derived_consistent,
                "consistency_rate": _rate(derived_consistent, derived_occurrences),
            },
            "term_base_complete": self.term_base_meta.get("complete"),
            "sources": {
                "term_base": self.term_base_meta,
                "glossary_entry_count": self.glossary_entry_count,
            },
        }


def _rate(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return round(numerator / denominator, 4)


__all__ = [
    "CHECK_ANNOTATIONS",
    "CHECK_TERMS",
    "FIRST_MENTION_GLOSS_RULE_ID",
    "STYLE_GUIDE_FILE_NAME",
    "TERM_BASE_FILE_NAME",
    "TermChecker",
    "build_term_specs",
    "extract_annotations",
    "load_style_guide_qa_rules",
    "load_term_base",
]
