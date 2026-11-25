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


# ---- 2026-11-25 规则修正：点线引导、「4-2」式章号、页码不在右边一列、附录行、上下标（合成的页，不用书里的字）----


def _page(lines, *, width=460, height=700):
    """lines: [(x, y, 文字, 字号)]，每项一次 insert_text（同一次写进去的在文字层里是一个片段）。"""
    pdf = fitz.open()
    page = pdf.new_page(width=width, height=height)
    for x, y, text, size in lines:
        page.insert_text((x, y), text, fontsize=size)
    return pdf


def _rows(result):
    return [(e.number, e.title, e.page_label) for e in result.entries]


def test_dot_leaders_in_the_title_span_with_hyphen_numbers():
    # 章号「4-2」单独一段；标题、点线、页码写在同一段里（一整页条目以前粘成一条）
    lines = [(60, 100, "4", 11), (80, 100, "Gamma Chapter Title", 11), (400, 100, "89", 11)]
    rows = [("4-1", "Alpha Topic", "89"), ("4-2", "Beta Topic", "105"), ("4-3", "Gamma Topic", "106"),
            ("4-4", "Delta Topic", "109")]
    y = 114
    for number, title, page_label in rows:
        lines += [(80, y, number, 10), (110, y, f"{title} . . . . . . . . . . . . . . . . {page_label}", 10)]
        y += 13
    lines.append((110, y, "Problems . . . . . . . . . . . . . . . . . . . 120", 10))
    with _page(lines) as pdf:
        result = split_toc_page(pdf[0], [50, 85, 420, y + 5])
    assert result is not None
    assert _rows(result) == [("4", "Gamma Chapter Title", "89")] + rows + [("", "Problems", "120")]
    assert [e.level for e in result.entries] == [1, 2, 2, 2, 2, 2]
    # 条目框不压住页码（页码按字的位置从片段里切出来）
    beta = result.entries[2]
    assert beta.page_box is not None and beta.bbox[2] < beta.page_box[0]


def test_dot_leaders_in_their_own_span_and_leader_without_page_ends_the_entry():
    lines = [
        (60, 100, "1.1", 10), (90, 100, "First Section", 10), (170, 100, ". . . . . . . . . . . .", 10), (400, 100, "3", 10),
        (60, 114, "1.2", 10), (90, 114, "Second Section ....................", 10),
        (60, 128, "1.3", 10), (90, 128, "Third Section", 10), (170, 128, "…………………", 10), (400, 128, "9", 10),
        (60, 142, "1.4", 10), (90, 142, "Fourth Section ·········· 12", 10),
    ]
    with _page(lines) as pdf:
        result = split_toc_page(pdf[0], [50, 85, 420, 150])
    assert result is not None
    assert _rows(result) == [("1.1", "First Section", "3"), ("1.2", "Second Section", ""),
                             ("1.3", "Third Section", "9"), ("1.4", "Fourth Section", "12")]


def test_page_numbers_right_after_the_title_not_in_a_column():
    # 页码紧跟在标题后面（不排成一列）；章那一行页码和标题在一个片段里；附录行另起一条，折行照旧接上
    lines = [
        (50, 100, "2. Second Part Title 220", 11),
        (72, 114, "2.1", 10), (106, 114, "Short", 10), (140, 114, "221", 10),
        (72, 128, "2.2", 10), (106, 128, "A Much Longer Section Heading", 10), (270, 128, "228", 10),
        (72, 142, "2.3", 10), (106, 142, "Medium Heading Here", 10), (215, 142, "240", 10),
        (106, 156, "Annexure i", 10), (173, 156, "Derivation of Something", 10), (300, 156, "252", 10),
        (106, 170, "Annexure ii", 10), (173, 170, "Long Annex Title That Wraps", 10),
        (173, 184, "Onto a Second Line", 10), (275, 184, "261", 10),
    ]
    with _page(lines) as pdf:
        result = split_toc_page(pdf[0], [45, 88, 420, 190])
    assert result is not None
    assert _rows(result) == [
        ("2.", "Second Part Title", "220"),
        ("2.1", "Short", "221"),
        ("2.2", "A Much Longer Section Heading", "228"),
        ("2.3", "Medium Heading Here", "240"),
        ("", "Annexure i Derivation of Something", "252"),
        ("", "Annexure ii Long Annex Title That Wraps Onto a Second Line", "261"),
    ]
    assert result.entries[-1].line_count == 2


def test_number_at_the_end_of_a_title_stays_in_a_column_layout():
    # 页码排成右边一列时，标题末尾的数字（「Part 2」）不是页码
    lines = [(60, 100 + 14 * i, title, 10) for i, title in enumerate(["Intro", "Methods Part 2", "Results", "Outlook"])]
    lines += [(400, 100 + 14 * i, page_label, 10) for i, page_label in enumerate(["1", "", "9", "15"]) if page_label]
    lines.append((60, 100 + 14 * 4, "Appendix", 10))
    lines.append((400, 100 + 14 * 4, "20", 10))
    with _page(lines) as pdf:
        result = split_toc_page(pdf[0], [50, 85, 420, 165])
    assert result is not None
    titles = [e.title for e in result.entries]
    assert "Methods Part 2" in " ".join(titles)
    assert all(e.page_label != "2" for e in result.entries)


def test_chapter_page_and_supplement_labels():
    lines = []
    for i, (title, page_label) in enumerate([("Overview", "1-1"), ("Setup", "1-7"), ("Commands", "2-1"),
                                             ("Options", "2-12"), ("Notes", "S2"), ("More Notes", "S3")]):
        lines.append((60, 100 + 14 * i, f"{title}....................................{page_label}", 10))
    with _page(lines) as pdf:
        result = split_toc_page(pdf[0], [50, 85, 420, 190])
    assert result is not None
    assert [e.page_label for e in result.entries] == ["1-1", "1-7", "2-1", "2-12", "S2", "S3"]
    assert result.entries[0].title == "Overview"


def test_superscripts_stay_on_their_line_and_accents_are_joined():
    lines = [
        (60, 100, "1", 11), (90, 100, "The H", 11), (118, 96, "+", 7), (125, 100, "Ion", 11), (400, 100, "3", 11),
        (60, 118, "2", 11), (90, 118, "Fl¨ote Tuning", 11), (400, 118, "8", 11),
        (60, 136, "3", 11), (90, 136, "Closing Remarks", 11), (400, 136, "12", 11),
    ]
    with _page(lines) as pdf:
        result = split_toc_page(pdf[0], [50, 85, 420, 145])
    assert result is not None
    assert len(result.entries) == 3
    assert result.entries[0].title.replace(" ", "") == "TheH+Ion"
    assert result.entries[1].title == "Flöte Tuning"


def test_author_lines_under_titles_are_their_own_entries():
    # 论文集：标题一行（带页码），下面缩进一行作者（不带页码）
    lines = []
    y = 100
    for title, author, page_label in [("First Paper", "A. Author", "1"), ("Second Paper", "B. Writer", "17"),
                                      ("Third Paper", "C. Scholar", "35")]:
        lines += [(40, y, title, 11), (330, y, page_label, 11), (60, y + 13, author, 9.5)]
        y += 30
    with _page(lines) as pdf:
        result = split_toc_page(pdf[0], [30, 85, 360, y])
    assert result is not None
    assert _rows(result) == [("", "First Paper", "1"), ("", "A. Author", ""), ("", "Second Paper", "17"),
                             ("", "B. Writer", ""), ("", "Third Paper", "35"), ("", "C. Scholar", "")]


def test_index_like_page_with_jumping_numbers_is_not_split():
    # 两栏的索引：一行两条，页码来回跳
    lines = []
    for i, (left, lp, right, rp) in enumerate([("Alpha", "281", "Beta", "128"), ("Gamma", "108", "Delta", "38"),
                                              ("Epsilon", "162", "Zeta", "19"), ("Eta", "88", "Theta", "364"),
                                              ("Iota", "423", "Kappa", "302")]):
        y = 100 + 13 * i
        lines += [(60, y, f"{left},", 9), (120, y, lp, 9), (230, y, f"{right},", 9), (290, y, rp, 9)]
    with _page(lines) as pdf:
        assert split_toc_page(pdf[0], [50, 85, 330, 170]) is None


def test_bullet_list_without_page_numbers_is_not_split():
    lines = [(60, 100 + 14 * i, f"- item number {word}", 10) for i, word in enumerate(["one", "two", "three", "four"])]
    with _page(lines) as pdf:
        assert split_toc_page(pdf[0], [50, 85, 420, 160]) is None


def test_one_misread_page_number_in_a_long_toc_is_tolerated_two_are_not():
    def build(pages):
        return [(60, 100 + 13 * i, f"Entry {chr(65 + i)} ........................ {p}", 9) for i, p in enumerate(pages)]

    good = [str(10 + i) for i in range(16)]
    one_typo = good[:5] + ["91"] + good[6:]
    with _page(build(one_typo)) as pdf:
        assert split_toc_page(pdf[0], [50, 85, 420, 320]) is not None
    two_typos = one_typo[:10] + ["95"] + one_typo[11:]
    with _page(build(two_typos)) as pdf:
        assert split_toc_page(pdf[0], [50, 85, 420, 320]) is None


def test_entry_blocks_record_where_the_page_number_is():
    document = _document([50, 80, 380, 240])
    with _toc_pdf() as pdf:
        split_toc_blocks_with_text_layer(document, pdf)
    entry = next(block for block in document["pages"][0]["blocks"] if block["structure_role"] == "toc_entry")
    page_box = entry["metadata"]["toc_entry_page_bbox"]
    # 页码在条目框右边，不在条目里
    assert page_box[0] >= 350 - 1 and entry["bbox"][2] < page_box[0]
