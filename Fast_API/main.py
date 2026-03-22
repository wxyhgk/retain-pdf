from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .executor import build_job_download_zip
from .executor import list_jobs
from .executor import load_job
from .executor import status_payload
from .executor import submit_job
from .models import JobStatus
from .models import RunCaseRequest
from .models import RunMinerUCaseRequest
from .models import SubmitJobResponse
from .models import UPLOADS_DIR
from .models import build_timestamp_job_id


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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/run-case", response_model=SubmitJobResponse)
async def run_case(request: RunCaseRequest) -> SubmitJobResponse:
    return submit_job("run-case", request.to_command(), request.model_dump())


@app.post("/v1/run-mineru-case", response_model=SubmitJobResponse)
async def run_mineru_case(request: RunMinerUCaseRequest) -> SubmitJobResponse:
    return submit_job("run-mineru-case", request.to_command(), request.model_dump())


@app.post("/v1/run-mineru-case-upload", response_model=SubmitJobResponse)
@app.post("/v1/upload-mineru-case", response_model=SubmitJobResponse)
async def upload_mineru_case(
    file: UploadFile = File(...),
    mode: str = Form("sci"),
    skip_title_translation: bool = Form(False),
    classify_batch_size: int = Form(12),
    api_key: str = Form(""),
    model: str = Form("deepseek-chat"),
    base_url: str = Form("https://api.deepseek.com/v1"),
    render_mode: str = Form("typst"),
    compile_workers: int = Form(0),
    typst_font_family: str = Form("Noto Serif CJK SC"),
    pdf_compress_dpi: int = Form(200),
    start_page: int = Form(0),
    end_page: int = Form(-1),
    batch_size: int = Form(6),
    workers: int = Form(4),
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
