import importlib
import copy
import json
import sys
import threading
import time
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.foundation.shared.structured_errors import classify_exception
from retainpdf_pipeline.translate.artifacts import TranslationRunDiagnostics
from retainpdf_pipeline.translate.artifacts import TranslationRequestJournal
from retainpdf_pipeline.translate.artifacts import classify_provider_family
from retainpdf_pipeline.translate.artifacts import infer_stage_from_request_label
from retainpdf_pipeline.translate.artifacts import translation_run_diagnostics_scope


def load_deepseek_client():
    return importlib.import_module("retainpdf_pipeline.translate.llm.providers.deepseek.client")


def _without_retry_wait(client):
    # Replace only this module's clock binding, never the shared time module.
    return patch.object(client, "time", types.SimpleNamespace(perf_counter=time.perf_counter, sleep=Mock()))


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakeSession:
    def post(self, *args, **kwargs):
        return _FakeResponse({"choices": [{"message": {"content": "ok"}}]})


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


class _DnsRetryingSession:
    def __init__(self):
        self.calls = 0

    def post(self, *args, **kwargs):
        self.calls += 1
        if self.calls <= 2:
            raise requests.ConnectionError(
                "HTTPSConnectionPool(host='api.deepseek.com', port=443): Max retries exceeded with url: /v1/chat/completions "
                "(Caused by NameResolutionError(\"<urllib3.connection.HTTPSConnection object at 0x0>: Failed to resolve "
                "'api.deepseek.com' ([Errno -3] Temporary failure in name resolution)\"))"
            )
        return _FakeResponse({"choices": [{"message": {"content": "ok"}}]})


class _TransportRecoverySession:
    def __init__(self):
        self.calls = 0

    def post(self, *args, **kwargs):
        self.calls += 1
        if self.calls < 3:
            raise requests.ConnectionError("network temporarily unavailable")
        return _FakeResponse({"choices": [{"message": {"content": "recovered"}}]})


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
        self.assertEqual(infer_stage_from_request_label("book: batched_fast batch 1/10"), "translation")
        self.assertEqual(infer_stage_from_request_label("book: single_fast batch 1/10"), "translation")
        self.assertEqual(infer_stage_from_request_label("book: single_slow batch 1/10"), "translation")
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
        run.set_translation_queue_workers(
            batched_fast_workers=20,
            single_fast_workers=70,
            single_slow_workers=10,
            slow_worker_limit=10,
            batched_fast_batches=8,
            single_fast_batches=50,
            single_slow_batches=8,
        )
        run.set_translation_result_stats(
            applied_batches=66,
            apply_elapsed_ms=1234,
            max_result_drain_batch=32,
            flush_count=4,
            flushed_page_total=18,
            flush_elapsed_ms=456,
            max_flush_pages=7,
            tail_retry_drains=2,
            tail_retry_items=5,
            tail_retry_completed=4,
            tail_retry_failed=1,
            tail_retry_elapsed_ms=789,
            early_tail_retry_drains=1,
            final_tail_retry_drains=1,
        )
        run.mark_phase_start("translation_batches")
        time.sleep(0.002)
        run.mark_phase_end("translation_batches")

        started: list[int] = []
        both_active = threading.Barrier(2, timeout=5)

        def _worker():
            request_id = run.record_request_start(
                stage="translation",
                request_label="book: batch 1/2 item 1/2",
                timeout_s=120,
                attempt=1,
            )
            started.append(request_id)
            both_active.wait()
            run.record_request_end(request_id, success=True, elapsed_ms=25)

        t1 = threading.Thread(target=_worker)
        t2 = threading.Thread(target=_worker)
        t1.start()
        t2.start()
        t1.join(timeout=6)
        t2.join(timeout=6)
        self.assertFalse(t1.is_alive())
        self.assertFalse(t2.is_alive())

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
        self.assertEqual(summary["result_apply"]["apply_elapsed_ms"], 1234)
        self.assertEqual(summary["result_apply"]["max_result_drain_batch"], 32)
        self.assertEqual(summary["translation_queue_split"]["batched_fast_batches"], 8)
        self.assertEqual(summary["translation_queue_split"]["fast_queue_batches"], 58)
        self.assertEqual(summary["translation_queue_split"]["single_slow_workers"], 10)
        self.assertEqual(summary["result_flush"]["flush_elapsed_ms"], 456)
        self.assertEqual(summary["result_flush"]["max_flush_pages"], 7)
        self.assertEqual(summary["tail_retry"]["tail_retry_items"], 5)
        self.assertEqual(summary["tail_retry"]["tail_retry_failed"], 1)
        self.assertEqual(summary["tail_retry"]["early_tail_retry_drains"], 1)
        self.assertEqual(summary["retry_summary"]["retrying_request_labels"], 1)

    @patch("retainpdf_pipeline.translate.llm.providers.deepseek.client._prewarm_dns", new=lambda *args, **kwargs: None)
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
                    with _without_retry_wait(deepseek_client):
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
        self.assertEqual(summary["adaptive_concurrency"]["current_limit"], 16)

    @patch("retainpdf_pipeline.translate.llm.providers.deepseek.client._prewarm_dns", new=lambda *args, **kwargs: None)
    def test_request_chat_content_persists_dispatch_and_terminal_without_secrets(self):
        deepseek_client = load_deepseek_client()
        with tempfile.TemporaryDirectory() as temp_dir:
            journal_path = Path(temp_dir) / "translation-request-journal.v1.jsonl"
            journal = TranslationRequestJournal(journal_path, attempt_id="attempt-a")
            run = TranslationRunDiagnostics(
                provider_family="deepseek_official",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                configured_workers=1,
                configured_batch_size=1,
                configured_classify_batch_size=1,
                request_journal=journal,
            )
            with translation_run_diagnostics_scope(run):
                with patch.object(deepseek_client, "get_session", return_value=_FakeSession()):
                    content = deepseek_client.request_chat_content(
                        [{"role": "user", "content": "raw secret prompt"}],
                        api_key="sk-sensitive-api-key",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="safe-label",
                        max_attempts=1,
                    )
            journal.close()
            persisted = journal_path.read_text()
            events = [json.loads(line) for line in persisted.splitlines()]
            self.assertEqual(content, "ok")
            self.assertEqual([event["event"] for event in events], ["dispatch", "terminal"])
            self.assertEqual(events[-1]["outcome"], "succeeded")
            self.assertNotIn("raw secret prompt", persisted)
            self.assertNotIn("sk-sensitive-api-key", persisted)
            self.assertNotIn("safe-label", persisted)

    @patch("retainpdf_pipeline.translate.llm.providers.deepseek.client._prewarm_dns", new=lambda *args, **kwargs: None)
    def test_request_chat_content_uses_bounded_transport_recovery_budget(self):
        deepseek_client = load_deepseek_client()
        session = _TransportRecoverySession()
        recovery_env = {
            "RETAIN_TRANSLATION_TRANSPORT_RECOVERY_ATTEMPTS": "3",
            "RETAIN_TRANSLATION_TRANSPORT_RECOVERY_SECONDS": "60",
        }
        with patch.dict(deepseek_client.os.environ, recovery_env, clear=False):
            with patch.object(deepseek_client, "get_session", return_value=session):
                with patch.object(deepseek_client, "_drop_session", return_value=None):
                    with _without_retry_wait(deepseek_client):
                        content = deepseek_client.request_chat_content(
                            [{"role": "user", "content": "hello"}],
                            api_key="token",
                            model="deepseek-chat",
                            base_url="https://api.deepseek.com/v1",
                            timeout=120,
                            request_label="transport-recovery-test",
                            max_attempts=1,
                        )
        self.assertEqual(content, "recovered")
        self.assertEqual(session.calls, 3)

    @patch("retainpdf_pipeline.translate.llm.providers.deepseek.client._prewarm_dns", new=lambda *args, **kwargs: None)
    def test_transport_recovery_budget_can_be_disabled(self):
        deepseek_client = load_deepseek_client()
        session = _TransportRecoverySession()
        recovery_env = {
            "RETAIN_TRANSLATION_TRANSPORT_RECOVERY_ATTEMPTS": "4",
            "RETAIN_TRANSLATION_TRANSPORT_RECOVERY_SECONDS": "0",
        }
        with patch.dict(deepseek_client.os.environ, recovery_env, clear=False):
            with patch.object(deepseek_client, "get_session", return_value=session):
                with self.assertRaises(requests.ConnectionError):
                    deepseek_client.request_chat_content(
                        [{"role": "user", "content": "hello"}],
                        api_key="token",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        timeout=120,
                        request_label="transport-recovery-disabled-test",
                        max_attempts=1,
                    )
        self.assertEqual(session.calls, 1)

    def test_deepseek_session_pool_uses_small_per_thread_pool(self):
        deepseek_client = load_deepseek_client()
        run = TranslationRunDiagnostics(
            provider_family="deepseek_official",
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            configured_workers=1000,
            configured_batch_size=1,
            configured_classify_batch_size=12,
        )
        with translation_run_diagnostics_scope(run):
            with patch.dict(deepseek_client.os.environ, {}, clear=False):
                session = deepseek_client._build_session()
        try:
            summary = run.build_summary()
            self.assertEqual(summary["http_pool_cap"], 1000)
            self.assertEqual(summary["http_pool_size"], 2)
        finally:
            session.close()

    def test_deepseek_session_pool_per_thread_cap_can_be_adjusted_by_env(self):
        deepseek_client = load_deepseek_client()
        run = TranslationRunDiagnostics(
            provider_family="deepseek_official",
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            configured_workers=1000,
            configured_batch_size=1,
            configured_classify_batch_size=12,
        )
        run.configure_adaptive_concurrency(initial_limit=100, floor_limit=8)
        with translation_run_diagnostics_scope(run):
            with patch.dict(
                deepseek_client.os.environ,
                {
                    "RETAIN_TRANSLATION_HTTP_POOL_MAX": "128",
                    "RETAIN_TRANSLATION_HTTP_POOL_PER_THREAD": "4",
                },
                clear=False,
            ):
                session = deepseek_client._build_session()
        try:
            summary = run.build_summary()
            self.assertEqual(summary["http_pool_cap"], 128)
            self.assertEqual(summary["http_pool_size"], 4)
        finally:
            session.close()

    def test_deepseek_dns_prewarm_does_not_block_request_path(self):
        deepseek_client = load_deepseek_client()
        calls = []
        entered = threading.Event()
        release = threading.Event()
        resolvers = []

        def resolver_thread(**kwargs):
            thread = threading.Thread(**kwargs)
            resolvers.append(thread)
            return thread

        def slow_getaddrinfo(*_args, **_kwargs):
            calls.append(1)
            entered.set()
            if not release.wait(5):
                raise OSError("test resolver was not released")
            return []

        transport = deepseek_client.transport
        with (
            patch.object(transport.socket, "getaddrinfo", side_effect=slow_getaddrinfo),
            patch.object(transport, "threading", types.SimpleNamespace(Thread=resolver_thread)),
            patch.object(transport, "_DNS_CACHE", {}),
            patch.object(transport, "_DNS_INFLIGHT", set()),
            patch.dict(transport.os.environ, {"RETAIN_TRANSLATION_DNS_PREWARM_TIMEOUT_MS": "1"}, clear=False),
        ):
            try:
                started = time.perf_counter()
                deepseek_client._prewarm_dns("https://slow-dns.example/v1", request_label="dns-nonblocking-test")
                deepseek_client._prewarm_dns("https://slow-dns.example/v1", request_label="dns-nonblocking-test")
                self.assertLess(time.perf_counter() - started, 0.2)
                self.assertTrue(entered.wait(5))
                self.assertEqual(len(calls), 1)
            finally:
                release.set()
                for resolver in resolvers:
                    resolver.join(timeout=5)
                    self.assertFalse(resolver.is_alive())

    def test_adaptive_concurrency_applies_to_any_provider_family(self):
        run = TranslationRunDiagnostics(
            provider_family="other",
            model="qwen-plus",
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            configured_workers=16,
            configured_batch_size=4,
            configured_classify_batch_size=8,
        )
        run.configure_adaptive_concurrency(initial_limit=16, floor_limit=4)

        run.acquire_request_slot()
        request_id = run.record_request_start(
            stage="translation",
            request_label="book: batch 1/1 item 1/1",
            timeout_s=120,
            attempt=1,
        )
        run.record_request_end(
            request_id,
            success=False,
            elapsed_ms=120000,
            error_class="ReadTimeout",
        )
        run.release_request_slot(
            success=False,
            elapsed_ms=120000,
            error_class="ReadTimeout",
        )

        summary = run.build_summary()
        self.assertTrue(summary["adaptive_concurrency"]["enabled"])
        self.assertEqual(summary["adaptive_concurrency"]["configured_limit"], 16)
        self.assertEqual(summary["adaptive_concurrency"]["initial_limit"], 16)
        self.assertEqual(summary["adaptive_concurrency"]["floor_limit"], 4)
        self.assertLess(summary["adaptive_concurrency"]["current_limit"], 16)

    def test_adaptive_concurrency_downshifts_on_slow_successes(self):
        run = TranslationRunDiagnostics(
            provider_family="other",
            model="qwen-plus",
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            configured_workers=1000,
            configured_batch_size=1,
            configured_classify_batch_size=12,
        )
        run.configure_adaptive_concurrency(initial_limit=32, floor_limit=8)

        run.release_request_slot(success=True, elapsed_ms=90000)
        summary = run.build_summary()
        self.assertEqual(summary["adaptive_concurrency"]["current_limit"], 16)

        run.release_request_slot(success=True, elapsed_ms=60000)
        summary = run.build_summary()
        self.assertEqual(summary["adaptive_concurrency"]["current_limit"], 12)

    def test_adaptive_concurrency_downshifts_after_repeated_moderately_slow_successes(self):
        run = TranslationRunDiagnostics(
            provider_family="other",
            model="qwen-plus",
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            configured_workers=1000,
            configured_batch_size=1,
            configured_classify_batch_size=12,
        )
        run.configure_adaptive_concurrency(initial_limit=32, floor_limit=8)

        run.release_request_slot(success=True, elapsed_ms=45000)
        self.assertEqual(run.build_summary()["adaptive_concurrency"]["current_limit"], 32)
        run.release_request_slot(success=True, elapsed_ms=45000)
        self.assertEqual(run.build_summary()["adaptive_concurrency"]["current_limit"], 27)

    def test_deepseek_official_keeps_limit_on_slow_success_and_timeout(self):
        run = TranslationRunDiagnostics(
            provider_family="deepseek_official",
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            configured_workers=100,
            configured_batch_size=1,
            configured_classify_batch_size=12,
        )
        run.configure_adaptive_concurrency(initial_limit=100, floor_limit=8)

        run.release_request_slot(success=True, elapsed_ms=90000)
        run.release_request_slot(success=False, elapsed_ms=55000, error_class="ReadTimeout")

        self.assertEqual(run.build_summary()["adaptive_concurrency"]["current_limit"], 100)

    def test_request_chat_content_retries_dns_failures_even_when_max_attempts_is_one(self):
        deepseek_client = load_deepseek_client()
        session = _DnsRetryingSession()
        with patch.object(deepseek_client, "get_session", return_value=session):
            with patch.object(deepseek_client, "_drop_session", return_value=None):
                with _without_retry_wait(deepseek_client):
                    with patch.object(deepseek_client, "_prewarm_dns", return_value=None):
                        content = deepseek_client.request_chat_content(
                            [{"role": "user", "content": "hello"}],
                            api_key="token",
                            model="deepseek-chat",
                            base_url="https://api.deepseek.com/v1",
                            timeout=120,
                            request_label="dns-retry-test",
                            max_attempts=1,
                        )
        self.assertEqual(content, "ok")
        self.assertEqual(session.calls, 3)

    @patch("retainpdf_pipeline.translate.llm.providers.deepseek.client._prewarm_dns", new=lambda *args, **kwargs: None)
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

    @patch("retainpdf_pipeline.translate.llm.providers.deepseek.client._prewarm_dns", new=lambda *args, **kwargs: None)
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

    @patch("retainpdf_pipeline.translate.llm.providers.deepseek.client._prewarm_dns", new=lambda *args, **kwargs: None)
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
