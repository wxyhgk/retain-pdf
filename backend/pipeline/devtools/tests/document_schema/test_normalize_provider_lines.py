"""缩放后的行重建只给没有真实行的服务商用（Paddle 只给块，行是估出来的）。

MinerU 的 middle.json 每一行、每一段都带框（`bbox_precision=provider_layout`）。以前缩放以后对所有服务商都跑
`rebuild_estimated_text_geometry`，MinerU 的原生行被换成按字数估的行，行内公式的标记也丢了。
这里按生产的顺序走：适配 → 缩放到 PDF → 重建，看原生行留下来、坐标跟着缩放。
"""

from __future__ import annotations

from pathlib import Path

import fitz

from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_MINERU
from retainpdf_pipeline.ocr.document_schema.validator import validate_document_payload
from retainpdf_pipeline.ocr.document_schema.pdf_geometry import (
    rebuild_estimated_text_geometry,
    rescale_document_geometry_to_pdf,
)


def _span(text: str, bbox: list[float], kind: str = "text") -> dict:
    return {"type": kind, "content": text, "bbox": bbox, "score": 0.99}


def _middle_json() -> dict:
    paragraph_lines = [
        {"bbox": [60, 200, 535, 214], "spans": [_span("The first line of a paragraph that wraps", [60, 200, 535, 214])]},
        {
            "bbox": [60, 216, 535, 230],
            "spans": [
                _span("onto a second line with", [60, 216, 300, 230]),
                _span("E=mc^2", [302, 216, 360, 230], "inline_equation"),
                _span("inside it", [362, 216, 535, 230]),
            ],
        },
        {"bbox": [60, 232, 400, 246], "spans": [_span("and a short third line.", [60, 232, 400, 246])]},
    ]
    caption_lines = [
        {"bbox": [70, 345, 300, 357], "spans": [_span("Figure 1. A caption that", [70, 345, 300, 357])]},
        {"bbox": [70, 358, 250, 370], "spans": [_span("takes two lines.", [70, 358, 250, 370])]},
    ]
    return {
        "_backend": "vlm-auto-engine",
        "_version_name": "3.3.0",
        "pdf_info": [
            {
                "page_idx": 0,
                "page_size": [595.0, 842.0],
                "para_blocks": [
                    {"type": "text", "bbox": [60, 200, 535, 246], "index": 0, "lines": paragraph_lines},
                    {"type": "image_caption", "bbox": [70, 345, 300, 370], "index": 1, "lines": caption_lines},
                ],
                "discarded_blocks": [],
            }
        ],
    }


def _normalize(tmp_path: Path, scale: float) -> dict:
    document = adapt_payload_to_document_v1(
        payload=_middle_json(),
        provider=PROVIDER_MINERU,
        document_id="provider-lines",
        source_json_path=Path("layout.json"),
    )
    pdf_path = tmp_path / "source.pdf"
    with fitz.open() as pdf:
        pdf.new_page(width=595.0 * scale, height=842.0 * scale)
        pdf.save(pdf_path)
    document = rescale_document_geometry_to_pdf(document, pdf_path)
    document = rebuild_estimated_text_geometry(document)
    validate_document_payload(document)
    return document


def _block_with_text(document: dict, needle: str) -> dict:
    for block in document["pages"][0]["blocks"]:
        if needle in str(block.get("text", "")):
            return block
    raise AssertionError(f"no block contains {needle!r}")


def test_mineru_lines_survive_the_post_rescale_rebuild(tmp_path):
    document = _normalize(tmp_path, scale=2.0)

    paragraph = _block_with_text(document, "first line of a paragraph")
    lines = paragraph["lines"]
    assert len(lines) == 3, lines
    assert all(line.get("bbox_precision") == "provider_layout" for line in lines)
    # 坐标照样缩放到 PDF（两倍），行框就是 MinerU 给的那三行，不是平均切出来的。
    assert [line["bbox"] for line in lines] == [
        [120.0, 400.0, 1070.0, 428.0],
        [120.0, 432.0, 1070.0, 460.0],
        [120.0, 464.0, 800.0, 492.0],
    ]
    assert [span["type"] for span in lines[1]["spans"]] == ["text", "inline_formula", "text"]
    assert paragraph["bbox"] == [120.0, 400.0, 1070.0, 492.0], "块边以 MinerU 的为准，不按文字高度收紧"

    caption = _block_with_text(document, "Figure 1.")
    assert len(caption["lines"]) == 2
    assert all(line.get("bbox_precision") == "provider_layout" for line in caption["lines"])


def test_blocks_without_provider_lines_are_still_rebuilt(tmp_path):
    document = _normalize(tmp_path, scale=1.0)
    paragraph = _block_with_text(document, "first line of a paragraph")
    # 去掉行的框标记、只留块：这就是 Paddle 那种只给块的情况，照旧重建。
    for line in paragraph["lines"]:
        line.pop("bbox_precision", None)
    paragraph["lines"] = []
    rebuilt = rebuild_estimated_text_geometry(document)
    rebuilt_lines = _block_with_text(rebuilt, "first line of a paragraph")["lines"]
    assert rebuilt_lines, "a block without provider lines gets estimated lines"
    assert all(line.get("bbox_precision") != "provider_layout" for line in rebuilt_lines)
