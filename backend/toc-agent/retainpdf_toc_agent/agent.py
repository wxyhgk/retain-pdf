"""目录 agent：一本书的目录一次翻完，逐条检查，正文里同名的标题用同一个译名。

和普通翻译同步跑（翻译一开头，和领域识别一起），结果作为「定好的译文」交给翻译引擎：目录条目和对上的正文标题
不再发请求，目录和正文一字不差。没翻成的条目不给定译，照旧交给普通翻译（不会比以前差）。

一轮：把还没定的标题（同样的原文只问一次）发给模型，模型回 ``{"translations": [{"k", "zh"}]}``；代码逐条检查
（``validate.check_title``），过了的收下，没过的连原因退回重交。最多 ``MAX_ROUNDS`` 轮。条目多时分段，每段一个循环。
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from dataclasses import field
from typing import Any, Callable

from retainpdf_toc_agent.contract import ChatResult
from retainpdf_toc_agent.contract import GlossaryTerm
from retainpdf_toc_agent.contract import Heading
from retainpdf_toc_agent.contract import TocEntry
from retainpdf_toc_agent.match import heading_translation
from retainpdf_toc_agent.match import title_key
from retainpdf_toc_agent.prompts import load_prompt
from retainpdf_toc_agent.validate import REASON_HINTS
from retainpdf_toc_agent.validate import check_title
from retainpdf_toc_agent.validate import glossary_for
from retainpdf_toc_agent.validate import tidy

SYSTEM_PROMPT = "toc_translate_system.txt"
PROMPT_VERSION = "toc_translate.v1"
MAX_ROUNDS = 3
MAX_TITLES_PER_REQUEST = 80
RESPONSE_FORMAT = {"type": "json_object"}
PURPOSE = "toc_translate"

STATUS_TRANSLATED = "translated"
STATUS_PARTIAL = "partial"
STATUS_EMPTY = "no_entries"
STATUS_FAILED = "request_failed"

ChatFn = Callable[..., Any]


@dataclass
class TocResult:
    status: str
    # 给翻译引擎的定译：条目块（「章号 译名」）和对上的正文标题块
    fixed_translations: dict[str, str] = field(default_factory=dict)
    titles: dict[str, str] = field(default_factory=dict)  # 原文标题 → 译名
    rejected: dict[str, str] = field(default_factory=dict)  # 到上限还没过的原文标题 → 最后一次的原因
    matched_headings: int = 0
    requests: int = 0
    rounds: int = 0
    usage: dict[str, int] = field(default_factory=dict)
    error: str = ""

    def to_record(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "prompt_version": PROMPT_VERSION,
            "fixed_translations": dict(self.fixed_translations),
            "titles": dict(self.titles),
            "rejected": dict(self.rejected),
            "matched_headings": self.matched_headings,
            "requests": self.requests,
            "rounds": self.rounds,
            "usage": dict(self.usage),
            **({"error": self.error} if self.error else {}),
        }


@dataclass
class _Title:
    key: str
    source: str
    level: int
    glossary: tuple[GlossaryTerm, ...]


def _unique_titles(entries: list[TocEntry], glossary: tuple[GlossaryTerm, ...]) -> list[_Title]:
    seen: dict[str, _Title] = {}
    for entry in entries:
        key = title_key(entry.title)
        if key and key not in seen:
            source = " ".join(entry.title.split())
            seen[key] = _Title(key, source, int(entry.level or 1), glossary_for(source, glossary))
    return list(seen.values())


def _parse(content: str) -> dict[int, str]:
    text = str(content or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):] if "{" in text else text
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return {}
    try:
        payload = json.loads(text[start : end + 1])
    except ValueError:
        return {}
    rows = payload.get("translations") if isinstance(payload, dict) else None
    found: dict[int, str] = {}
    for row in rows if isinstance(rows, list) else []:
        if isinstance(row, dict) and isinstance(row.get("k"), int) and isinstance(row.get("zh"), str):
            found.setdefault(row["k"], row["zh"])
    return found


def _add_usage(total: dict[str, int], usage: dict[str, Any] | None) -> None:
    for key, value in (usage or {}).items():
        if isinstance(value, int) and not isinstance(value, bool):
            total[key] = total.get(key, 0) + value


def _translate_chunk(chunk: list[_Title], *, chat_fn: ChatFn, context: str, result: TocResult) -> None:
    terms = sorted({(term.source, term.target) for title in chunk for term in title.glossary})
    payload = {
        "entries": [{"k": index, "level": title.level, "title": title.source} for index, title in enumerate(chunk)],
        "glossary": [{"source": source, "target": target} for source, target in terms],
    }
    user = json.dumps(payload, ensure_ascii=False)
    if context:
        user = f"{context}\n\n{user}"
    messages: list[dict[str, str]] = [
        {"role": "system", "content": load_prompt(SYSTEM_PROMPT)},
        {"role": "user", "content": user},
    ]
    pending = set(range(len(chunk)))
    reasons: dict[int, str] = {}
    for _ in range(MAX_ROUNDS):
        result.rounds += 1
        result.requests += 1
        reply = chat_fn(messages, purpose=PURPOSE, response_format=RESPONSE_FORMAT)
        content = reply.content if isinstance(reply, ChatResult) else str(reply or "")
        _add_usage(result.usage, reply.usage if isinstance(reply, ChatResult) else None)
        answers = _parse(content)
        reasons = {}
        for index in sorted(pending):
            title = chunk[index]
            translated = tidy(answers.get(index, ""))
            reason = check_title(title.source, translated, glossary=title.glossary)
            if reason:
                reasons[index] = reason
                continue
            result.titles[title.source] = translated
            pending.discard(index)
        if not pending:
            return
        retry = [{"k": index, "title": chunk[index].source, "problem": REASON_HINTS[reasons[index]]} for index in sorted(pending)]
        messages = [
            *messages,
            {"role": "assistant", "content": content},
            {"role": "user", "content": "这几条没过检查，只重交这几条：\n" + json.dumps(retry, ensure_ascii=False)},
        ]
    for index in pending:
        result.rejected[chunk[index].source] = reasons.get(index, "")


def translate_toc(
    entries: list[TocEntry],
    headings: list[Heading] | None = None,
    *,
    chat_fn: ChatFn,
    glossary: list[GlossaryTerm] | tuple[GlossaryTerm, ...] = (),
    context: str = "",
) -> TocResult:
    """翻目录，返回定译。请求失败（网络、Key……）不抛：结果是 ``request_failed``，已经定了的照样给。"""
    if not entries:
        return TocResult(status=STATUS_EMPTY)
    terms = tuple(glossary)
    titles = _unique_titles(entries, terms)
    result = TocResult(status=STATUS_TRANSLATED)
    try:
        for start in range(0, len(titles), MAX_TITLES_PER_REQUEST):
            _translate_chunk(titles[start : start + MAX_TITLES_PER_REQUEST], chat_fn=chat_fn, context=context, result=result)
    except Exception as error:  # noqa: BLE001 - 目录 agent 失败只是退回普通翻译，不挡整本书
        result.status = STATUS_FAILED
        result.error = f"{type(error).__name__}: {error}"[:500]
    by_key = {title_key(source): translated for source, translated in result.titles.items()}
    for entry in entries:
        translated = by_key.get(title_key(entry.title))
        if translated:
            result.fixed_translations[entry.id] = f"{entry.number} {translated}" if entry.number else translated
    for heading in headings or []:
        if heading.id in result.fixed_translations:
            continue
        translated = heading_translation(heading.text, by_key)
        if translated:
            result.fixed_translations[heading.id] = translated
            result.matched_headings += 1
    if result.status == STATUS_TRANSLATED and result.rejected:
        result.status = STATUS_PARTIAL
    return result


__all__ = [
    "MAX_ROUNDS",
    "MAX_TITLES_PER_REQUEST",
    "PROMPT_VERSION",
    "TocResult",
    "translate_toc",
]
