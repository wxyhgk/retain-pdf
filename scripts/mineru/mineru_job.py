import argparse
import json
import shutil
import sys
import zipfile
from pathlib import Path

import requests

sys.path.append(str(Path(__file__).resolve().parents[2]))

from common.job_dirs import create_job_dirs
from common.local_env import get_secret
from mineru.mineru_api import MINERU_ENV_FILE
from mineru.mineru_api import MINERU_TOKEN_ENV
from mineru.mineru_api import apply_upload_url
from mineru.mineru_api import build_headers
from mineru.mineru_api import create_extract_task
from mineru.mineru_api import find_extract_result_in_batch
from mineru.mineru_api import parse_extra_formats
from mineru.mineru_api import poll_until_done
from mineru.mineru_api import query_batch_status
from mineru.mineru_api import upload_file


DEFAULT_OUTPUT_ROOT = "output"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="High-level MinerU job runner with structured task output directories.",
    )
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--file-url", type=str, default="", help="Remote PDF URL for MinerU parsing.")
    source_group.add_argument("--file-path", type=str, default="", help="Local PDF path for MinerU parsing.")

    parser.add_argument("--token", type=str, default="", help=f"MinerU API token. Prefer scripts/.env/{MINERU_ENV_FILE}.")
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
    parser.add_argument("--output-root", type=str, default=DEFAULT_OUTPUT_ROOT, help="Root directory for generated MinerU job folders.")
    parser.add_argument("--job-id", type=str, default="", help="Optional explicit job directory name.")
    return parser.parse_args()


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def download_file(url: str, path: Path, headers: dict[str, str] | None = None) -> None:
    with requests.get(url, headers=headers, stream=True, timeout=300) as response:
        response.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as f:
            for chunk in response.iter_content(chunk_size=1024 * 256):
                if chunk:
                    f.write(chunk)


def unpack_zip(zip_path: Path, dest_dir: Path) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(dest_dir)


def copy_local_source_pdf(file_path: Path, origin_dir: Path) -> Path:
    target = origin_dir / file_path.name
    shutil.copy2(file_path, target)
    return target


def main() -> None:
    args = parse_args()
    token = get_secret(
        explicit_value=args.token,
        env_var=MINERU_TOKEN_ENV,
        env_file_name=MINERU_ENV_FILE,
    )
    if not token:
        raise RuntimeError(f"Missing MinerU token. Set --token, scripts/.env/{MINERU_ENV_FILE}, or env {MINERU_TOKEN_ENV}.")

    job_dirs = create_job_dirs(Path(args.output_root), args.job_id.strip() or None)
    extra_formats = parse_extra_formats(args.extra_formats)
    enable_formula = not args.disable_formula
    enable_table = not args.disable_table

    source_pdf_saved: Path | None = None
    result: dict | None = None

    if args.file_url:
        task_id = create_extract_task(
            token=token,
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
        )
        result = poll_until_done(
            token=token,
            task_id=task_id,
            interval_seconds=args.poll_interval,
            timeout_seconds=args.poll_timeout,
        )
    else:
        file_path = Path(args.file_path).resolve()
        if not file_path.exists():
            raise RuntimeError(f"file not found: {file_path}")
        source_pdf_saved = copy_local_source_pdf(file_path, job_dirs.origin_pdf_dir)
        batch_id, upload_url = apply_upload_url(
            token=token,
            file_name=file_path.name,
            model_version=args.model_version,
            data_id=args.data_id,
        )
        print(f"job dir: {job_dirs.root}")
        print(f"batch_id: {batch_id}")
        upload_file(upload_url, file_path)
        print(f"upload done: {file_path}")

        import time

        started = time.time()
        while True:
            batch_status = query_batch_status(token, batch_id)
            try:
                extract_result = find_extract_result_in_batch(batch_status, file_path.name)
            except RuntimeError:
                if time.time() - started > args.poll_timeout:
                    raise TimeoutError(f"Timed out waiting for MinerU batch result: {batch_id}")
                print(f"batch {batch_id}: waiting for extract_result", flush=True)
                time.sleep(args.poll_interval)
                continue
            state = extract_result.get("state", "")
            print(f"batch {batch_id}: state={state}", flush=True)
            if state == "done":
                result = {"code": 0, "data": extract_result, "msg": "ok"}
                break
            if state == "failed":
                raise RuntimeError(f"MinerU batch task failed: {extract_result.get('err_msg', '') or 'unknown error'}")
            if time.time() - started > args.poll_timeout:
                raise TimeoutError(f"Timed out waiting for MinerU batch result: {batch_id}")
            time.sleep(args.poll_interval)

    if result is None:
        raise RuntimeError("MinerU did not return a final result.")

    result_path = job_dirs.json_pdf_dir / "mineru_result.json"
    save_json(result_path, result)
    print(f"saved result json: {result_path}")

    result_data = result.get("data", {})
    full_zip_url = result_data.get("full_zip_url", "").strip()
    if not full_zip_url:
        print("full_zip_url not present; stop after result json.")
        print(f"job dir: {job_dirs.root}")
        return

    zip_path = job_dirs.json_pdf_dir / "mineru_bundle.zip"
    download_file(full_zip_url, zip_path, headers=build_headers(token))
    print(f"saved zip: {zip_path}")

    unpack_dir = job_dirs.json_pdf_dir / "unpacked"
    unpack_zip(zip_path, unpack_dir)
    print(f"unpacked: {unpack_dir}")

    unpacked_origin = next(unpack_dir.glob("*_origin.pdf"), None)
    if unpacked_origin is not None:
        shutil.copy2(unpacked_origin, job_dirs.origin_pdf_dir / unpacked_origin.name)
        print(f"saved MinerU origin pdf: {job_dirs.origin_pdf_dir / unpacked_origin.name}")

    if source_pdf_saved is not None:
        print(f"saved source pdf: {source_pdf_saved}")
    print(f"originPDF: {job_dirs.origin_pdf_dir}")
    print(f"jsonPDF: {job_dirs.json_pdf_dir}")
    print(f"transPDF: {job_dirs.trans_pdf_dir}")
    print(f"job dir: {job_dirs.root}")


if __name__ == "__main__":
    main()
