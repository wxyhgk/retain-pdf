"""把 page_specs 里给 Typst（cmarker）的文本还原成 rpr 引擎要的「纯文本」。

引擎输入的文本格式（rpr_retain_input_v1）：纯文本，行内公式写成 ``$...$``，强制换行写
``\\n``，字面的美元符写 ``\\$``；除此之外反斜杠原样保留（``\\AA`` 之类不在公式里的命令
引擎照字面画）。

来源选 ``content_text``（不是 ``plain_text``）：它是 Typst 路线真正排出来的那份文本，公式
已经过渲染侧那几条 OCR / 模型产物修复（``\\\\alpha`` 双反斜杠、``$^{®}$`` → ®、埃符号等），
两条路线用同一份内容，对比才公平。``plain`` / ``plain_line`` 块在 Typst 里是字符串字面量，
``$`` 不是公式，所以对它们只做转义。

markdown → 纯文本的规则（只作用在公式之外的片段，公式原样保留）：

1. 强调标记 ``**x**`` / ``*x*`` 去掉标记、保留文字（引擎没有行内粗体 / 斜体，块级字重另有
   ``font_weight``）；
2. CommonMark 反斜杠转义 ``\\<ASCII 标点>`` 还原成标点本身——渲染侧只会写出 ``\\*``，
   其余是译文里本来就有的；``\\$`` 例外，保留给引擎当字面美元符；
3. 换行：``preserve_line_breaks`` 的块每个 ``\\n`` 都是强制换行；其余块里空行（段落分隔）
   规整成一个空行 ``\\n\\n``（引擎按段落排，段距默认 1.2em，与 Typst par spacing 一致），
   单个换行是 cmarker 的软换行——两侧都是中日韩字符时直接删掉（Typst
   在 CJK 之间不插空格），否则换成一个空格；
4. ``$$...$$`` 改写成 ``$...$``（渲染侧本来就把行间公式降成行内），公式内部的换行换成空格
   （引擎的行内公式不跨行）。

已知不等价：cmarker 会把行首的 ``#`` / ``-`` / ``1.`` / ``>`` 解析成标题 / 列表 / 引用，
``_x_`` 解析成斜体；这里一律按字面输出——旧路线那几种情况本来就是误排。
"""

from __future__ import annotations

import re

from retainpdf_pipeline.render.layout.text_analysis import analyze_text
from retainpdf_pipeline.render.layout.text_analysis import RAW_MATH_TOKEN_KINDS
from retainpdf_pipeline.render.layout.text_analysis import math_token_body

_EMPHASIS_RE = re.compile(
    r"(?<![\\*])(?P<marker>\*\*|\*)"
    r"(?=\S)"
    r"(?P<body>[^*\n]*?\S)"
    r"(?P=marker)"
    r"(?!\*)"
)
# CommonMark 允许转义的 ASCII 标点，去掉 `$`（引擎自己认 `\$`）。
_ESCAPABLE = set("!\"#%&'()*+,-./:;<=>?@[\\]^_`{|}~")
_PARAGRAPH_BREAK_RE = re.compile(r"[ \t]*\n[ \t]*\n[\s]*")
_SOFT_BREAK_RE = re.compile(r"[ \t]*\n[ \t]*")


def _is_cjk(char: str) -> bool:
    if not char:
        return False
    code = ord(char)
    return (
        0x3000 <= code <= 0x303F  # CJK 标点
        or 0x3040 <= code <= 0x30FF  # 假名
        or 0x3400 <= code <= 0x4DBF
        or 0x4E00 <= code <= 0x9FFF
        or 0xF900 <= code <= 0xFAFF
        or 0xFF00 <= code <= 0xFFEF  # 全角
        or 0xAC00 <= code <= 0xD7AF  # 谚文
    )


def _unescape_markdown_segment(text: str) -> str:
    out: list[str] = []
    index = 0
    while index < len(text):
        char = text[index]
        if char == "\\" and index + 1 < len(text):
            nxt = text[index + 1]
            if nxt == "$":
                out.append("\\$")
                index += 2
                continue
            if nxt in _ESCAPABLE:
                out.append(nxt)
                index += 2
                continue
        out.append(char)
        index += 1
    return "".join(out)


def _strip_emphasis(text: str) -> str:
    previous = None
    while previous != text:
        previous = text
        text = _EMPHASIS_RE.sub(lambda match: match.group("body"), text)
    return text


def _soft_break(match: re.Match[str]) -> str:
    source = match.string
    before = source[match.start() - 1] if match.start() > 0 else ""
    after = source[match.end()] if match.end() < len(source) else ""
    return "" if _is_cjk(before) and _is_cjk(after) else " "


def _fold_line_breaks(text: str, *, preserve_line_breaks: bool) -> str:
    if preserve_line_breaks:
        lines = [line.strip() for line in text.split("\n")]
        return "\n".join(line for line in lines if line)
    text = _PARAGRAPH_BREAK_RE.sub(" ", text)
    text = _SOFT_BREAK_RE.sub(_soft_break, text)
    return text.replace(" ", "\n\n")


_HTML_SCRIPT_RE = re.compile(r"<(sup|sub)>(.*?)</\1>", re.S | re.I)
_TEX_TEXT_SPECIALS = {"\\": r"\textbackslash{}", "{": r"\{", "}": r"\}", "$": r"\$", "%": r"\%",
                      "#": r"\#", "&": r"\&", "_": r"\_", "^": r"\^{}", "~": r"\~{}"}


def _html_scripts(text: str) -> str:
    """HTML 上下标（MinerU / 模型常写 ``<sup>37</sup>``、``<sup>−1</sup>``、``<sub>2</sub>``）→ 行内公式。

    Typst 路线的 cmarker 自己认这两个标签；引擎只认 ``$...$``，不转就会把标签原样印出来。
    内容放进 ``\text{}``：引用号、脚注字母保持直立（与 HTML 上标一致），TeX 特殊字符转义。
    """

    def replace(match: re.Match[str]) -> str:
        body = re.sub(r"\s+", " ", match.group(2)).strip()
        if not body:
            return ""
        escaped = "".join(_TEX_TEXT_SPECIALS.get(char, char) for char in body)
        mark = "^" if match.group(1).lower() == "sup" else "_"
        return f"${mark}{{\\text{{{escaped}}}}}$"

    return _HTML_SCRIPT_RE.sub(replace, text)


def _escape_literal_dollars(text: str) -> str:
    out: list[str] = []
    for index, char in enumerate(text):
        if char == "$" and (index == 0 or text[index - 1] != "\\"):
            out.append("\\")
        out.append(char)
    return "".join(out)


def markdown_to_engine_text(markdown: str, *, preserve_line_breaks: bool = False) -> str:
    """cmarker markdown（content_text）→ 引擎纯文本。规则见模块说明。"""
    source = str(markdown or "")
    if not source.strip():
        return ""
    chunks: list[str] = []
    plain: list[str] = []

    def flush() -> None:
        if plain:
            segment = "".join(plain)
            chunks.append(_html_scripts(_unescape_markdown_segment(_strip_emphasis(segment))))
            plain.clear()

    for token in analyze_text(source).tokens:
        if token.kind in RAW_MATH_TOKEN_KINDS:
            flush()
            # 行间公式（$$…$$）也只取公式体，统一写成行内
            body = re.sub(r"\s*\n\s*", " ", math_token_body(token)).strip()
            chunks.append(f"${body}$" if body else "")
            continue
        plain.append(token.value)
    flush()
    text = _fold_line_breaks("".join(chunks), preserve_line_breaks=preserve_line_breaks)
    return re.sub(r"[ \t]{2,}", " ", text).strip()


def plain_to_engine_text(text: str) -> str:
    """plain / plain_line 块：Typst 里是字符串字面量（`$` 不是公式、`\n` 是硬换行），
    所以只转义 `$`，换行原样当强制换行。"""
    source = str(text or "")
    if not source.strip():
        return ""
    folded = _fold_line_breaks(source, preserve_line_breaks=True)
    return _escape_literal_dollars(re.sub(r"[ \t]{2,}", " ", folded).strip())


__all__ = [
    "markdown_to_engine_text",
    "plain_to_engine_text",
]
