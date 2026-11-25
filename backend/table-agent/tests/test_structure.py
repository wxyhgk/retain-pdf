"""定结构（G4 前半）：结构工具、文字层核对、轮数上限、修好的结构接着翻格子。表全是合成的，模型用脚本假的。

假的「表格模型」（``FakeLayer``）只做核心要的那几件事：文字层每行若干个词（带横坐标），列界固定在 100、200……；
列数和真列数不一样就是 ``columns_not_found``；一行表格里两行以上文字、每行都占了两列以上（没确认折行）就是
``row_swallows_rows``；词落在没有格子的位置上就丢了。
"""
from __future__ import annotations

import json

from retainpdf_table_agent import STATUS_TRANSLATED
from retainpdf_table_agent import STRUCTURE_FIXED
from retainpdf_table_agent import STRUCTURE_KEPT
from retainpdf_table_agent import StructureSource
from retainpdf_table_agent import TableContext
from retainpdf_table_agent import TableResult
from retainpdf_table_agent import TableTermMemory
from retainpdf_table_agent import cache_key
from retainpdf_table_agent import fix_structure
from retainpdf_table_agent import needs_structure_fix
from retainpdf_table_agent import structure_fingerprint
from retainpdf_table_agent import translate_table

IMAGE = {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAA"}}


class FakeLayer:
    """合成的文字层 + 重建规则。``lines`` 每行是 [(词, 横坐标), …]，列 = 横坐标 // 100。"""

    def __init__(self, lines: list[list[tuple[str, int]]], *, true_cols: int) -> None:
        self.lines = lines
        self.true_cols = true_cols
        self.rebuilds = 0

    def texts(self) -> list[str]:
        return [" ".join(word for word, _ in line) for line in self.lines]

    def rebuild(self, draft: dict) -> dict:
        self.rebuilds += 1
        n_rows, n_cols = draft["n_rows"], draft["n_cols"]
        model = {"model_version": "table.v1", "block_id": "p001-b001", "n_rows": n_rows, "n_cols": n_cols,
                 "source_kind": "text_layer", "cells": [], "issues": [], "suspect_rows": []}
        if n_cols != self.true_cols:
            model["issues"].append("columns_not_found")
            return model
        owner = {}
        for cell in draft["cells"]:
            for dr in range(cell["rowspan"]):
                for dc in range(cell["colspan"]):
                    owner[(cell["row"] + dr, cell["col"] + dc)] = (cell["row"], cell["col"])
        words: dict[tuple[int, int], list[str]] = {(cell["row"], cell["col"]): [] for cell in draft["cells"]}
        for row, indexes in enumerate(draft["row_lines"]):
            for index in indexes:
                for word, x in self.lines[index]:
                    key = owner.get((row, x // 100))
                    if key is not None:
                        words[key].append(word)
        header_rows = draft.get("header_rows")
        header_rows = 1 if header_rows is None else header_rows
        for cell in draft["cells"]:
            text = " ".join(words[(cell["row"], cell["col"])])
            numeric = text.replace(".", "").isdigit()
            model["cells"].append({
                "id": f"r{cell['row']}c{cell['col']}", "row": cell["row"], "col": cell["col"],
                "rowspan": cell["rowspan"], "colspan": cell["colspan"], "text": text,
                "role": "empty" if not text else "header" if cell["row"] < header_rows else "stub" if cell["col"] == 0 else "data",
                "content_kind": "empty" if not text else "numeric" if numeric else "text",
                "suggested_action": "translate" if text and not numeric else "keep",
            })
        for row, indexes in enumerate(draft["row_lines"]):
            full = [index for index in indexes if len({x // 100 for _, x in self.lines[index]}) >= 2]
            if row not in draft.get("wrapped_rows", []) and len(full) >= 2:
                model["suspect_rows"].append(row)
        if model["suspect_rows"]:
            model["issues"].append("row_swallows_rows")
        return model


def _grid(rows: list[list[tuple[int, int]]]) -> list[dict]:
    """每行 [(rowspan, colspan), …] → 初稿的格子（照 HTML 占位算起始列）。"""
    cells, occupied = [], set()
    for row_index, row in enumerate(rows):
        column = 0
        for rowspan, colspan in row:
            while (row_index, column) in occupied:
                column += 1
            cells.append({"row": row_index, "col": column, "rowspan": rowspan, "colspan": colspan, "ocr_text": ""})
            for dr in range(rowspan):
                for dc in range(colspan):
                    occupied.add((row_index + dr, column + dc))
            column += colspan
    return cells


def _source(layer: FakeLayer, rows: list[list[tuple[int, int]]], row_lines: list[list[int]], *, n_cols: int) -> StructureSource:
    draft = {"n_rows": len(rows), "n_cols": n_cols, "cells": _grid(rows), "row_lines": row_lines, "caption_lines": [],
             "skipped_lines": [], "header_rows": None, "wrapped_rows": []}
    return StructureSource(lines=layer.texts(), draft=draft, rebuild=layer.rebuild, screenshot=lambda: IMAGE)


class Script:
    """按顺序回放模型回复，记下每次收到的消息。"""

    def __init__(self, *replies: dict | str) -> None:
        self.replies = [reply if isinstance(reply, str) else json.dumps(reply, ensure_ascii=False) for reply in replies]
        self.calls: list[list[dict]] = []

    def __call__(self, messages, *, purpose, response_format=None):  # noqa: ANN001
        self.calls.append([dict(message) for message in messages])
        assert response_format == {"type": "json_object"}
        return self.replies[len(self.calls) - 1]


# 合成表：表题一行被框进了表格（L0），表头一行（L1），第 1 行吞了两条数据（L2、L3），最后一行正常（L4）。
SWALLOWED = [
    [("Table", 0), ("9", 40), ("Synthetic", 60), ("data", 120)],
    [("Sample", 0), ("Phase", 110), ("Mass", 210)],
    [("alpha", 0), ("solid", 110), ("1.5", 210)],
    [("beta", 0), ("liquid", 110), ("2.5", 210)],
    [("gamma", 0), ("gas", 110), ("3.5", 210)],
]


def _swallowed() -> tuple[FakeLayer, StructureSource, dict]:
    layer = FakeLayer(SWALLOWED, true_cols=3)
    source = _source(layer, [[(1, 1)] * 3] * 3, [[0, 1], [2, 3], [4]], n_cols=3)
    return layer, source, layer.rebuild(source.draft)


def test_a_fixed_structure_passes_the_checks_and_feeds_the_cell_translation_loop() -> None:
    _, source, model = _swallowed()
    assert needs_structure_fix(model) and model["suspect_rows"] == [0, 1]
    chat = Script({"action": "edit", "done": True, "edits": [
        {"tool": "move_to_caption", "lines": [0]},
        {"tool": "split_row", "row": 1, "at_lines": [3]},
    ]})
    result = fix_structure(model, source=source, chat_fn=chat, caption="Table 9 Synthetic data")

    assert (result.status, result.rounds, result.rejected) == (STRUCTURE_FIXED, 1, 0)
    assert (result.shape_before, result.shape_after, result.issues_after) == ((3, 3), (4, 3), [])
    texts = {cell["id"]: cell["text"] for cell in result.model["cells"]}
    assert texts == {"r0c0": "Sample", "r0c1": "Phase", "r0c2": "Mass", "r1c0": "alpha", "r1c1": "solid", "r1c2": "1.5",
                     "r2c0": "beta", "r2c1": "liquid", "r2c2": "2.5", "r3c0": "gamma", "r3c1": "gas", "r3c2": "3.5"}
    request = chat.calls[0]
    assert request[1]["content"][0] is IMAGE, "截图放在第一个 user 消息里，原样交给调用方的模型调用"
    view = request[1]["content"][1]["text"]
    assert "表题：Table 9 Synthetic data" in view and "第 1 行 ← L2–L3  （规则：可能吞了好几行）" in view
    assert "L0 Table 9 Synthetic data" in view and "r1c1 solid liquid" in view

    # 修好的结构接着翻格子（和普通的表一样）
    translate = Script({"action": "submit", "cells": {"r0c0": "样品", "r0c1": "相态", "r0c2": "质量", "r1c0": "keep",
                                                       "r1c1": "固体", "r2c0": "keep", "r2c1": "液体", "r3c0": "keep",
                                                       "r3c1": "气体"}})
    translated = translate_table(result.model, chat_fn=lambda m, **k: translate(m, **k), memory=TableTermMemory())
    assert translated.status == STATUS_TRANSLATED
    assert translated.translations()["r2c1"] == "液体"


def test_edits_that_lose_text_or_break_the_rules_are_undone_and_sent_back_with_reasons() -> None:
    layer, source, model = _swallowed()
    chat = Script(
        {"action": "edit", "done": True, "edits": [
            {"tool": "delete_cell", "cell": "r2c1"},             # 后面的格子左移，「3.5」没地方落：丢字，撤回
            {"tool": "move_to_caption", "lines": [2]},          # 表格中间的行不能当表题
            {"tool": "split_row", "row": 1, "at_lines": [2]},   # 从这一行的第一行文字切不出新行
            {"tool": "confirm_rows", "rows": [2]},              # 规则没标吞行的行
            {"tool": "set_span", "cell": "r9c9", "rowspan": 1},  # 没有这个格子
            {"tool": "rewrite_table"},                          # 没有这个工具
            {"tool": "set_span", "cell": "r2c2", "colspan": 3},  # 把列撑多了：只许删列
            "split everything",
        ]},
        {"action": "edit", "done": True, "edits": [{"tool": "move_to_caption", "lines": [0]},
                                                   {"tool": "split_row", "row": 1, "at_lines": [3]}]},
    )
    result = fix_structure(model, source=source, chat_fn=chat)

    assert (result.status, result.rounds, result.rejected) == (STRUCTURE_FIXED, 2, 8)
    feedback = chat.calls[1][-1]["content"]
    assert "收下 0 条改动" in feedback
    assert '"delete_cell"' in feedback and "改完有字没落进任何格子（3.5）" in feedback
    assert "L2 在表格中间" in feedback
    assert "从这一行的第一行文字 L2 切不出新行" in feedback
    assert "第 2 行规则没标吞行" in feedback
    assert "没有格子 r9c9" in feedback
    assert "没有这个工具" in feedback and "改完列数从 3 变成 5" in feedback
    assert "row_swallows_rows：第 0、1 行" in feedback, "撤回以后结构照旧，没过的检查原样告诉模型"
    assert [edit["tool"] for edit in result.edits] == ["move_to_caption", "split_row"]


def test_edits_refer_to_the_structure_shown_at_the_start_of_the_round_and_done_waits_for_rejections() -> None:
    # 分组标题（L1，横跨三列）和一行数据（L2）被并成了第 1 行。模型先合并、再切开，还把表题行（L0）一起切：
    # 都按这一轮开头的编号写的。切出来的新行一列一格，不照抄合并出来的跨列。
    lines = [[("Head", 0), ("A", 110), ("B", 210)], [("Group", 0), ("one", 110)], [("x", 0), ("y", 110), ("z", 210)],
             [("u", 0), ("v", 110), ("w", 210)]]
    layer = FakeLayer(lines, true_cols=3)
    source = _source(layer, [[(1, 1)] * 3] * 3, [[0], [1, 2], [3]], n_cols=3)
    model = layer.rebuild(source.draft)
    chat = Script(
        {"action": "edit", "done": True, "edits": [
            {"tool": "merge_cells", "cells": ["r1c0", "r1c1", "r1c2"]},
            {"tool": "split_row", "row": 1, "at_lines": [1, 2]},   # L1 已经是这一行第一行文字：当没写
            {"tool": "set_span", "cell": "r0c0", "rowspan": 0},    # 退回：这一轮说了 done 也要再看一轮
        ]},
        {"action": "edit", "edits": [], "done": True},
    )
    result = fix_structure(model, source=source, chat_fn=chat)
    assert (result.status, result.rounds, result.rejected) == (STRUCTURE_FIXED, 2, 1)
    cells = {cell["id"]: (cell["text"], cell["colspan"]) for cell in result.model["cells"]}
    assert cells["r1c0"] == ("Group one", 3)
    assert (cells["r2c0"], cells["r2c1"], cells["r2c2"]) == (("x", 1), ("y", 1), ("z", 1))
    assert "规则检查都过了" in chat.calls[1][-1]["content"] and "rowspan、colspan 至少是 1" in chat.calls[1][-1]["content"]


def test_a_table_that_never_passes_keeps_the_original_after_three_rounds() -> None:
    _, source, model = _swallowed()
    chat = Script(*[{"action": "edit", "done": True, "edits": [{"tool": "move_to_caption", "lines": [0]}]}] * 2, "not json")
    result = fix_structure(model, source=source, chat_fn=chat)

    assert (result.status, result.reason, result.rounds, result.model) == (STRUCTURE_KEPT, "rounds_exhausted", 3, None)
    assert result.issues_after == ["row_swallows_rows"]
    assert len(chat.calls) == 3
    assert "只回一个 JSON 对象" not in chat.calls[2][-1]["content"]
    assert "规则检查都过了" not in chat.calls[1][-1]["content"]
    # 没修好的表照旧不翻
    skipped = translate_table(model, chat_fn=Script(), memory=TableTermMemory())
    assert skipped.reason == "structure_unreliable:row_swallows_rows"


def test_the_model_can_give_up_and_wrapped_rows_can_be_confirmed() -> None:
    _, source, model = _swallowed()
    gave_up = fix_structure(model, source=source, chat_fn=Script({"action": "give_up", "reason": "看不清"}))
    assert (gave_up.status, gave_up.reason, gave_up.rounds) == (STRUCTURE_KEPT, "model_gave_up", 1)

    # 折行的说明文字表：一行表格两行文字都占两列，但截图里是同一条记录
    layer = FakeLayer([[("Item", 0), ("Note", 110)], [("pump", 0), ("runs", 110)], [("hot", 0), ("slowly", 110)]], true_cols=2)
    wrapped = _source(layer, [[(1, 1)] * 2] * 2, [[0], [1, 2]], n_cols=2)
    model = layer.rebuild(wrapped.draft)
    confirm = Script({"action": "edit", "done": True, "edits": [{"tool": "confirm_rows", "rows": [1]}]})
    result = fix_structure(model, source=wrapped, chat_fn=confirm)
    assert result.status == STRUCTURE_FIXED and result.model["n_rows"] == 2
    assert {cell["id"]: cell["text"] for cell in result.model["cells"]}["r1c1"] == "runs slowly"


def test_columns_not_found_from_a_wrong_rowspan_and_an_extra_cell_is_fixed_by_span_and_delete() -> None:
    # OCR：第 1 行的 A 多跨了一行，把第 3 行挤到右边；第 4 行多认了一格 → 4 列，文字层只有 3 列
    lines = [[("Name", 0), ("Mode", 110), ("Value", 210)], [("A", 0), ("fast", 110), ("1", 210)],
             [("slow", 110), ("2", 210)], [("B", 0), ("idle", 110), ("3", 210)], [("C", 0), ("off", 110), ("4", 210)]]
    layer = FakeLayer(lines, true_cols=3)
    rows = [[(1, 1)] * 3, [(3, 1), (1, 1), (1, 1)], [(1, 1)] * 2, [(1, 1)] * 3, [(1, 1)] * 4]
    source = _source(layer, rows, [[0], [1], [2], [3], [4]], n_cols=4)
    model = layer.rebuild(source.draft)
    assert model["issues"] == ["columns_not_found"]
    chat = Script({"action": "edit", "done": True, "edits": [{"tool": "set_span", "cell": "r1c0", "rowspan": 2},
                                                              {"tool": "delete_cell", "cell": "r4c3"}]})
    first = chat  # 结构视图里列找不到时显示 OCR 的字
    result = fix_structure(model, source=source, chat_fn=chat)
    assert result.status == STRUCTURE_FIXED and result.shape_after == (5, 3)
    texts = {cell["id"]: cell["text"] for cell in result.model["cells"]}
    assert (texts["r1c0"], texts["r3c0"], texts["r3c1"], texts["r4c2"]) == ("A", "B", "idle", "4")
    assert "columns_not_found：按 4 列切不开文字层" in first.calls[0][1]["content"][1]["text"]


def test_merge_cells_and_delete_column_and_header_rows() -> None:
    # 分组标题一行被切成两格；最右多认了一整列空列
    lines = [[("Key", 0), ("Val", 110)], [("Group", 0), ("one", 60)], [("k1", 0), ("v1", 110)]]
    layer = FakeLayer(lines, true_cols=2)
    source = _source(layer, [[(1, 1)] * 3, [(1, 1), (1, 2)], [(1, 1)] * 3], [[0], [1], [2]], n_cols=3)
    model = layer.rebuild(source.draft)
    chat = Script({"action": "edit", "done": True, "edits": [
        {"tool": "delete_column", "col": 2},
        {"tool": "merge_cells", "cells": ["r1c0", "r1c1"]},
        {"tool": "merge_cells", "cells": ["r0c0", "r2c1"]},  # 拼不成长方形：退回
        {"tool": "set_header_rows", "rows": 1},
    ]}, {"action": "edit", "edits": [], "done": True})
    result = fix_structure(model, source=source, chat_fn=chat)
    assert result.status == STRUCTURE_FIXED and result.rejected == 1
    cells = {cell["id"]: cell for cell in result.model["cells"]}
    assert cells["r1c0"]["text"] == "Group one" and cells["r1c0"]["colspan"] == 2 and "r1c1" not in cells
    assert result.shape_after == (3, 2)


def test_tables_outside_this_rounds_scope_are_not_sent() -> None:
    chat = Script()
    for issues in (["no_text_layer"], ["ocr_html_missing"], ["row_swallows_rows", "no_text_layer"], []):
        model = {"issues": issues, "n_rows": 1, "n_cols": 1}
        assert not needs_structure_fix(model)
        source = StructureSource(lines=[], draft={}, rebuild=lambda draft: {}, screenshot=lambda: IMAGE)
        assert fix_structure(model, source=source, chat_fn=chat).status == STRUCTURE_KEPT
    _, source, model = _swallowed()
    no_image = StructureSource(lines=source.lines, draft=source.draft, rebuild=source.rebuild, screenshot=lambda: None)
    assert fix_structure(model, source=no_image, chat_fn=chat).reason == "no_screenshot"
    assert chat.calls == []


def test_cache_key_covers_the_structure_draft_and_results_keep_the_structure_record() -> None:
    _, source, model = _swallowed()
    plain = cache_key(model, TableContext(), engine="haiku")
    assert plain == cache_key(model, TableContext(), engine="haiku", structure="")
    with_structure = cache_key(model, TableContext(), engine="haiku", structure=structure_fingerprint(source))
    assert with_structure != plain

    other = StructureSource(lines=source.lines, draft={**source.draft, "row_lines": [[0], [1, 2, 3], [4]]},
                            rebuild=source.rebuild, screenshot=source.screenshot)
    assert structure_fingerprint(other) != structure_fingerprint(source)

    result = TableResult(block_id="b", status="skipped")
    assert "structure" not in result.as_dict(), "没走定结构的表，结果和以前一字不差"
    result.structure = {"status": "fixed", "rounds": 1}
    assert TableResult.from_dict(result.as_dict()).structure == {"status": "fixed", "rounds": 1}
