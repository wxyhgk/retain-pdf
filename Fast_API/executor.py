from __future__ import annotations

import asyncio
import json
import re
import time
import uuid
import zipfile
from pathlib import Path

from .models import DOWNLOADS_DIR
from .models import JobRecord
from .models import JobStatus
from .models import ProcessResult
from .models import PROJECT_ROOT
from .models import RunCaseArtifacts
from .models import RunMinerUCaseArtifacts
from .models import SubmitJobResponse


RUN_CASE_PATTERNS = {
    "job_root": re.compile(r"^job root:\s*(.+)$", re.MULTILINE),
    "origin_pdf_dir": re.compile(r"^originPDF:\s*(.+)$", re.MULTILINE),
    "json_pdf_dir": re.compile(r"^jsonPDF:\s*(.+)$", re.MULTILINE),
    "trans_pdf_dir": re.compile(r"^transPDF:\s*(.+)$", re.MULTILINE),
    "translation_dir": re.compile(r"^translation dir:\s*(.+)$", re.MULTILINE),
    "output_pdf": re.compile(r"^output pdf:\s*(.+)$", re.MULTILINE),
    "pages_processed": re.compile(r"^pages processed:\s*(\d+)$", re.MULTILINE),
    "translated_items": re.compile(r"^translated items:\s*(\d+)$", re.MULTILINE),
    "translate_render_time_seconds": re.compile(r"^translate\+render time:\s*([0-9.]+)s$", re.MULTILINE),
    "save_time_seconds": re.compile(r"^save time:\s*([0-9.]+)s$", re.MULTILINE),
    "total_time_seconds": re.compile(r"^total time:\s*([0-9.]+)s$", re.MULTILINE),
}

RUN_MINERU_PATTERNS = {
    "job_root": re.compile(r"^job root:\s*(.+)$", re.MULTILINE),
    "source_pdf": re.compile(r"^source pdf:\s*(.+)$", re.MULTILINE),
    "layout_json": re.compile(r"^layout json:\s*(.+)$", re.MULTILINE),
    "translations_dir": re.compile(r"^translations dir:\s*(.+)$", re.MULTILINE),
    "output_pdf": re.compile(r"^output pdf:\s*(.+)$", re.MULTILINE),
    "summary": re.compile(r"^summary:\s*(.+)$", re.MULTILINE),
    "pages_processed": re.compile(r"^pages processed:\s*(\d+)$", re.MULTILINE),
    "translated_items": re.compile(r"^translated items:\s*(\d+)$", re.MULTILINE),
    "translate_render_time_seconds": re.compile(r"^translate\+render time:\s*([0-9.]+)s$", re.MULTILINE),
    "save_time_seconds": re.compile(r"^save time:\s*([0-9.]+)s$", re.MULTILINE),
    "total_time_seconds": re.compile(r"^total time:\s*([0-9.]+)s$", re.MULTILINE),
}

JOBS_DIR = PROJECT_ROOT / "Fast_API" / "jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)

_JOB_TASKS: dict[str, asyncio.Task] = {}
_LOG_TAIL_LIMIT = 40

_BATCH_PROGRESS_RE = re.compile(r"^book: completed batch (\d+)/(\d+)$")
_PENDING_BATCH_RE = re.compile(r"^book: pending items=(\d+) batches=(\d+) workers=(\d+)$")
_PAGE_PROGRESS_RE = re.compile(r"^page (\d+): translated (\d+)/(\d+)$")
_MINERU_BATCH_STATE_RE = re.compile(r"^batch ([^:]+): state=(.+)$")


def _job_file(job_id: str) -> Path:
    return JOBS_DIR / f"{job_id}.json"


def utc_now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _parse_float(text: str | None) -> float | None:
    if text is None:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _parse_int(text: str | None) -> int | None:
    if text is None:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def parse_named_fields(stdout: str, patterns: dict[str, re.Pattern[str]]) -> dict[str, str | int | float | None]:
    result: dict[str, str | int | float | None] = {}
    for key, pattern in patterns.items():
        match = pattern.search(stdout)
        value = match.group(1).strip() if match else None
        if key.endswith("_seconds"):
            result[key] = _parse_float(value)
        elif key in {"pages_processed", "translated_items"}:
            result[key] = _parse_int(value)
        else:
            result[key] = value
    return result


def build_process_result(command: list[str], return_code: int, duration: float, stdout: str, stderr: str) -> ProcessResult:
    return ProcessResult(
        success=return_code == 0,
        return_code=return_code,
        duration_seconds=duration,
        command=command,
        cwd=str(PROJECT_ROOT),
        stdout=stdout,
        stderr=stderr,
    )


async def run_command(command: list[str]) -> tuple[int, float, str, str]:
    started = time.perf_counter()
    proc = await asyncio.create_subprocess_exec(
        *command,
        cwd=PROJECT_ROOT,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout_bytes, stderr_bytes = await proc.communicate()
    duration = time.perf_counter() - started
    return proc.returncode, duration, stdout_bytes.decode("utf-8", errors="replace"), stderr_bytes.decode("utf-8", errors="replace")


def _append_log_tail(record: JobRecord, line: str) -> None:
    text = line.rstrip("\n")
    if not text:
        return
    record.log_tail.append(text)
    if len(record.log_tail) > _LOG_TAIL_LIMIT:
        record.log_tail = record.log_tail[-_LOG_TAIL_LIMIT:]


def _set_stage(
    record: JobRecord,
    *,
    stage: str,
    detail: str | None = None,
    progress_current: int | None = None,
    progress_total: int | None = None,
) -> None:
    record.stage = stage
    if detail is not None:
        record.stage_detail = detail
    if progress_current is not None:
        record.progress_current = progress_current
    if progress_total is not None:
        record.progress_total = progress_total


def _update_progress_from_line(record: JobRecord, line: str) -> bool:
    stripped = line.strip()
    _append_log_tail(record, stripped)

    if record.job_type == "run-mineru-case":
        if stripped.startswith("upload done: "):
            _set_stage(record, stage="mineru_upload", detail="文件上传完成，等待 MinerU 处理")
            return True
        match = _MINERU_BATCH_STATE_RE.match(stripped)
        if match:
            state = match.group(2).strip()
            _set_stage(record, stage="mineru_processing", detail=f"MinerU 状态: {state}")
            return True
        if stripped.startswith("layout json: "):
            _set_stage(record, stage="translation_prepare", detail="MinerU 结果已就绪，准备翻译")
            return True

    if stripped.startswith("domain-infer: "):
        _set_stage(record, stage="domain_inference", detail="正在识别论文领域")
        return True
    if stripped.startswith("continuation-review "):
        _set_stage(record, stage="continuation_review", detail="正在判断跨栏/跨页连续段")
        return True
    match = _PENDING_BATCH_RE.match(stripped)
    if match:
        total_batches = int(match.group(2))
        _set_stage(
            record,
            stage="translation",
            detail=f"正在翻译，批次数 {total_batches}",
            progress_current=0,
            progress_total=total_batches,
        )
        return True
    match = _BATCH_PROGRESS_RE.match(stripped)
    if match:
        current = int(match.group(1))
        total = int(match.group(2))
        _set_stage(
            record,
            stage="translation",
            detail=f"正在翻译，第 {current}/{total} 批",
            progress_current=current,
            progress_total=total,
        )
        return True
    match = _PAGE_PROGRESS_RE.match(stripped)
    if match:
        page_idx = int(match.group(1))
        _set_stage(record, stage="rendering", detail=f"正在整理渲染结果，第 {page_idx} 页已完成")
        return True
    if stripped.startswith("translate+render time: "):
        _set_stage(record, stage="saving", detail="翻译和渲染完成，正在保存 PDF")
        return True
    if stripped.startswith("save time: "):
        _set_stage(record, stage="finalizing", detail="正在收尾并写出产物")
        return True
    if stripped.startswith("output pdf: "):
        _set_stage(record, stage="completed", detail="输出 PDF 已生成")
        return True
    return False


async def run_command_streaming(job_id: str, command: list[str]) -> tuple[int, float, str, str]:
    started = time.perf_counter()
    proc = await asyncio.create_subprocess_exec(
        *command,
        cwd=PROJECT_ROOT,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout_chunks: list[str] = []
    stderr_chunks: list[str] = []

    async def _consume_stdout() -> None:
        assert proc.stdout is not None
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            text = line.decode("utf-8", errors="replace")
            stdout_chunks.append(text)
            try:
                record = load_job(job_id)
            except KeyError:
                continue
            if _update_progress_from_line(record, text):
                record.updated_at = utc_now_iso()
            else:
                record.updated_at = utc_now_iso()
            try:
                record.artifacts = _artifacts_for_job(record.job_type, "".join(stdout_chunks))
            except Exception:
                pass
            save_job(record)

    async def _consume_stderr() -> None:
        assert proc.stderr is not None
        while True:
            line = await proc.stderr.readline()
            if not line:
                break
            stderr_chunks.append(line.decode("utf-8", errors="replace"))

    await asyncio.gather(_consume_stdout(), _consume_stderr())
    return_code = await proc.wait()
    duration = time.perf_counter() - started
    return return_code, duration, "".join(stdout_chunks), "".join(stderr_chunks)


def _read_job(job_id: str) -> JobRecord:
    path = _job_file(job_id)
    if not path.exists():
        raise KeyError(job_id)
    return JobRecord.model_validate_json(path.read_text(encoding="utf-8"))


def save_job(record: JobRecord) -> JobRecord:
    _job_file(record.job_id).write_text(
        json.dumps(record.model_dump(mode="json"), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return record


def load_job(job_id: str) -> JobRecord:
    return _read_job(job_id)


def list_jobs(limit: int = 50) -> list[JobRecord]:
    files = sorted(JOBS_DIR.glob("*.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    records: list[JobRecord] = []
    for path in files[: max(1, limit)]:
        try:
            records.append(JobRecord.model_validate_json(path.read_text(encoding="utf-8")))
        except Exception:
            continue
    return records


def create_job(job_type: str, command: list[str], request_payload: dict, job_id: str | None = None) -> JobRecord:
    job_id = job_id or uuid.uuid4().hex[:12]
    record = JobRecord(
        job_id=job_id,
        job_type=job_type,
        status="queued",
        created_at=utc_now_iso(),
        updated_at=utc_now_iso(),
        command=command,
        request_payload=request_payload,
        stage="queued",
        stage_detail="任务已进入队列",
    )
    return save_job(record)


def submit_job(job_type: str, command: list[str], request_payload: dict, job_id: str | None = None) -> SubmitJobResponse:
    record = create_job(job_type, command, request_payload, job_id=job_id)
    _JOB_TASKS[record.job_id] = asyncio.create_task(_run_job(record.job_id))
    return SubmitJobResponse(
        job_id=record.job_id,
        status=record.status,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _artifacts_for_job(job_type: str, stdout: str) -> RunCaseArtifacts | RunMinerUCaseArtifacts:
    if job_type == "run-mineru-case":
        parsed_raw = parse_named_fields(stdout, RUN_MINERU_PATTERNS)
        return RunMinerUCaseArtifacts(**parsed_raw)
    parsed_raw = parse_named_fields(stdout, RUN_CASE_PATTERNS)
    return RunCaseArtifacts(**parsed_raw)


async def _run_job(job_id: str) -> None:
    try:
        record = load_job(job_id)
    except KeyError:
        return

    try:
        record.status = "running"
        record.started_at = utc_now_iso()
        record.updated_at = utc_now_iso()
        record.stage = "starting"
        record.stage_detail = "任务已启动"
        save_job(record)

        try:
            return_code, duration, stdout, stderr = await run_command_streaming(record.job_id, record.command)
            record = load_job(job_id)
            result = build_process_result(record.command, return_code, duration, stdout, stderr)
            record.result = result
            record.artifacts = _artifacts_for_job(record.job_type, stdout)
            record.status = "succeeded" if result.success else "failed"
            record.finished_at = utc_now_iso()
            record.updated_at = record.finished_at
            if result.success:
                record.stage = "completed"
                record.stage_detail = "任务完成"
            else:
                record.stage = "failed"
                record.stage_detail = "任务失败"
            save_job(record)
        except Exception as exc:
            record = load_job(job_id)
            record.status = "failed"
            record.finished_at = utc_now_iso()
            record.updated_at = record.finished_at
            record.error = f"{type(exc).__name__}: {exc}"
            record.stage = "failed"
            record.stage_detail = "任务失败"
            save_job(record)
    finally:
        _JOB_TASKS.pop(job_id, None)


def status_payload(record: JobRecord) -> JobStatus:
    return JobStatus(
        job_id=record.job_id,
        job_type=record.job_type,
        status=record.status,
        created_at=record.created_at,
        updated_at=record.updated_at,
        started_at=record.started_at,
        finished_at=record.finished_at,
        command=record.command,
        error=record.error,
        stage=record.stage,
        stage_detail=record.stage_detail,
        progress_current=record.progress_current,
        progress_total=record.progress_total,
        log_tail=record.log_tail,
        result=record.result,
        artifacts=record.artifacts,
    )


def _resolve_path(path_text: str | None) -> Path | None:
    if not path_text:
        return None
    path = Path(path_text)
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return path.resolve()


def _add_file_to_zip(zip_file: zipfile.ZipFile, file_path: Path, arcname: str) -> None:
    if file_path.exists() and file_path.is_file():
        zip_file.write(file_path, arcname)


def _add_tree_to_zip(zip_file: zipfile.ZipFile, root_dir: Path, arc_prefix: str) -> None:
    if not root_dir.exists() or not root_dir.is_dir():
        return
    for path in sorted(root_dir.rglob("*")):
        if path.is_file():
            rel = path.relative_to(root_dir)
            zip_file.write(path, f"{arc_prefix}/{rel.as_posix()}")


def build_job_download_zip(record: JobRecord) -> Path:
    if record.status != "succeeded":
        raise RuntimeError("job is not finished successfully")
    if record.artifacts is None:
        raise RuntimeError("job does not contain downloadable artifacts")

    job_root = _resolve_path(getattr(record.artifacts, "job_root", None))
    if job_root is None or not job_root.exists():
        raise RuntimeError("job root is missing")

    zip_path = DOWNLOADS_DIR / f"{record.job_id}.zip"
    unpacked_dir = job_root / "jsonPDF" / "unpacked"
    markdown_path = unpacked_dir / "full.md"
    markdown_images_dir = unpacked_dir / "images"
    output_pdf = _resolve_path(getattr(record.artifacts, "output_pdf", None))

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zip_file:
        if output_pdf is not None and output_pdf.exists():
            _add_file_to_zip(zip_file, output_pdf, output_pdf.name)
        if markdown_path.exists():
            _add_file_to_zip(zip_file, markdown_path, "markdown/full.md")
        _add_tree_to_zip(zip_file, markdown_images_dir, "markdown/images")

    return zip_path
