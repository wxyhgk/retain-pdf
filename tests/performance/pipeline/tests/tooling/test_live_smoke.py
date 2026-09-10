import sys
import json
import copy
import hashlib
from pathlib import Path
from types import SimpleNamespace

import pytest

from live_smoke import configure_translation
import live_smoke


def test_comparison_evidence_tracks_effective_inputs_without_credentials(tmp_path):
    normalized = tmp_path / "document.json"
    normalized.write_text('{"pages": []}')
    translation = {"model": "qwen", "context_mode": "off", "api_key": "secret-one",
                   "execution_connection": {"credential_ref": "cred-one", "concurrency": 8}}
    original = copy.deepcopy(translation)

    def evidence(value):
        return live_smoke.comparison_evidence(pdf_sha256="a" * 64,
                                             normalized_path=normalized, translation=value)

    first = evidence(translation)
    assert translation == original
    changed_credentials = copy.deepcopy(translation)
    changed_credentials["api_key"] = "secret-two"
    changed_credentials["execution_connection"]["credential_ref"] = "cred-two"
    assert evidence(changed_credentials) == first
    assert evidence(dict(reversed(list(translation.items())))) == first
    assert "secret" not in json.dumps(first) and "cred-one" not in json.dumps(first)
    changed_config = {**translation, "context_mode": "window"}
    assert evidence(changed_config)["translation_config_sha256"] != first["translation_config_sha256"]
    normalized.write_text('{"pages": [1]}')
    assert evidence(translation)["normalized_document_sha256"] != first["normalized_document_sha256"]


def test_full_pdf_workers_match_frozen_connection_without_reusing_page_selection():
    source = {"model": "qwen3.8-flash", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
              "credential_ref": "cred_test", "api_key": "secret", "workers": 2,
              "start_page": 5, "end_page": 6, "page_ranges": [6]}
    result = configure_translation(source, workers=8, all_pages=True, fake_ip=True)
    assert result["workers"] == result["execution_connection"]["concurrency"] == 8
    assert (result["start_page"], result["end_page"], result["page_ranges"]) == (0, -1, [])
    assert result["api_key"] == ""
    assert result["execution_connection"]["thinking"] == "off"
    assert source["api_key"] == "secret" and source["start_page"] == 5


def test_default_smoke_remains_two_pages():
    result = configure_translation({"model": "qwen3.8-flash", "base_url": "https://example.org",
                                    "credential_ref": "cred_test"}, workers=2, all_pages=False, fake_ip=False)
    assert result["end_page"] == 1
    assert not result["execution_connection"]["allow_private_endpoint"]


@pytest.fixture
def smoke_lifecycle(tmp_path, monkeypatch):
    """A synthetic --run environment: no sockets, processes or provider calls."""
    root = tmp_path / "project"
    source = root / "data/jobs/source-job"
    fixture = root / "tmp/testPDF/test1.pdf"
    fixture.parent.mkdir(parents=True)
    fixture.write_bytes(b"synthetic PDF; no document content")
    (source / "source").mkdir(parents=True)
    (source / "source/input.pdf").write_bytes(fixture.read_bytes())
    (source / "ocr/normalized").mkdir(parents=True)
    (source / "ocr/normalized/document.v1.json").write_text("{}")
    vault = root / "data/secrets/credentials.json"
    vault.parent.mkdir(parents=True)
    credential = "synthetic-provider-secret-never-send"
    vault.write_text(json.dumps({"credentials": {"cred_test": {"secret": credential}}}))
    original = vault.read_bytes()
    state = SimpleNamespace(root=root, source_vault=vault, original_vault=original,
                            secret=credential, failure=None, calls=[], processes=[],
                            sessions=[], clock=0, sockets=0)

    def forbidden(*args, **kwargs):
        raise AssertionError("Live I/O is forbidden in smoke lifecycle tests")

    class FakeSocket:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def bind(self, address):
            assert address == ("127.0.0.1", 0)
            state.sockets += 1
            if state.failure == "port" or (state.failure == "second_port" and state.sockets == 2):
                raise OSError("synthetic bind failure")

        def getsockname(self):
            return ("127.0.0.1", 43000 + state.sockets)

        connect = forbidden

    class FakeSession:
        def __init__(self):
            self.headers = {}
            self.hooks = {"response": []}
            self.closed = False
            state.sessions.append(self)

        def get(self, url, **kwargs):
            assert url.startswith("http://127.0.0.1:")
            return SimpleNamespace(status_code=200)

        def close(self):
            self.closed = True
            if state.failure == "session_cleanup":
                raise OSError("synthetic session close failure")

    class FakeProcess:
        pid = 123456789

        def __init__(self, *args, **kwargs):
            if state.failure == "startup":
                raise OSError("synthetic process startup failure")
            self.stopped = False
            state.processes.append(self)

        def poll(self):
            return 0 if self.stopped else None

        def wait(self, **kwargs):
            self.stopped = True
            return 0

    class FakeDatabase:
        description = [("job_id",)]

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def execute(self, query, params):
            assert params == ("source-job",)
            return self

        def fetchall(self):
            return [("source-job",)]

        def executemany(self, *args):
            pass

    def fake_api(session, base, method, path, **kwargs):
        assert base.startswith("http://127.0.0.1:")
        state.calls.append((method, path))
        if method == "POST" and path == "/api/v1/jobs":
            assert kwargs["json"]["translation"]["api_key"] == ""
            if state.failure == "submission":
                raise TimeoutError("ambiguous submission " + credential)
            if state.failure == "http_error":
                response = SimpleNamespace(status_code=502, text=credential + " " + session.headers["X-API-Key"])
                for hook in session.hooks["response"]:
                    hook(response)
                raise RuntimeError("synthetic local HTTP error")
        return {"status": "running" if state.failure == "timeout" else "succeeded"}

    def monotonic():
        state.clock += 30 if state.failure == "timeout" else 0.1
        return state.clock

    def killpg(*args):
        if state.failure == "process_cleanup":
            raise OSError("synthetic termination failure")

    real_copytree = live_smoke.shutil.copytree

    def copytree(*args, **kwargs):
        if state.failure == "copy":
            raise OSError("synthetic copy failure")
        return real_copytree(*args, **kwargs)

    monkeypatch.setattr(live_smoke, "ROOT", root)
    monkeypatch.setattr(sys, "argv", ["live_smoke", "--source-job", "source-job", "--run", "--timeout", "1"])
    monkeypatch.setattr(live_smoke, "load_config", lambda *args: (None, {"translation": {
        "model": "qwen3.8-flash", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "credential_ref": "cred_test", "api_key": credential}}))
    monkeypatch.setattr(live_smoke.socket, "getaddrinfo", lambda *args: [(None, None, None, None, ("8.8.8.8", 443))])
    monkeypatch.setattr(live_smoke.socket, "socket", lambda *args, **kwargs: FakeSocket())
    monkeypatch.setattr(live_smoke.socket, "create_connection", forbidden)
    monkeypatch.setattr(live_smoke.requests.sessions.Session, "request", forbidden)
    monkeypatch.setattr(live_smoke.requests, "Session", FakeSession)
    monkeypatch.setattr(live_smoke.subprocess, "Popen", FakeProcess)
    monkeypatch.setattr(live_smoke.os, "killpg", killpg)
    monkeypatch.setattr(live_smoke.sqlite3, "connect", lambda *args, **kwargs: FakeDatabase())
    monkeypatch.setattr(live_smoke, "api", fake_api)
    monkeypatch.setattr(live_smoke, "collect_model_metrics", lambda *args: {})
    monkeypatch.setattr(live_smoke, "collect_metrics", lambda *args: {})
    monkeypatch.setattr(live_smoke, "time", SimpleNamespace(monotonic=monotonic, sleep=lambda *args: None))
    monkeypatch.setattr(live_smoke.shutil, "copytree", copytree)
    return state


def test_preflight_never_creates_run_resources(smoke_lifecycle, monkeypatch, capsys):
    state = smoke_lifecycle
    monkeypatch.setattr(sys, "argv", ["live_smoke", "--source-job", "source-job"])
    assert live_smoke.main() == 0
    assert not (state.root / "tmp/pipeline-benchmarks").exists()
    assert state.source_vault.read_bytes() == state.original_vault
    assert state.calls == []
    assert state.sessions == []
    assert state.processes == []
    assert state.sockets == 0
    assert "Preflight only" in capsys.readouterr().out


@pytest.mark.parametrize("failure", ["copy", "port", "second_port", "startup", "timeout", "submission", "http_error", "process_cleanup", "session_cleanup", None])
def test_live_run_cleans_credentials_without_resubmission(smoke_lifecycle, failure, capsys):
    state = smoke_lifecycle
    state.failure = failure
    try:
        result = live_smoke.main()
    except OSError:
        # Setup failures may propagate, but must never leave a credential copy.
        assert failure in {"copy", "port", "second_port", "process_cleanup", "session_cleanup"}
        result = 1
    outputs = list((state.root / "tmp/pipeline-benchmarks").glob("rust-live-*"))
    assert len(outputs) == 1
    output = outputs[0]
    assert not (output / "data/secrets/credentials.json").exists()
    assert state.source_vault.read_bytes() == state.original_vault
    assert result == (0 if failure is None else 1)
    submissions = [call for call in state.calls if call == ("POST", "/api/v1/jobs")]
    assert len(submissions) == (0 if failure in {"copy", "port", "second_port", "startup"} else 1)
    cancellations = [call for call in state.calls if call[0] == "POST" and call[1].endswith("/cancel")]
    assert len(cancellations) == len(submissions)
    assert all(session.closed for session in state.sessions)
    assert all(process.stopped for process in state.processes) == (failure != "process_cleanup")
    assert state.secret not in capsys.readouterr().out
    report_path = output / "report.json"
    if report_path.exists():
        assert state.secret not in report_path.read_text()
        report = json.loads(report_path.read_text())
        assert report["status"] == ("succeeded" if failure in {None, "process_cleanup", "session_cleanup"} else "error")
        if failure in {"timeout", "submission"}:
            assert report["error_type"] == "TimeoutError"
        if failure == "http_error":
            assert report["local_http_error"] == {"status": 502, "detail": "[redacted] [redacted]"}


def test_live_smoke_records_evidence_before_submission(smoke_lifecycle, monkeypatch):
    original_api = live_smoke.api

    def checked_api(session, base, method, path, **kwargs):
        if method == "POST" and path == "/api/v1/jobs":
            reports = list((smoke_lifecycle.root / "tmp/pipeline-benchmarks").glob("*/report.json"))
            evidence = json.loads(reports[0].read_text())["comparison_evidence"]
            assert evidence["schema"] == "translation_benchmark_evidence_v1"
            assert evidence["normalized_document_sha256"] == hashlib.sha256(b"{}").hexdigest()
            assert all(len(value) == 64 for key, value in evidence.items() if key.endswith("sha256"))
        return original_api(session, base, method, path, **kwargs)

    monkeypatch.setattr(live_smoke, "api", checked_api)
    assert live_smoke.main() == 0
