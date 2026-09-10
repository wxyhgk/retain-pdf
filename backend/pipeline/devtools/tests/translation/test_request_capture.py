from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from retainpdf_pipeline.translate.llm.shared import request_capture as capture
from retainpdf_pipeline.translate.llm.shared import executor_context as executor

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "tests/performance/pipeline"))
from inspect_capture import inspect


@pytest.fixture
def root(tmp_path, monkeypatch):
    root = tmp_path.resolve() / "private-inputs"
    monkeypatch.setenv(capture.ENV, str(root))
    return root


def request(identity="u.primary", text="source with runtime terminology"):
    capture.capture_request(operation_id=identity, unit_id="u", purpose="primary",
                            messages=[{"role": "user", "content": text}], temperature=0.2,
                            response_format=None)


def test_disabled_does_not_touch_files(monkeypatch):
    monkeypatch.delenv(capture.ENV, raising=False)
    monkeypatch.setattr(capture, "persist", Mock(side_effect=AssertionError("unexpected write")))
    request()


def test_dispatch_identity_ignores_prompt_version_but_not_members():
    value = {"batches": [[{"item_id": "a"}]], "engine_identity": {"prompt_hash": "old"}}
    identity = capture.plan_input_digest(value)
    value["engine_identity"]["prompt_hash"] = "new"
    assert capture.plan_input_digest(value) == identity
    value["batches"][0][0]["item_id"] = "b"
    assert capture.plan_input_digest(value) != identity


def test_private_plan_request_roundtrip_and_credential_allowlist(root, monkeypatch):
    monkeypatch.setenv("RETAIN_MODEL_CAPABILITY", "secret-capability")
    capture.capture_plan([[{"item_id": "a", "source_text": "source", "api_key": "secret-key"}]],
                         workers=8, mode="fast", model="model", domain_guidance="domain",
                         context=SimpleNamespace(api_key="secret-context"))
    request()
    result = inspect(root)
    assert result["plans"] == result["requests"] == 1
    assert result["requests_without_plan"] == 0
    assert root.stat().st_mode & 0o777 == 0o700
    for path in root.glob("*.json"):
        assert path.stat().st_mode & 0o777 == 0o600
        assert "secret-" not in path.read_text()
    payload = json.loads(next(root.glob("request-*.json")).read_text())["payload"]
    assert payload["messages"] == [{"role": "user", "content": "source with runtime terminology"}]


def test_concurrent_writes_idempotence_and_conflict(root):
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda i: request(str(i) + ".primary"), range(20)))
    request("0.primary")
    assert inspect(root)["requests"] == 20
    with pytest.raises(ValueError, match="different content"):
        request("0.primary", "changed")
    assert not list(root.glob(".capture-*"))


def test_integrity_tampering_is_rejected(root):
    request()
    path = next(root.glob("request-*.json"))
    value = json.loads(path.read_text())
    value["payload"]["temperature"] = 1
    path.write_text(json.dumps(value))
    with pytest.raises(ValueError, match="integrity"):
        inspect(root)


def test_symlink_and_non_private_directory_rejected(root, monkeypatch):
    target = root.parent / "target"
    target.mkdir(mode=0o700)
    root.symlink_to(target, target_is_directory=True)
    with pytest.raises(ValueError, match="symlinks"):
        request()
    monkeypatch.setenv(capture.ENV, str(target))
    target.chmod(0o755)
    with pytest.raises(ValueError, match="private"):
        request()


def test_capture_failure_stops_before_client_submission(root, monkeypatch):
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "rust")
    client = Mock()
    runtime = executor.ExecutorRuntime(client)
    monkeypatch.setattr(executor, "_runtime", runtime)
    monkeypatch.setattr(capture, "persist", Mock(side_effect=OSError("private disk details")))
    with executor.unit_scope("translation", ["a"], members=["a"]):
        with pytest.raises(executor.ExecutorError, match="capture failed") as error:
            runtime.request([{"role": "user", "content": "source"}])
    assert "private disk details" not in str(error.value)
    client.request.assert_not_called()
    assert runtime.failure is not None
