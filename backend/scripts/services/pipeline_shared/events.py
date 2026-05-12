from __future__ import annotations

import json
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime
from datetime import timezone
from pathlib import Path
from typing import Any

from .contracts import PIPELINE_EVENTS_FILE_NAME


_ACTIVE_PIPELINE_EVENT_WRITER: ContextVar["PipelineEventWriter | None"] = ContextVar(
    "active_pipeline_event_writer",
    default=None,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass
class PipelineEventWriter:
    job_id: str
    job_root: Path
    logs_dir: Path
    workflow: str = ""
    provider: str = ""
    _seq: int = 0

    def __post_init__(self) -> None:
        if not self.path.exists():
            return
        try:
            with self.path.open("r", encoding="utf-8") as handle:
                self._seq = sum(1 for line in handle if line.strip())
        except OSError:
            self._seq = 0

    @property
    def path(self) -> Path:
        return self.logs_dir / PIPELINE_EVENTS_FILE_NAME

    def emit(
        self,
        *,
        level: str,
        stage: str,
        event_type: str,
        message: str,
        stage_detail: str = "",
        provider: str = "",
        provider_stage: str = "",
        progress_current: int | None = None,
        progress_total: int | None = None,
        retry_count: int | None = None,
        elapsed_ms: int | None = None,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self._seq += 1
        provider_value = (provider or self.provider).strip()
        record = {
            "job_id": self.job_id,
            "seq": self._seq,
            "ts": _now_iso(),
            "level": str(level or "info").strip() or "info",
            "stage": str(stage or "").strip(),
            "stage_detail": str(stage_detail or "").strip(),
            "provider": provider_value,
            "provider_stage": str(provider_stage or "").strip(),
            "event_type": str(event_type or "").strip(),
            "message": str(message or "").strip(),
            "progress_current": progress_current,
            "progress_total": progress_total,
            "retry_count": retry_count,
            "elapsed_ms": elapsed_ms,
            "payload": payload or {},
        }
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False))
            handle.write("\n")
        return record


@contextmanager
def pipeline_event_writer_scope(writer: PipelineEventWriter):
    token = _ACTIVE_PIPELINE_EVENT_WRITER.set(writer)
    try:
        yield writer
    finally:
        _ACTIVE_PIPELINE_EVENT_WRITER.reset(token)


def get_active_pipeline_event_writer() -> PipelineEventWriter | None:
    return _ACTIVE_PIPELINE_EVENT_WRITER.get()


def emit_pipeline_event(
    *,
    level: str,
    stage: str,
    event_type: str,
    message: str,
    stage_detail: str = "",
    provider: str = "",
    provider_stage: str = "",
    progress_current: int | None = None,
    progress_total: int | None = None,
    retry_count: int | None = None,
    elapsed_ms: int | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    writer = get_active_pipeline_event_writer()
    if writer is None:
        return None
    return writer.emit(
        level=level,
        stage=stage,
        event_type=event_type,
        message=message,
        stage_detail=stage_detail,
        provider=provider,
        provider_stage=provider_stage,
        progress_current=progress_current,
        progress_total=progress_total,
        retry_count=retry_count,
        elapsed_ms=elapsed_ms,
        payload=payload,
    )


def emit_stage_transition(
    *,
    stage: str,
    message: str,
    stage_detail: str = "",
    provider: str = "",
    provider_stage: str = "",
    progress_current: int | None = None,
    progress_total: int | None = None,
    retry_count: int | None = None,
    elapsed_ms: int | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    return emit_pipeline_event(
        level="info",
        stage=stage,
        event_type="stage_transition",
        message=message,
        stage_detail=stage_detail or message,
        provider=provider,
        provider_stage=provider_stage,
        progress_current=progress_current,
        progress_total=progress_total,
        retry_count=retry_count,
        elapsed_ms=elapsed_ms,
        payload=payload,
    )


def emit_stage_progress(
    *,
    stage: str,
    message: str,
    stage_detail: str = "",
    provider: str = "",
    provider_stage: str = "",
    progress_current: int | None = None,
    progress_total: int | None = None,
    retry_count: int | None = None,
    elapsed_ms: int | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    return emit_pipeline_event(
        level="info",
        stage=stage,
        event_type="stage_progress",
        message=message,
        stage_detail=stage_detail or message,
        provider=provider,
        provider_stage=provider_stage,
        progress_current=progress_current,
        progress_total=progress_total,
        retry_count=retry_count,
        elapsed_ms=elapsed_ms,
        payload=payload,
    )


def emit_render_page_progress(
    *,
    current: int,
    total: int,
    message: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    return emit_stage_progress(
        stage="rendering",
        message=message,
        progress_current=current,
        progress_total=total,
        payload=payload,
    )


def emit_artifact_published(
    *,
    artifact_key: str,
    path: Path,
    stage: str,
    message: str = "",
    payload: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    artifact_path = path.resolve()
    return emit_pipeline_event(
        level="info",
        stage=stage,
        event_type="artifact_published",
        message=message or f"artifact published: {artifact_key}",
        stage_detail=message or f"artifact published: {artifact_key}",
        payload={
            "artifact_key": artifact_key,
            "path": str(artifact_path),
            **(payload or {}),
        },
    )
