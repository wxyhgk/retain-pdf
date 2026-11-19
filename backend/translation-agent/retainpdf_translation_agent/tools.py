"""初译时模型能自己调的只读工具（2026-11-19）：全书搜原文、查术语表。

以前模型只看得到这一页和上下文包（约 7000 token），别处怎么写、术语表里没塞进包的条目都看不到。现在初译时给它两个工具，
模型调 → 程序执行 → 结果回给模型 → 直到交卷（循环在 `agent.TranslationAgent._converse`）。只读：不改术语表、不改别的页。
交卷后的自查不是工具：程序照旧逐块校验，有错就在同一段对话里把问题回给模型改（见 `agent.py`），不用模型记得去调。

只接 Anthropic 的原生工具调用；OpenAI 协议的换算层还不认多轮工具，正式流程在那条路上不开（见方案
docs/ops/planning/translation-agent/20261119-初译工具.md）。

`BookTools` 由调度（`DocumentRun`）建：拿着全书各页的原文、术语表（同一个对象，翻完一页登记的新术语下一页就查得到）、
已经翻完的块的译文。条数和长度都有上限，免得一次搜索把上下文撑爆。
"""

from __future__ import annotations

import json
import re

from retainpdf_translation_agent.checks import CJK_RE
from retainpdf_translation_agent.contract import BlockResult
from retainpdf_translation_agent.contract import PageInput
from retainpdf_translation_agent.memory import Glossary
from retainpdf_translation_agent.memory import same_term

TOOLS_VERSION = "agent-tools-1"
SEARCH_TOOL = "search_book"
TERM_TOOL = "lookup_term"
MAX_HITS = 8  # 一次搜索最多交回几处
QUOTE_CHARS = 240  # 每处原句、译文最多多少字
MAX_TERM_ENTRIES = 5
MAX_TICKETS = 5
MIN_QUERY_CHARS = 2
# 一页最多几轮工具调用（每轮可以并发调几个）、一共最多调几次；用完了程序回"次数用完"，下一轮不许再调，只能交卷
MAX_TOOL_ROUNDS = 3
MAX_TOOL_CALLS = 8

TOOL_DEFINITIONS = [
    {
        "name": SEARCH_TOOL,
        "description": (
            "在全书（不含这一页）里搜一个英文词或短语，交回它出现的原句（带页码、块 id）；那一页已经翻过的，同时交回那一块的译文。"
            "用来看一个词在别处的上下文、前面是怎么译的。也可以搜中文，在已经翻过的译文里找（查自己前面有没有这么写过）。"
            f"最多交回 {MAX_HITS} 处，离这一页近的在前。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "要搜的词或短语，原样写，不分大小写"}},
            "required": ["query"],
        },
    },
    {
        "name": TERM_TOOL,
        "description": (
            "按原文查术语表的完整条目：译法、类别、状态（approved/locked 必须照用，candidate 是候选）、作用域（哪几章）、"
            "说明、各种译法被报了几次，以及这个词的歧义单（不同的块报了不同的译法）。上下文包里没有、或者想看全的时候用。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {"source": {"type": "string", "description": "术语的原文（单复数都行）"}},
            "required": ["source"],
        },
    },
]

TOOLS_PROMPT = f"""

工具（只读，用不用由你定）：
- {SEARCH_TOOL}：在全书别的页里搜英文词或短语，看它在别处的原句和已经定下的译文；也能搜中文，查前面的译文里有没有这么写过。
- {TERM_TOOL}：查术语表里一个词的完整条目（上下文包放不下的、别的章的、歧义单）。
拿不准一个词在全书里指什么、前面怎么译的，先查再译；有把握就直接翻，不要为了查而查。一页最多调 {MAX_TOOL_CALLS} 次，
能一起查的放在同一轮里一起调。查完照常按交卷格式交回整页，工具的结果不要抄进译文。
交卷后程序会逐块检查；有问题会把问题列给你，到时只重交列出的块。"""


def _clip(text: str, limit: int = QUOTE_CHARS) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _around(text: str, start: int, end: int, limit: int = QUOTE_CHARS) -> str:
    """命中处所在的那句；句子太长就取命中前后一段。"""
    text = text or ""
    stops = [m.end() for m in re.finditer(r"[.!?。！？]\s", text[:start])]
    left = stops[-1] if stops else 0
    right_match = re.search(r"[.!?。！？](\s|$)", text[end:])
    right = end + right_match.end() if right_match else len(text)
    sentence = text[left:right].strip()
    if len(sentence) <= limit:
        return " ".join(sentence.split())
    half = max(20, (limit - (end - start)) // 2)
    piece = text[max(0, start - half) : end + half].strip()
    return ("…" if start - half > 0 else "") + " ".join(piece.split()) + ("…" if end + half < len(text) else "")


def _pattern(query: str) -> re.Pattern:
    words = r"\s+".join(re.escape(w) for w in query.split())
    if CJK_RE.search(query):
        return re.compile(words)
    return re.compile(rf"(?<![\w-]){words}(?![\w-])", re.IGNORECASE)


class BookTools:
    def __init__(self, pages: list[PageInput], glossary: Glossary) -> None:
        self.pages = pages
        self.glossary = glossary
        self.translations: dict[str, str] = {}  # 翻完的块 → 译文（调度每页做完记一次）
        self.current = 0  # 正在翻的是第几页（`pages` 的下标）

    def record(self, results: dict[str, BlockResult]) -> None:
        for block_id, result in results.items():
            if result.translation:
                self.translations[block_id] = result.translation

    # ---- 执行 ----
    def run(self, name: str, arguments: dict) -> dict:
        """执行一次工具调用，交回给模型的结果（会被序列化成 JSON 放进 tool_result）。参数不对交回 error，不抛。"""
        arguments = arguments if isinstance(arguments, dict) else {}
        if name == SEARCH_TOOL:
            return self.search(str(arguments.get("query") or ""))
        if name == TERM_TOOL:
            return self.lookup(str(arguments.get("source") or ""))
        return {"error": f"没有这个工具：{name}"}

    def search(self, query: str) -> dict:
        query = " ".join(query.split())
        if len(query) < MIN_QUERY_CHARS:
            return {"error": f"query 至少 {MIN_QUERY_CHARS} 个字"}
        pattern = _pattern(query)
        in_translation = bool(CJK_RE.search(query))
        hits: list[tuple[int, int, dict]] = []
        total = 0
        for index, page in enumerate(self.pages):
            if index == self.current:
                continue
            for order, block in enumerate(page.blocks):
                translation = self.translations.get(block.id) or block.fixed_translation
                text = translation if in_translation else block.text
                match = pattern.search(text or "")
                if not match:
                    continue
                total += 1
                hit = {"page": page.page_label, "block": block.id, "class": block.cls}
                if in_translation:
                    hit["translation"] = _around(text, match.start(), match.end())
                    hit["source"] = _clip(block.text)
                else:
                    hit["source"] = _around(text, match.start(), match.end())
                    if translation:
                        hit["translation"] = _clip(translation)
                hits.append((abs(index - self.current), order, hit))
        hits.sort(key=lambda h: (h[0], h[1]))
        out = {"query": query, "total": total, "hits": [h for _, _, h in hits[:MAX_HITS]]}
        if total > MAX_HITS:
            out["note"] = f"一共 {total} 处，只列离这一页最近的 {MAX_HITS} 处"
        if not total:
            out["note"] = "别的页没有找到" + ("（中文只在已经翻过的页里找）" if in_translation else "")
        return out

    def lookup(self, source: str) -> dict:
        source = " ".join(source.split())
        if len(source) < MIN_QUERY_CHARS:
            return {"error": f"source 至少 {MIN_QUERY_CHARS} 个字"}
        terms = [t for t in self.glossary.terms.values() if same_term(t.source, source)]
        related = False
        if not terms:
            # 没有正好是这个词的：列出包含它的条目（查 "lymphocyte" 找到 "T lymphocyte"）
            pattern = _pattern(source)
            terms = [t for t in self.glossary.terms.values() if pattern.search(t.source)]
            related = bool(terms)
        entries = []
        for term in terms[:MAX_TERM_ENTRIES]:
            entry = {"id": term.id, "source": term.source, "target": term.target, "category": term.category, "status": term.status}
            for key in ("scope", "chapters", "note", "votes"):
                value = getattr(term, key)
                if value:
                    entry[key] = value
            if term.first_seen.get("page") or term.first_seen.get("quote"):
                entry["first_seen"] = {"page": term.first_seen.get("page"), "quote": _clip(term.first_seen.get("quote") or "")}
            tickets = [t for t in self.glossary.tickets if t.get("term") == term.id or (t.get("source") and same_term(t["source"], term.source))]
            if tickets:
                entry["tickets"] = [
                    {k: (_clip(t[k]) if k == "quote" else t[k]) for k in ("current", "proposed", "page", "quote", "why") if t.get(k)} for t in tickets[-MAX_TICKETS:]
                ]
            entries.append(entry)
        out: dict = {"source": source, "entries": entries}
        if related:
            out["note"] = "术语表里没有这个词本身，下面是包含它的条目"
        elif not entries:
            out["note"] = "术语表里没有这个词"
        return out


def tool_result_text(result: dict) -> str:
    return json.dumps(result, ensure_ascii=False)


def summarize_call(name: str, arguments: dict, result: dict) -> dict:
    """编辑部事件 `tool_call` 的字段：调了什么、查了什么、找到几条。不放结果全文（事件要小）。"""
    arguments = arguments if isinstance(arguments, dict) else {}
    query = str(arguments.get("query") or arguments.get("source") or "")
    if "error" in result:
        return {"tool": name, "query": query[:80], "found": 0, "error": str(result["error"])[:120]}
    found = result.get("total") if name == SEARCH_TOOL else len(result.get("entries") or [])
    return {"tool": name, "query": query[:80], "found": int(found or 0)}
