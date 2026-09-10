"""Upstream resilience regressions: review retry (timeout/429), 402 fast-fail, json_extractor hint."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
import requests


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.core.ocr import json_extractor as _json_extractor
from retainpdf_pipeline.translate.llm.providers.deepseek import transport as _transport
from retainpdf_pipeline.translate.services.continuation import review as _review


def _http_error(status: int, *, retry_after: str = "") -> requests.HTTPError:
    response = requests.Response()
    response.status_code = status
    response.reason = "Error"
    response.url = "https://example.com/v1/chat/completions"
    response._content = b'{"error": "upstream"}'
    if retry_after:
        response.headers["Retry-After"] = retry_after
    return requests.HTTPError(f"{status} Client Error", response=response)


def test_review_retries_timeout_then_succeeds() -> None:
    calls = {"n": 0}
    sleeps: list[float] = []

    def _flaky(*_args, **_kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise requests.Timeout("dashscope 120s timeout")
        return '{"decisions": []}'

    out = _review.review_candidate_pairs(
        [{"pair_id": "pair-001-001", "prev_item_id": "a", "next_item_id": "b"}],
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        request_label="test-review",
        request_chat_content_fn=_flaky,
        sleep_fn=sleeps.append,
    )

    assert out == {}
    assert calls["n"] == 2
    assert len(sleeps) == 1


def test_review_retries_429_then_succeeds() -> None:
    calls = {"n": 0}
    sleeps: list[float] = []

    def _flaky(*_args, **_kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise _http_error(429, retry_after="1")
        return '{"decisions": []}'

    out = _review.review_candidate_pairs(
        [{"pair_id": "pair-001-001", "prev_item_id": "a", "next_item_id": "b"}],
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        request_label="test-review",
        request_chat_content_fn=_flaky,
        sleep_fn=sleeps.append,
    )

    assert out == {}
    assert calls["n"] == 2
    assert sleeps == [1.0]


def test_review_402_fails_fast_without_retry() -> None:
    calls = {"n": 0}

    def _quota(*_args, **_kwargs):
        calls["n"] += 1
        raise _http_error(402)

    with pytest.raises(requests.HTTPError, match="402.*余额不足|充值"):
        _review.review_candidate_pairs(
            [{"pair_id": "pair-001-001", "prev_item_id": "a", "next_item_id": "b"}],
            api_key="sk-test",
            model="demo-model",
            base_url="https://example.com/v1",
            request_label="test-review",
            request_chat_content_fn=_quota,
            sleep_fn=lambda _s: None,
        )

    assert calls["n"] == 1


def test_transport_classifies_402_as_non_retryable_and_429_as_retryable() -> None:
    assert _transport.is_transport_error(_http_error(429)) is True
    assert _transport.is_transport_error(requests.Timeout("timed out")) is True
    assert _transport.is_transport_error(requests.ConnectionError("connection reset")) is True
    assert _transport.is_transport_error(_http_error(402)) is False
    assert _transport.is_transport_error(_http_error(401)) is False
    assert _transport.is_transport_error(_http_error(403)) is False
    assert _transport.is_transport_error(_http_error(400)) is False


def test_json_extractor_rejects_raw_with_normalize_hint(tmp_path: Path) -> None:
    raw_path = tmp_path / "raw.json"
    raw_path.write_text('{"provider": "x", "pages": []}', encoding="utf-8")

    with pytest.raises(RuntimeError, match="document\\.v1.*normalize"):
        _json_extractor.load_ocr_json(raw_path)

    with pytest.raises(RuntimeError, match="document\\.v1.*normalize"):
        _json_extractor.get_pages({"provider": "x", "pages": []})


def test_review_unparseable_response_degrades_to_rule_decisions(capsys) -> None:
    def _garbage(*_args, **_kwargs):
        return "当然可以，这是我的分析结果……（一段散文，没有 JSON）"

    out = _review.review_candidate_pairs(
        [{"prev_id": "a", "next_id": "b"}],
        api_key="k",
        model="m",
        base_url="u",
        sleep_fn=lambda _s: None,
        request_chat_content_fn=_garbage,
    )
    assert out == {}
    assert "unparseable" in capsys.readouterr().out
