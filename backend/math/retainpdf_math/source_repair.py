"""OCR 产物里对 LaTeX 源文的定点修补。

和降级重写的区别：这里修的是**原文本来就坏了**（OCR 扫错、把一个命令拆开或粘连），
不是「渲染器不支持、所以换个写法」。后者属于登记表（retainpdf_math 的 latex_commands.json）。

这个区分不是洁癖。降级重写每加一条都是一次静默的保真度损失，而且多半是版本脱节
的误诊；OCR 修补则是在恢复原意。两者混在一起，清理时就会连对的一起删掉，或者把
错的一起留下。
"""

from __future__ import annotations

import re


# `\\` 在这些环境里是**换行符**，不是被 OCR 写重了的反斜杠。
_ROW_SEPARATOR_CONTEXT_RE = re.compile(r"\\(?:begin|substack|atop|matrix|cases|array)\b")

# 至少两个字母才算命令名。单个字母（`\\b`、`\\c`）在数学里基本不是命令，
# 而 `\begin{cases} a \\b & ...` 里的 `b` 恰恰是个变量。
_DOUBLED_COMMAND_RE = re.compile(r"\\{2,}(?=[A-Za-z]{2,})")


def collapse_doubled_command_backslashes(expr: str) -> str:
    """把 OCR 写重的 `\\\\mu` 还原成 `\\mu`——但别碰当换行符用的 `\\\\`。

    这条规则原本是无条件的 `\\\\{2,}(?=[A-Za-z]) → \\\\`,于是自己制造了崩溃:

        \\begin{cases} a & x>0 \\\\b & x<0 \\end{cases}
                              ^^^ 换行符 + 变量 b
        → \\begin{cases} a & x>0 \\b & x<0 \\end{cases}
        → error: plugin errored with: error: unknown command: \\b

    实测 pmatrix / bmatrix / cases / aligned / substack 全中,整块因此降级。矩阵
    行分隔后面**不带空格**就会触发,而覆盖测试里的矩阵用例恰好带空格,测不到。

    这和上游把 `\\` 和 `E` 拆开造成 `unknown command: \\E` 是同一种故障,只是方向
    相反——那次是别人拆开,这次是我们自己合并。

    所以加两道约束:表达式里出现换行符环境时整体不碰,以及只认两个字母以上的命令名。
    """
    text = str(expr or "")
    if _ROW_SEPARATOR_CONTEXT_RE.search(text):
        return text
    return _DOUBLED_COMMAND_RE.sub(r"\\", text)


# 不换底数的命令：`\\sum\\limits_a^b` 的上下标还是 `\sum` 的
_SCRIPT_KEEPING_COMMANDS = {"limits", "nolimits", "displaylimits"}


def _script_argument_end(text: str, start: int) -> int:
    """`_` / `^` 后面那一个参数在哪结束：`{…}` 整组、`\\命令`、或者一个字符（前面的空格跳过）。"""
    i = start
    while i < len(text) and text[i] == " ":
        i += 1
    if i >= len(text):
        return i
    if text[i] == "{":
        depth = 0
        while i < len(text):
            if text[i] == "\\":
                i += 2
                continue
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    return i + 1
            i += 1
        return i
    if text[i] == "\\":
        j = i + 1
        while j < len(text) and text[j].isalpha():
            j += 1
        return max(j, i + 2)
    return i + 1


def separate_double_scripts(expr: str) -> str:
    """同一个底数连写两个下标（`\\mathbf{F}_1_*`）或两个上标（`x^2^3`）：中间补一个空底数 `{}`。

    OCR 把上标认成下标、或者把两层上下标拍平，就会写出这种 LaTeX；MathJax 整个公式报错
    （"Double subscripts: use braces to clarify"），渲染时退回成源码原样印出来。补上 `{}` 以后排成
    F₁ 后面再跟一个下标 *，和原文看起来一样，意思也没改。`x_1^2_3` 这种下标、上标、又下标的同理。
    """
    text = str(expr or "")
    if "_" not in text and "^" not in text:
        return text
    out: list[str] = []
    seen: set[str] = set()  # 当前底数已经有的上下标
    i = 0
    while i < len(text):
        char = text[i]
        if char in "_^":
            if char in seen:
                out.append("{}")
                seen = set()
            end = _script_argument_end(text, i + 1)
            out.append(text[i:end])
            seen.add(char)
            i = end
            continue
        if char == " ":
            out.append(char)
            i += 1
            continue
        if char == "\\":
            j = i + 1
            while j < len(text) and text[j].isalpha():
                j += 1
            j = max(j, i + 2)
            if text[i + 1 : j] not in _SCRIPT_KEEPING_COMMANDS:
                seen = set()
            out.append(text[i:j])
            i = j
            continue
        if char == "{":
            end = _script_argument_end(text, i)
            out.append(text[i:end])
            seen = set()
            i = end
            continue
        out.append(char)
        seen = set()
        i += 1
    return "".join(out)


_LEFT_RIGHT_RE = re.compile(r"\\(left|right)(?![A-Za-z])")


def balance_left_right(expr: str) -> str:
    """`\\left` 和 `\\right` 不成对：多出来的 `\\left` 在末尾补 `\\right.`，多出来的 `\\right` 在开头补 `\\left.`。

    OCR 常把中间的竖线写成 `\\left|`：`\\left\\langle \\Phi_i \\left| \\Phi_j \\right\\rangle`，MathJax 整个公式报错
    （"Extra \\left or missing \\right"），渲染时原样印出源码。`\\right.`、`\\left.` 是不画出来的空定界符，
    补上以后排成 ⟨Φi|Φj⟩，和原文一样。`\\middle|` 不算。
    """
    text = str(expr or "")
    if "\\left" not in text and "\\right" not in text:
        return text
    open_count = 0
    missing_left = 0
    for match in _LEFT_RIGHT_RE.finditer(text):
        if match.group(1) == "left":
            open_count += 1
        elif open_count:
            open_count -= 1
        else:
            missing_left += 1
    if not open_count and not missing_left:
        return text
    return "\\left. " * missing_left + text + " \\right." * open_count


__all__ = ["balance_left_right", "collapse_doubled_command_backslashes", "separate_double_scripts"]
