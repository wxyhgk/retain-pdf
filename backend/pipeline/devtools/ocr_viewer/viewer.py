"""把 PDF 和标准答案画成一个离线 HTML：原文页面做底图，按我们的分类（`taxonomy.py`）给每个框上色。

    python -m devtools.ocr_viewer.viewer --pdf X.pdf --truth truth.json --out viewer.html   # 在 backend/pipeline 下跑

页面图片、分类表、标准答案都打包进同一个文件，直接用浏览器打开，不用起服务。
"""

from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path

import fitz

from devtools.ocr_viewer.taxonomy import check_taxonomy
from devtools.ocr_viewer.taxonomy import taxonomy_payload

TEMPLATE = Path(__file__).with_name("viewer_template.html")
PLACEHOLDER = "/*__DATA__*/"


def page_images(pdf_path: Path, dpi: int = 144) -> list[str]:
    images: list[str] = []
    with fitz.open(pdf_path) as pdf:
        for page in pdf:
            png = page.get_pixmap(dpi=dpi).tobytes("png")
            images.append("data:image/png;base64," + base64.b64encode(png).decode("ascii"))
    return images


def check_truth(truth: dict) -> list[str]:
    """标准答案里的类别、区、关系都得在分类表里，关系指向的块得存在。"""
    taxonomy = taxonomy_payload()
    ids = {element["id"] for element in truth["elements"]}
    errors: list[str] = []
    for element in truth["elements"]:
        name = element["id"]
        cls = element["class"]
        if cls not in taxonomy["block_classes"]:
            errors.append(f"{name}: unknown class {cls}")
            continue
        if element["zone"] not in taxonomy["zones"]:
            errors.append(f"{name}: unknown zone {element['zone']}")
        for relation, targets in (element.get("relations") or {}).items():
            spec = taxonomy["relations"].get(relation)
            if spec is None:
                errors.append(f"{name}: unknown relation {relation}")
                continue
            if cls not in spec["from"]:
                errors.append(f"{name}: class {cls} cannot have relation {relation}")
            for target in targets if isinstance(targets, list) else [targets]:
                if target not in ids:
                    errors.append(f"{name}: {relation} points to missing block {target}")
        for attribute, value in (element.get("attributes") or {}).items():
            spec = taxonomy["attributes"].get(attribute)
            if attribute == "latex":
                continue
            if spec is None:
                errors.append(f"{name}: unknown attribute {attribute}")
            elif str(value) not in spec["values"]:
                errors.append(f"{name}: attribute {attribute} has unknown value {value!r}")
        for part in element.get("inlines") or []:
            if part["class"] not in taxonomy["inline_classes"]:
                errors.append(f"{name}: unknown inline class {part['class']}")
    return errors


def build_viewer(pdf_path: Path, truth_path: Path, out_path: Path, *, dpi: int = 144) -> Path:
    truth = json.loads(truth_path.read_text(encoding="utf-8"))
    errors = check_taxonomy() + check_truth(truth)
    if errors:
        raise ValueError("taxonomy/truth check failed:\n" + "\n".join(errors))
    data = {"taxonomy": taxonomy_payload(), "truth": truth, "images": page_images(pdf_path, dpi)}
    # 嵌进 <script> 里的 JSON 不能出现 "</"，否则会提前结束脚本。
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8").replace(PLACEHOLDER, blob, 1)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    return out_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--truth", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--dpi", type=int, default=144)
    args = parser.parse_args(argv)
    print(build_viewer(args.pdf, args.truth, args.out, dpi=args.dpi))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
