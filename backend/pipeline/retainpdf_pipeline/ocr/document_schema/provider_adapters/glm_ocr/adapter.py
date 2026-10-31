"""智谱 GLM-OCR（`POST /paas/v4/layout_parsing`，模型 `glm-ocr`）的原始结果 → document.v1。

GLM-OCR 的版面检测和 PaddleOCR-VL 是同一套（PP-DocLayout）：`native_label` 就是 Paddle 的官方标签（`doc_title`、
`paragraph_title`、`display_formula`、`figure_title`、`chart`、`vision_footnote`……），块内容的写法也一样（标题带 `#`、
行间公式 `$$…$$`、行内公式 `$ … $`、表格是 HTML）。所以这里不另写一套块解析，只把每页的 `layout_details` 改成 Paddle
`parsing_res_list` 的样子，走 Paddle 的页、块解析，最后把来源改回 GLM（`provider`、`raw_path`）。

和 Paddle 不同的地方：
- 没有分组号：不出服务商给的接续提示，跨页接续交给翻译那边自己判断。
- GLM 总是出排版好的 markdown（标题带 `#`、标题和图注包在 `<div align="center">` 里、表格 `<table border="1">`），
  我们请求 Paddle 时不要这些，块里是纯文字。这里先洗成和 Paddle 一样（`clean_content`），行间公式 `$$…$$` 两边一样，不动。
- 图片块（`image`、`chart`……）没有内容，和 Paddle 一样文字留空，图片按框挂进 markdown 的图片表：键是
  `imgs/img_in_<标签>_box_<x1>_<y1>_<x2>_<y2>.jpg`（Paddle 按文件名里的框把图片对回块），值是调用层从原文 PDF 按框裁好、
  落盘的相对路径（`_images`，键带页前缀 `page-<N>/imgs/…`：不同页同样的框不会串）；没裁的值为空，块标成图片未就绪。
- 页眉、页脚、页码 GLM-OCR 多半不出，出了照 Paddle 的标签走。

坐标是模型像素（`data_info.pages[i]` 的宽高），缩放到原文 PDF 的点由归一化的收尾一步做（`finalize_normalized_document`）。
多次请求（每次最多 100 页）由调用层按页拼成一份同样形状的结果，`_meta.chunks` 记每次请求的页范围。
"""

from __future__ import annotations

import re
from pathlib import Path

from retainpdf_pipeline.ocr.document_schema.provider_adapters.common import build_document_record
from retainpdf_pipeline.ocr.document_schema.provider_adapters.common import build_page_record
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.caption_asset_relations import (
    attach_adjacent_caption_asset_relations,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.column_signals import summarize_document_column_signals
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.page_reader import build_page_spec
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_GLM_OCR

# 没有文字内容、要从原文裁图的块
IMAGE_LABELS = frozenset({"image", "chart", "header_image", "footer_image", "seal"})

# 标题类块的 `#`（GLM 按版面层级加的 markdown 标题）
HEADING_LABELS = frozenset({"doc_title", "paragraph_title"})

_PADDLE_RAW_PATH_PREFIX = "/layoutParsingResults/{page}/prunedResult/parsing_res_list/"
_DIV_TAG_RE = re.compile(r"</?div\b[^>]*>", re.IGNORECASE)
_HEADING_MARK_RE = re.compile(r"(?m)^[ \t]*#{1,6}[ \t]+")
_TABLE_OPEN_RE = re.compile(r"<table\b[^>]*>", re.IGNORECASE)
_BLANK_LINES_RE = re.compile(r"\n{3,}")


def looks_like_glm_ocr_layout(payload: dict) -> bool:
    if not isinstance(payload, dict):
        return False
    data_info = payload.get("data_info")
    return isinstance(payload.get("layout_details"), list) and isinstance(data_info, dict) and isinstance(data_info.get("pages"), list)


def image_asset_key(label: str, bbox: list) -> str:
    """图片块的引用路径：Paddle 按文件名里的 `_box_x1_y1_x2_y2` 把图片对回块（`paddle/asset_links.py`）。"""
    x1, y1, x2, y2 = (int(round(float(v))) for v in bbox)
    return f"imgs/img_in_{label}_box_{x1}_{y1}_{x2}_{y2}.jpg"


def clean_content(label: str, content: str) -> str:
    """GLM 的 markdown 排版 → 和我们请求 Paddle 时一样的纯文字（见模块说明）。"""
    if label in IMAGE_LABELS:
        return ""
    text = _DIV_TAG_RE.sub("", content)
    if label == "table":
        text = _TABLE_OPEN_RE.sub("<table>", text)
    if label in HEADING_LABELS:
        text = _HEADING_MARK_RE.sub("", text)
    return _BLANK_LINES_RE.sub("\n\n", text).strip()


def _label(block: dict) -> str:
    return str(block.get("native_label") or block.get("label") or "").strip()


def _bbox(block: dict) -> list:
    bbox = block.get("bbox_2d")
    return list(bbox) if isinstance(bbox, list) and len(bbox) == 4 else [0, 0, 0, 0]


def _parsing_block(block: dict, position: int) -> dict:
    label = _label(block)
    return {
        "block_label": label,
        "block_bbox": _bbox(block),
        "block_content": clean_content(label, str(block.get("content") or "")),
        "block_id": block.get("index", position),
        "block_order": position + 1,
    }


def _overlaps(a: list, b: list) -> bool:
    return min(a[2], b[2]) > max(a[0], b[0]) and min(a[3], b[3]) > max(a[1], b[1])


def _drop_repeated_headings(parsing: list[dict]) -> None:
    """正文块的框压着一个标题块、文字又以这个标题开头时，去掉正文里重复的标题（GLM 偶尔把标题既单独出一块、又算进下面的正文：
    2026-11-01 GEDIIS 第 1 页 "## I. Introduction" 单独一块，下面正文又以 "I. Introduction Geometry optimization…" 开头，译文里标题出现两次）。"""
    headings = [block for block in parsing if block["block_label"] in HEADING_LABELS and block["block_content"]]
    for block in parsing:
        if block["block_label"] not in {"text", "abstract"}:
            continue
        for heading in headings:
            title = " ".join(heading["block_content"].split())
            text = block["block_content"]
            if title and _overlaps(heading["block_bbox"], block["block_bbox"]) and " ".join(text.split()).startswith(title):
                # 按词数切，原文里标题和正文之间的空白可能是换行
                words = len(title.split())
                block["block_content"] = text.split(None, words)[-1] if len(text.split()) > words else text
                break


def paddle_page_payload(page_blocks: list, page_meta: dict, images: dict, *, page_index: int = 0) -> dict:
    """一页 GLM 块 → Paddle 的一页（`layoutParsingResults[i]`）。块按 GLM 给的阅读顺序（`index`）排。"""
    blocks = [block for block in page_blocks if isinstance(block, dict)]
    blocks.sort(key=lambda block: (block.get("index") is None, block.get("index") or 0))
    page_images = {
        key: str(images.get(f"page-{page_index + 1}/{key}") or "")
        for key in (image_asset_key(_label(block), _bbox(block)) for block in blocks if _label(block) in IMAGE_LABELS)
    }
    parsing = [_parsing_block(block, position) for position, block in enumerate(blocks)]
    _drop_repeated_headings(parsing)
    return {
        "prunedResult": {
            "width": page_meta.get("width", 0),
            "height": page_meta.get("height", 0),
            "model_settings": {},
            "parsing_res_list": parsing,
        },
        "markdown": {"text": "", "images": page_images},
    }


def _sorted_layout_indexes(page_blocks: list) -> list:
    """Paddle 那边块的序号 → GLM `layout_details[page]` 里的下标（排过序，两边不一定一致）。"""
    indexed = [(i, block) for i, block in enumerate(page_blocks) if isinstance(block, dict)]
    indexed.sort(key=lambda item: (item[1].get("index") is None, item[1].get("index") or 0))
    return [i for i, _block in indexed]


def _relabel_source(block: dict, *, page_index: int, layout_indexes: list) -> None:
    prefix = _PADDLE_RAW_PATH_PREFIX.format(page=page_index)
    for key in ("source", "provenance"):
        record = block.get(key)
        if not isinstance(record, dict):
            continue
        record["provider"] = PROVIDER_GLM_OCR
        raw_path = str(record.get("raw_path") or "")
        if raw_path.startswith(prefix):
            position = int(raw_path[len(prefix):])
            if position < len(layout_indexes):
                record["raw_path"] = f"/layout_details/{page_index}/{layout_indexes[position]}"


def build_glm_ocr_document(
    payload: dict,
    document_id: str,
    source_json_path: Path,
    provider_version: str,
) -> dict:
    layout_details = payload.get("layout_details") or []
    pages_meta = (payload.get("data_info") or {}).get("pages") or []
    images = dict(payload.get("_images") or {})
    pages = []
    for page_index, page_blocks in enumerate(layout_details):
        page_blocks = page_blocks if isinstance(page_blocks, list) else []
        page_meta = pages_meta[page_index] if page_index < len(pages_meta) and isinstance(pages_meta[page_index], dict) else {}
        page = build_page_record(
            build_page_spec(
                page_payload=paddle_page_payload(page_blocks, page_meta, images, page_index=page_index),
                page_index=page_index,
                page_meta=page_meta,
                preprocessed_image="",
            )
        )
        layout_indexes = _sorted_layout_indexes(page_blocks)
        for block in page.get("blocks") or []:
            _relabel_source(block, page_index=page_index, layout_indexes=layout_indexes)
        pages.append(page)
    attach_adjacent_caption_asset_relations(pages)
    document = build_document_record(
        document_id=document_id,
        provider=PROVIDER_GLM_OCR,
        provider_version=provider_version or str(payload.get("model") or ""),
        source_json_path=source_json_path,
        pages=pages,
        notes="Adapted from GLM-OCR layout_parsing layout_details (via the PaddleOCR-VL block reader).",
    )
    derived = document.setdefault("derived", {})
    signals = summarize_document_column_signals(pages)
    if isinstance(signals, dict) and "provider" in signals:
        signals["provider"] = PROVIDER_GLM_OCR
    derived["provider_signals"] = signals
    derived["provider_payload_meta"] = dict(payload.get("_meta") or {})
    derived["provider_data_info"] = {
        key: value for key, value in dict(payload.get("data_info") or {}).items() if key != "pages"
    }
    return document


__all__ = [
    "IMAGE_LABELS",
    "build_glm_ocr_document",
    "clean_content",
    "image_asset_key",
    "looks_like_glm_ocr_layout",
    "paddle_page_payload",
]
