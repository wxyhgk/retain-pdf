from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import fitz

sys.path.append(str(Path(__file__).resolve().parents[2]))

from foundation.shared.job_dirs import add_explicit_job_dir_args
from foundation.shared.job_dirs import job_dirs_from_explicit_args
from foundation.shared.stage_specs import NormalizeStageSpec
from services.document_schema import DOCUMENT_SCHEMA_REPORT_FILE_NAME
from services.document_schema import adapt_path_to_document_v1_with_report
from services.document_schema import validate_saved_document_path
from services.document_schema.reporting import build_normalization_summary


def _save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _scale_bbox(value: list[float], scale_x: float, scale_y: float) -> list[float]:
    if not isinstance(value, list) or len(value) != 4:
        return value
    return [
        round(float(value[0]) * scale_x, 3),
        round(float(value[1]) * scale_y, 3),
        round(float(value[2]) * scale_x, 3),
        round(float(value[3]) * scale_y, 3),
    ]


def _scale_point_list(value: list, scale_x: float, scale_y: float) -> list:
    if not isinstance(value, list):
        return value
    scaled = []
    for item in value:
        if isinstance(item, (list, tuple)) and len(item) == 2:
            scaled.append([round(float(item[0]) * scale_x, 3), round(float(item[1]) * scale_y, 3)])
        else:
            scaled.append(item)
    return scaled


def _rescale_document_geometry_to_pdf(document: dict, source_pdf_path: Path) -> dict:
    pdf = fitz.open(source_pdf_path)
    try:
        pages = document.get("pages", []) or []
        for page_index, page in enumerate(pages):
            if page_index >= len(pdf):
                break
            pdf_page = pdf[page_index]
            pdf_w = float(pdf_page.rect.width)
            pdf_h = float(pdf_page.rect.height)
            raw_w = float(page.get("width", 0) or 0)
            raw_h = float(page.get("height", 0) or 0)
            if raw_w <= 0 or raw_h <= 0:
                page["width"] = pdf_w
                page["height"] = pdf_h
                continue
            scale_x = pdf_w / raw_w
            scale_y = pdf_h / raw_h
            if abs(scale_x - 1.0) < 0.01 and abs(scale_y - 1.0) < 0.01:
                page["width"] = pdf_w
                page["height"] = pdf_h
                continue

            page["width"] = pdf_w
            page["height"] = pdf_h
            for block in page.get("blocks", []) or []:
                block["bbox"] = _scale_bbox(block.get("bbox", []), scale_x, scale_y)
                for line in block.get("lines", []) or []:
                    line["bbox"] = _scale_bbox(line.get("bbox", []), scale_x, scale_y)
                    for span in line.get("spans", []) or []:
                        span["bbox"] = _scale_bbox(span.get("bbox", []), scale_x, scale_y)
                for segment in block.get("segments", []) or []:
                    if isinstance(segment, dict):
                        segment["bbox"] = _scale_bbox(segment.get("bbox", []), scale_x, scale_y)
                source = block.get("source") or {}
                if source:
                    source["raw_bbox"] = _scale_bbox(source.get("raw_bbox", []), scale_x, scale_y)
                metadata = block.get("metadata") or {}
                if metadata:
                    metadata["raw_polygon"] = _scale_point_list(metadata.get("raw_polygon", []), scale_x, scale_y)
                    metadata["layout_det_polygon"] = _scale_point_list(metadata.get("layout_det_polygon", []), scale_x, scale_y)
    finally:
        pdf.close()
    return document


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Normalize an already-downloaded OCR provider payload into document.v1 artifacts.",
    )
    parser.add_argument("--spec", type=str, default="", help="Path to normalize stage spec JSON.")
    parser.add_argument("--provider", type=str, default="", help="OCR provider name, e.g. mineru/paddle")
    parser.add_argument("--source-json", type=str, default="", help="Path to raw provider JSON")
    parser.add_argument("--source-pdf", type=str, default="", help="Path to source PDF")
    add_explicit_job_dir_args(parser, required=False)
    parser.add_argument("--provider-version", type=str, default="", help="Optional provider version")
    parser.add_argument("--provider-result-json", type=str, default="", help="Existing provider result summary JSON path")
    parser.add_argument("--provider-zip", type=str, default="", help="Existing provider bundle zip path")
    parser.add_argument("--provider-raw-dir", type=str, default="", help="Existing provider unpacked raw dir path")
    return parser.parse_args()


def _args_from_spec(spec: NormalizeStageSpec) -> SimpleNamespace:
    job_dirs = spec.job_dirs
    return SimpleNamespace(
        provider=spec.inputs.provider,
        source_json=str(spec.inputs.source_json),
        source_pdf=str(spec.inputs.source_pdf),
        job_root=str(job_dirs.root),
        source_dir=str(job_dirs.source_dir),
        ocr_dir=str(job_dirs.ocr_dir),
        translated_dir=str(job_dirs.translated_dir),
        rendered_dir=str(job_dirs.rendered_dir),
        artifacts_dir=str(job_dirs.artifacts_dir),
        logs_dir=str(job_dirs.logs_dir),
        provider_version=spec.inputs.provider_version,
        provider_result_json=str(spec.inputs.provider_result_json or ""),
        provider_zip=str(spec.inputs.provider_zip or ""),
        provider_raw_dir=str(spec.inputs.provider_raw_dir or ""),
    )


def main() -> None:
    args = parse_args()
    if not args.spec.strip():
        raise RuntimeError("normalize worker now requires --spec <normalize.spec.json>")
    args = _args_from_spec(NormalizeStageSpec.load(Path(args.spec)))
    provider = args.provider.strip().lower()
    source_json_path = Path(args.source_json).resolve()
    source_pdf_path = Path(args.source_pdf).resolve()
    if not source_json_path.exists():
        raise RuntimeError(f"source json not found: {source_json_path}")
    if not source_pdf_path.exists():
        raise RuntimeError(f"source pdf not found: {source_pdf_path}")

    job_dirs = job_dirs_from_explicit_args(args)
    ocr_dir = job_dirs.ocr_dir
    normalized_dir = ocr_dir / "normalized"
    normalized_json_path = normalized_dir / "document.v1.json"
    normalized_report_json_path = normalized_dir / DOCUMENT_SCHEMA_REPORT_FILE_NAME

    normalized_document, normalization_report = adapt_path_to_document_v1_with_report(
        source_json_path=source_json_path,
        document_id=job_dirs.root.name,
        provider=provider,
        provider_version=str(args.provider_version or ""),
    )
    normalized_document = _rescale_document_geometry_to_pdf(normalized_document, source_pdf_path)
    _save_json(normalized_json_path, normalized_document)
    _save_json(normalized_report_json_path, normalization_report)

    report = validate_saved_document_path(normalized_json_path)
    normalization_summary = build_normalization_summary(normalization_report)
    print(f"job root: {job_dirs.root}", flush=True)
    print(f"source pdf: {source_pdf_path}", flush=True)
    print(f"layout json: {source_json_path}", flush=True)
    print(f"normalized document json: {normalized_json_path}", flush=True)
    print(f"normalization report json: {normalized_report_json_path}", flush=True)
    print(f"provider raw dir: {args.provider_raw_dir.strip() or ocr_dir}", flush=True)
    print(f"provider zip: {args.provider_zip.strip()}", flush=True)
    print(f"provider summary json: {args.provider_result_json.strip() or source_json_path}", flush=True)
    print(
        "normalized document validated: "
        f"schema={report['schema']} "
        f"version={report['schema_version']} "
        f"pages={report['page_count']} "
        f"blocks={report['block_count']} "
        f"path={normalized_json_path}",
        flush=True,
    )
    print(
        "normalized document report: "
        f"provider={normalization_summary['provider']} "
        f"detected={normalization_summary['detected_provider']} "
        f"defaults_pages={normalization_summary['defaults_pages']} "
        f"defaults_blocks={normalization_summary['defaults_blocks']} "
        f"path={normalized_report_json_path}",
        flush=True,
    )
    print("schema version: document.v1", flush=True)
