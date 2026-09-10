"""Read allowlisted diagnostics; never copy raw logs or request credentials."""
import json
import hashlib
import sqlite3
from collections import Counter
from datetime import datetime
from pathlib import Path


def server_timing(state: dict) -> dict:
    """Stage runners can reset started_at; never label their duration as total."""
    timestamps = state.get("timestamps") or {}
    total = None
    try:
        created = datetime.fromisoformat(timestamps["created_at"].replace("Z", "+00:00"))
        finished = datetime.fromisoformat(timestamps["finished_at"].replace("Z", "+00:00"))
        value = (finished - created).total_seconds()
        if value >= 0:
            total = value
    except (KeyError, TypeError, ValueError, AttributeError):
        pass
    return {"server_duration_seconds": total, "last_stage_duration_seconds": timestamps.get("duration_seconds"), "server_duration_scope": "created_to_finished_including_queue"}


def collect_model_metrics(db_path: Path, job_id: str) -> dict:
    """Read the new journal without exporting text, credentials or raw errors."""
    if not db_path.is_file():
        return {"available": False}
    with sqlite3.connect(f"{db_path.resolve().as_uri()}?mode=ro", uri=True) as conn:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {"model_operations", "model_sessions"} <= tables:
            return {"available": False}
        profile = conn.execute("SELECT profile_json FROM model_sessions WHERE job_id=?", (job_id,)).fetchone()
        if profile is None:
            return {"available": False}
        rows = conn.execute("SELECT status,result_json FROM model_operations WHERE job_id=?", (job_id,)).fetchall()
    receipts = [json.loads(raw) if raw else {} for _, raw in rows]
    metrics = {}
    fields = ("queue_ms", "connect_ms", "first_event_ms", "first_content_ms", "generation_ms", "total_ms", "input_tokens", "output_tokens", "reasoning_tokens", "cached_tokens", "upstream_attempts")
    for field in fields:
        values = [r[field] for r in receipts if isinstance(r.get(field), (int, float)) and not isinstance(r[field], bool) and r[field] >= 0]
        metrics[field] = {"known_count": len(values), "unknown_count": len(rows) - len(values), "sum": sum(values) if values else None, "max": max(values) if values else None}
    return {"available": True, "transport": "rust_executor_v1", "configuration_fingerprint": hashlib.sha256(profile[0].encode()).hexdigest(), "operation_count": len(rows), "status_counts": dict(Counter(status for status, _ in rows)), "metrics": metrics, "cost": None, "cost_note": "Unknown; token observations are not a billing receipt. Per-operation durations overlap and are not wall time."}


def collect_metrics(job_root: Path) -> dict:
    result = {}
    diagnostics = job_root / "artifacts/translation_diagnostics.json"
    if diagnostics.is_file():
        data = json.loads(diagnostics.read_text())
        for key in ("phase_elapsed_ms", "request_counts", "tail_retry", "token_usage", "adaptive_concurrency", "status_summary", "unresolved_translation_count", "result_flush", "result_apply", "scheduler_metrics", "translation_queue_split", "checkpoint_timing", "garbled_reconstruction"):
            result[key] = data.get(key)
        result["first_page_commit_ms_since_run_start"] = data.get("first_page_commit_ms_since_run_start")
    observations = []
    events = job_root / "logs/pipeline_events.jsonl"
    if events.is_file():
        for line in events.read_text().splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            elapsed = event.get("elapsed_ms")
            if isinstance(elapsed, (int, float)) and elapsed >= 0:
                observations.append({key: event.get(key) for key in ("seq", "ts", "stage", "substage", "event_type", "elapsed_ms")})
    result["stage_elapsed_observations"] = observations
    result["timing_note"] = "Producer elapsed observations can overlap; do not sum them. Missing metrics mean uninstrumented, not zero. HTTP latency may include local queue wait."
    return result
