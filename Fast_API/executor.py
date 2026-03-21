from __future__ import annotations

import asyncio
import json
import re
import time
import uuid
from pathlib import Path

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

    record.status = "running"
    record.started_at = utc_now_iso()
    record.updated_at = utc_now_iso()
    save_job(record)

    try:
        return_code, duration, stdout, stderr = await run_command(record.command)
        result = build_process_result(record.command, return_code, duration, stdout, stderr)
        record.result = result
        record.artifacts = _artifacts_for_job(record.job_type, stdout)
        record.status = "succeeded" if result.success else "failed"
        record.finished_at = utc_now_iso()
        record.updated_at = record.finished_at
        save_job(record)
    except Exception as exc:
        record.status = "failed"
        record.finished_at = utc_now_iso()
        record.updated_at = record.finished_at
        record.error = f"{type(exc).__name__}: {exc}"
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
        result=record.result,
        artifacts=record.artifacts,
    )
