"""每次改完都跑的检查：不过就把原因退回给模型。规则草稿也过同一套检查（模型没改成时拿它兜底，它也不过就整页保留原文）。

1. 每段字都有角色（``ROLES`` 之一），字和片段一个不多一个不少（工具改不了字，这里再核一遍）；
2. 标题、章号、标签、点线、页码、作者的字都归到某一条，而且只归一条；页眉、别的不归哪一条；
3. 每条有且只有一段标题（标题的字连着，中间不夹作者行）；
4. 每条最多一个页码；页码的字像页码、章号的字像章号（原样，不是把标题的字标成页码）；页码不比草稿少；
5. 页码顺序不比草稿乱（往回走的次数不多于草稿；草稿认出的页码不到两个时不比，双栏按先左后右数）；
6. 级别 1–6；「接上一页」只能是这一页第一条。
"""
from __future__ import annotations

from retainpdf_toc_agent.context.draft import ENTRY_ROLES
from retainpdf_toc_agent.context.draft import FREE_ROLES
from retainpdf_toc_agent.context.draft import NUMBER_RE
from retainpdf_toc_agent.context.draft import PAGE_RE
from retainpdf_toc_agent.context.draft import ROLES
from retainpdf_toc_agent.context.draft import PageDraft
from retainpdf_toc_agent.context.draft import page_descents
from retainpdf_toc_agent.context.tools import MAX_LEVEL

PROBLEM_ROLE = "role_missing"
PROBLEM_TEXT_CHANGED = "text_changed"
PROBLEM_OUTSIDE_ENTRY = "outside_entry"
PROBLEM_FREE_IN_ENTRY = "free_role_in_entry"
PROBLEM_TWO_ENTRIES = "in_two_entries"
PROBLEM_NO_TITLE = "no_title"
PROBLEM_TITLE_SPLIT = "title_split"
PROBLEM_TWO_PAGES = "two_pages"
PROBLEM_PAGE_FORMAT = "page_format"
PROBLEM_NUMBER_FORMAT = "number_format"
PROBLEM_PAGES_DROPPED = "pages_dropped"
PROBLEM_PAGES_DISORDERED = "pages_disordered"
PROBLEM_LEVEL = "level_range"
PROBLEM_CONTINUE = "continue_not_first"

PROBLEM_HINTS = {
    PROBLEM_ROLE: "这些字没有角色或角色不对",
    PROBLEM_TEXT_CHANGED: "片段的字或片段个数变了（只能改角色和归属）",
    PROBLEM_OUTSIDE_ENTRY: "这些字的角色要归到某一条里（不是条目的字请标 header 或 other）",
    PROBLEM_FREE_IN_ENTRY: "header / other 的字不能在条目里",
    PROBLEM_TWO_ENTRIES: "这些字同时在两条里",
    PROBLEM_NO_TITLE: "这条没有标题的字",
    PROBLEM_TITLE_SPLIT: "这条的标题被别的字（作者行）隔成了两段：拆成两条，或把中间的字改角色",
    PROBLEM_TWO_PAGES: "这条有两个以上页码：多半是两条被并成了一条",
    PROBLEM_PAGE_FORMAT: "标成页码的字不像页码",
    PROBLEM_NUMBER_FORMAT: "标成章号的字不像章号",
    PROBLEM_PAGES_DROPPED: "页码比规则认出的少了",
    PROBLEM_PAGES_DISORDERED: "按条目顺序，页码往回走的次数比规则草稿多",
    PROBLEM_LEVEL: f"级别要在 1–{MAX_LEVEL}",
    PROBLEM_CONTINUE: "「接上一页」只能用在这一页第一条",
}


def check_draft(draft: PageDraft, baseline: PageDraft) -> list[dict]:
    """回问题列表：``{"code", "hint", "where"}``；空 = 过了。``baseline`` 是规则草稿。"""
    problems: list[dict] = []

    def problem(code: str, where: list[str] | str) -> None:
        where = [where] if isinstance(where, str) else list(where)
        problems.append({"code": code, "hint": PROBLEM_HINTS[code], "where": where[:20]})

    base_text = {fragment.id: fragment.text for fragment in baseline.fragments}
    text = {fragment.id: fragment.text for fragment in draft.fragments}
    if text != base_text:
        problem(PROBLEM_TEXT_CHANGED, sorted(set(text) ^ set(base_text)) or [f for f in text if text[f] != base_text.get(f)])
    bad_roles = [fragment.id for fragment in draft.fragments if fragment.role not in ROLES]
    if bad_roles:
        problem(PROBLEM_ROLE, bad_roles)
    seen: dict[str, str] = {}
    twice: list[str] = []
    for entry in draft.entries:
        for fragment_id in entry.fragments:
            if fragment_id in seen:
                twice.append(fragment_id)
            seen[fragment_id] = entry.id
    if twice:
        problem(PROBLEM_TWO_ENTRIES, twice)
    outside = [f.id for f in draft.fragments if f.role in ENTRY_ROLES and f.id not in seen]
    if outside:
        problem(PROBLEM_OUTSIDE_ENTRY, outside)
    free = [f.id for f in draft.fragments if f.role in FREE_ROLES and f.id in seen]
    if free:
        problem(PROBLEM_FREE_IN_ENTRY, free)
    by_id = draft.by_id()
    no_title, split, two_pages = [], [], []
    for entry in draft.entries:
        roles = [by_id[f].role for f in entry.fragments if f in by_id]
        if "title" not in roles:
            no_title.append(entry.id)
        runs = [role for role in roles if role in ("title", "author")]
        if sum(1 for index, role in enumerate(runs) if role == "title" and (index == 0 or runs[index - 1] != "title")) > 1:
            split.append(entry.id)
        if roles.count("page") > 1:
            two_pages.append(entry.id)
        if not 1 <= entry.level <= MAX_LEVEL:
            problem(PROBLEM_LEVEL, entry.id)
    for code, where in ((PROBLEM_NO_TITLE, no_title), (PROBLEM_TITLE_SPLIT, split), (PROBLEM_TWO_PAGES, two_pages)):
        if where:
            problem(code, where)
    bad_pages = [f.id for f in draft.fragments if f.role == "page" and not PAGE_RE.match(f.text.strip())]
    if bad_pages:
        problem(PROBLEM_PAGE_FORMAT, bad_pages)
    bad_numbers = [f.id for f in draft.fragments if f.role == "number" and not NUMBER_RE.match(f.text.strip())]
    if bad_numbers:
        problem(PROBLEM_NUMBER_FORMAT, bad_numbers)
    pages = sum(1 for f in draft.fragments if f.role == "page")
    base_pages = sum(1 for f in baseline.fragments if f.role == "page")
    if pages < base_pages:
        problem(PROBLEM_PAGES_DROPPED, f"{pages} < {base_pages}")
    # 规则草稿认出两个以上页码才比（页码在左的页，规则一个页码都没认出来，模型认出来的不跟它比）
    if base_pages >= 2 and page_descents(draft) > page_descents(baseline):
        problem(PROBLEM_PAGES_DISORDERED, f"{page_descents(draft)} > {page_descents(baseline)}")
    late = [entry.id for index, entry in enumerate(draft.entries) if entry.continues_prev_page and index > 0]
    if late:
        problem(PROBLEM_CONTINUE, late)
    return problems


__all__ = ["PROBLEM_HINTS", "check_draft"]
