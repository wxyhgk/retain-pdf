from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from foundation.config import paths
from foundation.shared.job_dirs import create_job_dirs
from services.document_schema import DOCUMENT_SCHEMA_REPORT_FILE_NAME
from services.mineru.artifacts import build_mineru_artifact_paths
from services.mineru.contracts import STDOUT_LABEL_JOB_ROOT
from services.mineru.contracts import STDOUT_LABEL_LAYOUT_JSON
from services.mineru.contracts import STDOUT_LABEL_NORMALIZATION_REPORT_JSON
from services.mineru.contracts import STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON
from services.mineru.contracts import STDOUT_LABEL_SOURCE_PDF
from services.mineru.contracts import format_stdout_kv
from services.mineru.job_flow import _materialize_normalized_document


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Normalize an already-downloaded MinerU layout.json into document.v1 artifacts.",
    )
    parser.add_argument("--layout-json", type=str, required=True, help="Path to MinerU layout.json")
    parser.add_argument("--source-pdf", type=str, required=True, help="Path to source PDF")
    parser.add_argument("--job-id", type=str, default="", help="Optional explicit job directory name")
    parser.add_argument(
        "--output-root",
        type=str,
        default=str(paths.OUTPUT_DIR),
        help="Root directory for structured job outputs.",
    )
    parser.add_argument("--provider-version", type=str, default="", help="Optional provider version")
    parser.add_argument("--provider-result-json", type=str, default="", help="Existing provider result summary JSON path")
    parser.add_argument("--provider-zip", type=str, default="", help="Existing provider bundle zip path")
    parser.add_argument("--provider-raw-dir", type=str, default="", help="Existing provider unpacked raw dir path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    layout_json_path = Path(args.layout_json).resolve()
    source_pdf_path = Path(args.source_pdf).resolve()
    if not layout_json_path.exists():
        raise RuntimeError(f"layout json not found: {layout_json_path}")
    if not source_pdf_path.exists():
        raise RuntimeError(f"source pdf not found: {source_pdf_path}")

    job_dirs = create_job_dirs(Path(args.output_root), args.job_id.strip() or None)
    artifact_paths = build_mineru_artifact_paths(job_dirs.ocr_dir)

    # Rust provider transport may have already materialized these files in-place.
    target_layout_json_path = artifact_paths.layout_json_path.resolve()
    if layout_json_path != target_layout_json_path:
        artifact_paths.layout_json_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(layout_json_path, artifact_paths.layout_json_path)
        layout_json_path = artifact_paths.layout_json_path
    target_source_pdf = (job_dirs.origin_pdf_dir / source_pdf_path.name).resolve()
    if source_pdf_path != target_source_pdf:
        target_source_pdf.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_pdf_path, target_source_pdf)
        source_pdf_path = target_source_pdf

    if args.provider_result_json.strip():
        provider_result_json = Path(args.provider_result_json).resolve()
        if provider_result_json.exists() and provider_result_json != artifact_paths.result_json_path.resolve():
            shutil.copy2(provider_result_json, artifact_paths.result_json_path)
    if args.provider_zip.strip():
        provider_zip_path = Path(args.provider_zip).resolve()
        if provider_zip_path.exists() and provider_zip_path != artifact_paths.bundle_zip_path.resolve():
            shutil.copy2(provider_zip_path, artifact_paths.bundle_zip_path)

    _materialize_normalized_document(
        layout_json_path=layout_json_path,
        normalized_json_path=artifact_paths.normalized_json_path,
        normalized_report_json_path=artifact_paths.normalized_report_json_path,
        document_id=job_dirs.root.name,
        provider_version=str(args.provider_version or ""),
    )

    normalization_report_path = artifact_paths.normalized_json_path.with_name(
        DOCUMENT_SCHEMA_REPORT_FILE_NAME
    )
    print(format_stdout_kv(STDOUT_LABEL_JOB_ROOT, job_dirs.root), flush=True)
    print(format_stdout_kv(STDOUT_LABEL_SOURCE_PDF, source_pdf_path), flush=True)
    print(format_stdout_kv(STDOUT_LABEL_LAYOUT_JSON, layout_json_path), flush=True)
    print(
        format_stdout_kv(STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON, artifact_paths.normalized_json_path),
        flush=True,
    )
    print(
        format_stdout_kv(STDOUT_LABEL_NORMALIZATION_REPORT_JSON, normalization_report_path),
        flush=True,
    )
    print(f"provider raw dir: {args.provider_raw_dir.strip() or artifact_paths.unpack_dir}", flush=True)
    print(f"provider zip: {args.provider_zip.strip() or artifact_paths.bundle_zip_path}", flush=True)
    print(
        f"provider summary json: {args.provider_result_json.strip() or artifact_paths.result_json_path}",
        flush=True,
    )
    print("schema version: document.v1", flush=True)


if __name__ == "__main__":
    main()
