"""真实文档转换：OCR 规范化文档（document.v1）→ 测试系统的标准答案格式；正式流程的译文按页号块号对上。"""

from __future__ import annotations

import json
from pathlib import Path

from devtools.agent_lab.pages import build_pages
from devtools.agent_lab.real_doc import baseline_translations
from devtools.agent_lab.real_doc import truth_from_document


def _block(page: int, index: int, sub_type: str, text: str) -> dict:
    return {"block_id": f"p{page + 1:03d}-b{index:04d}", "page_index": page, "order": index, "sub_type": sub_type, "bbox": [50, 50 + 20 * index, 400, 65 + 20 * index], "text": text}


DOCUMENT = {
    "document_id": "doc",
    "pages": [
        {
            "page_index": 0,
            "width": 600,
            "height": 800,
            "blocks": [
                _block(0, 0, "title", "Theorems of Molecular Quantum Mechanics"),
                _block(0, 1, "heading", "14.1 Electron Probability Density"),
                _block(0, 2, "body", "The wave function $ \\psi $ of the $n$ electrons."),
                _block(0, 3, "display_formula", "$$ \\rho = n \\int |\\psi|^2 $$"),
                _block(0, 4, "page_number", "402"),
                _block(0, 5, "mystery", "???"),
            ],
        }
    ],
}


def test_document_blocks_become_our_classes_with_levels_and_printed_page() -> None:
    truth, labels = truth_from_document(DOCUMENT)
    classes = {e["id"]: (e["class"], e["attributes"].get("level")) for e in truth["elements"]}
    assert classes["p001-b0000"] == ("section_heading", 1) and classes["p001-b0001"] == ("section_heading", 2)
    assert classes["p001-b0002"][0] == "paragraph" and classes["p001-b0003"][0] == "display_formula" and classes["p001-b0005"][0] == "unknown"
    assert labels == {0: "402"}
    page = build_pages(truth, page_labels=labels)[0]
    sent = {b.id: b for b in page.blocks}
    assert sent["p001-b0002"].translate and sent["p001-b0002"].source == "The wave function $ \\psi $ of the $n$ electrons."
    assert not sent["p001-b0003"].translate and not sent["p001-b0005"].translate


def test_production_translations_line_up_by_page_and_block(tmp_path: Path) -> None:
    items = [{"page_idx": 0, "block_idx": 2, "translated_text": "这 $n$ 个电子的波函数 $\\psi$。"}, {"page_idx": 0, "block_idx": 3, "translated_text": ""}]
    (tmp_path / "page-001-deepseek.json").write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    assert baseline_translations(tmp_path) == {"p001-b0002": "这 $n$ 个电子的波函数 $\\psi$。"}
