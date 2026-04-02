from __future__ import annotations

import json
import time
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pypdf import PdfReader

from .executor import build_job_download_zip
from .executor import list_jobs
from .executor import load_job
from .executor import status_payload
from .executor import submit_job
from .models import JobStatus
from .models import RuleProfileDetail
from .models import RuleProfileSummary
from .models import RunCaseRequest
from .models import RunMinerUCaseRequest
from .models import RunUploadedMinerUCaseRequest
from .models import SubmitJobResponse
from .models import UpsertRuleProfileRequest
from .models import UploadPdfResponse
from .models import UPLOADS_DIR
from .models import build_timestamp_job_id
from .rule_profile_store import init_rule_profile_db
from .rule_profile_store import list_rule_profiles
from .rule_profile_store import load_rule_profile
from .rule_profile_store import save_rule_profile

NORMAL_MAX_BYTES = 10 * 1024 * 1024
NORMAL_MAX_PAGES = 30


app = FastAPI(
    title="OCR Translation API",
    version="1.1.0",
    description="FastAPI wrapper around the stable OCR translation and MinerU pipelines.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_rule_profile_db()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/rule-profiles", response_model=list[RuleProfileSummary])
async def get_rule_profiles() -> list[RuleProfileSummary]:
    return [
        RuleProfileSummary(
            name=str(item["name"]),
            display_name=str(item["display_name"]),
            description=str(item.get("description", "") or ""),
            built_in=bool(item.get("built_in", False)),
            created_at=str(item.get("created_at", "") or ""),
            updated_at=str(item.get("updated_at", "") or ""),
        )
        for item in list_rule_profiles()
    ]


@app.get("/v1/rule-profiles/{name}", response_model=RuleProfileDetail)
async def get_rule_profile(name: str) -> RuleProfileDetail:
    try:
        item = load_rule_profile(name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"rule profile not found: {name}") from exc
    return RuleProfileDetail(
        name=str(item["name"]),
        display_name=str(item["display_name"]),
        description=str(item.get("description", "") or ""),
        built_in=bool(item.get("built_in", False)),
        created_at=str(item.get("created_at", "") or ""),
        updated_at=str(item.get("updated_at", "") or ""),
        profile_text=str(item.get("profile_text", "") or ""),
    )


@app.post("/v1/rule-profiles", response_model=RuleProfileDetail)
async def put_rule_profile(request: UpsertRuleProfileRequest) -> RuleProfileDetail:
    try:
        item = save_rule_profile(
            request.name,
            request.profile_text,
            description=request.description,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RuleProfileDetail(
        name=str(item["name"]),
        display_name=str(item["display_name"]),
        description=str(item.get("description", "") or ""),
        built_in=bool(item.get("built_in", False)),
        created_at=str(item.get("created_at", "") or ""),
        updated_at=str(item.get("updated_at", "") or ""),
        profile_text=str(item.get("profile_text", "") or ""),
    )


@app.post("/v1/run-case", response_model=SubmitJobResponse)
async def run_case(request: RunCaseRequest) -> SubmitJobResponse:
    resolved_job_id = request.job_id.strip() or build_timestamp_job_id()
    resolved_request = request.model_copy(update={"job_id": resolved_job_id})
    request_payload = resolved_request.model_dump()
    return submit_job(
        "run-case",
        resolved_request.to_command(),
        request_payload,
        job_id=resolved_job_id,
    )


@app.post("/v1/run-mineru-case", response_model=SubmitJobResponse)
async def run_mineru_case(request: RunMinerUCaseRequest) -> SubmitJobResponse:
    resolved_job_id = request.job_id.strip() or build_timestamp_job_id()
    resolved_request = request.model_copy(update={"job_id": resolved_job_id})
    request_payload = resolved_request.model_dump()
    return submit_job(
        "run-mineru-case",
        resolved_request.to_command(),
        request_payload,
        job_id=resolved_job_id,
    )


def _upload_dir(upload_id: str) -> Path:
    return UPLOADS_DIR / upload_id


def _upload_meta_path(upload_id: str) -> Path:
    return _upload_dir(upload_id) / "upload.json"


def _load_uploaded_pdf(upload_id: str) -> dict:
    meta_path = _upload_meta_path(upload_id)
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail=f"upload not found: {upload_id}")
    return json.loads(meta_path.read_text(encoding="utf-8"))


def _write_upload_meta(upload_id: str, payload: dict) -> None:
    meta_path = _upload_meta_path(upload_id)
    meta_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


@app.post("/v1/uploads/pdf", response_model=UploadPdfResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    developer_mode: bool = Form(False),
) -> UploadPdfResponse:
    filename = Path(file.filename or "upload.pdf").name
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="uploaded file must be a PDF")

    upload_id = build_timestamp_job_id()
    upload_dir = _upload_dir(upload_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    upload_path = upload_dir / filename
    byte_count = 0
    with upload_path.open("wb") as f:
        while chunk := await file.read(1024 * 1024):
            byte_count += len(chunk)
            f.write(chunk)
    await file.close()

    try:
        reader = PdfReader(str(upload_path))
        page_count = len(reader.pages)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"invalid pdf: {exc}") from exc

    if not developer_mode:
        if byte_count > NORMAL_MAX_BYTES:
            raise HTTPException(status_code=400, detail="普通用户仅支持 10MB 以内 PDF")
        if page_count > NORMAL_MAX_PAGES:
            raise HTTPException(status_code=400, detail="普通用户仅支持 30 页以内 PDF")

    payload = {
        "upload_id": upload_id,
        "filename": filename,
        "path": str(upload_path),
        "bytes": byte_count,
        "page_count": page_count,
        "uploaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "developer_mode": bool(developer_mode),
    }
    _write_upload_meta(upload_id, payload)
    return UploadPdfResponse(
        upload_id=upload_id,
        filename=filename,
        bytes=byte_count,
        page_count=page_count,
        uploaded_at=payload["uploaded_at"],
    )


@app.post("/v1/run-uploaded-mineru-case", response_model=SubmitJobResponse)
async def run_uploaded_mineru_case(request: RunUploadedMinerUCaseRequest) -> SubmitJobResponse:
    uploaded = _load_uploaded_pdf(request.upload_id)
    file_path = str(uploaded.get("path", "") or "")
    if not file_path or not Path(file_path).exists():
        raise HTTPException(status_code=404, detail=f"uploaded file missing: {request.upload_id}")
    resolved_job_id = request.job_id.strip() or request.upload_id.strip()
    resolved_request = request.model_copy(update={"job_id": resolved_job_id})
    request_payload = resolved_request.model_dump()
    request_payload["uploaded_file"] = file_path
    request_payload["uploaded_filename"] = uploaded.get("filename", "")
    request_payload["page_count"] = uploaded.get("page_count")
    request_payload["bytes"] = uploaded.get("bytes")
    return submit_job(
        "run-mineru-case",
        resolved_request.to_command(file_path=file_path),
        request_payload,
        job_id=resolved_job_id,
    )


@app.post("/v1/run-mineru-case-upload", response_model=SubmitJobResponse)
@app.post("/v1/upload-mineru-case", response_model=SubmitJobResponse)
async def upload_mineru_case(
    file: UploadFile = File(...),
    mode: str = Form("sci"),
    skip_title_translation: bool = Form(False),
    classify_batch_size: int = Form(12),
    rule_profile_name: str = Form("general_sci"),
    custom_rules_text: str = Form(""),
    api_key: str = Form(""),
    model: str = Form("deepseek-chat"),
    base_url: str = Form("https://api.deepseek.com/v1"),
    render_mode: str = Form("auto"),
    compile_workers: int = Form(0),
    typst_font_family: str = Form("Source Han Serif SC"),
    pdf_compress_dpi: int = Form(200),
    start_page: int = Form(0),
    end_page: int = Form(-1),
    batch_size: int = Form(1),
    workers: int = Form(0),
    output_root: str = Form("output"),
    translated_pdf_name: str = Form(""),
    mineru_token: str = Form(""),
    model_version: str = Form("vlm"),
    is_ocr: bool = Form(False),
    disable_formula: bool = Form(False),
    disable_table: bool = Form(False),
    language: str = Form("ch"),
    page_ranges: str = Form(""),
    data_id: str = Form(""),
    no_cache: bool = Form(False),
    cache_tolerance: int = Form(900),
    extra_formats: str = Form(""),
    poll_interval: int = Form(5),
    poll_timeout: int = Form(1800),
    body_font_size_factor: float = Form(0.95),
    body_leading_factor: float = Form(1.08),
    inner_bbox_shrink_x: float = Form(0.035),
    inner_bbox_shrink_y: float = Form(0.04),
    inner_bbox_dense_shrink_x: float = Form(0.025),
    inner_bbox_dense_shrink_y: float = Form(0.03),
) -> SubmitJobResponse:
    filename = Path(file.filename or "upload.pdf").name
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="uploaded file must be a PDF")

    job_id = build_timestamp_job_id()
    upload_dir = UPLOADS_DIR / job_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    upload_path = upload_dir / filename
    with upload_path.open("wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)
    await file.close()

    try:
        request = RunMinerUCaseRequest(
            file_path=str(upload_path),
            mode=mode,
            skip_title_translation=skip_title_translation,
            classify_batch_size=classify_batch_size,
            rule_profile_name=rule_profile_name,
            custom_rules_text=custom_rules_text,
            api_key=api_key,
            model=model,
            base_url=base_url,
            render_mode=render_mode,
            compile_workers=compile_workers,
            typst_font_family=typst_font_family,
            pdf_compress_dpi=pdf_compress_dpi,
            start_page=start_page,
            end_page=end_page,
            batch_size=batch_size,
            workers=workers,
            output_root=output_root,
            translated_pdf_name=translated_pdf_name,
            mineru_token=mineru_token,
            model_version=model_version,
            is_ocr=is_ocr,
            disable_formula=disable_formula,
            disable_table=disable_table,
            language=language,
            page_ranges=page_ranges,
            data_id=data_id,
            no_cache=no_cache,
            cache_tolerance=cache_tolerance,
            extra_formats=extra_formats,
            poll_interval=poll_interval,
            poll_timeout=poll_timeout,
            body_font_size_factor=body_font_size_factor,
            body_leading_factor=body_leading_factor,
            inner_bbox_shrink_x=inner_bbox_shrink_x,
            inner_bbox_shrink_y=inner_bbox_shrink_y,
            inner_bbox_dense_shrink_x=inner_bbox_dense_shrink_x,
            inner_bbox_dense_shrink_y=inner_bbox_dense_shrink_y,
            job_id=job_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    request_payload = request.model_dump()
    request_payload["uploaded_file"] = str(upload_path)
    request_payload["uploaded_filename"] = filename
    return submit_job("run-mineru-case", request.to_command(), request_payload, job_id=job_id)


@app.get("/v1/jobs/{job_id}", response_model=JobStatus)
async def get_job(job_id: str) -> JobStatus:
    try:
        return status_payload(load_job(job_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"job not found: {job_id}") from exc


@app.get("/v1/jobs/{job_id}/download")
async def download_job_bundle(job_id: str) -> FileResponse:
    try:
        record = load_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"job not found: {job_id}") from exc

    try:
        zip_path = build_job_download_zip(record)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename=f"{job_id}.zip",
    )


@app.get("/v1/jobs", response_model=list[JobStatus])
async def get_jobs(limit: int = Query(default=20, ge=1, le=200)) -> list[JobStatus]:
    return [status_payload(record) for record in list_jobs(limit=limit)]
