"""交给渲染器之前对单个公式的改写——渲染时这样改，翻译阶段的公式渲染检查也照这样改，检查的才是真正交给
渲染器的样子（真实例子：模型写 `R_e/\\AA`，MathJax 不认 `\\AA`，但渲染前它已被改成 `Å`，PDF 里是好的；不先改写
就会冤枉模型）。

原本是 render/layout/inline_content/core/inline_math.py 里 sanitize_direct_typst_inline_math 的内嵌函数，
原样搬来，行为不变。
"""

from __future__ import annotations

import re

from retainpdf_math.normalize import normalize_formula_for_latex_math
from retainpdf_math.source_repair import balance_left_right
from retainpdf_math.source_repair import collapse_doubled_command_backslashes
from retainpdf_math.source_repair import separate_double_scripts


# 埃符号。mitex 0.2.7 在文本组里把 `\AA` / `\aa` / `\r{A}` / `\mathring{A}` 翻成
# Typst 代码 `circle(A)` / `circle[A];` / `mathring[A];` 却不求值，页面上印出字面的
# "circle(A)"；数学模式里 `\AA` 出成斜体 𝐴̊，`\aa` 更是出成大写 𝐴̊。Unicode 的 Å / å
# 在两种模式下都按正体原样输出，所以统一改写成字符本身。控制词后面的 `{}` 一并吃掉；
# 后面的空格保留（LaTeX 会吞掉它，但译文里 `1 \AA thick` 想要的显然是带空格）。
_ANGSTROM_COMMAND_RE = re.compile(r"\\(AA|aa)(?![A-Za-z])(?:\{\})?")
_RING_ACCENT_RE = re.compile(r"\\r(?:\s*\{\s*([Aa])\s*\}|\s+([Aa])(?![A-Za-z]))")
# `\mathring{A}` 只在文本组里改写：数学模式下 mitex 渲染正确，而且它常常是「集合 A 的
# 内部」这类数学记号，不是埃。
_MATHRING_A_RE = re.compile(r"\\mathring(?:\s*\{\s*([Aa])\s*\}|\s+([Aa])(?![A-Za-z]))")
_LATEX_TEXT_GROUP_RE = re.compile(r"\\(?:text|textrm|textup|textnormal|textit|textbf|textsf|texttt)\s*\{")
_ANGSTROM_BY_LETTER = {"A": "Å", "a": "å"}


def _ring_letter(match: re.Match[str]) -> str:
    return _ANGSTROM_BY_LETTER[match.group(1) or match.group(2)]


def _replace_angstrom_commands(text: str) -> str:
    text = _ANGSTROM_COMMAND_RE.sub(lambda match: _ANGSTROM_BY_LETTER[match.group(1)[0]], text)
    return _RING_ACCENT_RE.sub(_ring_letter, text)


def _replace_in_latex_text_groups(expr: str, replacer) -> str:
    chunks: list[str] = []
    index = 0
    while True:
        match = _LATEX_TEXT_GROUP_RE.search(expr, index)
        if match is None:
            chunks.append(expr[index:])
            return "".join(chunks)
        body_start = match.end()
        cursor = body_start
        depth = 1
        while cursor < len(expr):
            char = expr[cursor]
            if char == "\\":
                cursor += 2
                continue
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    break
            cursor += 1
        if depth != 0:
            chunks.append(expr[index:])
            return "".join(chunks)
        chunks.append(expr[index:body_start])
        chunks.append(replacer(expr[body_start:cursor]))
        index = cursor


def normalize_angstrom_in_math(expr: str) -> str:
    if "\\" not in (expr or ""):
        return expr
    expr = _replace_in_latex_text_groups(expr, lambda body: _MATHRING_A_RE.sub(_ring_letter, body))
    return _replace_angstrom_commands(expr)


def normalize_angstrom_in_text(text: str) -> str:
    # 公式外的 `\AA` cmarker 原样印出反斜杠。这里只认 `\AA` / `\aa`：散文里的 `\r`
    # 可能是别的东西（路径、转义残片），不碰。
    if "\\" not in (text or ""):
        return text
    return _ANGSTROM_COMMAND_RE.sub(lambda match: _ANGSTROM_BY_LETTER[match.group(1)[0]], text)


def prepare_formula_for_render(expr: str, *, display: bool) -> tuple[str, bool]:
    """一个公式（不含 `$`）→ (改写后的内容, 是否还是公式)。少数写法会直接变成普通文字（® 、表格单元格名）。"""
    if expr in {"^®", "^{®}", r"^\circled{R}", r"^\textcircled{R}"}:
        return "®", False
    spreadsheet_cell = re.fullmatch(r"\\([A-Za-z]{1,3})\\([0-9]{1,7})", expr)
    if spreadsheet_cell:
        return f"{spreadsheet_cell.group(1)}{spreadsheet_cell.group(2)}", False
    # 这几条修的是 OCR / 模型产物，不是 mitex 的能力缺口，所以留着。
    # 第一条曾经是无条件的，把矩阵/cases 的换行符 `\\` 也合并掉，自己制造了
    # `unknown command: \b`——约束和缘由都在 source_repair 里。
    expr = collapse_doubled_command_backslashes(expr)
    expr = separate_double_scripts(expr)
    expr = balance_left_right(expr)
    expr = re.sub(r"\\langlen\b", r"\\langle n", expr)
    expr = re.sub(r"\\angle(?=[A-Za-z])", r"\\angle ", expr)
    # Do not rewrite prefix scripts (e.g. ⟨^{N} → ⟨{}^{N}).
    # That regex treated LaTeX "\ " (backslash-space) as a delimiter and
    # corrupted temperatures like -78\ ^{\circ}\mathrm{C} into -78\{}^{\circ}...
    # Prefix-script form is owned by translation (protect / match-then-translate);
    # rendering only does light mitex-compatible delimiter/symbol cleanup.
    expr = re.sub(r"\\circled\s*\{\s*\\times\s*\}", r"\\otimes", expr)
    expr = re.sub(r"\\circled\s*\{\s*\\parallel\s*\}", r"\\circ", expr)
    expr = re.sub(r"\\circled\s*\{\s*([^{}]+?)\s*\}", r"\1", expr)
    expr = normalize_angstrom_in_math(expr)
    if display:
        expr = normalize_formula_for_latex_math(expr)
    return expr, True


__all__ = [
    "normalize_angstrom_in_math",
    "normalize_angstrom_in_text",
    "prepare_formula_for_render",
]
