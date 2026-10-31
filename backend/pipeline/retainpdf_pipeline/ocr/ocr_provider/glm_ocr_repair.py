"""GLM-OCR 把两栏框成一块时，用原文 PDF 的文字层拆回左右两块。

2026-11-01 用户报：GEDIIS 那篇（JCTC，两栏）第 1 页，GLM 把左栏第一段和右栏顶上那段框成了一块（框横跨两栏），
译文排成一个横跨两栏的大块、压住右栏，右栏后面的正文被挤到页脚上；这块的文字还以"I. Introduction"开头，和单独的标题块重复。
扫了手头所有 GLM 结果（约 170 个两栏页）只有这一处——GLM 平时分栏分得对，所以这里只拆证据确凿的：

1. 本页左右两栏都有正常宽度的正文块，而这一块是正文、宽过页宽的 70%；
2. 原文这一块的范围里有文字层，而且中间（块宽的 30%–70%）有一条没有任何词跨过的竖缝，两边各有足够多的词——
   真正通栏的一行字（例如索引页顶上的注释）中间没有缝，不会被拆；扫描件没有文字层，也不拆；
3. 右栏开头几个词能在 GLM 的文字里找到（只比字母）。找不到就不拆，宁可留着也不乱切。

拆开以后左块按缝的左边收窄、右块放进右栏的阅读顺序（排在右栏原有的、在它下面的第一个块前面）。
原始分片（`glm_ocr_raw/`）不动，拆过的块记在结果的 `_meta.cross_column_splits` 里。
"""

from __future__ import annotations

import re
from pathlib import Path

import fitz

BODY_LABELS = frozenset({"text", "abstract"})
NARROW_FRACTION = 0.55
SPANNING_FRACTION = 0.7
MIN_GUTTER_PT = 8.0
MIN_WORDS_PER_SIDE = 10
KEY_WORDS = 5

_LETTERS = re.compile(r"[^a-z]")


def _label(block: dict) -> str:
    return str(block.get("native_label") or block.get("label") or "")


def _bbox(block: dict) -> list[float]:
    bbox = block.get("bbox_2d")
    return [float(v) for v in bbox] if isinstance(bbox, list) and len(bbox) == 4 else [0.0, 0.0, 0.0, 0.0]


def _center_x(bbox: list[float]) -> float:
    return (bbox[0] + bbox[2]) / 2


def _spanning_candidates(blocks: list[dict], width: float) -> list[int]:
    body = [(i, _bbox(b)) for i, b in enumerate(blocks) if _label(b) in BODY_LABELS]
    narrow = [bbox for _i, bbox in body if (bbox[2] - bbox[0]) < NARROW_FRACTION * width]
    if not any(_center_x(b) < width / 2 for b in narrow) or not any(_center_x(b) >= width / 2 for b in narrow):
        return []
    return [i for i, bbox in body if (bbox[2] - bbox[0]) > SPANNING_FRACTION * width]


def _gutter(words: list[tuple], x1: float, x2: float) -> tuple[float, float] | None:
    """块中间那段里最宽的、没有任何词跨过的竖缝（点坐标）。"""
    lo, hi = x1 + 0.3 * (x2 - x1), x1 + 0.7 * (x2 - x1)
    spans = sorted((w[0], w[2]) for w in words)
    best: tuple[float, float] | None = None
    reach = x1
    for start, end in spans:
        if start > reach:
            gap = (max(reach, lo), min(start, hi))
            if gap[1] - gap[0] >= MIN_GUTTER_PT and (best is None or gap[1] - gap[0] > best[1] - best[0]):
                best = gap
        reach = max(reach, end)
    return best


def _char_index_of(content: str, words: list[str]) -> int | None:
    """`words` 连起来（只比字母）在 `content` 里第一次出现的字符位置。"""
    key = _LETTERS.sub("", " ".join(words).lower())
    if len(key) < 8:
        return None
    letters = [(index, char.lower()) for index, char in enumerate(content) if char.isalpha()]
    position = "".join(char for _index, char in letters).find(key)
    return letters[position][0] if position >= 0 else None


def _split_block(block: dict, others: list[list[float]], page: fitz.Page, scale: tuple[float, float]) -> tuple[dict, dict] | None:
    sx, sy = scale
    x1, y1, x2, y2 = _bbox(block)
    px1, py1, px2, py2 = x1 * sx, y1 * sy, x2 * sx, y2 * sy
    # 竖直方向往外放一行左右：GLM 的框常比文字略小（GEDIIS 右栏第一行就在框顶上面一点）
    margin = 14.0
    other_pt = [[o[0] * sx, o[1] * sy, o[2] * sx, o[3] * sy] for o in others]

    def inside_other(word: tuple) -> bool:
        cx, cy = (word[0] + word[2]) / 2, (word[1] + word[3]) / 2
        return any(o[0] <= cx <= o[2] and o[1] <= cy <= o[3] for o in other_pt)

    words = [
        w
        for w in page.get_text("words")
        if w[0] >= px1 - 2 and w[2] <= px2 + 2 and w[1] >= py1 - margin and w[3] <= py2 + margin and not inside_other(w)
    ]
    gutter = _gutter(words, px1, px2)
    if gutter is None:
        return None
    left = [w for w in words if w[2] <= gutter[0] + 0.5]
    # 按版面位置排（先行后列）：右栏第一行和后面几行在 PDF 里可能属于不同的文字块，按块号排会乱
    right = sorted((w for w in words if w[0] >= gutter[1] - 0.5), key=lambda w: (round(w[1] / 3), w[0]))
    if len(left) < MIN_WORDS_PER_SIDE or len(right) < MIN_WORDS_PER_SIDE:
        return None
    content = str(block.get("content") or "")
    cut = _char_index_of(content, [w[4] for w in right[:KEY_WORDS]])
    if cut is None or cut <= 0 or cut >= len(content) - 1:
        return None
    left_block = {
        **block,
        "bbox_2d": [x1, y1, gutter[0] / sx, max(w[3] for w in left) / sy],
        "content": content[:cut].rstrip(),
    }
    right_block = {
        **block,
        "bbox_2d": [gutter[1] / sx, min(w[1] for w in right) / sy, x2, max(w[3] for w in right) / sy],
        "content": content[cut:].lstrip(),
    }
    return left_block, right_block


def split_cross_column_blocks(payload: dict, source_pdf: Path) -> list[dict]:
    """就地拆开 `payload` 里横跨两栏的正文块，返回拆过的记录（页、原来的框、左右新框）。"""
    pages_meta = (payload.get("data_info") or {}).get("pages") or []
    splits: list[dict] = []
    with fitz.open(source_pdf) as document:
        for page_index, blocks in enumerate(payload.get("layout_details") or []):
            if page_index >= document.page_count or page_index >= len(pages_meta) or not isinstance(blocks, list):
                continue
            meta = pages_meta[page_index] or {}
            width, height = float(meta.get("width") or 0), float(meta.get("height") or 0)
            if width <= 0 or height <= 0:
                continue
            candidates = _spanning_candidates(blocks, width)
            if not candidates:
                continue
            page = document[page_index]
            scale = (page.rect.width / width, page.rect.height / height)
            ordered = sorted(blocks, key=lambda b: (b.get("index") is None, b.get("index") or 0))
            replaced: dict[int, tuple[dict, dict]] = {}
            for i in candidates:
                others = [_bbox(b) for j, b in enumerate(blocks) if j != i]
                result = _split_block(blocks[i], others, page, scale)
                if result is not None:
                    replaced[id(blocks[i])] = result
                    splits.append({"page": page_index + 1, "bbox": _bbox(blocks[i]), "left": result[0]["bbox_2d"], "right": result[1]["bbox_2d"]})
            if not replaced:
                continue
            new_order: list[dict] = []
            right_parts: list[dict] = []
            for block in ordered:
                if id(block) in replaced:
                    left_part, right_part = replaced[id(block)]
                    new_order.append(left_part)
                    right_parts.append(right_part)
                else:
                    new_order.append(block)
            for right_part in right_parts:
                # 右块排进右栏：放在右栏里、在它下面的第一个块前面；没有就放最后
                top = right_part["bbox_2d"][1]
                at = next(
                    (
                        k
                        for k, other in enumerate(new_order)
                        if _center_x(_bbox(other)) >= width / 2
                        and (_bbox(other)[2] - _bbox(other)[0]) < NARROW_FRACTION * width
                        and _bbox(other)[1] >= top
                    ),
                    len(new_order),
                )
                new_order.insert(at, right_part)
            for position, block in enumerate(new_order):
                block["index"] = position
            blocks[:] = new_order
    if splits:
        payload.setdefault("_meta", {})["cross_column_splits"] = splits
        print(f"glm-ocr: split {len(splits)} cross-column blocks: {splits}", flush=True)
    return splits


__all__ = ["split_cross_column_blocks"]
