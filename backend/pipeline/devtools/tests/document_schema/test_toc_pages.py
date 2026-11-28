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
    # 章号跟标题一起重画（擦原文按整段文字删，章号常和标题在一段里）；页码不进条目，另成一个小块
    assert first["text"] == "1 Analyzing the Audience"
    assert first["layout_role"] == "toc" and first["semantic_role"] == "unknown"
    assert first["metadata"]["toc_split_parent_block_id"] == "p001-b0001"
    assert first["metadata"]["toc_entry_page_label"] == "1"
    # 每条后面紧跟它的页码小块：标题、页码、标题、页码……
    assert [block["structure_role"] for block in blocks[1:13]] == ["toc_entry", "toc_page_label"] * 6
    # 后面那块挪了号，文档里别处写着的旧号跟着改
    assert blocks[-1]["text"] == "after" and blocks[-1]["block_id"] == "p001-b0013"
    assert document["derived"]["refs"] == ["p001-b0013"]


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


# ---- 2026-11-25 页码小块：页码和标题常在同一条绘字指令里，擦标题时一起被擦，排版要在原处重画 ----


def test_page_label_blocks_follow_their_entries():
    document = _document([50, 80, 380, 240])
    with _toc_pdf() as pdf:
        split_toc_blocks_with_text_layer(document, pdf)
    blocks = document["pages"][0]["blocks"]
    labels = [block for block in blocks if block["structure_role"] == "toc_page_label"]
    assert [block["text"] for block in labels] == ["1", "3", "13", "15", "15", "35"]
    for label in labels:
        index = blocks.index(label)
        entry = blocks[index - 1]
        metadata = label["metadata"]
        # 框就是条目记下的页码框；文字、定译都是页码本身，定译来源单独记（两个翻译引擎都不发请求）
        assert entry["structure_role"] == "toc_entry"
        assert label["bbox"] == entry["metadata"]["toc_entry_page_bbox"]
        assert label["block_id"] == f"p001-b{index:04d}"
        assert metadata["toc_page_label_entry_block_id"] == entry["block_id"]
        assert metadata["fixed_translation"] == label["text"] == metadata["toc_page_label"]
        assert metadata["fixed_translation_source"] == "toc_page_label"
        assert metadata["toc_split_parent_block_id"] == "p001-b0001"
        assert metadata["toc_page_label_source_font_size"] == 11.0
        assert not any(key.startswith("toc_entry_") for key in metadata)
        assert label["layout_role"] == "toc" and label["semantic_role"] == "unknown"
        assert label["content"]["text"] == label["text"]
        assert label["policy"] == {"translate": True}
        assert label["bbox"][0] >= 349


def test_entries_without_a_page_number_get_no_label_and_labels_are_not_split_again():
    lines = [(60, 100, "1", 11), (90, 100, "First Chapter", 11), (350, 100, "1", 11),
             (60, 122, "2", 11), (90, 122, "Second Chapter", 11), (350, 122, "9", 11),
             (60, 144, "3", 11), (90, 144, "Third Chapter Without Number", 11),
             (60, 166, "4", 11), (90, 166, "Fourth Chapter", 11), (350, 166, "20", 11)]
    document = _document([50, 80, 380, 200])
    with _page(lines, width=420, height=600) as pdf:
        assert split_toc_blocks_with_text_layer(document, pdf) == 1
        roles = [block["structure_role"] for block in document["pages"][0]["blocks"]]
        assert roles.count("toc_entry") == 4 and roles.count("toc_page_label") == 3
        # 再拆一遍（重跑归一化）不动已经拆过的条目和页码小块
        assert split_toc_blocks_with_text_layer(document, pdf) == 0
    third = next(b for b in document["pages"][0]["blocks"] if b["text"].startswith("3 "))
    following = document["pages"][0]["blocks"][document["pages"][0]["blocks"].index(third) + 1]
    assert following["structure_role"] == "toc_entry"


def test_page_labels_inherit_the_toc_block_policy():
    document = _document([50, 80, 380, 240])
    document["pages"][0]["blocks"][1]["policy"] = {"translate": False, "translate_reason": "provider_non_body"}
    with _toc_pdf() as pdf:
        split_toc_blocks_with_text_layer(document, pdf)
    labels = [b for b in document["pages"][0]["blocks"] if b["structure_role"] == "toc_page_label"]
    assert labels and all(b["policy"] == {"translate": False, "translate_reason": "provider_non_body"} for b in labels)


# ---- 2026-11-28 原位替换：每条记下只框标题的字的每一行、章号和标签的框（标签、章号、点线、页码留在原图上） ----


def test_title_lines_frame_only_the_title_and_sit_on_the_baseline():
    lines = [
        (60, 100, "1.1", 10), (90, 100, "First Section", 10), (170, 100, ". . . . . . . . . . . .", 10), (400, 100, "3", 10),
        (60, 114, "1.2", 10), (90, 114, "Second Section . . . . . . . . . . 7", 10),
        (60, 128, "1.3", 10), (90, 128, "A Title That Wraps", 10), (90, 142, "Onto Two Lines", 10), (400, 142, "9", 10),
    ]
    with _page(lines) as pdf:
        result = split_toc_page(pdf[0], [50, 85, 420, 150])
    assert result is not None
    first, second, wrapped = result.entries
    [line] = first.title_lines
    assert line["text"] == "First Section" and line["baseline"] == 100 and line["size"] == 10
    assert line["bbox"][0] >= 90 - 0.5 and line["bbox"][2] < 170  # 章号、点线不在里面
    assert first.number_box is not None and first.number_box[2] < 90
    # 标题、点线、页码在同一个片段里：按字切开，框到标题最后一个字
    [line] = second.title_lines
    assert line["text"] == "Second Section" and line["bbox"][2] < 90 + 10 * 0.6 * len("Second Section . ")
    assert [line["text"] for line in wrapped.title_lines] == ["A Title That Wraps", "Onto Two Lines"]
    assert [line["baseline"] for line in wrapped.title_lines] == [128, 142]
    assert wrapped.title_only == "A Title That Wraps Onto Two Lines"


def test_a_title_keeps_its_own_period_before_spaced_dot_leaders():
    lines = [(60, 100 + 14 * i, f"{title} . . . . . . . . . . . . . . {page}", 10)
             for i, (title, page) in enumerate([("Summary.", "3"), ("Problems", "5"), ("Notes.", "8")])]
    lines.append((60, 142, "Answers......................... 11", 10))  # 点挨着点：分不出来，照旧全算点线
    with _page(lines) as pdf:
        result = split_toc_page(pdf[0], [50, 85, 420, 150])
    assert result is not None
    assert [e.title for e in result.entries] == ["Summary.", "Problems", "Notes.", "Answers"]
    assert result.entries[0].title_lines[0]["text"] == "Summary."


def test_label_column_is_recorded_apart_from_the_title():
    lines = [
        (60, 100, "Chapter 1 Introduction", 10), (400, 100, "1", 10),
        (60, 114, "Chapter 2", 10), (120, 114, "Methods", 10), (400, 114, "9", 10),
        (60, 128, "Annexure", 10), (110, 128, "IV", 10), (130, 128, "Raw Data", 10), (400, 128, "20", 10),
        (60, 142, "Appendix A", 10), (400, 142, "31", 10),
        (60, 156, "Chapter summary", 10), (400, 156, "40", 10),
    ]
    with _page(lines) as pdf:
        result = split_toc_page(pdf[0], [50, 85, 420, 165])
    assert result is not None
    got = [(e.title, e.label, e.title_only) for e in result.entries]
    assert got == [
        ("Chapter 1 Introduction", "Chapter 1", "Introduction"),  # 条目文字照旧带着标签
        ("Chapter 2 Methods", "Chapter 2", "Methods"),
        ("Annexure IV Raw Data", "Annexure IV", "Raw Data"),
        ("Appendix A", "", "Appendix A"),  # 整条只有标签：它就是标题
        ("Chapter summary", "", "Chapter summary"),  # 后面不是编号：不是标签
    ]
    chapter_one = result.entries[0]
    assert chapter_one.label_box is not None and chapter_one.label_box[2] <= chapter_one.title_lines[0]["bbox"][0]


def test_entry_blocks_carry_the_title_lines_for_in_place_replacement():
    document = _document([50, 80, 380, 240])
    with _toc_pdf() as pdf:
        split_toc_blocks_with_text_layer(document, pdf)
    entries = [block for block in document["pages"][0]["blocks"] if block["structure_role"] == "toc_entry"]
    first = entries[0]["metadata"]
    assert first["toc_entry_title"] == "Analyzing the Audience"
    assert first["toc_entry_number_bbox"] is not None and first["toc_entry_label"] == ""
    [line] = first["toc_entry_title_lines"]
    assert line["text"] == "Analyzing the Audience" and line["baseline"] == 100 and line["bbox"][0] >= 89
    # 条目的文字、框和以前一样（默认的排法不变）
    assert entries[0]["text"] == "1 Analyzing the Audience" and entries[0]["bbox"][0] <= 60 + 0.5


# ---- 2026-11-28 认上下文（R2）的规则草稿：每段字的角色、条目归属；规则不认的块也给候选；按草稿重建和拆的时候一样 ----


def test_page_draft_gives_every_fragment_a_role():
    from retainpdf_pipeline.ocr.document_schema.toc_pages import page_draft

    lines = [(330, 40, "Contents", 9), (60, 100, "1", 11), (90, 100, "Analyzing the Audience . . . . . .", 11),
             (350, 100, "1", 11), (90, 122, "References", 11), (350, 122, "13", 11), (60, 144, "2", 11),
             (90, 144, "Balancing Precision", 11), (350, 144, "15", 11)]
    with _page(lines) as pdf:
        draft = page_draft(pdf[0], [50, 20, 380, 160])
    assert draft["accepted"] and draft["reason"] == ""
    roles = [(fragment["line"], fragment["role"], fragment["text"]) for fragment in draft["fragments"]]
    assert roles == [(1, "header", "Contents"), (2, "number", "1"), (2, "title", "Analyzing the Audience"),
                     (2, "leader", ". . . . . ."), (2, "page", "1"), (3, "title", "References"), (3, "page", "13"),
                     (4, "number", "2"), (4, "title", "Balancing Precision"), (4, "page", "15")]
    by_id = {fragment["id"]: fragment["text"] for fragment in draft["fragments"]}
    assert [[by_id[f] for f in entry["fragments"]] for entry in draft["entries"]] == [
        ["1", "Analyzing the Audience", ". . . . . .", "1"], ["References", "13"], ["2", "Balancing Precision", "15"]]
    assert [entry["level"] for entry in draft["entries"]] == [1, 2, 1]


def test_page_draft_gives_a_candidate_for_a_block_the_rules_reject():
    from retainpdf_pipeline.ocr.document_schema.toc_pages import page_draft

    lines = [(90, 100, "Preface", 11), (350, 100, "vii", 11), (90, 122, "Introduction", 11), (350, 122, "1", 11)]
    with _page(lines) as pdf:
        assert split_toc_page(pdf[0], [50, 80, 380, 140]) is None
        draft = page_draft(pdf[0], [50, 80, 380, 140])
    assert draft["accepted"] is False and draft["reason"] == "few_entries" and len(draft["entries"]) == 2
    with fitz.open() as pdf:
        pdf.new_page()
        assert page_draft(pdf[0], [50, 80, 380, 140]) is None


def test_rebuilding_from_an_unchanged_draft_matches_the_split():
    import copy

    from retainpdf_pipeline.ocr.document_schema.toc_pages import apply_toc_context
    from retainpdf_pipeline.ocr.document_schema.toc_pages import context_drafts

    document = _document([50, 80, 380, 240])
    with _toc_pdf(wrapped=True) as pdf:
        split_toc_blocks_with_text_layer(document, pdf)
        drafts, no_text = context_drafts(document, pdf)
    assert no_text == [] and len(drafts) == 1 and drafts[0]["accepted"]
    assert drafts[0]["parent_block_id"] == "p001-b0001" and drafts[0]["region"] == [50.0, 80.0, 380.0, 240.0]
    rebuilt = copy.deepcopy(document)
    assert apply_toc_context(rebuilt, [{"status": "model", "effect": "rebuild", "draft": drafts[0]}]) == 1
    keys = ("toc_entry_title", "toc_entry_title_lines", "toc_entry_number", "toc_entry_number_bbox", "toc_entry_page_label",
            "toc_entry_page_bbox", "toc_entry_level", "toc_entry_label", "toc_entry_line_count", "toc_split_parent_block_id",
            "toc_split_parent_bbox", "toc_page_label", "fixed_translation")

    def shape(doc):
        # 草稿里的框记到 0.01pt：框只比到 0.1pt
        return [(block["block_id"], block["structure_role"], block["text"], [round(v, 1) for v in block["bbox"]], block.get("policy"),
                 {key: block["metadata"].get(key) for key in keys}) for block in doc["pages"][0]["blocks"]]

    assert shape(rebuilt) == shape(document)
    entry = next(block for block in rebuilt["pages"][0]["blocks"] if block["structure_role"] == "toc_entry")
    assert entry["metadata"]["toc_entry_context_source"] == "model" and entry["metadata"]["toc_entry_keep_original"] is False

def test_label_number_sharing_a_span_with_the_title_and_label_on_its_own_line():
    # 80c3ad：「Annexure」斜体一段，「IV Commutators …」一段；14e352：「CHAPTER 2」单独一行，标题在下一行
    lines = [
        (60, 100, "Annexure", 10), (110, 100, "IV Commutators of Operators", 10), (400, 100, "177", 10),
        (60, 114, "Annexure", 10), (110, 114, "V Transformation", 10), (400, 114, "183", 10),
        (60, 136, "CHAPTER 2", 10),
        (60, 150, "Electric Potential", 10), (400, 150, "190", 10),
        (60, 172, "CHAPTER 3", 10),
        (60, 186, "Capacitance", 10), (400, 186, "210", 10),
    ]
    with _page(lines) as pdf:
        result = split_toc_page(pdf[0], [50, 85, 420, 195])
    assert result is not None
    got = [(e.label, e.title_only, [line["text"] for line in e.title_lines]) for e in result.entries]
    assert got == [
        ("Annexure IV", "Commutators of Operators", ["Commutators of Operators"]),
        ("Annexure V", "Transformation", ["Transformation"]),
        ("CHAPTER 2", "Electric Potential", ["Electric Potential"]),
        ("CHAPTER 3", "Capacitance", ["Capacitance"]),
    ]
    annex = result.entries[0]
    assert annex.label_box[2] < annex.title_lines[0]["bbox"][0]  # 标签框到「IV」为止


# ---- 2026-11-29 OCR 漏在目录块外面的目录行（80c3ad：第一章那行不在任何块里，Preface / Acknowledgements 被框成一段正文） ----


def _missed_rows_page():
    lines = [(60, 50, "Contents", 16),
             (60, 100, "Preface", 10), (400, 100, "vii", 10),
             (60, 112, "Acknowledgements", 10), (400, 112, "viii", 10),
             (60, 134, "1.", 10), (80, 134, "WAVE MECHANICS AND ATOMS", 10), (400, 134, "1", 10)]
    y = 150
    for number, title, page_label in [("1.1", "Towards Quantum Theory", "1"), ("1.2", "Wave Nature", "22"),
                                      ("1.3", "Wave Theory", "30"), ("1.4", "Translational Energy", "37")]:
        lines += [(80, y, number, 10), (110, y, title, 10), (400, y, page_label, 10)]
        y += 12
    lines += [(60, 300, "--------", 10), (400, 300, "9", 10)]  # 离得远、没有字：不并
    return _page(lines)


def _missed_rows_document():
    def block(block_id, text, box, role="body"):
        return {"block_id": block_id, "type": "text", "sub_type": role, "bbox": box, "text": text, "layout_role": role,
                "semantic_role": role, "structure_role": role, "metadata": {}, "policy": {"translate": True},
                "lines": [], "segments": [], "content": {"kind": "text", "text": text}}

    return {"pages": [{"blocks": [
        block("p001-b0000", "Contents", [58, 35, 140, 55], role="heading"),
        block("p001-b0001", "Preface Acknowledgements", [58, 90, 160, 115]),  # 只框了标题，页码在外面
        {**block("p001-b0002", "toc", [55, 140, 410, 200]), "sub_type": "table_of_contents", "layout_role": "toc",
         "structure_role": "table_of_contents"},
    ]}], "derived": {}}


def test_rows_ocr_left_outside_the_toc_block_are_taken_in():
    document = _missed_rows_document()
    with _missed_rows_page() as pdf:
        split_toc_blocks_with_text_layer(document, pdf)
    blocks = document["pages"][0]["blocks"]
    entries = [(b["metadata"]["toc_entry_number"], b["metadata"]["toc_entry_title"], b["metadata"]["toc_entry_page_label"])
               for b in blocks if b["structure_role"] == "toc_entry"]
    assert entries[:3] == [("", "Preface", "vii"), ("", "Acknowledgements", "viii"), ("1.", "WAVE MECHANICS AND ATOMS", "1")]
    assert len(entries) == 7
    # 被框成正文的那块整块并进来，不再单独翻；大标题照旧
    assert [b["text"] for b in blocks if b["structure_role"] not in ("toc_entry", "toc_page_label")] == ["Contents"]


def test_a_body_block_that_is_not_all_toc_rows_is_left_alone():
    document = _missed_rows_document()
    document["pages"][0]["blocks"][1]["bbox"] = [58, 60, 160, 115]  # 这块上面还有一行不是目录的字
    with _missed_rows_page() as pdf:
        pdf[0].insert_text((60, 70), "Some paragraph text that is not a toc row", fontsize=10)
        split_toc_blocks_with_text_layer(document, pdf)
    blocks = document["pages"][0]["blocks"]
    titles = [b["metadata"]["toc_entry_title"] for b in blocks if b["structure_role"] == "toc_entry"]
    assert "Preface" not in titles and "Acknowledgements" not in titles
    assert titles[0] == "WAVE MECHANICS AND ATOMS"  # 不在任何块里的那一行照样并进来
    assert any(b["text"] == "Preface Acknowledgements" for b in blocks)
