from __future__ import annotations

import time
from pathlib import Path

from retainpdf_pipeline.ocr.mineru_provider.mineru_api import apply_upload_url
from retainpdf_pipeline.ocr.mineru_provider.mineru_api import create_extract_task
from retainpdf_pipeline.ocr.mineru_provider.mineru_api import find_extract_result_in_batch
from retainpdf_pipeline.ocr.mineru_provider.mineru_api import poll_until_done
from retainpdf_pipeline.ocr.mineru_provider.mineru_api import query_batch_status
from retainpdf_pipeline.ocr.mineru_provider.mineru_api import task_failed_error
from retainpdf_pipeline.ocr.mineru_provider.mineru_api import upload_file
from retainpdf_pipeline.ocr.retry import stepped_poll_interval


def run_remote_extract_task(
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
    poll_interval: int,
    poll_timeout: int,
) -> dict:
    task_id = create_extract_task(
        token=token,
        file_url=file_url,
        model_version=model_version,
        is_ocr=is_ocr,
        enable_formula=enable_formula,
        enable_table=enable_table,
        language=language,
        page_ranges=page_ranges,
        data_id=data_id,
        no_cache=no_cache,
        cache_tolerance=cache_tolerance,
        extra_formats=extra_formats,
    )
    print(f"task_id: {task_id}")
    return poll_until_done(
        token=token,
        task_id=task_id,
        interval_seconds=poll_interval,
        timeout_seconds=poll_timeout,
    )


def run_local_extract_task(
    *,
    token: str,
    file_path: Path,
    model_version: str,
    data_id: str,
    poll_interval: int,
    poll_timeout: int,
    is_ocr: bool = False,
    enable_formula: bool = True,
    enable_table: bool = True,
    language: str = "ch",
    page_ranges: str = "",
    extra_formats: list[str] | None = None,
) -> dict:
    batch_id, upload_url = apply_upload_url(
        token=token,
        file_name=file_path.name,
        model_version=model_version,
        data_id=data_id,
        is_ocr=is_ocr,
        enable_formula=enable_formula,
        enable_table=enable_table,
        language=language,
        page_ranges=page_ranges,
        extra_formats=extra_formats,
    )
    print(f"batch_id: {batch_id}")
    upload_file(upload_url, file_path)
    print(f"upload done: {file_path}")
    started = time.time()
    while True:
        batch_status = query_batch_status(token, batch_id)
        try:
            extract_result = find_extract_result_in_batch(batch_status, file_path.name)
        except RuntimeError:
            elapsed = time.time() - started
            if elapsed > poll_timeout:
                raise TimeoutError(f"Timed out waiting for MinerU batch result: {batch_id}")
            print(f"batch {batch_id}: waiting for extract_result", flush=True)
            time.sleep(stepped_poll_interval(elapsed, poll_interval))
            continue

        state = extract_result.get("state", "")
        print(f"batch {batch_id}: state={state}", flush=True)
        if state == "done":
            return {"code": 0, "data": extract_result, "msg": "ok"}
        if state == "failed":
            err_msg = extract_result.get("err_msg", "")
            raise task_failed_error(f"MinerU batch task failed: {err_msg or 'unknown error'}", err_msg)
        elapsed = time.time() - started
        if elapsed > poll_timeout:
            raise TimeoutError(f"Timed out waiting for MinerU batch result: {batch_id}")
        time.sleep(stepped_poll_interval(elapsed, poll_interval))
