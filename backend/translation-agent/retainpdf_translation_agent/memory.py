"""术语记忆：术语表（带版本和作用域）、保留原文的专名、缩写。

- 每条术语有状态：候选（译者报上来的）→ 审定（同一译法报了两次、没有别的译法和它争）→ 锁定（用户给的，谁都不能改）。
  锁定的全书必须照用；译者报上来升成审定的，只在报过它的章里必须照用，在两章里都用过才全书必须照用——
  别的章只给作参考（实测：第 2 章定的 token = 词元 被强制用到第 3 章的 access token 上，把"访问令牌"改坏了）。
- 作用域是章：空表示全书。同一个词在某一章意思不同（同词异义），译者在交卷时声明例外；同一章里同一个例外译法
  报了两次，就加一条只管这一章的审定术语。两种译法打架记一张歧义单，不自动统一，等术语专员或人来定。
- 表的每次变动都升版本、记原因（`changes`），旧版本由调用方存成快照；每块译文记下用到的术语和版本（`used_terms`），
  术语改了能反查回去。
"""

from __future__ import annotations

import re
from dataclasses import asdict
from dataclasses import dataclass
from dataclasses import field

TERM = "term"  # 专业术语：有译法
KEEP = "keep"  # 保留原文：人名、机构、期刊、软件，译文里原样出现
ABBR = "abbr"  # 缩写：译文里保留缩写本身，全称见 note
CATEGORIES = (TERM, KEEP, ABBR)

CANDIDATE = "candidate"
APPROVED = "approved"
LOCKED = "locked"
BINDING = (APPROVED, LOCKED)

PROMOTE_AFTER = 2  # 同一译法报了这么多次（不同的块）才升成审定
QUOTE_CHARS = 200


def _key(source: str) -> str:
    return " ".join(source.split()).lower()


def same_term(a: str, b: str) -> bool:
    """同一个词：不分大小写、空白，单复数（box / boxes）算一个。"""
    ka, kb = _key(a), _key(b)
    if ka == kb:
        return True
    short, long = sorted((ka, kb), key=len)
    return long in (short + "s", short + "es")


@dataclass
class Term:
    id: str
    source: str
    target: str
    category: str = TERM
    scope: list[str] = field(default_factory=list)  # 章；空 = 全书
    status: str = CANDIDATE
    first_seen: dict = field(default_factory=dict)  # {"page", "quote"}
    votes: dict[str, int] = field(default_factory=dict)  # 候选：每种译法被报了几次
    voters: list[str] = field(default_factory=list)  # 报过的块，同一块重复报只算一次
    version: int = 0  # 这一条最后一次变动时表的版本
    note: str = ""
    chapters: list[str] = field(default_factory=list)  # 报过、用过它的章；空 = 不按章限（用户给的、程序加的）

    @property
    def binding(self) -> bool:
        return self.status in BINDING

    def binds(self, chapter: str) -> bool:
        """在这一章必须照用吗：锁定的、不按章限的审定条目全书都要；译者报出来的审定条目只管报过它的章，两章以上就全书。"""
        if self.status == LOCKED:
            return True
        if self.status != APPROVED:
            return False
        return not self.chapters or chapter in self.chapters or len(self.chapters) >= 2

    def applies_to(self, chapter: str) -> bool:
        return not self.scope or chapter in self.scope

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "Term":
        return cls(**data)

    def for_context(self, chapter: str = "") -> dict:
        """放进上下文包里的样子：只给模型用得上的。在这一章不必照用的审定条目显示成候选。"""
        status = self.status if self.binds(chapter) or self.status == CANDIDATE else CANDIDATE
        out = {"id": self.id, "source": self.source, "target": self.target, "category": self.category, "status": status}
        if self.scope:
            out["scope"] = self.scope
        if self.note:
            out["note"] = self.note
        return out


def term_pattern(source: str, category: str) -> re.Pattern:
    """按词边界找；术语不分大小写、允许复数，专名和缩写区分大小写。"""
    words = r"\s+".join(re.escape(w) for w in source.split())
    if category == TERM:
        return re.compile(rf"(?<![\w-]){words}(?:s|es)?(?![\w-])", re.IGNORECASE)
    return re.compile(rf"(?<![\w-]){words}(?![\w-])")


def find_terms(text: str, terms: list) -> list:
    """`text` 里出现了哪些术语（`Term` 或 `for_context()` 的字典）。长的优先，被长术语盖住的短术语不算。"""
    def attr(term, name):
        return term[name] if isinstance(term, dict) else getattr(term, name)

    hits: list[tuple[int, int, object]] = []
    for term in sorted(terms, key=lambda t: -len(attr(t, "source"))):
        category = attr(term, "category")
        for match in term_pattern(attr(term, "source"), category).finditer(text):
            span = (match.start(), match.end())
            if any(s < span[1] and span[0] < e for s, e, _ in hits):
                continue
            hits.append((span[0], span[1], term))
    seen: set[str] = set()
    found = []
    for _, _, term in sorted(hits, key=lambda h: h[0]):
        if attr(term, "id") not in seen:
            seen.add(attr(term, "id"))
            found.append(term)
    return found


def quote_around(text: str, phrase: str) -> str:
    """原文里包含 `phrase` 的那句（找不到返回空串，调用方据此丢弃没有出处的条目）。"""
    match = term_pattern(phrase, TERM).search(text)
    if not match:
        return ""
    start = max(text.rfind(". ", 0, match.start()) + 2, 0)
    end = text.find(". ", match.end())
    end = len(text) if end < 0 else end + 1
    sentence = text[start:end].strip()
    return sentence if len(sentence) <= QUOTE_CHARS else text[max(0, match.start() - 80) : match.end() + 80].strip()


class Glossary:
    def __init__(self) -> None:
        self.version = 0
        self.terms: dict[str, Term] = {}
        self.changes: list[dict] = []  # 每次变动：版本、术语、动作、原因
        self.tickets: list[dict] = []  # 歧义单：同一个词报上来不同的译法
        self._counter = 0

    # ---- 查 ----
    def find(self, source: str, chapter: str, *, category: str | None = None) -> Term | None:
        """适用于这一章的那一条：只管这一章的优先于全书的，审定、锁定的优先于候选。"""
        best: Term | None = None
        for term in self.terms.values():
            if not same_term(term.source, source) or not term.applies_to(chapter) or (category and term.category != category):
                continue
            rank = (bool(term.scope), term.binds(chapter))
            if best is None or rank > (bool(best.scope), best.binds(chapter)):
                best = term
        return best

    def lookup(self, text: str, chapter: str) -> list[Term]:
        """`text` 里出现、适用于这一章的术语（同一个词只取最该用的那条）。"""
        applicable: dict[str, Term] = {}
        for term in self.terms.values():
            if term.applies_to(chapter):
                chosen = self.find(term.source, chapter, category=term.category)
                if chosen is not None:
                    applicable[chosen.id] = chosen
        return find_terms(text, list(applicable.values()))

    # ---- 改 ----
    def _new_id(self, category: str) -> str:
        self._counter += 1
        return f"{category[0]}{self._counter:04d}"

    def _bump(self, term: Term, action: str, reason: str) -> None:
        self.version += 1
        term.version = self.version
        self.changes.append(
            {"version": self.version, "term": term.id, "action": action, "source": term.source, "target": term.target, "status": term.status, "reason": reason}
        )

    def add(
        self,
        source: str,
        target: str,
        *,
        category: str = TERM,
        status: str = LOCKED,
        scope: list[str] | None = None,
        reason: str,
        page: str = "",
        quote: str = "",
        note: str = "",
    ) -> Term:
        """直接加一条（用户给的术语、程序抓的缩写和专名）。同一个词同一作用域已经有了就覆盖译法。"""
        if category not in CATEGORIES:
            raise ValueError(f"unknown term category {category!r}")
        scope = list(scope or [])
        for term in self.terms.values():
            if same_term(term.source, source) and term.scope == scope and term.category == category:
                if term.status == LOCKED and status != LOCKED:
                    return term
                term.target, term.status, term.note = target, status, note or term.note
                self._bump(term, "update", reason)
                return term
        term = Term(self._new_id(category), source, target, category, scope, status, {"page": page, "quote": quote}, note=note)
        self.terms[term.id] = term
        self._bump(term, "add", reason)
        return term

    def revise(self, term_id: str, target: str, *, reason: str) -> Term:
        """改一条已有术语的译法（术语专员或人）。锁定的也能改，因为只有人或术语专员调这个。"""
        term = self.terms[term_id]
        term.target = target
        term.status = LOCKED if term.status == LOCKED else APPROVED
        self._bump(term, "revise", reason)
        return term

    def propose(self, source: str, target: str, *, category: str, block_id: str, page: str, chapter: str, quote: str) -> str:
        """译者报上的译法。返回 agreed（和定好的一致）、candidate（记成候选）、promoted（升成审定）、conflict（记了歧义单）。"""
        if category not in (TERM, KEEP):
            category = TERM
        if category == KEEP:
            target = source
        current = self.find(source, chapter, category=category)
        if current is not None and current.binding:
            if current.target == target:
                if current.chapters and chapter and chapter not in current.chapters:
                    # 另一章也照这个译法用了：记下这一章，够两章就全书必须照用
                    current.chapters.append(chapter)
                    self._bump(current, "widen", f"第 {page} 页 {block_id}（{chapter}）也这样译")
                return "agreed"
            self._ticket(current, target, block_id, page, quote, "和定好的译法不同")
            return "conflict"
        if current is None:
            current = Term(self._new_id(category), source, target, category, [], CANDIDATE, {"page": page, "quote": quote})
            self.terms[current.id] = current
            self._bump(current, "candidate", f"第 {page} 页 {block_id} 报上")
        return self._vote(current, target, block_id, page, quote, chapter)

    def declare_exception(self, source: str, used: str, *, block_id: str, page: str, chapter: str, quote: str, reason: str) -> str:
        """译者声明：这一处意思不同，没照用定好的译法。同一章同一个例外译法报够两次，加一条只管这一章的审定术语。"""
        general = self.find(source, chapter, category=TERM)
        if general is not None and general.scope == [chapter] and chapter:
            return self._vote(general, used, block_id, page, quote, chapter)
        self._ticket(general, used, block_id, page, quote, f"声明例外：{reason}")
        if not chapter:
            return "conflict"
        scoped = Term(self._new_id(TERM), source, used, TERM, [chapter], CANDIDATE, {"page": page, "quote": quote}, note=reason)
        self.terms[scoped.id] = scoped
        self._bump(scoped, "candidate", f"第 {page} 页 {block_id} 声明同词异义：{reason}")
        return self._vote(scoped, used, block_id, page, quote, chapter)

    def _vote(self, term: Term, target: str, block_id: str, page: str, quote: str, chapter: str = "") -> str:
        if block_id in term.voters:
            return "candidate"
        term.voters.append(block_id)
        if chapter and chapter not in term.chapters:
            term.chapters.append(chapter)
        term.votes[target] = term.votes.get(target, 0) + 1
        if len(term.votes) > 1:
            if len(term.votes) == 2 and term.votes[target] == 1:
                self._ticket(term, target, block_id, page, quote, "候选里有两种译法")
            return "conflict"
        if term.status == CANDIDATE and term.votes[target] >= PROMOTE_AFTER:
            term.target = target
            term.status = APPROVED
            self._bump(term, "promote", f"同一译法报了 {term.votes[target]} 次")
            return "promoted"
        return "candidate"

    def _ticket(self, term: Term | None, target: str, block_id: str, page: str, quote: str, why: str) -> None:
        self.tickets.append(
            {
                "term": term.id if term else None,
                "source": term.source if term else "",
                "current": term.target if term else "",
                "proposed": target,
                "block": block_id,
                "page": page,
                "quote": quote,
                "why": why,
            }
        )

    # ---- 存 ----
    def to_dict(self) -> dict:
        return {
            "version": self.version,
            "counter": self._counter,
            "terms": [t.to_dict() for t in self.terms.values()],
            "changes": self.changes,
            "tickets": self.tickets,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Glossary":
        glossary = cls()
        glossary.version = int(data.get("version") or 0)
        glossary._counter = int(data.get("counter") or 0)
        glossary.terms = {t["id"]: Term.from_dict(t) for t in data.get("terms") or []}
        glossary.changes = list(data.get("changes") or [])
        glossary.tickets = list(data.get("tickets") or [])
        return glossary


# ---- 程序抓缩写："Intersection over Union (IoU)"、"optical character recognition (OCR)" ----
ABBR_RE = re.compile(r"\(([A-Z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*s?)\)")
_STOP = {"of", "and", "the", "for", "in", "on", "over", "to", "a", "an"}


def extract_abbreviations(text: str) -> list[tuple[str, str]]:
    """找"全称 (缩写)"：括号前最短的一串词，首字母（跳过或不跳过 of、over 这类小词）拼起来等于缩写。"""
    found: list[tuple[str, str]] = []
    for match in ABBR_RE.finditer(text):
        abbr = match.group(1)
        letters = re.sub(r"s$", "", abbr) if abbr.endswith("s") and abbr[:-1].isupper() else abbr
        words = re.findall(r"[A-Za-z][\w-]*", text[max(0, match.start() - 120) : match.start()])
        for size in range(1, min(8, len(words)) + 1):
            candidate = words[-size:]
            if candidate[0].lower() in _STOP:
                continue
            initials_all = "".join(w[0] for w in candidate)
            initials_content = "".join(w[0] for w in candidate if w.lower() not in _STOP)
            if letters.lower() in (initials_all.lower(), initials_content.lower()):
                found.append((abbr, " ".join(candidate)))
                break
    return found
