"""可复制的 PDF 直接读文字层取首行缩进；扫描件才走渲染灰度图那条贵的路。

原来只有两条路：OCR 行坐标（Paddle 只给块级框，行坐标是按块均分出来的，量不出缩进）和
把块渲染成灰度图数墨迹（给扫描件设计的，费资源，默认关着）。于是带文字层的 PDF 一个缩进
都没有 —— 实测 BMC Neurol 那本 35 个候选段落 0 个缩进，而文字层里每行起点写得清清楚楚。
"""

from pathlib import Path

import fitz

from retainpdf_pipeline.render.layout.payload.first_line_indent import detect_first_line_indent_pt_from_text_lines
from retainpdf_pipeline.render.layout.payload.first_line_indent import page_text_line_boxes


BODY_BBOX = [56.0, 100.0, 300.0, 160.0]


def _paragraph_item(bbox: list[float] = BODY_BBOX) -> dict:
    return {
        "item_id": "p001-b001",
        "page_idx": 0,
        "block_type": "text",
        "block_kind": "text",
        "block_class": "body",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "bbox": bbox,
        "source_text": "x",
    }


def _pdf_with_lines(path: Path, first_line_x: float) -> fitz.Page:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((first_line_x, 112), "Although our current understanding emphasizes", fontsize=9.8)
    for index in range(1, 4):
        page.insert_text((56.7, 112 + index * 12), "the established effect of hypertension on stroke", fontsize=9.8)
    doc.save(path)
    doc.close()
    return fitz.open(path)[0]


def test_indented_first_line_is_read_from_the_text_layer(tmp_path: Path) -> None:
    page = _pdf_with_lines(tmp_path / "indented.pdf", first_line_x=64.7)

    indent = detect_first_line_indent_pt_from_text_lines(
        _paragraph_item(), page_text_line_boxes(page), font_size_pt=10.76, page_text_width_med=244.0
    )

    # 字号估成 10.76pt 时，图像路径的门槛正好 8pt，这个 8pt 的缩进会被浮点误差刷掉。
    assert indent == 8.0


def test_flush_first_line_has_no_indent(tmp_path: Path) -> None:
    page = _pdf_with_lines(tmp_path / "flush.pdf", first_line_x=56.7)

    indent = detect_first_line_indent_pt_from_text_lines(
        _paragraph_item(), page_text_line_boxes(page), font_size_pt=9.8, page_text_width_med=244.0
    )

    assert indent == 0.0


def test_scanned_page_has_no_text_layer_so_the_pixmap_path_takes_over(tmp_path: Path) -> None:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.draw_rect(fitz.Rect(56, 100, 300, 160), color=(0, 0, 0), fill=(0.2, 0.2, 0.2))

    assert page_text_line_boxes(page) == []
    # None 而不是 0.0：0.0 是「读到了，确实没缩进」，None 才会让调用方去走灰度图。
    assert detect_first_line_indent_pt_from_text_lines(
        _paragraph_item(), [], font_size_pt=9.8, page_text_width_med=244.0
    ) is None


def test_text_layer_that_misses_the_block_defers_to_the_pixmap_path(tmp_path: Path) -> None:
    page = _pdf_with_lines(tmp_path / "elsewhere.pdf", first_line_x=64.7)

    assert detect_first_line_indent_pt_from_text_lines(
        _paragraph_item([56.0, 500.0, 300.0, 560.0]),
        page_text_line_boxes(page),
        font_size_pt=9.8,
        page_text_width_med=244.0,
    ) is None


def test_text_lines_are_read_without_decoding_the_page_images(tmp_path: Path, monkeypatch) -> None:
    # 只看文字行：取文字层时不要图片（默认的 "dict" 会把图解码进结果，扫描件一页 0.13 秒，481 页 60 秒，2026-11-02）。
    page = _pdf_with_lines(tmp_path / "with-image.pdf", 72.0)
    pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 40, 40), False)
    pix.clear_with(120)
    page.insert_image(fitz.Rect(300, 300, 500, 500), pixmap=pix)
    flags_seen = []
    original = fitz.Page.get_text

    def recorded(self, option="text", **kwargs):
        flags_seen.append(kwargs.get("flags"))
        return original(self, option, **kwargs)

    monkeypatch.setattr(fitz.Page, "get_text", recorded)
    assert len(page_text_line_boxes(page)) == 4
    assert flags_seen and all(flags is not None and not flags & fitz.TEXT_PRESERVE_IMAGES for flags in flags_seen)
