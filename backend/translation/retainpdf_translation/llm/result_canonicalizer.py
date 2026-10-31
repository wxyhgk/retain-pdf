from __future__ import annotations

import re

from retainpdf_math.direct_typst import normalize_direct_typst_translation
from retainpdf_translation.llm.citation_style import restore_bracket_citations
from retainpdf_translation.llm.placeholder_transform import repair_safe_duplicate_placeholders
from retainpdf_translation.llm.result_payload import KEEP_ORIGIN_LABEL
from retainpdf_translation.llm.result_payload import normalize_decision
from retainpdf_translation.llm.result_payload import result_entry
from retainpdf_translation.llm.shared.response_parsing import unwrap_translation_shell
from retainpdf_translation.llm.validation.english_residue import is_direct_math_mode
from retainpdf_translation.llm.validation.english_residue import should_force_translate_body_text
from retainpdf_translation.llm.validation.english_residue import unit_source_text


_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
# 中文译文开头留着英文 "where"（数学教材里公式后面接的 "where … is …"）：2026-10-31 量子化学-14 p003-b022、p034-b004
_LEADING_WHERE_RE = re.compile(r"^where\s+(?=\S)", re.IGNORECASE)


def drop_echoed_source(source_text: str, translated_text: str) -> str:
    """模型先把原文抄一遍、后面再接中文译文（"which has the same form as Eq. (8.94).其具有与式 (8.94) 相同的形式。"，
    2026-10-31 量子化学-14 p014-b022）：去掉开头抄的那段。只在剩下的部分有中文时动手。"""
    source = source_text.strip()
    if len(source) < 8 or not translated_text.startswith(source):
        return translated_text
    rest = translated_text[len(source):].strip()
    return rest if _CJK_RE.search(rest) else translated_text


def translate_leading_where(translated_text: str) -> str:
    """中文译文以英文 "where" 开头时换成"其中"（只在后面有中文时）。"""
    match = _LEADING_WHERE_RE.match(translated_text)
    if not match or not _CJK_RE.search(translated_text[match.end():]):
        return translated_text
    return "其中 " + translated_text[match.end():] if translated_text[match.end()] == "$" else "其中" + translated_text[match.end():]


def canonicalize_batch_result(batch: list[dict], result: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    batch_items = {str(item.get("item_id", "") or ""): item for item in batch}
    canonical: dict[str, dict[str, str]] = {}
    for item_id, payload in result.items():
        item = batch_items.get(item_id)
        decision = normalize_decision(str(payload.get("decision", "translate") or "translate"))
        translated_text = unwrap_translation_shell(str(payload.get("translated_text", "") or "").strip(), item_id=item_id)
        if item is not None:
            source_text = unit_source_text(item).strip()
            if decision != KEEP_ORIGIN_LABEL and translated_text:
                repaired_text = repair_safe_duplicate_placeholders(source_text, translated_text)
                if repaired_text is not None:
                    translated_text = repaired_text
            if decision != KEEP_ORIGIN_LABEL and translated_text:
                translated_text = drop_echoed_source(source_text, translated_text)
                translated_text = translate_leading_where(translated_text)
            if (
                decision != KEEP_ORIGIN_LABEL
                and translated_text
                and translated_text == source_text
                and not should_force_translate_body_text(item)
            ):
                decision = KEEP_ORIGIN_LABEL
                translated_text = ""
            # direct_typst 的机械格式规整放在 keep_origin 判定之后:规整会改动
            # 文本,先做会破坏 translated_text == source_text 的原样检测。
            if decision != KEEP_ORIGIN_LABEL and translated_text and is_direct_math_mode(item):
                translated_text = normalize_direct_typst_translation(translated_text)
            # 原文行内 [n] 被模型改成上标时还原，同一篇只留一种引用样式（见 citation_style）。
            if decision != KEEP_ORIGIN_LABEL and translated_text:
                translated_text = restore_bracket_citations(source_text, translated_text)
        canonical[item_id] = result_entry(decision, translated_text)
        if isinstance(payload, dict) and payload.get("final_status"):
            canonical[item_id]["final_status"] = str(payload.get("final_status", "") or canonical[item_id]["final_status"])
    return canonical


__all__ = ["canonicalize_batch_result", "drop_echoed_source", "translate_leading_where"]
