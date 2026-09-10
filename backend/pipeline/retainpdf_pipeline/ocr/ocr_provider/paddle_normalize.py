from __future__ import annotations

from pathlib import Path
from typing import Callable

from retainpdf_pipeline.ocr.document_schema import DocumentSchemaValidationError
from retainpdf_pipeline.ocr.document_schema import adapt_path_to_document_v1_with_report
from retainpdf_pipeline.ocr.document_schema import build_validation_report
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.content_extract import (
    build_lines as build_paddle_lines,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.content_extract import inherit_missing_segment_bboxes
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.content_extract import (
    tighten_text_bbox as tighten_paddle_text_bbox,
)
from retainpdf_pipeline.ocr.document_schema.reporting import build_normalization_summary
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_PADDLE
from retainpdf_pipeline.ocr.document_schema.toc import build_toc_entries
from retainpdf_pipeline.services.pipeline_shared.io import save_json


AdaptDocumentFn = Callable[..., tuple[dict, dict]]
BuildLinesFn = Callable[..., list]
TightenBBoxFn = Callable[..., list[float]]
SaveJsonFn = Callable[..., None]


def save_normalized_document_for_paddle(
    *,
    provider_result_json_path: Path,
    source_pdf_path: Path,
    normalized_json_path: Path,
    normalized_report_json_path: Path,
    document_id: str,
    provider_version: str,
    provider_payload: dict | None = None,
    adapt_document: AdaptDocumentFn = adapt_path_to_document_v1_with_report,
    build_lines: BuildLinesFn = build_paddle_lines,
    tighten_text_bbox: TightenBBoxFn = tighten_paddle_text_bbox,
    save_json_file: SaveJsonFn = save_json,
) -> None:
    adapt_kwargs: dict = {}
    if provider_payload is not None:
        # Reuse the payload already held in memory instead of re-reading the
        # (often image-laden) provider result JSON from disk.
        adapt_kwargs["payload"] = provider_payload
    normalized_document, normalization_report = adapt_document(
        source_json_path=provider_result_json_path,
        document_id=document_id,
        provider=PROVIDER_PADDLE,
        provider_version=provider_version,
        **adapt_kwargs,
    )
    normalized_document = rescale_document_geometry_to_pdf(normalized_document, source_pdf_path)
    normalized_document = post_rescale_rebuild_paddle_text_geometry(
        normalized_document,
        build_lines=build_lines,
        tighten_text_bbox=tighten_text_bbox,
    )
    # Validate the final (rescaled/rebuilt) document in memory — no disk
    # read-back — and keep the persisted report in sync with what is saved.
    try:
        report = build_validation_report(normalized_document)
    except DocumentSchemaValidationError as exc:
        raise RuntimeError(
            f"normalized document schema validation failed: path={normalized_json_path} error={exc}"
        ) from exc
    report["coordinate_space"] = "pdf_point"
    normalization_report["validation"] = report
    save_json_file(normalized_json_path, normalized_document, compact=True)
    save_json_file(normalized_report_json_path, normalization_report)
    normalization_summary = build_normalization_summary(normalization_report)
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
        f"pages_observed={normalization_summary['pages_observed']} "
        f"blocks_observed={normalization_summary['blocks_observed']} "
        f"defaulted_document_fields={normalization_summary['defaulted_document_fields']} "
        f"defaulted_page_fields={normalization_summary['defaulted_page_fields']} "
        f"defaulted_block_fields={normalization_summary['defaulted_block_fields']} "
        f"path={normalized_report_json_path}",
        flush=True,
    )


def rescale_document_geometry_to_pdf(document: dict, source_pdf_path: Path) -> dict:
    import fitz

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
            page["width"] = pdf_w
            page["height"] = pdf_h
            page["unit"] = "pt"
            for block in page.get("blocks", []) or []:
                block["bbox"] = scale_bbox(block.get("bbox", []), scale_x, scale_y)
                geometry = block.get("geometry") or {}
                if geometry:
                    geometry["bbox"] = scale_bbox(geometry.get("bbox", []), scale_x, scale_y)
                for line in block.get("lines", []) or []:
                    line["bbox"] = scale_bbox(line.get("bbox", []), scale_x, scale_y)
                    for span in line.get("spans", []) or []:
                        span["bbox"] = scale_bbox(span.get("bbox", []), scale_x, scale_y)
                for segment in block.get("segments", []) or []:
                    if isinstance(segment, dict):
                        segment["bbox"] = scale_bbox(segment.get("bbox", []), scale_x, scale_y)
            document.setdefault("derived", {})["coordinate_space"] = "pdf_point"
    finally:
        pdf.close()
    return document


def scale_bbox(value: list[float], scale_x: float, scale_y: float) -> list[float]:
    if not isinstance(value, list) or len(value) != 4:
        return value
    return [
        round(float(value[0]) * scale_x, 3),
        round(float(value[1]) * scale_y, 3),
        round(float(value[2]) * scale_x, 3),
        round(float(value[3]) * scale_y, 3),
    ]


def post_rescale_rebuild_paddle_text_geometry(
    document: dict,
    *,
    build_lines: BuildLinesFn = build_paddle_lines,
    tighten_text_bbox: TightenBBoxFn = tighten_paddle_text_bbox,
) -> dict:
    for page in document.get("pages", []) or []:
        for block in page.get("blocks", []) or []:
            block_type = str(block.get("type", "") or "")
            sub_type = str(block.get("sub_type", "") or "")
            text = str(block.get("text", "") or "")
            raw_label = str((block.get("source") or {}).get("raw_type", "") or "")
            original_bbox = list(block.get("bbox", []) or [])
            # Provider layout geometry is more precise than our text-height
            # heuristic.  A second post-scale tightening pass must not move the
            # canonical block edge across an already matched formula segment.
            has_provider_segment_bbox = any(
                isinstance(segment, dict)
                and str(segment.get("bbox_precision", "") or "") == "provider_layout"
                for segment in block.get("segments", []) or []
            )
            tightened_bbox = (
                original_bbox
                if has_provider_segment_bbox
                else tighten_text_bbox(
                    bbox=original_bbox,
                    text=text,
                    block_type=block_type,
                    sub_type=sub_type,
                )
            )
            if tightened_bbox != original_bbox:
                block["bbox"] = tightened_bbox
                geometry = block.get("geometry") or {}
                if geometry:
                    geometry["bbox"] = list(tightened_bbox)
                metadata = block.get("metadata") or {}
                metadata["provider_bbox_tightened"] = True
                metadata["provider_bbox_original"] = original_bbox
                block["metadata"] = metadata
            rebuilt_lines = build_lines(
                bbox=block.get("bbox", []),
                segments=block.get("segments", []) or [],
                text=text,
                raw_label=raw_label,
                block_type=block_type,
                sub_type=sub_type,
            )
            if rebuilt_lines:
                inherit_missing_segment_bboxes(
                    bbox=block.get("bbox", []),
                    segments=block.get("segments", []) or [],
                    lines=rebuilt_lines,
                )
                block["lines"] = rebuilt_lines
                content = block.get("content") or {}
                if str(block.get("structure_role", "") or "").strip().lower() == "table_of_contents":
                    line_texts = content.get("line_texts") or []
                    if isinstance(line_texts, list):
                        toc_entries = build_toc_entries(
                            lines=rebuilt_lines,
                            line_texts=[str(line) for line in line_texts],
                        )
                        if toc_entries:
                            content["toc_entries"] = toc_entries
                            content["text_flow"] = "preserve_lines"
                            block["content"] = content
    return document
