from __future__ import annotations

import time
import uuid
import sys
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator, model_validator


BACKEND_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_ROOT.parent if BACKEND_ROOT.name == "backend" else BACKEND_ROOT
RUN_CASE_SCRIPT = BACKEND_ROOT / "scripts" / "run_case.py"
RUN_MINERU_CASE_SCRIPT = BACKEND_ROOT / "scripts" / "run_mineru_case.py"
LEGACY_FASTAPI_DATA_DIR = PROJECT_ROOT / "data" / "legacy_fastapi"
UPLOADS_DIR = LEGACY_FASTAPI_DATA_DIR / "uploads"
DOWNLOADS_DIR = LEGACY_FASTAPI_DATA_DIR / "downloads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _strip_output_prefix(value: str) -> str:
    text = value.strip().replace("\\", "/").strip("/")
    if not text:
        return ""
    if text in {"output", "data"}:
        return ""
    if text.startswith("output/"):
        return text[len("output/") :]
    if text.startswith("data/"):
        return text[len("data/") :]
    return text


def build_timestamp_job_id() -> str:
    return f"{time.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"


def _normalize_base_url(value: str) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    return text.rstrip("/").lower()


def _is_deepseek_endpoint(base_url: str, model: str) -> bool:
    normalized = _normalize_base_url(base_url)
    model_text = (model or "").strip().lower()
    if "deepseek" in model_text:
        return True
    if not normalized:
        return False
    parsed = urlparse(normalized if "://" in normalized else f"https://{normalized}")
    host = (parsed.netloc or parsed.path or "").lower()
    return "deepseek.com" in host


def resolve_translation_workers(workers: int, *, base_url: str, model: str) -> int:
    if workers > 0:
        return workers
    if _is_deepseek_endpoint(base_url, model):
        return 100
    return 4


class LayoutTuningParams(BaseModel):
    body_font_size_factor: float = Field(default=0.95, description="Body font size scaling factor.")
    body_leading_factor: float = Field(default=1.08, description="Body leading scaling factor.")
    inner_bbox_shrink_x: float = Field(default=0.035, description="Inner bbox shrink factor in X.")
    inner_bbox_shrink_y: float = Field(default=0.04, description="Inner bbox shrink factor in Y.")
    inner_bbox_dense_shrink_x: float = Field(default=0.025, description="Dense inner bbox shrink factor in X.")
    inner_bbox_dense_shrink_y: float = Field(default=0.03, description="Dense inner bbox shrink factor in Y.")


class TranslationRenderParams(BaseModel):
    start_page: int = Field(default=0, ge=0, description="Zero-based start page index.")
    end_page: int = Field(default=-1, description="Zero-based end page index; -1 means the last page.")
    batch_size: int = Field(default=1, ge=1, description="Number of text items per translation batch.")
    workers: int = Field(default=0, ge=0, description="Concurrent translation requests. 0 means auto: DeepSeek=100, local-compatible APIs=4.")
    mode: Literal["fast", "precise", "sci"] = Field(default="sci", description="Translation mode.")
    skip_title_translation: bool = Field(
        default=False,
        description="Whether to skip title blocks. false=translate titles, true=skip title translation.",
    )
    classify_batch_size: int = Field(default=12, ge=1, description="Classification batch size.")
    rule_profile_name: str = Field(default="general_sci", description="Built-in rule profile name.")
    custom_rules_text: str = Field(default="", description="Optional extra rule text injected into model context.")
    api_key: str = Field(default="", description="Translation API key.")
    model: str = Field(default="deepseek-chat", description="Translation model name.")
    base_url: str = Field(default="https://api.deepseek.com/v1", description="OpenAI-compatible API base URL.")
    render_mode: Literal["auto", "overlay", "compact", "direct", "typst", "dual"] = Field(
        default="auto",
        description="Rendering mode.",
    )
    compile_workers: int = Field(default=0, ge=0, description="Parallel Typst compilation workers; 0 means auto.")
    typst_font_family: str = Field(default="Source Han Serif SC", description="Base Typst font family.")
    pdf_compress_dpi: int = Field(default=200, ge=0, description="Final PDF image downsample DPI; 0 disables post-compression.")
    output_dir: str = Field(default="", description="Translation output directory under data/.")
    output: str = Field(default="", description="Output PDF filename under data/.")
    name: str = Field(default="", description="Optional output name prefix.")


class RunCaseRequest(TranslationRenderParams, LayoutTuningParams):
    input_dir: str = Field(default="", description="Optional folder containing one OCR JSON and one PDF.")
    source_json: str = Field(default="", description="Explicit OCR JSON source path.")
    source_pdf: str = Field(default="", description="Explicit source PDF path.")
    job_id: str = Field(default="", description="Optional explicit job directory name.")
    output_root: str = Field(default="data", description="Root directory for structured job outputs.")

    @model_validator(mode="after")
    def validate_sources(self) -> "RunCaseRequest":
        has_explicit = bool(self.source_json.strip() or self.source_pdf.strip())
        if has_explicit and not (self.source_json.strip() and self.source_pdf.strip()):
            raise ValueError("When using explicit sources, both source_json and source_pdf are required.")
        if not has_explicit and not self.input_dir.strip():
            raise ValueError("Provide either input_dir or both source_json/source_pdf.")
        return self

    @field_validator("output_dir", "output")
    @classmethod
    def _normalize_case_outputs(cls, value: str) -> str:
        return _strip_output_prefix(value)

    @field_validator("output_root")
    @classmethod
    def _normalize_case_output_root(cls, value: str) -> str:
        normalized = _strip_output_prefix(value)
        return normalized or "data"

    def to_command(self) -> list[str]:
        resolved_workers = resolve_translation_workers(
            self.workers,
            base_url=self.base_url,
            model=self.model,
        )
        cmd = [sys.executable, str(RUN_CASE_SCRIPT)]
        if self.source_json.strip() and self.source_pdf.strip():
            cmd += ["--source-json", self.source_json.strip(), "--source-pdf", self.source_pdf.strip()]
        elif self.input_dir.strip():
            cmd.append(self.input_dir.strip())

        cmd += [
            "--start-page",
            str(self.start_page),
            "--end-page",
            str(self.end_page),
            "--batch-size",
            str(self.batch_size),
            "--workers",
            str(resolved_workers),
            "--mode",
            self.mode,
        ]
        if self.skip_title_translation:
            cmd.append("--skip-title-translation")
        cmd += [
            "--classify-batch-size",
            str(self.classify_batch_size),
            "--rule-profile-name",
            self.rule_profile_name,
            "--custom-rules-text",
            self.custom_rules_text,
            "--api-key",
            self.api_key,
            "--model",
            self.model,
            "--base-url",
            self.base_url,
            "--render-mode",
            self.render_mode,
            "--compile-workers",
            str(self.compile_workers),
            "--typst-font-family",
            self.typst_font_family,
            "--pdf-compress-dpi",
            str(self.pdf_compress_dpi),
        ]
        if self.name.strip():
            cmd += ["--name", self.name.strip()]
        if self.output_dir.strip():
            cmd += ["--output-dir", self.output_dir.strip()]
        if self.output.strip():
            cmd += ["--output", self.output.strip()]
        if self.job_id.strip():
            cmd += ["--job-id", self.job_id.strip()]
        if self.output_root.strip():
            cmd += ["--output-root", self.output_root.strip()]
        cmd += [
            "--body-font-size-factor",
            str(self.body_font_size_factor),
            "--body-leading-factor",
            str(self.body_leading_factor),
            "--inner-bbox-shrink-x",
            str(self.inner_bbox_shrink_x),
            "--inner-bbox-shrink-y",
            str(self.inner_bbox_shrink_y),
            "--inner-bbox-dense-shrink-x",
            str(self.inner_bbox_dense_shrink_x),
            "--inner-bbox-dense-shrink-y",
            str(self.inner_bbox_dense_shrink_y),
        ]
        return cmd


class RunMinerUCaseRequest(TranslationRenderParams, LayoutTuningParams):
    file_url: str = Field(default="", description="Remote PDF URL for MinerU parsing.")
    file_path: str = Field(default="", description="Local PDF path for MinerU parsing.")
    mineru_token: str = Field(default="", description="MinerU API token.")
    model_version: str = Field(default="vlm", description="MinerU model version.")
    is_ocr: bool = Field(default=False, description="Enable OCR.")
    disable_formula: bool = Field(default=False, description="Disable formula recognition.")
    disable_table: bool = Field(default=False, description="Disable table recognition.")
    language: str = Field(default="ch", description="Document language.")
    page_ranges: str = Field(default="", description="Optional page ranges, for example 2,4-6.")
    data_id: str = Field(default="", description="Optional business data id.")
    no_cache: bool = Field(default=False, description="Bypass MinerU URL cache.")
    cache_tolerance: int = Field(default=900, ge=0, description="URL cache tolerance in seconds.")
    extra_formats: str = Field(default="", description="Comma-separated extra export formats.")
    poll_interval: int = Field(default=5, ge=1, description="Seconds between polling requests.")
    poll_timeout: int = Field(default=1800, ge=1, description="Max seconds to wait for completion.")
    job_id: str = Field(default="", description="Optional explicit job directory name.")
    output_root: str = Field(default="data", description="Root directory for structured job outputs.")
    translated_pdf_name: str = Field(default="", description="Optional translated PDF filename.")

    @model_validator(mode="after")
    def validate_sources(self) -> "RunMinerUCaseRequest":
        has_url = bool(self.file_url.strip())
        has_path = bool(self.file_path.strip())
        if has_url == has_path:
            raise ValueError("Provide exactly one of file_url or file_path.")
        return self

    @field_validator("output_root")
    @classmethod
    def _normalize_output_root(cls, value: str) -> str:
        normalized = _strip_output_prefix(value)
        return normalized or "output"

    @field_validator("translated_pdf_name")
    @classmethod
    def _normalize_translated_pdf_name(cls, value: str) -> str:
        return _strip_output_prefix(value)

    def to_command(self) -> list[str]:
        resolved_workers = resolve_translation_workers(
            self.workers,
            base_url=self.base_url,
            model=self.model,
        )
        cmd = [sys.executable, str(RUN_MINERU_CASE_SCRIPT)]
        if self.file_url.strip():
            cmd += ["--file-url", self.file_url.strip()]
        else:
            cmd += ["--file-path", self.file_path.strip()]

        cmd += [
            "--mineru-token",
            self.mineru_token,
            "--model-version",
            self.model_version,
        ]
        if self.is_ocr:
            cmd.append("--is-ocr")
        if self.disable_formula:
            cmd.append("--disable-formula")
        if self.disable_table:
            cmd.append("--disable-table")
        cmd += [
            "--language",
            self.language,
            "--page-ranges",
            self.page_ranges,
            "--data-id",
            self.data_id,
        ]
        if self.no_cache:
            cmd.append("--no-cache")
        cmd += [
            "--cache-tolerance",
            str(self.cache_tolerance),
            "--extra-formats",
            self.extra_formats,
            "--poll-interval",
            str(self.poll_interval),
            "--poll-timeout",
            str(self.poll_timeout),
        ]
        if self.job_id.strip():
            cmd += ["--job-id", self.job_id.strip()]
        if self.output_root.strip():
            cmd += ["--output-root", self.output_root.strip()]
        if self.translated_pdf_name.strip():
            cmd += ["--translated-pdf-name", self.translated_pdf_name.strip()]
        cmd += [
            "--start-page",
            str(self.start_page),
            "--end-page",
            str(self.end_page),
            "--batch-size",
            str(self.batch_size),
            "--workers",
            str(resolved_workers),
            "--mode",
            self.mode,
        ]
        if self.skip_title_translation:
            cmd.append("--skip-title-translation")
        cmd += [
            "--classify-batch-size",
            str(self.classify_batch_size),
            "--rule-profile-name",
            self.rule_profile_name,
            "--custom-rules-text",
            self.custom_rules_text,
            "--api-key",
            self.api_key,
            "--model",
            self.model,
            "--base-url",
            self.base_url,
            "--render-mode",
            self.render_mode,
            "--compile-workers",
            str(self.compile_workers),
            "--typst-font-family",
            self.typst_font_family,
            "--pdf-compress-dpi",
            str(self.pdf_compress_dpi),
            "--body-font-size-factor",
            str(self.body_font_size_factor),
            "--body-leading-factor",
            str(self.body_leading_factor),
            "--inner-bbox-shrink-x",
            str(self.inner_bbox_shrink_x),
            "--inner-bbox-shrink-y",
            str(self.inner_bbox_shrink_y),
            "--inner-bbox-dense-shrink-x",
            str(self.inner_bbox_dense_shrink_x),
            "--inner-bbox-dense-shrink-y",
            str(self.inner_bbox_dense_shrink_y),
        ]
        return cmd


class RunUploadedMinerUCaseRequest(TranslationRenderParams, LayoutTuningParams):
    upload_id: str = Field(description="Previously uploaded PDF id.")
    mineru_token: str = Field(default="", description="MinerU API token.")
    model_version: str = Field(default="vlm", description="MinerU model version.")
    is_ocr: bool = Field(default=False, description="Enable OCR.")
    disable_formula: bool = Field(default=False, description="Disable formula recognition.")
    disable_table: bool = Field(default=False, description="Disable table recognition.")
    language: str = Field(default="ch", description="Document language.")
    page_ranges: str = Field(default="", description="Optional page ranges, for example 2,4-6.")
    data_id: str = Field(default="", description="Optional business data id.")
    no_cache: bool = Field(default=False, description="Bypass MinerU URL cache.")
    cache_tolerance: int = Field(default=900, ge=0, description="URL cache tolerance in seconds.")
    extra_formats: str = Field(default="", description="Comma-separated extra export formats.")
    poll_interval: int = Field(default=5, ge=1, description="Seconds between polling requests.")
    poll_timeout: int = Field(default=1800, ge=1, description="Max seconds to wait for completion.")
    job_id: str = Field(default="", description="Optional explicit job directory name.")
    output_root: str = Field(default="output", description="Root directory for structured job outputs.")
    translated_pdf_name: str = Field(default="", description="Optional translated PDF filename.")

    @field_validator("output_root")
    @classmethod
    def _normalize_uploaded_output_root(cls, value: str) -> str:
        normalized = _strip_output_prefix(value)
        return normalized or "output"

    @field_validator("translated_pdf_name")
    @classmethod
    def _normalize_uploaded_translated_pdf_name(cls, value: str) -> str:
        return _strip_output_prefix(value)

    def to_command(self, *, file_path: str) -> list[str]:
        request = RunMinerUCaseRequest(
            file_path=file_path,
            mineru_token=self.mineru_token,
            model_version=self.model_version,
            is_ocr=self.is_ocr,
            disable_formula=self.disable_formula,
            disable_table=self.disable_table,
            language=self.language,
            page_ranges=self.page_ranges,
            data_id=self.data_id,
            no_cache=self.no_cache,
            cache_tolerance=self.cache_tolerance,
            extra_formats=self.extra_formats,
            poll_interval=self.poll_interval,
            poll_timeout=self.poll_timeout,
            start_page=self.start_page,
            end_page=self.end_page,
            batch_size=self.batch_size,
            workers=self.workers,
            mode=self.mode,
            skip_title_translation=self.skip_title_translation,
            classify_batch_size=self.classify_batch_size,
            rule_profile_name=self.rule_profile_name,
            custom_rules_text=self.custom_rules_text,
            api_key=self.api_key,
            model=self.model,
            base_url=self.base_url,
            render_mode=self.render_mode,
            compile_workers=self.compile_workers,
            typst_font_family=self.typst_font_family,
            pdf_compress_dpi=self.pdf_compress_dpi,
            output_root=self.output_root,
            translated_pdf_name=self.translated_pdf_name,
            body_font_size_factor=self.body_font_size_factor,
            body_leading_factor=self.body_leading_factor,
            inner_bbox_shrink_x=self.inner_bbox_shrink_x,
            inner_bbox_shrink_y=self.inner_bbox_shrink_y,
            inner_bbox_dense_shrink_x=self.inner_bbox_dense_shrink_x,
            inner_bbox_dense_shrink_y=self.inner_bbox_dense_shrink_y,
            job_id=self.job_id,
        )
        return request.to_command()


class UploadPdfResponse(BaseModel):
    upload_id: str
    filename: str
    bytes: int
    page_count: int
    uploaded_at: str


class RuleProfileSummary(BaseModel):
    name: str
    display_name: str
    description: str = ""
    built_in: bool
    created_at: str = ""
    updated_at: str = ""


class RuleProfileDetail(RuleProfileSummary):
    profile_text: str


class UpsertRuleProfileRequest(BaseModel):
    name: str
    profile_text: str
    description: str = ""


class ProcessResult(BaseModel):
    success: bool
    return_code: int
    duration_seconds: float
    command: list[str]
    cwd: str
    stdout: str
    stderr: str


class RunCaseArtifacts(BaseModel):
    job_root: str | None = None
    origin_pdf_dir: str | None = None
    json_pdf_dir: str | None = None
    trans_pdf_dir: str | None = None
    typst_dir: str | None = None
    translation_dir: str | None = None
    output_pdf: str | None = None
    pages_processed: int | None = None
    translated_items: int | None = None
    translate_render_time_seconds: float | None = None
    save_time_seconds: float | None = None
    total_time_seconds: float | None = None


class RunMinerUCaseArtifacts(BaseModel):
    job_root: str | None = None
    source_pdf: str | None = None
    layout_json: str | None = None
    translations_dir: str | None = None
    output_pdf: str | None = None
    summary: str | None = None
    pages_processed: int | None = None
    translated_items: int | None = None
    translate_render_time_seconds: float | None = None
    save_time_seconds: float | None = None
    total_time_seconds: float | None = None
    output_json: str | None = None
    full_zip_url: str | None = None


class RunCaseResponse(ProcessResult):
    parsed: RunCaseArtifacts


class RunMinerUCaseResponse(ProcessResult):
    parsed: RunMinerUCaseArtifacts


JobType = Literal["run-case", "run-mineru-case"]
JobState = Literal["queued", "running", "succeeded", "failed"]


class SubmitJobResponse(BaseModel):
    job_id: str
    status: JobState
    created_at: str
    updated_at: str


class JobStatus(BaseModel):
    job_id: str
    job_type: JobType
    status: JobState
    created_at: str
    updated_at: str
    started_at: str | None = None
    finished_at: str | None = None
    command: list[str]
    error: str | None = None
    stage: str | None = None
    stage_detail: str | None = None
    progress_current: int | None = None
    progress_total: int | None = None
    log_tail: list[str] = Field(default_factory=list)
    result: ProcessResult | None = None
    artifacts: RunCaseArtifacts | RunMinerUCaseArtifacts | None = None


class JobRecord(BaseModel):
    job_id: str
    job_type: JobType
    status: JobState
    created_at: str
    updated_at: str
    started_at: str | None = None
    finished_at: str | None = None
    command: list[str]
    request_payload: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
    stage: str | None = None
    stage_detail: str | None = None
    progress_current: int | None = None
    progress_total: int | None = None
    log_tail: list[str] = Field(default_factory=list)
    result: ProcessResult | None = None
    artifacts: RunCaseArtifacts | RunMinerUCaseArtifacts | None = None
