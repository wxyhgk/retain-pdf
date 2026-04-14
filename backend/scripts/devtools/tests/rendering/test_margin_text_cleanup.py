from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.redaction.margin_text_cleanup import cleanup_margin_text_blocks


def test_cleanup_margin_text_blocks_removes_header_and_footer_only() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        pdf_path = root / "sample.pdf"

        doc = fitz.open()
        page = doc.new_page(width=300, height=400)
        page.insert_text((20, 30), "HEADER TEXT")
        page.insert_text((20, 200), "BODY TEXT")
        page.insert_text((20, 390), "FOOTER TEXT")
        doc.save(pdf_path)
        doc.close()

        doc = fitz.open(pdf_path)
        page = doc[0]
        removed = cleanup_margin_text_blocks(page)
        result_text = page.get_text("text")
        doc.close()

        assert removed == 2
        assert "HEADER TEXT" not in result_text
        assert "FOOTER TEXT" not in result_text
        assert "BODY TEXT" in result_text


def test_cleanup_margin_text_blocks_keeps_large_top_title() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        pdf_path = root / "sample-title.pdf"

        doc = fitz.open()
        page = doc.new_page(width=300, height=400)
        page.insert_text((20, 20), "HEADER TEXT")
        page.insert_textbox(fitz.Rect(40, 40, 260, 110), "Large Paper Title\nSecond Line", fontsize=18)
        doc.save(pdf_path)
        doc.close()

        doc = fitz.open(pdf_path)
        page = doc[0]
        removed = cleanup_margin_text_blocks(page)
        result_text = page.get_text("text")
        doc.close()

        assert removed == 1
        assert "HEADER TEXT" not in result_text
        assert "Large Paper Title" in result_text
