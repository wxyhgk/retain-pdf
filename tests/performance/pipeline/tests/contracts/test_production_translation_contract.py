"""Production entry contracts run independently of parent-process imports."""
import json
import hashlib
import os
from pathlib import Path
import subprocess
import sys

import pytest

from support.paths import HERE, PIPELINE
from support.offline import child_environment
PROBE = HERE / "support/production_translation_probe.py"


def probe_environment(transport, root):
    # No parent provider keys, proxies, capture paths or executor capabilities.
    # Retain only OS/runtime essentials needed to start the isolated interpreter.
    env = child_environment(root)
    env.update(RETAIN_TRANSLATION_TRANSPORT=transport)
    return env


def run_probe(tmp_path, transport, route, outcome="success"):
    result = subprocess.run([sys.executable, str(PROBE), transport, route, outcome, str(tmp_path)],
                            env=probe_environment(transport, tmp_path), capture_output=True,
                            text=True, encoding="utf-8", timeout=20)
    assert result.returncode == 0, result.stderr + result.stdout
    return json.loads(result.stdout.splitlines()[-1])


def test_probe_environment_does_not_inherit_service_configuration(monkeypatch, tmp_path):
    for name in ("RETAIN_TRANSLATION_CAPTURE_DIR", "RETAIN_MODEL_EXECUTOR_URL",
                 "RETAIN_MODEL_CAPABILITY", "OPENAI_API_KEY", "HTTP_PROXY",
                 "HTTPS_PROXY", "ALL_PROXY", "PYTHONSTARTUP", "PYTHONPATH"):
        monkeypatch.setenv(name, "synthetic-parent-value")
    env = probe_environment("rust", tmp_path)
    assert "synthetic-parent-value" not in env.values()
    assert env["PYTHONPATH"] == str(PIPELINE)
    assert env["RETAIN_TRANSLATION_TRANSPORT"] == "rust"


@pytest.mark.parametrize("route", ["single", "batch", "group"])
def test_production_entry_generates_same_messages_across_transports(tmp_path, route):
    legacy = run_probe(tmp_path / "legacy", "legacy", route)
    rust = run_probe(tmp_path / "rust", "rust", route)
    assert legacy["calls"] == rust["calls"] == 1
    assert legacy["messages_hashes"] == rust["messages_hashes"]
    assert legacy["result"] == rust["result"]
    assert legacy["result"] and all(r["translated_text"] for r in legacy["result"].values())
    assert not legacy["failed"] and not rust["failed"]
    assert legacy["thinking"] is False
    assert rust["purposes"] == ["primary"]
    members = {"single": ["a"], "batch": ["a", "b"], "group": ["__cg__:g", "a", "b"]}[route]
    expected = hashlib.sha256(json.dumps(["translation", members], separators=(",", ":")).encode()).hexdigest()
    assert rust["unit_ids"] == [expected]


@pytest.mark.parametrize("route", ["single", "batch", "group"])
@pytest.mark.parametrize("outcome,count", [("protocol", 2), ("semantic", 2), ("transport", 1)])
def test_production_rust_failure_has_bounded_requests(tmp_path, route, outcome, count):
    result = run_probe(tmp_path, "rust", route, outcome)
    # Batched dispatch returns partial results (empty here); single/group
    # propagate the executor error. Both must latch and reject fresh work.
    assert result["failed"] is (route != "batch")
    assert result["error_type"] == (None if route == "batch" else "ExecutorError")
    assert result["runtime_failed"]
    assert result["latch_rejected"]
    assert result["result"] == {}
    assert result["calls"] == count
    assert result["executor_submissions"] == count
    assert result["http_attempts"] == 0
    assert result["purposes"] == (["primary", "repair"] if count == 2 else ["primary"])
    assert len(set(result["unit_ids"])) == 1
    assert result["retry_delays"] == []


def test_production_rust_group_malformed_json_preserves_original_repair_contract(tmp_path):
    # Keep the original malformed JSON case in addition to empty-response cases.
    result = run_probe(tmp_path, "rust", "group", "malformed_json")
    assert result["failed"] and result["runtime_failed"] and result["latch_rejected"]
    assert result["error_type"] == "ExecutorError"
    assert result["executor_submissions"] == result["calls"] == 2
    assert result["http_attempts"] == 0
    assert result["purposes"] == ["primary", "repair"]
    assert len(set(result["unit_ids"])) == 1
    assert result["result"] == {}


@pytest.mark.parametrize("route,outcome,count,status", [
    ("single", "protocol", 3, "kept_origin"),
    ("single", "semantic", 3, "kept_origin"),
    ("batch", "protocol", 1, None),
    ("batch", "semantic", 1, None),
    ("group", "protocol", 6, "failed"),
    ("group", "semantic", 5, "failed"),
])
def test_production_legacy_content_failure_is_not_translation_success(tmp_path, route, outcome, count, status):
    result = run_probe(tmp_path, "legacy", route, outcome)
    # Legacy intentionally owns a different fallback tree from Rust. Pin its
    # actual budget, not an invented primary/repair limit for this transport.
    assert result["calls"] == count
    assert result["http_attempts"] == count
    assert result["executor_submissions"] == 0
    assert not result["failed"]
    assert not result["runtime_failed"]
    assert result["purposes"] == [None] * count
    if status is None:
        assert result["result"] == {}
    else:
        assert set(result["result"]) == {"__cg__:g" if route == "group" else "a"}
        for member in result["result"].values():
            assert member["final_status"] == status
            assert member["translated_text"] == ""
    assert result["retry_delays"] == ([] if route == "batch" else [2])


@pytest.mark.parametrize("route", ["single", "batch", "group"])
def test_production_legacy_transport_failure_stops_after_http_recovery(tmp_path, route):
    result = run_probe(tmp_path, "legacy", route, "transport")
    # Default legacy transport recovery allows four HTTP attempts. No content
    # repair or alternate translation route should add requests afterward.
    assert result["calls"] == 4
    assert result["http_attempts"] == 4
    assert result["executor_submissions"] == 0
    assert result["purposes"] == [None] * 4
    assert result["result"] == {}
    assert not result["failed"]
    assert not result["runtime_failed"]
    assert len(result["retry_delays"]) == 3
    assert all(delay > 0 for delay in result["retry_delays"])
