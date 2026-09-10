from __future__ import annotations

import re

from retainpdf_pipeline.translate.services.policy.hints import TranslationPolicyHint
from retainpdf_pipeline.translate.services.policy.hints import apply_policy_hints


FIELD_LABEL_RE = re.compile(r"(?:^|\s*[•\-]\s+)([A-Za-z][A-Za-z0-9 _./-]{1,40})\s*:")
SHORT_LITERAL_VALUE_RE = re.compile(
    r"^(?:"
    r"-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?"
    r"|true|false|null|none|yes|no"
    r"|<[^<>\n]{1,80}>"
    r"|\"[^\"]{0,120}\""
    r"|'[^']{0,120}'"
    r"|\[[^\]\n]{1,160}\]"
    r")$",
    re.I,
)
MAX_STRUCTURED_BLOCK_CHARS = 1200
MIN_MULTI_FIELD_LABELS = 2


def _normalized_text(item: dict) -> str:
    return " ".join(str(item.get("source_text", "") or "").split()).strip()


def _field_labels(text: str) -> list[str]:
    labels: list[str] = []
    for match in FIELD_LABEL_RE.finditer(text):
        label = " ".join(match.group(1).split()).strip()
        if label:
            labels.append(label)
    return labels


def _single_field_value(text: str) -> str:
    if ":" not in text:
        return ""
    return text.split(":", 1)[1].strip()


def _is_short_literal_value(text: str) -> bool:
    return bool(SHORT_LITERAL_VALUE_RE.fullmatch(text.strip()))


def _is_structured_field_block(text: str) -> bool:
    labels = _field_labels(text)
    if len(labels) >= MIN_MULTI_FIELD_LABELS:
        return True
    if len(labels) != 1:
        return False
    # A single field is only structural when its value is clearly a literal.
    # Prose such as "Note: This option controls..." must stay normal text.
    return _is_short_literal_value(_single_field_value(text))


def looks_like_structured_technical_block(item: dict) -> bool:
    text = _normalized_text(item)
    if not text or len(text) > MAX_STRUCTURED_BLOCK_CHARS:
        return False
    return _is_structured_field_block(text)


def structured_technical_style_hint(item: dict) -> str:
    if not looks_like_structured_technical_block(item):
        return ""
    labels = _field_labels(_normalized_text(item))
    label_text = "、".join(labels[:6])
    return (
        "这是技术文档中的结构化条目"
        + (f"（字段包括：{label_text}）" if label_text else "")
        + "。请保持字段名、字段顺序、列表符号、分隔符和换行排版稳定；"
        "字段值、类型标记、枚举、路径、命令、变量名、文件名、代码片段和尖括号内容应原样保留；"
        "只翻译字段值中明显属于自然语言说明的部分。不要把结构化字段名随意改写成另一种语言。"
    )


def collect_structured_technical_hints(payload: list[dict]) -> list[TranslationPolicyHint]:
    hints: list[TranslationPolicyHint] = []
    for item in payload:
        hint = structured_technical_style_hint(item)
        if not hint:
            continue
        item_id = str(item.get("item_id", "") or "")
        if not item_id:
            continue
        hints.append(
            TranslationPolicyHint(
                item_id=item_id,
                structure_kind="structured_technical_block",
                style_hint=hint,
            )
        )
    return hints


def apply_structured_technical_context(payload: list[dict]) -> int:
    """Compatibility wrapper; new policy flow should collect hints first."""

    return apply_policy_hints(payload, collect_structured_technical_hints(payload))


__all__ = [
    "apply_structured_technical_context",
    "collect_structured_technical_hints",
    "looks_like_structured_technical_block",
    "structured_technical_style_hint",
]
