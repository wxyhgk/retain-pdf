"""排版前的中文文字规范化（render/layout/inline_content/core/cjk_text.py）。"""

import pytest

from retainpdf_pipeline.render.layout.inline_content.core.cjk_text import NBSP
from retainpdf_pipeline.render.layout.inline_content.core.cjk_text import normalize_cjk_markdown
from retainpdf_pipeline.render.layout.inline_content.core.inline_math import surround_inline_math_with_spaces
from retainpdf_pipeline.render.layout.inline_content.mode_router import build_item_render_markdown


@pytest.mark.parametrize("source, expected", [
    # 引用词和编号、编号和量词之间不断开
    ("如图 2.7 所示", f"如图{NBSP}2.7 所示"),
    ("见第 3 章和 2.2.6 节", f"见第{NBSP}3{NBSP}章和 2.2.6{NBSP}节"),
    ("由式 $(2.21)$ 可得", f"由式{NBSP}$(2.21)$ 可得"),
    ("见习题 1.34", f"见习题{NBSP}1.34"),
    # 数字和单位：有空格的换成不可断空格，没空格的补上
    ("在 300 K 下", f"在 300{NBSP}K 下"),
    ("能量为 250kJ/mol", f"能量为 250{NBSP}kJ/mol"),
    ("误差 0.5 nm，波数 3300cm-1", f"误差 0.5{NBSP}nm，波数 3300{NBSP}cm-1"),
    # 引号、括号
    ('他说"颗粒性"是关键', "他说“颗粒性”是关键"),
    ("「非电」和『嵌套』", "“非电”和‘嵌套’"),
    ("用(固定)原子电荷", "用（固定）原子电荷"),
    ("见（Bloomfield，2010）", "见(Bloomfield, 2010)"),
    # 列表、省略号、注释上标
    ("- 第一项\n- 第二项", "• 第一项\n• 第二项"),
    ("也许那正是…原因", "也许那正是……原因"),
    ("刚度”。$^{1}$ 力场方法", "刚度”。$^{1}$力场方法"),
])
def test_normalizes_chinese_text(source, expected):
    assert normalize_cjk_markdown(source) == expected


@pytest.mark.parametrize("source", [
    "English only \"quoted\" (text), 300 K.",          # 没有汉字：不动
    "轨道 1s 和 3d 的能量",                              # 单字母单位只收 K：1s、3d 不当单位
    "单个引号\"不成对",                                  # 直引号数不成对：不动
    "1,3-丁二烯和 $E = 300 K$ 的公式",                    # 公式里不动
    "采用 B3LYP，6-31G* 基组",                           # 括号外的全角逗号是中文标点，不动
])
def test_leaves_things_alone(source):
    assert normalize_cjk_markdown(source) == source


def test_pure_superscripts_get_no_spaces_around_them():
    assert surround_inline_math_with_spaces("指定，$^{14}$但更") == "指定，$^{14}$但更"
    assert surround_inline_math_with_spaces("能量$E$是") == "能量 $E$ 是"


def test_both_render_routes_get_it():
    item = {"math_mode": "direct_typst"}
    assert build_item_render_markdown(item, "如图 2.7 所示", []) == f"如图{NBSP}2.7 所示"
