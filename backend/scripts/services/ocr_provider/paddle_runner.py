from __future__ import annotations

import inspect
from pathlib import Path
from types import SimpleNamespace
from typing import Callable

import fitz

from foundation.shared.job_dirs import job_dirs_from_explicit_args
from services.document_schema import DOCUMENT_SCHEMA_REPORT_FILE_NAME
from services.ocr_provider.paddle_api import PADDLE_BASE_URL
from services.ocr_provider.paddle_api import build_optional_payload
from services.ocr_provider.paddle_api import download_jsonl_result
from services.ocr_provider.paddle_api import get_paddle_token
from services.ocr_provider.paddle_api import normalize_model_name
from services.ocr_provider.paddle_api import poll_until_done
from services.ocr_provider.paddle_api import submit_local_file
from services.ocr_provider.paddle_api import submit_remote_url
from services.ocr_provider.paddle_markdown import materialize_paddle_markdown_artifacts
from services.ocr_provider.paddle_normalize import save_normalized_document_for_paddle
from services.pipeline_shared.events import emit_stage_progress
from services.pipeline_shared.events import emit_stage_transition
from services.pipeline_shared.io import save_json

DownloadSourcePdfFn = Callable[[str, Path], Path]
GetTokenFn = Callable[..., str]
SubmitRemoteFn = Callable[..., tuple[str, str]]
SubmitLocalFn = Callable[..., tuple[str, str]]
PollFn = Callable[..., tuple[dict, str]]
DownloadJsonlFn = Callable[..., dict]
MaterializeMarkdownFn = Callable[..., Path | None]
SaveNormalizedFn = Callable[..., None]
SaveJsonFn = Callable[[Path, object], None]
NormalizeModelNameFn = Callable[[str], str]
BuildOptionalPayloadFn = Callable[[str], dict]


def _pdf_page_count(path: Path) -> int | None:
    try:
        with fitz.open(path) as doc:
            return len(doc)
    except Exception:
        return None


def _emit_paddle_poll_progress(
    *,
    state: str,
    payload: dict,
    task_id: str,
    page_total: int | None,
) -> None:
    current = page_total if state == "done" and page_total is not None else None
    detail = f"Paddle 正在解析文件，共 {page_total} 页" if page_total else "Paddle 正在解析文件"
    if state == "done" and page_total:
        detail = f"Paddle 解析完成，共 {page_total} 页"
    emit_stage_progress(
        stage="ocr_processing",
        message=detail,
        stage_detail=detail,
        provider="paddle",
        provider_stage="provider_processing",
        progress_current=current,
        progress_total=page_total,
        payload={
            "substage": "provider_processing",
            "provider_task_id": task_id,
            "provider_state": state,
            "provider_log_id": str(payload.get("logId", "") or "").strip(),
        },
    )


def _poll_until_complete_with_optional_progress(
    poll_until_complete: PollFn,
    *,
    token: str,
    job_id: str,
    poll_interval: int,
    poll_timeout: int,
    base_url: str,
    progress_callback: Callable[[str, dict], None],
) -> tuple[dict, str]:
    kwargs = {
        "token": token,
        "job_id": job_id,
        "poll_interval": poll_interval,
        "poll_timeout": poll_timeout,
        "base_url": base_url,
    }
    signature = inspect.signature(poll_until_complete)
    accepts_kwargs = any(
        parameter.kind == inspect.Parameter.VAR_KEYWORD
        for parameter in signature.parameters.values()
    )
    if "progress_callback" in signature.parameters or accepts_kwargs:
        kwargs["progress_callback"] = progress_callback
    return poll_until_complete(**kwargs)


def run_paddle_to_job_dir(
    args: SimpleNamespace,
    *,
    download_source_pdf: DownloadSourcePdfFn,
    get_token: GetTokenFn = get_paddle_token,
    submit_remote: SubmitRemoteFn = submit_remote_url,
    submit_local: SubmitLocalFn = submit_local_file,
    poll_until_complete: PollFn = poll_until_done,
    download_jsonl: DownloadJsonlFn = download_jsonl_result,
    materialize_markdown: MaterializeMarkdownFn = materialize_paddle_markdown_artifacts,
    save_normalized_document: SaveNormalizedFn = save_normalized_document_for_paddle,
    save_json_file: SaveJsonFn = save_json,
    normalize_model: NormalizeModelNameFn = normalize_model_name,
    build_optional_request_payload: BuildOptionalPayloadFn = build_optional_payload,
) -> tuple[Path, Path, Path, Path]:
    paddle_token = get_token(explicit_value=args.paddle_token)
    if not paddle_token:
        raise RuntimeError("Missing Paddle token. Set RETAIN_PADDLE_API_TOKEN or backend/scripts/.env/paddle.env.")
    job_dirs = job_dirs_from_explicit_args(args)
    provider_result_json_path = job_dirs.ocr_dir / "result.json"
    normalized_json_path = job_dirs.ocr_dir / "normalized" / "document.v1.json"
    normalized_report_json_path = job_dirs.ocr_dir / "normalized" / DOCUMENT_SCHEMA_REPORT_FILE_NAME
    source_dir = job_dirs.source_dir
    base_url = args.paddle_api_url or PADDLE_BASE_URL
    model_name = normalize_model(args.paddle_model)
    optional_payload = build_optional_request_payload(args.paddle_model)
    if str(args.file_url or "").strip():
        source_pdf_path = download_source_pdf(str(args.file_url).strip(), source_dir)
        task_id, trace_id = submit_remote(
            token=paddle_token,
            source_url=str(args.file_url).strip(),
            model=model_name,
            optional_payload=optional_payload,
            base_url=base_url,
        )
    else:
        source_pdf_path = Path(args.file_path).resolve()
        task_id, trace_id = submit_local(
            token=paddle_token,
            file_path=source_pdf_path,
            model=model_name,
            optional_payload=optional_payload,
            base_url=base_url,
        )
    print(f"job dir: {job_dirs.root}", flush=True)
    print(f"task_id: {task_id}", flush=True)
    if trace_id:
        print(f"trace_id: {trace_id}", flush=True)
    page_total = _pdf_page_count(source_pdf_path)
    if page_total:
        emit_stage_transition(
            stage="ocr_processing",
            message=f"OCR 正在解析，共 {page_total} 页",
            stage_detail=f"OCR 正在解析，共 {page_total} 页",
            provider="paddle",
            provider_stage="provider_processing",
            progress_current=None,
            progress_total=page_total,
            payload={
                "substage": "provider_processing",
                "provider_task_id": task_id,
            },
        )
    _, jsonl_url = _poll_until_complete_with_optional_progress(
        poll_until_complete,
        token=paddle_token,
        job_id=task_id,
        poll_interval=args.poll_interval,
        poll_timeout=args.poll_timeout,
        base_url=base_url,
        progress_callback=lambda state, payload: _emit_paddle_poll_progress(
            state=state,
            payload=payload,
            task_id=task_id,
            page_total=page_total,
        ),
    )
    payload = download_jsonl(jsonl_url=jsonl_url)
    meta = dict(payload.get("_meta") or {})
    meta["provider"] = "paddle"
    meta["taskId"] = task_id
    meta["jsonlUrl"] = jsonl_url
    if trace_id:
        meta["traceId"] = trace_id
    payload["_meta"] = meta
    save_json_file(provider_result_json_path, payload)
    markdown_path = materialize_markdown(payload=payload, job_root=job_dirs.root)
    if markdown_path is not None:
        print(f"published markdown: {markdown_path}", flush=True)
    save_normalized_document(
        provider_result_json_path=provider_result_json_path,
        source_pdf_path=source_pdf_path,
        normalized_json_path=normalized_json_path,
        normalized_report_json_path=normalized_report_json_path,
        document_id=job_dirs.root.name,
        provider_version=model_name,
    )
    print(f"source: {job_dirs.source_dir}", flush=True)
    print(f"ocr: {job_dirs.ocr_dir}", flush=True)
    print(f"translated: {job_dirs.translated_dir}", flush=True)
    print(f"rendered: {job_dirs.rendered_dir}", flush=True)
    print(f"artifacts: {job_dirs.artifacts_dir}", flush=True)
    print(f"logs: {job_dirs.logs_dir}", flush=True)
    return job_dirs.root, source_pdf_path, provider_result_json_path, normalized_json_path
