from __future__ import annotations

import sys
from pathlib import Path
from unittest import mock

import requests


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.workflow.batching.pending_units import _translate_batch_or_keep_origin
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context


def _item(item_id: str, text: str, **overrides):
    item = {
        "item_id": item_id,
        "block_type": "text",
        "source_text": text,
        "protected_source_text": text,
        "should_translate": True,
    }
    item.update(overrides)
    return item


def test_translate_batch_wrapper_marks_transport_failure_failed() -> None:
    context = build_translation_control_context()
    batch = [
        _item("a", "This sentence describes antibacterial activity and provides enough body text for translation."),
        _item("b", "This paragraph keeps enough content for translation even when the network request times out."),
    ]
    with mock.patch(
        "retainpdf_pipeline.translate.workflow.batching.pending_units.translate_batch",
        side_effect=requests.ConnectionError("Read timed out"),
    ):
        result = _translate_batch_or_keep_origin(
            batch,
            api_key="sk-test",
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            request_label="book: batch 1/1",
            domain_guidance="",
            mode="fast",
            context=context,
        )

    assert result["a"]["decision"] == "translate"
    assert result["b"]["decision"] == "translate"
    assert result["a"]["translated_text"] == ""
    assert result["b"]["translated_text"] == ""
    assert result["a"]["final_status"] == "failed"
    assert result["b"]["final_status"] == "failed"
    assert result["a"]["translation_diagnostics"]["degradation_reason"] == "batch_transport_timeout_budget_exceeded"
    assert result["a"]["translation_diagnostics"]["fallback_to"] == "retry_required"
    assert result["a"]["translation_diagnostics"]["route_path"] == ["block_level", "batched_plain", "failed"]
