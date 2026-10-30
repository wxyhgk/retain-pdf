"""每页的上下文包：大小固定（默认约 7000 token），不随文章变长而变大。

包里有：风格说明、本页出现的术语、保留原文的专名、缩写、上一页结尾和下一页开头、本章摘要。每部分有预算；
总数超了按 摘要 → 相邻页 → 保留原文 → 缩写 → 候选术语 → 审定术语 的顺序往下砍（越靠后越重要）。
token 按"ASCII 四个字符一个、其余一个字符一个"粗估，够用来卡预算。
"""

from __future__ import annotations

import hashlib
import json

from retainpdf_translation_agent.contract import PageInput
from retainpdf_translation_agent.memory import ABBR
from retainpdf_translation_agent.memory import KEEP
from retainpdf_translation_agent.memory import TERM
from retainpdf_translation_agent.memory import Glossary

DEFAULT_BUDGET = 7000
# 各部分占总预算的比例（总预算 7000 时：风格 500、术语 1500、缩写和保留原文 700、相邻页 1000、摘要 1000）
SHARES = {"style": 500, "terms": 1500, "names": 700, "neighbors": 1000, "summary": 1000}
NEIGHBOR_BLOCKS = 2
PREVIOUS_CHARS = 400
NEXT_CHARS = 300


def estimate_tokens(value) -> int:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    ascii_chars = sum(1 for ch in text if ord(ch) < 128)
    return ascii_chars // 4 + (len(text) - ascii_chars)


def _tail(text: str, limit: int) -> str:
    return text if len(text) <= limit else "…" + text[-limit:]


def _head(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit] + "…"


def _fit(items: list, limit: int) -> tuple[list, int]:
    """从前往后留，留到预算用完；返回留下的和砍掉的条数。"""
    kept, used = [], 0
    for item in items:
        cost = estimate_tokens(item)
        if used + cost > limit:
            break
        kept.append(item)
        used += cost
    return kept, len(items) - len(kept)


def build_context(
    page: PageInput,
    glossary: Glossary,
    *,
    previous: list[dict] | None = None,
    next_blocks: list[dict] | None = None,
    style: str = "",
    summary: str = "",
    used_abbreviations: set[str] | None = None,
    budget: int = DEFAULT_BUDGET,
) -> dict:
    """`previous`：上一页已经定下的块 [{"id", "source", "translation"}]；`next_blocks`：下一页要翻的块 [{"id", "source"}]。"""
    scale = budget / DEFAULT_BUDGET
    limits = {name: int(share * scale) for name, share in SHARES.items()}
    text = "\n".join(b.text for b in page.blocks if b.translate)
    found = glossary.lookup(text, page.chapter)
    used_abbreviations = used_abbreviations or set()
    # 审定、锁定的排前面：预算不够时先砍候选
    terms = sorted((t for t in found if t.category == TERM), key=lambda t: (not t.binds(page.chapter), t.source.lower()))
    keep = [t for t in found if t.category == KEEP]
    abbreviations = [t for t in found if t.category == ABBR]

    truncated: dict[str, int] = {}
    term_items, cut = _fit([t.for_context(page.chapter) for t in terms], limits["terms"])
    if cut:
        truncated["terms"] = cut
    abbr_items = [
        {
            "id": t.id,
            "abbr": t.source,
            "expansion": t.note,
            "defined_on": t.first_seen.get("page", ""),
            "first_use": t.source not in used_abbreviations,
        }
        for t in abbreviations
    ]
    names, cut = _fit(abbr_items + [t.for_context(page.chapter) for t in keep], limits["names"])
    if cut:
        truncated["names"] = cut
    neighbor_items = [
        {"page": "previous", "id": b["id"], "source": _tail(b["source"], PREVIOUS_CHARS), "translation": _tail(b.get("translation") or "", PREVIOUS_CHARS)}
        for b in (previous or [])[-NEIGHBOR_BLOCKS:]
    ] + [{"page": "next", "id": b["id"], "source": _head(b["source"], NEXT_CHARS)} for b in (next_blocks or [])[:NEIGHBOR_BLOCKS]]
    neighbors, cut = _fit(neighbor_items, limits["neighbors"])
    if cut:
        truncated["neighbors"] = cut
    style_text = _head(style, limits["style"])
    summary_text = _head(summary, limits["summary"])

    context = {
        "glossary_version": glossary.version,
        "style": style_text,
        "terms": term_items,
        "abbreviations": [n for n in names if "abbr" in n],
        "keep": [n for n in names if "abbr" not in n],
        "previous": [n for n in neighbors if n["page"] == "previous"],
        "next": [n for n in neighbors if n["page"] == "next"],
        "summary": summary_text,
    }
    # 总数还超（各部分预算之和可能比总预算大）：按顺序砍，越靠后越重要
    for name in ("summary", "previous", "next", "keep", "abbreviations", "terms"):
        while estimate_tokens(context) > budget and context[name]:
            if isinstance(context[name], str):
                context[name] = ""
                truncated[name] = truncated.get(name, 0) + 1
            else:
                context[name] = context[name][:-1]
                truncated[name] = truncated.get(name, 0) + 1
    context = {k: v for k, v in context.items() if v or k == "glossary_version"}
    if truncated:
        context["truncated"] = truncated
    context["hash"] = context_hash(context)
    context["estimated_tokens"] = estimate_tokens(context)
    return context


def context_hash(context: dict) -> str:
    body = {k: v for k, v in context.items() if k not in {"hash", "estimated_tokens"}}
    return hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:16]


def context_terms(context: dict) -> list[dict]:
    """包里的全部术语、保留原文、缩写（带上类别）。"""
    out = [dict(t) for t in context.get("terms") or []]
    out += [dict(t, category=KEEP) for t in context.get("keep") or []]
    out += [{"id": a["id"], "source": a["abbr"], "target": a["abbr"], "category": ABBR, "status": "approved"} for a in context.get("abbreviations") or []]
    return out


def binding_terms(context: dict) -> list[dict]:
    """必须照用的：审定、锁定的术语和保留原文，以及全部缩写（给校验用）。"""
    return [t for t in context_terms(context) if t.get("status") in ("approved", "locked")]
