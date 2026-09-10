from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import fitz

from retainpdf_pipeline.render.source_cleanup.planning.coordinate_resolver import PageBBoxResolver


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    render_job_root = repo_root / "data/jobs" / args.job_id
    source_job_root = resolve_source_job_root(render_job_root, repo_root)
    page_idx, block_idx = parse_item_id(args.item_id)

    source_pdf = resolve_source_pdf(render_job_root)
    translated_item = load_translated_item(source_job_root, page_idx, args.item_id)
    ocr_block = load_ocr_block(source_job_root, page_idx, args.item_id, translated_item)
    cleanup_decision = load_cleanup_decision(source_job_root, args.item_id)
    typst_block = find_typst_block(render_job_root, translated_item)
    pdf_lines = extract_pdf_lines(source_pdf, page_idx, translated_item.get("bbox") or ocr_block.get("bbox"))
    current_coordinate_resolution = resolve_current_coordinate(source_pdf, page_idx, translated_item)

    report = {
        "job_id": args.job_id,
        "source_job_id": source_job_root.name,
        "item_id": args.item_id,
        "page_idx": page_idx,
        "block_idx": block_idx,
        "source_pdf": str(source_pdf),
        "classification": classify_item(translated_item, ocr_block, pdf_lines, cleanup_decision),
        "ocr": summarize_ocr_block(ocr_block),
        "translation": summarize_translation_item(translated_item),
        "pdf_physical": {"line_count": len(pdf_lines), "lines": pdf_lines},
        "cleanup": cleanup_decision,
        "current_coordinate_resolution": current_coordinate_resolution,
        "typst_overlay": typst_block,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze one rendered item's OCR/PDF/translation/cleanup composition.")
    parser.add_argument("job_id")
    parser.add_argument("item_id")
    parser.add_argument("--repo-root", default=Path(__file__).resolve().parents[3])
    return parser.parse_args()


def resolve_source_job_root(render_job_root: Path, repo_root: Path) -> Path:
    spec_path = render_job_root / "specs/render.spec.json"
    if not spec_path.exists():
        return render_job_root
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    manifest = Path(spec.get("inputs", {}).get("translation_manifest") or "")
    if manifest.is_absolute():
        parts = manifest.parts
        if "jobs" in parts:
            job_id = parts[parts.index("jobs") + 1]
            return repo_root / "data/jobs" / job_id
    return render_job_root


def resolve_source_pdf(render_job_root: Path) -> Path:
    spec_path = render_job_root / "specs/render.spec.json"
    if spec_path.exists():
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
        source_pdf = Path(spec.get("inputs", {}).get("source_pdf") or "")
        if source_pdf.exists():
            return source_pdf
    source_dir = render_job_root / "source"
    pdfs = sorted(source_dir.glob("*.pdf"))
    if not pdfs:
        raise FileNotFoundError(f"source PDF not found for {render_job_root}")
    return pdfs[0]


def parse_item_id(item_id: str) -> tuple[int, int]:
    match = re.fullmatch(r"p(\d+)-b(\d+)", item_id)
    if not match:
        raise ValueError(f"unsupported item_id format: {item_id}")
    return int(match.group(1)) - 1, int(match.group(2))


def load_translated_item(source_job_root: Path, page_idx: int, item_id: str) -> dict[str, Any]:
    page_no = page_idx + 1
    candidates = sorted((source_job_root / "translated").glob(f"page-{page_no:03d}-*.json"))
    for path in candidates:
        data = json.loads(path.read_text(encoding="utf-8"))
        items = data if isinstance(data, list) else data.get("items", [])
        for item in items:
            if item.get("item_id") == item_id:
                return item
    raise FileNotFoundError(f"translated item {item_id} not found under {source_job_root}")


def load_ocr_block(source_job_root: Path, page_idx: int, item_id: str, translated_item: dict[str, Any]) -> dict[str, Any]:
    path = source_job_root / "ocr/normalized/document.v1.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    expected_block_id = f"p{page_idx + 1:03d}-b{int(translated_item.get('block_idx', 0)):04d}"
    for page in data.get("pages", []):
        if int(page.get("page_index", -1)) != page_idx:
            continue
        for block in page.get("blocks", []):
            if block.get("block_id") == expected_block_id:
                return block
            if rect_equal(block.get("bbox"), translated_item.get("bbox")):
                return block
    return {}


def load_cleanup_decision(source_job_root: Path, item_id: str) -> dict[str, Any]:
    path = source_job_root / "artifacts/render_prewarm/render_source_prewarm_manifest.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    decisions = data.get("payload_prewarm", {}).get("bbox_text_strip_candidates", {}).get("decisions", [])
    for decision in decisions:
        if decision.get("item_id") == item_id:
            return decision
    return {}


def find_typst_block(render_job_root: Path, translated_item: dict[str, Any]) -> dict[str, Any]:
    text = str(translated_item.get("translated_text") or "")[:32]
    if not text:
        return {}
    typst_path = render_job_root / "rendered/typst/book-overlays/book-overlay.typ"
    if not typst_path.exists():
        return {}
    content = typst_path.read_text(encoding="utf-8")
    idx = content.find(text)
    if idx < 0:
        return {"found": False}
    start = max(0, content.rfind("\n", 0, idx - 1))
    end = content.find("\n\n", idx)
    snippet = content[start : end if end > idx else idx + 1000].strip()
    return {"found": True, "snippet": snippet[:2000]}


def resolve_current_coordinate(source_pdf: Path, page_idx: int, translated_item: dict[str, Any]) -> dict[str, Any]:
    doc = fitz.open(source_pdf)
    try:
        page = doc[page_idx]
        resolver = PageBBoxResolver.build(page, items=[translated_item])
        resolution = resolver.coordinate_resolution_for_item(translated_item)
        view_rect = resolver.resolve_item_bbox_rect(translated_item)
        pdf_rect = resolver.ocr_item_bbox_to_pdf_rect(translated_item)
    finally:
        doc.close()
    return {
        "candidate": resolution.candidate.name if resolution.candidate is not None else "",
        "status": resolution.status,
        "reason": resolution.reason,
        "score": round_float(resolution.score),
        "view_rect": round_rect(view_rect),
        "pdf_rect": round_rect(pdf_rect),
    }


def extract_pdf_lines(source_pdf: Path, page_idx: int, bbox: object) -> list[dict[str, Any]]:
    rect = fitz.Rect(bbox) if isinstance(bbox, list) and len(bbox) == 4 else None
    doc = fitz.open(source_pdf)
    try:
        page = doc[page_idx]
        data = page.get_text("dict", clip=rect) if rect is not None else page.get_text("dict")
    finally:
        doc.close()
    lines: list[dict[str, Any]] = []
    for block in data.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            lines.append(
                {
                    "bbox": round_rect(line.get("bbox")),
                    "text": "".join(str(span.get("text") or "") for span in spans),
                    "spans": [
                        {
                            "text": str(span.get("text") or "")[:80],
                            "font": span.get("font"),
                            "size": round_float(span.get("size")),
                            "color": span.get("color"),
                        }
                        for span in spans
                    ],
                }
            )
    return lines


def classify_item(
    translated_item: dict[str, Any],
    ocr_block: dict[str, Any],
    pdf_lines: list[dict[str, Any]],
    cleanup_decision: dict[str, Any],
) -> dict[str, Any]:
    ocr_lines = ocr_block.get("lines") or translated_item.get("lines") or []
    source_line_texts = translated_item.get("source_line_texts") or []
    tags: list[str] = []
    if translated_item.get("layout_role") == "paragraph":
        tags.append("paragraph")
    if len(pdf_lines) > 1:
        tags.append("multi_line_pdf_text")
    if len(ocr_lines) != len(pdf_lines):
        tags.append("ocr_pdf_line_count_mismatch")
    if source_line_texts and len(source_line_texts) != len(ocr_lines):
        tags.append("translation_source_lines_differ_from_ocr_lines")
    if cleanup_decision.get("action") == "strip":
        tags.append("source_cleanup_strip")
    if cleanup_decision.get("replacement_kind") == "text_overlay":
        tags.append("text_overlay")
    return {
        "tags": tags,
        "ocr_line_count": len(ocr_lines),
        "translation_source_line_count": len(source_line_texts),
        "pdf_line_count": len(pdf_lines),
    }


def summarize_ocr_block(block: dict[str, Any]) -> dict[str, Any]:
    lines = block.get("lines") or []
    return {
        "block_id": block.get("block_id"),
        "type": block.get("type"),
        "sub_type": block.get("sub_type"),
        "bbox": block.get("bbox"),
        "text_length": len(str(block.get("text") or "")),
        "text_excerpt": str(block.get("text") or "")[:500],
        "line_count": len(lines),
        "lines": [
            {
                "bbox": line.get("bbox"),
                "text": " ".join(str(span.get("text") or span.get("content") or "") for span in line.get("spans", []))[:300],
            }
            for line in lines
        ],
        "metadata": {
            key: (block.get("metadata") or {}).get(key)
            for key in [
                "structure_role",
                "layout_role",
                "semantic_role",
                "content_line_count",
                "policy_translate",
                "column_layout_mode",
                "column_index_guess",
            ]
        },
    }


def summarize_translation_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "item_id": item.get("item_id"),
        "bbox": item.get("bbox"),
        "block_type": item.get("block_type"),
        "layout_role": item.get("layout_role"),
        "semantic_role": item.get("semantic_role"),
        "policy_translate": item.get("policy_translate"),
        "source_text_length": len(str(item.get("source_text") or "")),
        "translated_text_length": len(str(item.get("translated_text") or "")),
        "source_excerpt": str(item.get("source_text") or "")[:500],
        "translated_excerpt": str(item.get("translated_text") or "")[:500],
        "source_line_texts": item.get("source_line_texts") or [],
    }


def rect_equal(left: object, right: object, *, precision: int = 3) -> bool:
    if not isinstance(left, list) or not isinstance(right, list) or len(left) != 4 or len(right) != 4:
        return False
    return tuple(round(float(value), precision) for value in left) == tuple(round(float(value), precision) for value in right)


def round_rect(value: object) -> list[float]:
    if isinstance(value, fitz.Rect):
        value = [value.x0, value.y0, value.x1, value.y1]
    if not isinstance(value, (list, tuple)) or len(value) != 4:
        return []
    return [round(float(item), 3) for item in value]


def round_float(value: object) -> float:
    try:
        return round(float(value), 3)
    except Exception:
        return 0.0


if __name__ == "__main__":
    main()
