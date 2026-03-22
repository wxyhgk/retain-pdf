import argparse
import json
import shutil
import sys
import time
import zipfile
from pathlib import Path

import requests

sys.path.append(str(Path(__file__).resolve().parents[2]))

from common.config import BODY_FONT_SIZE_FACTOR
from common.config import BODY_LEADING_FACTOR
from common.config import DEFAULT_PDF_COMPRESS_DPI
from common.config import INNER_BBOX_DENSE_SHRINK_X
from common.config import INNER_BBOX_DENSE_SHRINK_Y
from common.config import INNER_BBOX_SHRINK_X
from common.config import INNER_BBOX_SHRINK_Y
from common.config import OUTPUT_DIR
from common.config import TYPST_DEFAULT_FONT_FAMILY
from common.config import apply_layout_tuning
from common.job_cleanup import prune_mineru_json_dir
from common.job_cleanup import prune_origin_pdf_dir
from common.job_cleanup import prune_trans_pdf_dir
from common.job_dirs import create_job_dirs
from integrations.mineru.mineru_api import MINERU_ENV_FILE
from integrations.mineru.mineru_api import MINERU_TOKEN_ENV
from integrations.mineru.mineru_api import apply_upload_url
from integrations.mineru.mineru_api import build_headers as build_mineru_headers
from integrations.mineru.mineru_api import create_extract_task
from integrations.mineru.mineru_api import find_extract_result_in_batch
from integrations.mineru.mineru_api import parse_extra_formats
from integrations.mineru.mineru_api import poll_until_done
from integrations.mineru.mineru_api import query_batch_status
from integrations.mineru.mineru_api import upload_file
from pipeline.book_pipeline import run_book_pipeline
from translation.deepseek_client import DEFAULT_BASE_URL
from translation.deepseek_client import get_api_key
from translation.deepseek_client import normalize_base_url
from common.local_env import get_secret


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="End-to-end MinerU pipeline: parse PDF with MinerU, then translate from layout.json into transPDF.",
    )
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--file-url", type=str, default="", help="Remote PDF URL for MinerU parsing.")
    source_group.add_argument("--file-path", type=str, default="", help="Local PDF path for MinerU parsing.")

    parser.add_argument("--mineru-token", type=str, default="", help=f"MinerU API token. Prefer scripts/.env/{MINERU_ENV_FILE}.")
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

    parser.add_argument("--job-id", type=str, default="", help="Optional explicit job directory name.")
    parser.add_argument("--output-root", type=str, default=str(OUTPUT_DIR), help="Root directory for structured job outputs.")

    parser.add_argument("--start-page", type=int, default=0, help="Zero-based start page index. Default is the first page.")
    parser.add_argument("--end-page", type=int, default=-1, help="Zero-based end page index, inclusive. Default is the last page.")
    parser.add_argument("--batch-size", type=int, default=6, help="Number of text items per API call.")
    parser.add_argument("--workers", type=int, default=4, help="Concurrent translation requests.")
    parser.add_argument("--mode", type=str, default="sci", choices=["fast", "precise", "sci"], help="Translation mode. Default is sci.")
    parser.add_argument("--skip-title-translation", action="store_true", help="Do not translate OCR title blocks.")
    parser.add_argument("--classify-batch-size", type=int, default=12, help="Classification batch size for precise mode.")
    parser.add_argument("--api-key", type=str, default="", help="Optional translation API key. Prefer env DEEPSEEK_API_KEY for DeepSeek.")
    parser.add_argument("--model", type=str, default="Q3.5-turbo", help="Translation model name.")
    parser.add_argument("--base-url", type=str, default="http://1.94.67.196:10001/v1", help="OpenAI-compatible translation API base URL.")
    parser.add_argument("--render-mode", type=str, default="typst", choices=["auto", "compact", "direct", "typst", "dual"], help="Rendering mode for translated pages.")
    parser.add_argument("--compile-workers", type=int, default=0, help="Parallel Typst overlay compilation workers. 0 means auto.")
    parser.add_argument("--typst-font-family", type=str, default=TYPST_DEFAULT_FONT_FAMILY, help="Base Typst font family name.")
    parser.add_argument("--pdf-compress-dpi", type=int, default=DEFAULT_PDF_COMPRESS_DPI, help="Final PDF image downsample DPI after rendering. 0 disables post-compression.")

    parser.add_argument("--translated-pdf-name", type=str, default="", help="Optional final PDF name inside transPDF.")
    parser.add_argument("--body-font-size-factor", type=float, default=BODY_FONT_SIZE_FACTOR)
    parser.add_argument("--body-leading-factor", type=float, default=BODY_LEADING_FACTOR)
    parser.add_argument("--inner-bbox-shrink-x", type=float, default=INNER_BBOX_SHRINK_X)
    parser.add_argument("--inner-bbox-shrink-y", type=float, default=INNER_BBOX_SHRINK_Y)
    parser.add_argument("--inner-bbox-dense-shrink-x", type=float, default=INNER_BBOX_DENSE_SHRINK_X)
    parser.add_argument("--inner-bbox-dense-shrink-y", type=float, default=INNER_BBOX_DENSE_SHRINK_Y)
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


def run_mineru_to_job_dir(args: argparse.Namespace) -> tuple[Path, Path, Path]:
    mineru_token = get_secret(
        explicit_value=args.mineru_token,
        env_var=MINERU_TOKEN_ENV,
        env_file_name=MINERU_ENV_FILE,
    )
    if not mineru_token:
        raise RuntimeError(f"Missing MinerU token. Set --mineru-token, scripts/.env/{MINERU_ENV_FILE}, or env {MINERU_TOKEN_ENV}.")

    job_dirs = create_job_dirs(Path(args.output_root), args.job_id.strip() or None)
    extra_formats = parse_extra_formats(args.extra_formats)
    enable_formula = not args.disable_formula
    enable_table = not args.disable_table
    source_pdf_path: Path | None = None

    result: dict | None = None
    if args.file_url:
        task_id = create_extract_task(
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
        )
        print(f"job dir: {job_dirs.root}")
        print(f"task_id: {task_id}")
        result = poll_until_done(
            token=mineru_token,
            task_id=task_id,
            interval_seconds=args.poll_interval,
            timeout_seconds=args.poll_timeout,
        )
    else:
        file_path = Path(args.file_path).resolve()
        if not file_path.exists():
            raise RuntimeError(f"file not found: {file_path}")
        source_pdf_path = job_dirs.origin_pdf_dir / file_path.name
        shutil.copy2(file_path, source_pdf_path)
        batch_id, upload_url = apply_upload_url(
            token=mineru_token,
            file_name=file_path.name,
            model_version=args.model_version,
            data_id=args.data_id,
        )
        print(f"job dir: {job_dirs.root}")
        print(f"batch_id: {batch_id}")
        upload_file(upload_url, file_path)
        print(f"upload done: {file_path}")
        started = time.time()
        while True:
            batch_status = query_batch_status(mineru_token, batch_id)
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

    result_json_path = job_dirs.json_pdf_dir / "mineru_result.json"
    save_json(result_json_path, result)
    result_data = result.get("data", {})
    full_zip_url = result_data.get("full_zip_url", "").strip()
    if not full_zip_url:
        raise RuntimeError("MinerU result does not contain full_zip_url.")

    zip_path = job_dirs.json_pdf_dir / "mineru_bundle.zip"
    download_file(full_zip_url, zip_path, headers=build_mineru_headers(mineru_token))
    unpack_dir = job_dirs.json_pdf_dir / "unpacked"
    unpack_zip(zip_path, unpack_dir)

    if source_pdf_path is None:
        unpacked_origin = next(unpack_dir.glob("*_origin.pdf"), None)
        if unpacked_origin is None:
            raise RuntimeError("MinerU unpacked bundle does not contain *_origin.pdf for remote input.")
        source_pdf_path = job_dirs.origin_pdf_dir / unpacked_origin.name
        shutil.copy2(unpacked_origin, source_pdf_path)
    else:
        unpacked_origin = next(unpack_dir.glob("*_origin.pdf"), None)

    layout_json_path = unpack_dir / "layout.json"
    if not layout_json_path.exists():
        raise RuntimeError(f"layout.json not found after unpack: {layout_json_path}")

    print(f"originPDF: {job_dirs.origin_pdf_dir}")
    print(f"jsonPDF: {job_dirs.json_pdf_dir}")
    print(f"transPDF: {job_dirs.trans_pdf_dir}")
    return job_dirs.root, source_pdf_path, layout_json_path


def main() -> None:
    args = parse_args()
    apply_layout_tuning(
        body_font_size_factor=args.body_font_size_factor,
        body_leading_factor=args.body_leading_factor,
        inner_bbox_shrink_x=args.inner_bbox_shrink_x,
        inner_bbox_shrink_y=args.inner_bbox_shrink_y,
        inner_bbox_dense_shrink_x=args.inner_bbox_dense_shrink_x,
        inner_bbox_dense_shrink_y=args.inner_bbox_dense_shrink_y,
    )

    job_root, source_pdf_path, layout_json_path = run_mineru_to_job_dir(args)
    trans_pdf_dir = job_root / "transPDF"
    translations_dir = trans_pdf_dir / "translations"
    translated_pdf_name = args.translated_pdf_name.strip() or f"{source_pdf_path.stem}-translated.pdf"
    output_pdf_path = trans_pdf_dir / translated_pdf_name

    api_key = get_api_key(
        args.api_key,
        required=normalize_base_url(args.base_url) == normalize_base_url(DEFAULT_BASE_URL),
    )

    result = run_book_pipeline(
        source_json_path=layout_json_path,
        source_pdf_path=source_pdf_path,
        output_dir=translations_dir,
        output_pdf_path=output_pdf_path,
        api_key=api_key,
        start_page=args.start_page,
        end_page=args.end_page,
        batch_size=args.batch_size,
        workers=args.workers,
        model=args.model,
        base_url=args.base_url,
        mode=args.mode,
        classify_batch_size=args.classify_batch_size,
        skip_title_translation=args.skip_title_translation,
        render_mode=args.render_mode,
        compile_workers=args.compile_workers or None,
        typst_font_family=args.typst_font_family,
        pdf_compress_dpi=args.pdf_compress_dpi,
    )

    summary_path = trans_pdf_dir / "pipeline_summary.json"
    save_json(
        summary_path,
        {
            "job_root": str(job_root),
            "source_pdf": str(source_pdf_path),
            "layout_json": str(layout_json_path),
            "translations_dir": str(result["output_dir"]),
            "output_pdf": str(result["output_pdf_path"]),
            "pages_processed": result["pages_processed"],
            "translated_items_total": result["translated_items_total"],
            "translate_elapsed": result["translate_elapsed"],
            "save_elapsed": result["save_elapsed"],
            "total_elapsed": result["total_elapsed"],
            "mode": args.mode,
            "model": args.model,
            "base_url": args.base_url,
            "render_mode": args.render_mode,
            "pdf_compress_dpi": args.pdf_compress_dpi,
        },
    )

    prune_origin_pdf_dir(job_root / "originPDF", source_pdf_path)
    prune_trans_pdf_dir(job_root / "transPDF", output_pdf_path)
    prune_mineru_json_dir(job_root / "jsonPDF")

    print(f"job root: {job_root}")
    print(f"source pdf: {source_pdf_path}")
    print(f"layout json: {layout_json_path}")
    print(f"translations dir: {result['output_dir']}")
    print(f"output pdf: {result['output_pdf_path']}")
    print(f"summary: {summary_path}")
    print(f"pages processed: {result['pages_processed']}")
    print(f"translated items: {result['translated_items_total']}")
    print(f"translate+render time: {result['translate_elapsed']:.2f}s")
    print(f"save time: {result['save_elapsed']:.2f}s")
    print(f"total time: {result['total_elapsed']:.2f}s")


if __name__ == "__main__":
    main()
