"""模型把原文原样交回时，有要翻的英文就带一句提示再翻一次。

规整结果时（``llm/result_canonicalizer.py``）译文和原文一字不差、又不是"必须翻"的长正文，就悄悄当成保留原文——那条规则是给
代码、人名、编号留的，可短句和短标题也一起放过了：2026-10-31 量子化学-14 "which has the same form as Eq. (8.94)."
被原样交回（medium、low 两档都这样），关思考时 "EXAMPLE"、"We have"、"Matrix Form of the Roothaan Equations" 也是。
现在：原文里有正常英文单词时重翻一次，提示模型这是要翻的英文；第二次还是原样就照旧保留原文（人名、代号本来就不该硬翻）。
"""

from __future__ import annotations

import re

from retainpdf_translation.core.item_reader import item_content_kind
from retainpdf_translation.core.item_reader import item_is_reference_compatible
from retainpdf_translation.core.text_rules import looks_like_code_literal_text_value
from retainpdf_translation.core.text_rules import looks_like_url_fragment
from retainpdf_translation.llm.result_payload import KEEP_ORIGIN_LABEL
from retainpdf_translation.llm.validation.english_residue import unit_source_text
from retainpdf_translation.llm.validation.placeholder_tokens import strip_placeholders

# 正常英文单词：首字母可大写、后面至少两个小写字母（"which"、"First"），或者四个字母以上的全大写词（"EXAMPLE"）；
# DFT、NMR 这类缩写不算
_WORD_RE = re.compile(r"\b(?:[A-Za-z][a-z]{2,}|[A-Z]{4,})\b")
_MATH_RE = re.compile(r"\$[^$]*\$")

RETRY_HINT = "注意：这段原文是要翻译的英文（短句、标题也要翻），请译成{target}；只有人名、代号、软件名、公式这类本来不翻的内容才原样返回。"


def worth_retrying_identical_copy(item: dict, result: dict[str, dict[str, str]]) -> bool:
    """这次结果是不是"原样交回被当成保留原文"、而原文里明明有要翻的英文。"""
    payload = result.get(str(item.get("item_id") or "")) or {}
    if str(payload.get("decision") or "") != KEEP_ORIGIN_LABEL:
        return False
    if item_content_kind(item) != "text" or item_is_reference_compatible(item):
        return False
    source = _MATH_RE.sub(" ", strip_placeholders(unit_source_text(item))).strip()
    if not source or looks_like_code_literal_text_value(source) or looks_like_url_fragment(source):
        return False
    return _WORD_RE.search(source) is not None


def with_translate_hint(item: dict, *, target_language_name: str) -> dict:
    """重翻用的条目副本：风格提示里加一句"这是要翻的英文"（风格提示会进请求的 prompt）。"""
    hint = RETRY_HINT.format(target=target_language_name or "简体中文")
    existing = str(item.get("translation_style_hint") or "").strip()
    return {**item, "translation_style_hint": f"{existing}\n{hint}" if existing else hint}


__all__ = ["RETRY_HINT", "with_translate_hint", "worth_retrying_identical_copy"]
