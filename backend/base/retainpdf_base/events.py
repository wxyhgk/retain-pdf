from __future__ import annotations

import copy
import json
import os
import threading
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from dataclasses import field
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

# 服务商限流等待（upstream_wait）挂在阶段观察 payload 上的键，见 ``retainpdf_base.upstream_wait``。
UPSTREAM_WAIT_PAYLOAD_KEY = "upstream_wait"
UPSTREAM_WAIT_TRANSITION_PAYLOAD_KEY = "upstream_wait_transition"
_STAGE_OBSERVATION_EVENT_TYPES = {"stage_transition", "stage_progress"}
_BACKGROUND_SUBSTAGES = {"render_prewarm"}
# 某个阶段还没发过任何阶段观察时，等待事件用的阶段名。
_DEFAULT_RAW_STAGE_FOR_USER_STAGE = {
    "ocr": "ocr_processing",
    "translation": "translating",
    "render": "rendering",
}

# 当前进程里最近进入的 writer。翻译请求多在线程池里发，ContextVar 跟不过去；
# 只有服务商限流等待（``retainpdf_base.upstream_wait``）拿它兜底，别的事件照旧只认 ContextVar。
_PROCESS_PIPELINE_EVENT_WRITER: "PipelineEventWriter | None" = None
_PROCESS_WRITER_LOCK = threading.Lock()


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


def _drop_partial_tail_and_count_lines(path: Path) -> int:
    """打开事件文件追加之前：截掉末尾没写完的半行（进程在写一行时被杀），返回完整的非空行数，下一条的 seq 接着它数。

    照翻译请求日志 ``request_journal._load_existing_state`` 的写法（2026-11-26，Z5 / S29）。以前不截：半行和下一条
    记录粘成一行，行数从此比用过的 seq 少 1，同一个 attempt 第二次续跑时发出的 seq 和上一次重复，Rust 判倒退
    （``db/pipeline/stages.rs``：同一任务、attempt、阶段内 ``producer_seq`` 必须严格递增），整本失败。
    截掉的半行从没打到 stdout（每条先整行落盘、再打印），Rust 没见过它的 seq，重用不会倒退。
    """
    try:
        raw = path.read_bytes()
    except OSError:
        return 0
    valid_size = len(raw) if not raw or raw.endswith(b"\n") else raw.rfind(b"\n") + 1
    if valid_size != len(raw):
        try:
            with path.open("r+b") as handle:
                handle.truncate(valid_size)
                handle.flush()
                os.fsync(handle.fileno())
        except OSError:
            # 截不掉就在前面补一个换行，至少不让下一条粘到半行上；半行算作一行，seq 只会多不会少。
            _append_line(path, "")
            return sum(1 for line in raw.split(b"\n") if line.strip())
    return sum(1 for line in raw[:valid_size].split(b"\n") if line.strip())


def _append_line(path: Path, text: str) -> None:
    """整行（带换行）一次 ``write`` 追加：并发追加同一个文件的进程（并行 OCR 时 OCR 子进程和父任务）不会交错成半行。"""
    data = (text + "\n").encode("utf-8") if text else b"\n"
    flags = os.O_WRONLY | os.O_APPEND | os.O_CREAT | getattr(os, "O_BINARY", 0)
    fd = os.open(path, flags, 0o666)
    try:
        view = memoryview(data)
        while view:
            written = os.write(fd, view)
            view = view[written:]
    finally:
        os.close(fd)


@dataclass
class PipelineEventWriter:
    job_id: str
    job_root: Path
    logs_dir: Path
    workflow: str = ""
    provider: str = ""
    _seq: int = 0
    # seq 加一、写文件、打 stdout 在一把锁里：等待事件从翻译线程发，Rust 要求 seq 递增（倒退会拒收）。
    _lock: threading.RLock = field(default_factory=threading.RLock, repr=False, compare=False)
    # 各 user_stage 最近一条主线阶段观察（等待开始/结束事件照它重发进度，不动进度数字）。
    _last_main_records: dict[str, dict[str, Any]] = field(default_factory=dict, repr=False, compare=False)
    # 各 user_stage 正在进行的限流等待：{"count": 同时在等的请求数, "info": 最近一次等待的信息}。
    _upstream_waits: dict[str, dict[str, Any]] = field(default_factory=dict, repr=False, compare=False)

    def __post_init__(self) -> None:
        self._seq = _drop_partial_tail_and_count_lines(self.path)

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
        with self._lock:
            return self._emit_locked(
                level=level,
                stage=stage,
                event_type=event_type,
                substage=substage,
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

    def _emit_locked(
        self,
        *,
        level: str,
        stage: str,
        event_type: str,
        substage: str,
        message: str,
        stage_detail: str,
        provider: str,
        provider_stage: str,
        progress_current: int | None,
        progress_total: int | None,
        retry_count: int | None,
        elapsed_ms: int | None,
        payload: dict[str, Any] | None,
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
        if record["event_type"] in _STAGE_OBSERVATION_EVENT_TYPES:
            record["schema"] = PIPELINE_STAGE_OBSERVATION_SCHEMA
            record["schema_version"] = PIPELINE_STAGE_OBSERVATION_SCHEMA_VERSION
            main_lane = record["substage"] not in _BACKGROUND_SUBSTAGES
            active_wait = self._upstream_waits.get(user_stage) if main_lane else None
            if active_wait is not None and UPSTREAM_WAIT_PAYLOAD_KEY not in payload_value:
                # 等待期间别的线程照常报进度：带上等待信息，免得最新一条进度把「等待中」盖掉。
                record["payload"] = {**payload_value, UPSTREAM_WAIT_PAYLOAD_KEY: dict(active_wait["info"])}
            if main_lane and user_stage:
                self._last_main_records[user_stage] = record
        _append_line(self.path, json.dumps(record, ensure_ascii=False))
        # Stage observations cross the process boundary through stdout. Rust
        # commits them under generation fencing before exposing their event
        # projection. The JSONL file remains a diagnostic/legacy projection.
        if record["event_type"] in _STAGE_OBSERVATION_EVENT_TYPES:
            print(json.dumps(record, ensure_ascii=False), flush=True)
        return record

    def begin_upstream_wait(self, *, user_stage: str, info: dict[str, Any], message: str) -> None:
        """一个请求开始等服务商限流。同一 user_stage 已经有请求在等时只更新等待信息，不另发事件。"""
        user_stage = normalize_user_stage(user_stage)
        with self._lock:
            state = self._upstream_waits.get(user_stage)
            if state is not None:
                state["count"] += 1
                if str(info.get("until") or "") >= str(state["info"].get("until") or ""):
                    state["info"] = dict(info)
                return
            self._upstream_waits[user_stage] = {"count": 1, "info": dict(info)}
            self._emit_wait_transition(user_stage=user_stage, info=dict(info), transition="started", message=message)

    def end_upstream_wait(self, *, user_stage: str, message: str) -> None:
        """一个请求等完了。同一 user_stage 所有在等的请求都等完，才发一条结束事件（upstream_wait=null）。"""
        user_stage = normalize_user_stage(user_stage)
        with self._lock:
            state = self._upstream_waits.get(user_stage)
            if state is None:
                return
            state["count"] -= 1
            if state["count"] > 0:
                return
            self._upstream_waits.pop(user_stage, None)
            self._emit_wait_transition(user_stage=user_stage, info=None, transition="ended", message=message)

    def active_upstream_wait(self, user_stage: str) -> dict[str, Any] | None:
        with self._lock:
            state = self._upstream_waits.get(normalize_user_stage(user_stage))
            return dict(state["info"]) if state is not None else None

    def _emit_wait_transition(
        self,
        *,
        user_stage: str,
        info: dict[str, Any] | None,
        transition: str,
        message: str,
    ) -> None:
        # 照这个阶段最近一条主线观察重发（阶段、子阶段、进度数字、阶段说明都不变），只换 message、
        # 在 payload 上挂 upstream_wait：Rust 那边进度不倒退、不算「有进展」，前端看 payload 显示等待。
        base = self._last_main_records.get(user_stage)
        if base is not None:
            payload = copy.deepcopy(base.get("payload") or {})
            stage = str(base.get("stage") or "")
            substage = str(base.get("substage") or "")
            stage_detail = str(base.get("stage_detail") or "")
            provider = str(base.get("provider") or "")
            provider_stage = str(base.get("provider_stage") or "")
            progress_current = base.get("progress_current")
            progress_total = base.get("progress_total")
            progress_unit = str(base.get("progress_unit") or "")
        else:
            payload = {}
            stage = _DEFAULT_RAW_STAGE_FOR_USER_STAGE.get(user_stage, user_stage)
            substage = ""
            stage_detail = ""
            provider = ""
            provider_stage = ""
            progress_current = None
            progress_total = None
            progress_unit = ""
        payload.pop(UPSTREAM_WAIT_TRANSITION_PAYLOAD_KEY, None)
        payload["user_stage"] = user_stage
        if progress_unit:
            payload["progress_unit"] = progress_unit
        payload[UPSTREAM_WAIT_PAYLOAD_KEY] = info
        payload[UPSTREAM_WAIT_TRANSITION_PAYLOAD_KEY] = transition
        self._emit_locked(
            level="warning" if info is not None else "info",
            stage=stage,
            event_type="stage_progress",
            substage=substage,
            message=message,
            stage_detail=stage_detail or message,
            provider=provider,
            provider_stage=provider_stage,
            progress_current=progress_current,
            progress_total=progress_total,
            retry_count=None,
            elapsed_ms=None,
            payload=payload,
        )


@contextmanager
def pipeline_event_writer_scope(writer: PipelineEventWriter):
    global _PROCESS_PIPELINE_EVENT_WRITER
    token = _ACTIVE_PIPELINE_EVENT_WRITER.set(writer)
    with _PROCESS_WRITER_LOCK:
        previous_process_writer = _PROCESS_PIPELINE_EVENT_WRITER
        _PROCESS_PIPELINE_EVENT_WRITER = writer
    try:
        yield writer
    finally:
        _ACTIVE_PIPELINE_EVENT_WRITER.reset(token)
        with _PROCESS_WRITER_LOCK:
            if _PROCESS_PIPELINE_EVENT_WRITER is writer:
                _PROCESS_PIPELINE_EVENT_WRITER = previous_process_writer


def get_active_pipeline_event_writer() -> PipelineEventWriter | None:
    return _ACTIVE_PIPELINE_EVENT_WRITER.get()


def get_process_pipeline_event_writer() -> PipelineEventWriter | None:
    """当前上下文的 writer；线程池里拿不到时退回本进程最近进入的 writer（只给限流等待用）。"""
    return _ACTIVE_PIPELINE_EVENT_WRITER.get() or _PROCESS_PIPELINE_EVENT_WRITER


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


def emit_render_prepare_progress(
    *,
    current: int,
    total: int,
    message: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    # Main-lane render preparation (document analysis, source cleanup, layout
    # and color payload) that runs before the first page is rendered. It must
    # stay off "render_prewarm" (background lane) and "render_pages" (page
    # progress with rollback guard), so it gets its own step-based substage.
    return emit_stage_progress(
        stage="rendering",
        substage="render_prepare",
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
