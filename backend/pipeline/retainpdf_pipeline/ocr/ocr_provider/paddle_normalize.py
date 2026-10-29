from __future__ import annotations

from pathlib import Path
from typing import Callable

from retainpdf_pipeline.ocr.document_schema import DocumentSchemaValidationError
from retainpdf_pipeline.ocr.document_schema import adapt_path_to_document_v1_with_report
from retainpdf_pipeline.ocr.document_schema import build_validation_report
from retainpdf_pipeline.ocr.document_schema.estimated_lines import build_lines as build_paddle_lines
from retainpdf_pipeline.ocr.document_schema.estimated_lines import tighten_text_bbox as tighten_paddle_text_bbox
# 缩放、补行各家通用，2026-10-29 挪到 `document_schema/pdf_geometry.py`；补行的旧名字留在这里。
from retainpdf_pipeline.ocr.document_schema.pdf_geometry import (  # noqa: F401
    rebuild_estimated_text_geometry as post_rescale_rebuild_paddle_text_geometry,
    rescale_document_geometry_to_pdf,
    scale_bbox,
)
from retainpdf_pipeline.ocr.document_schema.reporting import build_normalization_summary
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_PADDLE
from retainpdf_base.io import save_json


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
