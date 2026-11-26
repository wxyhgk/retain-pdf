"""译文「`$` 成对没有」只有一份判定（2026-11-26，状态管理 Z4 / S02）。

- 规则：未转义的 `$` 成对；`\\$` 是字面美元符；行内代码（反引号）里的 `$` 不算。
- 实现：`retainpdf_math.spans.has_balanced_inline_math_delimiters`。classic 的质量校验（`quality.py`）、classic 请求缓存、
  读页的可疑译文日志都用它；agent 核心只许用标准库，`checks.dollars_balanced` 是抄本，这里钉着两边逐条一致。
- 以前读页和 classic 数 `$` 不排除行内代码，agent 排除，`` `echo $HOME` `` 这种 agent 放过的译文读页时被抹掉。
  排除行内代码以后，代码外面真不成对的照样要拦下。
"""

from __future__ import annotations

import pytest

from retainpdf_math.spans import has_balanced_inline_math_delimiters
from retainpdf_translation.services.quality import review_translation_item
from retainpdf_translation_agent.checks import check_block
from retainpdf_translation_agent.checks import dollars_balanced

BALANCED = [
    "运行 `echo $HOME` 查看目录。",
    "用 `s/a$/b/` 替换行尾，`$1` 是第一组。",
    "能量 $E(x)$ 沿路径最小。",
    "能量 $E(x)$，再运行 `echo $PATH`。",
    "价格写成 \\$5，公式 $x^2$。",
    "行间公式 $$\\sum_i x_i$$ 结束。",
    "没有公式。",
    "",
]
UNBALANCED = [
    "该药每片售价仅 $5，含税。",
    "谐振子 $x^2 是模型体系。",
    "$a$ $b",
    # 代码外面不成对：有行内代码也照样拦
    "运行 `ls` 后，能量 $E(x) 沿路径最小。",
    "`echo $HOME` 和 $x$ 以及 $y",
    # 反引号没配对就不算行内代码，里面的 `$` 照数
    "运行 `echo $HOME 查看目录。",
    # 反引号不跨行
    "运行 `echo\n$HOME` 查看目录。",
    # 转义的不算，剩下的单个照样不成对
    "\\$5 和 $x",
]


@pytest.mark.parametrize("text", BALANCED)
def test_balanced(text: str) -> None:
    assert has_balanced_inline_math_delimiters(text)
    assert dollars_balanced(text)


@pytest.mark.parametrize("text", UNBALANCED)
def test_unbalanced_outside_code_is_still_caught(text: str) -> None:
    assert not has_balanced_inline_math_delimiters(text)
    assert not dollars_balanced(text)


@pytest.mark.parametrize("text", BALANCED + UNBALANCED)
def test_agent_check_uses_the_same_rule(text: str) -> None:
    if not text:
        return  # 空译文 agent 报 empty，不走 `$` 判定
    flagged = any(issue["code"] == "formula_unbalanced" for issue in check_block("source", text))
    assert flagged is (not has_balanced_inline_math_delimiters(text))


def _item() -> dict:
    return {
        "item_id": "p001-b001",
        "block_type": "text",
        "math_mode": "direct_typst",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": "Run `echo $HOME` and check the energy $E(x)$ along the path.",
    }


def _quality_flags(text: str) -> bool:
    report = review_translation_item(_item(), {"decision": "translate", "translated_text": text})
    return any(issue.kind == "math_delimiter_unbalanced" for issue in report.issues)


def test_quality_review_accepts_dollars_inside_inline_code() -> None:
    assert not _quality_flags("运行 `echo $HOME`，再看能量 $E(x)$ 沿路径的变化。")


@pytest.mark.parametrize("text", [
    "运行 `echo $HOME`，再看能量 $E(x) 沿路径的变化。",
    "运行 echo $HOME，再看能量 $E(x)$ 沿路径的变化。",
    "运行 `echo`，再看能量 $E(x) 沿路径的变化。",
])
def test_quality_review_still_rejects_unbalanced_dollars_outside_code(text: str) -> None:
    assert _quality_flags(text)
