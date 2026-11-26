"""事件文件末尾的半行（2026-11-26，状态管理 Z5 / S29、附录 B-N1）。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from retainpdf_base.contracts import PIPELINE_EVENTS_FILE_NAME
from retainpdf_base.events import PipelineEventWriter


def _writer(tmp_path: Path) -> PipelineEventWriter:
    return PipelineEventWriter(job_id="job-1", job_root=tmp_path, logs_dir=tmp_path / "logs")


def _emit(writer: PipelineEventWriter, count: int) -> list[int]:
    return [
        writer.emit(level="info", stage="translating", event_type="stage_progress", message="m")["seq"]
        for _ in range(count)
    ]


def test_partial_trailing_event_line_is_dropped_so_resumes_keep_seq_increasing(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A 发 1–5，写第 6 行时被杀（半行）；B 续跑发 3 条；C 再续跑。Rust 要求同一 attempt、同一阶段的 seq 严格递增，
    修之前 C 的第一条等于 B 的最后一条，判 seq 倒退、整本失败。"""
    seqs = _emit(_writer(tmp_path), 5)
    events = tmp_path / "logs" / PIPELINE_EVENTS_FILE_NAME
    with events.open("ab") as handle:
        handle.write(b'{"job_id": "job-1", "seq": 6, "ts": "2026-11-')
    seqs += _emit(_writer(tmp_path), 3)
    seqs += _emit(_writer(tmp_path), 1)
    capsys.readouterr()

    assert seqs == sorted(set(seqs)), f"seq 倒退或重复: {seqs}"
    lines = events.read_bytes().split(b"\n")
    assert lines[-1] == b"", "文件要以换行结尾"
    records = [json.loads(line) for line in lines[:-1]]
    assert [record["seq"] for record in records] == seqs, "半行要截掉，每一行都是完整的一条"


def test_event_file_without_partial_line_is_left_as_is(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    _emit(_writer(tmp_path), 2)
    events = tmp_path / "logs" / PIPELINE_EVENTS_FILE_NAME
    before = events.read_bytes()
    assert _emit(_writer(tmp_path), 1) == [3]
    assert events.read_bytes().startswith(before)
    capsys.readouterr()
