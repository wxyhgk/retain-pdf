"""render_check：问排版引擎能不能渲染。客户端逻辑用假服务测（不依赖 Node）；有真引擎时再跑一遍真实例子。"""

import sys
from pathlib import Path

import pytest

from retainpdf_math import render_check
from retainpdf_math.render_check import FormulaRenderChecker
from retainpdf_math.render_check import unrenderable_formulas

FAKE = str(Path(__file__).with_name("fake_math_check.py"))


def _fake(tmp_path, *args):
    log = tmp_path / "requests.log"
    return FormulaRenderChecker([sys.executable, FAKE, str(log), *args]), log


def test_results_follow_the_request_order_and_are_cached(tmp_path):
    checker, log = _fake(tmp_path)
    try:
        first = checker.check([("a", False), ("BAD x", False), ("a", False)])
        assert [(r.tex, r.ok, r.error) for r in first] == [("a", True, ""), ("BAD x", False, "fake error"), ("a", True, "")]
        checker.check([("a", False), ("b", False)])
        assert log.read_text().splitlines() == ["a", "BAD x", "b"], "已经问过的公式不再问"
    finally:
        checker.close()


def test_formulas_broken_in_the_source_are_not_blamed_on_the_model(tmp_path):
    checker, _ = _fake(tmp_path)
    try:
        source = "原文 $BAD ocr$ 和 $y$"
        translated = "译文 $BAD ocr$、$BAD new$ 和 $y$"
        assert [r.tex for r in unrenderable_formulas(source, translated, checker=checker)] == ["BAD new"]
        assert unrenderable_formulas(source, "没有公式", checker=checker) == []
    finally:
        checker.close()


@pytest.mark.parametrize("trigger", ["--dead", "CRASH"])
def test_an_unusable_service_turns_the_check_off_instead_of_failing(tmp_path, trigger):
    args = (trigger,) if trigger.startswith("--") else ()
    checker, _ = _fake(tmp_path, *args)
    tex = "x" if args else "CRASH now"
    assert checker.check([(tex, False)]) is None
    assert checker.disabled_reason
    assert checker.check([("y", False)]) is None, "关掉以后不再尝试"
    assert unrenderable_formulas("", "$z$", checker=checker) is None


def test_a_hung_service_times_out(tmp_path, monkeypatch):
    monkeypatch.setattr(render_check, "REPLY_TIMEOUT_S", 0.5)
    checker, _ = _fake(tmp_path)
    assert checker.check([("HANG", False)]) is None
    assert "没有回应" in checker.disabled_reason


def test_the_check_can_be_switched_off(tmp_path, monkeypatch):
    monkeypatch.setenv(render_check.ENABLE_ENV_VAR, "0")
    checker, log = _fake(tmp_path)
    assert checker.check([("a", False)]) is None
    assert not log.exists(), "关闭时连子进程都不起"


def test_with_the_real_engine():
    try:
        command, env = render_check.default_command()
    except render_check.RenderCheckUnavailable as exc:
        pytest.skip(f"排版引擎不可用：{exc}")
    checker = FormulaRenderChecker(command, env)
    try:
        results = checker.check(
            [("\\rho_{s}(\\mathbf{r}}) = \\rho_{0}(\\mathbf{r})", False), ("\\mathrm{H_aC_aH_b}", False), ("\\frac{a}{b}", False)]
        )
        if results is None:
            pytest.skip(f"排版引擎不可用：{checker.disabled_reason}")
        assert [r.ok for r in results] == [False, True, True]
        assert "brace" in results[0].error.lower()
    finally:
        checker.close()


def test_double_scripts_from_ocr_render_after_preparation():
    """真实任务（2026-10-30 论文第 4 页）：OCR 写出 `\\mathbf{F}_1_*`，MathJax 报 "Double subscripts"，
    整个公式退成源码印在译文里。渲染前补了空底数，排得出来。"""
    from retainpdf_math.render_prep import prepare_formula_for_render

    try:
        command, env = render_check.default_command()
    except render_check.RenderCheckUnavailable as exc:
        pytest.skip(f"排版引擎不可用：{exc}")
    checker = FormulaRenderChecker(command, env)
    raw = ["\\mathbf{F}_1_* = -\\mathbf{g}(\\mathbf{x}_l^{1*})", "(\\mathbf{F}_1_* - \\mathbf{F}_2_*) / \\delta x_D", "x^2^3", "x_1^2_3"]
    try:
        before = checker.check([(tex, False) for tex in raw])
        if before is None:
            pytest.skip(f"排版引擎不可用：{checker.disabled_reason}")
        assert not any(r.ok for r in before), "these are broken as OCR wrote them"
        after = checker.check([(prepare_formula_for_render(tex, display=False)[0], False) for tex in raw])
        assert [r.ok for r in after] == [True] * len(raw), [r.error for r in after]
    finally:
        checker.close()
