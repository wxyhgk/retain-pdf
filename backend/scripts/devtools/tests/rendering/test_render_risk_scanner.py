from __future__ import annotations

import sys
from pathlib import Path

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.analysis.risk.report import default_render_risk_report_path
from services.rendering.analysis.risk.scanner import scan_render_risk


def _pdf(path: Path, *, width: float = 200.0, height: float = 300.0) -> Path:
    doc = fitz.open()
    doc.new_page(width=width, height=height)
    doc.save(path)
    doc.close()
    return path


def _text_item(item_id: str, bbox: list[float], text: str) -> dict:
    return {
        "item_id": item_id,
        "page_idx": 0,
        "bbox": bbox,
        "block_kind": "text",
        "block_type": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "source_text": "source text for body paragraph",
        "protected_source_text": "source text for body paragraph",
        "protected_translated_text": text,
        "translated_text": text,
    }


def test_render_risk_scanner_keeps_simple_page_low_risk(tmp_path: Path) -> None:
    source_pdf = _pdf(tmp_path / "source.pdf")
    report = scan_render_risk(
        source_pdf_path=source_pdf,
        translated_pages={0: [_text_item("p001-b001", [20.0, 30.0, 180.0, 80.0], "简单中文段落。")]},
    )

    page = report.pages[0]
    assert page.risk_level == "low"
    assert page.suggested_action == "overlay"
    assert not page.hard_triggers


def test_render_risk_scanner_flags_height_overflow_hard(tmp_path: Path) -> None:
    source_pdf = _pdf(tmp_path / "source.pdf")
    long_text = "这是一段很长的中文译文。" * 18
    report = scan_render_risk(
        source_pdf_path=source_pdf,
        translated_pages={0: [_text_item("p001-b002", [20.0, 30.0, 120.0, 44.0], long_text)]},
    )

    page = report.pages[0]
    assert page.risk_level == "extreme"
    assert page.suggested_action == "full_rebuild"
    assert "text_height_overflow" in page.hard_triggers


def test_render_risk_scanner_flags_text_formula_overlap(tmp_path: Path) -> None:
    source_pdf = _pdf(tmp_path / "source.pdf")
    text = _text_item("p001-b003", [20.0, 30.0, 120.0, 45.0], "译文内容" * 12)
    formula = {
        "item_id": "p001-b004",
        "page_idx": 0,
        "bbox": [20.0, 48.0, 120.0, 66.0],
        "block_kind": "formula",
        "block_type": "formula",
        "protected_source_text": "$x^2$",
        "protected_translated_text": "",
    }
    report = scan_render_risk(
        source_pdf_path=source_pdf,
        translated_pages={0: [text, formula]},
    )

    page = report.pages[0]
    assert "text_formula_overlap" in page.hard_triggers
    assert page.suggested_action == "full_rebuild"


def test_render_risk_report_path_uses_artifacts_sibling_for_job_output(tmp_path: Path) -> None:
    output_pdf = tmp_path / "job-1" / "rendered" / "translated.pdf"
    assert default_render_risk_report_path(output_pdf) == tmp_path / "job-1" / "artifacts" / "render-risk-report.json"
