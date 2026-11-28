"""认上下文（R2）核心：信号、工具、检查、循环。不调真模型：假的 chat_fn 回录好的 actions。

合成的「拿不准」页各一条：双栏、作者行、页码在左、两条被规则拆错要合并、标签列和标题同字体、看不见的文字层；
检查一正一反；没有信号的页确认不发请求。
"""
from __future__ import annotations

import json

import pytest

from retainpdf_toc_agent import ChatResult
from retainpdf_toc_agent.context import PageDraft
from retainpdf_toc_agent.context import apply_actions
from retainpdf_toc_agent.context import check_draft
from retainpdf_toc_agent.context import heading_keys_of
from retainpdf_toc_agent.context import page_signals
from retainpdf_toc_agent.context import page_view
from retainpdf_toc_agent.context import resolve_page


def _draft(rows, *, entries=None, accepted=True, reason="", text_layer="visible", region=(50, 80, 400, 400)):
    """rows：每行一个列表，每段（字, x, 角色[, 选项]）；选项 italic / bold / size / font。
    entries：每条的片段 id 列表；不给就按规则的习惯——每行有 title 的一条，没有 title 的行（作者、页眉）不归哪条。"""
    fragments, by_line = [], {}
    for line_number, row in enumerate(rows, start=1):
        y = 80 + line_number * 14
        for text, x, role, *options in row:
            opts = options[0] if options else {}
            size = opts.get("size", 10.0)
            fragment_id = f"f{len(fragments) + 1}"
            fragments.append({"id": fragment_id, "line": line_number, "text": text, "role": role,
                              "bbox": [x, y, x + len(text) * size * 0.5, y + size], "size": size, "baseline": y + size * 0.8,
                              "font": opts.get("font", "Times-Roman"), "bold": opts.get("bold", False),
                              "italic": opts.get("italic", False)})
            by_line.setdefault(line_number, []).append(fragment_id)
    if entries is None:
        entries = [ids for line, ids in by_line.items()
                   if any(fragments[int(f[1:]) - 1]["role"] == "title" for f in ids)]
    return PageDraft.from_dict({
        "page_index": 0, "parent_block_id": "p001-b0001", "region": list(region), "page_size": [450, 600],
        "accepted": accepted, "reason": reason, "text_layer": text_layer, "fragments": fragments,
        "entries": [{"fragments": ids, "level": 1} for ids in entries],
    })


NORMAL = [
    [("1", 60, "number"), ("Analyzing the Audience", 80, "title"), ("1", 350, "page")],
    [("Who your audience is", 80, "title"), ("3", 350, "page")],
    [("References", 80, "title"), ("13", 350, "page")],
    [("2", 60, "number"), ("Balancing Precision", 80, "title"), ("15", 350, "page")],
]


class Model:
    """录好的回复，按顺序回；回复也可以是函数（看消息再答）。"""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []

    def __call__(self, messages, *, purpose, response_format=None):
        assert purpose == "toc_context" and response_format == {"type": "json_object"}
        self.calls.append(messages)
        reply = self.replies.pop(0)
        if callable(reply):
            reply = reply(messages)
        if isinstance(reply, Exception):
            raise reply
        return ChatResult(reply if isinstance(reply, str) else json.dumps(reply, ensure_ascii=False), usage={"total_tokens": 7})


def _never(*args, **kwargs):
    raise AssertionError("没有信号的页不该发请求")


def test_quiet_page_sends_no_request():
    draft = _draft(NORMAL)
    assert page_signals(draft) == []
    outcome = resolve_page(draft, signals=[], chat_fn=_never)
    assert outcome.status == "rules" and outcome.requests == 0 and outcome.effect == "none"


def test_signals_without_the_model_step_send_nothing():
    draft = _draft(NORMAL[:2])
    signals = page_signals(draft)
    assert "few_entries" in signals
    outcome = resolve_page(draft, signals=signals, chat_fn=_never, ask_model=False)
    assert outcome.status == "not_asked" and outcome.requests == 0


def test_author_lines_are_set_aside():
    rows = [
        [("Infidelity in couples", 80, "title"), ("1", 350, "page")],
        [("Fred P. Piercy and Jane Doe", 80, "title", {"italic": True, "size": 9.0})],
        [("Treating affairs", 80, "title"), ("17", 350, "page")],
        [("Kathy Smith", 80, "title", {"italic": True, "size": 9.0})],
        [("Prevention", 80, "title"), ("33", 350, "page")],
    ]
    draft = _draft(rows)
    signals = page_signals(draft)
    assert "author_line_unrecognized" in signals and "few_page_labels" not in signals
    authors = [f.id for f in draft.fragments if f.italic]
    model = Model({"actions": [
        {"tool": "set_role", "fragments": authors, "role": "author"},
        {"tool": "merge", "entries": ["e1", "e2"]},
        {"tool": "merge", "entries": ["e3", "e4"]},
        {"tool": "done"},
    ]})
    outcome = resolve_page(draft, signals=signals, chat_fn=model)
    assert outcome.status == "model" and outcome.effect == "rebuild" and outcome.requests == 1
    final = outcome.draft
    assert [final.role_text(entry, "title") for entry in final.entries] == ["Infidelity in couples", "Treating affairs", "Prevention"]
    assert [final.role_text(entry, "author") for entry in final.entries] == ["Fred P. Piercy and Jane Doe", "Kathy Smith", ""]
    assert page_signals(final) == [], "认出作者行以后不再亮"


def test_two_columns_are_pulled_apart():
    # 左右两栏在同一个视觉行里：左栏的页码夹在中间，被规则当成了标题的字
    rows = [
        [("Basics", 60, "title"), ("1", 200, "title"), ("Advanced topics", 230, "title"), ("90", 380, "page")],
        [("Setup", 60, "title"), ("5", 200, "title"), ("Tuning", 230, "title"), ("95", 380, "page")],
        [("Usage", 60, "title"), ("9", 200, "title"), ("Internals", 230, "title"), ("99", 380, "page")],
    ]
    draft = _draft(rows)
    signals = page_signals(draft)
    assert "two_columns" in signals
    by_text = {f.text: f.id for f in draft.fragments}
    actions = [{"tool": "set_role", "fragments": [by_text["1"], by_text["5"], by_text["9"]], "role": "page"}]
    for line, (left, right) in enumerate((("Basics", "Advanced topics"), ("Setup", "Tuning"), ("Usage", "Internals")), start=1):
        actions.append({"tool": "split", "entry": f"e{line}", "at": by_text[right]})
    model = Model({"actions": actions + [{"tool": "done"}]})
    outcome = resolve_page(draft, signals=signals, chat_fn=model)
    assert outcome.status == "model", outcome.problems
    pages = {outcome.draft.role_text(e, "title"): outcome.draft.role_text(e, "page") for e in outcome.draft.entries}
    assert pages == {"Basics": "1", "Setup": "5", "Usage": "9", "Advanced topics": "90", "Tuning": "95", "Internals": "99"}


def test_page_numbers_on_the_left():
    # 杂志目录：页码在左、按栏目分组不单调（规则一个页码都没认出，当成了章号）
    rows = [
        [("3", 60, "number"), ("Editorial", 90, "title")],
        [("7", 60, "number"), ("Typesetting tables", 90, "title")],
        [("12", 60, "number"), ("Fonts in practice", 90, "title")],
        [("4", 60, "number"), ("Book reviews", 90, "title")],
    ]
    draft = _draft(rows)
    signals = page_signals(draft)
    assert "page_left" in signals
    numbers = [f.id for f in draft.fragments if f.role == "number"]
    model = Model({"actions": [{"tool": "set_role", "fragments": numbers, "role": "page"}, {"tool": "done"}]})
    outcome = resolve_page(draft, signals=signals, chat_fn=model)
    assert outcome.status == "model" and outcome.requests == 1 and outcome.effect == "rebuild"
    assert [outcome.draft.role_text(e, "page") for e in outcome.draft.entries] == ["3", "7", "12", "4"]


def test_pages_must_not_get_less_ordered_than_the_draft():
    rows = NORMAL + [[("Appendix", 80, "title")], [("2", 350, "other")]]
    base = _draft(rows)
    draft = base.copy()
    apply_actions(draft, [{"tool": "attach", "line": 6, "entry": "e5"}, {"tool": "set_role", "line": 6, "role": "page"}])
    assert [problem["code"] for problem in check_draft(draft, base)] == ["pages_disordered"]
    draft = base.copy()
    apply_actions(draft, [{"tool": "attach", "line": 6, "entry": "e5"}, {"tool": "set_role", "line": 6, "role": "leader"}])
    assert check_draft(draft, base) == []


def test_wrongly_split_title_is_merged_back():
    rows = [
        [("1", 60, "number"), ("A Very Long Chapter Title That Wraps Onto", 80, "title")],
        [("The Next Line", 80, "title"), ("1", 350, "page")],
        [("2", 60, "number"), ("Short One", 80, "title"), ("9", 350, "page")],
        [("3", 60, "number"), ("Another Chapter", 80, "title"), ("20", 350, "page")],
    ]
    draft = _draft(rows)
    headings = heading_keys_of(["1 A Very Long Chapter Title That Wraps Onto The Next Line", "2 Short One"] + [f"x{i} y" for i in range(10)])
    signals = page_signals(draft, heading_keys=headings)
    assert "headings_unmatched" in signals
    outcome = resolve_page(draft, signals=signals, chat_fn=Model({"actions": [{"tool": "merge", "entries": ["e1", "e2"]}, {"tool": "done"}]}))
    assert outcome.status == "model"
    first = outcome.draft.entries[0]
    assert outcome.draft.role_text(first, "title") == "A Very Long Chapter Title That Wraps Onto The Next Line"
    assert outcome.draft.role_text(first, "number") == "1" and outcome.draft.role_text(first, "page") == "1"


def test_label_column_in_the_title_font_is_marked():
    rows = [
        [("Chapter One", 60, "title"), ("Beginnings", 140, "title"), ("1", 350, "page")],
        [("Chapter Two", 60, "title"), ("Middles", 140, "title"), ("30", 350, "page")],
        [("Chapter Three", 60, "title"), ("Endings", 140, "title"), ("61", 350, "page")],
    ]
    draft = _draft(rows)
    labels = [f.id for f in draft.fragments if f.text.startswith("Chapter")]
    outcome = resolve_page(draft, signals=["headings_unmatched"],
                           chat_fn=Model({"actions": [{"tool": "set_role", "fragments": labels, "role": "label"}, {"tool": "done"}]}))
    assert outcome.status == "model" and outcome.effect == "rebuild"
    assert [outcome.draft.role_text(e, "label") for e in outcome.draft.entries] == ["Chapter One", "Chapter Two", "Chapter Three"]
    assert [outcome.draft.role_text(e, "title") for e in outcome.draft.entries] == ["Beginnings", "Middles", "Endings"]


def test_invisible_text_layer_is_flagged_and_marked_on_rebuild():
    draft = _draft(NORMAL, text_layer="invisible")
    signals = page_signals(draft)
    assert signals == ["invisible_text_layer"]
    image = {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAA"}}
    model = Model({"actions": [{"tool": "done"}]})
    outcome = resolve_page(draft, signals=signals, chat_fn=model, image=image)
    # 截图跟着第一条用户消息走，在文字前面
    content = model.calls[0][1]["content"]
    assert content[0] == image and json.loads(content[1]["text"])["text_layer"] == "invisible"
    assert outcome.status == "model" and outcome.effect == "rebuild"


def test_rules_rejected_page_is_split_when_the_model_confirms():
    rows = [[("Preface", 80, "title"), ("vii", 350, "page")], [("Introduction", 80, "title"), ("1", 350, "page")]]
    draft = _draft(rows, accepted=False, reason="few_entries")
    signals = page_signals(draft)
    assert signals[:2] == ["rules_rejected", "few_entries"]
    outcome = resolve_page(draft, signals=signals, chat_fn=Model({"actions": [{"tool": "done"}]}))
    assert outcome.status == "model" and outcome.effect == "rebuild"


def test_problems_go_back_and_the_second_round_fixes_them():
    rows = NORMAL + [[("Index", 80, "title"), ("40", 350, "page")]]
    draft = _draft(rows)

    def second(messages):
        retry = json.loads(messages[-1]["content"].split("\n", 1)[1])
        assert [p["code"] for p in retry["problems"]] == ["two_pages"]
        assert retry["now"]["entries"][3]["title"] == "Balancing Precision Index"
        return {"actions": [{"tool": "split", "entry": "e4", "line": 5}, {"tool": "done"}]}

    model = Model({"actions": [{"tool": "merge", "entries": ["e4", "e5"]}, {"tool": "done"}]}, second)
    outcome = resolve_page(draft, signals=["few_entries"], chat_fn=model)
    assert outcome.status == "model" and outcome.requests == 2 and outcome.rounds == 2
    assert outcome.effect == "none", "拆回去和规则草稿一样：不用重建"
    assert outcome.usage == {"total_tokens": 14}


def test_still_failing_after_three_rounds_falls_back():
    bad = {"actions": [{"tool": "set_role", "fragment": "f2", "role": "page"}, {"tool": "done"}]}  # 标题标成页码
    outcome = resolve_page(_draft(NORMAL), signals=["few_entries"], chat_fn=Model(bad, bad, bad))
    assert outcome.status == "rules_fallback" and outcome.requests == 3 and outcome.effect == "none"
    assert {p["code"] for p in outcome.problems} >= {"page_format"}
    # 规则草稿自己也不过（页码标在条目外面）：整页保留原文
    broken = _draft(NORMAL, entries=[["f1", "f2"], ["f4", "f5"], ["f6", "f7"], ["f8", "f9", "f10"]])
    outcome = resolve_page(broken, signals=["few_entries"], chat_fn=Model(bad, bad, bad))
    assert outcome.status == "keep_original" and outcome.effect == "keep_page"
    # 规则本来就不认的块：照旧不动
    rejected = _draft(NORMAL, accepted=False, reason="pages_not_monotonic")
    outcome = resolve_page(rejected, signals=["rules_rejected"], chat_fn=Model(bad, bad, bad))
    assert outcome.status == "unchanged" and outcome.effect == "none"


def test_give_up_not_toc_bad_json_and_request_failure():
    draft = _draft(NORMAL)
    outcome = resolve_page(draft, signals=["few_entries"], chat_fn=Model({"actions": [{"tool": "give_up", "reason": "看不清"}]}))
    assert outcome.status == "rules_fallback" and outcome.give_up == "看不清" and outcome.requests == 1
    outcome = resolve_page(draft, signals=["few_entries"], chat_fn=Model({"actions": [{"tool": "not_toc"}]}))
    assert outcome.status == "not_toc" and outcome.effect == "keep_page"
    rejected = _draft(NORMAL, accepted=False, reason="few_page_labels")
    outcome = resolve_page(rejected, signals=["rules_rejected"], chat_fn=Model({"actions": [{"tool": "not_toc"}]}))
    assert outcome.status == "not_toc" and outcome.effect == "none"
    model = Model("我觉得没问题", {"actions": [{"tool": "done"}]})
    outcome = resolve_page(draft, signals=["few_entries"], chat_fn=model)
    assert outcome.status == "model" and outcome.requests == 2
    assert "JSON" in json.loads(model.calls[1][-1]["content"].split("\n", 1)[1])["action_errors"][0]
    outcome = resolve_page(draft, signals=["few_entries"], chat_fn=Model(RuntimeError("upstream 500")))
    assert outcome.status == "request_failed" and "upstream 500" in outcome.error and outcome.effect == "none"


def test_keep_level_and_continuation_tools():
    draft = _draft(NORMAL)
    applied = apply_actions(draft, [
        {"tool": "keep", "entry": "e3", "reason": "name"},
        {"tool": "set_level", "entry": "e2", "level": 2},
        {"tool": "continue_from_prev_page", "entry": "e1"},
        {"tool": "set_level", "entry": "e2", "level": 9},
        {"tool": "merge", "entries": ["e1"]},
        {"tool": "rewrite", "text": "x"},
    ])
    assert applied.applied == 3 and len(applied.errors) == 3
    assert draft.entry("e3").keep == "name" and draft.entry("e2").level == 2 and draft.entry("e1").continues_prev_page
    assert check_draft(draft, _draft(NORMAL)) == []
    view = page_view(draft, ["few_entries"])
    assert view["entries"][2]["keep"] == "name" and view["entries"][0]["continues_prev_page"] is True
    assert view["lines"][0]["frags"][1] == {"id": "f2", "t": "Analyzing the Audience", "x": 60 + 20, "s": 10.0, "role": "title", "e": "e1"}


def test_attach_to_a_new_entry_and_header_detaches():
    rows = NORMAL + [[("Appendix", 80, "other"), ("50", 350, "other")]]
    draft = _draft(rows)
    base = draft.copy()
    applied = apply_actions(draft, [
        {"tool": "attach", "line": 5, "entry": "new"},
        {"tool": "set_role", "fragment": "f12", "role": "page"},
        {"tool": "set_role", "fragment": "f1", "role": "header"},
    ])
    assert not applied.errors
    assert draft.role_text(draft.entries[-1], "title") == "Appendix" and draft.role_text(draft.entries[-1], "page") == "50"
    assert "f1" not in draft.entries[0].fragments
    assert check_draft(draft, base) == []


@pytest.mark.parametrize("case, actions, code", [
    ("角色不对", [{"tool": "set_role", "fragment": "f2", "role": "title"}], None),
    ("标题标成页码", [{"tool": "set_role", "fragment": "f2", "role": "page"}], "page_format"),
    ("标题标成章号", [{"tool": "set_role", "fragment": "f2", "role": "number"}], "number_format"),
    ("两条并成一条", [{"tool": "merge", "entries": ["e1", "e2"]}], "two_pages"),
    ("条目里没有标题", [{"tool": "split", "entry": "e1", "at": "f3"}], "no_title"),
    ("页码移出条目", [{"tool": "set_role", "fragment": "f3", "role": "other"}], "pages_dropped"),
    ("作者行夹在标题中间", [{"tool": "merge", "entries": ["e1", "e2", "e3"]}, {"tool": "set_role", "fragment": "f4", "role": "author"}], "title_split"),
    ("接上一页不是第一条", [{"tool": "continue_from_prev_page", "entry": "e2"}], "continue_not_first"),
])
def test_checks_catch_each_problem(case, actions, code):
    base = _draft(NORMAL)
    draft = base.copy()
    apply_actions(draft, actions)
    codes = [problem["code"] for problem in check_draft(draft, base)]
    if code is None:
        assert codes == [], case
    else:
        assert code in codes, (case, codes)


def test_checks_catch_changed_text_roles_outside_and_doubled_fragments():
    base = _draft(NORMAL)
    draft = base.copy()
    draft.fragments[1].text = "Rewritten"
    draft.fragments[0].role = "chapter"
    draft.entries[1].fragments.append("f1")
    draft.fragments[4].role = "title"
    draft.entries[2].fragments.remove("f6")
    codes = {problem["code"] for problem in check_draft(draft, base)}
    assert {"text_changed", "role_missing", "in_two_entries", "outside_entry"} <= codes
    draft = base.copy()
    draft.entries[0].fragments.append("f6")
    draft.fragments[5].role = "header"
    assert "free_role_in_entry" in {problem["code"] for problem in check_draft(draft, base)}
