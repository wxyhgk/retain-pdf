"""按节翻译（翻译 agent 第二版的结构，2026-11-19 起，`DocumentRun(structure="section")` 打开）。

第一版一次交给模型一页的块、一块对一块交卷，提示词大半在讲排版和格式；同一节民族志（6 页）盲评，最便宜的模型按节翻
比最强的模型走第一版还好（见 docs/ops/planning/translation-agent/20261119-按节翻译.md）。第二版把翻译和排版分开：

1. 程序把几页正文接成一份稿子：跨页、跨栏的段落接好（`units.merge_groups`），每段编号 ¶1、¶2……；公式、行内代码换成
   ⟦F1⟧、⟦C1⟧ 占位，脚注、引用标记原样留着；已定译文的标题写成 § 行，只作上下文。
2. 一节一次请求，模型只当译者：提示词按体裁写、很短，段号一一对应，段内怎么组织随它。
3. 程序按段号拿回译文、还原占位、查标记（`checks.check_block`），有问题的段在同一段对话里让它重交一次；
   还不行的段退回第一版逐块翻（`TranslationAgent.translate_units`）。
3b. `review=True` 时整节对照原文审一次意思（`review.review_page(accuracy_only=True)`，只收错译、漏译添加、语气、数字术语的单子），
   2026-11-19 起。不给原文的中文通读试过（改了 10 段、2 段把意思改偏，盲评看不出更好），不做。
4. 合过的段切回各块（`units.split_units`），按页交给调度，写回、断点、编辑部事件都和第一版一样按页走。

节的边界落在页边界上（`plan_sections`）：到了一定字数、遇到新的标题就断，跨页的段落不断开。
只用标准库。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from dataclasses import field
from dataclasses import replace

from retainpdf_translation_agent.agent import ROLE_TRANSLATOR
from retainpdf_translation_agent.agent import TranslationAgent
from retainpdf_translation_agent.checks import CJK_RE
from retainpdf_translation_agent.checks import CODE_RE
from retainpdf_translation_agent.checks import FORMULA_RE
from retainpdf_translation_agent.checks import check_block
from retainpdf_translation_agent.checks import status_of
from retainpdf_translation_agent.contract import BlockInput
from retainpdf_translation_agent.contract import BlockResult
from retainpdf_translation_agent.contract import PageInput
from retainpdf_translation_agent.memory import BINDING
from retainpdf_translation_agent.memory import CANDIDATE
from retainpdf_translation_agent.memory import NAME
from retainpdf_translation_agent.memory import Glossary
from retainpdf_translation_agent.memory import term_pattern
from retainpdf_translation_agent.units import merge_groups
from retainpdf_translation_agent.units import split_units

SECTION_VERSION = "agent-section-2"
# 一节最多多少英文词（到了就在下一页开头断）；不到 MIN 遇到标题也不断，免得一页一节。
SECTION_MAX_WORDS = 2500
SECTION_MIN_WORDS = 600
# 一节的回答（含思考）可能很长：整节 2500 词的中文加思考，16000 不够。
SECTION_MAX_TOKENS = 32000
# 一节里最多交给模型多少条人名、术语。
MAX_TERMS = 120

PLACEHOLDER_RE = re.compile(r"⟦([FC]\d+)⟧")
PARAGRAPH_RE = re.compile(r"^¶(\d+)[ \t]*(?:（[^）\n]{1,6}）)?[ \t]*(.*?)(?=^¶\d+|\Z)", re.M | re.S)

SECTION_NARRATIVE_PROMPT = """你是出版社的资深译者，正在把一本英文人文社科著作或通俗读物译成简体中文，译稿要直接拿去出版。

怎么译：
- 先通读这一整节，弄清它在讲什么、怎么讲，再动笔。译文要读起来像中文作者写的：按中文习惯组织句子，可以拆长句、并短句、
  调语序，不必一句对一句。
- 意思不增不减：不添原文没有的信息和评价，不删内容；作者的语气、保留（seemed、I can only guess）和自嘲照样传达；
  作者当时还不知道的结果，不要提前说出来。
- 英文习语、比喻换成中文里意思相同的惯用说法；英文爱用的抽象名词，中文多用动词和具体说法。
- 人名、术语按给出的译法。人名、机构第一次出现写"中文译名（原文）"，之后只写中文；标着"前文已出现"的直接写中文。
  没给的人名音译，机构名能译就译。书名、报刊名用书名号。
- 不要在中文句子里夹没翻的英文单词。

格式（只有这几条）：
- 稿子按段编号（¶1、¶2……），译稿每段用同样的编号开头，段落数和顺序不变，不合并、不拆分段落；段内怎么组织随你。
- 编号后面的（标题）（脚注）（图注）只是说明这段是什么，译稿里不用写；标题译得简洁，脚注开头的编号照留。
- ⟦F1⟧、⟦C1⟧ 这样的占位符（公式、代码）原样留在译文里对应的位置，一个不能少；{{fn:1}} 脚注标记、[1] 引用标记也原样留着。
- 以 § 开头的行是已经定好译文的标题，版面上单独排好了，只作上下文：不要输出，也不要把它并进别的段。
- 只输出译稿：不要写说明、更正、思考过程。发现某段写错了，就用同一个编号把那一段整段重写一遍，以最后一次为准。"""


@dataclass
class Paragraph:
    n: int
    unit: BlockInput
    kind: str
    text: str  # 换好占位的原文
    placeholders: dict[str, str] = field(default_factory=dict)  # 占位 → 原文写法


def _words(block: BlockInput) -> int:
    return len(block.text.split())


def _is_heading(block: BlockInput) -> bool:
    cls = (block.cls or "").lower()
    return "heading" in cls or "title" in cls


def _kind(block: BlockInput) -> str:
    cls = (block.cls or "").lower()
    if _is_heading(block):
        return "标题"
    if "footnote" in cls:
        return "脚注"
    if "caption" in cls:
        return "图注"
    return ""


def plan_sections(pages: list[PageInput], *, max_words: int = SECTION_MAX_WORDS, min_words: int = SECTION_MIN_WORDS) -> list[tuple[int, int]]:
    """把页分成连续的几节，返回 [(起页下标, 止页下标（不含）)]。在第 i 页前断开的条件：已经攒够 `max_words`，
    或者第 i 页以标题开头且已经攒够 `min_words`。上一页和这一页有同一个接续组（一段话跨页）的不断。"""
    sections: list[tuple[int, int]] = []
    start, words = 0, 0
    for index, page in enumerate(pages):
        blocks = page.to_translate()
        if index > start:
            previous_groups = {(b.group or {}).get("id") for b in pages[index - 1].to_translate() if b.group}
            spans = any(b.group and b.group.get("id") in previous_groups for b in blocks)
            first = next((b for b in page.blocks if b.translate), None)
            heading_first = first is not None and _is_heading(first)
            if not spans and (words >= max_words or (heading_first and words >= min_words)):
                sections.append((start, index))
                start, words = index, 0
        words += sum(_words(b) for b in blocks)
    if pages:
        sections.append((start, len(pages)))
    return sections


def combine_pages(pages: list[PageInput]) -> PageInput:
    """一节的几页拼成一页（块按页序接起来），好让跨页的接续组合成一段。"""
    first = pages[0]
    label = first.page_label if len(pages) == 1 else f"{first.page_label}-{pages[-1].page_label}"
    return replace(first, page_label=label, blocks=[b for p in pages for b in p.blocks], context={})


_NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17,
    "eighteen": 18, "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
}
_ROMAN = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100}
_LABEL_RE = re.compile(r"^(chapter|part|book)\s+([a-z]+(?:[\s-][a-z]+)?|\d{1,3}|[ivxlc]{1,8})\.?$", re.I)
_LABEL_KIND = {"chapter": "章", "part": "部分", "book": "卷"}


def _label_number(token: str) -> int | None:
    token = token.lower().strip()
    if token.isdigit():
        return int(token)
    if all(ch in _ROMAN for ch in token):
        total, prev = 0, 0
        for ch in reversed(token):
            value = _ROMAN[ch]
            total += -value if value < prev else value
            prev = max(prev, value)
        return total or None
    words = re.split(r"[\s-]+", token)
    if all(w in _NUMBER_WORDS for w in words) and len(words) <= 2:
        return sum(_NUMBER_WORDS[w] for w in words) if len(words) == 1 or _NUMBER_WORDS[words[0]] >= 20 else None
    return None


def _chinese_number(n: int) -> str:
    digits = "零一二三四五六七八九"
    if n < 10:
        return digits[n]
    if n < 20:
        return "十" + (digits[n % 10] if n % 10 else "")
    if n < 100:
        return digits[n // 10] + "十" + (digits[n % 10] if n % 10 else "")
    return str(n)


def chapter_label(text: str) -> str | None:
    """单独一块的章号（CHAPTER TWO、Chapter 2、CHAPTER II、PART ONE、Book 3）→ 第二章、第一部分、第三卷；别的返回 None。
    这类块由程序直接换，不交给模型：2026-11-19 一本书的「CHAPTER TWO」后面紧跟已定译文「第二章 隐匿于视线之外」的章名，
    模型把章号块也写成了整个章名，版面上出现两遍。"""
    match = _LABEL_RE.match((text or "").strip())
    if not match:
        return None
    number = _label_number(match.group(2))
    if not number or number > 99:
        return None
    return f"第{_chinese_number(number)}{_LABEL_KIND[match.group(1).lower()]}"


def label_chapters(units: PageInput) -> PageInput:
    """章号块填上程序换好的译文（当成已定译文：不进稿子，结果原样交回）。紧跟着的章名如果已定译文以同样的章号开头、
    原文却不带章号（通读把「Hiding from View」定成了「第二章 隐匿于视线之外」），去掉这个重复的章号，免得版面上出现两遍。"""
    blocks = list(units.blocks)
    for index, block in enumerate(blocks):
        label = chapter_label(block.text) if block.translate and block.fixed_translation is None else None
        if not label:
            continue
        blocks[index] = replace(block, fixed_translation=label)
        following = next((b for b in blocks[index + 1 :] if b.translate), None)
        if following is None or following.fixed_translation is None or chapter_label(following.text.split("\n")[0]):
            continue
        title = following.fixed_translation.strip()
        if title.startswith(label) and len(title) > len(label) and not _LABEL_RE.match(following.text.strip()):
            rest = title[len(label) :].lstrip(" 　:：·-—")
            if rest:
                blocks[blocks.index(following)] = replace(following, fixed_translation=rest)
    return replace(units, blocks=blocks)


def build_manuscript(units: PageInput) -> tuple[list[Paragraph], str]:
    """合好接续组的一节 → （段落，稿子）。公式、行内代码换成占位（整节统一编号）。"""
    paragraphs: list[Paragraph] = []
    lines: list[str] = []
    counters = {"F": 0, "C": 0}
    for block in units.blocks:
        if not block.translate:
            continue
        if block.fixed_translation is not None:
            lines.append(f"§ {block.text.strip()} → {block.fixed_translation.strip()}")
            continue
        placeholders: dict[str, str] = {}

        def protect(prefix: str):
            def sub(match: re.Match) -> str:
                counters[prefix] += 1
                key = f"{prefix}{counters[prefix]}"
                placeholders[key] = match.group(0)
                return f"⟦{key}⟧"
            return sub

        text = FORMULA_RE.sub(protect("F"), block.text)
        text = CODE_RE.sub(protect("C"), text)
        paragraph = Paragraph(len(paragraphs) + 1, block, _kind(block), text.strip(), placeholders)
        paragraphs.append(paragraph)
        label = f"（{paragraph.kind}）" if paragraph.kind else ""
        lines.append(f"¶{paragraph.n}{label} {paragraph.text}")
    return paragraphs, "\n\n".join(lines)


ASCII_WORD_RE = re.compile(r"[A-Za-z]+")
# 一行没有汉字、英文词却有这么多：当成模型写进译稿的说明（"Wait — the heading of ¶11 is …"），去掉
NOTE_MIN_WORDS = 5


def _strip_notes(body: str) -> tuple[str, list[str]]:
    """去掉模型抄回来的 § 行（稿子里本来就有的上下文，常被抄在前一段末尾，静默去掉）和夹在译稿里的英文说明，
    返回（干净的译文，去掉的说明行；不含 § 行）。"""
    kept: list[str] = []
    dropped: list[str] = []
    for line in body.split("\n"):
        stripped = line.strip()
        if stripped.startswith("§"):
            continue
        if stripped and not CJK_RE.search(stripped) and len(ASCII_WORD_RE.findall(stripped)) >= NOTE_MIN_WORDS:
            dropped.append(stripped)
            continue
        kept.append(line)
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(kept)).strip()
    return text, dropped


def parse_section_notes(text: str) -> tuple[dict[int, str], dict[int, list[str]]]:
    """译稿 → （{段号: 译文}，{段号: 去掉的说明行}）。同一个段号写了几次的以最后一次为准：模型发现写错了会用同一个编号
    重写（2026-11-19 实例：先交「第二章」，接着抄了 § 行、写了一句英文更正，再交一遍）。"""
    found: dict[int, str] = {}
    notes: dict[int, list[str]] = {}
    for match in PARAGRAPH_RE.finditer(text or ""):
        number = int(match.group(1))
        body, dropped = _strip_notes(match.group(2))
        if body:
            found[number] = body
            notes[number] = dropped
    return found, notes


def parse_section(text: str) -> dict[int, str]:
    """译稿 → {段号: 译文}（见 `parse_section_notes`）。"""
    return parse_section_notes(text)[0]


def restore(paragraph: Paragraph, translation: str) -> tuple[str, list[dict]]:
    """占位换回原文写法；少了、多了、重复的占位报 error（这一段要重交）。"""
    issues: list[dict] = []
    seen = PLACEHOLDER_RE.findall(translation)
    missing = [key for key in paragraph.placeholders if seen.count(key) == 0]
    extra = sorted({key for key in seen if key not in paragraph.placeholders or seen.count(key) > 1})
    if missing:
        issues.append({"code": "placeholder_lost", "severity": "error", "message": f"占位丢了：{missing}"})
    if extra:
        issues.append({"code": "placeholder_extra", "severity": "error", "message": f"多出或重复的占位：{extra}"})
    restored = PLACEHOLDER_RE.sub(lambda m: paragraph.placeholders.get(m.group(1), m.group(0)), translation)
    return restored, issues


def section_terms(glossary: Glossary, text: str) -> list:
    """这一节原文里出现的术语表条目（审定、锁定、候选），最多 MAX_TERMS 条。"""
    found = []
    for term in glossary.terms.values():
        if not term.source or not term.target:
            continue
        if term.status not in BINDING and term.status != CANDIDATE:
            continue
        if term_pattern(term.source, term.category).search(text):
            found.append(term)
            if len(found) >= MAX_TERMS:
                break
    return found


def relevant_terms(glossary: Glossary, text: str, *, seen_names: set[str]) -> list[str]:
    """这一节原文里出现的人名、术语、缩写、保留原文的专名，一行一条。"""
    lines: list[str] = []
    for term in section_terms(glossary, text):
        line = f"- {term.source} → {term.target}"
        if term.note:
            line += f"（{term.note}）"
        if term.category == NAME and term.source in seen_names:
            line += "（前文已出现）"
        lines.append(line)
    return lines


@dataclass
class SectionOutcome:
    results: dict[str, BlockResult]  # 各块（切回以后）
    info: dict


def translate_section(
    agent: TranslationAgent,
    pages: list[PageInput],
    glossary: Glossary,
    *,
    title: str = "",
    style: str = "",
    previous: list[dict] | None = None,
    seen_names: set[str] | None = None,
    review: bool = False,
) -> SectionOutcome:
    """一节几页一次翻完。`previous`：上一节最后几段的原文和译文（接上文用）；`seen_names`：前面几节已经出现过的人名。
    模型、请求缓存、用量、编辑部事件都走 `agent`。"""
    combined = combine_pages(pages)
    units, groups = merge_groups(combined)
    units = label_chapters(units)
    paragraphs, manuscript = build_manuscript(units)
    agent._members = {group_id: [m.id for m in members] for group_id, members in groups.items()}
    if not paragraphs:
        # 这一节没有要翻的段（整节是图、公式）：不发请求，已定译文的标题照交
        fixed = {b.id: BlockResult(b.id, b.fixed_translation, [], 0, "ok", [], {"structure": "section", "fixed": True}) for b in units.fixed()}
        return SectionOutcome(split_units(fixed, groups), {"structure": "section", "section": combined.page_label, "pages": [p.page_label for p in pages], "paragraphs": 0, "attempts": 0, "fallback": [], "terms": 0})
    section_text = " ".join(p.unit.text for p in paragraphs)
    terms = relevant_terms(glossary, section_text, seen_names=set(seen_names or ()))

    system = SECTION_NARRATIVE_PROMPT
    if title:
        system += f"\n\n这本书：{title}"
    if style:
        system += f"\n文风：{style}"
    parts = []
    if terms:
        parts.append("人名、术语的译法：\n" + "\n".join(terms))
    if previous:
        tail = "\n\n".join(f"原文：{p['source']}\n译文：{p['translation']}" for p in previous[-2:])
        parts.append("上一节的最后几段（只作衔接参考，不要重译）：\n" + tail)
    parts.append("下面是这一节的原稿：\n\n" + manuscript)
    messages = [{"role": "user", "content": "\n\n".join(parts)}]
    label = f"agent-translate section {combined.page_label}"
    ids = [p.unit.id for p in paragraphs]

    def ask(attempt: int) -> str:
        body = {
            "model": agent.model_for(ROLE_TRANSLATOR),
            "max_tokens": SECTION_MAX_TOKENS,
            "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            "messages": list(messages),
        }
        if agent.effort:
            body.update(thinking={"type": "adaptive"}, output_config={"effort": agent.effort})
        response = agent._call(body, label=label if attempt == 1 else f"{label} retry", role=ROLE_TRANSLATOR, event={"attempt": attempt, "blocks": ids})
        content = response.get("content") or []
        messages.append({"role": "assistant", "content": content})
        return "".join(part.get("text") or "" for part in content if part.get("type") == "text")

    translations: dict[int, tuple[str, list[dict]]] = {}

    def take(answer: str) -> list[Paragraph]:
        found, notes = parse_section_notes(answer)
        failed: list[Paragraph] = []
        for paragraph in paragraphs:
            if paragraph.n in translations and status_of(translations[paragraph.n][1]) != "error":
                continue
            text = found.get(paragraph.n)
            if text is None:
                translations.pop(paragraph.n, None)
                failed.append(paragraph)
                continue
            restored, issues = restore(paragraph, text)
            issues += check_block(paragraph.unit.text, restored)
            if notes.get(paragraph.n):
                issues.append({"code": "model_note_dropped", "severity": "warn", "message": f"去掉了模型写进译稿的说明：{notes[paragraph.n][:2]}"})
            translations[paragraph.n] = (restored, issues)
            if status_of(issues) == "error":
                failed.append(paragraph)
        return failed

    failed = take(ask(1))
    attempts = 1
    if failed:
        notes = []
        for paragraph in failed:
            problems = translations.get(paragraph.n, (None, [{"message": "没有交回这一段"}]))[1]
            notes.append(f"¶{paragraph.n}：" + "；".join(i["message"] for i in problems if i.get("severity") == "error" or i.get("code") == "missing"))
        messages.append({"role": "user", "content": "下面几段有问题，请只重交这几段（同样用 ¶编号 开头），别的段不用再交：\n" + "\n".join(notes)})
        failed = take(ask(2))
        attempts = 2

    results: dict[str, BlockResult] = {}
    meta = {"structure": "section", "section": combined.page_label, "prompt_version": SECTION_VERSION, "model": agent.model_for(ROLE_TRANSLATOR), "role": ROLE_TRANSLATOR}
    failed_numbers = {p.n for p in failed}
    for paragraph in paragraphs:
        if paragraph.n in failed_numbers:
            continue
        text, issues = translations[paragraph.n]
        results[paragraph.unit.id] = BlockResult(paragraph.unit.id, text, issues, attempts, status_of(issues), [], dict(meta, attempt=attempts))
    fallback_ids = [p.unit.id for p in failed]
    if fallback_ids:
        # 两次都没交好的段退回第一版：这几段照旧逐块翻（同一节别的块只作上下文）
        wanted = set(fallback_ids)
        page = replace(units, blocks=[b if b.id in wanted else replace(b, translate=False) for b in units.blocks])
        fallback, _ = agent.translate_units(page)
        for block_id in fallback_ids:
            if block_id in fallback:
                result = fallback[block_id]
                results[block_id] = replace(result, meta=dict(result.meta or {}, structure="section_fallback", section=combined.page_label))
    for block in units.fixed():
        results[block.id] = BlockResult(block.id, block.fixed_translation, [], 0, "ok", [], {"structure": "section", "fixed": True})
    agent._emit_check(attempts, list(results.values()))
    review_report = None
    if review:
        from retainpdf_translation_agent.review import review_page

        bound = [
            {"source": t.source, "target": t.target, "status": t.status, "category": t.category}
            for t in section_terms(glossary, section_text)
            if t.status in BINDING
        ]
        review_report = review_page(agent, replace(units, context={"style": style, "terms": bound}), results, accuracy_only=True)
    split = split_units(results, groups)
    info: dict = {
        "structure": "section",
        "section": combined.page_label,
        "pages": [p.page_label for p in pages],
        "paragraphs": len(paragraphs),
        "attempts": attempts,
        "fallback": fallback_ids,
        "terms": len(terms),
    }
    if review_report is not None:
        info["review"] = review_report
    return SectionOutcome(split, info)


__all__ = [
    "SECTION_NARRATIVE_PROMPT",
    "SECTION_VERSION",
    "Paragraph",
    "SectionOutcome",
    "build_manuscript",
    "chapter_label",
    "parse_section",
    "parse_section_notes",
    "plan_sections",
    "relevant_terms",
    "restore",
    "translate_section",
]

