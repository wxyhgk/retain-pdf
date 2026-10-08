"""交叉引用、文献引用与占位符检查。

交叉引用：Figure 3.2 → 图 3.2，Eq. (5) → 式(5)，Section 2.3 → 2.3 节。编号必须原样出现，
且编号附近要有同类的中文标签。编号丢失或标签张冠李戴（图 ↔ 表）算 major（引用编号错误）；
标签漏写或英文标签没译算 minor（体例）。全书同一类引用用了几种叫法（式 / 方程 / 公式），
在汇总里给出分布，并作为一条文档级 minor 体例问题报出。

占位符：直接复用 translation_review 用的 review_placeholders，只是比较范围换成整组。
"""
from __future__ import annotations

from collections import Counter
from collections import defaultdict
from dataclasses import dataclass
import re

from retainpdf_pipeline.translate.llm.validation.quality import review_placeholders
from retainpdf_pipeline.translate.services.quality.qa.models import QaViolation
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_CRITICAL
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_MAJOR
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_MINOR
from retainpdf_pipeline.translate.services.quality.qa.models import excerpt
from retainpdf_pipeline.translate.services.quality.qa.text import mask_math
from retainpdf_pipeline.translate.services.quality.qa.text import normalize_dashes
from retainpdf_pipeline.translate.services.quality.qa.units import QaUnit


CHECK_REFERENCES = "references"
CHECK_PLACEHOLDERS = "placeholders"

_EN_LABELS: dict[str, str] = {
    "figure": r"fig(?:ure)?s?\.?",
    "table": r"tables?|tab\.",
    "equation": r"equations?|eqns?\.?|eqs?\.?",
    "section": r"sections?|sec(?:t)?s?\.|§§?",
    "chapter": r"chapters?|chap\.|ch\.",
    "problem": r"problems?|exercises?",
    "example": r"examples?",
    "appendix": r"appendix|appendices",
    "scheme": r"schemes?",
}
# 同一类里长的写在前面：「公式」要先于「式」被认出来，变体统计才不会全算成「式」。
_ZH_LABELS: dict[str, tuple[str, ...]] = {
    "figure": ("图",),
    "table": ("表",),
    "equation": ("公式", "方程", "等式", "式"),
    "section": ("§", "节"),
    "chapter": ("章",),
    "problem": ("习题", "问题", "练习", "题"),
    "example": ("例题", "示例", "例"),
    "appendix": ("附录",),
    "scheme": ("流程图", "方案", "路线", "图式"),
}
_REF_NUMBER = r"\(?(?:[A-Z]|\d+)(?:[.\-‐-—−]\d+)*[a-z]?\)?"
_REF_SEPARATOR = r"\s*(?:,|and|&|or|to|through)\s*"
_REF_RE = re.compile(
    r"(?<![A-Za-z])(?P<label>"
    + "|".join(f"(?P<{kind}>{pattern})" for kind, pattern in _EN_LABELS.items())
    + r")\s*(?P<numbers>"
    + _REF_NUMBER
    + r"(?:"
    + _REF_SEPARATOR
    + _REF_NUMBER
    + r")*)",
    re.IGNORECASE,
)
_SINGLE_NUMBER_RE = re.compile(r"(?:[A-Z]|\d+)(?:-\d+|\.\d+)*[A-Za-z]?")
_REF_SEPARATOR_RE = re.compile(_REF_SEPARATOR, re.IGNORECASE)
_EN_LABEL_ANY_RE = re.compile(
    r"(?<![A-Za-z])(?:" + "|".join(_EN_LABELS.values()) + r")(?![A-Za-z])", re.IGNORECASE
)
_CITATION_RE = re.compile(r"\[(\d+(?:\s*[,\-‐-—−]\s*\d+)*)\]")
_LABEL_WINDOW_BEFORE = 12
_LABEL_WINDOW_AFTER = 4


@dataclass(frozen=True)
class SourceRef:
    kind: str
    number: str
    raw: str
    start: int
    end: int


def _normalize_ref_number(value: str) -> str:
    text = normalize_dashes(value).strip().strip("()").strip()
    return re.sub(r"\s+", "", text)


def _same_shape(first: str, other: str) -> bool:
    if re.fullmatch(r"\d+", first):
        return True
    head = re.match(r"\d+|[A-Z]", first)
    return bool(head) and other.startswith(head.group(0)) and len(other) > len(head.group(0))


def extract_source_refs(text: str) -> list[SourceRef]:
    masked = mask_math(text)
    refs: list[SourceRef] = []
    for match in _REF_RE.finditer(masked):
        kind = next((name for name in _EN_LABELS if match.group(name)), "")
        if not kind:
            continue
        first = ""
        for part in _REF_SEPARATOR_RE.split(match.group("numbers")):
            number = _normalize_ref_number(part)
            if not number or not _SINGLE_NUMBER_RE.fullmatch(number):
                continue
            if kind != "appendix" and not any(ch.isdigit() for ch in number):
                continue
            if not first:
                first = number
            elif not _same_shape(first, number):
                # 「Table 5A, 49, 50」里的 49、50 是化合物编号，不是表号：
                # 第一个编号带小数点 / 连字符 / 字母后缀时，后续编号必须同一主编号。
                break
            refs.append(
                SourceRef(
                    kind=kind,
                    number=number,
                    raw=match.group(0),
                    start=match.start(),
                    end=match.end(),
                )
            )
    return refs


def remove_source_refs(text: str) -> str:
    """把原文里的引用整段抹掉，数字检查就不会把引用编号再算一遍。

    数学片段保留：数字检查两边都带公式里的数字一起比，口径才一致。
    """
    return _CITATION_RE.sub(" ", _REF_RE.sub(" ", str(text or "")))


def remove_citations(text: str) -> str:
    return _CITATION_RE.sub(" ", str(text or ""))


def source_citation_numbers(text: str) -> set[str]:
    """原文文献引用里的编号（[3, 5–7] → 3、5、7），数字检查不把它们当成多出来的数字。"""
    numbers: set[str] = set()
    for match in _CITATION_RE.finditer(str(text or "")):
        numbers.update(re.findall(r"\d+", match.group(1)))
    return numbers


def _normalized_translation(text: str) -> str:
    value = normalize_dashes(mask_math(text))
    return re.sub(r"(?<=\d)\s*-\s*(?=\d)", "-", value)


def _number_positions(text: str, number: str) -> list[tuple[int, int]]:
    pattern = re.compile(rf"(?<![\d.]){re.escape(number)}(?!\d|\.\d)")
    return [(match.start(), match.end()) for match in pattern.finditer(text)]


def _label_in(window: str, kind: str, *, nearest_last: bool) -> str:
    """窗口里离编号最近的同类标签。按标签的结束位置比远近，一样近取更长的
    （「习题」与「题」、「公式」与「式」结束在同一处时取前者）。"""
    found = ""
    best: tuple[int, int] | None = None
    for label in _ZH_LABELS[kind]:
        index = window.rfind(label) if nearest_last else window.find(label)
        if index < 0:
            continue
        distance = len(window) - (index + len(label)) if nearest_last else index
        key = (distance, -len(label))
        if best is None or key < best:
            found, best = label, key
    return found


def _classify_reference(translation: str, ref: SourceRef) -> tuple[str, str]:
    """返回 (结论, 命中的中文标签)。结论：ok / missing / kind_mismatch / untranslated / label_missing。"""
    positions = _number_positions(translation, ref.number)
    if not positions and "-" in ref.number:
        parts = [part for part in ref.number.split("-") if part]
        if parts and all(_number_positions(translation, part) for part in parts):
            positions = _number_positions(translation, parts[0])
    if not positions:
        return "missing", ""
    outcome = "label_missing"
    for start, end in positions:
        before = translation[max(0, start - _LABEL_WINDOW_BEFORE) : start]
        after = translation[end : end + _LABEL_WINDOW_AFTER]
        label = _label_in(before, ref.kind, nearest_last=True) or _label_in(after, ref.kind, nearest_last=False)
        if label:
            return "ok", label
        if _EN_LABEL_ANY_RE.search(before):
            outcome = "untranslated"
            continue
        other = [
            kind
            for kind in _ZH_LABELS
            if kind != ref.kind and (_label_in(before[-6:], kind, nearest_last=True))
        ]
        if other and outcome == "label_missing":
            outcome = "kind_mismatch"
    return outcome, ""


_REF_MESSAGES = {
    "missing": ("ref_number_missing", SEVERITY_MAJOR, "交叉引用编号在译文中缺失"),
    "kind_mismatch": ("ref_kind_mismatch", SEVERITY_MAJOR, "交叉引用的类别标签与原文不一致"),
    "untranslated": ("ref_label_untranslated", SEVERITY_MINOR, "交叉引用的英文标签未译"),
    "label_missing": ("ref_label_missing", SEVERITY_MINOR, "交叉引用编号保留了，但缺少中文类别标签"),
}


class ReferenceChecker:
    def __init__(self) -> None:
        self.label_variants: dict[str, Counter] = defaultdict(Counter)
        self.label_variant_units: dict[str, dict[str, list[QaUnit]]] = defaultdict(lambda: defaultdict(list))
        self.checked_ref_count = 0

    def check_unit(self, unit: QaUnit) -> list[QaViolation]:
        violations: list[QaViolation] = []
        source = unit.source
        translation = _normalized_translation(unit.translated)
        seen: set[tuple[str, str]] = set()
        for ref in extract_source_refs(source):
            key = (ref.kind, ref.number)
            if key in seen:
                continue
            seen.add(key)
            self.checked_ref_count += 1
            outcome, label = _classify_reference(translation, ref)
            if outcome == "ok":
                self.label_variants[ref.kind][label] += 1
                self.label_variant_units[ref.kind][label].append(unit)
                continue
            kind, severity, message = _REF_MESSAGES[outcome]
            violations.append(
                QaViolation(
                    check=CHECK_REFERENCES,
                    type=kind,
                    severity=severity,
                    message=f"{message}：{ref.raw.strip()}",
                    item_ids=unit.item_ids,
                    page_number=unit.first.page_number,
                    block_idx=unit.first.block_idx,
                    unit_id=unit.unit_id,
                    evidence={
                        "ref_kind": ref.kind,
                        "ref_number": ref.number,
                        "expected_labels": list(_ZH_LABELS[ref.kind]),
                        "source_excerpt": excerpt(source, ref.raw.strip()),
                        "translation_excerpt": excerpt(unit.translated, ref.number),
                    },
                )
            )
        violations.extend(self._check_citations(unit, source))
        return violations

    def _check_citations(self, unit: QaUnit, source: str) -> list[QaViolation]:
        # 文献引用常被包进上标公式（$^{[12]}$），这里两边都不遮公式。
        violations: list[QaViolation] = []
        compact_translation = re.sub(r"\s+", "", normalize_dashes(unit.translated))
        compact_translation = compact_translation.replace("，", ",").replace("［", "[").replace("］", "]")
        for match in _CITATION_RE.finditer(source):
            content = re.sub(r"\s+", "", normalize_dashes(match.group(1)))
            self.checked_ref_count += 1
            if f"[{content}]" in compact_translation:
                continue
            violations.append(
                QaViolation(
                    check=CHECK_REFERENCES,
                    type="ref_citation_missing",
                    severity=SEVERITY_MAJOR,
                    message=f"文献引用 [{match.group(1)}] 在译文中缺失或被改写",
                    item_ids=unit.item_ids,
                    page_number=unit.first.page_number,
                    block_idx=unit.first.block_idx,
                    unit_id=unit.unit_id,
                    evidence={
                        "citation": f"[{match.group(1)}]",
                        "source_excerpt": excerpt(source, match.group(0)),
                        "translation_excerpt": excerpt(unit.translated),
                    },
                )
            )
        return violations

    def label_consistency(self, *, minority_share: float) -> tuple[dict[str, dict[str, int]], list[QaViolation]]:
        """全书同类引用的叫法分布；有少数派叫法时报一条文档级 minor。"""
        summary = {kind: dict(counter) for kind, counter in sorted(self.label_variants.items())}
        violations: list[QaViolation] = []
        for kind, counter in sorted(self.label_variants.items()):
            # 「节 / §」「例 / 例题」这类互为体例变体，只有出现两种以上叫法才算不统一。
            if len(counter) < 2:
                continue
            total = sum(counter.values())
            majority_label, _ = counter.most_common(1)[0]
            minority = {label: count for label, count in counter.items() if label != majority_label}
            if sum(minority.values()) / total < minority_share:
                continue
            sample_units = [
                unit
                for label in minority
                for unit in self.label_variant_units[kind][label][:3]
            ]
            first = sample_units[0] if sample_units else None
            violations.append(
                QaViolation(
                    check=CHECK_REFERENCES,
                    type="ref_label_inconsistent",
                    severity=SEVERITY_MINOR,
                    message=f"全书「{kind}」类引用的叫法不统一：" + "、".join(
                        f"{label}×{count}" for label, count in counter.most_common()
                    ),
                    item_ids=[item_id for unit in sample_units for item_id in unit.item_ids][:6],
                    page_number=first.first.page_number if first else 0,
                    block_idx=first.first.block_idx if first else -1,
                    unit_id="",
                    scope="document",
                    evidence={
                        "ref_kind": kind,
                        "variants": dict(counter),
                        "majority_label": majority_label,
                        "translation_excerpt": excerpt(first.translated) if first else "",
                    },
                )
            )
        return summary, violations


_PLACEHOLDER_SEVERITY = {
    "unexpected_placeholder": SEVERITY_CRITICAL,
    "placeholder_inventory_mismatch": SEVERITY_CRITICAL,
    "placeholder_order_changed": SEVERITY_MINOR,
}


def check_unit_placeholders(unit: QaUnit) -> list[QaViolation]:
    """占位符完整性：与 translation_review 同一个函数，只是按整组比。

    direct_typst 模式下没有占位符（公式原样送模型），translation_review 同样跳过。
    """
    if unit.direct_math:
        return []
    violations: list[QaViolation] = []
    for issue in review_placeholders(unit.unit_id, unit.protected_source, unit.protected_translated):
        severity = _PLACEHOLDER_SEVERITY.get(issue.kind, SEVERITY_MAJOR)
        violations.append(
            QaViolation(
                check=CHECK_PLACEHOLDERS,
                type=issue.kind,
                severity=severity,
                message="占位符 / 公式保护标记与原文不一致",
                item_ids=unit.item_ids,
                page_number=unit.first.page_number,
                block_idx=unit.first.block_idx,
                unit_id=unit.unit_id,
                evidence={
                    **(issue.details or {}),
                    "source_excerpt": excerpt(unit.protected_source),
                    "translation_excerpt": excerpt(unit.protected_translated),
                },
            )
        )
    return violations


__all__ = [
    "CHECK_PLACEHOLDERS",
    "CHECK_REFERENCES",
    "ReferenceChecker",
    "SourceRef",
    "check_unit_placeholders",
    "extract_source_refs",
    "remove_citations",
    "remove_source_refs",
    "source_citation_numbers",
]
