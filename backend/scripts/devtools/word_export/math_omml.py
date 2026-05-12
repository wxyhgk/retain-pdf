from __future__ import annotations

from dataclasses import dataclass
import re

from docx.oxml import OxmlElement
from docx.oxml.ns import qn


MATH_TOKEN_RE = re.compile(r"\$\$(.+?)\$\$|\$(.+?)\$", re.DOTALL)
MARKER_RE = re.compile(r"@@MATH:(INLINE|DISPLAY):(\d+)@@")
LATEX_SYMBOLS = {
    "\\Alpha": "Α",
    "\\Beta": "Β",
    "\\Gamma": "Γ",
    "\\Delta": "Δ",
    "\\Theta": "Θ",
    "\\Lambda": "Λ",
    "\\Pi": "Π",
    "\\Sigma": "Σ",
    "\\Omega": "Ω",
    "\\alpha": "α",
    "\\beta": "β",
    "\\gamma": "γ",
    "\\delta": "δ",
    "\\epsilon": "ε",
    "\\varepsilon": "ε",
    "\\theta": "θ",
    "\\lambda": "λ",
    "\\mu": "μ",
    "\\nu": "ν",
    "\\pi": "π",
    "\\rho": "ρ",
    "\\sigma": "σ",
    "\\tau": "τ",
    "\\phi": "φ",
    "\\varphi": "φ",
    "\\omega": "ω",
    "\\times": "×",
    "\\cdot": "·",
    "\\pm": "±",
    "\\mp": "∓",
    "\\le": "≤",
    "\\leq": "≤",
    "\\ge": "≥",
    "\\geq": "≥",
    "\\neq": "≠",
    "\\approx": "≈",
    "\\sim": "∼",
    "\\infty": "∞",
    "\\partial": "∂",
    "\\nabla": "∇",
    "\\circ": "°",
    "\\degree": "°",
    "\\rightarrow": "→",
    "\\to": "→",
    "\\leftarrow": "←",
    "\\Rightarrow": "⇒",
    "\\Leftarrow": "⇐",
}


@dataclass(frozen=True)
class MathFormula:
    marker: str
    source: str
    kind: str = "INLINE"


class MathRegistry:
    def __init__(self) -> None:
        self._items: list[MathFormula] = []

    def register(self, source: str, *, kind: str) -> str:
        marker = f"@@MATH:{kind}:{len(self._items)}@@"
        self._items.append(MathFormula(marker=marker, source=str(source or "").strip(), kind=kind))
        return marker

    def get(self, marker: str) -> MathFormula | None:
        match = MARKER_RE.fullmatch(marker)
        if not match:
            return None
        index = int(match.group(2))
        if index < 0 or index >= len(self._items):
            return None
        item = self._items[index]
        return item if item.marker == marker else None


def append_inline_content(paragraph, text: str, *, font_size_pt: float, font_family: str) -> None:
    registry = MathRegistry()
    marked_text = mark_math_tokens(text, registry)
    for token_kind, value in iter_marked_text(marked_text):
        if token_kind == "text":
            paragraph.append(word_text_run(value, font_size_pt=font_size_pt, font_family=font_family))
            continue
        formula = registry.get(value)
        if formula is None:
            paragraph.append(word_text_run(value, font_size_pt=font_size_pt, font_family=font_family))
            continue
        paragraph.append(omml_math_from_latex(formula.source, font_family=font_family))


def mark_math_tokens(text: str, registry: MathRegistry) -> str:
    def replace(match: re.Match[str]) -> str:
        display_source = match.group(1)
        inline_source = match.group(2)
        if display_source is not None:
            return registry.register(display_source, kind="DISPLAY")
        return registry.register(inline_source or "", kind="INLINE")

    return MATH_TOKEN_RE.sub(replace, str(text or ""))


def iter_marked_text(text: str):
    pos = 0
    for match in MARKER_RE.finditer(text):
        if match.start() > pos:
            yield "text", text[pos : match.start()]
        yield "math", match.group(0)
        pos = match.end()
    if pos < len(text):
        yield "text", text[pos:]


def word_text_run(text: str, *, font_size_pt: float, font_family: str):
    r = OxmlElement("w:r")
    r_pr = OxmlElement("w:rPr")
    r_pr.append(word_run_fonts(font_family))
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), str(int(max(1.0, font_size_pt) * 2)))
    r_pr.append(sz)
    r.append(r_pr)
    t = OxmlElement("w:t")
    if text.startswith(" ") or text.endswith(" "):
        t.set(qn("xml:space"), "preserve")
    t.text = text
    r.append(t)
    return r


def word_run_fonts(font_family: str):
    fonts = OxmlElement("w:rFonts")
    fonts.set(qn("w:ascii"), font_family)
    fonts.set(qn("w:hAnsi"), font_family)
    fonts.set(qn("w:eastAsia"), font_family)
    fonts.set(qn("w:cs"), font_family)
    return fonts


def omml_math_from_latex(raw: str, *, font_family: str):
    math = OxmlElement("m:oMath")
    for node in parse_math_sequence(str(raw or "").strip(), font_family=font_family):
        math.append(node)
    if len(math) == 0:
        math.append(omml_run(str(raw or "").strip(), font_family=font_family))
    return math


def parse_math_sequence(source: str, *, font_family: str) -> list:
    source = strip_outer_math_delimiters(strip_latex_text_commands(source))
    nodes = []
    pos = 0
    while pos < len(source):
        parsed = parse_special_math(source, pos, font_family=font_family)
        if parsed is not None:
            node, pos = parsed
            nodes.append(node)
            continue
        token, pos = read_plain_token(source, pos)
        if token:
            nodes.append(omml_run(normalize_math_text(token), font_family=font_family))
    return merge_adjacent_runs(nodes, font_family=font_family)


def parse_special_math(source: str, pos: int, *, font_family: str):
    if source.startswith("\\frac", pos):
        args = read_latex_command_args(source, pos + len("\\frac"), count=2)
        if args is not None:
            (num, den), next_pos = args
            return omml_fraction(num, den, font_family=font_family), next_pos
    if source.startswith("\\sqrt", pos):
        args = read_latex_command_args(source, pos + len("\\sqrt"), count=1)
        if args is not None:
            (body,), next_pos = args
            return omml_radical(body, font_family=font_family), next_pos
    parsed_base = read_math_atom(source, pos)
    if parsed_base is None:
        return None
    base, after_base = parsed_base
    if after_base < len(source) and source[after_base] in {"^", "_"}:
        op = source[after_base]
        parsed_script = read_math_atom(source, after_base + 1)
        if parsed_script is None:
            return None
        script, next_pos = parsed_script
        if op == "^":
            return omml_superscript(base, script, font_family=font_family), next_pos
        return omml_subscript(base, script, font_family=font_family), next_pos
    return None


def read_plain_token(source: str, pos: int) -> tuple[str, int]:
    end = pos
    while end < len(source):
        if source.startswith("\\frac", end) or source.startswith("\\sqrt", end):
            break
        if source[end] in {"^", "_"}:
            break
        if end + 1 < len(source) and source[end + 1] in {"^", "_"}:
            end += 1
            break
        end += 1
    if end == pos:
        return source[pos], pos + 1
    return source[pos:end], end


def read_math_atom(source: str, pos: int) -> tuple[str, int] | None:
    pos = skip_spaces(source, pos)
    if pos >= len(source):
        return None
    if source[pos] == "{":
        group = read_braced_group(source, pos)
        if group is None:
            return None
        return group
    if source[pos] == "\\":
        match = re.match(r"\\[a-zA-Z]+|\\.", source[pos:])
        if match:
            return match.group(0), pos + len(match.group(0))
    return source[pos], pos + 1


def read_latex_command_args(source: str, pos: int, *, count: int) -> tuple[tuple[str, ...], int] | None:
    args: list[str] = []
    current = pos
    for _ in range(count):
        current = skip_spaces(source, current)
        group = read_braced_group(source, current)
        if group is None:
            return None
        value, current = group
        args.append(value)
    return tuple(args), current


def read_braced_group(source: str, pos: int) -> tuple[str, int] | None:
    if pos >= len(source) or source[pos] != "{":
        return None
    depth = 0
    for index in range(pos, len(source)):
        char = source[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return source[pos + 1 : index], index + 1
    return None


def skip_spaces(source: str, pos: int) -> int:
    while pos < len(source) and source[pos].isspace():
        pos += 1
    return pos


def merge_adjacent_runs(nodes: list, *, font_family: str) -> list:
    merged = []
    buffer: list[str] = []
    for node in nodes:
        if node.tag == qn("m:r"):
            text_nodes = node.findall(qn("m:t"))
            if len(text_nodes) == 1:
                buffer.append(text_nodes[0].text or "")
                continue
        if buffer:
            merged.append(omml_run("".join(buffer), font_family=font_family))
            buffer.clear()
        merged.append(node)
    if buffer:
        merged.append(omml_run("".join(buffer), font_family=font_family))
    return merged


def omml_run(text: str, *, font_family: str):
    r = OxmlElement("m:r")
    r_pr = OxmlElement("m:rPr")
    r_pr.append(OxmlElement("m:nor"))
    r.append(r_pr)
    word_r_pr = OxmlElement("w:rPr")
    word_r_pr.append(word_run_fonts(font_family))
    r.append(word_r_pr)
    t = OxmlElement("m:t")
    if text.startswith(" ") or text.endswith(" "):
        t.set(qn("xml:space"), "preserve")
    t.text = text
    r.append(t)
    return r


def omml_fraction(numerator: str, denominator: str, *, font_family: str):
    fraction = OxmlElement("m:f")
    num = OxmlElement("m:num")
    den = OxmlElement("m:den")
    for node in parse_math_sequence(numerator, font_family=font_family):
        num.append(node)
    for node in parse_math_sequence(denominator, font_family=font_family):
        den.append(node)
    fraction.append(num)
    fraction.append(den)
    return fraction


def omml_radical(body: str, *, font_family: str):
    radical = OxmlElement("m:rad")
    deg = OxmlElement("m:deg")
    elem = OxmlElement("m:e")
    for node in parse_math_sequence(body, font_family=font_family):
        elem.append(node)
    radical.append(deg)
    radical.append(elem)
    return radical


def omml_superscript(base: str, script: str, *, font_family: str):
    element = OxmlElement("m:sSup")
    base_el = OxmlElement("m:e")
    script_el = OxmlElement("m:sup")
    for node in parse_math_sequence(base, font_family=font_family):
        base_el.append(node)
    for node in parse_math_sequence(script, font_family=font_family):
        script_el.append(node)
    element.append(base_el)
    element.append(script_el)
    return element


def omml_subscript(base: str, script: str, *, font_family: str):
    element = OxmlElement("m:sSub")
    base_el = OxmlElement("m:e")
    script_el = OxmlElement("m:sub")
    for node in parse_math_sequence(base, font_family=font_family):
        base_el.append(node)
    for node in parse_math_sequence(script, font_family=font_family):
        script_el.append(node)
    element.append(base_el)
    element.append(script_el)
    return element


def normalize_math_text(raw: str) -> str:
    text = str(raw or "")
    for key, value in sorted(LATEX_SYMBOLS.items(), key=lambda item: len(item[0]), reverse=True):
        text = text.replace(key, value)
    text = re.sub(r"\\[;,! ]", " ", text)
    text = re.sub(r"\\([a-zA-Z]+)", r"\1", text)
    text = text.replace("\\", "")
    text = text.replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", text)


def strip_latex_text_commands(text: str) -> str:
    patterns = (
        r"\\mathrm\{([^{}]*)\}",
        r"\\text\{([^{}]*)\}",
        r"\\operatorname\{([^{}]*)\}",
        r"\\ce\{([^{}]*)\}",
    )
    changed = True
    while changed:
        changed = False
        for pattern in patterns:
            next_text = re.sub(pattern, r"\1", text)
            changed = changed or next_text != text
            text = next_text
    return text


def strip_outer_math_delimiters(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("$$") and stripped.endswith("$$") and len(stripped) >= 4:
        return stripped[2:-2].strip()
    if stripped.startswith("$") and stripped.endswith("$") and len(stripped) >= 2:
        return stripped[1:-1].strip()
    return stripped
