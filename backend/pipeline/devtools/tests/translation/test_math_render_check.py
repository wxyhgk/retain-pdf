"""翻译阶段的公式渲染检查：排版引擎排不出来的公式交给公式修复，检查服务不可用时不影响翻译。

检查服务换成假的（协议和引擎的 bin/rpr-math-check.js 一样），不依赖 Node。"""

import sys
from pathlib import Path

import pytest

from retainpdf_math import render_check
from retainpdf_translation_classic.llm.result_validator import validate_batch_result
from retainpdf_translation.llm.validation.errors import MathDelimiterError

FAKE = Path(__file__).resolve().parents[4] / "math" / "tests" / "fake_math_check.py"
SOURCE = "the integral $ \\int f $ and the symbol $ \\alpha $."


@pytest.fixture
def fake_checker(monkeypatch):
    checker = render_check.FormulaRenderChecker([sys.executable, str(FAKE)])
    monkeypatch.setattr(render_check, "_SHARED", checker)
    yield checker
    checker.close()


def _item() -> dict:
    return {
        "item_id": "p001-b001",
        "block_type": "text",
        "math_mode": "direct_typst",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": SOURCE,
    }


def test_an_unrenderable_formula_goes_to_the_math_repair(fake_checker):
    translated = "积分 $\\int f$ 和符号 $\\alpha BAD$。"
    with pytest.raises(MathDelimiterError) as caught:
        validate_batch_result([_item()], {"p001-b001": {"decision": "translate", "translated_text": translated}})
    assert "\\alpha BAD" in str(caught.value) and "fake error" in str(caught.value)


def test_a_renderable_translation_passes(fake_checker):
    validate_batch_result([_item()], {"p001-b001": {"decision": "translate", "translated_text": "积分 $\\int f$ 和符号 $\\alpha$。"}})


def test_no_checker_means_no_render_check(monkeypatch):
    dead = render_check.FormulaRenderChecker([sys.executable, str(FAKE), "--dead"])
    monkeypatch.setattr(render_check, "_SHARED", dead)
    validate_batch_result([_item()], {"p001-b001": {"decision": "translate", "translated_text": "符号 $\\alpha BAD$。"}})
    assert dead.disabled_reason
