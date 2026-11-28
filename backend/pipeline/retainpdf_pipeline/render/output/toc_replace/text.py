"""目录原位替换用到的文字工具：读页上的字、找字体、量宽、切行、把条目译文剪成只剩标题。

量宽用 PyMuPDF 读和译文 PDF 正文同一份字体文件（思源宋体细体 W300 的静态实例，没有就思源宋体常规体）的字宽：
引擎的字宽表就是从这份字体导出来的；中文等宽，只有夹着的西文不做字距调整。引擎没有单独量一行字的命令行入口
（``rpr-fit`` 只排整块、``rpr-layout-pdf`` 只照给的位置画），调它的内部模块会和引擎的私有代码绑死，所以不用。
"""

from __future__ import annotations

import os
import re
import statistics
import unicodedata
from dataclasses import dataclass
from pathlib import Path

# 和 render/output/rpr/engine_cli.py 一致：译文 PDF 正文用的字重（默认细体 300，环境变量可改，400 是常规体）
PDF_FONT_WEIGHT_ENV_VAR = "RETAIN_RPR_PDF_FONT_WEIGHT"
DEFAULT_PDF_FONT_WEIGHT = 300
LIGHT_FONT_FILE = "RetainPDFSerifSC-W{weight}.otf"
REGULAR_FONT_FILE = "SourceHanSerifSC-Regular.otf"

LEADER_CHARS = frozenset(".·•…‥⋯∙_")
# 不放在行首的标点（中文禁则的常见几个）
NO_LINE_START = frozenset("，。、；：？！）》」』】〉”’,.;:?!)%")
NO_LINE_END = frozenset("（《「『【〈“‘(")
# 留给 R2 / 公式：译文里还有这些就不画（保留原文）
MARKUP_RE = re.compile(r"\$|\\[a-zA-Z(\[]|<[a-zA-Z/][^>]*>|\*\*|^#{1,6}\s|`")
_CJK_RE = re.compile(r"[　-〿぀-ヿ㐀-鿿豈-﫿＀-￯]")


@dataclass
class Char:
    c: str
    x0: float
    y0: float
    x1: float
    y1: float
    base: float
    size: float
    invisible: bool = False

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2

    def ink_box(self) -> list[float]:
        """字在图上大概占的地方。看不见的 OCR 文字层（GlyphLessFont 这类）框的底边就是基线，图上的字有下伸部分
        （g、p、y），按字号往下补；上面按大写字母的高度。看得见的字就是它的框。"""
        if self.invisible and self.size > 0:
            return [self.x0, self.base - 0.95 * self.size, self.x1, self.base + 0.28 * self.size]
        return [self.x0, self.y0, self.x1, self.y1]

    def key(self) -> tuple[str, float, float]:
        return (self.c, round(self.x0, 3), round(self.base, 3))


class CharIndex:
    """按字找同一个位置（±0.3pt）上的同一个字：擦前擦后比字（PyMuPDF 重写内容流后坐标会差一点浮点误差）。"""

    TOLERANCE = 0.3

    def __init__(self, keys) -> None:
        self._by_char: dict[str, list[tuple[float, float]]] = {}
        for c, x0, base in keys:
            self._by_char.setdefault(c, []).append((x0, base))

    def has(self, key) -> bool:
        c, x0, base = key
        return any(abs(x - x0) < self.TOLERANCE and abs(b - base) < self.TOLERANCE for x, b in self._by_char.get(c, ()))


def page_chars(page) -> list[Char]:
    """页上每个字（PyMuPDF rawdict），带上是不是看不见的字（文字渲染模式 3：扫描件的 OCR 文字层）。"""
    invisible: set[tuple[int, int]] = set()
    try:
        for span in page.get_texttrace():
            if int(span.get("type", 0)) == 3 or float(span.get("opacity", 1.0)) == 0.0:
                for char in span.get("chars") or ():
                    origin = char[2]
                    invisible.add((round(origin[0] * 2), round(origin[1] * 2)))
    except Exception:  # noqa: BLE001 - 读不出渲染模式就当看得见
        invisible = set()
    chars: list[Char] = []
    for block in page.get_text("rawdict").get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                for raw in span.get("chars", []):
                    x0, y0, x1, y1 = raw["bbox"]
                    origin = raw.get("origin") or (x0, y1)
                    chars.append(
                        Char(
                            c=raw["c"], x0=x0, y0=y0, x1=x1, y1=y1, base=float(origin[1]), size=float(span.get("size") or 0),
                            invisible=(round(origin[0] * 2), round(origin[1] * 2)) in invisible,
                        )
                    )
    return chars


def chars_in(chars: list[Char], box, *, pad_x: float = 0.5, pad_y: float = 1.0) -> list[Char]:
    x0, y0, x1, y1 = (float(v) for v in box)
    return sorted(
        (c for c in chars if x0 - pad_x <= c.cx <= x1 + pad_x and y0 - pad_y <= c.cy <= y1 + pad_y and not c.c.isspace()),
        key=lambda c: c.x0,
    )


def median(values, default: float = 0.0) -> float:
    values = list(values)
    return statistics.median(values) if values else default


def resolve_font_file(font_dirs: list[Path]) -> Path | None:
    """正文同一份字体：细体静态实例（字重按 RETAIN_RPR_PDF_FONT_WEIGHT，默认 300），没有就思源宋体常规体。"""
    raw = os.environ.get(PDF_FONT_WEIGHT_ENV_VAR, "").strip()
    weight = int(raw) if raw.isdigit() else DEFAULT_PDF_FONT_WEIGHT
    names = [REGULAR_FONT_FILE] if weight == 400 else [LIGHT_FONT_FILE.format(weight=weight), REGULAR_FONT_FILE]
    for name in names:
        for directory in font_dirs:
            directory = Path(directory)
            if (directory / name).is_file():
                return directory / name
            if directory.is_dir():
                found = sorted(directory.rglob(name))
                if found:
                    return found[0]
    return None


def has_cjk(text: str) -> bool:
    return bool(_CJK_RE.search(text))


def squash(text: str) -> str:
    return "".join(str(text or "").split())


def meaningful(text: str) -> str:
    """比较「译文和原文一样」用：只留字母数字，不计大小写。"""
    return "".join(ch for ch in unicodedata.normalize("NFKC", str(text or "")) if ch.isalnum()).casefold()


_LEADING_TRAIL_RE = re.compile(r"(?:\s*[.·…‥⋯_]){2,}\s*$")
_CN_LABEL_RE = re.compile(
    r"^\s*(?:第\s*[0-9０-９IVXLCivxlc一二三四五六七八九十百零〇两]+\s*[章节部篇卷编讲课]"
    r"|第?\s*[0-9IVXLC一二三四五六七八九十]+\s*部分"
    r"|(?:附录|附錄|附件|补充材料|補充材料|补遗)\s*[A-Za-z0-9IVXivx一二三四五六七八九十]*"
    r")\s*[:：.．、\-–—]?\s*"
)


def title_translation(text: str, *, number: str, label: str, page_label: str, source_title: str) -> str:
    """条目译文剪成只剩标题：去掉前面的章号（「1.2 」「第 1 章」）和标签（原文「Chapter 1」或译成的「第1章」「附录 A」），
    去掉模型带上的点线和页码。章号、标签、页码都留在原图上（2026-11-28 用户定）。"""
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    number = str(number or "").strip()
    if number:
        if text.startswith(number):
            text = text[len(number):].lstrip(" .:：、")
        else:
            match = re.match(rf"^第\s*{re.escape(number.rstrip('.'))}\s*[章节部篇卷编讲]\s*[:：.、]?\s*", text)
            if match:
                text = text[match.end():]
    label = str(label or "").strip()
    if label:
        verbatim = re.match(rf"^{re.escape(label)}\s*[:：.．、\-–—]?\s*", text, re.IGNORECASE)
        if verbatim:
            text = text[verbatim.end():]
        else:
            match = _CN_LABEL_RE.match(text)
            if match and match.end() < len(text):
                text = text[match.end():]
    page_label = str(page_label or "").strip()
    if page_label and text.endswith(page_label) and not str(source_title or "").rstrip().endswith(page_label):
        text = text[: -len(page_label)].rstrip()
    text = _LEADING_TRAIL_RE.sub("", text).strip()
    return text


_HAN_KANA_RE = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
# 汉字和西文字母、数字挨着时中间加 1/4 个字（引擎和 Typst 一样：add_cjk_latin_spacing），和正文排出来一样
CJK_LATIN_SPACE_EM = 0.25


def _latin(ch: str) -> bool:
    return ch.isalnum() and (ch.isascii() or "\u00c0" <= ch <= "\u024f" or "\u0370" <= ch <= "\u03ff" or "\u0400" <= ch <= "\u04ff")


def _han(ch: str) -> bool:
    return bool(_HAN_KANA_RE.match(ch))


def place(text: str, font, size: float) -> tuple[list[tuple[float, str]], float]:
    """一行字每个字的 x（从 0 起）和总宽：字宽按字体，汉字和西文字母、数字之间加 1/4 个字。"""
    out: list[tuple[float, str]] = []
    x = 0.0
    previous = ""
    for ch in text:
        if previous and ((_han(previous) and _latin(ch)) or (_latin(previous) and _han(ch))):
            x += CJK_LATIN_SPACE_EM * size
        out.append((x, ch))
        x += font.text_length(ch, fontsize=size)
        previous = ch
    return out, x


def measure(text: str, font, size: float) -> float:
    return place(text, font, size)[1]


def tokens(text: str) -> list[str]:
    """切行的单位：西文词、数字串整段，汉字和标点一个一个，空格单独。"""
    return re.findall(r"[A-Za-z0-9À-ɏͰ-ϿЀ-ӿ\-–.,:;'’()/+%]+|\s|.", text)


def split_to_lines(text: str, font, size: float, widths: list[float]) -> list[str] | None:
    """按每行的宽度从第一行起装：装满一行再换下一行。行首不放「，。）」这类标点、行尾不留「（《」（连着前一个单位一起挪）。
    装不下回 None。"""
    out: list[str] = []
    cur: list[str] = []
    line = 0

    def width_of(parts: list[str]) -> float:
        return measure("".join(parts).rstrip(), font, size)

    for token in tokens(text):
        if not cur and token.isspace():
            continue
        if cur and not token.isspace() and width_of(cur + [token]) > widths[line] + 0.01:
            carry: list[str] = []
            if token in NO_LINE_START and len(cur) > 1:
                carry.append(cur.pop())
            while len(cur) > 1 and cur[-1] in NO_LINE_END:
                carry.insert(0, cur.pop())
            out.append("".join(cur).rstrip())
            line += 1
            if line >= len(widths):
                return None
            while carry and carry[0].isspace():
                carry.pop(0)
            cur = carry
        cur.append(token)
        if width_of(cur) > widths[line] + 0.01:
            return None
    if "".join(cur).strip():
        out.append("".join(cur).rstrip())
    if any(not part for part in out):
        return None
    return out


def missing_glyphs(text: str, font) -> list[str]:
    return sorted({ch for ch in text if not ch.isspace() and not font.has_glyph(ord(ch))})


__all__ = [
    "Char",
    "CharIndex",
    "LEADER_CHARS",
    "MARKUP_RE",
    "chars_in",
    "has_cjk",
    "meaningful",
    "measure",
    "median",
    "missing_glyphs",
    "place",
    "page_chars",
    "resolve_font_file",
    "split_to_lines",
    "squash",
    "title_translation",
    "tokens",
]
