from __future__ import annotations

from argparse import Namespace
import shutil
from pathlib import Path

from common.job_dirs import create_job_dirs
from common.local_env import get_secret
from mineru.artifacts import download_and_unpack_bundle
from mineru.artifacts import ensure_source_pdf_from_bundle
from mineru.artifacts import resolve_layout_json_path
from mineru.artifacts import save_json
from mineru.mineru_api import MINERU_ENV_FILE
from mineru.mineru_api import MINERU_TOKEN_ENV
from mineru.mineru_api import build_headers as build_mineru_headers
from mineru.mineru_api import parse_extra_formats
from mineru.submission import run_local_extract_task
from mineru.submission import run_remote_extract_task


def _resolve_mineru_token(args: Namespace) -> str:
    mineru_token = get_secret(
        explicit_value=args.mineru_token,
        env_var=MINERU_TOKEN_ENV,
        env_file_name=MINERU_ENV_FILE,
    )
    if not mineru_token:
        raise RuntimeError(f"Missing MinerU token. Set --mineru-token, scripts/.env/{MINERU_ENV_FILE}, or env {MINERU_TOKEN_ENV}.")
    return mineru_token


def run_mineru_to_job_dir(args: Namespace) -> tuple[Path, Path, Path]:
    mineru_token = _resolve_mineru_token(args)
    job_dirs = create_job_dirs(Path(args.output_root), args.job_id.strip() or None)
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

    result_json_path = job_dirs.json_pdf_dir / "mineru_result.json"
    save_json(result_json_path, result)
    result_data = result.get("data", {})
    full_zip_url = result_data.get("full_zip_url", "").strip()
    if not full_zip_url:
        raise RuntimeError("MinerU result does not contain full_zip_url.")

    zip_path = job_dirs.json_pdf_dir / "mineru_bundle.zip"
    unpack_dir = job_dirs.json_pdf_dir / "unpacked"
    download_and_unpack_bundle(
        full_zip_url=full_zip_url,
        zip_path=zip_path,
        unpack_dir=unpack_dir,
        headers=build_mineru_headers(mineru_token),
    )

    source_pdf_path = ensure_source_pdf_from_bundle(
        unpack_dir=unpack_dir,
        origin_pdf_dir=job_dirs.origin_pdf_dir,
        source_pdf_path=source_pdf_path,
    )
    layout_json_path = resolve_layout_json_path(unpack_dir)

    print(f"originPDF: {job_dirs.origin_pdf_dir}")
    print(f"jsonPDF: {job_dirs.json_pdf_dir}")
    print(f"transPDF: {job_dirs.trans_pdf_dir}")
    return job_dirs.root, source_pdf_path, layout_json_path
