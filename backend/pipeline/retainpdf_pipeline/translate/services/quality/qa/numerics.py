"""数字、单位、科学计数法保真。

口径（都偏保守，宁漏勿误）：
- 千分位：1,000 与 1000 视同；1,000,000 与 100 万 视同。
- 量级词：3 billion 必须等于 30 亿 / 3,000,000,000 / 3×10^9；写成「3 亿」是数值错误（critical）。
- 科学计数法：7.61 × 10^{-19} 与 7.61e-19 视同；指数符号变了算数值错误。
- 百分号：5% 可写 5%、5％ 或「百分之五」；数字还在但百分号丢了算 major。
- 年代：1960s 期望「20 世纪 60 年代」；保留 1960 但没换算成世纪写法只算体例（minor）。
- 原文数字整个不见了 → critical；0–10 的小整数如果译文用了对应的中文数字则豁免。
- 译文多出原文没有的数字 → major；英文数词（two、first…）换成阿拉伯数字的情况豁免。
交叉引用里的编号由 references 检查负责，这里先从原文里抹掉，避免同一处问题报两遍。
"""
from __future__ import annotations

from decimal import Decimal
from decimal import InvalidOperation
import re

from retainpdf_pipeline.translate.services.quality.qa.models import QaViolation
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_CRITICAL
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_MAJOR
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_MINOR
from retainpdf_pipeline.translate.services.quality.qa.models import excerpt
from retainpdf_pipeline.translate.services.quality.qa.references import extract_source_refs
from retainpdf_pipeline.translate.services.quality.qa.references import remove_citations
from retainpdf_pipeline.translate.services.quality.qa.references import remove_source_refs
from retainpdf_pipeline.translate.services.quality.qa.references import source_citation_numbers
from retainpdf_pipeline.translate.services.quality.qa.text import normalize_dashes
from retainpdf_pipeline.translate.services.quality.qa.text import strip_math
from retainpdf_pipeline.translate.services.quality.qa.units import QaUnit


CHECK_NUMBERS = "numbers"

_THOUSANDS_RE = re.compile(r"(?<![\d.,])\d{1,3}(?:,\d{3})+(?![\d,])")
_THIN_SPACE_THOUSANDS_RE = re.compile(r"(?<![\d.])\d{1,3}(?:[  ]\d{3})+(?!\d)")
# 普通空格分组的千分位「78 000」：只认首组 1–3 位、其后每组恰好 3 位，且整串不跟小数点。
_SPACE_THOUSANDS_RE = re.compile(r"(?<![\d.])\d{1,3}(?: \d{3})+(?![\d.])")
# 贴着数字的量级缩写「100M」「3B」「20K」；化学里的「5 M」（摩尔浓度）中间有空格，不在此列。
_ABBREVIATED_SCALE_RE = re.compile(r"(?<![\d.\w])(\d+(?:\.\d+)?)([KMB])\b")
_ABBREVIATED_SCALE = {"K": Decimal(10) ** 3, "M": Decimal(10) ** 6, "B": Decimal(10) ** 9}
_LATEX_THOUSANDS_RE = re.compile(r"(?<![\d.])\d{1,3}(?:(?:\\,|\{,\}|\\ )\d{3})+(?!\d)")
# 原文里有不在 $…$ 里的 LaTeX 命令、花括号或被拆开的单个数字，说明这一段是 OCR 识别坏了的公式：
# 数字对不上多半是原文本身错了（「408C」其实是 40 °C），降一档报，并在证据里注明。
_OCR_NOISE_RE = re.compile(
    r"\\[A-Za-z]+\s*\{|\{\s*\d|(?<![\d.])\d \d(?![\d.])|(?<![\d.])\d \d(?: \d)+(?![\d.])|\d+\.\d+\.\d"
)
_SPACED_DECIMAL_RE = re.compile(r"(?<![\d.])\d+(?: \d)* \. \d(?: \d)*(?![\d.])")
_SPACED_DIGITS_RE = re.compile(r"(?<![\d.])\d(?: \d)+(?![\d.])")
_MONTH_RE = re.compile(
    r"\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|"
    r"sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?",
    re.IGNORECASE,
)
# 前面紧挨着「数字.」才算小数的一部分；「No.112T503」里的 112 照样要认。
_NUMBER_RE = re.compile(r"(?<!\d)(?<!\d\.)\d+(?:\.\d+)?(?!\d)")
_SUPERSCRIPT_DIGITS = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉", "01234567890123456789")
_EN_SCALE = {
    "thousand": Decimal(10) ** 3,
    "million": Decimal(10) ** 6,
    "billion": Decimal(10) ** 9,
    "trillion": Decimal(10) ** 12,
}
_EN_SCALE_RE = re.compile(
    r"(?<![\d.])(\d+(?:\.\d+)?)\s*(thousand|million|billion|trillion)s?\b", re.IGNORECASE
)
_ZH_SCALE = {
    "万亿": Decimal(10) ** 12,
    "千亿": Decimal(10) ** 11,
    "百亿": Decimal(10) ** 10,
    "十亿": Decimal(10) ** 9,
    "亿": Decimal(10) ** 8,
    "千万": Decimal(10) ** 7,
    "百万": Decimal(10) ** 6,
    "十万": Decimal(10) ** 5,
    "万": Decimal(10) ** 4,
    "千": Decimal(10) ** 3,
}
_ZH_SCALE_RE = re.compile(
    r"(?<![\d.])(\d+(?:\.\d+)?)\s*(" + "|".join(sorted(_ZH_SCALE, key=len, reverse=True)) + r")"
)
# a × 10^b：Unicode ×、LaTeX \times / \cdot、字母 x 都认；指数可带花括号和负号。
_SCI_RE = re.compile(
    r"(?<![\d.])(\d+(?:\.\d+)?)\s*(?:×|\\times|\\cdot|·|x|\*)\s*10\s*\^?\s*\{?\s*([-+]?\d+)\s*\}?"
)
_SCI_E_RE = re.compile(r"(?<![\w.])(\d+(?:\.\d+)?)[eE]([-+]?\d+)(?![\w])")
_PERCENT_RE = re.compile(r"(?<![\d.])(\d+(?:\.\d+)?)\s*(?:%|\\%|percent\b|per cent\b)", re.IGNORECASE)
_DECADE_RE = re.compile(r"(?<![\d])((1[0-9]|20)(\d)0)(?:'?s)\b")
_EN_NUMBER_WORDS = {
    0: ("zero", "none"),
    1: ("one", "first", "single", "once", "a ", "an "),
    2: ("two", "second", "double", "twice", "pair", "both", "binary", "di"),
    3: ("three", "third", "triple", "thrice", "tri"),
    4: ("four", "fourth", "quad"),
    5: ("five", "fifth"),
    6: ("six", "sixth"),
    7: ("seven", "seventh"),
    8: ("eight", "eighth"),
    9: ("nine", "ninth"),
    10: ("ten", "tenth"),
}
_ZH_DIGITS = {
    0: "零〇",
    1: "一壹",
    2: "二两贰双俩",
    3: "三叁",
    4: "四肆",
    5: "五伍",
    6: "六陆",
    7: "七柒",
    8: "八捌",
    9: "九玖",
    10: "十拾",
}


def _canonical(value: str | Decimal) -> str:
    try:
        number = value if isinstance(value, Decimal) else Decimal(str(value))
    except InvalidOperation:
        return str(value)
    normalized = number.normalize()
    text = format(normalized, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def _collapse_ocr_digits(text: str) -> str:
    # OCR 出来的 LaTeX 常把数字拆成单个字符：「0 . 2 5」「1 2 4 8」。只合并「单个数字 + 单个空格」
    # 这种形态，正常文本里的「3 and 5」「1576 (1632)」不受影响。两边都做，口径一致。
    text = _SPACED_DECIMAL_RE.sub(lambda match: re.sub(r"\s+", "", match.group(0)), text)
    return _SPACED_DIGITS_RE.sub(lambda match: match.group(0).replace(" ", ""), text)


def _strip_thousands(text: str) -> str:
    # Unicode 上下标数字（「dissociation⁵⁵」「Li₂」）按普通数字算，译文常写成 $^{55}$。
    text = text.translate(_SUPERSCRIPT_DIGITS)
    # LaTeX 千分位：10\,291、10{,}291
    text = _LATEX_THOUSANDS_RE.sub(lambda match: re.sub(r"\\,|\{,\}|\\ ", "", match.group(0)), text)
    text = _collapse_ocr_digits(text)
    text = _THOUSANDS_RE.sub(lambda match: match.group(0).replace(",", ""), text)
    text = _SPACE_THOUSANDS_RE.sub(lambda match: match.group(0).replace(" ", ""), text)
    return _THIN_SPACE_THOUSANDS_RE.sub(lambda match: re.sub(r"[  ]", "", match.group(0)), text)


def _sci_values(text: str) -> tuple[list[tuple[Decimal, str]], str]:
    found: list[tuple[Decimal, str]] = []

    def _record(match: re.Match[str]) -> str:
        try:
            value = Decimal(match.group(1)) * (Decimal(10) ** int(match.group(2)))
        except (InvalidOperation, ValueError):
            return match.group(0)
        found.append((value, match.group(0)))
        return " "

    text = _SCI_RE.sub(_record, text)
    text = _SCI_E_RE.sub(_record, text)
    return found, text


def _scaled_values(text: str, pattern: re.Pattern[str], scales: dict[str, Decimal]) -> tuple[list[tuple[Decimal, str]], str]:
    found: list[tuple[Decimal, str]] = []

    def _record(match: re.Match[str]) -> str:
        scale = scales[match.group(2).lower() if match.group(2).lower() in scales else match.group(2)]
        found.append((Decimal(match.group(1)) * scale, match.group(0)))
        return " "

    return found, pattern.sub(_record, text)


def _plain_numbers(text: str) -> list[str]:
    return [_canonical(match.group(0)) for match in _NUMBER_RE.finditer(text)]


def _number_words_in(source: str, value: int) -> bool:
    folded = f" {source.casefold()} "
    for word in _EN_NUMBER_WORDS.get(value, ()):
        if word.endswith(" "):
            if f" {word}" in folded:
                return True
            continue
        if len(word) <= 3:
            if re.search(rf"\b{re.escape(word)}", folded):
                return True
            continue
        if re.search(rf"\b{re.escape(word)}\b", folded):
            return True
    return False


def _zh_digit_in(translation: str, value: int) -> bool:
    return any(char in translation for char in _ZH_DIGITS.get(value, ""))


class NumberChecker:
    def __init__(self) -> None:
        self.checked_number_count = 0

    def check_unit(self, unit: QaUnit) -> list[QaViolation]:
        source_raw = unit.source
        translation_raw = unit.translated
        source = normalize_dashes(_strip_thousands(remove_source_refs(source_raw)))
        # 文献引用两边都抹掉（由 references 检查负责），否则「[113,114]」会被当成千分位 113114。
        translation = normalize_dashes(_strip_thousands(remove_citations(translation_raw)))
        ref_numbers: set[str] = {_canonical(number) for number in source_citation_numbers(source_raw)}
        for ref in extract_source_refs(source_raw):
            bare = ref.number.rstrip("abcdefghijklmnopqrstuvwxyz")
            for part in re.split(r"-", bare) + re.split(r"[-.]", bare):
                if part and part.replace(".", "", 1).isdigit():
                    ref_numbers.add(_canonical(part))
        violations: list[QaViolation] = []

        source_sci, source = _sci_values(source)
        translation_sci, translation_rest = _sci_values(translation)
        abbreviated: list[tuple[Decimal, Decimal, str]] = []

        def _record_abbreviated(match: re.Match[str]) -> str:
            plain = Decimal(match.group(1))
            abbreviated.append((plain * _ABBREVIATED_SCALE[match.group(2)], plain, match.group(0)))
            return " "

        source = _ABBREVIATED_SCALE_RE.sub(_record_abbreviated, source)
        source_scaled, source = _scaled_values(source, _EN_SCALE_RE, _EN_SCALE)
        translation_scaled, translation_rest = _scaled_values(translation_rest, _ZH_SCALE_RE, _ZH_SCALE)
        translation_plain = _plain_numbers(translation_rest)
        translation_values = {value for value, _ in translation_sci + translation_scaled}
        translation_values |= {Decimal(value) for value in translation_plain}

        for value, plain, raw in abbreviated:
            self.checked_number_count += 1
            if value in translation_values or plain in translation_values:
                continue
            violations.append(
                self._violation(
                    unit,
                    "number_scale_mismatch",
                    SEVERITY_MAJOR,
                    f"数值在译文中对不上：{raw.strip()}（应为 {_human(value)}）",
                    source_needle=raw,
                    translation_needle=None,
                    extra={"expected_value": _canonical(value), "source_token": raw.strip()},
                )
            )

        for value, raw in source_sci + source_scaled:
            self.checked_number_count += 1
            if value in translation_values:
                continue
            violation_type = "sci_notation_mismatch" if (value, raw) in source_sci else "number_scale_mismatch"
            violations.append(
                self._violation(
                    unit,
                    violation_type,
                    SEVERITY_CRITICAL,
                    f"数值在译文中对不上：{raw.strip()}（应为 {_human(value)}）",
                    source_needle=raw,
                    translation_needle=None,
                    extra={"expected_value": _canonical(value), "source_token": raw.strip()},
                )
            )

        translation_percents = {
            _canonical(found.group(1))
            for found in re.finditer(r"(?<![\d.])(\d+(?:\.\d+)?)\s*(?:%|％|\\%)", translation)
        }
        for match in _PERCENT_RE.finditer(source):
            number = _canonical(match.group(1))
            self.checked_number_count += 1
            if number in translation_percents or "百分之" in translation:
                continue
            if number in translation_plain:
                violations.append(
                    self._violation(
                        unit,
                        "percent_dropped",
                        SEVERITY_MAJOR,
                        f"百分数 {match.group(0).strip()} 在译文中丢了百分号",
                        source_needle=match.group(0),
                        translation_needle=number,
                        extra={"source_token": match.group(0).strip()},
                    )
                )

        decade_numbers: set[str] = set()
        for match in _DECADE_RE.finditer(source):
            year = match.group(1)
            decade_numbers.add(year)
            self.checked_number_count += 1
            century = int(year[:2]) + 1
            decade = f"{match.group(3)}0"
            if re.search(rf"{century}\s*世纪\s*{decade}\s*年代", translation):
                continue
            if re.search(rf"(?<!\d){year}(?!\d)", translation):
                violations.append(
                    self._violation(
                        unit,
                        "decade_style",
                        SEVERITY_MINOR,
                        f"年代 {match.group(0)} 建议写作「{century} 世纪 {decade} 年代」",
                        source_needle=match.group(0),
                        translation_needle=year,
                        extra={"expected": f"{century} 世纪 {decade} 年代"},
                    )
                )
                continue
            violations.append(
                self._violation(
                    unit,
                    "number_missing",
                    SEVERITY_CRITICAL,
                    f"年代 {match.group(0)} 在译文中缺失",
                    source_needle=match.group(0),
                    translation_needle=None,
                    extra={"missing": [year], "expected": f"{century} 世纪 {decade} 年代"},
                )
            )

        source_numbers = [number for number in _plain_numbers(source) if number not in decade_numbers]
        self.checked_number_count += len(source_numbers)
        translation_set = set(translation_plain) | {_canonical(value) for value in translation_values}
        missing: list[str] = []
        for number in dict.fromkeys(source_numbers):
            if number in translation_set:
                continue
            if number.isdigit() and int(number) <= 10 and _zh_digit_in(translation_raw, int(number)):
                continue
            missing.append(number)
        ocr_noisy = _OCR_NOISE_RE.search(strip_math(source_raw)) is not None
        if missing:
            violations.append(
                self._violation(
                    unit,
                    "number_missing",
                    # 只丢了个位数（多半是 OCR 把 O / B 认成 0 / 8，或译成了中文数词）不报 critical。
                    SEVERITY_MAJOR if ocr_noisy or all(len(number) == 1 for number in missing) else SEVERITY_CRITICAL,
                    "原文中的数字在译文中缺失：" + "、".join(missing[:8]),
                    source_needle=missing[0],
                    translation_needle=None,
                    extra={"missing": missing, "source_ocr_suspect": ocr_noisy},
                )
            )

        source_set = set(source_numbers) | ref_numbers | {_canonical(value) for value, _ in source_sci + source_scaled}
        source_set |= {_canonical(value) for value, _plain, _raw in abbreviated}
        source_set |= {_canonical(plain) for _value, plain, _raw in abbreviated}
        source_set |= {_canonical(match.group(1)) for match in _PERCENT_RE.finditer(source)}
        decade_centuries = {str(int(year[:2]) + 1) for year in decade_numbers}
        decade_tails = {year[2:] for year in decade_numbers}
        has_month = _MONTH_RE.search(source_raw) is not None and bool(re.search(r"\d\s*月", translation_raw))
        extra: list[str] = []
        for number in dict.fromkeys(translation_plain):
            if number in source_set or number in decade_centuries or number in decade_tails:
                continue
            if number.isdigit() and int(number) <= 10 and _number_words_in(source_raw, int(number)):
                continue
            if has_month and number.isdigit() and 1 <= int(number) <= 12:
                continue  # 「May 26」→「5 月 26 日」：月份名换成了数字
            extra.append(number)
        if extra:
            violations.append(
                self._violation(
                    unit,
                    "number_extra",
                    SEVERITY_MINOR if ocr_noisy else SEVERITY_MAJOR,
                    "译文出现了原文没有的数字：" + "、".join(extra[:8]),
                    source_needle=None,
                    translation_needle=extra[0],
                    extra={"extra": extra, "source_ocr_suspect": ocr_noisy},
                )
            )
        return violations

    def _violation(
        self,
        unit: QaUnit,
        violation_type: str,
        severity: str,
        message: str,
        *,
        source_needle: str | None,
        translation_needle: str | None,
        extra: dict,
    ) -> QaViolation:
        return QaViolation(
            check=CHECK_NUMBERS,
            type=violation_type,
            severity=severity,
            message=message,
            item_ids=unit.item_ids,
            page_number=unit.first.page_number,
            block_idx=unit.first.block_idx,
            unit_id=unit.unit_id,
            evidence={
                **extra,
                "source_excerpt": excerpt(unit.source, source_needle),
                "translation_excerpt": excerpt(unit.translated, translation_needle),
            },
        )


def _human(value: Decimal) -> str:
    for label, scale in (("万亿", Decimal(10) ** 12), ("亿", Decimal(10) ** 8), ("万", Decimal(10) ** 4)):
        if abs(value) >= scale:
            return f"{_canonical(value / scale)} {label}"
    return _canonical(value)


__all__ = ["CHECK_NUMBERS", "NumberChecker"]
