from __future__ import annotations

from argparse import Namespace
from pathlib import Path

from retainpdf_pipeline.foundation.shared.job_dirs import JobDirs
from retainpdf_pipeline.foundation.shared.job_dirs import job_dirs_from_explicit_args
from retainpdf_pipeline.foundation.shared.local_env import get_secret
from retainpdf_pipeline.ocr.document_schema.adapters import adapt_path_to_document_v1_with_report
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_MINERU
from retainpdf_pipeline.ocr.document_schema.reporting import build_normalization_summary
from retainpdf_pipeline.ocr.mineru.artifacts import build_mineru_artifact_paths
from retainpdf_pipeline.ocr.mineru.artifacts import download_and_unpack_bundle
from retainpdf_pipeline.ocr.mineru.artifacts import ensure_source_pdf_from_bundle
from retainpdf_pipeline.ocr.mineru.artifacts import resolve_layout_json_path
from retainpdf_pipeline.ocr.mineru.artifacts import save_json
from retainpdf_pipeline.ocr.mineru.mineru_api import MINERU_ENV_FILE
from retainpdf_pipeline.ocr.mineru.mineru_api import MINERU_TOKEN_ENV
from retainpdf_pipeline.ocr.mineru.mineru_api import parse_extra_formats
from retainpdf_pipeline.ocr.mineru.submission import run_local_extract_task
from retainpdf_pipeline.ocr.mineru.submission import run_remote_extract_task


def _resolve_mineru_token(args: Namespace) -> str:
    mineru_token = get_secret(
        explicit_value=args.mineru_token,
        env_var=MINERU_TOKEN_ENV,
        env_file_name=MINERU_ENV_FILE,
    )
    if not mineru_token:
        raise RuntimeError(f"Missing MinerU token. Set --mineru-token, scripts/.env/{MINERU_ENV_FILE}, or env {MINERU_TOKEN_ENV}.")
    return mineru_token


def _materialize_normalized_document(
    *,
    layout_json_path: Path,
    normalized_json_path: Path,
    normalized_report_json_path: Path,
    document_id: str,
    provider_version: str,
) -> dict:
    # Job flow only orchestrates persistence.
    # Provider-specific raw -> normalized logic lives behind the adapter interface.
    normalized_document, normalization_report = adapt_path_to_document_v1_with_report(
        source_json_path=layout_json_path,
        document_id=document_id,
        provider=PROVIDER_MINERU,
        provider_version=provider_version,
    )
    save_json(normalized_json_path, normalized_document, compact=True)
    save_json(normalized_report_json_path, normalization_report)
    # The adapter already validated the document; reuse its report instead of
    # re-reading and re-validating the saved file.
    report = normalization_report["validation"]
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
    return report


def run_mineru_to_job_dir(args: Namespace) -> tuple[JobDirs, Path, Path, Path]:
    mineru_token = _resolve_mineru_token(args)
    job_dirs = job_dirs_from_explicit_args(args)
    artifact_paths = build_mineru_artifact_paths(job_dirs.ocr_dir)
    extra_formats = parse_extra_formats(args.extra_formats)
    enable_formula = not args.disable_formula
    enable_table = not args.disable_table

    source_pdf_path: Path | None = None
    if args.file_url:
        print(f"job dir: {job_dirs.root}")
        result = run_remote_extract_task(
            token=mineru_token,
            file_url=args.file_url,
            model_version=args.model_version,
            is_ocr=args.is_ocr,
            enable_formula=enable_formula,
            enable_table=enable_table,
            language=args.language,
            page_ranges=args.page_ranges,
            data_id=args.data_id,
            no_cache=args.no_cache,
            cache_tolerance=args.cache_tolerance,
            extra_formats=extra_formats,
            poll_interval=args.poll_interval,
            poll_timeout=args.poll_timeout,
        )
    else:
        file_path = Path(args.file_path).resolve()
        if not file_path.exists():
            raise RuntimeError(f"file not found: {file_path}")
        if file_path.parent != job_dirs.source_dir:
            raise RuntimeError(
                "local file-path must already be materialized under source_dir; "
                f"file_path={file_path} source_dir={job_dirs.source_dir}"
            )
        source_pdf_path = file_path
        print(f"job dir: {job_dirs.root}")
        result = run_local_extract_task(
            token=mineru_token,
            file_path=file_path,
            model_version=args.model_version,
            data_id=args.data_id,
            poll_interval=args.poll_interval,
            poll_timeout=args.poll_timeout,
        )

    save_json(artifact_paths.result_json_path, result)
    result_data = result.get("data", {})
    full_zip_url = result_data.get("full_zip_url", "").strip()
    if not full_zip_url:
        raise RuntimeError("MinerU result does not contain full_zip_url.")

    # full_zip_url is a presigned CDN/object-store URL; the MinerU bearer token
    # must not be forwarded to it (would leak into CDN logs cross-origin).
    download_and_unpack_bundle(
        full_zip_url=full_zip_url,
        zip_path=artifact_paths.bundle_zip_path,
        unpack_dir=artifact_paths.unpack_dir,
    )

    source_pdf_path = ensure_source_pdf_from_bundle(
        unpack_dir=artifact_paths.unpack_dir,
        origin_pdf_dir=job_dirs.origin_pdf_dir,
        source_pdf_path=source_pdf_path,
    )
    layout_json_path = resolve_layout_json_path(artifact_paths.unpack_dir)
    _materialize_normalized_document(
        layout_json_path=layout_json_path,
        normalized_json_path=artifact_paths.normalized_json_path,
        normalized_report_json_path=artifact_paths.normalized_report_json_path,
        document_id=job_dirs.root.name,
        provider_version=str(args.model_version or ""),
    )

    print(f"source: {job_dirs.source_dir}")
    print(f"ocr: {job_dirs.ocr_dir}")
    print(f"translated: {job_dirs.translated_dir}")
    print(f"rendered: {job_dirs.rendered_dir}")
    print(f"artifacts: {job_dirs.artifacts_dir}")
    print(f"logs: {job_dirs.logs_dir}")
    return job_dirs, source_pdf_path, layout_json_path, artifact_paths.normalized_json_path
