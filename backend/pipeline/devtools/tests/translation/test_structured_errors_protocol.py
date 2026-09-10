import json
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.foundation.shared.structured_errors import classify_exception
from retainpdf_pipeline.foundation.shared.structured_errors import infer_failure_stage


def test_classify_exception_emits_new_and_legacy_failure_fields():
    try:
        raise RuntimeError("token expired while calling provider")
    except RuntimeError as exc:
        failure = classify_exception(exc, default_stage="translation", provider="translation")

    payload = json.loads(failure.to_json())
    assert payload["failed_stage"] == "translation"
    assert payload["stage"] == "translation"
    assert payload["failure_code"] == "auth_failed"
    assert payload["error_type"] == "auth_failed"
    assert payload["failure_category"] == "auth"
    assert payload["provider_stage"] == ""
    assert payload["provider_code"] == ""
    assert payload["retryable"] is False
    assert payload["suggestion"]
    assert payload["raw_excerpt"] == "token expired while calling provider"
    assert payload["detail"] == "token expired while calling provider"


def test_classify_exception_extracts_provider_code_and_provider_category():
    try:
        raise RuntimeError("MinerU API error code=A0211: token expired during mineru_processing")
    except RuntimeError as exc:
        failure = classify_exception(exc, default_stage="provider", provider="mineru")

    payload = json.loads(failure.to_json())
    assert payload["failed_stage"] == "provider"
    assert payload["failure_code"] == "auth_failed"
    assert payload["failure_category"] == "auth"
    assert payload["provider_stage"] == "mineru_processing"
    assert payload["provider_code"] == "A0211"
    assert payload["provider"] == "mineru"
    assert payload["summary"] == "鉴权失败"
    assert "凭据" in payload["suggestion"] or "token" in payload["suggestion"].lower()


def test_direct_typst_protocol_shell_is_classified_as_translation_not_render():
    trace = (
        'File "/Applications/RetainPDF.app/Contents/Resources/backend/pipeline/'
        'translate/llm/shared/orchestration/direct_typst.py", line 399\n'
        "retainpdf_pipeline.translate.llm.placeholder_guard.TranslationProtocolError: "
        "p007-b004: translated output still contains protocol/json shell"
    )

    assert infer_failure_stage(
        default_stage="render",
        trace_text=trace,
        detail="p007-b004: translated output still contains protocol/json shell",
    ) == "translation"

    try:
        raise RuntimeError("p007-b004: translated output still contains protocol/json shell")
    except RuntimeError as exc:
        failure = classify_exception(exc, default_stage="render", provider="translation")

    payload = json.loads(failure.to_json())
    assert payload["failed_stage"] == "translation"
    assert payload["failure_category"] == "translation"
    assert payload["failure_code"] == "translation_protocol_shell"


def test_rate_limit_errors_are_classified_as_retryable_rate_limit():
    try:
        raise RuntimeError("Paddle OCR rate limited after 3 attempts: too many requests retry-after=60")
    except RuntimeError as exc:
        failure = classify_exception(exc, default_stage="provider", provider="paddle")

    payload = json.loads(failure.to_json())
    assert payload["failed_stage"] == "provider"
    assert payload["failure_code"] == "upstream_rate_limited"
    assert payload["failure_category"] == "rate_limit"
    assert payload["retryable"] is True
    assert "限流" in payload["summary"]
