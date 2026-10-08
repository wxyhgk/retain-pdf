"""把翻译 payload 整理成 QA 的核对单元。

续接组（continuation group）的译文是整组一起翻、再分配回各成员的，成员之间的语序
可能互换。所以内容保真类检查（数字、引用、术语、漏译）一律按「整组原文 ↔ 整组译文」比；
这里的整组原文/译文都由**成员自己的**原文、译文按阅读顺序拼起来，两边口径一致。
不要拿 group / translation_unit 的整组原文去比单个成员的译文——那正是
translation_review 里 truncated_translation 误报的来源。

标点、残留英文这类只看译文本身的检查按块做，仍定位到具体成员。
"""
from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field

from retainpdf_pipeline.translate.core.item_reader import item_block_class
from retainpdf_pipeline.translate.core.item_reader import item_is_algorithm_like
from retainpdf_pipeline.translate.core.item_reader import item_is_reference_compatible
from retainpdf_pipeline.translate.core.text_rules import looks_like_code_literal_text_value
from retainpdf_pipeline.translate.core.text_rules import looks_like_reference_entry_text
from retainpdf_pipeline.translate.llm.validation.english_residue import is_direct_math_mode


TRANSLATED_STATUS = "translated"
EMPTY_TRANSLATION_REASON = "empty_translation"


@dataclass
class QaItem:
    item_id: str
    page_idx: int
    block_idx: int
    order: int
    block_class: str
    source: str
    protected_source: str
    translated: str
    protected_translated: str
    checked: bool
    skip_reason: str
    is_reference: bool
    is_code: bool
    direct_math: bool
    unit_id: str = ""
    member_ids: list[str] = field(default_factory=list)

    @property
    def page_number(self) -> int:
        return self.page_idx + 1


@dataclass
class QaUnit:
    unit_id: str
    kind: str
    members: list[QaItem] = field(default_factory=list)
    order: int = 0

    @property
    def checked_members(self) -> list[QaItem]:
        return [member for member in self.members if member.checked]

    @property
    def checked(self) -> bool:
        return bool(self.checked_members)

    @property
    def content_members(self) -> list[QaItem]:
        # 参与内容比对的成员：已翻译的，加上「标成已翻译但译文是空的」——后者正是漏译，
        # 不能被排除掉。保留原文 / 公式成员两边都不算，免得原文多出一截被当成漏译。
        return [
            member
            for member in self.members
            if member.checked or member.skip_reason == EMPTY_TRANSLATION_REASON
        ]

    @property
    def source(self) -> str:
        return _join(member.source for member in self.content_members)

    @property
    def translated(self) -> str:
        return _join(member.translated for member in self.content_members)

    @property
    def protected_source(self) -> str:
        return _join(member.protected_source for member in self.content_members)

    @property
    def protected_translated(self) -> str:
        return _join(member.protected_translated for member in self.content_members)

    @property
    def item_ids(self) -> list[str]:
        return [member.item_id for member in self.members]

    @property
    def first(self) -> QaItem:
        return self.members[0]

    @property
    def direct_math(self) -> bool:
        return any(member.direct_math for member in self.members)

    @property
    def is_reference(self) -> bool:
        return any(member.is_reference for member in self.members)


def _join(parts) -> str:
    return " ".join(str(part).strip() for part in parts if str(part or "").strip())


def _block_own_source(item: dict) -> tuple[str, str]:
    # QA 要的是「这一块自己的」原文，范围比 item_source_text 那条完整链窄：
    # 那条链优先取整组 / 整个翻译单元的原文，用在这里会把整组原文算到单个成员头上。
    readable = str(item.get("source_text") or "")
    protected = str(item.get("protected_source_text") or "") or readable
    return readable, protected


def _skip_reason(item: dict, translated: str) -> str:
    if item_block_class(item) == "formula" or str(item.get("block_type", "") or "") == "formula":
        return "formula_block"
    if str(item.get("final_status", "") or "") != TRANSLATED_STATUS:
        return f"final_status:{str(item.get('final_status', '') or 'unknown')}"
    if not translated.strip():
        return EMPTY_TRANSLATION_REASON
    return ""


def build_qa_items(translated_pages_map: dict[int, list[dict]]) -> list[QaItem]:
    items: list[QaItem] = []
    order = 0
    for page_idx, page_items in sorted(translated_pages_map.items()):
        for item in page_items or []:
            item_id = str(item.get("item_id", "") or "")
            if not item_id:
                continue
            source, protected_source = _block_own_source(item)
            translated = str(item.get("translated_text") or "")
            protected_translated = str(item.get("protected_translated_text") or "") or translated
            skip_reason = _skip_reason(item, translated)
            items.append(
                QaItem(
                    item_id=item_id,
                    page_idx=int(item.get("page_idx", page_idx) if item.get("page_idx") is not None else page_idx),
                    block_idx=int(item.get("block_idx", -1) if item.get("block_idx") is not None else -1),
                    order=order,
                    block_class=item_block_class(item),
                    source=source,
                    protected_source=protected_source,
                    translated=translated,
                    protected_translated=protected_translated,
                    checked=not skip_reason,
                    skip_reason=skip_reason,
                    is_reference=bool(item_is_reference_compatible(item))
                    or looks_like_reference_entry_text(source),
                    is_code=bool(item_is_algorithm_like(item)) or looks_like_code_literal_text_value(source),
                    direct_math=is_direct_math_mode(item),
                    unit_id=_unit_id(item, item_id),
                    member_ids=_member_ids(item),
                )
            )
            order += 1
    return items


def _member_ids(item: dict) -> list[str]:
    members = item.get("translation_unit_member_ids")
    if not isinstance(members, list):
        return []
    return [str(value) for value in members if str(value or "")]


def _unit_id(item: dict, item_id: str) -> str:
    kind = str(item.get("translation_unit_kind", "") or "")
    unit_id = str(item.get("translation_unit_id", "") or "")
    members = item.get("translation_unit_member_ids")
    if kind == "group" and unit_id and isinstance(members, list) and len(members) > 1:
        return unit_id
    return item_id


def build_qa_units(items: list[QaItem]) -> list[QaUnit]:
    """按阅读顺序把块归并成核对单元；单块单元的 unit_id 就是 item_id。"""
    by_id = {item.item_id: item for item in items}
    units: dict[str, QaUnit] = {}
    ordered: list[QaUnit] = []
    for item in items:
        unit = units.get(item.unit_id)
        if unit is None:
            kind = "group" if item.unit_id != item.item_id else "single"
            unit = QaUnit(unit_id=item.unit_id, kind=kind, order=len(ordered))
            units[item.unit_id] = unit
            ordered.append(unit)
            if kind == "group":
                # 成员顺序以 translation_unit_member_ids 为准（跨页时比扫描顺序可靠）；
                # 页码范围外的成员不在本次 payload 里，直接略过。
                for member_id in item.member_ids:
                    member = by_id.get(member_id)
                    if member is not None and member.unit_id == item.unit_id:
                        unit.members.append(member)
        if item not in unit.members:
            unit.members.append(item)
    return ordered


__all__ = [
    "QaItem",
    "QaUnit",
    "build_qa_items",
    "build_qa_units",
]
