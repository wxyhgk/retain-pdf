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


_OCR_STAGES = {
    "ocr_upload",
    "ocr_processing",
    "ocr_result_ready",
    "normalizing",
}
_TRANSLATE_STAGES = {
    "translation_prepare",
    "translating",
    "translation_batches",
    "continuation_review",
    "page_policies",
    "domain_inference",
    "garbled_repair",
    "agent_repair",
    "final_untranslated_recovery",
}
_RENDER_STAGES = {
    "render_prepare",
    "render_preprocess",
    "rendering",
    "compile",
    "overlay",
    "saving",
}
_PAGE_PROGRESS_STAGES = {
    "ocr_processing",
    "continuation_review",
    "page_policies",
    "domain_inference",
    "garbled_repair",
    "rendering",
}
_BATCH_PROGRESS_STAGES = {"translating", "translation_batches"}


_ACTIVE_PIPELINE_EVENT_WRITER: ContextVar["PipelineEventWriter | None"] = ContextVar(
    "active_pipeline_event_writer",
    default=None,
)
_ACTIVE_RENDER_PAGE_PROGRESS: ContextVar[tuple[int, int] | None] = ContextVar(
    "active_render_page_progress",
    default=None,
)
_ACTIVE_PROGRESS_SNAPSHOT: ContextVar[dict[tuple[str, str, str], int] | None] = ContextVar(
    "active_progress_snapshot",
    default=None,
)

PIPELINE_STAGE_OBSERVATION_SCHEMA = "pipeline_stage_observation_v1"
PIPELINE_STAGE_OBSERVATION_SCHEMA_VERSION = 1


def semantic_event_type(event_type: str) -> str:
    normalized = str(event_type or "").strip()
    if normalized in {"stage_transition", "stage_progress"}:
        return "progress"
    if normalized == "artifact_published":
        return "artifact"
    if normalized in {"job_terminal", "failure_classified"}:
        return "terminal"
    return normalized or "event"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def user_stage_for_stage(stage: str) -> str:
    stage = str(stage or "").strip()
    if stage in _OCR_STAGES:
        return "ocr"
    if stage in _TRANSLATE_STAGES:
        return "translation"
    if stage in _RENDER_STAGES:
        return "render"
    if stage in {"finished", "done"}:
        return "done"
    return ""


def normalize_user_stage(value: str) -> str:
    normalized = str(value or "").strip()
    if normalized == "translate":
        return "translation"
    return normalized


def progress_unit_for_stage(stage: str, event_type: str, payload: dict[str, Any] | None) -> str:
    payload = payload or {}
    explicit = str(payload.get("progress_unit") or "").strip()
    if explicit:
        return explicit
    stage = str(stage or "").strip()
    if stage in _BATCH_PROGRESS_STAGES:
        return "batch"
    if stage in _PAGE_PROGRESS_STAGES:
        return "page"
    if stage in {"compile", "overlay", "saving", "render_prepare", "render_preprocess", "translation_prepare", "normalizing"}:
        return "step"
    if str(event_type or "").strip() == "stage_progress":
        return "step"
    return "none"


def monotonic_progress_current(
    *,
    user_stage: str,
    substage: str,
    progress_unit: str,
    progress_current: int | None,
) -> int | None:
    if progress_current is None:
        return None
    key = (
        normalize_user_stage(user_stage),
        str(substage or "").strip(),
        str(progress_unit or "").strip(),
    )
    if not key[0] or not key[1] or key[2] in {"", "none"}:
        return progress_current
    snapshot = dict(_ACTIVE_PROGRESS_SNAPSHOT.get() or {})
    previous = snapshot.get(key)
    current = max(int(progress_current), int(previous)) if previous is not None else int(progress_current)
    snapshot[key] = current
    _ACTIVE_PROGRESS_SNAPSHOT.set(snapshot)
    return current


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
        substage: str = "",
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
        payload_value = payload or {}
        user_stage = normalize_user_stage(payload_value.get("user_stage") or user_stage_for_stage(stage))
        substage_value = str(substage or payload_value.get("substage") or provider_stage or "").strip()
        progress_unit = progress_unit_for_stage(stage, event_type, payload_value)
        ts = _now_iso()
        progress_current = monotonic_progress_current(
            user_stage=user_stage,
            substage=substage_value or str(stage or "").strip(),
            progress_unit=progress_unit,
            progress_current=progress_current,
        )
        record = {
            "job_id": self.job_id,
            "seq": self._seq,
            "ts": ts,
            "created_at": ts,
            "level": str(level or "info").strip() or "info",
            "user_stage": user_stage,
            "stage": str(stage or "").strip(),
            "substage": substage_value,
            "stage_detail": str(stage_detail or "").strip(),
            "provider": provider_value,
            "provider_stage": str(provider_stage or "").strip(),
            "event_type": str(event_type or "").strip(),
            "semantic_event_type": semantic_event_type(event_type),
            "message": str(message or "").strip(),
            "progress_current": progress_current,
            "progress_total": progress_total,
            "progress_unit": progress_unit,
            "retry_count": retry_count,
            "elapsed_ms": elapsed_ms,
            "payload": payload_value,
        }
        if record["event_type"] in {"stage_transition", "stage_progress"}:
            record["schema"] = PIPELINE_STAGE_OBSERVATION_SCHEMA
            record["schema_version"] = PIPELINE_STAGE_OBSERVATION_SCHEMA_VERSION
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False))
            handle.write("\n")
        # Stage observations cross the process boundary through stdout. Rust
        # commits them under generation fencing before exposing their event
        # projection. The JSONL file remains a diagnostic/legacy projection.
        if record["event_type"] in {"stage_transition", "stage_progress"}:
            print(json.dumps(record, ensure_ascii=False), flush=True)
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
    substage: str = "",
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
        substage=substage,
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
    substage: str = "",
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
        substage=substage,
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
    substage: str = "",
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
        substage=substage,
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
    current_value = max(0, int(current))
    total_value = max(0, int(total))
    previous = _ACTIVE_RENDER_PAGE_PROGRESS.get()
    if previous is not None and previous[1] == total_value and current_value < previous[0]:
        return None
    _ACTIVE_RENDER_PAGE_PROGRESS.set((current_value, total_value))
    return emit_stage_progress(
        stage="rendering",
        substage="render_pages",
        message=message,
        progress_current=current_value,
        progress_total=total_value,
        payload={
            "user_stage": "render",
            "progress_unit": "page",
            **(payload or {}),
        },
    )


def emit_render_compile_progress(
    *,
    current: int,
    total: int,
    message: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    return emit_stage_progress(
        stage="rendering",
        substage="render_compile",
        message=message,
        progress_current=max(0, int(current)),
        progress_total=max(0, int(total)),
        payload={
            "user_stage": "render",
            "progress_unit": "step",
            **(payload or {}),
        },
    )


def reset_render_page_progress() -> None:
    _ACTIVE_RENDER_PAGE_PROGRESS.set(None)


def emit_artifact_published(
    *,
    artifact_key: str,
    path: Path,
    stage: str,
    message: str = "",
    payload: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    artifact_path = path.resolve()
    record = emit_pipeline_event(
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
    if record is not None:
        print(json.dumps(record, ensure_ascii=False), flush=True)
    return record
