import sys
from pathlib import Path

import pytest

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.services.pipeline_shared.direct_typst_math import has_balanced_unescaped_dollars
from retainpdf_pipeline.services.pipeline_shared.direct_typst_math import normalize_direct_typst_translation
from retainpdf_pipeline.translate.llm.result_canonicalizer import canonicalize_batch_result


NORMALIZE_CASES = [
    {
        "name": "tight_citation_superscript",
        "source": "此前研究已有报道$^{[12,13]}$显示活性提升。",
        "expected": "此前研究已有报道 $^{[12,13]}$ 显示活性提升。",
    },
    {
        "name": "adjacent_inline_math_split",
        "source": "$a$$b$",
        "expected": "$a$ $b$",
    },
    {
        "name": "tight_prefix_and_suffix",
        "source": "速率常数$k = A e^{-E_a/RT}$随温度上升。",
        "expected": "速率常数 $k = A e^{-E_a/RT}$ 随温度上升。",
    },
    {
        "name": "double_backslash_command_collapse",
        "source": r"浓度为 $10 \\mu mol$ 时反应完成。",
        "expected": r"浓度为 $10 \mu mol$ 时反应完成。",
    },
    {
        "name": "left_bracket_no_extra_space",
        "source": "（$x$）",
        "expected": "（$x$）",
    },
    {
        "name": "right_punctuation_no_extra_space",
        "source": "结果为 $x$。",
        "expected": "结果为 $x$。",
    },
    {
        "name": "already_normalized_untouched",
        "source": "能量 $E = m c^2$ 保持守恒。",
        "expected": "能量 $E = m c^2$ 保持守恒。",
    },
    {
        "name": "newline_inside_inline_math_collapsed",
        "source": "$k =\nA$ 成立。",
        "expected": "$k = A$ 成立。",
    },
    {
        "name": "display_math_newline_preserved",
        "source": "$$a =\nb$$ 成立。",
        "expected": "$$a =\nb$$ 成立。",
    },
    {
        "name": "escaped_dollar_is_literal",
        "source": r"价格为 \$3.50 且 $x$成立。",
        "expected": r"价格为 \$3.50 且 $x$ 成立。",
    },
    {
        "name": "no_math_passthrough",
        "source": "纯正文，没有公式。",
        "expected": "纯正文，没有公式。",
    },
    {
        # 字面 $ 变量(如 Q-Chem 的 $rem 输入段)会被扫描器误判成公式跨度,
        # ASCII 相邻时必须原样保留,守护 test_direct_typst_protocol_shell 的契约。
        "name": "literal_dollar_variables_untouched",
        "source": "要启用该计算，请在 $rem 部分设置 INCDFT = 2，并使用 $active_orbitals 输入段。",
        "expected": "要启用该计算，请在 $rem 部分设置 INCDFT = 2，并使用 $active_orbitals 输入段。",
    },
]


@pytest.mark.parametrize("case", NORMALIZE_CASES, ids=lambda case: case["name"])
def test_normalize_direct_typst_translation_cases(case) -> None:
    assert normalize_direct_typst_translation(case["source"]) == case["expected"]


@pytest.mark.parametrize("case", NORMALIZE_CASES, ids=lambda case: case["name"])
def test_normalize_direct_typst_translation_is_idempotent(case) -> None:
    once = normalize_direct_typst_translation(case["source"])
    assert normalize_direct_typst_translation(once) == once


def test_unbalanced_dollars_returned_unchanged_for_repair_path() -> None:
    broken = "速率常数$k = A e^{-E_a/RT随温度上升。"
    assert not has_balanced_unescaped_dollars(broken)
    assert normalize_direct_typst_translation(broken) == broken


def test_canonicalize_batch_result_normalizes_direct_typst_items() -> None:
    item = {
        "item_id": "p001-b001",
        "protected_source_text": "Previous reports$^{[12,13]}$ showed improvement.",
        "math_mode": "direct_typst",
        "metadata": {"structure_role": "body"},
    }
    result = canonicalize_batch_result(
        [item],
        {"p001-b001": {"decision": "translate", "translated_text": "此前报道$^{[12,13]}$显示改善。"}},
    )
    assert result["p001-b001"]["translated_text"] == "此前报道 $^{[12,13]}$ 显示改善。"


def test_canonicalize_batch_result_leaves_placeholder_mode_untouched() -> None:
    item = {
        "item_id": "p001-b002",
        "protected_source_text": "Rate constant[[FORMULA_1]]increases.",
        "math_mode": "placeholder",
        "metadata": {"structure_role": "body"},
    }
    result = canonicalize_batch_result(
        [item],
        {"p001-b002": {"decision": "translate", "translated_text": "速率常数$k$随温度上升。"}},
    )
    assert result["p001-b002"]["translated_text"] == "速率常数$k$随温度上升。"
