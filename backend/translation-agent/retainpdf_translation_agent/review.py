"""审校（第 2 版的轻量做法，用户 10-30 定先用 Haiku）：每页翻完，对照原文找程序查不出的错，只开问题单；程序按单子改。

实测（3 个 Sonnet 审读）程序校验抓不到的主要是词义判断错（set 译成"设置"、points 译成"点"、"a hundred times as much"
译成"多一百倍"、sorry 译成"懊悔"）、漏掉限定词、语气被加强。做法：

1. 选块：正文类（段落、摘要、脚注、列表项、图注表题……）、8 个词以上、已经过了校验的块。
2. 一次请求把这页选中的块（原文 + 译文 + 上下文包里的术语和人名）交给审校。审校只开五类单子：错译、漏译或添加、
   数字或术语、不通顺、语气偏离；每张单子逐字引用原文片段和译文片段，并给出只替换那段译文的改法。"更自然"不收。
3. 程序裁判：原文片段在原文里找得到（不分大小写、空白）、译文片段在译文里逐字找得到、改法和原片段不同，才收；
   按单子把那一段替换掉，再跑一遍校验，错误和警告只许减少不许增加，否则不改。每块最多改 2 处。
   修订就是这次替换，不再调模型，所以审校每页只多一次请求。
"""

from __future__ import annotations

import re

from retainpdf_translation_agent.checks import check_block
from retainpdf_translation_agent.checks import status_of
from retainpdf_translation_agent.checks import style_signals
from retainpdf_translation_agent.context import context_terms
from retainpdf_translation_agent.contract import STATUS_OK
from retainpdf_translation_agent.contract import STATUS_WARN
from retainpdf_translation_agent.contract import BlockResult
from retainpdf_translation_agent.contract import PageInput

REVIEW_CLASSES = {"paragraph", "abstract", "footnote", "list_item", "figure_caption", "table_caption", "float_note", "margin_note", "acknowledgement"}
MIN_WORDS = 8
MAX_EDITS_PER_BLOCK = 2
BLOCK_CHECK_CODES = {
    "missing", "empty", "formula_unbalanced", "code_changed", "citation_lost", "footnote_mark_lost",
    "number_lost", "untranslated", "no_chinese", "english_residue", "stray_english", "too_short", "too_long", "hedge_lost", "person_lost",
}  # fmt: skip
CATEGORIES = {"mistranslation": "错译", "omission": "漏译或添加", "number_term": "数字或术语", "fluency": "不通顺", "tone": "语气偏离"}

REVIEW_PROMPT = """你是英译中学术翻译的审校。你会收到一页里若干块的英文原文和中文译文，以及全书定好的术语和人名。
逐块对照原文读译文，只找**确实错了**的地方，开问题单。只收五类：
- mistranslation 错译：意思错、主宾或逻辑颠倒、否定丢了、数量和倍数错（"a hundred times as much"是"……的一百倍"不是"多一百倍"）、
  一词多义选错（排版里 set 是"排"不是"设置"，points 是"磅"或"百分点"，sorry 在惋惜时不是"懊悔"）；
- omission 漏译或添加：少了分句、限定词、例子、修饰语，或多了原文没有的意思；
- number_term 数字或术语：数字、单位、编号错，或者没用定好的术语、人名译法；
- fluency 不通顺：读不通、明显的翻译腔、中文里夹着没翻的英文词；
- tone 语气偏离：作者的保留语气（may、perhaps、suggest）被加强或丢掉，口语被写成公文，反之亦然。
"可以更自然""换个说法更好"这类不收。没把握就不开。

每张单子：block_id、category、source_quote（原文里逐字照抄的那一小段）、translation_quote（译文里逐字照抄的、要改的那一小段，
越短越好，但要能唯一定位）、fix（替换 translation_quote 的新译文，只改这一段，公式、标记、编号照原样）、reason（一句话）。
一页没有问题就交空列表。
"""

REVIEW_TOOL = {
    "name": "submit_review",
    "description": "交回这一页的问题单（没有问题就是空列表）。",
    "input_schema": {
        "type": "object",
        "properties": {
            "issues": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "block_id": {"type": "string"},
                        "category": {"type": "string", "enum": sorted(CATEGORIES)},
                        "source_quote": {"type": "string"},
                        "translation_quote": {"type": "string"},
                        "fix": {"type": "string"},
                        "reason": {"type": "string"},
                    },
                    "required": ["block_id", "category", "source_quote", "translation_quote", "fix", "reason"],
                },
            }
        },
        "required": ["issues"],
    },
}


def _norm(text: str) -> str:
    return " ".join(text.split()).lower()


def reviewable(page: PageInput, results: dict[str, BlockResult]) -> list:
    out = []
    for block in page.to_translate():
        result = results.get(block.id)
        if (
            result is not None
            and result.translation
            and result.status in (STATUS_OK, STATUS_WARN)
            and block.cls in REVIEW_CLASSES
            and len(block.text.split()) >= MIN_WORDS
        ):
            out.append(block)
    return out


def review_page(agent, page: PageInput, results: dict[str, BlockResult]) -> dict:
    """审一页并按收下的单子改 `results`（就地改）。返回这一页的审校记录：收了哪些、拒了哪些、为什么。"""
    from retainpdf_translation_agent.agent import ROLE_REVIEWER

    blocks = reviewable(page, results)
    report: dict = {"reviewed": len(blocks), "tickets": 0, "applied": [], "rejected": []}
    if not blocks:
        return report
    glossary = [
        {"source": t["source"], "target": t["target"]} for t in context_terms(page.context or {}) if t.get("status") in ("approved", "locked") and t.get("category") != "abbr"
    ]
    payload = {
        "document": page.document,
        "page": page.page_label,
        "style": (page.context or {}).get("style", ""),
        "glossary": glossary,
        "blocks": [{"id": b.id, "class": b.cls, "source": b.text, "translation": results[b.id].translation} for b in blocks],
    }
    try:
        data = agent.call_tool(payload, system=REVIEW_PROMPT, tool=REVIEW_TOOL, role=ROLE_REVIEWER, label=f"review {page.page_label}", blocks=[b.id for b in blocks])
    except ValueError:
        report["error"] = "no submit_review tool call"
        return report
    by_id = {b.id: b for b in blocks}
    edits: dict[str, int] = {}
    tickets = [t for t in data.get("issues") or [] if isinstance(t, dict)]
    report["tickets"] = len(tickets)
    for ticket in tickets:
        verdict = _apply(ticket, by_id, results, edits)
        (report["applied"] if verdict == "applied" else report["rejected"]).append(dict(ticket, verdict=verdict))
    return report


def _apply(ticket: dict, by_id: dict, results: dict[str, BlockResult], edits: dict[str, int]) -> str:
    block = by_id.get(str(ticket.get("block_id", "")))
    if block is None:
        return "unknown_block"
    if ticket.get("category") not in CATEGORIES:
        return "bad_category"
    if edits.get(block.id, 0) >= MAX_EDITS_PER_BLOCK:
        return "too_many_edits"
    source_quote = str(ticket.get("source_quote", ""))
    old, fix = str(ticket.get("translation_quote", "")), str(ticket.get("fix", ""))
    if not source_quote.strip() or _norm(source_quote) not in _norm(block.text):
        return "source_quote_not_found"
    result = results[block.id]
    current = result.translation or ""
    if not old or old not in current:
        return "translation_quote_not_found"
    if current.count(old) > 1:
        return "translation_quote_ambiguous"
    if not fix.strip() or fix == old:
        return "no_change"
    revised = current.replace(old, fix, 1)
    before = check_block(block.text, current)
    after = check_block(block.text, revised)
    # 错误和警告（数字丢了、残留英文……）都算：改完只许少不许多
    errors_before = {i["code"] for i in before if i["severity"] in ("error", "warn")}
    errors_after = {i["code"] for i in after if i["severity"] in ("error", "warn")}
    signals_before = {i["code"] for i in style_signals(block.text, current)}
    signals_after = {i["code"] for i in style_signals(block.text, revised)}
    # 裁判：错误只许减少；语气信号（表示保留的词、人称）也不许新丢
    if not errors_after <= errors_before or not signals_after <= signals_before:
        return "referee_rejected"
    if re.search(r"\[\[BREAK\]\]", fix):
        return "referee_rejected"
    edits[block.id] = edits.get(block.id, 0) + 1
    note = {
        "code": f"review_{ticket['category']}",
        "severity": "info",
        "message": f"审校（{CATEGORIES[ticket['category']]}）：“{old}” → “{fix}”。{str(ticket.get('reason', ''))[:120]}",
    }
    result.history = result.history + [{"translation": current, "issues": [note]}]
    # 逐块校验那几项按改后的译文重算，其余（术语、接续组、审校记录）照留
    kept = [i for i in result.issues if i["code"] not in BLOCK_CHECK_CODES]
    result.translation = revised
    result.issues = kept + [i for i in after if i["severity"] != "info"] + style_signals(block.text, revised) + [note]
    result.status = status_of(result.issues)
    result.meta = dict(result.meta or {}, reviewed=True)
    return "applied"
