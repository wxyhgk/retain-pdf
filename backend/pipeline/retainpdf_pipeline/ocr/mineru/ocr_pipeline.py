from __future__ import annotations

import argparse
from retainpdf_pipeline.foundation.shared.job_dirs import add_explicit_job_dir_args
from retainpdf_pipeline.ocr.document_schema import DOCUMENT_SCHEMA_REPORT_FILE_NAME
from retainpdf_pipeline.ocr.mineru.artifacts import build_mineru_artifact_paths
from retainpdf_pipeline.services.pipeline_shared.contracts import STDOUT_LABEL_JOB_ROOT
from retainpdf_pipeline.services.pipeline_shared.contracts import STDOUT_LABEL_LAYOUT_JSON
from retainpdf_pipeline.services.pipeline_shared.contracts import STDOUT_LABEL_NORMALIZATION_REPORT_JSON
from retainpdf_pipeline.services.pipeline_shared.contracts import STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON
from retainpdf_pipeline.services.pipeline_shared.contracts import STDOUT_LABEL_PROVIDER_RAW_DIR
from retainpdf_pipeline.services.pipeline_shared.contracts import STDOUT_LABEL_PROVIDER_SUMMARY_JSON
from retainpdf_pipeline.services.pipeline_shared.contracts import STDOUT_LABEL_PROVIDER_ZIP
from retainpdf_pipeline.services.pipeline_shared.contracts import STDOUT_LABEL_SCHEMA_VERSION
from retainpdf_pipeline.services.pipeline_shared.contracts import STDOUT_LABEL_SOURCE_PDF
from retainpdf_pipeline.services.pipeline_shared.contracts import STDOUT_SCHEMA_VERSION_VALUE
from retainpdf_pipeline.services.pipeline_shared.contracts import format_stdout_kv
from retainpdf_pipeline.ocr.mineru.job_flow import run_mineru_to_job_dir


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="OCR-only MinerU pipeline: parse PDF with MinerU and materialize document.v1 artifacts.",
    )
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--file-url", type=str, default="", help="Remote PDF URL for MinerU parsing.")
    source_group.add_argument("--file-path", type=str, default="", help="Local PDF path for MinerU parsing.")

    parser.add_argument("--mineru-token", type=str, default="", help="MinerU API token.")
    parser.add_argument("--model-version", type=str, default="vlm", help="pipeline | vlm | MinerU-HTML")
    parser.add_argument("--is-ocr", action="store_true", help="Enable OCR.")
    parser.add_argument("--disable-formula", action="store_true", help="Disable formula recognition.")
    parser.add_argument("--disable-table", action="store_true", help="Disable table recognition.")
    parser.add_argument("--language", type=str, default="ch", help="Document language, for example ch or en.")
    parser.add_argument("--page-ranges", type=str, default="", help='Optional page range, for example "2,4-6".')
    parser.add_argument("--data-id", type=str, default="", help="Optional business data id.")
    parser.add_argument("--no-cache", action="store_true", help="Bypass MinerU URL cache.")
    parser.add_argument("--cache-tolerance", type=int, default=900, help="URL cache tolerance in seconds.")
    parser.add_argument("--extra-formats", type=str, default="", help="Comma-separated extra export formats: docx,html,latex")
    parser.add_argument("--poll-interval", type=int, default=5, help="Seconds between polling requests.")
    parser.add_argument("--poll-timeout", type=int, default=1800, help="Max seconds to wait for completion.")
    add_explicit_job_dir_args(parser)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    job_dirs, source_pdf_path, layout_json_path, normalized_json_path = run_mineru_to_job_dir(args)
    artifact_paths = build_mineru_artifact_paths(job_dirs.ocr_dir)
    normalization_report_path = normalized_json_path.with_name(DOCUMENT_SCHEMA_REPORT_FILE_NAME)

    print(format_stdout_kv(STDOUT_LABEL_JOB_ROOT, job_dirs.root), flush=True)
    print(format_stdout_kv(STDOUT_LABEL_SOURCE_PDF, source_pdf_path), flush=True)
    print(format_stdout_kv(STDOUT_LABEL_LAYOUT_JSON, layout_json_path), flush=True)
    print(format_stdout_kv(STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON, normalized_json_path), flush=True)
    print(
        format_stdout_kv(STDOUT_LABEL_NORMALIZATION_REPORT_JSON, normalization_report_path),
        flush=True,
    )
    print(format_stdout_kv(STDOUT_LABEL_PROVIDER_RAW_DIR, artifact_paths.unpack_dir), flush=True)
    print(format_stdout_kv(STDOUT_LABEL_PROVIDER_ZIP, artifact_paths.bundle_zip_path), flush=True)
    print(
        format_stdout_kv(STDOUT_LABEL_PROVIDER_SUMMARY_JSON, artifact_paths.result_json_path),
        flush=True,
    )
    print(format_stdout_kv(STDOUT_LABEL_SCHEMA_VERSION, STDOUT_SCHEMA_VERSION_VALUE), flush=True)


if __name__ == "__main__":
    main()
