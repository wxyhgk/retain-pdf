import argparse
import json
import time
from pathlib import Path
from typing import Any

import requests
import sys

sys.path.append(str(Path(__file__).resolve().parents[2]))
from foundation.shared.local_env import get_secret


MINERU_BASE_URL = "https://mineru.net"
MINERU_TOKEN_ENV = "MINERU_API_TOKEN"
MINERU_ENV_FILE = "mineru.env"


def build_headers(token: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Authorization": f"Bearer {token}",
    }


def post_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    response = requests.post(url, headers=headers, json=payload, timeout=120)
    response.raise_for_status()
    data = response.json()
    if data.get("code") != 0:
        raise RuntimeError(f"MinerU API error: {data.get('msg', 'unknown error')}")
    return data


def get_json(url: str, headers: dict[str, str]) -> dict[str, Any]:
    response = requests.get(url, headers=headers, timeout=120)
    response.raise_for_status()
    data = response.json()
    if data.get("code") != 0:
        raise RuntimeError(f"MinerU API error: {data.get('msg', 'unknown error')}")
    return data


def create_extract_task(
    *,
    token: str,
    file_url: str,
    model_version: str,
    is_ocr: bool,
    enable_formula: bool,
    enable_table: bool,
    language: str,
    page_ranges: str,
    data_id: str,
    no_cache: bool,
    cache_tolerance: int,
    extra_formats: list[str],
) -> str:
    payload: dict[str, Any] = {
        "url": file_url,
        "model_version": model_version,
        "is_ocr": is_ocr,
        "enable_formula": enable_formula,
        "enable_table": enable_table,
        "language": language,
        "no_cache": no_cache,
        "cache_tolerance": cache_tolerance,
    }
    if page_ranges:
        payload["page_ranges"] = page_ranges
    if data_id:
        payload["data_id"] = data_id
    if extra_formats:
        payload["extra_formats"] = extra_formats
    data = post_json(f"{MINERU_BASE_URL}/api/v4/extract/task", build_headers(token), payload)
    return data["data"]["task_id"]


def apply_upload_url(
    *,
    token: str,
    file_name: str,
    model_version: str,
    data_id: str,
) -> tuple[str, str]:
    payload: dict[str, Any] = {
        "files": [{"name": file_name, "data_id": data_id} if data_id else {"name": file_name}],
        "model_version": model_version,
    }
    data = post_json(f"{MINERU_BASE_URL}/api/v4/file-urls/batch", build_headers(token), payload)
    batch_id = data["data"]["batch_id"]
    file_urls = data["data"]["file_urls"]
    if not file_urls:
        raise RuntimeError("MinerU API did not return any upload URL.")
    return batch_id, file_urls[0]


def upload_file(upload_url: str, file_path: Path) -> None:
    with file_path.open("rb") as f:
        response = requests.put(upload_url, data=f, timeout=300)
    response.raise_for_status()


def query_batch_status(token: str, batch_id: str) -> dict[str, Any]:
    return get_json(f"{MINERU_BASE_URL}/api/v4/extract-results/batch/{batch_id}", build_headers(token))


def find_extract_result_in_batch(batch_data: dict[str, Any], file_name: str) -> dict[str, Any]:
    candidates = batch_data.get("data", {}).get("extract_result", [])
    for item in candidates:
        if item.get("file_name") == file_name:
            return item
    raise RuntimeError("Uploaded file is not visible yet in batch extract results.")


def query_task(token: str, task_id: str) -> dict[str, Any]:
    return get_json(f"{MINERU_BASE_URL}/api/v4/extract/task/{task_id}", build_headers(token))


def poll_until_done(
    *,
    token: str,
    task_id: str,
    interval_seconds: int,
    timeout_seconds: int,
) -> dict[str, Any]:
    started = time.time()
    while True:
        data = query_task(token, task_id)
        state = data.get("data", {}).get("state", "")
        print(f"task {task_id}: state={state}", flush=True)
        if state == "done":
            return data
        if state == "failed":
            err_msg = data.get("data", {}).get("err_msg", "")
            raise RuntimeError(f"MinerU task failed: {err_msg or 'unknown error'}")
        if time.time() - started > timeout_seconds:
            raise TimeoutError(f"Timed out waiting for MinerU task {task_id}")
        time.sleep(interval_seconds)


def parse_extra_formats(value: str) -> list[str]:
    if not value.strip():
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Call MinerU precise parse API via either a remote file URL or a local file upload flow.",
    )
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--file-url", type=str, default="", help="Remote file URL for /api/v4/extract/task.")
    source_group.add_argument("--file-path", type=str, default="", help="Local file path for upload flow via /api/v4/file-urls/batch.")

    parser.add_argument("--token", type=str, default="", help=f"MinerU API token. Prefer scripts/.env/{MINERU_ENV_FILE} or env {MINERU_TOKEN_ENV}.")
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
    parser.add_argument("--poll", action="store_true", help="Poll task state until done.")
    parser.add_argument("--poll-interval", type=int, default=5, help="Seconds between polling requests.")
    parser.add_argument("--poll-timeout", type=int, default=1800, help="Max seconds to wait for completion.")
    parser.add_argument("--output-json", type=str, default="", help="Optional path to save the final JSON response.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    token = get_secret(
        explicit_value=args.token,
        env_var=MINERU_TOKEN_ENV,
        env_file_name=MINERU_ENV_FILE,
    )
    if not token:
        raise RuntimeError(f"Missing MinerU token. Set --token, scripts/.env/{MINERU_ENV_FILE}, or env {MINERU_TOKEN_ENV}.")
    extra_formats = parse_extra_formats(args.extra_formats)
    enable_formula = not args.disable_formula
    enable_table = not args.disable_table

    result: dict[str, Any] | None = None

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
        print(f"task_id: {task_id}")
        if not args.poll:
            return

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
        batch_id, upload_url = apply_upload_url(
            token=token,
            file_name=file_path.name,
            model_version=args.model_version,
            data_id=args.data_id,
        )
        print(f"batch_id: {batch_id}")
        print(f"upload_url: {upload_url}")
        upload_file(upload_url, file_path)
        print(f"upload done: {file_path}")

        if not args.poll:
            return

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
        return
    result_data = result.get("data", {})
    print(json.dumps(result, ensure_ascii=False, indent=2))

    if args.output_json:
        output_path = Path(args.output_json)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"saved: {output_path}")

    full_zip_url = result_data.get("full_zip_url", "")
    if full_zip_url:
        print(f"full_zip_url: {full_zip_url}")


if __name__ == "__main__":
    main()
