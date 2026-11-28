"""目录原位替换（render/output/toc_replace，R1，2026-11-28）：合成 PDF 上换字，检查 R1–R9 各一正一反。

目录页用 PyMuPDF 现造，按 R0 的拆条目（ocr/document_schema/toc_pages.py）拿到 toc_entry 的 metadata，再造译文条目。
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import fitz
import pytest

from retainpdf_pipeline.ocr.document_schema.toc_pages import split_toc_blocks_with_text_layer
from retainpdf_pipeline.render.output.toc_replace import apply_toc_replace
from retainpdf_pipeline.render.output.toc_replace import plan_toc_replace
from retainpdf_pipeline.render.output.toc_replace import page_ops
from retainpdf_pipeline.render.output.toc_replace.apply import line_runs
from retainpdf_pipeline.render.output.toc_replace.plan import HELD_FLAG
from retainpdf_pipeline.render.output.toc_replace.text import page_chars
from retainpdf_pipeline.render.output.toc_replace.text import resolve_font_file
from retainpdf_pipeline.render.output.toc_replace.text import split_to_lines
from retainpdf_pipeline.render.output.toc_replace.text import title_translation

REPO = Path(__file__).resolve().parents[5]
FONT = resolve_font_file([REPO / "resources" / "fonts"])
pytestmark = pytest.mark.skipif(FONT is None, reason="resources/fonts 里没有思源宋体")
LEADERS = set(".·")


def _row_text(number, title):
    return f"{number} {title}" if number else title


# 拆条目要一页至少 3 条（toc_pages.MIN_ENTRIES）：不够的后面补两条没译文的
FILLER = [("8", ["Filler section one"], "990"), ("9", ["Filler section two"], "995")]


def _toc_pdf(rows, *, dots="same", page_x=350.0, size=11.0, title_x=60.0):
    """rows: (章号, [标题的每一行], 页码)。dots：same 点线和标题同一条绘字指令、each 每个点一条指令（tocloft）、
    none 没有点线（页码另起）、follow 页码紧跟在标题后面。不到 3 条的补两条没译文的。"""
    rows = list(rows) + (FILLER if len(rows) < 3 else [])
    pdf = fitz.open()
    page = pdf.new_page(width=420, height=600)
    y = 100.0
    for number, lines, label in rows:
        for index, line in enumerate(lines):
            text = _row_text(number, line) if index == 0 else line
            x = title_x if index == 0 or not number else title_x + fitz.get_text_length(f"{number} ", fontsize=size)
            last = index == len(lines) - 1
            width = fitz.get_text_length(text, fontsize=size)
            if last and label and dots == "same":
                count = int((page_x - 8 - x - width) / fitz.get_text_length(" .", fontsize=size))
                page.insert_text((x, y), text + " ." * count, fontsize=size)
            elif last and label and dots == "each":
                page.insert_text((x, y), text, fontsize=size)
                dot_x = x + width + 6
                while dot_x < page_x - 8:
                    page.insert_text((dot_x, y), ".", fontsize=size)
                    dot_x += 5
            elif last and label and dots == "follow":
                page.insert_text((x, y), f"{text} {label}", fontsize=size)
            else:
                page.insert_text((x, y), text, fontsize=size)
            if last and label and dots != "follow":
                page.insert_text((page_x, y), label, fontsize=size)
            y += size * 1.45
        y += 6
    return pdf


def _document():
    return {"pages": [{"page_index": 0, "blocks": [
        {"block_id": "p001-b0000", "type": "text", "sub_type": "table_of_contents", "bbox": [40, 80, 400, 560], "text": "toc",
         "layout_role": "toc", "semantic_role": "table_of_contents", "structure_role": "table_of_contents", "metadata": {},
         "policy": {"translate": True}, "lines": [], "segments": [], "content": {"kind": "text", "text": "toc"}}]}]}


def _job(tmp_path, pdf, translations, *, name="src.pdf"):
    """拆条目、写 document.v1，按 {原文标题: 译文} 造译文条目。返回 (原文 PDF 路径, document 路径, {页: 条目})。"""
    source = tmp_path / name
    pdf.save(source)
    document = _document()
    with fitz.open(source) as reopened:
        assert split_toc_blocks_with_text_layer(document, reopened) == 1
    document_path = tmp_path / "document.v1.json"
    document_path.write_text(json.dumps(document), encoding="utf-8")
    items = []
    for index, block in enumerate(document["pages"][0]["blocks"]):
        item = {"item_id": block["block_id"], "block_idx": index, "page_idx": 0, "structure_role": block["structure_role"],
                "source_text": block["text"], "bbox": block["bbox"], "metadata": copy.deepcopy(block["metadata"]),
                "final_status": "translated", "translated_text": block["text"]}
        if block["structure_role"] == "toc_entry":
            title = block["metadata"]["toc_entry_title"]
            text = translations.get(title)
            if text is None:
                item.update(translated_text="", final_status="kept_origin")
            else:
                item["translated_text"] = text
        items.append(item)
    return source, document_path, {0: items}


def _plan(tmp_path, pdf, translations):
    source, document_path, pages = _job(tmp_path, pdf, translations)
    plan = plan_toc_replace(pages, source_pdf_path=source, document_path=document_path, font_path=FONT)
    return source, pages, plan


def _apply(tmp_path, source, plan):
    out = tmp_path / "out.pdf"
    out.write_bytes(Path(source).read_bytes())
    result = apply_toc_replace(output_pdf_path=out, source_pdf_path=source, plan=plan, page_indices=[0])
    return out, result


def _entry(plan, title):
    return next(entry for entry in plan.pages[0].entries if entry.source_title == title)


def _text(path) -> str:
    """读回来的字：同一个字形可能读成康熙部首这类等价字（字体子集的 ToUnicode），按 NFKC 比。"""
    import unicodedata

    with fitz.open(path) as doc:
        return unicodedata.normalize("NFKC", doc[0].get_text())


def _leaders(path) -> int:
    with fitz.open(path) as doc:
        return sum(1 for c in page_chars(doc[0]) if c.c in LEADERS)


ROWS = [("1", ["Introduction to Things"], "1"), ("1.1", ["Background and motivation"], "3"), ("", ["References"], "9"),
        ("2", ["Methods"], "11")]
TRANSLATIONS = {"Introduction to Things": "1 事物导论", "Background and motivation": "1.1 背景与动机", "References": "References",
                "Methods": "2 方法"}


@pytest.mark.parametrize("dots", ["same", "each"])
def test_leaders_page_numbers_and_numbers_stay_while_titles_are_replaced(tmp_path, dots):
    pdf = _toc_pdf(ROWS, dots=dots)
    source, _pages, plan = _plan(tmp_path, pdf, TRANSLATIONS)
    assert plan.reflow_pages == {}
    before = _leaders(source)
    out, result = _apply(tmp_path, source, plan)
    text = _text(out)
    for title in ("Introduction to Things", "Background and motivation", "Methods"):
        assert title not in text
    for written in ("事物导论", "背景与动机", "方法", "References"):
        assert written in text
    for kept in ("1.1", "11", "9"):
        assert kept in text
    assert _leaders(out) == before > 10  # R2：点线一个不少（和标题同一条指令、每个点一条指令都一样）
    totals = result["totals"]
    assert totals["R1_title_chars_left"] == 0 and totals["R2_other_chars_lost"] == 0 and totals["R3_overlap_chars"] == 0
    assert totals["R7_text_mismatch"] == 0 and totals["R8_markup"] == 0
    # 译文写在原首字的 x、原基线上，原字号
    entry = _entry(plan, "Methods")
    title_line = entry.lines[0]
    with fitz.open(source) as doc:
        methods = [c for c in page_chars(doc[0]) if c.c == "M" and abs(c.base - title_line.baseline) < 0.1]
    assert methods and abs(title_line.x - methods[0].x0) < 0.01 and title_line.size == pytest.approx(11.0)


def test_page_number_right_after_the_title_limits_the_width(tmp_path):
    rows = [("1.1", ["Towards Quantum Theory"], "1"), ("1.2", ["Quantization of Translational energy"], "7")]
    pdf = _toc_pdf(rows, dots="follow")
    source, _pages, plan = _plan(tmp_path, pdf, {"Towards Quantum Theory": "1.1 迈向量子理论",
                                                  "Quantization of Translational energy": "1.2 平动能的量子化"})
    entry = _entry(plan, "Towards Quantum Theory")
    with fitz.open(source) as doc:
        page_one = next(c for c in page_chars(doc[0]) if c.c == "1" and c.x0 > 150 and abs(c.base - entry.lines[0].baseline) < 0.1)
    assert entry.lines[0].x + entry.lines[0].width <= page_one.x0 - 0.3 * 11 + 0.01  # 到右边第一个留下来的字前 0.3 个字
    out, result = _apply(tmp_path, source, plan)
    assert result["totals"]["R3_overlap_chars"] == 0
    assert "7" in _text(out) and "迈向量子理论" in _text(out)


def test_two_line_title_without_number_goes_to_the_page_number_line(tmp_path):
    rows = [("", ["Analyze who your audience is, why they are", "reading, and what they know"], "3")]
    pdf = _toc_pdf(rows, dots="none")
    source, _pages, plan = _plan(tmp_path, pdf, {"Analyze who your audience is, why they are reading, and what they know": "分析读者是谁"})
    entry = plan.pages[0].entries[0]
    assert entry.src_lines == 2 and len(entry.lines) == 1 and entry.on_page_line
    title_lines = _job_metadata(tmp_path)["toc_entry_title_lines"]
    assert entry.lines[0].baseline == pytest.approx(title_lines[1]["baseline"])  # R6：和页码同一行
    out, result = _apply(tmp_path, source, plan)
    assert result["totals"]["R6_on_page_line"] == 1 and result["totals"]["R5_empty_lines"] == 1
    assert "reading" not in _text(out)


def test_two_line_title_with_a_number_starts_on_the_first_line(tmp_path):
    rows = [("2.3", ["A rather long numbered heading that wraps", "onto a second line"], "15")]
    pdf = _toc_pdf(rows, dots="none")
    source, _pages, plan = _plan(tmp_path, pdf, {"A rather long numbered heading that wraps onto a second line": "2.3 折行的编号标题"})
    entry = plan.pages[0].entries[0]
    title_lines = _job_metadata(tmp_path)["toc_entry_title_lines"]
    assert not entry.on_page_line and entry.lines[0].baseline == pytest.approx(title_lines[0]["baseline"])  # 反例：有章号不挪
    _out, result = _apply(tmp_path, source, plan)
    assert result["totals"]["R6_numbered_from_top"] == 1 and result["totals"]["R6_on_page_line"] == 0


def _job_metadata(tmp_path):
    document = json.loads((tmp_path / "document.v1.json").read_text(encoding="utf-8"))
    return next(b for b in document["pages"][0]["blocks"] if b["structure_role"] == "toc_entry")["metadata"]


def test_label_column_stays_and_only_the_title_is_written(tmp_path):
    rows = [("", ["Chapter 1 Introduction"], "1"), ("", ["Annexure II Tables of Constants"], "40")]
    pdf = _toc_pdf(rows)
    source, _pages, plan = _plan(tmp_path, pdf, {"Introduction": "第1章 引言", "Tables of Constants": "附录 II 常数表"})
    assert [line.text for entry in plan.pages[0].entries for line in entry.lines] == ["引言", "常数表"]
    assert [entry.status for entry in plan.pages[0].entries][:2] == ["placed", "placed"]
    out, _result = _apply(tmp_path, source, plan)
    text = _text(out)
    assert "Chapter 1" in text and "Annexure II" in text and "第1章" not in text


def test_untranslated_and_same_as_source_entries_are_not_touched(tmp_path):
    rows = [("", ["References"], "9"), ("", ["Frank S. Pittman III"], "12"), ("", ["Index"], "20")]
    pdf = _toc_pdf(rows)
    source, pages, plan = _plan(tmp_path, pdf, {"References": "References", "Frank S. Pittman III": "Frank S. Pittman"})
    statuses = [entry.status for entry in plan.pages[0].entries]
    assert statuses[:3] == ["kept_same_as_source", "kept_same_as_source", "kept_no_translation"]
    out, result = _apply(tmp_path, source, plan)
    text = _text(out)
    assert "References" in text and "Pittman III" in text and "Index" in text and "20" in text
    assert result["totals"]["R4_placed"] == 0
    # 页码小块不擦不画：定好的页里，目录条目和页码小块都改成保留原文
    held = plan.hold(pages)[0]
    roles = {item["structure_role"] for item in held if item.get(HELD_FLAG)}
    assert roles == {"toc_entry", "toc_page_label"} and all(item["final_status"] == "kept_origin" for item in held if item.get(HELD_FLAG))


def test_long_translation_shrinks_down_to_point_eight(tmp_path):
    # 点线紧跟着标题：能用的宽度就是原标题那么宽（约 7 个汉字）
    rows = [("", ["Short title here"], "5")]
    pdf = _toc_pdf(rows, dots="same")
    source, _pages, plan = _plan(tmp_path, pdf, {"Short title here": "较长的一个标题啊"})
    entry = plan.pages[0].entries[0]
    assert entry.status == "shrunk" and 0.8 <= entry.scale < 1.0
    _out, result = _apply(tmp_path, source, plan)
    assert result["totals"]["R4_shrunk"] == 1 and result["totals"]["R4_min_scale"] >= 0.8


def test_translation_that_does_not_fit_keeps_the_original(tmp_path):
    rows = [("", ["Short title here"], "5")]
    pdf = _toc_pdf(rows, dots="same")
    source, _pages, plan = _plan(tmp_path, pdf, {"Short title here": "这是一个非常非常长的放不下的标题"})
    entry = plan.pages[0].entries[0]
    assert entry.status == "kept_does_not_fit" and not entry.lines
    assert plan.diagnostics()["needs_model"] == [{"page": 0, "block_id": entry.block_id, "reason": "kept_does_not_fit"}]
    out, _result = _apply(tmp_path, source, plan)
    assert "Short title here" in _text(out)


def _scanned(pdf, *, visible_text: bool = False):
    """把造好的目录页画成图，铺满新的一页，再把原来的字按原位置写成看不见的文字层（扫描件 + OCR），
    或者看得见的文字层（字在图上、文字层也有，C18 那种）。"""
    image = pdf[0].get_pixmap(dpi=200)
    scan = fitz.open()
    page = scan.new_page(width=pdf[0].rect.width, height=pdf[0].rect.height)
    page.insert_image(page.rect, pixmap=image)
    for block in pdf[0].get_text("rawdict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                text = "".join(c["c"] for c in span["chars"])
                if text.strip():
                    page.insert_text(span["origin"], text, fontsize=span["size"], render_mode=0 if visible_text else 3,
                                     color=(1, 1, 1) if visible_text else (0, 0, 0))
    return scan


def test_scanned_page_covers_the_title_on_the_image(tmp_path):
    pdf = _scanned(_toc_pdf(ROWS))
    source, _pages, plan = _plan(tmp_path, pdf, TRANSLATIONS)
    assert plan.pages[0].mode == "scan"
    out, result = _apply(tmp_path, source, plan)
    totals = result["totals"]
    assert totals["R4_placed"] == 3 and totals["R2_cover_hits"] == 0 and totals["R1_ring_ink_strips"] == 0
    entry = _entry(plan, "Methods")
    with fitz.open(out) as doc:
        # 原标题那一块图上没有墨迹了（新写的字在基线上，量的是原标题框靠右、新字够不着的那段）
        rect = entry.covers[0]["rect"]
        assert page_ops.ink_ratio(doc[0], [entry.lines[0].x + entry.lines[0].width + 1, rect[1] + 0.5, rect[2] - 0.5, rect[3] - 0.5]) < 0.01
        # 页码那块图没动
        page_box = _job_metadata_by_title(tmp_path, "Methods")["toc_entry_page_bbox"]
        assert page_ops.ink_ratio(doc[0], page_box) > 0.02


def _job_metadata_by_title(tmp_path, title):
    document = json.loads((tmp_path / "document.v1.json").read_text(encoding="utf-8"))
    return next(b["metadata"] for b in document["pages"][0]["blocks"]
                if b["structure_role"] == "toc_entry" and b["metadata"]["toc_entry_title"] == title)


def test_text_layer_over_an_image_is_redone_as_a_scan(tmp_path):
    """R1 看图：文字层擦干净了，图上还有字（C18）——按扫描件重定、盖底色。"""
    pdf = _scanned(_toc_pdf(ROWS), visible_text=True)
    source, _pages, plan = _plan(tmp_path, pdf, TRANSLATIONS)
    assert plan.pages[0].mode == "scan"
    _out, result = _apply(tmp_path, source, plan)
    assert result["totals"]["R1_residual_ink_lines"] == 0 and result["totals"]["R4_placed"] == 3


# ---- 检查的反例：在计划上动手脚，检查要报出来 ----

def _fresh_page(source):
    doc = fitz.open(source)
    return doc, doc[0]


def test_r1_reports_title_chars_left_when_a_probe_misses(tmp_path):
    source, _pages, plan = _plan(tmp_path, _toc_pdf(ROWS), TRANSLATIONS)
    entry = _entry(plan, "Methods")
    entry.probes = []
    doc, page = _fresh_page(source)
    with doc:
        report = page_ops.erase_and_check(page, plan.pages[0])
    assert report["summary"]["R1_title_chars_left"] == len("Methods")
    assert report["failed"][entry.block_id] == "kept_erase_residual"


def test_r2_reports_other_chars_lost_when_a_probe_hits_the_page_number(tmp_path):
    source, _pages, plan = _plan(tmp_path, _toc_pdf(ROWS, dots="none"), TRANSLATIONS)
    entry = _entry(plan, "Methods")
    probe = entry.probes[0]
    entry.probes[0] = [probe[0], probe[1], 360.0, probe[3]]  # 一直伸到页码
    doc, page = _fresh_page(source)
    with doc:
        report = page_ops.erase_and_check(page, plan.pages[0])
    assert report["summary"]["R2_other_chars_lost"] >= 2
    assert report["failed"][entry.block_id] == "kept_erase_collateral"


def test_r2_reports_a_cover_over_the_page_number_on_a_scan(tmp_path):
    source, _pages, plan = _plan(tmp_path, _scanned(_toc_pdf(ROWS)), TRANSLATIONS)
    entry = _entry(plan, "Methods")
    rect = entry.covers[0]["rect"]
    entry.covers[0]["rect"] = [rect[0], rect[1], 370.0, rect[3]]
    doc, page = _fresh_page(source)
    with doc:
        report = page_ops.erase_and_check(page, plan.pages[0])
    assert report["summary"]["R2_cover_hits"] >= 1 and report["failed"][entry.block_id] == "kept_erase_collateral"


def test_r1_ring_reports_a_cover_that_is_too_small_on_a_scan(tmp_path):
    source, _pages, plan = _plan(tmp_path, _scanned(_toc_pdf(ROWS)), TRANSLATIONS)
    entry = _entry(plan, "Introduction to Things")
    rect = entry.covers[0]["rect"]
    entry.covers[0]["rect"] = [rect[0], rect[1] + 3, rect[2] - 20, rect[3] - 3]  # 盖少了：上下、右边露字
    doc, page = _fresh_page(source)
    with doc:
        report = page_ops.erase_and_check(page, plan.pages[0])
    assert report["summary"]["R1_ring_ink_strips"] >= 1 and report["failed"][entry.block_id] == "kept_erase_residual"


def test_r3_r5_r7_r8_report_bad_lines(tmp_path):
    source, _pages, plan = _plan(tmp_path, _toc_pdf(ROWS, dots="none"), TRANSLATIONS)
    methods = _entry(plan, "Methods")
    methods.lines[0].x = 340.0  # 压到页码上
    intro = _entry(plan, "Introduction to Things")
    intro.lines[0].text = "事物"  # 少了字
    intro.lines.append(copy.deepcopy(intro.lines[0]))  # 比原文多一行
    background = _entry(plan, "Background and motivation")
    background.lines[0].text = "背景 $x$"
    doc, page = _fresh_page(source)
    with doc:
        report = page_ops.erase_and_check(page, plan.pages[0])
    summary = report["summary"]
    assert summary["R3_overlap_chars"] >= 1 and report["failed"][methods.block_id] == "kept_overlap"
    assert summary["R5_too_many_lines"] == 1 and summary["R7_text_mismatch"] == 2 and summary["R8_markup"] == 1


def test_a_page_without_r0_title_lines_falls_back_to_reflow(tmp_path):
    source, document_path, pages = _job(tmp_path, _toc_pdf(ROWS), TRANSLATIONS)
    document = json.loads(document_path.read_text(encoding="utf-8"))
    for block in document["pages"][0]["blocks"]:
        block.get("metadata", {}).pop("toc_entry_title_lines", None)
    document_path.write_text(json.dumps(document), encoding="utf-8")
    for item in pages[0]:
        item["metadata"].pop("toc_entry_title_lines", None)
    plan = plan_toc_replace(pages, source_pdf_path=source, document_path=document_path, font_path=FONT)
    assert plan.pages == {} and plan.reflow_pages == {0: "no_title_lines"}
    assert plan.hold(pages) is pages


# ---- 小工具 ----

def test_title_translation_strips_numbers_labels_and_page_labels():
    assert title_translation("1.2 背景", number="1.2", label="", page_label="", source_title="Background") == "背景"
    assert title_translation("第 3 章 方法", number="3", label="", page_label="", source_title="Methods") == "方法"
    assert title_translation("Chapter 1: 引言", number="", label="Chapter 1", page_label="", source_title="Introduction") == "引言"
    assert title_translation("附录 A 数据", number="", label="Appendix A", page_label="", source_title="Data") == "数据"
    assert title_translation("引言 . . . . 15", number="", label="", page_label="15", source_title="Introduction") == "引言"
    # 原文标题自己以这个数结尾时不剪（「Part 15」这类）
    assert title_translation("第15部分 15", number="", label="", page_label="15", source_title="Part 15") == "第15部分 15"


def test_split_to_lines_fills_lines_in_order_and_keeps_punctuation_off_line_starts():
    font = fitz.Font(fontfile=str(FONT))
    one = font.text_length("字", fontsize=10)
    assert split_to_lines("一二三四", font, 10, [one * 4 + 0.1]) == ["一二三四"]
    assert split_to_lines("一二三四", font, 10, [one * 2 + 0.1, one * 2 + 0.1]) == ["一二", "三四"]
    # 「，」不放行首：连着前一个字一起挪
    assert split_to_lines("一二，三", font, 10, [one * 2 + 0.1, one * 3 + 0.1]) == ["一", "二，三"]
    assert split_to_lines("一二三四五", font, 10, [one * 2 + 0.1, one * 2 + 0.1]) is None


def test_cjk_latin_spacing_matches_the_engine_and_pdf_runs_follow_it(tmp_path):
    source, _pages, plan = _plan(tmp_path, _toc_pdf([("5.4", ["Slater Determinants"], "137")]), {"Slater Determinants": "5.4 Slater行列式"})
    line = plan.pages[0].entries[0].lines[0]
    xs = dict((ch, x) for x, ch in line.items)
    font = fitz.Font(fontfile=str(FONT))
    # 汉字和西文之间多 1/4 个字（引擎 add_cjk_latin_spacing）
    assert xs["行"] - (xs["r"] + font.text_length("r", fontsize=line.size)) == pytest.approx(0.25 * line.size, abs=0.01)
    runs = line_runs(line, font)
    assert [text for _x, text in runs] == ["Slater", "行列式"]
    out, _result = _apply(tmp_path, source, plan)
    with fitz.open(out) as doc:
        import unicodedata

        drawn = {unicodedata.normalize("NFKC", c.c): c.x0 for c in page_chars(doc[0])}
    assert drawn["行"] == pytest.approx(xs["行"], abs=0.05) and drawn["S"] == pytest.approx(xs["S"], abs=0.05)


# ---- 认上下文的 agent（R2，PR #252）写的字段 ----

def _plan_with_metadata(tmp_path, pdf, translations, patch):
    """拆完条目以后按 {原文标题: metadata 改动} 改 document 和译文条目里的 metadata（模拟 R2 写回 document.v1）。"""
    source, document_path, pages = _job(tmp_path, pdf, translations)
    document = json.loads(document_path.read_text(encoding="utf-8"))
    for block in document["pages"][0]["blocks"]:
        extra = patch(block["metadata"]) if block["structure_role"] == "toc_entry" else None
        if extra:
            block["metadata"].update(extra)
            next(i for i in pages[0] if i["item_id"] == block["block_id"])["metadata"].update(extra)
    document_path.write_text(json.dumps(document), encoding="utf-8")
    return source, plan_toc_replace(pages, source_pdf_path=source, document_path=document_path, font_path=FONT)


def test_keep_original_entries_are_neither_erased_nor_written(tmp_path):
    source, plan = _plan_with_metadata(
        tmp_path, _toc_pdf(ROWS), TRANSLATIONS,
        lambda md: {"toc_entry_keep_original": True, "toc_entry_keep_reason": "code_name"} if md["toc_entry_title"] == "Methods" else None,
    )
    methods = _entry(plan, "Methods")
    assert methods.status == "kept_original" and not methods.lines and not methods.probes
    assert _entry(plan, "Introduction to Things").status == "placed"  # 反例：别的条目照换
    out, _result = _apply(tmp_path, source, plan)
    text = _text(out)
    assert "Methods" in text and "方法" not in text and "事物导论" in text


def test_author_lines_stay_on_a_scan_and_the_cover_does_not_reach_them(tmp_path):
    """扫描件：作者行（R2 从标题里剔出去、记在 toc_entry_author_lines）不盖；作者行压进盖的框就算擦坏了别的东西（R2）。"""
    rows = [("1", ["Introduction to Things"], "1"), ("", ["Fred P. Piercy"], ""), ("2", ["Methods"], "11"), ("3", ["Results"], "20")]
    pdf = _scanned(_toc_pdf(rows))
    with fitz.open() as probe:
        probe.insert_pdf(pdf)
        author = next(fitz.Rect(c.x0, c.y0, c.x1, c.y1) for c in page_chars(probe[0]) if c.c == "F")
    author_box = [author.x0, author.y0, author.x0 + 70, author.y1]

    def patch(md):
        out = {"toc_entry_text_layer": "invisible"}
        if md["toc_entry_title"].startswith("Introduction"):
            out["toc_entry_author_lines"] = [{"bbox": author_box, "text": "Fred P. Piercy"}]
            out["toc_entry_title_lines"] = [md["toc_entry_title_lines"][0]]
        return out

    source, plan = _plan_with_metadata(tmp_path, pdf, {**TRANSLATIONS, "Results": "3 结果"}, patch)
    intro = _entry(plan, "Introduction to Things")
    assert plan.pages[0].mode == "scan" and author_box in intro.protected
    assert all(cover["rect"][3] <= author_box[1] for cover in intro.covers)
    out, result = _apply(tmp_path, source, plan)
    assert result["totals"]["R2_cover_hits"] == 0
    with fitz.open(out) as doc:
        assert page_ops.ink_ratio(doc[0], author_box) > 0.02  # 作者行还在图上
    # 反例：盖的框往下伸到作者行，R2 报出来
    intro.covers[0]["rect"][3] = author_box[3]
    doc, page = _fresh_page(source)
    with doc:
        report = page_ops.erase_and_check(page, plan.pages[0])
    assert report["summary"]["R2_cover_hits"] >= 1 and report["failed"][intro.block_id] == "kept_erase_collateral"


def test_text_layer_field_decides_scan_or_text(tmp_path):
    """R2 标了 invisible 就按扫描件盖底色，标了 visible 就按字擦（标的和看到的不一样时以标的为准）。"""
    _source, scan_plan = _plan_with_metadata(tmp_path, _toc_pdf(ROWS), TRANSLATIONS, lambda md: {"toc_entry_text_layer": "invisible"})
    assert scan_plan.pages[0].mode == "scan" and all(e.covers for e in scan_plan.pages[0].replaced())
    other = tmp_path / "visible"
    other.mkdir()
    _source, text_plan = _plan_with_metadata(other, _toc_pdf(ROWS), TRANSLATIONS, lambda md: {"toc_entry_text_layer": "visible"})
    assert text_plan.pages[0].mode == "text" and not any(e.covers for e in text_plan.pages[0].replaced())


def test_reflow_is_the_default_and_plans_nothing(monkeypatch):
    from retainpdf_pipeline.foundation.config import layout
    from retainpdf_pipeline.render.render_plan import _plan_toc_replace

    monkeypatch.setattr(layout, "TOC_MODE", layout.TOC_MODE_REFLOW)
    assert _plan_toc_replace(None, {}) == (None, "")
    layout.apply_layout_tuning(toc_mode="replace")
    assert layout.TOC_MODE == "replace"
    layout.apply_layout_tuning(toc_mode="whatever")
    assert layout.TOC_MODE == "reflow"


def test_reader_layout_gets_the_toc_blocks_the_erase_boxes_and_the_regular_face(tmp_path):
    """阅读页版面补上目录：块的字簇 font 填常规体（这几页引擎只画了粗体标题时补一项常规体，排在最前面），
    擦的框底色按原文页取。"""
    pytest.importorskip("fontTools")
    pytest.importorskip("brotli")
    import gzip

    from retainpdf_pipeline.render.output.rpr_fit.reader_layout import add_reader_layout_toc
    from retainpdf_pipeline.render.output.toc_replace.apply import reader_blocks

    source, _pages, plan = _plan(tmp_path, _toc_pdf(ROWS), TRANSLATIONS)
    layout_dir = tmp_path / "reader-layout"
    (layout_dir / "pages").mkdir(parents=True)
    page = {"index": 0, "width": 420, "height": 600, "covers": [], "blocks": [], "erase": [], "tables": []}
    (layout_dir / "pages/00000.json.gz").write_bytes(gzip.compress(json.dumps(page).encode("utf-8")))
    bold = {"key": "SourceHanSerifSC-Bold", "postscript": "SourceHanSerifSC-Bold", "family": "Source Han Serif SC", "weight": 700,
            "mono": False, "file": "fonts/SourceHanSerifSC-Bold.woff2", "source_file": "SourceHanSerifSC-Bold.otf"}
    manifest = {"schema": "reader_layout_v1", "layout_schema": "rpr_layout_v1", "features": ["erase", "tables"],
                "pages": [{"index": 0, "file": "pages/00000.json.gz"}], "background": None, "fonts": [bold]}
    (layout_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    entries = plan.pages[0].replaced()
    placements = [{"page_index": 0, "blocks": reader_blocks(entries),
                   "erase": [{"rect": rect, "fill": None} for entry in entries for rect in entry.title_rects]}]
    result = add_reader_layout_toc(output_pdf_path=tmp_path / "out.pdf", placements=placements, original_pdf_path=source,
                                   font_dirs=[FONT.parent], font_file=FONT)
    assert result["blocks"] == 3
    saved = json.loads((layout_dir / "manifest.json").read_text(encoding="utf-8"))
    regular_key = saved["fonts"][0]["key"]
    assert regular_key.startswith(("RetainPDFSerifSC-W", "SourceHanSerifSC-Regular")) and saved["fonts"][0]["weight"] == 400
    written = json.loads(gzip.decompress((layout_dir / "pages/00000.json.gz").read_bytes()))
    assert {block["id"] for block in written["blocks"]} == {entry.block_id for entry in entries}
    assert all(item["font"] == regular_key for block in written["blocks"] for line in block["lines"] for item in line["items"])
    assert len(written["erase"]) == 3 and all(min(paint["fill"]) > 0.99 for paint in written["erase"])
