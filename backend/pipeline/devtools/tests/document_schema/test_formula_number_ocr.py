"""扫描件的行间公式编号：截图识别（`ocr/document_schema/formula_number_ocr.py`）和补分隔符
（`formula_numbers.repair_formula_number_separators`），2026-11-26。

逻辑测试用假引擎：按 PDF 的点摆好几串「字」，检测时返回落在窄条里的字框，识别时返回字框里的字。
最后一个测试用真引擎（rapidocr 包里自带的模型）认一页「扫描件」：没装 rapidocr 就跳过，CI 上必须装着。
"""

from __future__ import annotations

import importlib.util
import os
import socket
from pathlib import Path

import fitz
import pytest

from retainpdf_pipeline.ocr.document_schema import formula_number_ocr
from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1_with_report
from retainpdf_pipeline.ocr.document_schema.finalize import finalize_normalized_document
from retainpdf_pipeline.ocr.document_schema.formula_number_ocr import EngineUnavailable
from retainpdf_pipeline.ocr.document_schema.formula_number_ocr import parse_ocr_number
from retainpdf_pipeline.ocr.document_schema.formula_numbers import repair_formula_number_separators
from retainpdf_pipeline.ocr.document_schema.validator import validate_document_payload

# GLM 的像素坐标 1200×1600 ↔ PDF 600×800 点（缩放 0.5）。公式块 [300, 300, 900, 380] 在 PDF 里是 x 150–450、y 150–190。
PAGE_W, PAGE_H = 1200, 1600
PDF_W, PDF_H = PAGE_W / 2, PAGE_H / 2
FORMULA = [300, 300, 900, 380]


def _glm(*blocks: dict) -> dict:
    return {
        "layout_details": [[{**block, "index": index} for index, block in enumerate(blocks)]],
        "data_info": {"pages": [{"width": PAGE_W, "height": PAGE_H}]},
    }


def _glm_block(label: str, bbox: list[int], content: str) -> dict:
    return {"native_label": label, "label": label, "bbox_2d": bbox, "content": content}


def _formula(bbox: list[int] = FORMULA, latex: str = "$$\na = b + c\n$$") -> dict:
    return _glm_block("display_formula", bbox, latex)


def _scanned_pdf(tmp_path: Path, *, text: str = "") -> Path:
    """一页「扫描件」：页上有墨（一块黑色），没有文字层；`text` 不空时另写一行字（那就有文字层了）。"""
    path = tmp_path / "source.pdf"
    with fitz.open() as pdf:
        page = pdf.new_page(width=PDF_W, height=PDF_H)
        page.draw_rect(fitz.Rect(20, 700, 60, 720), color=(0, 0, 0), fill=(0, 0, 0))
        if text:
            page.insert_text((40, 60), text, fontsize=10)
        pdf.save(path)
    return path


def _blank_pdf(tmp_path: Path) -> Path:
    path = tmp_path / "blank.pdf"
    with fitz.open() as pdf:
        pdf.new_page(width=PDF_W, height=PDF_H)
        pdf.save(path)
    return path


class FakeEngine:
    """按 PDF 的点摆好的「字」：(x0, y0, x1, y1, 文字)。"""

    def __init__(self, words: list[tuple[float, float, float, float, str]]) -> None:
        self.words = words
        self.detect_calls: list[tuple] = []
        self.recognize_calls: list[tuple] = []

    def _px(self, image, box) -> tuple[float, float, float, float]:
        scale = image.size[0] / PDF_W
        return tuple(value * scale for value in box)

    def detect(self, image, region):
        self.detect_calls.append(region)
        found = []
        for *box, _text in self.words:
            px = self._px(image, box)
            cx, cy = (px[0] + px[2]) / 2, (px[1] + px[3]) / 2
            if region[0] <= cx <= region[2] and region[1] <= cy <= region[3]:
                found.append(px)
        return found

    def recognize(self, image, region):
        self.recognize_calls.append(region)
        best, best_area = "", 0.0
        for *box, text in self.words:
            px = self._px(image, box)
            width = min(px[2], region[2]) - max(px[0], region[0])
            height = min(px[3], region[3]) - max(px[1], region[1])
            if width > 0 and height > 0 and width * height > best_area:
                best, best_area = text, width * height
        return best, (0.95 if best else 0.0)


@pytest.fixture
def use_engine(monkeypatch):
    def install(engine):
        monkeypatch.setattr(formula_number_ocr, "load_default_engine", lambda: engine)
        return engine

    monkeypatch.delenv(formula_number_ocr.ENV_SWITCH, raising=False)
    return install


def _finalize(payload: dict, pdf: Path) -> dict:
    document, report = adapt_payload_to_document_v1_with_report(
        payload=payload, provider="glm_ocr", document_id="eq", source_json_path=Path("glm_ocr_result.json")
    )
    document, report = finalize_normalized_document(document, report, pdf)
    validate_document_payload(document)
    assert report["formula_numbers"] == document["derived"]["formula_numbers"]
    return document


def _formulas(document: dict, page: int = 0) -> list[dict]:
    return [block for block in document["pages"][page]["blocks"] if block["content"]["kind"] == "formula"]


# ---- 截图识别（假引擎） ---------------------------------------------------------------------------------


def test_number_right_of_the_formula_on_a_scanned_page_is_read(tmp_path: Path, use_engine) -> None:
    engine = use_engine(FakeEngine([(520, 162, 556, 178, "(2.19)")]))
    document = _finalize(_glm(_formula()), _scanned_pdf(tmp_path))
    record = _formulas(document)[0]["content"]["formula_number"]
    assert record == {"text": "(2.19)", "label": "2.19", "source": "ocr_crop", "in_latex": False}
    summary = document["derived"]["formula_numbers"]
    assert summary["numbered"]["ocr_crop"] == 1
    assert summary["ocr_crop"] == {"pages": 1, "formulas": 1, "rejected": {}}
    # 窄条在公式右边、同一行（上下各放宽公式高度的 15%）
    region = engine.detect_calls[0]
    scale = 2000 / PDF_W
    assert region[0] == pytest.approx(450 * scale + 4)
    assert region[1] == pytest.approx(150 * scale - 0.15 * 40 * scale)
    assert region[3] == pytest.approx(190 * scale + 0.15 * 40 * scale)


def test_page_with_a_text_layer_is_left_to_the_text_layer_step(tmp_path: Path, use_engine) -> None:
    engine = use_engine(FakeEngine([(520, 162, 556, 178, "(2.19)")]))
    document = _finalize(_glm(_formula()), _scanned_pdf(tmp_path, text="Some running head"))
    assert "formula_number" not in _formulas(document)[0]["content"]
    assert engine.detect_calls == []
    assert "ocr_crop" not in document["derived"]["formula_numbers"]


def test_blank_page_loads_no_engine(tmp_path: Path, monkeypatch) -> None:
    def fail():
        raise AssertionError("engine must not be loaded for a blank page")

    monkeypatch.setattr(formula_number_ocr, "load_default_engine", fail)
    document = _finalize(_glm(_formula()), _blank_pdf(tmp_path))
    assert "formula_number" not in _formulas(document)[0]["content"]
    assert "ocr_crop" not in document["derived"]["formula_numbers"]


def test_only_formulas_without_a_number_are_read(tmp_path: Path, use_engine) -> None:
    engine = use_engine(FakeEngine([(520, 162, 556, 178, "(9)"), (520, 262, 556, 278, "(3)")]))
    payload = _glm(
        _formula(latex="$$\na = b \\tag{8}\n$$"),
        _formula(bbox=[300, 500, 900, 580]),
    )
    document = _finalize(payload, _scanned_pdf(tmp_path))
    tagged, plain = _formulas(document)
    assert (tagged["content"]["formula_number"]["source"], tagged["content"]["formula_number"]["label"]) == (
        "latex_tag",
        "8",
    )
    assert (plain["content"]["formula_number"]["source"], plain["content"]["formula_number"]["label"]) == (
        "ocr_crop",
        "3",
    )
    assert len(engine.detect_calls) == 1
    assert document["derived"]["formula_numbers"]["ocr_crop"]["formulas"] == 1


def test_nearest_box_next_to_more_text_is_not_taken(tmp_path: Path, use_engine) -> None:
    # 「(2) where x is …」：离公式最近的那串后面紧挨着别的字，是一行正文，不是编号。
    use_engine(FakeEngine([(470, 162, 486, 178, "(2)"), (490, 162, 580, 178, "where x is")]))
    document = _finalize(_glm(_formula()), _scanned_pdf(tmp_path))
    assert "formula_number" not in _formulas(document)[0]["content"]
    assert document["derived"]["formula_numbers"]["ocr_crop"]["rejected"] == {"crowded": 1}


def test_text_that_is_not_a_number_is_not_taken(tmp_path: Path, use_engine) -> None:
    use_engine(FakeEngine([(520, 162, 556, 178, "by Eq.")]))
    document = _finalize(_glm(_formula()), _scanned_pdf(tmp_path))
    assert "formula_number" not in _formulas(document)[0]["content"]
    assert document["derived"]["formula_numbers"]["ocr_crop"]["rejected"] == {"not_a_number": 1}


def test_number_inside_another_block_is_not_taken(tmp_path: Path, use_engine) -> None:
    # 右边同一行的「(5)」落在一段正文块里（右栏的段落开头）：不是这个公式的编号。
    use_engine(FakeEngine([(530, 162, 550, 178, "(5)")]))
    payload = _glm(
        _formula(),
        _glm_block("text", [1040, 320, 1180, 600], "(5) Some text continues in this block."),
    )
    document = _finalize(payload, _scanned_pdf(tmp_path))
    assert "formula_number" not in _formulas(document)[0]["content"]
    assert document["derived"]["formula_numbers"]["ocr_crop"]["rejected"] == {"other_block": 1}


def test_two_formulas_reading_the_same_number_both_give_it_up(tmp_path: Path, use_engine) -> None:
    # 两行公式（OCR 框成两块），编号在两行中间：两块都截到同一串字，都不收。
    use_engine(FakeEngine([(520, 176, 556, 192, "(4)")]))
    payload = _glm(_formula(bbox=[300, 300, 900, 368]), _formula(bbox=[300, 372, 900, 440]))
    document = _finalize(payload, _scanned_pdf(tmp_path))
    assert all("formula_number" not in formula["content"] for formula in _formulas(document))
    assert document["derived"]["formula_numbers"]["ocr_crop"]["rejected"] == {"contested": 2}


def test_left_number_is_read_only_when_the_right_side_is_empty(tmp_path: Path, use_engine) -> None:
    use_engine(FakeEngine([(60, 162, 96, 178, "(A.1)")]))
    document = _finalize(_glm(_formula()), _scanned_pdf(tmp_path))
    record = _formulas(document)[0]["content"]["formula_number"]
    assert (record["text"], record["label"], record["source"]) == ("(A.1)", "A.1", "ocr_crop")


def test_left_list_marker_is_not_read_when_the_right_side_has_text(tmp_path: Path, use_engine) -> None:
    # 右边同一行还有字（OCR 只框了半行）：左边的 (1) 是列表序号，不看。
    engine = use_engine(FakeEngine([(60, 162, 80, 178, "(1)"), (500, 162, 580, 178, "c = d")]))
    document = _finalize(_glm(_formula()), _scanned_pdf(tmp_path))
    assert "formula_number" not in _formulas(document)[0]["content"]
    assert len(engine.detect_calls) == 1


def test_unavailable_engine_is_skipped_and_recorded(tmp_path: Path, monkeypatch) -> None:
    calls = []

    def unavailable():
        calls.append(1)
        raise EngineUnavailable("ocr_engine_unavailable", "No module named 'rapidocr'")

    monkeypatch.setattr(formula_number_ocr, "load_default_engine", unavailable)
    monkeypatch.delenv(formula_number_ocr.ENV_SWITCH, raising=False)
    payload = _glm(_formula(), _formula(bbox=[300, 500, 900, 580]))
    document = _finalize(payload, _scanned_pdf(tmp_path))
    assert all("formula_number" not in formula["content"] for formula in _formulas(document))
    assert document["derived"]["formula_numbers"]["ocr_crop"] == {
        "pages": 1,
        "formulas": 2,
        "rejected": {},
        "skipped": "ocr_engine_unavailable",
    }
    assert document["derived"]["formula_numbers"]["numbered"]["ocr_crop"] == 0
    assert calls == [1]


def test_switch_turns_the_step_off(tmp_path: Path, use_engine, monkeypatch) -> None:
    engine = use_engine(FakeEngine([(520, 162, 556, 178, "(2.19)")]))
    monkeypatch.setenv(formula_number_ocr.ENV_SWITCH, "0")
    document = _finalize(_glm(_formula()), _scanned_pdf(tmp_path))
    assert "formula_number" not in _formulas(document)[0]["content"]
    assert document["derived"]["formula_numbers"]["ocr_crop"]["skipped"] == "disabled"
    assert engine.detect_calls == []


def test_missing_dot_is_restored_from_the_neighbours_on_the_page(tmp_path: Path, use_engine) -> None:
    use_engine(
        FakeEngine(
            [
                (520, 162, 556, 178, "(5.6)"),
                (520, 262, 556, 278, "(5 7)"),
                (520, 362, 556, 378, "(5.8)"),
            ]
        )
    )
    payload = _glm(_formula(), _formula(bbox=[300, 500, 900, 580]), _formula(bbox=[300, 700, 900, 780]))
    document = _finalize(payload, _scanned_pdf(tmp_path))
    middle = _formulas(document)[1]["content"]["formula_number"]
    assert middle == {
        "text": "(5.7)",
        "label": "5.7",
        "source": "ocr_crop",
        "in_latex": False,
        "repaired": True,
        "repaired_from": "(5 7)",
    }
    summary = document["derived"]["formula_numbers"]
    assert summary["repaired"] == 1
    assert summary["numbered"]["ocr_crop"] == 3


def test_ocr_number_parsing() -> None:
    assert parse_ocr_number("(1.2)") == ("(1.2)", "1.2")
    assert parse_ocr_number("(1.3a)") == ("(1.3a)", "1.3a")
    assert parse_ocr_number("(A.1)") == ("(A.1)", "A.1")
    assert parse_ocr_number("(5-37)") == ("(5-37)", "5-37")
    assert parse_ocr_number("（3.4）") == ("（3.4）", "3.4")
    assert parse_ocr_number("(5·7)") == ("(5.7)", "5.7")
    assert parse_ocr_number("( 5. 7 )") == ("(5.7)", "5.7")
    assert parse_ocr_number("(57)") == ("(57)", "57")
    # 点没认出来：先记着，补不上就去掉
    assert parse_ocr_number("(5 20)") == ("(5 20)", "5 20")
    assert parse_ocr_number("(5,20)") == ("(5 20)", "5 20")
    for text in ("5.7", "[4]", "(a)", "(i)", "(x+y)", "(5.7", "by Eq. (5.7)", "(5.7) where", ""):
        assert parse_ocr_number(text) is None, text


# ---- 补分隔符 -----------------------------------------------------------------------------------------


def _numbered(*items: tuple[str, str]) -> dict:
    """一页上按阅读顺序排的公式，每个带一个编号 (标签, 来源)。"""
    blocks = []
    counts: dict[str, int] = {}
    for index, (label, source) in enumerate(items):
        counts[source] = counts.get(source, 0) + 1
        blocks.append(
            {
                "block_id": f"p001-b{index:04d}",
                "reading_order": index,
                "content": {
                    "kind": "formula",
                    "text": "x",
                    "formula_number": {"text": f"({label})", "label": label, "source": source, "in_latex": False},
                },
            }
        )
    return {"pages": [{"blocks": blocks}], "derived": {"formula_numbers": {"numbered": counts, "repaired": 0}}}


def _labels(document: dict) -> list[str | None]:
    return [
        (block["content"].get("formula_number") or {}).get("label") for block in document["pages"][0]["blocks"]
    ]


def test_repair_restores_a_run_of_missing_dots() -> None:
    document = _numbered(
        ("5.6", "ocr_crop"),
        ("57", "ocr_crop"),
        ("5 8", "ocr_crop"),
        ("59", "ocr_crop"),
        ("510", "ocr_crop"),
        ("5.11", "ocr_crop"),
    )
    assert repair_formula_number_separators(document) == (4, 0)
    assert _labels(document) == ["5.6", "5.7", "5.8", "5.9", "5.10", "5.11"]
    record = document["pages"][0]["blocks"][4]["content"]["formula_number"]
    assert (record["text"], record["repaired"], record["repaired_from"]) == ("(5.10)", True, "(510)")
    assert document["derived"]["formula_numbers"]["repaired"] == 4


def test_repair_follows_letters_and_chapter_starts() -> None:
    document = _numbered(
        ("6.46a", "ocr_crop"),
        ("646b", "ocr_crop"),
        ("6.47", "ocr_crop"),
        ("6.54", "ocr_crop"),
        ("71", "ocr_crop"),
        ("7.2", "ocr_crop"),
    )
    assert repair_formula_number_separators(document) == (2, 0)
    assert _labels(document) == ["6.46a", "6.46b", "6.47", "6.54", "7.1", "7.2"]


def test_repair_keeps_the_separator_of_the_neighbours() -> None:
    document = _numbered(("5-36", "ocr_crop"), ("537", "ocr_crop"), ("5-38", "ocr_crop"))
    repair_formula_number_separators(document)
    assert _labels(document) == ["5-36", "5-37", "5-38"]


def test_number_that_does_not_fit_is_dropped_only_for_ocr_crop() -> None:
    # 5.6、(58)、5.9：接不上（中间少了 5.7），夹在同一章里，截图识别的去掉；编号块读出来的照原样留着。
    document = _numbered(("5.6", "ocr_crop"), ("58", "ocr_crop"), ("5.9", "ocr_crop"))
    assert repair_formula_number_separators(document) == (0, 1)
    assert _labels(document) == ["5.6", None, "5.9"]
    summary = document["derived"]["formula_numbers"]
    assert summary["numbered"]["ocr_crop"] == 2
    assert summary["ocr_crop"]["rejected"]["unrepaired"] == 1

    document = _numbered(("5.6", "layout_block"), ("58", "layout_block"), ("5.9", "layout_block"))
    assert repair_formula_number_separators(document) == (0, 0)
    assert _labels(document) == ["5.6", "58", "5.9"]


def test_spaced_number_without_neighbours_is_dropped() -> None:
    document = _numbered(("5 20", "ocr_crop"))
    assert repair_formula_number_separators(document) == (0, 1)
    assert _labels(document) == [None]


def test_plain_numbering_is_left_alone() -> None:
    document = _numbered(("11", "ocr_crop"), ("12", "ocr_crop"), ("13", "layout_block"))
    assert repair_formula_number_separators(document) == (0, 0)
    assert _labels(document) == ["11", "12", "13"]


def test_text_layer_numbers_are_never_rewritten() -> None:
    document = _numbered(("5.6", "pdf_text_layer"), ("57", "pdf_text_layer"), ("5.8", "pdf_text_layer"))
    assert repair_formula_number_separators(document) == (0, 0)
    assert _labels(document) == ["5.6", "57", "5.8"]


def test_repair_is_idempotent() -> None:
    document = _numbered(("5.6", "ocr_crop"), ("57", "ocr_crop"), ("5.8", "ocr_crop"))
    repair_formula_number_separators(document)
    assert repair_formula_number_separators(document) == (0, 0)
    assert document["derived"]["formula_numbers"]["repaired"] == 1


# ---- 真引擎 -------------------------------------------------------------------------------------------


def _engine_installed() -> bool:
    return importlib.util.find_spec("rapidocr") is not None and importlib.util.find_spec("onnxruntime") is not None


def test_real_engine_reads_a_number_on_a_scanned_page(tmp_path: Path, monkeypatch) -> None:
    if not _engine_installed():
        # CI 用 `uv sync --all-extras` 装后端工作区，工作区依赖 retainpdf-pipeline[scan-ocr]：那里必须装着，不能悄悄跳过。
        if os.environ.get("CI"):
            pytest.fail("rapidocr / onnxruntime are not installed (backend workspace depends on retainpdf-pipeline[scan-ocr])")
        pytest.skip("rapidocr / onnxruntime not installed")
    # 先造一页有字的 PDF、渲染成图，再把图贴进一页新的 PDF：这一页没有文字层，就是「扫描件」。
    with fitz.open() as source:
        page = source.new_page(width=PDF_W, height=PDF_H)
        page.insert_text((160, 176), "E = m c + k", fontsize=14)
        page.insert_text((515, 176), "(2.19)", fontsize=12)
        pixmap = page.get_pixmap(dpi=200)
    path = tmp_path / "scan.pdf"
    with fitz.open() as pdf:
        page = pdf.new_page(width=PDF_W, height=PDF_H)
        page.insert_image(page.rect, pixmap=pixmap)
        assert not page.get_text("words")
        pdf.save(path)

    # 模型只用包里自带的：不许联网。
    def refuse(*_args, **_kwargs):
        raise AssertionError("the formula number OCR must not touch the network")

    monkeypatch.setattr(socket.socket, "connect", refuse)
    monkeypatch.setattr(formula_number_ocr, "_ENGINE_CACHE", {})
    monkeypatch.delenv(formula_number_ocr.ENV_SWITCH, raising=False)
    document = _finalize(_glm(_formula()), path)
    record = _formulas(document)[0]["content"]["formula_number"]
    assert record == {"text": "(2.19)", "label": "2.19", "source": "ocr_crop", "in_latex": False}
    assert document["derived"]["formula_numbers"]["ocr_crop"] == {"pages": 1, "formulas": 1, "rejected": {}}
