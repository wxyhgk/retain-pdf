"""GLM-OCR 适配器：把 GLM 的 markdown 排版洗成和 Paddle 一样，来源改回 GLM。整份输出由快照守卫钉着（`glm_ocr_english_paper`）。"""

from __future__ import annotations

import json
from pathlib import Path

from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1
from retainpdf_pipeline.ocr.document_schema.adapters import detect_ocr_provider
from retainpdf_pipeline.ocr.document_schema.provider_adapters.glm_ocr.adapter import clean_content
from retainpdf_pipeline.ocr.document_schema.provider_adapters.glm_ocr.adapter import image_asset_key

RAW = Path(__file__).parent / "fixtures" / "synthetic" / "glm_ocr_english_paper" / "raw.json"


def _document() -> dict:
    return adapt_payload_to_document_v1(
        payload=json.loads(RAW.read_text(encoding="utf-8")),
        provider="glm_ocr",
        document_id="glm",
        source_json_path=Path("glm_ocr_result.json"),
    )


def test_glm_markdown_is_cleaned_to_what_paddle_gives_us() -> None:
    # 2026-10-31 真实结果：标题 `<div align="center">\n\n# …\n\n</div>`、`## Abstract`、图注包在 div 里、`<table border="1">`。
    # 我们请求 Paddle 时块里是纯文字，翻译收到 `## ` 会连井号一起翻。
    assert clean_content("doc_title", '<div align="center">\n\n# Title\n\n</div>') == "Title"
    assert clean_content("paragraph_title", "## 1. Introduction") == "1. Introduction"
    assert clean_content("figure_title", '<div align="center">\n\nFig. 1 A cell.\n\n</div>') == "Fig. 1 A cell."
    assert clean_content("table", '<table border="1"><tr><td>a</td></tr></table>') == "<table><tr><td>a</td></tr></table>"
    assert clean_content("image", "anything") == ""
    # 行间公式两边一样是 `$$…$$`，不动；正文里的 `#` 不是标题，不动。
    assert clean_content("display_formula", "$$\nx\n$$") == "$$\nx\n$$"
    assert clean_content("text", "# of samples is 5") == "# of samples is 5"


def test_glm_payload_is_detected_and_nothing_says_paddle() -> None:
    assert detect_ocr_provider(json.loads(RAW.read_text(encoding="utf-8"))) == "glm_ocr"
    document = _document()
    leftovers = [
        (block["block_id"], key)
        for page in document["pages"]
        for block in page["blocks"]
        for key in ("source", "provenance")
        if block[key]["provider"] != "glm_ocr" or "layoutParsingResults" in block[key]["raw_path"]
    ]
    assert leftovers == []
    assert document["derived"]["provider_signals"]["provider"] == "glm_ocr"


def test_blocks_follow_glm_reading_order_and_point_back_at_the_raw_slot() -> None:
    # 数组里 index 5 的正文排在 index 4 的标题前面：按 index 排，raw_path 指回数组里的原位置。
    page = _document()["pages"][0]
    texts = [block["text"] for block in page["blocks"]]
    assert texts.index("1. Introduction") < texts.index(next(t for t in texts if t.startswith("The diffusion coefficient")))
    heading = next(block for block in page["blocks"] if block["text"] == "1. Introduction")
    assert heading["source"]["raw_path"] == "/layout_details/0/5"


def test_image_blocks_link_to_the_locally_cropped_file() -> None:
    page = _document()["pages"][0]
    images = [block for block in page["blocks"] if block["sub_type"] == "image_body"]
    assert [block["metadata"]["asset_key"] for block in images] == [
        image_asset_key("image", [300, 1760, 1000, 2380]),
        image_asset_key("chart", [1050, 1760, 1700, 2380]),
    ]
    # 第一张调用层裁好了（`_images` 里有路径），第二张没有。
    assert [block["metadata"]["asset_resolved"] for block in images] == [True, False]
