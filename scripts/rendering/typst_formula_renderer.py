import hashlib
import re
import subprocess
from pathlib import Path

from PIL import Image

from config import paths


FORMULA_CACHE_DIR = paths.OUTPUT_DIR / "formula_cache"
TYPST_BIN = "/snap/bin/typst"

GREEK_MAP = {
    r"\Delta": "Δ",
    r"\alpha": "α",
    r"\beta": "β",
    r"\epsilon": "ε",
    r"\gamma": "γ",
    r"\zeta": "ζ",
    r"\omega": "ω",
    r"\phi": "φ",
    r"\mu": "μ",
    r"\eta": "η",
    r"\partial": "∂",
}


def _strip_outer_braces(text: str) -> str:
    text = text.strip()
    if text.startswith("{") and text.endswith("}"):
        return text[1:-1].strip()
    return text


def _find_balanced_group(text: str, start: int) -> tuple[str, int]:
    if start >= len(text) or text[start] != "{":
        raise ValueError("expected {")
    depth = 0
    for idx in range(start, len(text)):
        if text[idx] == "{":
            depth += 1
        elif text[idx] == "}":
            depth -= 1
            if depth == 0:
                return text[start + 1 : idx], idx + 1
    raise ValueError("unbalanced braces")


def _replace_macro_with_group(text: str, macro: str, fn_name: str) -> str:
    out = []
    i = 0
    while i < len(text):
        if text.startswith(macro, i):
            j = i + len(macro)
            while j < len(text) and text[j].isspace():
                j += 1
            if j < len(text) and text[j] == "{":
                inner, end = _find_balanced_group(text, j)
                out.append(f"{fn_name}({convert_latexish_to_typst(inner)})")
                i = end
                continue
        out.append(text[i])
        i += 1
    return "".join(out)


def _unwrap_macro_group(text: str, macro: str) -> str:
    out = []
    i = 0
    while i < len(text):
        if text.startswith(macro, i):
            j = i + len(macro)
            while j < len(text) and text[j].isspace():
                j += 1
            if j < len(text) and text[j] == "{":
                inner, end = _find_balanced_group(text, j)
                out.append(convert_latexish_to_typst(inner))
                i = end
                continue
        out.append(text[i])
        i += 1
    return "".join(out)


def _replace_frac(text: str) -> str:
    out = []
    i = 0
    macro = r"\frac"
    while i < len(text):
        if text.startswith(macro, i):
            j = i + len(macro)
            while j < len(text) and text[j].isspace():
                j += 1
            num, end_num = _find_balanced_group(text, j)
            k = end_num
            while k < len(text) and text[k].isspace():
                k += 1
            den, end_den = _find_balanced_group(text, k)
            out.append(f"frac({convert_latexish_to_typst(num)}, {convert_latexish_to_typst(den)})")
            i = end_den
            continue
        out.append(text[i])
        i += 1
    return "".join(out)


def _collapse_token_spacing(text: str) -> str:
    text = re.sub(r"(?<=\d)\s+(?=\d)", "", text)
    text = re.sub(r"(?<=_)\s+", "", text)
    text = re.sub(r"(?<=\^)\s+", "", text)
    text = re.sub(r"\{\s+", "{", text)
    text = re.sub(r"\s+\}", "}", text)
    text = re.sub(r"\(\s+", "(", text)
    text = re.sub(r"\s+\)", ")", text)
    text = re.sub(r"\[\s+", "[", text)
    text = re.sub(r"\s+\]", "]", text)
    return re.sub(r"\s+", " ", text).strip()


def convert_latexish_to_typst(expr: str) -> str:
    text = _collapse_token_spacing(expr.strip().rstrip(","))
    text = text.replace(r"\big", "")
    text = text.replace(r"\left", "")
    text = text.replace(r"\right", "")
    text = text.replace(r"\,", " ")
    text = text.replace(r"\cal", "cal")
    text = text.replace(r"\langle", "chevron.l")
    text = text.replace(r"\rangle", "chevron.r")
    text = text.replace(r"\lfloor", "floor.l")
    text = text.replace(r"\rfloor", "floor.r")
    text = text.replace(r"\cdot", " dot ")
    text = text.replace(r"\to", " -> ")
    text = text.replace(r"\prime", "prime")

    for latex, uni in GREEK_MAP.items():
        text = text.replace(latex, uni)

    if r"\begin{array}" in text and r"\end{array}" in text:
        text = re.sub(r"\\begin\{array\}\s*\{[^{}]*\}", "", text)
        text = text.replace(r"\end{array}", "")

    text = _replace_frac(text)
    text = _unwrap_macro_group(text, r"\mathrm")
    text = _replace_macro_with_group(text, r"\mathbf", "bold")
    text = _replace_macro_with_group(text, r"\vec", "vec")
    text = _replace_macro_with_group(text, r"\hat", "hat")

    text = text.replace("| _", "|_")
    text = text.replace("^ { prime }", "^prime")
    text = text.replace(" ^ { prime }", "^prime")
    text = text.replace(" _ {", "_(")
    text = text.replace(" ^ {", "^(")
    text = text.replace(" }", ")")
    text = text.replace("{", "(").replace("}", ")")
    text = _collapse_token_spacing(text)
    return text


def compile_formula_png(formula_text: str) -> tuple[Path, tuple[int, int]]:
    FORMULA_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    typst_expr = convert_latexish_to_typst(formula_text).strip()
    digest = hashlib.sha1(typst_expr.encode("utf-8")).hexdigest()[:16]
    typ_path = FORMULA_CACHE_DIR / f"{digest}.typ"
    png_path = FORMULA_CACHE_DIR / f"{digest}.png"

    if not png_path.exists():
        typ_path.write_text(
            "#set page(width: auto, height: auto, margin: 1.5pt)\n"
            f"${typst_expr}$\n",
            encoding="utf-8",
        )
        proc = subprocess.run(
            [TYPST_BIN, "compile", str(typ_path), str(png_path), "--format", "png", "--ppi", "300"],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            raise RuntimeError((proc.stderr or proc.stdout).strip())

    with Image.open(png_path) as img:
        return png_path, img.size
