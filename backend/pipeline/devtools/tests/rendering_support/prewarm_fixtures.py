from __future__ import annotations

from pathlib import Path

import fitz

from retainpdf_pipeline.render.analysis.document import build_render_document_analysis
from retainpdf_pipeline.render.contracts import RenderDocumentAnalysis


def write_source_pdf(path: Path) -> None:
    doc = fitz.open()
    page = doc.new_page(width=200, height=200)
    page.insert_text((20, 40), "inside source", fontsize=12)
    doc.save(path)
    doc.close()


def write_pseudo_editable_scan_pdf(path: Path) -> None:
    doc = fitz.open()
    page = doc.new_page(width=200, height=200)
    pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 200, 200), False)
    pix.clear_with(255)
    page.insert_image(page.rect, pixmap=pix)
    page.insert_textbox(
        fitz.Rect(10, 20, 150, 60),
        "inside source",
        fontsize=12,
    )
    doc.save(path)
    doc.close()


def write_document_v1(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        """
{
  "schema": "normalized_document_v1",
  "schema_version": "1.1",
  "document_id": "test-doc",
  "source": {"provider": "test"},
  "page_count": 1,
  "derived": {},
  "markers": {},
  "pages": [
    {
      "page_index": 0,
      "page": 1,
      "width": 200,
      "height": 200,
      "unit": "pt",
      "blocks": [
        {
          "block_id": "p001-b001",
          "page_index": 0,
          "order": 0,
          "type": "text",
          "sub_type": "text",
          "bbox": [10.0, 20.0, 150.0, 60.0],
          "text": "inside source",
          "geometry": {"bbox": [10.0, 20.0, 150.0, 60.0]},
          "content": {"kind": "text", "text": "inside source", "text_flow": "flow"},
          "layout_role": "paragraph",
          "semantic_role": "body",
          "structure_role": "body",
          "policy": {"translate": true, "translate_reason": "test"},
          "provenance": {
            "provider": "test",
            "raw_label": "text",
            "raw_sub_type": "text",
            "raw_bbox": [10.0, 20.0, 150.0, 60.0],
            "raw_path": "$.pages[0].blocks[0]"
          },
          "continuation_hint": {
            "source": "",
            "group_id": "",
            "role": "single",
            "scope": "",
            "reading_order": 0,
            "confidence": 0.0
          },
          "metadata": {},
          "source": {"provider": "test", "raw_type": "text"},
          "lines": []
        }
      ]
    }
  ]
}
""".strip(),
        encoding="utf-8",
    )


def page_payload() -> dict[int, list[dict]]:
    return {
        0: [
            {
                "item_id": "p001-b001",
                "page_idx": 0,
                "block_kind": "text",
                "block_type": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "policy_translate": True,
                "bbox": [10.0, 20.0, 150.0, 60.0],
                "protected_source_text": "inside source",
                "protected_translated_text": "",
            }
        ]
    }


def translated_page_payload() -> dict[int, list[dict]]:
    pages = page_payload()
    pages[0][0]["protected_translated_text"] = "内部来源"
    return pages


def empty_region_page_payload() -> dict[int, list[dict]]:
    return {
        0: [
            {
                "item_id": "p001-b001",
                "page_idx": 0,
                "block_kind": "text",
                "block_type": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "policy_translate": True,
                "bbox": [10.0, 120.0, 150.0, 170.0],
                "protected_source_text": "source outside",
                "protected_translated_text": "无重叠区域",
            }
        ]
    }


def tight_gap_page_payload() -> dict[int, list[dict]]:
    return {
        0: [
            {
                "item_id": "p001-b001",
                "page_idx": 0,
                "block_kind": "text",
                "block_type": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "bbox": [10.0, 20.0, 170.0, 70.0],
                "source_text": (
                    "This body paragraph has enough source text to be treated as body text "
                    "and it contains more than forty compact characters."
                ),
                "protected_source_text": (
                    "This body paragraph has enough source text to be treated as body text "
                    "and it contains more than forty compact characters."
                ),
                "protected_translated_text": "这是一个正文段落，用于触发预热阶段的紧邻 bbox 几何分析。",
            },
            {
                "item_id": "p001-b002",
                "page_idx": 0,
                "block_kind": "text",
                "block_type": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "bbox": [10.0, 70.6, 170.0, 122.0],
                "source_text": (
                    "This second body paragraph follows closely in the same column and also "
                    "contains enough compact characters for body detection."
                ),
                "protected_source_text": (
                    "This second body paragraph follows closely in the same column and also "
                    "contains enough compact characters for body detection."
                ),
                "protected_translated_text": "这是同一栏的下一段正文，用于提供紧邻边界。",
            },
        ]
    }


def source_document_analysis(path: Path) -> RenderDocumentAnalysis:
    return build_render_document_analysis(
        source_pdf_path=path,
        translated_pages=translated_page_payload(),
        start_page=0,
        end_page=0,
    )
