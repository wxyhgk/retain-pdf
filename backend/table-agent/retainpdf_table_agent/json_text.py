"""从模型回复里取出 JSON 对象的文字（标准库）。

逐字抄自翻译底座 ``retainpdf_translation.llm.shared.response_parsing.extract_json_text`` 和
``structured_output.escape_latex_backslashes``：核心只许用标准库，不能 import 底座；行为要和底座一样，
接线包的测试拿两边同一批输入比结果（``tests/test_engine_wiring.py``）。底座那边改了，这里跟着改。
"""
from __future__ import annotations

import json
import re

_JSON_QUOTE_TRANSLATION = str.maketrans(
    {
        "“": '"',
        "”": '"',
        "„": '"',
        "‟": '"',
        "‘": '"',
        "’": '"',
        "‚": '"',
        "‛": '"',
        "：": ":",
    }
)
_JSON_KEY_PREFIX_RE = re.compile(r'^\s*"translations"\s*:', re.DOTALL)
_UNICODE_ESCAPE_HEX_RE = re.compile(r"[0-9a-fA-F]{4}")
_SHORT_JSON_ESCAPES = frozenset("bfnrt")


def escape_latex_backslashes(text: str) -> str:
    r"""把模型漏转义的 LaTeX 反斜杠补成 ``\\``，再交给 ``json.loads``。

    模型常在 JSON 字符串里直接写 ``$\beta$``、``$\rho$``。JSON 合法转义只有
    ``\" \\ \/ \b \f \n \r \t \uXXXX``，而 ``\beta`` ``\frac`` ``\nu`` ``\rho``
    ``\theta`` 恰好以 ``\b \f \n \r \t`` 开头，会被静默解成退格 / 换页 / 换行 /
    回车 / 制表符；``\alpha`` 之类则直接让解析失败。判断规则（从左到右逐个反斜杠，
    已成对的 ``\\`` 整体跳过，不会被二次处理）：

    - ``\"`` ``\\`` ``\/``：合法转义，原样保留；
    - ``\u`` 后跟 4 位十六进制：合法 unicode 转义，原样保留；
    - ``\b \f \n \r \t`` 后面**不是**小写 ASCII 字母：当作真转义保留
      （``\n- 条目``、``\nNote``、``\t1`` 仍是换行 / 制表）；
    - ``\b \f \n \r \t`` 后面紧跟小写字母：当作 LaTeX 命令（``\beta`` ``\frac``
      ``\nu`` ``\rho`` ``\theta``），补成字面反斜杠；
    - 其余（``\alpha`` ``\{`` ``\,`` ``\underline`` 等非法转义）：补成字面反斜杠。

    已知代价：换行 / 制表后直接接小写英文单词（如 ``"\nthe"``）会被当成 LaTeX，
    得到字面 ``\nthe`` 而不是换行 —— 对以中文为主的领域指引可以接受。
    """
    if "\\" not in text:
        return text
    out: list[str] = []
    index = 0
    length = len(text)
    while index < length:
        char = text[index]
        if char != "\\":
            out.append(char)
            index += 1
            continue
        nxt = text[index + 1] if index + 1 < length else ""
        if nxt in {'"', "\\", "/"}:
            out.append(text[index : index + 2])
            index += 2
            continue
        if nxt == "u" and _UNICODE_ESCAPE_HEX_RE.fullmatch(text[index + 2 : index + 6]):
            out.append(text[index : index + 6])
            index += 6
            continue
        if nxt and nxt in _SHORT_JSON_ESCAPES:
            after = text[index + 2] if index + 2 < length else ""
            if not ("a" <= after <= "z"):
                out.append(text[index : index + 2])
                index += 2
                continue
        out.append("\\\\")
        index += 1
    return "".join(out)


def extract_json_text(content: str) -> str:
    text = (content or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    # 先原样试：合法 JSON 的字符串里本来就可能有弯引号和全角冒号（「Vue’s」「“效应”」「注：」），
    # 一律替换会把好好的 JSON 改坏——风格指南、术语预扫、组成员解析曾因此大量失败。
    # 原样解析不了，才当成「模型用弯引号 / 全角冒号写了 JSON 结构」去替换。
    verbatim = _verbatim_json_object(text)
    if verbatim is not None:
        return verbatim
    text = _normalize_loose_json_text(text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("Model response does not contain a JSON object.")
    return text[start : end + 1]


def _verbatim_json_object(text: str) -> str | None:
    """最外层 ``{...}`` 原样能解析（含补 LaTeX 反斜杠之后）就返回它，否则 None。"""
    # 漏了最外层花括号、以 "translations": 开头的回复要先补花括号，不能把里面某一项当成整体。
    if _JSON_KEY_PREFIX_RE.match((text or "").strip().translate(_JSON_QUOTE_TRANSLATION)):
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end < start:
        return None
    candidate = text[start : end + 1]
    for attempt in (candidate, escape_latex_backslashes(candidate)):
        try:
            json.loads(attempt)
        except (ValueError, TypeError):
            continue
        return candidate
    return None


def _normalize_loose_json_text(text: str) -> str:
    normalized = (text or "").strip().translate(_JSON_QUOTE_TRANSLATION).strip()
    if _JSON_KEY_PREFIX_RE.match(normalized):
        normalized = "{" + normalized + "}"
    return normalized


__all__ = ["extract_json_text"]
