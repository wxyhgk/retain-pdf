"""译文引用样式跟随原文：原文是行内方括号 [n]，译文就保持 [n]。

实测：direct_typst 提示词曾要求「论文引用 / 参考文献编号统一输出 `$^{117}$`」，模型把行内 [n]
也改成上标，而且只改一部分——b343d1（Elsevier）25 个带 [n] 的块里 12 个成了 `$^{[12-17]}$`，
其余保留 [n]；1ed40e（BMC）全被改。同一篇文章两种引用样式混排。

提示词已改成「方括号原样、上标才输出上标」，这里再做一层确定性兜底：译文里整个公式跨度只是
一个上标 `$^{[X]}$` / `$^{X}$`，且 X 与原文某个**公式外**的行内方括号引用 [X] 是同一组编号
（范围 / 逗号列表按数字比对，连字符种类不计），就还原成原文的 [X] 写法。

以下情况不动：
- 原文同一组编号本来就以上标出现（`<sup>1</sup>H NMR`、`<sup>[1]</sup>`、`$^{26-28}$`、`^{117}`）；
- 不带方括号的上标紧贴数字 / 字母（`10$^{3}$`、`cm$^{2}$`）——那是幂或单位；
- 原文的方括号在公式里，或编号对不上（化学名里的 `[1,3]` 不会被 `$^{1}$` 匹配）。
"""

from __future__ import annotations

import re

_CITE_BODY = r"\d{1,4}(?:\s*[,，–—\-−]\s*\d{1,4})*"
_BARE_CITATION_RE = re.compile(r"\[\s*(" + _CITE_BODY + r")\s*\]")
_SUPERSCRIPT_SPAN_RE = re.compile(
    r"([ \t]*)\$\s*\^\s*\{\s*(\[\s*" + _CITE_BODY + r"\s*\]|" + _CITE_BODY + r")\s*\}\s*\$([ \t]*)"
)
_SOURCE_SUPERSCRIPT_RE = re.compile(
    r"<sup>\s*\[?\s*(" + _CITE_BODY + r")\s*\]?\s*</sup>|\^\s*\{\s*\[?\s*(" + _CITE_BODY + r")\s*\]?\s*\}|\^\s*(\d{1,4})"
)
# 找「行内方括号」前先挖掉公式和上标：MinerU 会把 Wiley 的上标引用写成 `<sup>[1]</sup>`、
# 也会出现不带 $ 的 `^{[1]}`，里面的 [1] 不是行内引用。
_SOURCE_NON_INLINE_RE = re.compile(r"\$\$.*?\$\$|\$[^$]*\$|<sup>.*?</sup>|\^\s*\{[^}]*\}", re.S)


def _citation_key(body: str) -> str:
    compact = re.sub(r"\s+", "", body or "").replace("，", ",")
    return re.sub(r"[–—−]", "-", compact)


def restore_bracket_citations(source_text: str, translated_text: str) -> str:
    translated = str(translated_text or "")
    source = str(source_text or "")
    if "$" not in translated or "[" not in source:
        return translated
    source_outside_math = _SOURCE_NON_INLINE_RE.sub(" ", source)
    bare_by_key: dict[str, str] = {}
    for match in _BARE_CITATION_RE.finditer(source_outside_math):
        bare_by_key.setdefault(_citation_key(match.group(1)), match.group(0))
    if not bare_by_key:
        return translated
    source_superscript_keys = {
        _citation_key(next(group for group in match.groups() if group))
        for match in _SOURCE_SUPERSCRIPT_RE.finditer(source)
    }

    def _replace(match: re.Match[str]) -> str:
        lead, body, trail = match.groups()
        bracketed = body.startswith("[")
        key = _citation_key(body.strip("[] \t"))
        original = bare_by_key.get(key)
        if original is None or key in source_superscript_keys:
            return match.group(0)
        prev_char = translated[match.start() - 1] if match.start() > 0 else ""
        next_char = translated[match.end()] if match.end() < len(translated) else ""
        if not bracketed and not lead and prev_char.isascii() and prev_char.isalnum():
            return match.group(0)
        # 中文语境里 [n] 直接贴着前后文（与模型保留 [n] 时的写法一致）；挨着 ASCII 词才留空格。
        lead_out = lead if prev_char.isascii() and prev_char.strip() else ""
        trail_out = trail if next_char.isascii() and next_char.strip() and next_char not in ".,;:!?)]" else ""
        return f"{lead_out}{original}{trail_out}"

    return _SUPERSCRIPT_SPAN_RE.sub(_replace, translated)


__all__ = ["restore_bracket_citations"]
