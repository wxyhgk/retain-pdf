"""编辑重写（审校的另一种做法，2026-11-18 起试验）：每页翻完，编辑对照原文通读初译，要改的块交回整块改好的译文。

和 `review.py` 的区别：审校只开"确实错了"的问题单、程序按单子替换一小段；编辑既改错也改文笔（直译的语序、生硬的搭配），
交回整块，程序不用定位片段，也就不会替换出重复。一页仍然只多一次请求，输出多一些。

程序裁判（不合格就留初译）：
- 校验的错误和警告只许减少（数字、脚注标记、公式、残留英文……），表示保留的词、人称不许新丢；
- 定好的术语、保留原文的专名，改完不许比初译多违反；
- 长度和初译比在 [MIN_RATIO, MAX_RATIO] 之间：防止编辑删内容或加内容；
- 不许添词：`ADDED_WORD_SOURCES` 里的词改完比初译多、原文里又找不到对应的英文，不收。

体裁看通读的结果：人文社科、通俗读物要文笔；理工类只改意思错和明显读不通的。
"""

from __future__ import annotations

import re

from retainpdf_translation_agent.checks import check_block
from retainpdf_translation_agent.checks import check_terms
from retainpdf_translation_agent.checks import status_of
from retainpdf_translation_agent.checks import style_signals
from retainpdf_translation_agent.checks import visible_length
from retainpdf_translation_agent.context import context_terms
from retainpdf_translation_agent.contract import BlockResult
from retainpdf_translation_agent.contract import PageInput
from retainpdf_translation_agent.review import BLOCK_CHECK_CODES
from retainpdf_translation_agent.review import reviewable
from retainpdf_translation_agent.translationese import translationese_signals

MIN_RATIO = 0.7
MAX_RATIO = 1.4
# 通读判成这几种体裁时，调度（`runner.py`）默认分两轮：先挑错审校只管意思、再由编辑只改文笔（2026-11-19 起；11-18 起是编辑一次做完）；其余体裁照旧挑错
REWRITE_GENRES = {"humanities", "popular_book"}
# 编辑常顺手加的词：改出来比初译多、原文里又没有对应的英文，这次重写不收（2026-11-18 实测加过"说实话""其实""大概"）
ADDED_WORD_SOURCES = {
    "说实话": r"honest|frank|truth",
    "其实": r"actual|in fact|indeed|really|in reality",
    "显然": r"obvious|clear|evident|apparent",
    "当然": r"of course|natural|certain",
    "大概": r"probabl|perhaps|maybe|likely|might|may\b|seem|presumabl|possibl|guess|suspect|could",
    "也许": r"probabl|perhaps|maybe|likely|might|may\b|seem|presumabl|possibl|guess|suspect|could",
    "或许": r"probabl|perhaps|maybe|likely|might|may\b|seem|presumabl|possibl|guess|suspect|could",
}
CATEGORIES = {"meaning": "意思", "fluency": "文笔"}

GENRE_NOTES = {
    True: "这本书是人文社科或通俗读物：文笔要紧。改完要读起来像中文作者写的，保留作者的口吻（第一人称、叙事的画面感、反讽）。",
    False: "这本书是理工类：只改意思错和明显读不通的地方；术语密集的句子不要为了顺口换说法。",
}

REWRITE_PROMPT = """你是英译中图书的责任编辑。你会收到一页里若干块的中文初译和英文原文，以及全书定好的术语、人名和文风说明。
分两步读：
第一步，只读中文（translation），像普通中文读者那样，标出读着别扭、要读两遍、一看就是从英文翻过来的句子。
  suspects 是程序按句式圈出的可疑处（不一定都错），重点看。
第二步，对照英文（source）逐句核对：先查意思，再改第一步标出的句子。

要改的：
1. meaning 意思（优先）：错译、漏译、多出原文没有的意思、逻辑关系颠倒、一词多义选错，
   作者的保留语气（may、perhaps、probably、it seems）被加强或丢掉。
2. fluency 文笔：照搬英文结构的翻译腔，常见的有——
   - 抽象名词配虚动词："设置了阻碍""表现出阻碍态度"→ 说成动作："就百般阻挠""不肯配合"；
   - "进行……"："进行访谈""进行研究"→"访谈""研究"；
   - 句首"通过……，""作为一名……，"照搬 by / as：调语序或删掉；
   - "所具有的""所带来的"、一串"的"、"被"字句堆叠：拆开、改主动；
   - 抽象词直译："阻碍的具体风味"→"阻挠的具体样子"；
   - Similarly 和 also 都译出来（"同样……也……同样"）：只留一个。
   按中文习惯重组：可以拆句、并句、调语序、换说法，意思、语气、信息量不变。
{genre_note}

不许动：
- 脚注标记 {{{{fn:N}}}}、公式 $…$、数字、编号原样保留，位置跟着它修饰的内容走；
- 定好的术语和人名照表里的译法（术语管的是概念本身，词形变了按中文习惯说）；人名第一次出现的"中文译名（原文）"照初译；
- **不添词**：不加原文没有的意思、口头禅、强调（"说实话""其实""显然"），不删内容，不加译注；
- 用中文引号“”，不用英文直引号。
整块交回改好的译文，不要只交改的那一句。没有把握改得更好就不交。每块附 category 和一句 changes（改了什么）。
一页都不用改就交空列表。
"""

# 两轮分开（`runner` 的 review="split"，2026-11-19）时的第二轮：意思已经由审校对过，编辑把译文当一篇中文来读、只改文笔。
# 换掉 REWRITE_PROMPT 里"分两步读"那一段和"要改的"第 1 条
POLISH_STEPS = """这一页的意思已经有审校对照原文核对过，这一轮只管文笔。分两步读：
第一步，只读中文（translation），把它当成一篇中文作品来读，像中文读者那样，标出读着别扭、要读两遍、一看就是从英文翻过来的句子。
  suspects 是程序按句式圈出的可疑处（不一定都错），重点看。
第二步，改第一步标出的句子；改完对照英文（source）确认意思、语气、信息量一点没变。
  对照时发现意思确实错了也改（category 写 meaning），但不要为了贴近英文把句子改回直译。

要改的：
1. fluency 文笔（这一轮的重点）：照搬英文结构的翻译腔，常见的有——"""

REWRITE_TOOL = {
    "name": "submit_rewrite",
    "description": "交回这一页改过的块（整块译文）；不用改就是空列表。",
    "input_schema": {
        "type": "object",
        "properties": {
            "blocks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "block_id": {"type": "string"},
                        "category": {"type": "string", "enum": sorted(CATEGORIES)},
                        "translation": {"type": "string"},
                        "changes": {"type": "string"},
                    },
                    "required": ["block_id", "category", "translation", "changes"],
                },
            }
        },
        "required": ["blocks"],
    },
}


def rewrite_page(agent, page: PageInput, results: dict[str, BlockResult], *, genre: str = "other", polish: bool = False) -> dict:
    """编辑重写一页并就地改 `results`。返回记录（和 `review_page` 同样的键，调度照常记）：收了哪些、拒了哪些、为什么。
    `polish`：两轮分开时的第二轮，意思已经审过，编辑把译文当中文作品读、只改文笔（`POLISH_STEPS`）。"""
    from retainpdf_translation_agent.agent import ROLE_REVIEWER

    blocks = reviewable(page, results)
    report: dict = {"mode": "polish" if polish else "rewrite", "reviewed": len(blocks), "tickets": 0, "applied": [], "rejected": []}
    if not blocks:
        return report
    terms = [t for t in context_terms(page.context or {}) if t.get("status") in ("approved", "locked")]
    payload = {
        "document": page.document,
        "page": page.page_label,
        "style": (page.context or {}).get("style", ""),
        "glossary": [{"source": t["source"], "target": t["target"], "category": t.get("category")} for t in terms if t.get("category") != "abbr"],
        # 中文在前：编辑先只读中文找别扭的句子，再对照原文
        "blocks": [_block_payload(b, results[b.id].translation or "") for b in blocks],
    }
    system = REWRITE_PROMPT.format(genre_note=GENRE_NOTES[genre in REWRITE_GENRES])
    if polish:
        start, end = system.index("分两步读："), system.index("2. fluency 文笔：照搬英文结构的翻译腔，常见的有——")
        system = system[:start] + POLISH_STEPS + system[end + len("2. fluency 文笔：照搬英文结构的翻译腔，常见的有——") :]
    try:
        data = agent.call_tool(payload, system=system, tool=REWRITE_TOOL, role=ROLE_REVIEWER, label=f"{report['mode']} {page.page_label}", blocks=[b.id for b in blocks])
    except ValueError:
        report["error"] = "no submit_rewrite tool call"
        return report
    by_id = {b.id: b for b in blocks}
    edits = [e for e in data.get("blocks") or [] if isinstance(e, dict)]
    report["tickets"] = len(edits)
    seen: set[str] = set()
    for edit in edits:
        verdict = _apply(edit, by_id, results, terms, seen)
        (report["applied"] if verdict == "applied" else report["rejected"]).append(dict(edit, verdict=verdict))
    return report


def added_words(source: str, current: str, revised: str) -> list[str]:
    """编辑改完多出来、原文里又没有对应英文的词（"说实话""其实""大概"……）。"""
    lowered = source.lower()
    return [
        word
        for word, english in ADDED_WORD_SOURCES.items()
        if revised.count(word) > current.count(word) and not re.search(english, lowered)
    ]


def _block_payload(block, translation: str) -> dict:
    out = {"id": block.id, "class": block.cls, "translation": translation}
    suspects = translationese_signals(translation)
    if suspects:
        out["suspects"] = [{"text": x["text"], "hint": x["hint"]} for x in suspects]
    out["source"] = block.text
    return out


def _apply(edit: dict, by_id: dict, results: dict[str, BlockResult], terms: list[dict], seen: set[str]) -> str:
    block = by_id.get(str(edit.get("block_id", "")))
    if block is None:
        return "unknown_block"
    if block.id in seen:
        return "duplicate_block"
    category = edit.get("category") if edit.get("category") in CATEGORIES else "fluency"
    revised = str(edit.get("translation") or "").strip()
    result = results[block.id]
    current = result.translation or ""
    if not revised or revised == current.strip():
        return "no_change"
    if "[[BREAK]]" in revised:
        return "referee_rejected"
    ratio = visible_length(revised) / max(1, visible_length(current))
    if not MIN_RATIO <= ratio <= MAX_RATIO:
        return "length_changed"
    if added_words(block.text, current, revised):
        return "added_words"
    before, after = check_block(block.text, current), check_block(block.text, revised)
    if not {i["code"] for i in after if i["severity"] in ("error", "warn")} <= {i["code"] for i in before if i["severity"] in ("error", "warn")}:
        return "referee_rejected"
    if not {i["code"] for i in style_signals(block.text, revised)} <= {i["code"] for i in style_signals(block.text, current)}:
        return "referee_rejected"
    terms_before, terms_after = check_terms(block.text, current, terms), check_terms(block.text, revised, terms)
    if len(terms_after) > len(terms_before):
        return "terms_broken"
    seen.add(block.id)
    note = {"code": f"rewrite_{category}", "severity": "info", "message": f"编辑（{CATEGORIES[category]}）：{str(edit.get('changes', ''))[:160]}"}
    result.history = result.history + [{"translation": current, "issues": [note]}]
    term_codes = {i["code"] for i in terms_before}
    kept = [i for i in result.issues if i["code"] not in BLOCK_CHECK_CODES and i["code"] not in term_codes]
    result.translation = revised
    result.issues = kept + [i for i in after if i["severity"] != "info"] + terms_after + style_signals(block.text, revised) + [note]
    result.status = status_of(result.issues)
    result.meta = dict(result.meta or {}, reviewed=True, rewritten=True)
    return "applied"


__all__ = ["POLISH_STEPS", "REWRITE_GENRES", "REWRITE_PROMPT", "REWRITE_TOOL", "added_words", "rewrite_page"]
