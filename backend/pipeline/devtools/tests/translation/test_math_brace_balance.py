"""公式里花括号不配对时要拦下修复：`$` 成对不代表能渲染。

真实例子（一本量子化学教材，p032-b002）：模型把 `\\mathbf{r}` 写成 `\\mathbf{r}}`，MathJax 解析失败，PDF 里
这个公式只能当文字原样排出来。"""

import pytest

from retainpdf_translation_classic.llm.result_validator import validate_batch_result
from retainpdf_translation_classic.llm.shared.orchestration.direct_typst_repair import build_direct_typst_repair_messages
from retainpdf_translation.llm.validation.errors import MathDelimiterError
from retainpdf_math.checks import unbalanced_brace_math_spans
from retainpdf_translation.services.quality import review_translation_item

SOURCE = (
    "ground-state electron density $ \\rho_{0}(\\mathbf{r}) $ of the molecule we are interested in; "
    "$ \\rho_{s}(\\mathbf{r}) = \\rho_{0}(\\mathbf{r}) $."
)
BROKEN = "基态电子密度 $\\rho_{0}(\\mathbf{r})$（我们所关心分子的基态电子密度）；$\\rho_{s}(\\mathbf{r}}) = \\rho_{0}(\\mathbf{r})$。"
FIXED = "基态电子密度 $\\rho_{0}(\\mathbf{r})$（我们所关心分子的基态电子密度）；$\\rho_{s}(\\mathbf{r}) = \\rho_{0}(\\mathbf{r})$。"


def test_the_real_extra_brace_is_found():
    assert unbalanced_brace_math_spans(SOURCE, BROKEN) == ["\\rho_{s}(\\mathbf{r}}) = \\rho_{0}(\\mathbf{r})"]
    assert unbalanced_brace_math_spans(SOURCE, FIXED) == []


@pytest.mark.parametrize(
    "translated",
    [
        "集合 $\\{a, b\\}$ 与 $\\left\\{ x \\right.$。",  # 转义的花括号不算
        "分数 $\\frac{a}{b}$ 和上标 $x^{2}_{i}$。",
        "行间公式 $$\\sum_{i=1}^{n} x_i$$ 结束。",
        "没有公式的普通句子 {不是公式}。",
    ],
)
def test_balanced_or_escaped_braces_pass(translated):
    assert unbalanced_brace_math_spans("", translated) == []


def test_braces_already_broken_in_the_source_are_not_blamed_on_the_model():
    source = "OCR produced $ x_{i $ here."
    assert unbalanced_brace_math_spans(source, "OCR 给出了 $x_{i$。") == []
    assert unbalanced_brace_math_spans(source, "OCR 给出了 $x_{i$ 和 $y}$。") == ["y}"]


def _item(item_id: str) -> dict:
    return {
        "item_id": item_id,
        "block_type": "text",
        "math_mode": "direct_typst",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": SOURCE,
    }


def test_quality_review_reports_the_broken_formula():
    report = review_translation_item(_item("p032-b002"), {"decision": "translate", "translated_text": BROKEN})
    issue = next(issue for issue in report.issues if issue.kind == "math_braces_unbalanced")
    assert issue.severity == "error"
    assert "\\mathbf{r}}" in issue.message


def test_validation_sends_it_to_the_math_repair_with_the_formula_named():
    item = _item("p032-b002")
    with pytest.raises(MathDelimiterError) as caught:
        validate_batch_result([item], {"p032-b002": {"decision": "translate", "translated_text": BROKEN}})
    assert "花括号" in str(caught.value) and "\\mathbf{r}}" in str(caught.value)
    messages = build_direct_typst_repair_messages(item, broken_translation=BROKEN, error_message=str(caught.value))
    assert "\\mathbf{r}}" in messages[1]["content"]


def test_a_correct_translation_passes_validation():
    validate_batch_result([_item("p032-b002")], {"p032-b002": {"decision": "translate", "translated_text": FIXED}})
