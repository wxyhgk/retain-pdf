"""表格 agent（表格翻译 T3）：JSON 动作循环、逐格校验、分段、术语记忆。模型用脚本假的。"""
from __future__ import annotations

import json

from retainpdf_translation_classic.services.tables import STATUS_KEPT
from retainpdf_translation_classic.services.tables import STATUS_SKIPPED
from retainpdf_translation_classic.services.tables import STATUS_TRANSLATED
from retainpdf_translation_classic.services.tables import TableContext
from retainpdf_translation_classic.services.tables import TableTermMemory
from retainpdf_translation_classic.services.tables import cache_key
from retainpdf_translation_classic.services.tables import translate_table
from retainpdf_translation_classic.services.tables import translated_table_html
from retainpdf_translation_classic.services.tables.cells import plan_chunks
from retainpdf_translation_classic.services.tables.cells import table_cells


def _cell(row: int, col: int, text: str, role: str, kind: str, **span: int) -> dict:
    return {
        "id": f"r{row}c{col}", "row": row, "col": col, "rowspan": span.get("rowspan", 1), "colspan": span.get("colspan", 1),
        "text": text, "role": role, "content_kind": kind, "suggested_action": "translate" if kind == "text" else "keep",
    }


def _table(*cells: dict, issues: list[str] | None = None) -> dict:
    return {
        "model_version": "table.v1", "block_id": "p003-b007",
        "n_rows": max(cell["row"] for cell in cells) + 1, "n_cols": max(cell["col"] for cell in cells) + 1,
        "cells": list(cells), "issues": issues or [],
    }


TABLE = _table(
    _cell(0, 0, "Entry", "header", "text"),
    _cell(0, 1, "Solvent", "header", "text"),
    _cell(0, 2, "Yield<sup>a</sup> (%)", "header", "text"),
    _cell(1, 0, "1", "stub", "numeric"),
    _cell(1, 1, "toluene", "data", "text"),
    _cell(1, 2, "92", "data", "numeric"),
    _cell(2, 0, "2", "stub", "numeric"),
    _cell(2, 1, "THF", "data", "code"),
    _cell(2, 2, "80", "data", "numeric"),
)


class Script:
    """按顺序回放模型回复，记下每次收到的消息。"""

    def __init__(self, *replies: dict | str) -> None:
        self.replies = [reply if isinstance(reply, str) else json.dumps(reply, ensure_ascii=False) for reply in replies]
        self.calls: list[list[dict]] = []

    def __call__(self, messages, *, purpose, response_format=None):  # noqa: ANN001
        assert purpose == "table_translate" and response_format == {"type": "json_object"}
        self.calls.append([dict(message) for message in messages])
        return self.replies[len(self.calls) - 1]


def test_cells_are_rendered_with_role_and_rule_flags_and_translations_come_back_per_cell() -> None:
    chat = Script({"action": "submit", "cells": {"r0c0": "序号", "r0c1": "溶剂", "r0c2": "产率<sup>a</sup> (%)", "r1c1": "甲苯"},
                   "terms": {"toluene": "甲苯"}})
    memory = TableTermMemory()
    result = translate_table(TABLE, chat_fn=chat, memory=memory, context=TableContext(caption="Table 1 Optimisation"))

    assert result.status == STATUS_TRANSLATED and result.rounds == 1
    assert result.translations() == {"r0c0": "序号", "r0c1": "溶剂", "r0c2": "产率<sup>a</sup> (%)", "r1c1": "甲苯"}
    assert result.cells["r1c2"] == {"source": "92", "translation": None, "decided_by": "rule"}
    prompt = chat.calls[0][1]["content"]
    assert "表题：Table 1 Optimisation" in prompt
    assert "r0c2 H ? Yield<sup>a</sup> (%)" in prompt and "r2c1 D = THF" in prompt and "r1c2 D = 92" in prompt
    assert memory.lookup(["Toluene", "Solvent"]) == {"Toluene": "甲苯", "Solvent": "溶剂"}


def test_cells_failing_the_checks_go_back_with_reasons_and_only_those_are_resubmitted() -> None:
    chat = Script(
        {"action": "submit", "cells": {"r0c0": "序号", "r0c1": "the solvent", "r0c2": "产率 (%)", "r1c1": "甲苯 2"}},
        {"action": "submit", "cells": {"r0c1": "溶剂", "r0c2": "产率<sup>a</sup> (%)", "r1c1": "甲苯"}},
    )
    result = translate_table(TABLE, chat_fn=chat, memory=TableTermMemory())

    assert result.status == STATUS_TRANSLATED and result.feedback_rounds == 1
    feedback = chat.calls[1][-1]["content"]
    assert "r0c1：译文里没有中文" in feedback
    assert "r0c2：上下标" in feedback
    assert "r1c1：数字和原文不一致" in feedback
    assert "r0c0" not in feedback, "收下的格子不再要"
    assert result.translations()["r0c0"] == "序号"


def test_lookup_terms_answers_from_the_glossary_and_earlier_tables() -> None:
    memory = TableTermMemory()
    memory.add_glossary([("turnover frequency", "转换频率")])
    memory.add("turnover frequency", "周转频率")  # 表格的译法盖不掉锁定的术语表
    memory.add("ee", "对映体过量")
    chat = Script(
        {"action": "lookup_terms", "terms": ["Turnover frequency", "ee", "dr"]},
        {"action": "submit", "cells": {"r0c0": "keep", "r0c1": "keep", "r0c2": "keep", "r1c1": "keep"}},
    )
    result = translate_table(TABLE, chat_fn=chat, memory=memory)

    answer = chat.calls[1][-1]["content"]
    assert "Turnover frequency → 转换频率" in answer and "ee → 对映体过量" in answer and "dr → （这本书里还没有）" in answer
    assert result.status == STATUS_KEPT and result.reason == "model_kept_all"


def test_known_translations_in_the_table_text_are_put_in_the_prompt() -> None:
    memory = TableTermMemory()
    memory.add("toluene", "甲苯")
    memory.add("ethanol", "乙醇")
    chat = Script({"action": "submit", "cells": {"r0c0": "序号", "r0c1": "溶剂", "r0c2": "产率<sup>a</sup> (%)", "r1c1": "甲苯"}})
    translate_table(TABLE, chat_fn=chat, memory=memory)
    prompt = chat.calls[0][1]["content"]
    assert "已知译法：\ntoluene → 甲苯" in prompt and "ethanol" not in prompt


def test_a_table_that_never_passes_is_kept_whole_instead_of_half_translated() -> None:
    bad = {"action": "submit", "cells": {"r0c0": "序号", "r0c1": "溶剂", "r0c2": "产率", "r1c1": "甲苯"}}
    chat = Script(*[bad] + ["not json"] * 5)
    result = translate_table(TABLE, chat_fn=chat, memory=TableTermMemory())
    assert (result.status, result.reason, result.rounds) == (STATUS_KEPT, "rounds_exhausted", 6)
    assert result.translations() == {}
    assert "只回一个 JSON 对象" in chat.calls[2][-1]["content"]


def test_tables_with_an_unreliable_structure_or_nothing_to_translate_are_not_sent() -> None:
    chat = Script()
    skipped = translate_table(_table(*TABLE["cells"], issues=["row_swallows_rows"]), chat_fn=chat, memory=TableTermMemory())
    assert (skipped.status, skipped.reason) == (STATUS_SKIPPED, "structure_unreliable:row_swallows_rows")
    numbers_only = _table(_cell(0, 0, "1", "data", "numeric"), _cell(0, 1, "2.5", "data", "numeric"))
    assert translate_table(numbers_only, chat_fn=chat, memory=TableTermMemory()).reason == "no_cells_to_translate"
    assert chat.calls == []


def test_long_tables_are_split_by_rows_and_every_chunk_sees_the_header() -> None:
    cells = [_cell(0, 0, "Compound", "header", "text"), _cell(0, 1, "Appearance", "header", "text")]
    for row in range(1, 121):
        cells += [_cell(row, 0, f"C{row}", "stub", "code"), _cell(row, 1, "white solid" if row % 2 else "yellow oil", "data", "text")]
    table = _table(*cells)
    chunks = plan_chunks(table_cells(table))
    assert len(chunks) == 2
    assert [cell.cell_id for cell in chunks[0].candidates[:2]] == ["r0c0", "r0c1"]
    assert {cell.cell_id for cell in chunks[1].context} >= {"r0c0", "r0c1"}

    def reply(chunk_index: int) -> dict:
        first = chunks[chunk_index].candidates
        values = {"Compound": "化合物", "Appearance": "外观", "white solid": "白色固体", "yellow oil": "黄色油状物"}
        # 第二段里原文和第一段相同的格子代码已经沿用，模型只交剩下的（这里没有剩下的）
        return {"action": "submit", "cells": {cell.cell_id: values[cell.text] for cell in first}}

    chat = Script(reply(0), reply(1))
    result = translate_table(table, chat_fn=chat, memory=TableTermMemory())
    assert result.status == STATUS_TRANSLATED and result.chunks == 2
    assert len(chat.calls) == 1, "第二段的格子原文都在第一段出现过，沿用译法，不再请求"
    assert result.translations()["r120c1"] == "黄色油状物"


def test_whole_table_html_keeps_spans_and_escapes_text() -> None:
    table = _table(
        _cell(0, 0, "Entry", "header", "text", rowspan=2),
        _cell(0, 1, "Yield<sup>a</sup> (%)", "header", "text", colspan=2),
        _cell(1, 1, "A", "header", "code"),
        _cell(1, 2, "B", "header", "code"),
        _cell(2, 0, "1", "stub", "numeric"),
        _cell(2, 1, "<5", "data", "numeric"),
        _cell(2, 2, "92", "data", "numeric"),
    )
    chat = Script({"action": "submit", "cells": {"r0c0": "序号", "r0c1": "产率<sup>a</sup> (%)"}})
    result = translate_table(table, chat_fn=chat, memory=TableTermMemory())
    assert translated_table_html(table, result) == (
        '<table><tr><th rowspan="2">序号</th><th colspan="2">产率<sup>a</sup> (%)</th></tr>'
        "<tr><th>A</th><th>B</th></tr><tr><td>1</td><td>&lt;5</td><td>92</td></tr></table>"
    )


def test_the_cache_key_changes_with_the_engine_and_the_cells_but_not_with_dict_order() -> None:
    key = cache_key(TABLE, TableContext(), engine="haiku")
    assert key == cache_key({**TABLE, "cells": list(reversed(TABLE["cells"]))}, TableContext(), engine="haiku")
    assert key != cache_key(TABLE, TableContext(), engine="qwen")
    changed = {**TABLE, "cells": [*TABLE["cells"][:-1], _cell(2, 2, "81", "data", "numeric")]}
    assert key != cache_key(changed, TableContext(), engine="haiku")
