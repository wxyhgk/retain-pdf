"""整块只有一个连接词 / 题解标记时直接给译文，不发模型请求。

实测（data/jobs/20261006023250-703433，一本物理教材）：OCR 把公式之间的 "and"、"where"、"SO"、
"SOLUTION:" 切成独立块，每个都单发一次约 1000 token 的请求；模型还常把它们判成「保留原文」
（p003-b009 / p004-b022 / p021-b010 / p043-b013 的 "and"、p022-b006 的 "SO"），译文里留下英文，
而同一个 "and" 在续段组 p007-b013 里却译成了「和」。

只对**整块就是这一个词**（可带一个尾随标点）且自成翻译单元的块生效：续段组成员只是整段的一截，
必须跟组一起翻；带公式 / 受保护片段的块也不碰。多义、离开上下文译不准的词（"are"、"is"、"as"…）
不进字典，仍交给模型。
"""

from __future__ import annotations

import re

from retainpdf_translation.core.execution_policy import is_isolated_single_unit
from retainpdf_translation.core.item_reader import item_source_text

FIXED_TRANSLATION_REASON = "fixed_connective_translation"

# 键一律小写；匹配时忽略大小写（and / And / AND）。
_FIXED_WORDS: dict[str, str] = {
    "and": "和",
    "or": "或",
    "where": "其中",
    "so": "所以",
    "then": "则",
    "thus": "因此",
    "hence": "因此",
    "therefore": "因此",
    "solution": "解",
    "proof": "证明",
}

# 尾随冒号 / 逗号照搬成中文全角；词与标点之间允许空格（OCR 常出 "SOLUTION :"）。
# 句号不收：单独一个 "so." "and." 多半是 OCR 切错，交给模型。
_TRAILING_PUNCT = {":": "：", "：": "：", ",": "，", "，": "，", "": ""}
_WHOLE_BLOCK_RE = re.compile(r"([A-Za-z]+)\s*([:：,，]?)")


def fixed_translation_for(item: dict) -> str | None:
    if not is_isolated_single_unit(item):
        return None
    if str(item.get("mixed_literal_action", "") or ""):
        return None
    match = _WHOLE_BLOCK_RE.fullmatch(item_source_text(item).strip())
    if match is None:
        return None
    word = _FIXED_WORDS.get(match.group(1).lower())
    if word is None:
        return None
    return word + _TRAILING_PUNCT[match.group(2)]


__all__ = ["FIXED_TRANSLATION_REASON", "fixed_translation_for"]
