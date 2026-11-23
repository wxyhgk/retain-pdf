"""服务商限流等待（upstream_wait）：开始、结束各一条阶段观察，并发等待合并，进度不动。"""
from __future__ import annotations

import json
import threading
from pathlib import Path

from retainpdf_base.events import PipelineEventWriter
from retainpdf_base.events import emit_stage_progress
from retainpdf_base.events import pipeline_event_writer_scope
from retainpdf_base.upstream_wait import begin_upstream_wait
from retainpdf_base.upstream_wait import build_wait_info
from retainpdf_base.upstream_wait import end_upstream_wait
from retainpdf_base.upstream_wait import error_code_from_body
from retainpdf_base.upstream_wait import upstream_wait_scope
from retainpdf_base.upstream_wait import vendor_for_base_url
from retainpdf_base.upstream_wait import wait_reason


def _rows(writer: PipelineEventWriter) -> list[dict]:
    return [json.loads(line) for line in writer.path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _writer(tmp_path: Path) -> PipelineEventWriter:
    return PipelineEventWriter(job_id="job-1", job_root=tmp_path, logs_dir=tmp_path / "logs")


def _progress(current: int) -> None:
    emit_stage_progress(
        stage="translating",
        substage="translation_batches",
        message=f"已翻译 {current}/10 块",
        progress_current=current,
        progress_total=10,
        payload={"progress_unit": "block", "batch_current": current},
    )


def test_one_wait_emits_start_and_end_that_keep_progress(tmp_path: Path, capsys) -> None:
    writer = _writer(tmp_path)
    with pipeline_event_writer_scope(writer):
        _progress(3)
        with upstream_wait_scope(
            provider="deepseek", http_status=429, wait_s=30, attempt=1, max_attempts=2,
            code="rate_limit_exceeded", wait_source="retry_after",
        ):
            pass
    rows = _rows(writer)
    assert [row["payload"].get("upstream_wait_transition") for row in rows] == [None, "started", "ended"]
    start, end = rows[1], rows[2]
    for row in (start, end):
        # 进度原样重发：阶段、子阶段、数字、单位、阶段说明都不变。
        assert row["event_type"] == "stage_progress"
        assert row["schema"] == "pipeline_stage_observation_v1"
        assert (row["stage"], row["substage"], row["progress_current"], row["progress_total"], row["progress_unit"]) == (
            "translating", "translation_batches", 3, 10, "block",
        )
        assert row["stage_detail"] == "已翻译 3/10 块"
        assert row["payload"]["batch_current"] == 3
    wait = start["payload"]["upstream_wait"]
    assert {k: wait[k] for k in ("provider", "http_status", "reason", "code", "retry_after_s", "wait_source", "attempt", "max_attempts")} == {
        "provider": "deepseek", "http_status": 429, "reason": "rate_limited", "code": "rate_limit_exceeded",
        "retry_after_s": 30.0, "wait_source": "retry_after", "attempt": 1, "max_attempts": 2,
    }
    assert wait["until"] > wait["started_at"]
    assert "服务商限流" in start["message"]
    assert end["payload"]["upstream_wait"] is None
    # seq 递增，stdout 也是这三条（Rust 从 stdout 读）。
    assert [row["seq"] for row in rows] == [1, 2, 3]
    stdout_rows = [json.loads(line) for line in capsys.readouterr().out.splitlines() if line.startswith("{")]
    assert [row["seq"] for row in stdout_rows] == [1, 2, 3]


def test_no_wait_no_extra_events_and_other_statuses_are_silent(tmp_path: Path) -> None:
    writer = _writer(tmp_path)
    with pipeline_event_writer_scope(writer):
        _progress(1)
        for status in (500, 502, 504, None):
            with upstream_wait_scope(provider="deepseek", http_status=status, wait_s=2):
                pass
        _progress(2)
    rows = _rows(writer)
    assert len(rows) == 2
    assert all("upstream_wait" not in row["payload"] for row in rows)


def test_concurrent_waits_are_coalesced_and_progress_during_wait_carries_it(tmp_path: Path) -> None:
    writer = _writer(tmp_path)
    with pipeline_event_writer_scope(writer):
        _progress(4)
        first = build_wait_info(provider="qwen", http_status=429, wait_s=5)
        second = build_wait_info(provider="qwen", http_status=503, wait_s=60)
        assert begin_upstream_wait(user_stage="translation", info=first)
        assert begin_upstream_wait(user_stage="translation", info=second)
        _progress(5)
        end_upstream_wait(user_stage="translation")
        assert writer.active_upstream_wait("translation")["http_status"] == 503
        end_upstream_wait(user_stage="translation")
        _progress(6)
    rows = _rows(writer)
    transitions = [row["payload"].get("upstream_wait_transition") for row in rows]
    assert transitions == [None, "started", None, "ended", None]
    during = rows[2]
    assert during["progress_current"] == 5
    assert during["payload"]["upstream_wait"]["http_status"] == 503
    assert rows[3]["progress_current"] == 5  # 结束事件照最近一条进度重发
    assert "upstream_wait" not in rows[4]["payload"]


def test_waits_reported_from_worker_threads_reach_the_writer(tmp_path: Path) -> None:
    writer = _writer(tmp_path)
    errors: list[BaseException] = []

    def worker() -> None:
        try:
            with upstream_wait_scope(provider="anthropic", http_status=529, wait_s=1):
                pass
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    with pipeline_event_writer_scope(writer):
        _progress(1)
        threads = [threading.Thread(target=worker) for _ in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
    assert not errors
    rows = _rows(writer)
    assert [row["seq"] for row in rows] == list(range(1, len(rows) + 1))
    transitions = [row["payload"].get("upstream_wait_transition") for row in rows[1:]]
    assert transitions and set(transitions) == {"started", "ended"}
    assert transitions.count("started") == transitions.count("ended")
    assert writer.active_upstream_wait("translation") is None


def test_wait_without_earlier_progress_uses_the_default_stage(tmp_path: Path) -> None:
    writer = _writer(tmp_path)
    with pipeline_event_writer_scope(writer):
        with upstream_wait_scope(provider="glm_ocr", http_status=429, wait_s=3, user_stage="ocr"):
            pass
    rows = _rows(writer)
    assert [row["stage"] for row in rows] == ["ocr_processing", "ocr_processing"]
    assert [row["user_stage"] for row in rows] == ["ocr", "ocr"]
    assert rows[0]["payload"]["upstream_wait"]["provider"] == "glm_ocr"


def test_without_writer_nothing_happens() -> None:
    with upstream_wait_scope(provider="deepseek", http_status=429, wait_s=1):
        pass
    assert begin_upstream_wait(user_stage="translation", info=build_wait_info(provider="x", http_status=429, wait_s=1)) is False


def test_helpers() -> None:
    assert [wait_reason(s) for s in (429, 529, 503, 500, None)] == ["rate_limited", "overloaded", "unavailable", None, None]
    assert vendor_for_base_url("https://api.deepseek.com/v1") == "deepseek"
    assert vendor_for_base_url("https://dashscope.aliyuncs.com/compatible-mode/v1") == "qwen"
    assert vendor_for_base_url("https://open.bigmodel.cn/api/paas/v4") == "zhipu"
    assert vendor_for_base_url("https://opencode.ai/inference/go/v1") == "opencode"
    assert vendor_for_base_url("https://api.anthropic.com/v1") == "anthropic"
    assert vendor_for_base_url("https://api.openai.com/v1") == "openai"
    assert vendor_for_base_url("https://opencode.ai.example/v1") == "custom"
    assert vendor_for_base_url("") == "custom"
    assert error_code_from_body('{"error":{"code":"1302","message":"并发过高"}}') == "1302"
    assert error_code_from_body('{"type":"error","error":{"type":"overloaded_error"}}') == "overloaded_error"
    assert error_code_from_body("not json") == ""
    assert error_code_from_body('{"error":{"code":"' + "x" * 200 + '"}}') == ""
