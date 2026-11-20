"""一本书的表格术语记忆：术语表、正文里定下的译法、前面的表定下的译法，后翻的表查得到。

只记短的（≤ 6 个词）——整句的格子不当术语。来源有先后：术语表 > 正文（翻译的 job-memory）> 表格，
后来的低一级的译法盖不掉高一级的。
"""
from __future__ import annotations

import re
import threading
from dataclasses import dataclass

MAX_TERM_WORDS = 6
MAX_TERMS_IN_PROMPT = 40

ORIGIN_GLOSSARY = "glossary"
ORIGIN_BODY = "body"
ORIGIN_TABLE = "table"
_RANK = {ORIGIN_TABLE: 1, ORIGIN_BODY: 2, ORIGIN_GLOSSARY: 3}


@dataclass(frozen=True)
class Term:
    source: str
    target: str
    origin: str


def _key(text: str) -> str:
    return " ".join(text.split()).casefold()


class TableTermMemory:
    def __init__(self) -> None:
        self._terms: dict[str, Term] = {}
        self._lock = threading.Lock()

    def add(self, source: str, target: str, *, origin: str = ORIGIN_TABLE) -> None:
        source, target = " ".join(str(source or "").split()), str(target or "").strip()
        if not source or not target or len(source.split()) > MAX_TERM_WORDS or source == target:
            return
        with self._lock:
            existing = self._terms.get(_key(source))
            if existing is not None and _RANK.get(existing.origin, 0) > _RANK.get(origin, 0):
                return
            self._terms[_key(source)] = Term(source, target, origin)

    def add_glossary(self, entries: list[tuple[str, str]]) -> None:
        for source, target in entries:
            self.add(source, target, origin=ORIGIN_GLOSSARY)

    def add_body_terms(self, entries: list[tuple[str, str]]) -> None:
        for source, target in entries:
            self.add(source, target, origin=ORIGIN_BODY)

    def lookup(self, terms: list[str]) -> dict[str, str | None]:
        with self._lock:
            return {term: (self._terms[_key(term)].target if _key(term) in self._terms else None) for term in terms}

    def matching(self, text: str, *, limit: int = MAX_TERMS_IN_PROMPT) -> list[Term]:
        """在这段文字里出现过的已知译法（整词匹配，不分大小写），长的优先。"""
        haystack = " ".join(text.split()).casefold()
        with self._lock:
            terms = sorted(self._terms.values(), key=lambda term: -len(term.source))
        found: list[Term] = []
        for term in terms:
            pattern = r"(?<!\w)" + re.escape(_key(term.source)) + r"(?!\w)"
            if re.search(pattern, haystack):
                found.append(term)
                if len(found) >= limit:
                    break
        return found

    def snapshot(self) -> list[Term]:
        with self._lock:
            return sorted(self._terms.values(), key=lambda term: term.source.casefold())

    def __len__(self) -> int:
        return len(self._terms)


__all__ = ["ORIGIN_BODY", "ORIGIN_GLOSSARY", "ORIGIN_TABLE", "TableTermMemory", "Term"]
