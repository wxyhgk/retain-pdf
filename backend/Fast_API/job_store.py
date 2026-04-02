from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Iterable

from .models import JobRecord
from .models import LEGACY_FASTAPI_DATA_DIR
from .models import ProcessResult
from .models import RunCaseArtifacts
from .models import RunMinerUCaseArtifacts


DB_PATH = LEGACY_FASTAPI_DATA_DIR / "jobs.db"
LEGACY_JOBS_DIR = LEGACY_FASTAPI_DATA_DIR / "jobs"
LEGACY_JOBS_DIR.mkdir(parents=True, exist_ok=True)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                job_type TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT,
                command_json TEXT NOT NULL,
                request_payload_json TEXT NOT NULL,
                error TEXT,
                stage TEXT,
                stage_detail TEXT,
                progress_current INTEGER,
                progress_total INTEGER,
                log_tail_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS job_results (
                job_id TEXT PRIMARY KEY REFERENCES jobs(job_id) ON DELETE CASCADE,
                result_json TEXT
            );

            CREATE TABLE IF NOT EXISTS job_artifacts (
                job_id TEXT PRIMARY KEY REFERENCES jobs(job_id) ON DELETE CASCADE,
                artifacts_json TEXT,
                job_root TEXT,
                source_dir TEXT,
                ocr_dir TEXT,
                translated_dir TEXT,
                typst_dir TEXT,
                source_pdf TEXT,
                layout_json TEXT,
                translations_dir TEXT,
                translation_dir TEXT,
                output_pdf TEXT,
                summary TEXT,
                pages_processed INTEGER,
                translated_items INTEGER,
                translate_render_time_seconds REAL,
                save_time_seconds REAL,
                total_time_seconds REAL
            );

            CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
            CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);
            CREATE INDEX IF NOT EXISTS idx_job_artifacts_output_pdf ON job_artifacts(output_pdf);
            """
        )


def _legacy_job_file(job_id: str) -> Path:
    return LEGACY_JOBS_DIR / f"{job_id}.json"


def _json_text(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def _loads_json(text: str | None, default):
    if not text:
        return default
    return json.loads(text)


def _result_model_dump(record: JobRecord) -> str | None:
    if record.result is None:
        return None
    return _json_text(record.result.model_dump(mode="json"))


def _artifact_fields(record: JobRecord) -> dict[str, object]:
    artifacts = record.artifacts
    if artifacts is None:
        return {
            "artifacts_json": None,
            "job_root": None,
            "source_dir": None,
            "ocr_dir": None,
            "translated_dir": None,
            "typst_dir": None,
            "source_pdf": None,
            "layout_json": None,
            "translations_dir": None,
            "translation_dir": None,
            "output_pdf": None,
            "summary": None,
            "pages_processed": None,
            "translated_items": None,
            "translate_render_time_seconds": None,
            "save_time_seconds": None,
            "total_time_seconds": None,
        }
    payload = artifacts.model_dump(mode="json")
    return {
        "artifacts_json": _json_text(payload),
        "job_root": payload.get("job_root"),
        "source_dir": payload.get("origin_pdf_dir"),
        "ocr_dir": payload.get("json_pdf_dir"),
        "translated_dir": payload.get("trans_pdf_dir"),
        "typst_dir": payload.get("typst_dir"),
        "source_pdf": payload.get("source_pdf"),
        "layout_json": payload.get("layout_json"),
        "translations_dir": payload.get("translations_dir"),
        "translation_dir": payload.get("translation_dir"),
        "output_pdf": payload.get("output_pdf"),
        "summary": payload.get("summary"),
        "pages_processed": payload.get("pages_processed"),
        "translated_items": payload.get("translated_items"),
        "translate_render_time_seconds": payload.get("translate_render_time_seconds"),
        "save_time_seconds": payload.get("save_time_seconds"),
        "total_time_seconds": payload.get("total_time_seconds"),
    }


def _row_to_record(row: sqlite3.Row) -> JobRecord:
    result_payload = _loads_json(row["result_json"], None)
    artifacts_payload = _loads_json(row["artifacts_json"], None)
    result = ProcessResult.model_validate(result_payload) if result_payload is not None else None
    artifacts = None
    if artifacts_payload is not None:
        if row["job_type"] == "run-mineru-case":
            artifacts = RunMinerUCaseArtifacts.model_validate(artifacts_payload)
        else:
            artifacts = RunCaseArtifacts.model_validate(artifacts_payload)
    return JobRecord(
        job_id=row["job_id"],
        job_type=row["job_type"],
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        command=_loads_json(row["command_json"], []),
        request_payload=_loads_json(row["request_payload_json"], {}),
        error=row["error"],
        stage=row["stage"],
        stage_detail=row["stage_detail"],
        progress_current=row["progress_current"],
        progress_total=row["progress_total"],
        log_tail=_loads_json(row["log_tail_json"], []),
        result=result,
        artifacts=artifacts,
    )


def save_job(record: JobRecord) -> JobRecord:
    init_db()
    artifact_fields = _artifact_fields(record)
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO jobs (
                job_id, job_type, status, created_at, updated_at, started_at, finished_at,
                command_json, request_payload_json, error, stage, stage_detail,
                progress_current, progress_total, log_tail_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                job_type=excluded.job_type,
                status=excluded.status,
                created_at=excluded.created_at,
                updated_at=excluded.updated_at,
                started_at=excluded.started_at,
                finished_at=excluded.finished_at,
                command_json=excluded.command_json,
                request_payload_json=excluded.request_payload_json,
                error=excluded.error,
                stage=excluded.stage,
                stage_detail=excluded.stage_detail,
                progress_current=excluded.progress_current,
                progress_total=excluded.progress_total,
                log_tail_json=excluded.log_tail_json
            """,
            (
                record.job_id,
                record.job_type,
                record.status,
                record.created_at,
                record.updated_at,
                record.started_at,
                record.finished_at,
                _json_text(record.command),
                _json_text(record.request_payload),
                record.error,
                record.stage,
                record.stage_detail,
                record.progress_current,
                record.progress_total,
                _json_text(record.log_tail),
            ),
        )
        conn.execute(
            """
            INSERT INTO job_results (job_id, result_json)
            VALUES (?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                result_json=excluded.result_json
            """,
            (record.job_id, _result_model_dump(record)),
        )
        conn.execute(
            """
            INSERT INTO job_artifacts (
                job_id, artifacts_json, job_root, source_dir, ocr_dir, translated_dir, typst_dir,
                source_pdf, layout_json, translations_dir, translation_dir, output_pdf, summary,
                pages_processed, translated_items, translate_render_time_seconds,
                save_time_seconds, total_time_seconds
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                artifacts_json=excluded.artifacts_json,
                job_root=excluded.job_root,
                source_dir=excluded.source_dir,
                ocr_dir=excluded.ocr_dir,
                translated_dir=excluded.translated_dir,
                typst_dir=excluded.typst_dir,
                source_pdf=excluded.source_pdf,
                layout_json=excluded.layout_json,
                translations_dir=excluded.translations_dir,
                translation_dir=excluded.translation_dir,
                output_pdf=excluded.output_pdf,
                summary=excluded.summary,
                pages_processed=excluded.pages_processed,
                translated_items=excluded.translated_items,
                translate_render_time_seconds=excluded.translate_render_time_seconds,
                save_time_seconds=excluded.save_time_seconds,
                total_time_seconds=excluded.total_time_seconds
            """,
            (
                record.job_id,
                artifact_fields["artifacts_json"],
                artifact_fields["job_root"],
                artifact_fields["source_dir"],
                artifact_fields["ocr_dir"],
                artifact_fields["translated_dir"],
                artifact_fields["typst_dir"],
                artifact_fields["source_pdf"],
                artifact_fields["layout_json"],
                artifact_fields["translations_dir"],
                artifact_fields["translation_dir"],
                artifact_fields["output_pdf"],
                artifact_fields["summary"],
                artifact_fields["pages_processed"],
                artifact_fields["translated_items"],
                artifact_fields["translate_render_time_seconds"],
                artifact_fields["save_time_seconds"],
                artifact_fields["total_time_seconds"],
            ),
        )
    return record


def _load_job_from_db(job_id: str) -> JobRecord | None:
    init_db()
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT j.*, r.result_json, a.artifacts_json
            FROM jobs j
            LEFT JOIN job_results r ON r.job_id = j.job_id
            LEFT JOIN job_artifacts a ON a.job_id = j.job_id
            WHERE j.job_id = ?
            """,
            (job_id,),
        ).fetchone()
    if row is None:
        return None
    return _row_to_record(row)


def _load_legacy_job(job_id: str) -> JobRecord:
    path = _legacy_job_file(job_id)
    if not path.exists():
        raise KeyError(job_id)
    record = JobRecord.model_validate_json(path.read_text(encoding="utf-8"))
    save_job(record)
    return record


def load_job(job_id: str) -> JobRecord:
    record = _load_job_from_db(job_id)
    if record is not None:
        return record
    return _load_legacy_job(job_id)


def _iter_legacy_job_paths() -> Iterable[Path]:
    return sorted(LEGACY_JOBS_DIR.glob("*.json"), key=lambda path: path.stat().st_mtime, reverse=True)


def import_legacy_jobs(limit: int | None = None) -> None:
    count = 0
    for path in _iter_legacy_job_paths():
        if limit is not None and count >= limit:
            break
        job_id = path.stem
        if _load_job_from_db(job_id) is not None:
            continue
        try:
            record = JobRecord.model_validate_json(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        save_job(record)
        count += 1


def list_jobs(limit: int = 50) -> list[JobRecord]:
    init_db()
    import_legacy_jobs(limit=max(100, limit * 4))
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT j.*, r.result_json, a.artifacts_json
            FROM jobs j
            LEFT JOIN job_results r ON r.job_id = j.job_id
            LEFT JOIN job_artifacts a ON a.job_id = j.job_id
            ORDER BY j.updated_at DESC
            LIMIT ?
            """,
            (max(1, limit),),
        ).fetchall()
    return [_row_to_record(row) for row in rows]


init_db()
