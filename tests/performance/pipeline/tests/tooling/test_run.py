from support.paths import HERE
import importlib.util
import json
import socket
from pathlib import Path
import sqlite3
from types import SimpleNamespace
from unittest import mock

import pytest

SPEC = importlib.util.spec_from_file_location("benchmark_translation", HERE / "run.py")
bench = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bench)


@pytest.fixture
def offline_benchmark(monkeypatch):
    """Fail closed if a CLI test bypasses its fake API; never inherit a live key."""
    def forbidden(*args, **kwargs):
        raise AssertionError("Benchmark test attempted real network access")

    monkeypatch.setenv("RETAIN_BENCH_API_KEY", "synthetic-benchmark-key")
    monkeypatch.setattr(bench.requests.sessions.Session, "request", forbidden)
    monkeypatch.setattr(socket, "getaddrinfo", forbidden)
    monkeypatch.setattr(socket, "create_connection", forbidden)
    monkeypatch.setattr(socket.socket, "connect", forbidden)
    monkeypatch.setattr(socket.socket, "connect_ex", forbidden)


def test_offline_benchmark_blocks_http_and_dns(offline_benchmark):
    with pytest.raises(AssertionError, match="real network access"):
        bench.requests.Session().get("https://unused.invalid")
    with pytest.raises(AssertionError, match="real network access"):
        socket.getaddrinfo("unused.invalid", 443)


def test_server_timing_does_not_mistake_render_duration_for_total():
    result = bench.server_timing({"timestamps": {"created_at": "2026-09-05T01:00:00Z", "finished_at": "2026-09-05T01:10:00Z", "duration_seconds": 10}})
    assert result["server_duration_seconds"] == 600
    assert result["last_stage_duration_seconds"] == 10
    assert bench.server_timing({"timestamps": {"duration_seconds": 10}})["server_duration_seconds"] is None


def test_comparison_does_not_compare_old_stage_duration_with_new_total():
    from tools.analysis.compare import compare
    result = compare({"server_duration_seconds": 10}, {"server_duration_seconds": 600,"server_duration_scope":"created_to_finished_including_queue"})
    assert "server_duration_scope" in result["config_differences"]
    assert "change_percent" not in result["metrics"]["server_duration_seconds"]


def test_comparison_exports_nested_checkpoint_metrics_without_filling_missing_with_zero():
    from tools.analysis.compare import compare
    result = compare({"checkpoint_timing": {"update_elapsed_ms": 20}},
                     {"checkpoint_timing": {"update_elapsed_ms": 10, "snapshot_elapsed_ms": 3},
                      "result_flush": {"flush_total_elapsed_ms": 15}})
    assert result["metrics"]["checkpoint_timing.update_elapsed_ms"]["change_percent"] == -50
    assert result["metrics"]["checkpoint_timing.snapshot_elapsed_ms"]["before"] is None
    assert "change_percent" not in result["metrics"]["result_flush.flush_total_elapsed_ms"]


def test_report_collects_checkpoint_and_repair_diagnostics(tmp_path):
    from support.reporting import collect_metrics
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    (artifacts / "translation_diagnostics.json").write_text(json.dumps({
        "checkpoint_timing": {"update_elapsed_ms": 12.3},
        "garbled_reconstruction": {"garbled_failed": 2},
        "result_flush": {"flush_callback_elapsed_ms": 10},
        "private_config": "must-not-export",
    }))
    report = collect_metrics(tmp_path)
    assert report["checkpoint_timing"] == {"update_elapsed_ms": 12.3}
    assert report["garbled_reconstruction"] == {"garbled_failed": 2}
    assert report["result_flush"] == {"flush_callback_elapsed_ms": 10}
    assert "private_config" not in report


def test_executor_metrics_exclude_content_and_preserve_unknown(tmp_path):
    db = tmp_path / "jobs.db"
    with sqlite3.connect(db) as conn:
        conn.execute("CREATE TABLE model_sessions (job_id TEXT,profile_json TEXT)")
        conn.execute("CREATE TABLE model_operations (job_id TEXT,status TEXT,result_json TEXT)")
        conn.execute("INSERT INTO model_sessions VALUES ('j',?)", (json.dumps({"credential_ref": "do-not-export", "model": "qwen"}),))
        conn.execute("INSERT INTO model_operations VALUES ('j','succeeded',?)", (json.dumps({"content": "private document text", "connect_ms": None, "queue_ms": 0, "upstream_attempts": 1}),))
    result = bench.collect_model_metrics(db, "j")
    assert result["metrics"]["connect_ms"]["sum"] is None
    assert result["metrics"]["queue_ms"]["sum"] == 0
    assert "private document" not in json.dumps(result)
    assert "do-not-export" not in json.dumps(result)
    assert bench.collect_model_metrics(db, "unknown") == {"available": False}


def test_saved_qwen_config_and_payload_do_not_reuse_old_source(tmp_path):
    db = tmp_path / "jobs.db"
    config = {"source": {"artifact_job_id": "old"}, "translation": {"model": "qwen-test", "api_key": "secret", "start_page": 4, "page_ranges": [5], "workers": 20}, "ocr": {"page_ranges": "5", "paddle_token": "ocr-secret"}}
    with sqlite3.connect(db) as conn:
        conn.execute("create table jobs (job_id text, request_json text, updated_at text)")
        conn.execute("insert into jobs values (?,?,?)", ("qwen-old", json.dumps(config), "1"))
        conn.execute("insert into jobs values (?,?,?)", ("other-new", '{"translation":{"model":"other"}}', "2"))
    source, saved = bench.load_config(db, None)
    assert source == "qwen-old"
    args = SimpleNamespace(workers=8, batch_size=1, timeout=600)
    payload = bench.build_payload(saved, "new-upload", "new-job", args)
    assert payload["source"] == {"upload_id": "new-upload"}
    assert payload["translation"]["page_ranges"] == []
    assert payload["translation"]["api_key"] == "secret"
    assert payload["translation"]["workers"] == 8
    assert saved == config


def test_worker_override_preserves_executor_snapshot_and_source():
    config = {"translation": {"workers": 2, "execution_connection": {
        "id": "qwen", "concurrency": 2, "thinking": "off",
    }}}
    payload = bench.build_payload(config, "upload", "job", SimpleNamespace(
        workers=4, batch_size=None, timeout=600,
    ))
    assert payload["translation"]["execution_connection"] == {
        "id": "qwen", "concurrency": 4, "thinking": "off",
    }
    assert config["translation"]["execution_connection"]["concurrency"] == 2


def test_api_does_not_follow_redirects_or_expose_response_secrets(offline_benchmark):
    session = mock.Mock()
    session.request.return_value = SimpleNamespace(status_code=302, text="secret")
    with pytest.raises(RuntimeError) as exc:
        bench.api(session, "http://127.0.0.1:41000", "POST", "/api/v1/jobs")
    assert "secret" not in str(exc.value)
    assert session.request.call_args.kwargs["allow_redirects"] is False


@pytest.mark.parametrize("stage, reuse", [("translate", False), ("translate", True), ("render", True), ("ocr", False), ("full", False)])
def test_run_writes_metrics_without_credentials(tmp_path, monkeypatch, stage, reuse, offline_benchmark):
    fixture = tmp_path / "fixture.pdf"
    fixture.write_bytes(b"%PDF-1.7\nfixture")
    monkeypatch.setattr(bench, "ROOT", tmp_path)
    argv = ["benchmark", "--pdf", str(fixture), "--run", "--stage", stage]
    if reuse:
        argv += ["--source-job", "prior"]
        source = tmp_path / "data/jobs/prior/source"
        source.mkdir(parents=True)
        (source / "original.pdf").write_bytes(fixture.read_bytes())
        artifact = tmp_path / "data/jobs/prior" / ("translated/translation-manifest.json" if stage == "render" else "ocr/normalized/document.v1.json")
        artifact.parent.mkdir(parents=True)
        artifact.write_text("{}")
    monkeypatch.setattr("sys.argv", argv)
    monkeypatch.setattr(bench, "load_config", lambda *_: ("source", {"translation": {"model": "qwen-test", "api_key": "private-token", "base_url": "https://example.com/v1"}}))
    calls = []

    def fake_api(session, base, method, path, **kwargs):
        assert session.headers["X-API-Key"] == "synthetic-benchmark-key"
        calls.append((method, path))
        if path.endswith("uploads"):
            return {"upload_id": "upload-test"}
        if method == "POST":
            assert kwargs["json"]["workflow"] == ("book" if stage == "full" else stage)
            if reuse:
                assert kwargs["json"]["source"] == {"artifact_job_id": "prior"}
            job = kwargs["json"]["runtime"]["job_id"]
            artifacts = tmp_path / "data/jobs" / job / "artifacts"
            artifacts.mkdir(parents=True)
            (artifacts / "translation_diagnostics.json").write_text(json.dumps({"request_counts": {"total_http_attempts": 2}}))
            return {"job_id": job}
        return {"status": "succeeded", "stage": "finished"}

    monkeypatch.setattr(bench, "api", fake_api)
    assert bench.main() == 0
    report = next(tmp_path.glob("tmp/pipeline-benchmarks/*/report.json")).read_text()
    assert "private-token" not in report
    assert "synthetic-benchmark-key" not in report
    assert json.loads(report)["request_counts"]["total_http_attempts"] == 2
    assert len(calls) == (2 if reuse else 3)


def test_reused_pdf_mismatch_is_rejected_before_network(tmp_path, monkeypatch, offline_benchmark):
    fixture = tmp_path / "fixture.pdf"
    fixture.write_bytes(b"%PDF-1.7 new")
    source = tmp_path / "data/jobs/prior/source"
    source.mkdir(parents=True)
    (source / "old.pdf").write_bytes(b"%PDF-1.7 different")
    monkeypatch.setattr(bench, "ROOT", tmp_path)
    monkeypatch.setattr("sys.argv", ["benchmark", "--pdf", str(fixture), "--source-job", "prior", "--run"])
    monkeypatch.setattr(bench, "load_config", lambda *_: ("prior", {}))
    with mock.patch.object(bench, "api") as api:
        with pytest.raises(ValueError, match="does not match"):
            bench.main()
        api.assert_not_called()


def test_stage_metrics_keep_overlapping_observations_separate(tmp_path):
    logs = tmp_path / "logs"
    logs.mkdir()
    (logs / "pipeline_events.jsonl").write_text('\n'.join([
        json.dumps({"stage": "render", "elapsed_ms": 100, "message": "private text"}),
        json.dumps({"stage": "render", "elapsed_ms": 200}),
        "partial-json",
    ]))
    metrics = bench.collect_metrics(tmp_path)
    assert [e["elapsed_ms"] for e in metrics["stage_elapsed_observations"]] == [100, 200]
    assert "private text" not in json.dumps(metrics)
    assert "phase_elapsed_ms" not in metrics


def test_compare_flags_different_fixture_and_missing_measurements():
    spec = importlib.util.spec_from_file_location("benchmark_compare", HERE / "tools/analysis/compare.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    result = module.compare({"pdf_sha256": "a", "wall_seconds": 10}, {"pdf_sha256": "b", "wall_seconds": 5})
    assert "pdf_sha256" in result["config_differences"]
    assert result["metrics"]["wall_seconds"]["change_percent"] == -50
    assert "change_percent" not in result["metrics"]["server_duration_seconds"]
    assert not result["successful_pair"]
