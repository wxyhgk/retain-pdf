"""整块是命令行 / 代码（工具手册里的 Tcl、shell 命令和命令语法）：不送模型，保留原文。

OCR 常把命令示例标成普通文字块（`set_edt_pins output 1 tdo tap_i/tap_edt_channel_reg_in`）。以前它们照样
送去翻：模型把命令原样留下，被「英文残留」判失败；Tcl 的 `$spec` 被当成公式定界符判「不配对」；最后补翻
名额不够，整本书卡在导出门禁（2026-11-03，6574 页的 Tessent 命令手册卡了 322 块）。有的模型还会输出
「这是一行字面命令，保持原样」之类的话当译文。

判断只看文字本身：去掉成对的 `$…$` 公式以后，代码记号（`-option`、下划线标识符、`{}`、`$var`、`\\`、`=`、
`;`、`|`、路径）占大头，英文虚词几乎没有（引号里的字符串、选项后面的值不算）。跨 55 个任务调过：那本手册
322 块认出 306 块，其余 54 个任务只多认了 1 行纯算式。
"""

from __future__ import annotations

import re

_STOPWORDS = frozenset(
    "the a an to of in is are was were be been and or but that this these those for with by as on at from "
    "which when where while you your can will not it its into than then there their they we our may must "
    "should if all any each also use used using".split()
)
_CODE_CHARS = frozenset("_${}\\=;|<>#*")
_FLAG_RE = re.compile(r"^-{1,2}[A-Za-z][\w-]*$")
_WORD_RE = re.compile(r"^[A-Za-z]+[.,:;!?)]*$")
_CJK_RE = re.compile(r"[぀-ヿ㐀-鿿]")
_LATEX_COMMAND_RE = re.compile(r"\$[^$]*\\[A-Za-z]+[^$]*\$|\\\(|\\\[")
_MATH_SPAN_RE = re.compile(r"\$[^$]+\$")
_SNAKE_HEAD_RE = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$")
_PROMPT_RE = re.compile(r"[A-Z_]*>|%|\$")
_SINGLE_TOKEN_RE = re.compile(r"[A-Za-z][\w.]*_[\w.]+|[\w./\[\]{}*$-]*[\[\]{}/$][\w./\[\]{}*$-]*")
_SENTENCE_INTO_PROSE_RE = re.compile(r"[a-z][.!?]\s+[A-Z][a-z]+\s+[a-z]+")
_IDENTIFIER_RE = re.compile(r"[a-z]_[a-z]|[a-z]\.[a-z_]")


def _path_like(token: str) -> bool:
    # 斜杠只在路径样的写法里算：两个以上斜杠，或者带下划线、数字（Battery/resistor、volt/meter 不算）
    return "/" in token and (token.count("/") >= 2 or bool(re.search(r"[_\d]", token)))


def _is_code_token(token: str) -> bool:
    return bool(
        _FLAG_RE.match(token)
        or any(ch in _CODE_CHARS for ch in token)
        or _path_like(token)
        or _IDENTIFIER_RE.search(token)
    )


def _stopword_count(tokens: list[str]) -> int:
    # 引号里的字符串、选项后面跟的值（-lockup on、-patterns all）不算
    unquoted = re.sub(r'"[^"]*"', " ", " ".join(tokens)).split()
    count = 0
    for index, token in enumerate(unquoted):
        if not _WORD_RE.match(token) or token.rstrip(".,:;!?)").lower() not in _STOPWORDS:
            continue
        if index > 0 and _FLAG_RE.match(unquoted[index - 1]):
            continue
        count += 1
    return count


def looks_like_command_listing(text: str) -> bool:
    normalized = " ".join(str(text or "").split())
    if not normalized or _CJK_RE.search(normalized) or _LATEX_COMMAND_RE.search(normalized):
        return False
    # 成对的 $…$ 是公式：拿掉再看（Tcl 的 $var 只有一个 $，不会成对）
    if normalized.count("$") >= 2 and _MATH_SPAN_RE.search(normalized):
        without_math = " ".join(_MATH_SPAN_RE.sub(" ", normalized).split())
        if not re.search(r"[a-z]_[a-z]|\s-[a-z]", without_math):
            return False
        normalized = without_math
    tokens = normalized.split()
    # 命令提示符（SETUP>、%、$）不算
    while tokens and _PROMPT_RE.fullmatch(tokens[0]):
        tokens = tokens[1:]
    if not tokens:
        return False
    if len(tokens) == 1:
        token = tokens[0]
        return len(token) >= 6 and bool(_SINGLE_TOKEN_RE.fullmatch(token)) and not token.isupper()
    stopwords = _stopword_count(tokens)
    if stopwords > max(1, len(tokens) // 20):
        return False
    if _SENTENCE_INTO_PROSE_RE.search(normalized):
        return False
    if sum(1 for token in tokens if _is_code_token(token)) >= max(2, (len(tokens) + 2) // 3):
        return True
    # 下划线命令名开头、后面没有英文虚词：add_scan_chains c1 g1 si so
    return bool(_SNAKE_HEAD_RE.match(tokens[0])) and stopwords == 0 and len(tokens) <= 40


__all__ = ["looks_like_command_listing"]
