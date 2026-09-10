import re

from ..formula_protection import restore_inline_formulas
from ..formula_protection import restore_protected_tokens
from .common import (
    clear_translation_fields,
    effective_translation_unit_id,
    existing_group_unit_id,
    is_group_unit_id,
)
from .final_status import TRANSLATED_STATUS
from .final_status import set_final_status
from .group_split import math_spans
from .group_split import split_group_protected_translation
from .result_entries import extract_result_metadata
from .result_entries import normalize_result_entry
from .result_entries import result_diagnostics_for_item
from .result_entries import with_sanitized_translation
from .result_status import KEEP_ORIGIN_LABEL
from .result_status import mark_keep_origin
from .result_status import mark_translation_failed
from .translation_units import refresh_payload_translation_units

SOURCE_TERMINAL_RE = re.compile(r"[.!?。！？；;:：)\]）】”’\"']\s*$")
TRANSLATION_SENTENCE_START_RE = re.compile(r"(?<=[。！？；])")
_split_group_protected_translation = split_group_protected_translation


def _source_looks_incomplete(text: str) -> bool:
    source = str(text or "").strip()
    if not source:
        return False
    return SOURCE_TERMINAL_RE.search(source) is None


def _sentence_start_before(text: str, index: int) -> int:
    starts = [0]
    for match in TRANSLATION_SENTENCE_START_RE.finditer(text[: max(0, index)]):
        starts.append(match.end())
    return max(starts)


def _sanitize_neighbor_continuation_leak(
    protected_translated_text: str,
    metadata: dict,
    item: dict,
    next_item: dict | None,
) -> tuple[str, dict]:
    if next_item is None or not protected_translated_text:
        return protected_translated_text, metadata
    source_text = str(item.get("protected_source_text") or item.get("source_text") or "")
    if not _source_looks_incomplete(source_text):
        return protected_translated_text, metadata
    next_source_text = str(next_item.get("protected_source_text") or next_item.get("source_text") or "")
    if not next_source_text:
        return protected_translated_text, metadata

    current_math = set(math_spans(source_text))
    leaked_math = [
        expr
        for expr in math_spans(next_source_text)
        if expr not in current_math and expr in protected_translated_text
    ]
    if not leaked_math:
        return protected_translated_text, metadata

    first_hit = min(protected_translated_text.find(expr) for expr in leaked_math if protected_translated_text.find(expr) >= 0)
    candidate = protected_translated_text[:first_hit].rstrip()
    candidate = re.sub(r"[，,、\s]*(?:在|为|是|等于|对于)\s*$", "", candidate).rstrip()
    if len(candidate) < 8:
        trim_at = _sentence_start_before(protected_translated_text, first_hit)
        candidate = protected_translated_text[:trim_at].rstrip()
    if not candidate or len(candidate) < 8:
        return protected_translated_text, metadata

    metadata = dict(metadata)
    diagnostics = dict(metadata.get("translation_diagnostics") or {})
    diagnostics["degradation_reason"] = "neighbor_continuation_leak_trimmed"
    diagnostics["final_status"] = "partially_translated"
    diagnostics["trimmed_next_math"] = leaked_math[:3]
    metadata["translation_diagnostics"] = diagnostics
    metadata["final_status"] = "partially_translated"
    return candidate, metadata


def _join_prefix_and_tail(prefix: str, tail: str) -> str:
    left = prefix.rstrip()
    right = tail.strip()
    if not left:
        return right
    if not right:
        return left
    if right[:1] in ",.;:!?)]}":
        return left + right
    return f"{left} {right}"


def _structured_group_member_chunks(raw_result, items: list[dict]) -> list[str] | None:
    if not isinstance(raw_result, dict) or len(items) <= 1:
        return None
    raw_members = raw_result.get("member_translations")
    if raw_members is None:
        raw_members = raw_result.get("translations")
    if not isinstance(raw_members, list):
        return None

    by_item_id: dict[str, str] = {}
    for entry in raw_members:
        if not isinstance(entry, dict):
            continue
        item_id = str(entry.get("item_id", "") or "").strip()
        translated_text = str(entry.get("translated_text", "") or "").strip()
        if item_id and translated_text:
            by_item_id[item_id] = translated_text

    chunks: list[str] = []
    for item in items:
        item_id = str(item.get("item_id", "") or "").strip()
        chunk = by_item_id.get(item_id, "")
        if not chunk:
            return None
        chunks.append(chunk)
    return chunks


def _structured_chunks_reconstruct_group(chunks: list[str], protected_group_text: str) -> bool:
    compact_group = re.sub(r"[\s，,、]+", "", str(protected_group_text or ""))
    compact_chunks = re.sub(r"[\s，,、]+", "", "".join(chunks))
    return bool(compact_group) and compact_chunks == compact_group


def apply_group_translated_entry(items: list[dict], raw_result) -> None:
    if not items:
        return
    metadata = extract_result_metadata(raw_result)
    decision, protected_translated_text = normalize_result_entry(raw_result)
    protected_translated_text, metadata = with_sanitized_translation(protected_translated_text, metadata)
    if str(metadata.get("final_status", "") or "").strip() == "failed":
        for item in items:
            mark_translation_failed(item, metadata)
        return
    if decision == "keep_origin":
        for item in items:
            mark_keep_origin(item)
            diagnostics = result_diagnostics_for_item(metadata, item)
            if diagnostics:
                item["translation_diagnostics"] = diagnostics
        return
    formula_map = items[0].get("translation_unit_formula_map") or items[0].get("group_formula_map", [])
    protected_map = items[0].get("translation_unit_protected_map") or items[0].get("group_protected_map") or formula_map
    restored = restore_protected_tokens(protected_translated_text, protected_map)
    member_chunks = _structured_group_member_chunks(raw_result, items)
    rejected_structured_chunks = False
    if member_chunks is not None and not _structured_chunks_reconstruct_group(
        member_chunks,
        protected_translated_text,
    ):
        member_chunks = None
        rejected_structured_chunks = True
    structured_member_chunks = member_chunks is not None
    if member_chunks is None:
        member_chunks = split_group_protected_translation(protected_translated_text, items)
    for item, member_protected_text in zip(items, member_chunks):
        if not item.get("should_translate", True):
            clear_translation_fields(item)
            continue
        item["translation_unit_protected_translated_text"] = protected_translated_text
        item["translation_unit_translated_text"] = restored
        item["group_protected_translated_text"] = protected_translated_text
        item["group_translated_text"] = restored
        item["protected_translated_text"] = member_protected_text
        item["translated_text"] = restore_protected_tokens(member_protected_text, protected_map)
        diagnostics = result_diagnostics_for_item(metadata, item)
        if structured_member_chunks:
            diagnostics = dict(diagnostics or {})
            diagnostics["group_member_translation_source"] = "structured"
        elif rejected_structured_chunks:
            diagnostics = dict(diagnostics or {})
            diagnostics["group_member_translation_source"] = "source_weighted_fallback"
            diagnostics["group_member_translation_fallback_reason"] = "inconsistent_structured_members"
        if diagnostics:
            item["translation_diagnostics"] = diagnostics
        set_final_status(item, str(metadata.get("final_status", "") or TRANSLATED_STATUS))


def apply_single_translated_entry(
    item: dict,
    raw_result,
    *,
    next_item: dict | None = None,
    preserved_group_unit_id: str = "",
) -> None:
    item_id = item.get("item_id")
    metadata = extract_result_metadata(raw_result)
    decision, protected_translated_text = normalize_result_entry(raw_result)
    protected_translated_text, metadata = with_sanitized_translation(protected_translated_text, metadata)
    protected_translated_text, metadata = _sanitize_neighbor_continuation_leak(
        protected_translated_text,
        metadata,
        item,
        next_item,
    )
    if str(metadata.get("final_status", "") or "").strip() == "failed":
        mark_translation_failed(item, metadata)
        return
    if decision == "keep_origin":
        mark_keep_origin(item)
        diagnostics = result_diagnostics_for_item(metadata, item)
        if diagnostics:
            item["translation_diagnostics"] = diagnostics
        return
    item["translation_unit_protected_translated_text"] = protected_translated_text
    item["translation_unit_translated_text"] = restore_protected_tokens(
        protected_translated_text,
        item.get("translation_unit_protected_map")
        or item.get("translation_unit_formula_map")
        or item.get("protected_map")
        or item.get("formula_map", []),
    )
    if str(item.get("mixed_literal_action", "") or "") == "translate_tail":
        prefix = str(item.get("mixed_literal_prefix", "") or "")
        item["translation_unit_protected_translated_text"] = _join_prefix_and_tail(
            prefix,
            item["translation_unit_protected_translated_text"],
        )
        item["translation_unit_translated_text"] = _join_prefix_and_tail(
            prefix,
            item["translation_unit_translated_text"],
        )
    item["protected_translated_text"] = protected_translated_text
    item["translated_text"] = restore_protected_tokens(
        protected_translated_text,
        item.get("protected_map") or item.get("formula_map", []),
    )
    if str(item.get("mixed_literal_action", "") or "") == "translate_tail":
        prefix = str(item.get("mixed_literal_prefix", "") or "")
        item["protected_translated_text"] = _join_prefix_and_tail(prefix, item["protected_translated_text"])
        item["translated_text"] = _join_prefix_and_tail(prefix, item["translated_text"])
    if preserved_group_unit_id:
        item["translation_unit_id"] = preserved_group_unit_id
        item["translation_unit_kind"] = "group"
        item["translation_unit_member_ids"] = [str(item_id or "")]
    diagnostics = result_diagnostics_for_item(metadata, item)
    if diagnostics:
        item["translation_diagnostics"] = diagnostics
    set_final_status(item, str(metadata.get("final_status", "") or TRANSLATED_STATUS))


def apply_reconstructed_unit_text(items: list[dict], translated_text: str) -> None:
    # 乱码重建的整单元替换写入:重建输出是成品显示文本(调用方已完成
    # reasoning 泄漏清洗与占位符还原),整个单元共用同一段译文,
    # 六个译文字段同值落盘,group_* 与 translation_unit_* 天然保持同步。
    # 不做邻段泄漏裁剪与 mixed_literal 拼接——那些针对逐项翻译输出。
    for item in items:
        item["protected_translated_text"] = translated_text
        item["translated_text"] = translated_text
        item["translation_unit_protected_translated_text"] = translated_text
        item["translation_unit_translated_text"] = translated_text
        item["group_protected_translated_text"] = translated_text
        item["group_translated_text"] = translated_text


def apply_translated_text_map(payload: list[dict], translated: dict) -> None:
    next_item_by_id = {
        str(item.get("item_id", "") or ""): payload[index + 1] if index + 1 < len(payload) else None
        for index, item in enumerate(payload)
    }
    preserved_group_units = {
        str(item.get("item_id", "") or ""): existing_group_unit_id(item)
        for item in payload
        if str(item.get("item_id", "") or "") in translated and existing_group_unit_id(item)
    }
    refresh_payload_translation_units(payload)
    group_items: dict[str, list[dict]] = {}
    for item in payload:
        unit_id = effective_translation_unit_id(item)
        if is_group_unit_id(unit_id):
            group_items.setdefault(unit_id, []).append(item)

    for item_id, raw_result in translated.items():
        if not is_group_unit_id(item_id):
            continue
        apply_group_translated_entry(group_items.get(item_id, []), raw_result)

    for item in payload:
        item_id = item.get("item_id")
        if item_id not in translated:
            continue
        apply_single_translated_entry(
            item,
            translated[item_id],
            next_item=next_item_by_id.get(str(item_id or "")),
            preserved_group_unit_id=preserved_group_units.get(str(item_id or ""), ""),
        )
