from __future__ import annotations

import inspect
import json
import os
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from typing import Callable

import fitz

from retainpdf_pipeline.foundation.shared.job_dirs import job_dirs_from_explicit_args
from retainpdf_pipeline.ocr.document_schema import DOCUMENT_SCHEMA_REPORT_FILE_NAME
from retainpdf_pipeline.ocr.ocr_provider.paddle_api import PADDLE_BASE_URL
from retainpdf_pipeline.ocr.ocr_provider.paddle_api import build_optional_payload
from retainpdf_pipeline.ocr.ocr_provider.paddle_api import download_jsonl_result
from retainpdf_pipeline.ocr.ocr_provider.paddle_api import get_paddle_token
from retainpdf_pipeline.ocr.ocr_provider.paddle_api import normalize_model_name
from retainpdf_pipeline.ocr.ocr_provider.paddle_api import poll_until_done
from retainpdf_pipeline.ocr.ocr_provider.paddle_api import submit_local_file
from retainpdf_pipeline.ocr.ocr_provider.paddle_api import submit_remote_url
from retainpdf_pipeline.ocr.ocr_provider.paddle_cli import PaddleCliArtifacts
from retainpdf_pipeline.ocr.ocr_provider.paddle_cli import paddle_cli_payload_for_document_schema
from retainpdf_pipeline.ocr.ocr_provider.paddle_cli import run_paddle_cli
from retainpdf_pipeline.ocr.ocr_provider.paddle_markdown import materialize_paddle_markdown_artifacts
from retainpdf_pipeline.ocr.ocr_provider.paddle_normalize import save_normalized_document_for_paddle
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_transition
from retainpdf_pipeline.services.pipeline_shared.io import save_json

DownloadSourcePdfFn = Callable[[str, Path], Path]
GetTokenFn = Callable[..., str]
SubmitRemoteFn = Callable[..., tuple[str, str]]
SubmitLocalFn = Callable[..., tuple[str, str]]
PollFn = Callable[..., tuple[dict, str]]
DownloadJsonlFn = Callable[..., dict]
MaterializeMarkdownFn = Callable[..., Path | None]
SaveNormalizedFn = Callable[..., None]
SaveJsonFn = Callable[..., None]
NormalizeModelNameFn = Callable[[str], str]
BuildOptionalPayloadFn = Callable[[str], dict]
RunCliFn = Callable[..., PaddleCliArtifacts]

PADDLE_TRANSPORT_ENV = "RETAIN_PADDLE_TRANSPORT"
PADDLE_TRANSPORT_OFFICIAL_HTTP = "official_http"
PADDLE_TRANSPORT_OFFICIAL_CLI = "official_cli"


def resolve_paddle_transport(args: SimpleNamespace) -> str:
    options = getattr(args, "ocr_provider_options", None)
    configured = (
        str(options.get("transport", "") or "").strip()
        if isinstance(options, dict)
        else ""
    )
    value = (
        configured
        or os.environ.get(PADDLE_TRANSPORT_ENV, "")
        or PADDLE_TRANSPORT_OFFICIAL_HTTP
    ).strip().lower()
    aliases = {
        "http": PADDLE_TRANSPORT_OFFICIAL_HTTP,
        "official": PADDLE_TRANSPORT_OFFICIAL_HTTP,
        "official-http": PADDLE_TRANSPORT_OFFICIAL_HTTP,
        "cli": PADDLE_TRANSPORT_OFFICIAL_CLI,
        "official-cli": PADDLE_TRANSPORT_OFFICIAL_CLI,
        # Backward compatibility for stage specs written before the transport
        # was accurately named. This has always used Paddle's official HTTP API.
        "legacy": PADDLE_TRANSPORT_OFFICIAL_HTTP,
    }
    value = aliases.get(value, value)
    if value not in {PADDLE_TRANSPORT_OFFICIAL_HTTP, PADDLE_TRANSPORT_OFFICIAL_CLI}:
        raise RuntimeError(
            f"unsupported Paddle transport: {value}; expected official_http or official_cli"
        )
    return value


def _pdf_page_count(path: Path) -> int | None:
    try:
        with fitz.open(path) as doc:
            return len(doc)
    except Exception:
        return None


def _pdf_page_sizes(path: Path) -> list[tuple[float, float]]:
    try:
        with fitz.open(path) as doc:
            return [(float(page.rect.width), float(page.rect.height)) for page in doc]
    except Exception:
        return []


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
        substage="ocr_processing",
        message=detail,
        stage_detail=detail,
        provider="paddle",
        provider_stage="provider_processing",
        progress_current=current,
        progress_total=page_total,
        payload={
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
    run_cli: RunCliFn = run_paddle_cli,
) -> tuple[Path, Path, Path, Path]:
    paddle_token = get_token(explicit_value=args.paddle_token)
    if not paddle_token:
        raise RuntimeError(
            "Missing Paddle token. Set RETAIN_PADDLE_API_TOKEN or "
            "backend/pipeline/.env/paddle.env."
        )
    job_dirs = job_dirs_from_explicit_args(args)
    provider_result_json_path = job_dirs.ocr_dir / "result.json"
    normalized_json_path = job_dirs.ocr_dir / "normalized" / "document.v1.json"
    normalized_report_json_path = job_dirs.ocr_dir / "normalized" / DOCUMENT_SCHEMA_REPORT_FILE_NAME
    source_dir = job_dirs.source_dir
    base_url = args.paddle_api_url or PADDLE_BASE_URL
    model_name = normalize_model(args.paddle_model)
    optional_payload = build_optional_request_payload(args.paddle_model)
    transport = resolve_paddle_transport(args)
    if transport == PADDLE_TRANSPORT_OFFICIAL_CLI:
        workflow = str(getattr(args, "workflow", "") or "").strip().lower()
        if workflow != "ocr":
            raise RuntimeError(
                "PaddleOCR official_cli is limited to the OCR-only workflow; "
                "use official_http for book/translate so rendering keeps block-level layout geometry"
            )
    if str(args.file_url or "").strip():
        source_pdf_path = download_source_pdf(str(args.file_url).strip(), source_dir)
    else:
        source_pdf_path = Path(args.file_path).resolve()
    page_total = _pdf_page_count(source_pdf_path)

    def emit_initial_progress(provider_task_id: str) -> None:
        if not page_total:
            return
        emit_stage_transition(
            stage="ocr_processing",
            substage="ocr_processing",
            message=f"OCR 正在解析，共 {page_total} 页",
            stage_detail=f"OCR 正在解析，共 {page_total} 页",
            provider="paddle",
            provider_stage="provider_processing",
            progress_current=None,
            progress_total=page_total,
            payload={"provider_task_id": provider_task_id},
        )

    trace_id = ""
    jsonl_url = ""
    cli_artifacts: PaddleCliArtifacts | None = None
    if transport == PADDLE_TRANSPORT_OFFICIAL_CLI:
        emit_stage_transition(
            stage="ocr_processing",
            substage="ocr_processing",
            message="正在通过 PaddleOCR CLI 解析文件",
            stage_detail="正在通过 PaddleOCR CLI 解析文件",
            provider="paddle",
            provider_stage="provider_processing",
            progress_current=None,
            progress_total=page_total,
            payload={"transport": transport},
        )
        cli_artifacts = run_cli(
            args=args,
            source_pdf_path=source_pdf_path,
            token=paddle_token,
            model_name=model_name,
            raw_root=job_dirs.ocr_dir / "paddle_cli",
        )
        payload = paddle_cli_payload_for_document_schema(
            artifacts=cli_artifacts,
            pdf_page_sizes=_pdf_page_sizes(source_pdf_path),
        )
        task_id = str(cli_artifacts.payload.get("jobId", "") or "paddle-cli")
        _emit_paddle_poll_progress(
            state="done",
            payload={},
            task_id=task_id,
            page_total=page_total,
        )
    else:
        page_ranges = str(getattr(args, "page_ranges", "") or "").strip()
        if str(args.file_url or "").strip():
            task_id, trace_id = submit_remote(
                token=paddle_token,
                source_url=str(args.file_url).strip(),
                model=model_name,
                optional_payload=optional_payload,
                page_ranges=page_ranges,
                base_url=base_url,
            )
        else:
            task_id, trace_id = submit_local(
                token=paddle_token,
                file_path=source_pdf_path,
                model=model_name,
                optional_payload=optional_payload,
                page_ranges=page_ranges,
                base_url=base_url,
            )
        emit_initial_progress(task_id)
        _, jsonl_url = _poll_until_complete_with_optional_progress(
            poll_until_complete,
            token=paddle_token,
            job_id=task_id,
            poll_interval=args.poll_interval,
            poll_timeout=args.poll_timeout,
            base_url=base_url,
            progress_callback=lambda state, poll_payload: _emit_paddle_poll_progress(
                state=state,
                payload=poll_payload,
                task_id=task_id,
                page_total=page_total,
            ),
        )
        payload = download_jsonl(jsonl_url=jsonl_url)
    print(f"job dir: {job_dirs.root}", flush=True)
    print(f"task_id: {task_id}", flush=True)
    if trace_id:
        print(f"trace_id: {trace_id}", flush=True)
    meta = dict(payload.get("_meta") or {})
    meta["provider"] = "paddle"
    meta["taskId"] = task_id
    meta["transport"] = transport
    if jsonl_url:
        meta["jsonlUrl"] = jsonl_url
    if trace_id:
        meta["traceId"] = trace_id
    payload["_meta"] = meta
    # The Paddle payload can embed base64 page images — write it compact.
    save_json_file(provider_result_json_path, payload, compact=True)
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
        provider_payload=payload,
    )
    if cli_artifacts is not None:
        _annotate_cli_normalization_report(
            normalized_report_json_path,
            model_type=cli_artifacts.model_type,
        )
    print(f"source: {job_dirs.source_dir}", flush=True)
    print(f"ocr: {job_dirs.ocr_dir}", flush=True)
    print(f"translated: {job_dirs.translated_dir}", flush=True)
    print(f"rendered: {job_dirs.rendered_dir}", flush=True)
    print(f"artifacts: {job_dirs.artifacts_dir}", flush=True)
    print(f"logs: {job_dirs.logs_dir}", flush=True)
    return job_dirs.root, source_pdf_path, provider_result_json_path, normalized_json_path


def _annotate_cli_normalization_report(path: Path, *, model_type: str) -> None:
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    if not isinstance(report, dict):
        return
    save_json(path, apply_cli_normalization_report_semantics(report, model_type=model_type))


def apply_cli_normalization_report_semantics(
    report: dict,
    *,
    model_type: str,
) -> dict:
    """Preserve the official CLI geometry contract on rebuilt reports.

    ``doc_parsing`` deliberately carries only page-level geometry, so a generic
    document.v1 validation pass must not make its report look block-complete.
    This pure helper is shared by the live runner and offline rebuild tooling.
    """
    annotated = deepcopy(report)
    geometry_precision = "block_bbox" if model_type == "ocr" else "page_bbox"
    annotated["transport"] = PADDLE_TRANSPORT_OFFICIAL_CLI
    annotated["cli_model_type"] = model_type
    annotated["geometry_precision"] = geometry_precision
    if geometry_precision == "page_bbox":
        annotated["complete"] = False
        warning = (
            "PaddleOCR CLI doc_parsing output omits prunedResult/bbox; "
            "text geometry is represented only by its containing page"
        )
        warnings = list(annotated.get("warnings") or [])
        if warning not in warnings:
            warnings.append(warning)
        annotated["warnings"] = warnings
        validation = annotated.get("validation")
        if isinstance(validation, dict):
            validation["complete"] = False
            validation_warnings = list(validation.get("warnings") or [])
            if warning not in validation_warnings:
                validation_warnings.append(warning)
            validation["warnings"] = validation_warnings
    return annotated
