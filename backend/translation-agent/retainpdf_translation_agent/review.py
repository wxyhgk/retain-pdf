"""审校（第 2 版的轻量做法，用户 10-30 定先用 Haiku）：每页翻完，对照原文找程序查不出的错，只开问题单；程序按单子改。

实测（3 个 Sonnet 审读）程序校验抓不到的主要是词义判断错（set 译成"设置"、points 译成"点"、"a hundred times as much"
译成"多一百倍"、sorry 译成"懊悔"）、漏掉限定词、语气被加强。做法：

1. 选块：正文类（段落、摘要、脚注、列表项、图注表题……）、8 个词以上、已经过了校验的块。
2. 一次请求把这页选中的块（原文 + 译文 + 上下文包里的术语和人名）交给审校。审校只开五类单子：错译、漏译或添加、
   数字或术语、不通顺、语气偏离；每张单子逐字引用原文片段和译文片段，并给出只替换那段译文的改法。"更自然"不收。
3. 程序裁判：原文片段在原文里找得到（不分大小写、空白）、译文片段在译文里逐字找得到、改法和原片段不同，才收；
   按单子把那一段替换掉，再跑一遍校验，错误和警告只许减少不许增加，否则不改。每块最多改 2 处。
   改法常比要换的那段长、把紧挨着的前后文又写了一遍（2026-11-18 一本 209 页的书，qwen3.8-flash 审校，改过的块 6% 出现
   「……模糊性。，是因为其中蕴含的道德模糊性。」）：替换前先把改法首尾和前后文重叠的部分去掉；去完替换后还多出一段
   12 个字以上的重复，就不改。
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
MIN_OVERLAP = 4  # 改法首尾和前后文重叠这么多字以上才当成重写了前后文、去掉
REPEAT_WINDOW = 12  # 替换后多出这么长的重复就不改
PUNCT = "。！？；，、：.!?;,:"
BLOCK_CHECK_CODES = {
    "missing", "empty", "formula_unbalanced", "code_changed", "citation_lost", "footnote_mark_lost",
    "number_lost", "untranslated", "no_chinese", "english_residue", "stray_english", "too_short", "too_long", "hedge_lost", "person_lost",
}  # fmt: skip
ORIGINAL_IN_PARENS = re.compile(r"[（(][^（）()]*[A-Za-z][^（）()]*[)）]")
CATEGORIES = {"mistranslation": "错译", "omission": "漏译或添加", "number_term": "数字或术语", "fluency": "不通顺", "tone": "语气偏离"}

REVIEW_PROMPT = """你是英译中学术翻译的审校。你会收到一页里若干块的英文原文和中文译文，以及全书定好的术语和人名。
逐块对照原文读译文，只找**确实错了**的地方，开问题单。只收五类：
- mistranslation 错译：意思错、主宾或逻辑颠倒、否定丢了、数量和倍数错（"a hundred times as much"是"……的一百倍"不是"多一百倍"）、
  一词多义选错（排版里 set 是"排"不是"设置"，points 是"磅"或"百分点"，sorry 在惋惜时不是"懊悔"）；
- omission 漏译或添加：少了分句、限定词、例子、修饰语，或多了原文没有的意思；
- number_term 数字或术语：数字、单位、编号错，或者没用定好的术语、人名译法，或者把作者引用的别的学科的固定说法
  按字面直译了（the tragedy of the commons 译成"公地的悲剧故事"，应为"公地悲剧"）；
- fluency 不通顺：读不通、明显的翻译腔、中文里夹着没翻的英文词；
- tone 语气偏离：作者的保留语气（may、perhaps、suggest）被加强或丢掉，口语被写成公文，反之亦然。
"可以更自然""换个说法更好"这类不收。没把握就不开。

每张单子：block_id、category、source_quote（原文里逐字照抄的那一小段）、translation_quote（译文里逐字照抄的、要改的那一小段，
越短越好，但要能唯一定位）、reason（一句话：错在哪）、must_fix（读完自己的理由再定：确实错了、非改不可才写 true）、
fix（替换 translation_quote 的新译文，只改这一段，公式、标记、编号照原样）。
单子只开给要改的地方，不是逐块打勾：看过、没问题的块什么都不用报，不要写"无误""对应""可以接受"的单子。
一页没有问题就交空列表，这是常有的事。开了单子、写理由时发现其实不用改，must_fix 写 false。
"""

# 两轮分开（`runner` 的 review="split"，2026-11-19）时的第一轮：只对照原文管意思，文笔留给下一轮的编辑
ACCURACY_NOTE = """
这一轮只管意思（对照原文审校），文笔由下一轮编辑单独处理：不开 fluency 单子；读着别扭但意思没错的，不开。
这是人文社科或通俗读物：除了错译、漏译，特别留意多出原文没有的意思（渲染、评价、提前说出的结果）和语气偏离
（作者含糊、反讽、犹豫的地方被说得更明白、更肯定）。
意译、成语、调过语序的句子，只要意思、语气、信息量对得上原文，就不是错，不要改回字面
（so many doors had been slammed 译成"吃了太多闭门羹"是对的，不要改成"那么多门被重重关上"）。
但别的学科的固定说法（效应、定律、某某技术）按字面直译成中文里不这么叫的，是 number_term，要开单子改成通行译名。
人名、书名第一次出现时括号里的原文是体例要求，不要删。中文里夹着没翻的英文词，算 omission。"""
ACCURACY_CATEGORIES = {"mistranslation", "omission", "number_term", "tone"}

REVIEW_TOOL = {
    "name": "submit_review",
    "description": "交回这一页要改的地方（只列要改的，没问题的块不用列；一处都没有就是空列表）。",
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
                        "reason": {"type": "string"},
                        "must_fix": {"type": "boolean"},
                        "fix": {"type": "string"},
                    },
                    "required": ["block_id", "category", "source_quote", "translation_quote", "reason", "must_fix", "fix"],
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


def review_page(agent, page: PageInput, results: dict[str, BlockResult], *, accuracy_only: bool = False) -> dict:
    """审一页并按收下的单子改 `results`（就地改）。返回这一页的审校记录：收了哪些、拒了哪些、为什么。
    `accuracy_only`：两轮分开时的第一轮，只收意思类的单子（不收 fluency）。"""
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
        system = REVIEW_PROMPT + ACCURACY_NOTE if accuracy_only else REVIEW_PROMPT
        data = agent.call_tool(payload, system=system, tool=REVIEW_TOOL, role=ROLE_REVIEWER, label=f"review {page.page_label}", blocks=[b.id for b in blocks])
    except ValueError:
        report["error"] = "no submit_review tool call"
        return report
    by_id = {b.id: b for b in blocks}
    edits: dict[str, int] = {}
    tickets = [t for t in data.get("issues") or [] if isinstance(t, dict)]
    report["tickets"] = len(tickets)
    for ticket in tickets:
        # 第一轮只收意思类的单子；中文里夹着没翻的英文（模型常记成 fluency）也收，下一轮编辑不一定补
        stray = re.search(r"[A-Za-z]{3,}", str(ticket.get("translation_quote", "")))
        verdict = "not_accuracy" if accuracy_only and ticket.get("category") not in ACCURACY_CATEGORIES and not stray else _apply(ticket, by_id, results, edits)
        (report["applied"] if verdict == "applied" else report["rejected"]).append(dict(ticket, verdict=verdict))
    return report


def _apply(ticket: dict, by_id: dict, results: dict[str, BlockResult], edits: dict[str, int]) -> str:
    block = by_id.get(str(ticket.get("block_id", "")))
    if block is None:
        return "unknown_block"
    # 11-20：审校被要求必须调工具交单，没问题也开单子（70 张里 50 张改法等于原译），理由里写着"应忽略""撤回"的也被改了进去。
    # 现在要它先写理由、再定 must_fix；false 就是它自己撤回的
    if ticket.get("must_fix") is False:
        return "withdrawn"
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
    fix = trim_overlap(current, old, fix)
    if not fix.strip() or fix == old:
        return "no_change"
    revised = current.replace(old, fix, 1)
    if adds_repeat(current, revised, fix):
        return "duplicates_context"
    # 括号里的原文（人名、书名第一次出现的"中文译名（原文）"）不许删：11-19 实验里审校按"后面只写中文"删过第一次出现的
    if len(ORIGINAL_IN_PARENS.findall(fix)) < len(ORIGINAL_IN_PARENS.findall(old)):
        return "original_removed"
    from retainpdf_translation_agent.rewrite import added_words

    if added_words(block.text, current, revised):
        return "added_words"
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


def trim_overlap(current: str, old: str, fix: str) -> str:
    """改法的结尾和要换那段后面的文字重叠（或开头和前面的重叠）时去掉重叠部分：审校常把整句写全，替换后半句就重复了。"""
    start = current.index(old)
    head, tail = current[:start], current[start + len(old):]
    for k in range(min(len(fix) - 1, len(tail)), MIN_OVERLAP - 1, -1):
        if fix.endswith(tail[:k]):
            fix = fix[:-k]
            break
    for k in range(min(len(fix) - 1, len(head)), MIN_OVERLAP - 1, -1):
        if fix.startswith(head[-k:]):
            fix = fix[k:]
            break
    # 改法把句号写全了、后文本来就以标点开头：去掉一个，免得「……自己。。我的意思是」
    if fix and tail and fix[-1] in PUNCT and tail[0] in PUNCT:
        fix = fix[:-1]
    if fix and head and fix[0] in PUNCT and head[-1] in PUNCT:
        fix = fix[1:]
    return fix


def adds_repeat(current: str, revised: str, fix: str) -> bool:
    """替换后改法里有一段（≥ REPEAT_WINDOW 字）在译文里出现的次数比原来多、而且不止一次：多半是改法重写了前后文、又没对齐。"""
    for i in range(len(fix) - REPEAT_WINDOW + 1):
        window = fix[i:i + REPEAT_WINDOW]
        if not window.strip():
            continue
        after = revised.count(window)
        if after >= 2 and after > current.count(window):
            return True
    return False

