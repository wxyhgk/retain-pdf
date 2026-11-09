"""整份文档一块都没译成时，失败要报出真正原因，而不是「未识别根因、可重试」。

2026-11-09 一个任务的翻译 Key 失效：每个请求都是 401 InvalidApiKey，块一个个进了
死信，最后 checkpoint 以「zero translated items」收尾。结构化失败只看得到这句话，
归成 python_unhandled_exception、可重试——用户照着重试只会再失败一次。

401 的原文其实就在每个块的诊断里。收尾时把最常见的那条带进报错，分类器就能认出
鉴权失败、不可重试，并提示去检查 API Key。
"""
from __future__ import annotations

import json

import pytest

from retainpdf_pipeline.foundation.shared.structured_errors import classify_exception
from retainpdf_translation.workflow.checkpoint import NothingTranslatedError
from retainpdf_translation.workflow.checkpoint.contract import assert_checkpoint_committable
from retainpdf_translation.workflow.execution_runner import dominant_failure_cause

_AUTH = (
    "HTTPError: 401 Client Error: Unauthorized for url: https://example.invalid/v1/responses"
    ' | response_body={"code":"InvalidApiKey","message":"Invalid API-key provided.",'
    '"request_id":"%s"} | request_meta=model=m messages=3 message_chars=%d body_bytes=10 '
    "stream=False response_format=none | 上游返回 401（鉴权失败）：请检查 API Key/权限与 base_url 配置；本次直接失败，不再重试。"
)


def _failed(item_id: str, **diagnostics) -> dict:
    return {
        "item_id": item_id,
        "final_status": "failed",
        "translation_diagnostics": {"final_status": "failed", **diagnostics},
    }


def _pages() -> dict[int, list[dict]]:
    return {
        0: [
            _failed("p001-b001", final_recovery_error=_AUTH % ("r1", 100)),
            # 并进接续组的块没走最终补翻，只有 agent 修复那一步的错误
            _failed("p001-b005", agent_repair_error=_AUTH % ("r2", 535)),
            {"item_id": "p001-b009", "final_status": "", "translated_text": ""},
        ],
        1: [
            _failed(
                "p002-b001",
                error_trace=[{"type": "protocol", "code": "ReadTimeout", "message": "timed out"}],
            ),
        ],
    }


def test_dominant_cause_ignores_per_request_noise_and_counts_failed_items() -> None:
    cause = dominant_failure_cause(_pages())
    assert "401 Client Error: Unauthorized" in cause
    assert "request_id" not in cause and "message_chars" not in cause
    assert cause.endswith("(2/3 failed items)"), "两条 401 只差 request_id 和请求长度，应算成一种"


def test_no_failed_items_means_no_cause() -> None:
    assert dominant_failure_cause({0: [{"item_id": "a", "final_status": "translated"}]}) == ""


def test_zero_translated_with_auth_cause_classifies_as_auth_failure() -> None:
    progress = {"pending_item_count": 3, "blocking_item_count": 0, "translated_item_count": 0}
    try:
        try:
            assert_checkpoint_committable({"phase": "validating", "progress": progress})
        except NothingTranslatedError as exc:
            raise NothingTranslatedError(
                f"{exc}; most common upstream error: {dominant_failure_cause(_pages())}"
            ) from exc
    except NothingTranslatedError as exc:
        failure = json.loads(
            classify_exception(exc, default_stage="translation", provider="translation").to_json()
        )
    else:  # pragma: no cover
        pytest.fail("zero translated items must not commit")

    assert failure["failure_code"] == "auth_failed"
    assert failure["retryable"] is False
    assert "zero translated items" in failure["detail"]
