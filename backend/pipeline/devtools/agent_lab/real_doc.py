"""真实文档进测试系统：把 OCR 规范化后的 `document.v1.json` 换成测试系统用的标准答案格式（和人造样例的 `truth.json` 一样），
这样 `pages.build_pages`、调度、报告都不用改。

用户 10-30："你看看我最新的 pdf 的翻译任务，用这个做测试就行了"。

- 块类别：OCR 服务的叫法换成我们自己的分类（`taxonomy.py`），对不上的记成 unknown（不翻）。
- 文本：规范化文档里行内公式已经写成 `$…$`，直接用；纯数字的上标公式（参考文献角标 "$^{48-50}$"）换成脚注标记 `{{fn:48-50}}`；
  不给行和行内片段（`pages.agent_text` 没有行时用整块文本）。
- 标题级别：章标题（title）1 级，带编号的"14.1 …"2 级（"14.1.2 …"3 级），不带编号的 3 级。
- 印的页码：取这一页页码块的文字，没有就用页序号。
- 正式流程的译文（`translated/page-NNN-*.json`）可以一起读进来当基线，按页号和块号对上。
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from devtools.ocr_viewer.taxonomy import TAXONOMY_VERSION

SUB_TYPE_CLASS = {
    "body": "paragraph",
    "display_formula": "display_formula",
    "formula_number": "formula_number",
    "header": "running_header",
    "footer": "running_footer",
    "page_number": "page_number",
    "heading": "section_heading",
    "title": "section_heading",
    "image_body": "figure",
    "figure_caption": "figure_caption",
    "table_caption": "table_caption",
    "image_footnote": "float_note",
    "table_footnote": "float_note",
    "table_html": "table",
    "footnote": "footnote",
    "reference": "reference_entry",
    "list_item": "list_item",
    "abstract": "abstract",
    "code": "code_block",
    "algorithm": "algorithm",
}
NUMBER_RE = re.compile(r"^\s*(\d+(?:\.\d+)*)\s+\S")
# OCR 把参考文献的上标角标写成公式 "$ ^{48-50} $"：其实是引用角标，换成脚注标记 {{fn:48-50}}（受保护、丢了查得出）。
# 实测模型常把这种公式的 $ 丢掉，中文里露出 "^{53-68}"，或者干脆漏掉角标。
CITATION_SUPERSCRIPT_RE = re.compile(r"\$\s*\^\s*\{\s*([\d\s,\u2013\-]+?)\s*\}\s*\$")


def _heading_level(block: dict) -> int:
    if block.get("sub_type") == "title":
        return 1
    match = NUMBER_RE.match(block.get("text") or "")
    if match:
        return min(6, match.group(1).count(".") + 1)
    return 3


def truth_from_document(document: dict) -> tuple[dict, dict[int, str]]:
    """返回（标准答案格式的 truth，页序号 → 印的页码）。"""
    elements: list[dict] = []
    labels: dict[int, str] = {}
    for page in document["pages"]:
        index = page["page_index"]
        for block in sorted(page["blocks"], key=lambda b: b.get("order", 0)):
            cls = SUB_TYPE_CLASS.get(block.get("sub_type") or "", "unknown")
            if block.get("sub_type") == "title":
                cls = "section_heading"
            text = (block.get("text") or "").strip()
            if cls not in ("display_formula", "formula_number"):
                text = CITATION_SUPERSCRIPT_RE.sub(lambda m: "{{fn:" + re.sub(r"\s+", "", m.group(1)) + "}}", text)
            if cls == "page_number" and text:
                labels[index] = text
            element = {
                "id": block["block_id"],
                "class": cls,
                "page": index,
                "bbox": block["bbox"],
                "text": text,
                "lines": [],
                "relations": {},
                "attributes": {},
                "lang": "en",
            }
            if cls == "section_heading":
                element["attributes"]["level"] = _heading_level(block)
            elements.append(element)
    truth = {
        "schema": "retainpdf_ocr_truth_v1",
        "taxonomy_version": TAXONOMY_VERSION,
        "document_id": document.get("document_id", ""),
        "coordinate_space": "pdf_point",
        "pages": [{"index": p["page_index"], "width": p["width"], "height": p["height"]} for p in document["pages"]],
        "elements": elements,
    }
    for page in document["pages"]:
        labels.setdefault(page["page_index"], str(page["page_index"] + 1))
    return truth, labels


def baseline_translations(translated_dir: Path) -> dict[str, str]:
    """正式流程的译文：块 id（规范化文档的写法 pNNN-bNNNN）→ 译文。"""
    out: dict[str, str] = {}
    for path in sorted(Path(translated_dir).glob("page-*-*.json")):
        try:
            items = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict) or not item.get("translated_text"):
                continue
            block_id = f"p{int(item['page_idx']) + 1:03d}-b{int(item['block_idx']):04d}"
            out[block_id] = item["translated_text"]
    return out
