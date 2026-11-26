"""行间公式编号挂到公式块上（`ocr/document_schema/formula_numbers.py`，2026-11-26）。

三个来源：编号块按几何配（Paddle、MinerU 的 `formula_number`）、LaTeX 里的 `\\tag`（GLM-OCR）、原文 PDF 文字层兜底。
样例都是人造的最小数据：坐标、编号是我们自己定的。
"""

from __future__ import annotations

from pathlib import Path

import fitz
import pytest

from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1_with_report
from retainpdf_pipeline.ocr.document_schema.finalize import finalize_normalized_document
from retainpdf_pipeline.ocr.document_schema.formula_numbers import attach_formula_numbers
from retainpdf_pipeline.ocr.document_schema.formula_numbers import is_formula_number_block
from retainpdf_pipeline.ocr.document_schema.formula_numbers import latex_tag_number
from retainpdf_pipeline.ocr.document_schema.formula_numbers import parse_number_text
from retainpdf_pipeline.ocr.document_schema.validator import DocumentSchemaValidationError
from retainpdf_pipeline.ocr.document_schema.validator import validate_document_payload

PAGE_W, PAGE_H = 1200, 1600


def _paddle(*pages: list[dict]) -> dict:
    return {
        "layoutParsingResults": [
            {
                "prunedResult": {"width": PAGE_W, "height": PAGE_H, "parsing_res_list": list(blocks)},
                "markdown": {"text": "", "images": {}},
            }
            for blocks in pages
        ],
        "dataInfo": {"pages": [{"width": PAGE_W, "height": PAGE_H} for _ in pages], "type": "paddle"},
    }


def _block(label: str, bbox: list[int], content: str) -> dict:
    return {"block_label": label, "block_bbox": bbox, "block_content": content}


def _formula(bbox: list[int], latex: str = "a = b + c") -> dict:
    return _block("display_formula", bbox, latex)


def _number(bbox: list[int], text: str) -> dict:
    return _block("formula_number", bbox, text)


def _text(bbox: list[int], text: str = "Body text of the paragraph.") -> dict:
    return _block("text", bbox, text)


def _normalize(payload: dict, provider: str = "paddle") -> tuple[dict, dict]:
    document, report = adapt_payload_to_document_v1_with_report(
        payload=payload, provider=provider, document_id="eq", source_json_path=Path("result.json")
    )
    validate_document_payload(document)
    return document, report


def _blocks(document: dict, page: int = 0) -> list[dict]:
    return document["pages"][page]["blocks"]


def _by_text(document: dict, text: str, page: int = 0) -> dict:
    return next(block for block in _blocks(document, page) if block["text"] == text)


def _formulas(document: dict, page: int = 0) -> list[dict]:
    return [block for block in _blocks(document, page) if block["content"]["kind"] == "formula"]


# ---- 编号块按几何配 -------------------------------------------------------------------------------


def test_number_block_on_the_right_is_attached_both_ways() -> None:
    document, report = _normalize(
        _paddle(
            [
                _text([100, 200, 1100, 300]),
                _formula([400, 320, 800, 380], "E = m c^{2}"),
                _number([1020, 335, 1100, 365], "(2.19)"),
                _text([100, 400, 1100, 500]),
            ]
        )
    )
    formula = _formulas(document)[0]
    number = _by_text(document, "(2.19)")
    assert formula["content"]["formula_number"] == {
        "text": "(2.19)",
        "label": "2.19",
        "source": "layout_block",
        "in_latex": False,
        "block_id": number["block_id"],
    }
    assert number["content"]["number_of_block_id"] == formula["block_id"]
    assert number["content"]["related_block_ids"] == [formula["block_id"]]
    # 公式原文不动，编号块照旧是不翻译的 metadata。
    assert formula["text"] == "E = m c^{2}"
    assert number["block_class"] == "metadata"
    assert number["structure_role"] == "formula_number"
    assert number["policy"]["translate"] is False
    summary = document["derived"]["formula_numbers"]
    assert summary["numbered"] == {"layout_block": 1, "latex_tag": 0, "pdf_text_layer": 0, "ocr_crop": 0}
    assert summary["unpaired_number_blocks"] == {}
    assert report["formula_numbers"] == summary


def test_number_block_on_the_left_is_attached() -> None:
    document, _ = _normalize(_paddle([_number([100, 335, 170, 365], "(3a)"), _formula([400, 320, 800, 380])]))
    record = _formulas(document)[0]["content"]["formula_number"]
    assert (record["text"], record["label"], record["source"]) == ("(3a)", "3a", "layout_block")


def test_each_number_goes_to_the_formula_on_its_own_row() -> None:
    # 上下挨着的两个公式：下面那个更宽（横向离编号更近），编号照样跟同一行的那个。
    document, _ = _normalize(
        _paddle(
            [
                _formula([500, 300, 700, 340], "a = b"),
                _number([1020, 305, 1100, 335], "(1)"),
                _formula([300, 350, 950, 450], "c = d"),
                _number([1020, 385, 1100, 415], "(2)"),
            ]
        )
    )
    labels = {block["text"]: block["content"]["formula_number"]["label"] for block in _formulas(document)}
    assert labels == {"a = b": "1", "c = d": "2"}


def test_a_number_between_two_formulas_is_left_unpaired() -> None:
    # 两个公式一样高、编号正好夹在中间：差不多近，宁可不配。
    document, _ = _normalize(
        _paddle(
            [
                _formula([400, 300, 800, 340], "a = b"),
                _number([1020, 333, 1100, 357], "(1)"),
                _formula([400, 350, 800, 390], "c = d"),
            ]
        )
    )
    assert all("formula_number" not in block["content"] for block in _formulas(document))
    number = _by_text(document, "(1)")
    assert "number_of_block_id" not in number["content"]
    assert document["derived"]["formula_numbers"]["unpaired_number_blocks"] == {"ambiguous": 1}


def test_two_numbers_on_one_multi_line_formula_are_both_left_unpaired() -> None:
    # 一个公式块框了两行、每行一个编号：一个公式最多一个编号，不挑。
    document, _ = _normalize(
        _paddle(
            [
                _formula([400, 300, 800, 420], "a = b \\\\ c = d"),
                _number([1020, 310, 1100, 340], "(1)"),
                _number([1020, 380, 1100, 410], "(2)"),
            ]
        )
    )
    assert "formula_number" not in _formulas(document)[0]["content"]
    assert document["derived"]["formula_numbers"]["unpaired_number_blocks"] == {"formula_contested": 2}


def test_two_columns_never_pair_across_the_gutter() -> None:
    # 左栏的编号贴着栏右边，右栏的公式就在它右边同一行（编号在右栏公式的左侧），照样配给左栏的公式。
    document, _ = _normalize(
        _paddle(
            [
                _text([80, 100, 580, 300]),
                _formula([150, 320, 400, 380], "a = b"),
                _number([520, 335, 580, 365], "(1)"),
                _text([80, 400, 580, 600]),
                _text([620, 100, 1120, 300]),
                _formula([640, 320, 980, 380], "c = d"),
                _number([1060, 335, 1120, 365], "(2)"),
                _text([620, 400, 1120, 600]),
            ]
        )
    )
    labels = {block["text"]: block["content"]["formula_number"]["label"] for block in _formulas(document)}
    assert labels == {"a = b": "1", "c = d": "2"}


def test_right_column_formula_does_not_take_a_number_from_the_left_column() -> None:
    # 左栏的公式没配上（这里干脆没有），右栏的公式在编号右边：中间是栏缝，也不配。
    document, _ = _normalize(
        _paddle(
            [
                _text([80, 100, 580, 300]),
                _number([520, 335, 580, 365], "(1)"),
                _text([80, 400, 580, 600]),
                _text([620, 100, 1120, 300]),
                _formula([640, 320, 980, 380], "c = d"),
                _text([620, 400, 1120, 600]),
            ]
        )
    )
    assert "formula_number" not in _formulas(document)[0]["content"]
    assert document["derived"]["formula_numbers"]["unpaired_number_blocks"] == {"no_candidate": 1}


def test_number_on_the_next_page_is_not_paired() -> None:
    document, _ = _normalize(
        _paddle(
            [_text([100, 1300, 1100, 1450]), _formula([400, 1480, 800, 1580], "a = b")],
            [_number([1020, 30, 1100, 60], "(4)"), _text([100, 100, 1100, 300])],
        )
    )
    assert "formula_number" not in _formulas(document)[0]["content"]
    assert "number_of_block_id" not in _by_text(document, "(4)", page=1)["content"]
    assert document["derived"]["formula_numbers"]["unpaired_number_blocks"] == {"no_candidate": 1}


def test_formula_without_any_number_is_left_alone() -> None:
    document, _ = _normalize(_paddle([_text([100, 200, 1100, 300]), _formula([400, 320, 800, 380])]))
    assert "formula_number" not in _formulas(document)[0]["content"]
    assert document["derived"]["formula_numbers"] == {
        "formula_count": 1,
        "numbered": {"layout_block": 0, "latex_tag": 0, "pdf_text_layer": 0, "ocr_crop": 0},
        "number_block_count": 0,
        "unpaired_number_blocks": {},
        "repaired": 0,
    }


def test_document_without_formulas_gets_no_summary() -> None:
    document, report = _normalize(_paddle([_text([100, 200, 1100, 300])]))
    assert "formula_numbers" not in document["derived"]
    assert "formula_numbers" not in report


def test_number_block_that_is_not_a_number_is_not_paired() -> None:
    # Paddle 偶尔把公式旁边的批注（"by Eq. 1.2"）也标成编号。
    document, _ = _normalize(_paddle([_formula([400, 320, 800, 380]), _number([900, 335, 1100, 365], "by Eq. 1.2")]))
    assert "formula_number" not in _formulas(document)[0]["content"]
    assert document["derived"]["formula_numbers"]["unpaired_number_blocks"] == {"not_a_number": 1}


def test_number_block_wins_over_latex_tag_and_in_latex_says_so() -> None:
    document, _ = _normalize(
        _paddle([_formula([400, 320, 800, 380], "a = b \\tag{7}"), _number([1020, 335, 1100, 365], "(7)")])
    )
    formula = _formulas(document)[0]
    record = formula["content"]["formula_number"]
    assert (record["source"], record["label"], record["in_latex"]) == ("layout_block", "7", True)
    assert formula["text"] == "a = b \\tag{7}"


def test_pairing_twice_changes_nothing() -> None:
    document, _ = _normalize(_paddle([_formula([400, 320, 800, 380]), _number([1020, 335, 1100, 365], "(1)")]))
    before = repr(document)
    attach_formula_numbers(document)
    assert repr(document) == before


def test_mineru_formula_number_blocks_are_recognised_by_raw_label() -> None:
    # MinerU 把编号归成 metadata（structure_role 不是 formula_number），原始标签在 provenance 里。
    block = {"structure_role": "metadata", "provenance": {"raw_label": "formula_number"}, "content": {"kind": "text"}}
    assert is_formula_number_block(block)


# ---- LaTeX 的 \tag（GLM-OCR） -----------------------------------------------------------------------


def _glm(*blocks: dict) -> dict:
    return {
        "layout_details": [[{**block, "index": index} for index, block in enumerate(blocks)]],
        "data_info": {"pages": [{"width": PAGE_W, "height": PAGE_H}]},
    }


def _glm_block(label: str, bbox: list[int], content: str) -> dict:
    return {"native_label": label, "label": label, "bbox_2d": bbox, "content": content}


def test_glm_tag_is_read_from_latex_and_latex_is_kept() -> None:
    latex = "$$\nD = D_{0} e^{-E/kT} \\tag{2.19}\n$$"
    document, _ = _normalize(_glm(_glm_block("display_formula", [300, 300, 900, 380], latex)), provider="glm_ocr")
    formula = _formulas(document)[0]
    assert formula["content"]["formula_number"] == {
        "text": "(2.19)",
        "label": "2.19",
        "source": "latex_tag",
        "in_latex": True,
    }
    assert formula["text"] == latex
    assert document["derived"]["formula_numbers"]["numbered"]["latex_tag"] == 1


def test_glm_tag_star_keeps_its_own_brackets() -> None:
    document, _ = _normalize(
        _glm(_glm_block("display_formula", [300, 300, 900, 380], "$$\na = b \\tag*{(A.1)}\n$$")), provider="glm_ocr"
    )
    record = _formulas(document)[0]["content"]["formula_number"]
    assert (record["text"], record["label"], record["source"]) == ("(A.1)", "A.1", "latex_tag")


def test_latex_tag_parsing() -> None:
    assert latex_tag_number(r"a \tag{3}") == ("(3)", "3")
    assert latex_tag_number(r"a \tag*{[4]}") == ("[4]", "4")
    assert latex_tag_number(r"a \tag*{eq. 5}") == ("eq. 5", "eq. 5")
    # 几个不同的 \tag（多行公式每行一个）：不知道给哪个，不取。
    assert latex_tag_number(r"a \tag{1} \\ b \tag{2}") is None
    assert latex_tag_number(r"a = b") is None


def test_number_text_parsing() -> None:
    assert parse_number_text("(2.19)") == ("(2.19)", "2.19")
    assert parse_number_text("（3）") == ("（3）", "3")
    assert parse_number_text("$(1)$") == ("(1)", "1")
    assert parse_number_text("(A.1)") == ("(A.1)", "A.1")
    assert parse_number_text("(1") is None
    assert parse_number_text("by Eq. 1.2") is None
    # 文字层兜底更严：要圆括号、要数字。
    assert parse_number_text("[4]", strict=True) is None
    assert parse_number_text("(a)", strict=True) is None
    assert parse_number_text("(3a)", strict=True) == ("(3a)", "3a")


# ---- 原文 PDF 文字层兜底 ---------------------------------------------------------------------------

# 像素坐标 1200×1600 ↔ PDF 600×800 点（缩放 0.5）


def _pdf(tmp_path: Path, texts: list[tuple[float, float, str]]) -> Path:
    path = tmp_path / "source.pdf"
    with fitz.open() as pdf:
        page = pdf.new_page(width=PAGE_W / 2, height=PAGE_H / 2)
        for x, y, text in texts:
            page.insert_text((x, y), text, fontsize=10)
        pdf.save(path)
    return path


def _finalize(payload: dict, pdf: Path) -> dict:
    document, report = adapt_payload_to_document_v1_with_report(
        payload=payload, provider="glm_ocr", document_id="eq", source_json_path=Path("glm_ocr_result.json")
    )
    document, report = finalize_normalized_document(document, report, pdf)
    validate_document_payload(document)
    assert report["formula_numbers"] == document["derived"]["formula_numbers"]
    return document


def test_text_layer_number_right_of_the_formula_is_used(tmp_path: Path) -> None:
    # 公式在 PDF 里 x 150–450、y 150–190；编号「(5)」印在右边同一行（基线 174）。
    pdf = _pdf(tmp_path, [(160, 174, "a = b + c"), (530, 174, "(5)")])
    document = _finalize(_glm(_glm_block("display_formula", [300, 300, 900, 380], "$$\na = b + c\n$$")), pdf)
    record = _formulas(document)[0]["content"]["formula_number"]
    assert record == {"text": "(5)", "label": "5", "source": "pdf_text_layer", "in_latex": False}
    assert document["derived"]["formula_numbers"]["numbered"]["pdf_text_layer"] == 1


def test_text_layer_number_left_of_the_formula_is_used(tmp_path: Path) -> None:
    pdf = _pdf(tmp_path, [(40, 174, "(D.1)"), (160, 174, "a = b + c")])
    document = _finalize(_glm(_glm_block("display_formula", [300, 300, 900, 380], "$$\na = b + c\n$$")), pdf)
    record = _formulas(document)[0]["content"]["formula_number"]
    assert (record["text"], record["label"], record["source"]) == ("(D.1)", "D.1", "pdf_text_layer")


def test_left_list_marker_with_more_on_the_same_line_is_not_a_number(tmp_path: Path) -> None:
    # 「(1) 公式 ; 另一段公式」：OCR 只把中间那段框成公式，左边的 (1) 是列表序号。
    pdf = _pdf(tmp_path, [(40, 174, "(1)"), (160, 174, "a = b ;"), (480, 174, "c = d")])
    document = _finalize(_glm(_glm_block("display_formula", [300, 300, 900, 380], "$$\na = b\n$$")), pdf)
    assert "formula_number" not in _formulas(document)[0]["content"]


def test_text_layer_is_not_used_for_a_scanned_page(tmp_path: Path) -> None:
    pdf = _pdf(tmp_path, [])
    document = _finalize(_glm(_glm_block("display_formula", [300, 300, 900, 380], "$$\na = b\n$$")), pdf)
    assert "formula_number" not in _formulas(document)[0]["content"]


def test_text_layer_number_inside_another_block_is_not_used(tmp_path: Path) -> None:
    # 右边同一行的「(5)」是一段正文的开头（落在正文块里）：不是编号。
    pdf = _pdf(tmp_path, [(530, 174, "(5)")])
    payload = _glm(
        _glm_block("display_formula", [300, 300, 900, 380], "$$\na = b\n$$"),
        _glm_block("text", [1040, 320, 1180, 600], "(5) Some text continues in this block."),
    )
    document = _finalize(payload, pdf)
    assert "formula_number" not in _formulas(document)[0]["content"]


def test_text_layer_does_not_override_a_latex_tag(tmp_path: Path) -> None:
    pdf = _pdf(tmp_path, [(530, 174, "(9)")])
    document = _finalize(_glm(_glm_block("display_formula", [300, 300, 900, 380], "$$\na = b \\tag{8}\n$$")), pdf)
    record = _formulas(document)[0]["content"]["formula_number"]
    assert (record["source"], record["label"]) == ("latex_tag", "8")


# ---- 校验 -----------------------------------------------------------------------------------------


def test_validator_rejects_a_broken_formula_number() -> None:
    document, _ = _normalize(_paddle([_formula([400, 320, 800, 380]), _number([1020, 335, 1100, 365], "(1)")]))
    formula = _formulas(document)[0]
    number = _by_text(document, "(1)")

    formula["content"]["formula_number"]["source"] = "guess"
    with pytest.raises(DocumentSchemaValidationError, match="formula number source"):
        validate_document_payload(document)
    formula["content"]["formula_number"]["source"] = "layout_block"

    # 两边要互相指着
    number["content"]["number_of_block_id"] = "p001-b9999"
    with pytest.raises(DocumentSchemaValidationError, match="point back"):
        validate_document_payload(document)
    number["content"]["number_of_block_id"] = formula["block_id"]

    # 编号只挂在公式块上
    number["content"]["formula_number"] = dict(formula["content"]["formula_number"])
    with pytest.raises(DocumentSchemaValidationError, match="only formula blocks"):
        validate_document_payload(document)
