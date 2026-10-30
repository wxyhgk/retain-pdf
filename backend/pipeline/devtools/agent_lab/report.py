"""把一次测试的结果画成离线 HTML：原文页面上叠译文（浏览器里按框缩字号，缩到最小还放不下的标出来），右栏是汇总、指标、术语表和每块的校验。"""

from __future__ import annotations

import json
from pathlib import Path

from devtools.agent_lab.metrics import headline
from devtools.ocr_viewer.taxonomy import taxonomy_payload
from devtools.ocr_viewer.viewer import page_images

TEMPLATE = Path(__file__).with_name("report_template.html")
PLACEHOLDER = "/*__DATA__*/"


def build_report(pdf_path: Path, truth: dict, results: dict, out_path: Path, *, dpi: int = 144) -> Path:
    elements = {e["id"]: e for e in truth["elements"]}
    blocks = []
    for block in results["blocks"].values():
        element = elements[block["id"]]
        blocks.append(dict(block, bbox=element["bbox"], lines=len(element.get("lines") or []), lang=element.get("lang", "en")))
    data = {
        "taxonomy": taxonomy_payload(),
        "pages": truth["pages"],
        "images": page_images(pdf_path, dpi),
        "summary": results["summary"],
        "page_info": results["pages"],
        "blocks": blocks,
        "metrics": headline(results["metrics"]) if results.get("metrics") else [],
        "glossary": results.get("glossary") or {},
    }
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8").replace(PLACEHOLDER, blob, 1)
    out_path.write_text(html, encoding="utf-8")
    return out_path
