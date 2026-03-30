from __future__ import annotations

from argparse import Namespace
import shutil
from pathlib import Path

from foundation.shared.job_dirs import create_job_dirs
from foundation.shared.local_env import get_secret
from services.mineru.artifacts import build_mineru_artifact_paths
from services.mineru.artifacts import download_and_unpack_bundle
from services.mineru.artifacts import ensure_source_pdf_from_bundle
from services.mineru.artifacts import save_json
from services.mineru.document_v1 import build_normalized_document_from_layout_path
from services.mineru.mineru_api import MINERU_ENV_FILE
from services.mineru.mineru_api import MINERU_TOKEN_ENV
from services.mineru.mineru_api import build_headers as build_mineru_headers
from services.mineru.mineru_api import parse_extra_formats
from services.mineru.submission import run_local_extract_task
from services.mineru.submission import run_remote_extract_task


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
    document_id: str,
    provider_version: str,
) -> None:
    # Keep the adaptation boundary explicit: job flow orchestrates persistence,
    # while document_v1 owns the raw-layout -> normalized transformation itself.
    normalized_document = build_normalized_document_from_layout_path(
        layout_json_path=layout_json_path,
        document_id=document_id,
        provider_version=provider_version,
    )
    save_json(normalized_json_path, normalized_document)


def run_mineru_to_job_dir(args: Namespace) -> tuple[Path, Path, Path, Path]:
    mineru_token = _resolve_mineru_token(args)
    job_dirs = create_job_dirs(Path(args.output_root), args.job_id.strip() or None)
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
        source_pdf_path = job_dirs.origin_pdf_dir / file_path.name
        shutil.copy2(file_path, source_pdf_path)
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

    download_and_unpack_bundle(
        full_zip_url=full_zip_url,
        zip_path=artifact_paths.bundle_zip_path,
        unpack_dir=artifact_paths.unpack_dir,
        headers=build_mineru_headers(mineru_token),
    )

    source_pdf_path = ensure_source_pdf_from_bundle(
        unpack_dir=artifact_paths.unpack_dir,
        origin_pdf_dir=job_dirs.origin_pdf_dir,
        source_pdf_path=source_pdf_path,
    )
    layout_json_path = artifact_paths.layout_json_path
    if not layout_json_path.exists():
        raise RuntimeError(f"layout.json not found after unpack: {layout_json_path}")
    _materialize_normalized_document(
        layout_json_path=layout_json_path,
        normalized_json_path=artifact_paths.normalized_json_path,
        document_id=job_dirs.root.name,
        provider_version=str(args.model_version or ""),
    )

    print(f"source: {job_dirs.source_dir}")
    print(f"ocr: {job_dirs.ocr_dir}")
    print(f"translated: {job_dirs.translated_dir}")
    print(f"typst: {job_dirs.typst_dir}")
    return job_dirs.root, source_pdf_path, layout_json_path, artifact_paths.normalized_json_path
