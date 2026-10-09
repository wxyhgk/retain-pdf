"""全角标点和公式之间不留空格。

31 本书、3512 个译文块里有 319 块是「， $dV/dl$」这样：给公式两边补空格时把全角逗号也当成
了汉字。全角标点本身带留白，再加一个空格排出来就是一道明显的空隙。翻译时的规整和渲染时的
兜底（旧缓存走它）两处都要守住，否则改了一边另一边又加回去。
"""
import pytest

from retainpdf_pipeline.render.layout.inline_content.core.inline_math import surround_inline_math_with_spaces
from retainpdf_pipeline.services.pipeline_shared.direct_typst_math import (
    is_fullwidth_punctuation,
    normalize_direct_typst_translation,
)

CASES = [
    ("极小值点， $dV/dl$ 在该处为零", "极小值点，$dV/dl$ 在该处为零"),
    ("由于 $x$ ，所以", "由于 $x$，所以"),
    ("若 $a$ 和 $b$ 。", "若 $a$ 和 $b$。"),
    ("（$x$）", "（$x$）"),
    # 汉字和公式之间照旧补空格。
    ("其中$M$是质量。", "其中 $M$ 是质量。"),
    ("力为$F$，方向", "力为 $F$，方向"),
]


@pytest.mark.parametrize("normalize", [normalize_direct_typst_translation, surround_inline_math_with_spaces])
@pytest.mark.parametrize("source,expected", CASES)
def test_no_space_between_fullwidth_punctuation_and_math(normalize, source, expected):
    assert normalize(source) == expected


@pytest.mark.parametrize("normalize", [normalize_direct_typst_translation, surround_inline_math_with_spaces])
def test_ascii_context_unchanged(normalize):
    assert normalize("a $x$ b") == "a $x$ b"


def test_fullwidth_punctuation_detection():
    assert all(is_fullwidth_punctuation(ch) for ch in "，。、；：？！（）「」【】")
    # 全角字母数字、汉字、半角标点都不算。
    assert not any(is_fullwidth_punctuation(ch) for ch in "Ａ１中,.")
