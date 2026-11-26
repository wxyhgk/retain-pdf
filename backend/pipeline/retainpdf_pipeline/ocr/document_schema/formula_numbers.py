"""行间公式编号：把编号挂到对应的行间公式块上（2026-11-26，方案见
`docs/ops/planning/ocr-normalization/20261126-行间公式编号.md`）。

三家给编号的方式不一样：PaddleOCR-VL、MinerU 把编号单独出成一块（`formula_number`），不和公式关联；GLM-OCR 没有编号块，
少数公式把编号识别进 LaTeX（`\\tag{2.19}`），其余的编号丢了。这里和服务商无关，三个来源按顺序补：

1. `layout_block`：页内的编号块按几何配到公式上（`attach_formula_numbers`，适配器出块、补完契约字段、夹回页内之后跑，
   坐标还是 OCR 自己的单位，所有阈值按页宽、公式高度的比例算）。
2. `latex_tag`：没配上编号块的公式，LaTeX 里正好一个 `\\tag{…}` / `\\tag*{…}` 时从里面取（同一步）。
3. `pdf_text_layer`：还没有编号的公式，原文 PDF 有文字层时在公式右侧（或左侧）同一行找 `(1)`、`(2.19)`、`(3a)`、`(A.1)`
   这样的一行字（`attach_formula_numbers_from_pdf_text`，缩放到 PDF 的点之后跑）。扫描件没有文字层，不做。

同时有编号块和 `\\tag` 时以编号块为准：它是版面上单独印出来的那串字、能双向挂上块 id；LaTeX 里的 `\\tag` 是公式识别顺手
认出来的，`in_latex` 记着公式原文里已经带了编号（渲染时别再补一遍）。

记法（只增不改，公式原文不动、编号块照旧是 metadata、照旧不翻译）：

- 公式块 `content.formula_number = {text, label, source, in_latex[, block_id]}`；
- 编号块 `content.number_of_block_id = <公式块 id>`，`content.related_block_ids` 追加公式块 id（和图注挂图的写法一样）；
- 文档 `derived.formula_numbers` 记统计（公式数、各来源配上几个、编号块没配上的原因）。

宁可不配也不配错：一个编号只配一个公式、一个公式最多一个编号；两个候选差不多近、中间隔着别的块（跨栏）、不在同一页的都不配。
只依赖文档模型，不导入任何一家的适配器（`devtools/architecture_checks/ocr_layers.py` 钉着）。
"""

from __future__ import annotations

import re

SOURCE_LAYOUT_BLOCK = "layout_block"
SOURCE_LATEX_TAG = "latex_tag"
SOURCE_PDF_TEXT_LAYER = "pdf_text_layer"
FORMULA_NUMBER_SOURCES = (SOURCE_LAYOUT_BLOCK, SOURCE_LATEX_TAG, SOURCE_PDF_TEXT_LAYER)

# 编号块的纵向中心要落在公式上下沿各放宽「公式高度 × 这个比例」的范围里。
VERTICAL_TOLERANCE_RATIO = 0.4
# 编号和公式水平方向最多隔多远（页宽的比例）：居中的短公式、编号靠右边距时大约 0.3。
MAX_GAP_RATIO = 0.5
# 两个候选的代价差小于这个（页宽的比例）就算有歧义，不配。
AMBIGUITY_MARGIN = 0.02
# 编号在公式左边的排版少见：同样近时优先右边。
LEFT_SIDE_PENALTY = 0.03
# 代价里纵向偏离的权重（见 `_candidate`）。
VERTICAL_WEIGHT = 0.5
# 判断「编号和公式是不是同一栏」时，看编号上下多远以内的段落（页高的比例）。
COLUMN_EVIDENCE_RATIO = 0.1

_OPEN = "(（[［"
_CLOSE = ")）]］"
# 编号块里的编号：数字编号（`2.19`、`3a`、`A.1`、`2-5`、`1'`），也认罗马数字、单个字母、星号（服务商已经说了这是编号）。
_LABEL_CORE = (
    r"(?:[A-Z]{1,3}\s*[.\-]?\s*)?\d{1,4}(?:\s*[.\-–]\s*\d{1,4}){0,3}\s*[a-z]?\s*[′'*]{0,2}"
    r"|[IVXLC]{1,6}|[A-Za-z]|\*{1,3}"
)
_OPEN_RE = "[" + re.escape(_OPEN) + "]"
_CLOSE_RE = "[" + re.escape(_CLOSE) + "]"
_LAYOUT_NUMBER_RE = re.compile(rf"^{_OPEN_RE}?\s*({_LABEL_CORE})\s*{_CLOSE_RE}?$")
# 文字层兜底更严：必须带圆括号（`[4]` 是引文）、必须有数字（`(a)`、`(i)` 这类多半是正文里的列表）。
_TEXT_LAYER_NUMBER_RE = re.compile(
    r"^[(（]\s*((?:[A-Z]{1,3}\s*[.\-]?\s*)?\d{1,4}(?:\s*[.\-–]\s*\d{1,4}){0,3}\s*[a-z]?)\s*[)）]$"
)
_TAG_RE = re.compile(r"\\tag(\*?)\s*\{((?:[^{}]|\{[^{}]*\})*)\}")
_MATH_WRAPPERS_RE = re.compile(r"^\s*(?:\$\$?|\\\(|\\\[)\s*|\s*(?:\$\$?|\\\)|\\\])\s*$")


def _bbox(block: dict) -> list[float] | None:
    value = (block.get("geometry") or {}).get("bbox", block.get("bbox"))
    if not isinstance(value, list) or len(value) != 4:
        return None
    try:
        box = [float(item) for item in value]
    except (TypeError, ValueError):
        return None
    return box if box[2] > box[0] and box[3] > box[1] else None


def _text(block: dict) -> str:
    content = block.get("content") or {}
    return str(content.get("text", block.get("text", "")) or "").strip()


def is_formula_block(block: dict) -> bool:
    content = block.get("content") or {}
    return str(content.get("kind", block.get("type", "")) or "").strip().lower() == "formula"


def is_formula_number_block(block: dict) -> bool:
    """服务商给的编号块：Paddle、GLM 是 `structure_role = formula_number`；MinerU 归成 metadata，原始标签还在 `provenance`。"""
    if str(block.get("structure_role", "") or "").strip().lower() == "formula_number":
        return True
    if str(block.get("sub_type", "") or "").strip().lower() == "formula_number":
        return True
    provenance = block.get("provenance") or {}
    return str(provenance.get("raw_label", "") or "").strip().lower() == "formula_number"


def parse_number_text(text: str, *, strict: bool = False) -> tuple[str, str] | None:
    """编号文字 → (原样的编号文字, 去掉括号的标签)；不像编号返回 None。"""
    raw = _MATH_WRAPPERS_RE.sub("", str(text or "")).strip()
    if not raw or len(raw) > 24:
        return None
    match = (_TEXT_LAYER_NUMBER_RE if strict else _LAYOUT_NUMBER_RE).match(raw)
    if not match:
        return None
    # 括号要么成对、要么都没有
    has_open = raw[0] in _OPEN
    has_close = raw[-1] in _CLOSE
    if has_open != has_close:
        return None
    label = re.sub(r"\s+", "", match.group(1))
    return (raw, label) if label else None


def latex_tag_number(latex: str) -> tuple[str, str] | None:
    """公式 LaTeX 里的 `\\tag{X}`（显示成 `(X)`）/ `\\tag*{X}`（原样显示）。正好一个（或几个一样的）才算。"""
    found = []
    for star, inner in _TAG_RE.findall(str(latex or "")):
        inner = inner.strip()
        if not inner:
            continue
        if star:
            text = inner
            parsed = parse_number_text(inner)
            label = parsed[1] if parsed else inner.strip(_OPEN + _CLOSE).strip()
        else:
            text = f"({inner})"
            label = inner
        if label:
            found.append((text, label))
    if not found or len({label for _text, label in found}) != 1:
        return None
    return found[0]


def _number_record(*, text: str, label: str, source: str, in_latex: bool, block_id: str = "") -> dict:
    record = {"text": text, "label": label, "source": source, "in_latex": in_latex}
    if block_id:
        record["block_id"] = block_id
    return record


def _append_unique(values: object, additions: list[str]) -> list[str]:
    existing = [str(value).strip() for value in values if str(value).strip()] if isinstance(values, list) else []
    return list(dict.fromkeys([*existing, *additions]))


def _new_summary() -> dict:
    return {
        "formula_count": 0,
        "numbered": {source: 0 for source in FORMULA_NUMBER_SOURCES},
        "number_block_count": 0,
        "unpaired_number_blocks": {},
    }


def _count_unpaired(summary: dict, reason: str) -> None:
    unpaired = summary["unpaired_number_blocks"]
    unpaired[reason] = int(unpaired.get(reason, 0)) + 1


def _crosses_other_block(
    *,
    blockers: list[list[float]],
    x_from: float,
    x_to: float,
    y_center: float,
    half_band: float,
) -> bool:
    """公式和编号之间（水平方向）同一行上隔着别的块（别的公式、编号、图表、多行的段落）：多半跨了栏，或者中间是别的内容。"""
    if x_to - x_from <= 1e-6:
        return False
    for box in blockers:
        if box[3] <= y_center - half_band or box[1] >= y_center + half_band:
            continue
        overlap = min(box[2], x_to) - max(box[0], x_from)
        if overlap > max(1e-6, 0.1 * (x_to - x_from)) or (box[0] >= x_from and box[2] <= x_to):
            return True
    return False


def _is_paragraph_like(block: dict, box: list[float], number_box: list[float]) -> bool:
    """多行的文字块（比编号高出一倍以上）：栏的证据。单行的短文字（公式后面的「, x > 0」）不算，不挡编号。"""
    content = block.get("content") or {}
    if str(content.get("kind", block.get("type", "")) or "").strip().lower() != "text":
        return False
    return (box[3] - box[1]) > 2 * (number_box[3] - number_box[1])


def _different_column(
    *,
    number_box: list[float],
    formula_box: list[float],
    paragraphs: list[list[float]],
    near: float,
) -> bool:
    """编号上下附近的段落盖着编号的横坐标、却和公式横向不沾边：编号和公式不在同一栏。"""
    number_cx = (number_box[0] + number_box[2]) / 2
    number_width = number_box[2] - number_box[0]
    for box in paragraphs:
        if box[2] - box[0] < 3 * number_width:
            continue
        vertical_gap = max(box[1] - number_box[3], number_box[1] - box[3], 0.0)
        if vertical_gap > near or not (box[0] <= number_cx <= box[2]):
            continue
        if min(box[2], formula_box[2]) <= max(box[0], formula_box[0]):
            return True
    return False


def _candidate(
    *,
    number_box: list[float],
    formula_box: list[float],
    page_width: float,
) -> tuple[str, float, float] | None:
    """编号相对公式的位置：(side, 水平间隔, 代价)；不在同一行附近、离得太远返回 None。

    代价 = 水平间隔（页宽的比例）+ 0.5 × 纵向偏离（编号中心离公式中心多远，按公式高度算）+ 左侧编号的加价。
    纵向权重大：上下挨着的两个公式，编号跟和它在同一行的那个，哪怕另一个横向更近。
    """
    nx0, ny0, nx1, ny1 = number_box
    fx0, fy0, fx1, fy1 = formula_box
    formula_height = fy1 - fy0
    number_height = ny1 - ny0
    number_cy = (ny0 + ny1) / 2
    tolerance = max(VERTICAL_TOLERANCE_RATIO * formula_height, 0.5 * number_height)
    if not (fy0 - tolerance <= number_cy <= fy1 + tolerance):
        return None
    overlap_tolerance = 0.5 * (nx1 - nx0)
    if nx0 >= fx1 - overlap_tolerance:
        side, gap = "right", max(0.0, nx0 - fx1)
    elif nx1 <= fx0 + overlap_tolerance:
        side, gap = "left", max(0.0, fx0 - nx1)
    else:
        # 编号框和公式框水平方向叠着（服务商把编号框进了公式的框）：按编号在公式中线的哪边算。
        side, gap = ("right" if (nx0 + nx1) / 2 >= (fx0 + fx1) / 2 else "left"), 0.0
    if gap > MAX_GAP_RATIO * page_width:
        return None
    vertical = abs(number_cy - (fy0 + fy1) / 2) / max(formula_height, number_height, 1e-6)
    cost = gap / page_width + VERTICAL_WEIGHT * vertical + (LEFT_SIDE_PENALTY if side == "left" else 0.0)
    return side, gap, cost


def _page_size(page: dict, blocks: list[dict]) -> tuple[float, float]:
    boxes = [box for box in (_bbox(block) for block in blocks) if box]
    sizes = []
    for key, index in (("width", 2), ("height", 3)):
        try:
            value = float(page.get(key, 0) or 0)
        except (TypeError, ValueError):
            value = 0.0
        sizes.append(value if value > 0 else (max((box[index] for box in boxes), default=1.0) or 1.0))
    return sizes[0], sizes[1]


def _attach(formula: dict, record: dict, number_block: dict | None = None) -> None:
    content = formula.setdefault("content", {})
    content["formula_number"] = record
    if number_block is not None:
        formula_id = str(formula.get("block_id", "") or "").strip()
        number_content = number_block.setdefault("content", {})
        number_content["number_of_block_id"] = formula_id
        number_content["related_block_ids"] = _append_unique(number_content.get("related_block_ids"), [formula_id])


def _number_inside_formula_rows(number: dict, formula: dict) -> bool:
    number_box, formula_box = _bbox(number), _bbox(formula)
    number_cy = (number_box[1] + number_box[3]) / 2
    return formula_box[1] <= number_cy <= formula_box[3]


def _pair_layout_numbers_on_page(page: dict, summary: dict) -> None:
    blocks = [block for block in page.get("blocks", []) or [] if isinstance(block, dict)]
    formulas = [block for block in blocks if is_formula_block(block) and _bbox(block)]
    numbers = [block for block in blocks if is_formula_number_block(block) and not is_formula_block(block)]
    summary["number_block_count"] += len(numbers)
    if not numbers:
        return
    page_width, page_height = _page_size(page, blocks)
    proposals: dict[int, list[tuple[dict, dict, tuple[str, str]]]] = {}
    for number in numbers:
        parsed = parse_number_text(_text(number))
        number_box = _bbox(number)
        if parsed is None or number_box is None:
            _count_unpaired(summary, "not_a_number")
            continue
        others = [(block, _bbox(block)) for block in blocks if block is not number and _bbox(block)]
        paragraphs = [box for block, box in others if _is_paragraph_like(block, box, number_box)]
        candidates = []
        for formula in formulas:
            formula_box = _bbox(formula)
            found = _candidate(number_box=number_box, formula_box=formula_box, page_width=page_width)
            if found is None:
                continue
            side, _gap, cost = found
            x_from, x_to = (formula_box[2], number_box[0]) if side == "right" else (number_box[2], formula_box[0])
            blockers = [
                box
                for block, box in others
                if block is not formula
                and (
                    is_formula_block(block)
                    or is_formula_number_block(block)
                    or str((block.get("content") or {}).get("kind", "") or "") != "text"
                    or _is_paragraph_like(block, box, number_box)
                )
            ]
            if _crosses_other_block(
                blockers=blockers,
                x_from=x_from,
                x_to=x_to,
                y_center=(number_box[1] + number_box[3]) / 2,
                half_band=max(1e-6, (number_box[3] - number_box[1]) / 4),
            ):
                continue
            if _different_column(
                number_box=number_box,
                formula_box=formula_box,
                paragraphs=paragraphs,
                near=COLUMN_EVIDENCE_RATIO * page_height,
            ):
                continue
            candidates.append((cost, formula))
        if not candidates:
            _count_unpaired(summary, "no_candidate")
            continue
        candidates.sort(key=lambda item: item[0])
        if len(candidates) > 1 and candidates[1][0] - candidates[0][0] < AMBIGUITY_MARGIN:
            _count_unpaired(summary, "ambiguous")
            continue
        formula = candidates[0][1]
        proposals.setdefault(id(formula), []).append((formula, number, parsed))
    for claims in proposals.values():
        if len(claims) > 1:
            # 几个编号都离同一个公式最近：只有一个落在公式的上下沿之间，就是它（别的只是在放宽的范围里）；
            # 好几个都在里面（多行公式每行一个编号），一个公式最多一个编号，宁可都不配。
            inside = [claim for claim in claims if _number_inside_formula_rows(claim[1], claim[0])]
            for _claim in claims[1:] if len(inside) == 1 else claims:
                _count_unpaired(summary, "formula_contested")
            if len(inside) != 1:
                continue
            claims = inside
        formula, number, (text, label) = claims[0]
        _attach(
            formula,
            _number_record(
                text=text,
                label=label,
                source=SOURCE_LAYOUT_BLOCK,
                in_latex=latex_tag_number(_text(formula)) is not None,
                block_id=str(number.get("block_id", "") or "").strip(),
            ),
            number,
        )
        summary["numbered"][SOURCE_LAYOUT_BLOCK] += 1


def attach_formula_numbers(document: dict) -> dict:
    """编号块按几何配到公式上，没配上的公式从 LaTeX 的 `\\tag` 取。原地改 `document`，返回统计（也写进 `derived.formula_numbers`）。

    已经配过的文档（`derived.formula_numbers` 已经在）原样返回，重复跑不会变。没有公式、也没有编号块的文档一个字都不改。
    """
    existing_summary = (document.get("derived") or {}).get("formula_numbers")
    if isinstance(existing_summary, dict):
        return existing_summary
    summary = _new_summary()
    for page in document.get("pages", []) or []:
        _pair_layout_numbers_on_page(page, summary)
        for block in page.get("blocks", []) or []:
            if not isinstance(block, dict) or not is_formula_block(block):
                continue
            summary["formula_count"] += 1
            if isinstance((block.get("content") or {}).get("formula_number"), dict):
                continue
            tagged = latex_tag_number(_text(block))
            if tagged is None:
                continue
            text, label = tagged
            _attach(block, _number_record(text=text, label=label, source=SOURCE_LATEX_TAG, in_latex=True))
            summary["numbered"][SOURCE_LATEX_TAG] += 1
    _store_summary(document, summary)
    return summary


def _store_summary(document: dict, summary: dict) -> None:
    if summary["formula_count"] or summary["number_block_count"]:
        document.setdefault("derived", {})["formula_numbers"] = summary


# ---- 文字层兜底（坐标已经是 PDF 的点） -------------------------------------------------------------


def _word_lines(words: list[tuple]) -> list[dict]:
    """PyMuPDF `get_text("words")` 的词按 (块号, 行号) 拼成行。"""
    lines: dict[tuple[int, int], dict] = {}
    for word in words:
        x0, y0, x1, y1, text, block_no, line_no = word[:7]
        key = (int(block_no), int(line_no))
        line = lines.setdefault(key, {"bbox": [x0, y0, x1, y1], "words": []})
        box = line["bbox"]
        line["bbox"] = [min(box[0], x0), min(box[1], y0), max(box[2], x1), max(box[3], y1)]
        line["words"].append((x0, y0, x1, y1, str(text)))
    for line in lines.values():
        line["words"].sort(key=lambda item: item[0])
        line["text"] = "".join(item[4] for item in line["words"])
    return list(lines.values())


def _inside(box: list[float], container: list[float], slack: float = 1.0) -> bool:
    return (
        box[0] >= container[0] - slack
        and box[1] >= container[1] - slack
        and box[2] <= container[2] + slack
        and box[3] <= container[3] + slack
    )


def _text_layer_candidates(
    *,
    formula: dict,
    blocks: list[dict],
    words: list[tuple],
    page_width: float,
    page_height: float,
) -> list[tuple[str, str, list[float], str]]:
    formula_box = _bbox(formula)
    if formula_box is None:
        return []
    fx0, fy0, fx1, fy1 = formula_box
    height = fy1 - fy0
    band_top, band_bottom = fy0 - 0.2 * height, fy1 + 0.2 * height
    band_words = [
        word
        for word in words
        if band_top <= (word[1] + word[3]) / 2 <= band_bottom
    ]
    # 公式框外、同一行的字（左右两边）；公式框里的字是公式本身，不碰（上标 `(2)` 之类会误认）。
    outside = [word for word in band_words if word[0] >= fx1 - 1.0 or word[2] <= fx0 + 1.0]
    number_blocks = [box for box in (_bbox(b) for b in blocks if is_formula_number_block(b)) if box]
    other_blocks = [
        (block, box)
        for block, box in ((b, _bbox(b)) for b in blocks)
        if box is not None and block is not formula and not is_formula_number_block(block)
    ]
    found = []
    for line in _word_lines(outside):
        parsed = parse_number_text(line["text"], strict=True)
        if parsed is None:
            continue
        box = line["bbox"]
        side = "right" if box[0] >= fx1 - 1.0 else "left"
        gap = box[0] - fx1 if side == "right" else fx0 - box[2]
        if gap > MAX_GAP_RATIO * page_width:
            continue
        # 编号块已经框着这串字：由编号块那一步管（那里没配上就是有歧义，这里不另配）。
        if any(_inside(box, number_box) or _overlap_area(box, number_box) > 0 for number_box in number_blocks):
            continue
        # 落在别的块里（正文里引用 `(1)`、右栏的段落）：不是这个公式的编号。整块就是这个编号的文字块除外。
        covering = [block for block, other in other_blocks if _overlap_area(box, other) > 0]
        if any(parse_number_text(_text(block), strict=True) is None for block in covering):
            continue
        # 公式和编号之间同一行上还有别的字或别的块：跨栏或者是别的内容。
        x_from, x_to = (fx1, box[0]) if side == "right" else (box[2], fx0)
        line_cy = (box[1] + box[3]) / 2
        half = max(1e-6, (box[3] - box[1]) / 2)
        between_words = [
            word
            for word in band_words
            if word[0] >= x_from - 0.5 and word[2] <= x_to + 0.5 and abs((word[1] + word[3]) / 2 - line_cy) < half
        ]
        if between_words:
            continue
        if side == "left" and any(
            word[0] >= fx1 - 1.0 and abs((word[1] + word[3]) / 2 - line_cy) < half for word in band_words
        ):
            # 左边的「(1)」、公式右边同一行还有字（OCR 只框了半行）：是列表的序号，不是编号。
            continue
        covering_ids = {id(block) for block in covering}
        if _crosses_other_block(
            blockers=[other for block, other in other_blocks if id(block) not in covering_ids],
            x_from=x_from,
            x_to=x_to,
            y_center=line_cy,
            half_band=max(1e-6, half / 2),
        ):
            continue
        if _different_column(
            number_box=box,
            formula_box=formula_box,
            paragraphs=[other for block, other in other_blocks if _is_paragraph_like(block, other, box)],
            near=COLUMN_EVIDENCE_RATIO * page_height,
        ):
            continue
        found.append((parsed[0], parsed[1], box, side))
    return found


def _overlap_area(a: list[float], b: list[float]) -> float:
    width = min(a[2], b[2]) - max(a[0], b[0])
    height = min(a[3], b[3]) - max(a[1], b[1])
    return width * height if width > 0 and height > 0 else 0.0


def attach_formula_numbers_from_pdf_text(document: dict, pdf) -> int:
    """还没有编号的公式，从原文 PDF 文字层在公式同一行左右找编号。返回补了几个。

    坐标必须已经是 PDF 的点（`rescale_document_geometry_to_pdf` 里、恢复乱码之后调）。没有文字层的页（扫描件）不做。
    一个公式两边都找到、或者两个公式找到同一串字的，都不配。
    """
    attached = 0
    for page_index, page in enumerate(document.get("pages", []) or []):
        if page_index >= len(pdf):
            break
        blocks = [block for block in page.get("blocks", []) or [] if isinstance(block, dict)]
        pending = [
            block
            for block in blocks
            if is_formula_block(block) and not isinstance((block.get("content") or {}).get("formula_number"), dict)
        ]
        if not pending:
            continue
        words = pdf[page_index].get_text("words")
        if not words:
            continue
        page_width, page_height = _page_size(page, blocks)
        claims: dict[tuple, list[tuple[dict, str, str]]] = {}
        for formula in pending:
            found = _text_layer_candidates(
                formula=formula, blocks=blocks, words=words, page_width=page_width, page_height=page_height
            )
            if len(found) != 1:
                continue
            text, label, box, _side = found[0]
            key = tuple(round(value, 1) for value in box)
            claims.setdefault(key, []).append((formula, text, label))
        for claimed in claims.values():
            if len(claimed) != 1:
                continue
            formula, text, label = claimed[0]
            _attach(
                formula,
                _number_record(
                    text=text,
                    label=label,
                    source=SOURCE_PDF_TEXT_LAYER,
                    in_latex=latex_tag_number(_text(formula)) is not None,
                ),
            )
            attached += 1
    if attached:
        summary = (document.get("derived") or {}).get("formula_numbers")
        if isinstance(summary, dict):
            numbered = summary.setdefault("numbered", {})
            numbered[SOURCE_PDF_TEXT_LAYER] = int(numbered.get(SOURCE_PDF_TEXT_LAYER, 0)) + attached
    return attached


__all__ = [
    "FORMULA_NUMBER_SOURCES",
    "SOURCE_LATEX_TAG",
    "SOURCE_LAYOUT_BLOCK",
    "SOURCE_PDF_TEXT_LAYER",
    "attach_formula_numbers",
    "attach_formula_numbers_from_pdf_text",
    "is_formula_block",
    "is_formula_number_block",
    "latex_tag_number",
    "parse_number_text",
]
