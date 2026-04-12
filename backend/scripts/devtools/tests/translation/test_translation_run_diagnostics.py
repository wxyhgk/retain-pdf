import importlib.util
import copy
import sys
import threading
import time
import types
import unittest
from pathlib import Path
from unittest.mock import patch

import requests


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from foundation.shared.structured_errors import classify_exception
from services.translation.diagnostics import TranslationRunDiagnostics
from services.translation.diagnostics import classify_provider_family
from services.translation.diagnostics import infer_stage_from_request_label
from services.translation.diagnostics import translation_run_diagnostics_scope


def load_deepseek_client():
    package_paths = {
        "services": REPO_SCRIPTS_ROOT / "services",
        "services.translation": REPO_SCRIPTS_ROOT / "services" / "translation",
        "services.translation.llm": REPO_SCRIPTS_ROOT / "services" / "translation" / "llm",
        "services.translation.policy": REPO_SCRIPTS_ROOT / "services" / "translation" / "policy",
        "services.document_schema": REPO_SCRIPTS_ROOT / "services" / "document_schema",
    }
    for name, path in package_paths.items():
        module = sys.modules.get(name)
        if module is None:
            module = types.ModuleType(name)
            module.__path__ = [str(path)]
            sys.modules[name] = module
    spec = importlib.util.spec_from_file_location(
        "services.translation.llm.deepseek_client",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "deepseek_client.py",
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _SchemaRejectingResponse:
    status_code = 400
    url = "https://example.com/v1/chat/completions"
    reason = "Bad Request"
    text = '{"error":"json_schema unsupported"}'

    def raise_for_status(self):
        raise requests.HTTPError("400 Client Error: Bad Request", response=self)

    def json(self):
        return {}


class _RetryingSession:
    def __init__(self):
        self.calls = 0

    def post(self, *args, **kwargs):
        self.calls += 1
        if self.calls == 1:
            raise requests.ReadTimeout("read timed out")
        return _FakeResponse({"choices": [{"message": {"content": "ok"}}]})


class _SchemaFallbackSession:
    def __init__(self):
        self.calls = []

    def post(self, *args, **kwargs):
        self.calls.append(copy.deepcopy(kwargs.get("json", {})))
        response_format = kwargs.get("json", {}).get("response_format")
        if isinstance(response_format, dict) and response_format.get("type") == "json_schema":
            return _SchemaRejectingResponse()
        return _FakeResponse({"choices": [{"message": {"content": '{"ok": true}'}}]})


class _AlwaysBadRequestResponse:
    status_code = 400
    url = "https://example.com/v1/chat/completions"
    reason = "Bad Request"

    def __init__(self, text: str):
        self.text = text


class _AlwaysBadRequestSession:
    def __init__(self, text: str):
        self.text = text

    def post(self, *args, **kwargs):
        return _AlwaysBadRequestResponse(self.text)


class _StatusResponse:
    def __init__(self, status_code: int):
        self.status_code = status_code


class TranslationRunDiagnosticsTests(unittest.TestCase):
    def test_classifier_helpers(self):
        self.assertEqual(
            classify_provider_family(base_url="https://api.deepseek.com/v1", model="deepseek-chat"),
            "deepseek_official",
        )
        self.assertEqual(
            classify_provider_family(base_url="https://example.com/v1", model="deepseek-r1"),
            "deepseek_compatible",
        )
        self.assertEqual(
            classify_provider_family(base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", model="qwen"),
            "other",
        )
        self.assertEqual(infer_stage_from_request_label("book: batch 1/10"), "translation")
        self.assertEqual(infer_stage_from_request_label("classification page 2"), "classification")
        self.assertEqual(infer_stage_from_request_label("mixed-split item-1"), "mixed_literal_split")

    def test_summary_aggregates_counts_and_peaks(self):
        run = TranslationRunDiagnostics(
            provider_family="deepseek_official",
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            configured_workers=100,
            configured_batch_size=1,
            configured_classify_batch_size=12,
        )
        run.set_effective_settings(
            translation_workers=100,
            policy_workers=100,
            continuation_workers=8,
            mixed_split_workers=4,
            translation_batch_size=1,
        )
        run.set_workload(pending_items=66, total_batches=66)
        run.mark_phase_start("translation_batches")
        time.sleep(0.002)
        run.mark_phase_end("translation_batches")

        started: list[int] = []

        def _worker():
            request_id = run.record_request_start(
                stage="translation",
                request_label="book: batch 1/2 item 1/2",
                timeout_s=120,
                attempt=1,
            )
            started.append(request_id)
            time.sleep(0.01)
            run.record_request_end(request_id, success=True, elapsed_ms=25)

        t1 = threading.Thread(target=_worker)
        t2 = threading.Thread(target=_worker)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        retry_request_id = run.record_request_start(
            stage="translation",
            request_label="book: batch 1/2 item 2/2 req#1",
            timeout_s=120,
            attempt=2,
        )
        run.record_request_end(
            retry_request_id,
            success=False,
            elapsed_ms=120000,
            error_class="ReadTimeout",
        )

        summary = run.build_summary()
        self.assertEqual(summary["request_counts"]["total_http_attempts"], 3)
        self.assertEqual(summary["request_counts"]["succeeded_attempts"], 2)
        self.assertEqual(summary["request_counts"]["timeout_attempts"], 1)
        self.assertEqual(summary["request_counts"]["retried_attempts"], 1)
        self.assertGreaterEqual(summary["concurrency_observed"]["peak_inflight_translation_requests"], 2)
        self.assertEqual(summary["configured_workers"], 100)
        self.assertEqual(summary["pending_items"], 66)
        self.assertEqual(summary["retry_summary"]["retrying_request_labels"], 1)

    def test_request_chat_content_records_retry_attempts(self):
        deepseek_client = load_deepseek_client()
        run = TranslationRunDiagnostics(
            provider_family="deepseek_official",
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            configured_workers=16,
            configured_batch_size=1,
            configured_classify_batch_size=12,
        )
        session = _RetryingSession()
        with translation_run_diagnostics_scope(run):
            with patch.object(deepseek_client, "get_session", return_value=session):
                with patch.object(deepseek_client, "_drop_session", return_value=None):
                    with patch.object(deepseek_client.time, "sleep", return_value=None):
                        content = deepseek_client.request_chat_content(
                            [{"role": "user", "content": "hello"}],
                            api_key="token",
                            model="deepseek-chat",
                            base_url="https://api.deepseek.com/v1",
                            timeout=120,
                            request_label="book: batch 1/1 item 1/1",
                        )
        self.assertEqual(content, "ok")
        summary = run.build_summary()
        self.assertEqual(summary["request_counts"]["total_http_attempts"], 2)
        self.assertEqual(summary["request_counts"]["timeout_attempts"], 1)
        self.assertEqual(summary["request_counts"]["succeeded_attempts"], 1)
        self.assertEqual(summary["retry_summary"]["max_http_attempt"], 2)
        self.assertLess(summary["adaptive_concurrency"]["current_limit"], 16)

    def test_request_chat_content_falls_back_from_json_schema_on_400(self):
        deepseek_client = load_deepseek_client()
        session = _SchemaFallbackSession()
        with patch.object(deepseek_client, "get_session", return_value=session):
            content = deepseek_client.request_chat_content(
                [{"role": "user", "content": "hello"}],
                api_key="token",
                model="demo-model",
                base_url="https://example.com/v1",
                timeout=120,
                request_label="schema-test",
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "demo",
                        "strict": True,
                        "schema": {"type": "object", "additionalProperties": False, "properties": {}, "required": []},
                    },
                },
            )
        self.assertEqual(content, '{"ok": true}')
        self.assertEqual(session.calls[0]["response_format"]["type"], "json_schema")
        self.assertEqual(session.calls[1]["response_format"]["type"], "json_object")

    def test_request_chat_content_preemptively_downgrades_json_schema_for_deepseek_v1(self):
        deepseek_client = load_deepseek_client()
        session = _SchemaFallbackSession()
        with patch.object(deepseek_client, "get_session", return_value=session):
            content = deepseek_client.request_chat_content(
                [{"role": "user", "content": "hello"}],
                api_key="token",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                timeout=120,
                request_label="schema-capability-test",
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "demo",
                        "strict": True,
                        "schema": {"type": "object", "additionalProperties": False, "properties": {}, "required": []},
                    },
                },
            )
        self.assertEqual(content, '{"ok": true}')
        self.assertEqual(len(session.calls), 1)
        self.assertEqual(session.calls[0]["response_format"]["type"], "json_object")

    def test_request_chat_content_includes_response_body_and_request_meta_on_400(self):
        deepseek_client = load_deepseek_client()
        session = _AlwaysBadRequestSession('{"error":{"message":"prompt too long"}}')
        with patch.object(deepseek_client, "get_session", return_value=session):
            with self.assertRaises(requests.HTTPError) as ctx:
                deepseek_client.request_chat_content(
                    [{"role": "user", "content": "hello"}],
                    api_key="token",
                    model="demo-model",
                    base_url="https://example.com/v1",
                    timeout=120,
                    request_label="bad-request-test",
                )
        message = str(ctx.exception)
        self.assertIn("prompt too long", message)
        self.assertIn("request_meta=model=demo-model", message)
        self.assertIn("message_chars=5", message)
        self.assertIn("body_bytes=", message)


class StructuredFailureClassificationTests(unittest.TestCase):
    def test_classify_exception_maps_http_400_to_upstream_bad_request(self):
        try:
            raise requests.HTTPError(
                "400 Client Error: Bad Request for url: http://1.94.67.196:18080/v1/chat/completions",
                response=_StatusResponse(400),
            )
        except requests.HTTPError as exc:
            failure = classify_exception(exc, default_stage="translation", provider="translation")
        self.assertEqual(failure.error_type, "upstream_bad_request")
        self.assertEqual(failure.summary, "上游服务拒绝请求（400）")
        self.assertFalse(failure.retryable)

    def test_classify_exception_keeps_http_401_as_auth_failed(self):
        try:
            raise requests.HTTPError(
                "401 Client Error: Unauthorized for url: https://example.com/v1/chat/completions",
                response=_StatusResponse(401),
            )
        except requests.HTTPError as exc:
            failure = classify_exception(exc, default_stage="translation", provider="translation")
        self.assertEqual(failure.error_type, "auth_failed")
        self.assertEqual(failure.summary, "鉴权失败")
        self.assertFalse(failure.retryable)


if __name__ == "__main__":
    unittest.main()
