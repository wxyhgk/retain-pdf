"""翻译 Key 被上游以 401/403 拒绝后，整份翻译立刻停下，不再把每个块都发一遍。

2026-11-09 任务 20261109164419-5e63e8：Key 失效，38 个块发了 67 个请求——批量翻译、尾部重试、
agent 修复、最终补翻各被拒一遍，最后才以「zero translated items」失败。几百页的书就是几千个注定
被拒的请求。现在第一次被拒就在本次运行的诊断对象上记下这组凭据：之后同一组凭据的请求不再发，
批量翻译收完在飞的请求就整份失败，结构化失败归成鉴权失败、不可重试。
"""
from __future__ import annotations

import json

import pytest
import requests

from retainpdf_pipeline.foundation.shared.structured_errors import classify_exception
from retainpdf_translation.artifacts.aggregator import TranslationRunDiagnostics, translation_run_diagnostics_scope
from retainpdf_translation.llm.providers.deepseek import client
from retainpdf_translation.llm.shared import upstream_resilience as resilience
from retainpdf_translation.workflow import book_flow
from retainpdf_translation.workflow.phases import batch_translation

BASE_URL = "https://upstream.example/v1"


def _run() -> TranslationRunDiagnostics:
    return TranslationRunDiagnostics(
        provider_family="other", model="m", base_url=BASE_URL, configured_workers=4,
        configured_batch_size=8, configured_classify_batch_size=12,
    )


def _response(status: int, payload: dict) -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response.reason = "Unauthorized" if status == 401 else "OK"
    response.url = f"{BASE_URL}/chat/completions"
    response._content = json.dumps(payload).encode()
    return response


def _auth_error(status: int = 401) -> requests.HTTPError:
    return requests.HTTPError(
        f"{status} Client Error: Unauthorized for url: {BASE_URL}/chat/completions",
        response=_response(status, {"error": {"code": "invalid_api_key"}}),
    )


class _Session:
    """按 Key 回应：bad-key 回 401，其余回 200。记下每个真发出去的请求。"""

    def __init__(self) -> None:
        self.sent: list[str] = []

    def post(self, url, **kwargs):
        auth = kwargs["headers"].get("Authorization", "")
        self.sent.append(auth)
        if auth == "Bearer bad-key":
            return _response(401, {"error": {"code": "invalid_api_key", "message": "Incorrect API key provided."}})
        return _response(200, {"choices": [{"message": {"content": "ok"}}]})


@pytest.fixture
def session(monkeypatch) -> _Session:
    fake = _Session()
    monkeypatch.setattr(client, "get_session", lambda: fake)
    monkeypatch.setattr(client, "_prewarm_dns", lambda *args, **kwargs: None)
    monkeypatch.setattr(client, "should_use_stream_responses", lambda: False)
    monkeypatch.delenv("RETAIN_TRANSLATION_TRANSPORT", raising=False)
    return fake


def _ask(api_key: str) -> str:
    return client.request_chat_content(
        [{"role": "user", "content": "hello"}], api_key=api_key, model="m", base_url=BASE_URL, max_attempts=2,
    )


def test_rejected_key_is_sent_once_then_skipped_locally(session) -> None:
    run = _run()
    with translation_run_diagnostics_scope(run):
        with pytest.raises(requests.HTTPError) as first:
            _ask("bad-key")
        assert resilience.http_status_of(first.value) == 401
        assert session.sent == ["Bearer bad-key"], "401 不重试"

        with pytest.raises(requests.HTTPError) as second:
            _ask("bad-key")
        assert session.sent == ["Bearer bad-key"], "同一组凭据被拒过，第二次不再发请求"
        assert resilience.http_status_of(second.value) == 401, "跳过时照旧抛 401，各处按鉴权失败处理"
        assert "没有再发请求" in str(second.value)

        # 另一组凭据（例如审校模型自己的 Key）不受影响
        assert _ask("good-key") == "ok"
        assert session.sent[-1] == "Bearer good-key"


def test_rejection_is_scoped_to_one_run(session) -> None:
    with translation_run_diagnostics_scope(_run()):
        with pytest.raises(requests.HTTPError):
            _ask("bad-key")
    with translation_run_diagnostics_scope(_run()):
        with pytest.raises(requests.HTTPError):
            _ask("bad-key")
    assert session.sent == ["Bearer bad-key", "Bearer bad-key"], "新的一次运行（用户换 Key 后重跑）重新发"


def test_without_active_run_nothing_is_latched(session) -> None:
    for _ in range(2):
        with pytest.raises(requests.HTTPError):
            _ask("bad-key")
    assert len(session.sent) == 2


def test_credential_key_ignores_trailing_slash_and_key_whitespace() -> None:
    run = _run()
    run.record_auth_rejection(base_url=BASE_URL + "/", api_key=" bad-key ", error=_auth_error())
    assert run.auth_rejection(base_url=BASE_URL, api_key="bad-key") is not None
    assert run.auth_rejection(base_url=BASE_URL, api_key="other-key") is None
    assert run.auth_rejection(base_url="https://other.example/v1", api_key="bad-key") is None


def _batch_stage_kwargs(run: TranslationRunDiagnostics) -> dict:
    return dict(
        page_payloads={}, translation_paths={}, batch_size=8, workers=4, api_key="bad-key", model="m",
        base_url=BASE_URL, domain_guidance="", mode="sci", translation_context=None, run_diagnostics=run,
    )


def test_batch_stage_does_not_start_when_key_already_rejected(monkeypatch) -> None:
    run = _run()
    run.record_auth_rejection(base_url=BASE_URL, api_key="bad-key", error=_auth_error())
    monkeypatch.setattr(
        batch_translation, "translate_pending_units",
        lambda **_: pytest.fail("Key 已被拒，不该再开批量翻译"),
    )
    with pytest.raises(requests.HTTPError) as caught:
        batch_translation.run_translation_batch_stage(**_batch_stage_kwargs(run))
    assert resilience.http_status_of(caught.value) == 401
    assert str(caught.value).startswith("翻译 API Key 被上游拒绝（HTTP 401）")


def test_batch_stage_fails_after_batches_hit_a_rejection(monkeypatch) -> None:
    run = _run()

    def translate_pending_units(**_):
        run.record_auth_rejection(base_url=BASE_URL, api_key="bad-key", error=_auth_error(403))
        return {"pending_items": 3, "effective_batch_size": 8, "total_batches": 3}

    monkeypatch.setattr(batch_translation, "translate_pending_units", translate_pending_units)
    with pytest.raises(requests.HTTPError) as caught:
        batch_translation.run_translation_batch_stage(**_batch_stage_kwargs(run))
    assert resilience.http_status_of(caught.value) == 403


def test_book_finish_skips_repairs_when_key_rejected(monkeypatch) -> None:
    run = _run()
    run.record_auth_rejection(base_url=BASE_URL, api_key="bad-key", error=_auth_error())
    for name in ("run_garbled_reconstruction_stage", "run_agent_repair_stage", "run_final_untranslated_recovery_stage"):
        monkeypatch.setattr(book_flow, name, lambda **_: pytest.fail("Key 已被拒，修复和补翻不该再跑"))
    with pytest.raises(requests.HTTPError):
        book_flow.finish_book_translation(
            page_payloads={}, translation_paths={}, api_key="bad-key", model="m", base_url=BASE_URL,
            workers=4, translation_context=None, run_diagnostics=run, checkpoint=None,
        )


def test_stop_error_classifies_as_auth_failure_not_retryable() -> None:
    try:
        raise resilience.credential_rejected_error(_auth_error())
    except requests.HTTPError as exc:
        failure = json.loads(classify_exception(exc, default_stage="translation", provider="translation").to_json())
    assert failure["failure_code"] == "auth_failed"
    assert failure["retryable"] is False
    assert failure["raw_excerpt"].startswith("翻译 API Key 被上游拒绝（HTTP 401）")
