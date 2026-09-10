from __future__ import annotations

import argparse
import shutil
from pathlib import Path
from types import SimpleNamespace

from retainpdf_pipeline.foundation.shared.job_dirs import (
    add_explicit_job_dir_args,
    job_dirs_from_explicit_args,
)
from retainpdf_pipeline.foundation.shared.stage_specs import NormalizeStageSpec
from retainpdf_pipeline.ocr.document_schema.adapters import (
    adapt_path_to_document_v1_with_report,
)
from retainpdf_pipeline.ocr.document_schema.reporting import (
    build_normalization_summary,
)
from retainpdf_pipeline.ocr.document_schema.validator import (
    build_validation_report,
)
from retainpdf_pipeline.ocr.document_schema.version import (
    DOCUMENT_SCHEMA_REPORT_FILE_NAME,
)
from retainpdf_pipeline.ocr.mineru.artifacts import (
    materialize_mineru_page_assets,
    resolve_layout_json_path,
)
from retainpdf_pipeline.ocr.ocr_provider.paddle_normalize import (
    post_rescale_rebuild_paddle_text_geometry,
    rescale_document_geometry_to_pdf,
)
from retainpdf_pipeline.services.pipeline_shared.io import save_json_atomic


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Normalize an already-downloaded OCR provider payload into document.v1 artifacts.",
    )
    parser.add_argument(
        "--spec", type=str, default="", help="Path to normalize stage spec JSON."
    )
    parser.add_argument(
        "--provider", type=str, default="", help="OCR provider name, e.g. mineru/paddle"
    )
    parser.add_argument(
        "--source-json", type=str, default="", help="Path to raw provider JSON"
    )
    parser.add_argument("--source-pdf", type=str, default="", help="Path to source PDF")
    add_explicit_job_dir_args(parser, required=False)
    parser.add_argument(
        "--provider-version", type=str, default="", help="Optional provider version"
    )
    parser.add_argument(
        "--provider-result-json",
        type=str,
        default="",
        help="Existing provider result summary JSON path",
    )
    parser.add_argument(
        "--provider-zip", type=str, default="", help="Existing provider bundle zip path"
    )
    parser.add_argument(
        "--provider-raw-dir",
        type=str,
        default="",
        help="Existing provider unpacked raw dir path",
    )
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


def _refresh_report_for_final_document(report: dict, document: dict) -> dict:
    refreshed = dict(report)
    pages = document.get("pages", []) or []
    defaults_report = dict(report.get("defaults") or {})
    defaults_report["pages_seen"] = len(pages)
    defaults_report["blocks_seen"] = sum(
        len(page.get("blocks", []) or []) for page in pages
    )
    refreshed["defaults"] = defaults_report
    validation = build_validation_report(document)
    validation["coordinate_space"] = "pdf_point"
    refreshed["validation"] = validation
    provider_signals = dict(
        (document.get("derived") or {}).get("provider_signals") or {}
    )
    if provider_signals:
        refreshed["provider_signals"] = provider_signals
    return refreshed


def _resolve_source_json_path(spec: NormalizeStageSpec) -> Path:
    requested = spec.inputs.source_json.resolve()
    if requested.is_file():
        return requested
    if spec.inputs.provider.strip().lower() != "mineru":
        return requested
    discovery_root = (spec.inputs.provider_raw_dir or requested.parent).resolve()
    return resolve_layout_json_path(discovery_root).resolve()


def build_normalized_artifacts(spec: NormalizeStageSpec) -> tuple[dict, dict]:
    """Build and validate the canonical artifacts without touching the filesystem."""
    provider = spec.inputs.provider.strip().lower()
    normalized_document, normalization_report = adapt_path_to_document_v1_with_report(
        source_json_path=_resolve_source_json_path(spec),
        document_id=spec.job_dirs.root.name,
        provider=provider,
        provider_version=spec.inputs.provider_version,
    )
    normalized_document = rescale_document_geometry_to_pdf(
        normalized_document,
        spec.inputs.source_pdf,
    )
    normalized_document = post_rescale_rebuild_paddle_text_geometry(normalized_document)
    normalization_report = _refresh_report_for_final_document(
        normalization_report,
        normalized_document,
    )
    return normalized_document, normalization_report


def normalized_artifact_paths(spec: NormalizeStageSpec) -> tuple[Path, Path]:
    normalized_dir = spec.job_dirs.ocr_dir / "normalized"
    return (
        normalized_dir / "document.v1.json",
        normalized_dir / DOCUMENT_SCHEMA_REPORT_FILE_NAME,
    )


def write_normalized_artifacts(
    spec: NormalizeStageSpec,
    document: dict,
    report: dict,
) -> tuple[Path, Path]:
    normalized_json_path, normalized_report_json_path = normalized_artifact_paths(spec)
    save_json_atomic(normalized_json_path, document, compact=True)
    save_json_atomic(normalized_report_json_path, report)
    return normalized_json_path, normalized_report_json_path


def main() -> None:
    args = parse_args()
    if not args.spec.strip():
        raise RuntimeError("normalize worker now requires --spec <normalize.spec.json>")
    spec = NormalizeStageSpec.load(Path(args.spec))
    args = _args_from_spec(spec)
    requested_source_json_path = Path(args.source_json).resolve()
    source_json_path = _resolve_source_json_path(spec)
    source_pdf_path = Path(args.source_pdf).resolve()
    if not source_json_path.exists():
        raise RuntimeError(f"source json not found: {source_json_path}")
    if not source_pdf_path.exists():
        raise RuntimeError(f"source pdf not found: {source_pdf_path}")

    if source_json_path != requested_source_json_path:
        requested_source_json_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_json_path, requested_source_json_path)
        source_json_path = requested_source_json_path

    job_dirs = job_dirs_from_explicit_args(args)
    ocr_dir = job_dirs.ocr_dir
    normalized_document, normalization_report = build_normalized_artifacts(spec)
    if spec.inputs.provider.strip().lower() == "mineru":
        provider_raw_dir = (spec.inputs.provider_raw_dir or source_json_path.parent).resolve()
        asset_materialization = materialize_mineru_page_assets(
            document=normalized_document,
            provider_raw_dir=provider_raw_dir,
            layout_json_path=source_json_path,
            markdown_images_dir=job_dirs.root / "md" / "images",
        )
        normalization_report["asset_materialization"] = asset_materialization
        normalization_report = _refresh_report_for_final_document(
            normalization_report,
            normalized_document,
        )
    normalized_json_path, normalized_report_json_path = write_normalized_artifacts(
        spec,
        normalized_document,
        normalization_report,
    )

    # _refresh_report_for_final_document already validated the final document;
    # reuse its report instead of re-reading and re-validating the saved file.
    report = normalization_report["validation"]
    normalization_summary = build_normalization_summary(normalization_report)
    print(f"job root: {job_dirs.root}", flush=True)
    print(f"source pdf: {source_pdf_path}", flush=True)
    print(f"layout json: {source_json_path}", flush=True)
    print(f"normalized document json: {normalized_json_path}", flush=True)
    print(f"normalization report json: {normalized_report_json_path}", flush=True)
    print(f"provider raw dir: {args.provider_raw_dir.strip() or ocr_dir}", flush=True)
    print(f"provider zip: {args.provider_zip.strip()}", flush=True)
    print(
        f"provider summary json: {args.provider_result_json.strip() or source_json_path}",
        flush=True,
    )
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
    print("schema version: document.v1", flush=True)
