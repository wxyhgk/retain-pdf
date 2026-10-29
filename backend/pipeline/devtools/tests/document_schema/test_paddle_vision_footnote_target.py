"""Paddle 的 vision_footnote（图表下方的注）归到表格还是图片：开头的标记 → 前一个块 → 正文里的整词。"""

from __future__ import annotations

import pytest

from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.relations import resolve_vision_footnote


def target(text: str, previous: tuple[str, int] | None = None) -> str:
    return resolve_vision_footnote(text=text, previous_anchor=previous)[3]["footnote_target"]


@pytest.mark.parametrize(
    "text",
    [
        "The stable phase was measured at 300 K.",
        "Suitable conditions are listed in the SI.",
        "A notable shift appears above 2 eV.",
    ],
)
def test_words_that_merely_contain_table_follow_the_previous_block(text):
    # 以前子串匹配 `"table" in 文本`：这几句都被当成表注。
    assert target(text, ("image_body", 3)) == "image"
    assert target(text) == "unknown"


def test_a_leading_marker_wins_over_the_previous_block():
    assert target("Table note: values are averages.", ("image_body", 3)) == "table"
    assert target("Tab. 2 continued.", ("image_body", 3)) == "table"
    assert target("表注：数据取平均值。", ("image_body", 3)) == "table"
    assert target("Figure source: authors.", ("table_html", 3)) == "image"
    assert target("Fig. 3 inset.", ("table_html", 3)) == "image"
    assert target("图注：比例尺 1 μm。", ("table_html", 3)) == "image"


def test_a_figure_note_that_mentions_a_table_stays_with_the_figure():
    assert target("Parameters as in Table 2.", ("image_body", 3)) == "image"


def test_whole_words_are_the_last_resort():
    assert target("Values from the original tables.") == "table"
    assert target("See the figures in the appendix.") == "image"
    assert target("<p>Data in Table 1.</p>") == "table"
    assert target("No marker at all.") == "unknown"
