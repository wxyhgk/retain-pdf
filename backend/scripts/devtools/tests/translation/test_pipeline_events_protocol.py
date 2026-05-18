from __future__ import annotations

import json
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.pipeline_shared.events import emit_artifact_published
from services.pipeline_shared.events import emit_stage_progress
from services.pipeline_shared.events import emit_stage_transition
from services.pipeline_shared.events import PipelineEventWriter
from services.pipeline_shared.events import pipeline_event_writer_scope


def test_pipeline_event_writer_emits_structured_jsonl(tmp_path: Path) -> None:
    logs_dir = tmp_path / "logs"
    writer = PipelineEventWriter(
        job_id="job-1",
        job_root=tmp_path,
        logs_dir=logs_dir,
        workflow="book",
        provider="paddle",
    )

    with pipeline_event_writer_scope(writer):
        emit_stage_transition(
            stage="startup",
            message="worker started",
        )
        emit_stage_progress(
            stage="translating",
            message="batch done",
            progress_current=3,
            progress_total=5,
            elapsed_ms=1234,
        )
        artifact_path = tmp_path / "artifacts" / "pipeline_summary.json"
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        artifact_path.write_text("{}", encoding="utf-8")
        emit_artifact_published(
            artifact_key="pipeline_summary_json",
            path=artifact_path,
            stage="saving",
            message="summary ready",
        )

    events_path = logs_dir / "pipeline_events.jsonl"
    rows = [
        json.loads(line)
        for line in events_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]

    assert [row["event_type"] for row in rows] == [
        "stage_transition",
        "stage_progress",
        "artifact_published",
    ]
    assert rows[0]["provider"] == "paddle"
    assert rows[1]["user_stage"] == "translate"
    assert rows[1]["progress_unit"] == "batch"
    assert rows[1]["progress_current"] == 3
    assert rows[1]["progress_total"] == 5
    assert rows[1]["elapsed_ms"] == 1234
    assert rows[2]["payload"]["artifact_key"] == "pipeline_summary_json"
    assert rows[2]["payload"]["path"] == str(artifact_path.resolve())


def test_artifact_published_prints_structured_stdout_event(tmp_path: Path, capsys) -> None:
    logs_dir = tmp_path / "logs"
    writer = PipelineEventWriter(
        job_id="job-stdout",
        job_root=tmp_path,
        logs_dir=logs_dir,
        workflow="book",
    )
    artifact_path = tmp_path / "rendered" / "output.pdf"
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    artifact_path.write_bytes(b"%PDF")

    with pipeline_event_writer_scope(writer):
        emit_artifact_published(
            artifact_key="output_pdf",
            path=artifact_path,
            stage="saving",
            message="output ready",
        )

    stdout_rows = [
        json.loads(line)
        for line in capsys.readouterr().out.splitlines()
        if line.strip()
    ]
    assert len(stdout_rows) == 1
    assert stdout_rows[0]["event_type"] == "artifact_published"
    assert stdout_rows[0]["payload"]["artifact_key"] == "output_pdf"
    assert stdout_rows[0]["payload"]["path"] == str(artifact_path.resolve())
