"""目录页按文字层拆成条目（toc_pages.py，2026-11-25）。"""

import fitz

from retainpdf_pipeline.ocr.document_schema.toc_pages import split_toc_blocks_with_text_layer, split_toc_page

ROWS = [
    # (章号, 标题, 页码, 标题左边)；小节和章标题同一列起（书里常见的排法）
    ("1", "Analyzing the Audience", "1", 90),
    ("", "Analyze who your audience is", "3", 90),
    ("", "References", "13", 90),
    ("2", "Balancing Precision and Clarity", "15", 90),
    ("", "Choose the right word", "15", 90),
    ("", "References", "35", 90),
]


def _toc_pdf(*, header: bool = False, wrapped: bool = False):
    pdf = fitz.open()
    page = pdf.new_page(width=420, height=600)
    if header:
        page.insert_text((60, 40), "xvi", fontsize=9)
        page.insert_text((330, 40), "Contents", fontsize=9)
    y = 100
    for number, title, page_label, x in ROWS:
        if number:
            page.insert_text((60, y), number, fontsize=11)
        page.insert_text((x, y), title, fontsize=11)
        if wrapped and title == "Analyze who your audience is":
            y += 14
            page.insert_text((x, y), "and what they know", fontsize=11)
        page.insert_text((350, y), page_label, fontsize=11)
        y += 22
    return pdf


def _document(bbox):
    def block(block_id, text, box, **roles):
        return {"block_id": block_id, "type": "text", "sub_type": roles.get("sub_type", "body"), "bbox": box,
                "text": text, "layout_role": roles.get("layout_role", "body"),
                "semantic_role": roles.get("semantic_role", "body"),
                "structure_role": roles.get("structure_role", "body"), "metadata": {}, "policy": {"translate": True},
                "lines": [], "segments": [], "content": {"kind": "text", "text": text}}

    return {
        "pages": [{
            "blocks": [
                block("p001-b0000", "Contents", [60, 50, 200, 70], structure_role="heading", layout_role="heading"),
                block("p001-b0001", "whole toc", bbox, sub_type="table_of_contents", layout_role="toc",
                      semantic_role="table_of_contents", structure_role="table_of_contents"),
                block("p001-b0002", "after", [60, 500, 300, 520]),
            ]
        }],
        "derived": {"refs": ["p001-b0002"]},
    }


def test_split_reads_numbers_titles_page_labels_and_levels():
    with _toc_pdf() as pdf:
        result = split_toc_page(pdf[0], [50, 80, 380, 240])
    assert result is not None
    assert [(e.number, e.title, e.page_label, e.level) for e in result.entries] == [
        ("1", "Analyzing the Audience", "1", 1),
        ("", "Analyze who your audience is", "3", 2),
        ("", "References", "13", 2),
        ("2", "Balancing Precision and Clarity", "15", 1),
        ("", "Choose the right word", "15", 2),
        ("", "References", "35", 2),
    ]
    # 页码列不进条目框
    assert all(entry.bbox[2] < 350 for entry in result.entries)


def test_wrapped_title_is_one_entry_with_a_box_per_line():
    with _toc_pdf(wrapped=True) as pdf:
        result = split_toc_page(pdf[0], [50, 80, 380, 260])
    assert result is not None
    entry = result.entries[1]
    assert entry.title == "Analyze who your audience is and what they know"
    assert entry.line_count == 2 and len(entry.line_boxes) == 2


def test_running_header_is_kept_out_of_entries():
    with _toc_pdf(header=True) as pdf:
        result = split_toc_page(pdf[0], [50, 25, 380, 240])
    assert result is not None
    assert result.header_lines and "Contents" in result.header_lines[0]
    assert result.entries[0].title == "Analyzing the Audience"


def test_too_few_entries_is_not_split():
    with fitz.open() as pdf:
        page = pdf.new_page(width=420, height=600)
        page.insert_text((90, 100), "Only one line", fontsize=11)
        page.insert_text((350, 100), "7", fontsize=11)
        assert split_toc_page(page, [50, 80, 380, 120]) is None


def test_document_blocks_are_replaced_and_renumbered_by_position():
    document = _document([50, 80, 380, 240])
    with _toc_pdf() as pdf:
        assert split_toc_blocks_with_text_layer(document, pdf) == 1
    blocks = document["pages"][0]["blocks"]
    # 块号数字等于在本页的位置（翻译条目号、渲染引擎配译文都按位置算）
    assert [block["block_id"] for block in blocks] == [f"p001-b{index:04d}" for index in range(len(blocks))]
    entries = [block for block in blocks if block["structure_role"] == "toc_entry"]
    assert len(entries) == 6
    first = entries[0]
    # 章号跟标题一起重画（擦原文按整段文字删，章号常和标题在一段里）；页码不进
    assert first["text"] == "1 Analyzing the Audience"
    assert first["layout_role"] == "toc" and first["semantic_role"] == "unknown"
    assert first["metadata"]["toc_split_parent_block_id"] == "p001-b0001"
    assert first["metadata"]["toc_entry_page_label"] == "1"
    # 后面那块挪了号，文档里别处写着的旧号跟着改
    assert blocks[-1]["text"] == "after" and blocks[-1]["block_id"] == "p001-b0007"
    assert document["derived"]["refs"] == ["p001-b0007"]


def test_no_text_layer_keeps_the_block():
    document = _document([50, 80, 380, 240])
    with fitz.open() as pdf:
        pdf.new_page(width=420, height=600)
        assert split_toc_blocks_with_text_layer(document, pdf) == 0
    assert [block["block_id"] for block in document["pages"][0]["blocks"]] == ["p001-b0000", "p001-b0001", "p001-b0002"]
