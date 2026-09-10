import sys
import time
from types import SimpleNamespace
from unittest.mock import Mock
from pathlib import Path

import pytest

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.llm.placeholder_guard import TranslationProtocolError
from retainpdf_pipeline.translate.llm.placeholder_guard import canonicalize_batch_result
from retainpdf_pipeline.translate.llm.placeholder_guard import MathDelimiterError
from retainpdf_pipeline.translate.llm.placeholder_guard import result_entry
from retainpdf_pipeline.translate.llm.placeholder_guard import validate_batch_result
from retainpdf_pipeline.translate.llm.validation.errors import EmptyTranslationError
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst import translate_direct_typst_plain_text_with_retries
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_salvage import extract_direct_typst_protocol_text


@pytest.fixture
def retry_sleep(monkeypatch):
    from retainpdf_pipeline.translate.llm.shared.orchestration import direct_typst

    sleep = Mock()
    monkeypatch.setattr(direct_typst, "time", SimpleNamespace(perf_counter=time.perf_counter, sleep=sleep))
    return sleep


def _body_item() -> dict:
    source = (
        "Example 4.2 Example Q-CHEM input for a single point energy calculation on water. "
        "Note that the declaration of the single point rem variable is redundant."
    )
    return {
        "item_id": "p014-b004",
        "page_idx": 13,
        "block_type": "text",
        "block_kind": "text",
        "semantic_role": "body",
        "structure_role": "body",
        "normalized_sub_type": "body",
        "translation_unit_protected_source_text": source,
        "protected_source_text": source,
    }


def test_extract_direct_typst_protocol_text_handles_fenced_json_translation_key() -> None:
    raw = '```json\n{"translation": "示例 4.2：水分子单点能计算的 Q-CHEM 输入。"}\n```'

    assert extract_direct_typst_protocol_text(raw, item_id="p014-b004") == "示例 4.2：水分子单点能计算的 Q-CHEM 输入。"


def test_extract_direct_typst_protocol_text_handles_item_id_mapping() -> None:
    raw = '{"p014-b004": "示例 4.2：水分子单点能计算的 Q-CHEM 输入。"}'

    assert extract_direct_typst_protocol_text(raw, item_id="p014-b004") == "示例 4.2：水分子单点能计算的 Q-CHEM 输入。"


def test_canonicalize_batch_result_preserves_group_member_translations() -> None:
    item = _body_item()
    item["item_id"] = "__cg__:cg-014-001"
    item["translation_unit_id"] = "__cg__:cg-014-001"
    payload = result_entry("translate", "合并后的译文。")
    payload["member_translations"] = [
        {"item_id": "p014-b004", "translated_text": "第一段译文。"},
        {"item_id": "p014-b005", "translated_text": "第二段译文。"},
    ]

    result = canonicalize_batch_result([item], {item["item_id"]: payload})

    assert result[item["item_id"]]["translated_text"] == "合并后的译文。"
    assert result[item["item_id"]]["member_translations"] == payload["member_translations"]


def test_repeated_direct_typst_protocol_shell_marks_body_failed(retry_sleep) -> None:
    item = _body_item()

    def fail_with_protocol_shell(*args, **kwargs):
        raise TranslationProtocolError(
            item["item_id"],
            source_text=item["translation_unit_protected_source_text"],
            translated_text='{"translated_text": {"text": "bad shell"}}',
        )

    result = translate_direct_typst_plain_text_with_retries(
        item,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="unit",
        context=build_translation_control_context(mode="sci"),
        diagnostics=None,
        translator=None,
        translate_plain_fn=fail_with_protocol_shell,
        translate_unstructured_fn=fail_with_protocol_shell,
    )

    payload = result[item["item_id"]]
    diagnostics = payload["translation_diagnostics"]
    assert payload["decision"] == "translate"
    assert payload["translated_text"] == ""
    assert payload["final_status"] == "failed"
    assert diagnostics["degradation_reason"] == "protocol_shell_repeated"
    assert diagnostics["error_trace"] == [{"type": "validation", "code": "PROTOCOL_SHELL"}]
    assert diagnostics["fallback_to"] == "retry_required"
    assert [call.args[0] for call in retry_sleep.call_args_list] == [2]


def test_repeated_direct_typst_empty_body_uses_sentence_level_fallback(retry_sleep) -> None:
    item = _body_item()
    item["math_mode"] = "direct_typst"

    def fail_with_empty_translation(*args, **kwargs):
        raise EmptyTranslationError(item["item_id"])

    def sentence_level_fallback_fn(item, **kwargs):
        return {
            item["item_id"]: {
                "decision": "translate",
                "translated_text": "示例 4.2：水分子单点能计算的 Q-CHEM 输入。",
                "final_status": "partially_translated",
                "translation_diagnostics": {
                    "route_path": ["block_level", "sentence_level"],
                    "fallback_to": "sentence_level",
                },
            }
        }

    result = translate_direct_typst_plain_text_with_retries(
        item,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="unit",
        context=build_translation_control_context(mode="sci"),
        diagnostics=None,
        translator=None,
        translate_plain_fn=fail_with_empty_translation,
        translate_unstructured_fn=fail_with_empty_translation,
        sentence_level_fallback_fn=sentence_level_fallback_fn,
    )

    payload = result[item["item_id"]]
    assert payload["decision"] == "translate"
    assert "水分子单点能" in payload["translated_text"]
    assert [call.args[0] for call in retry_sleep.call_args_list] == [2]


def test_repeated_direct_typst_empty_body_degrades_when_sentence_level_fails(retry_sleep) -> None:
    item = _body_item()
    item["math_mode"] = "direct_typst"

    def fail_with_empty_translation(*args, **kwargs):
        raise EmptyTranslationError(item["item_id"])

    result = translate_direct_typst_plain_text_with_retries(
        item,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="unit",
        context=build_translation_control_context(mode="sci"),
        diagnostics=None,
        translator=None,
        translate_plain_fn=fail_with_empty_translation,
        translate_unstructured_fn=fail_with_empty_translation,
        sentence_level_fallback_fn=fail_with_empty_translation,
    )

    payload = result[item["item_id"]]
    diagnostics = payload["translation_diagnostics"]
    assert payload["decision"] == "translate"
    assert payload["translated_text"] == ""
    assert payload["final_status"] == "failed"
    assert diagnostics["degradation_reason"] == "empty_translation_repeated"
    assert diagnostics["error_trace"] == [{"type": "validation", "code": "EMPTY_TRANSLATION"}]
    assert [call.args[0] for call in retry_sleep.call_args_list] == [2]


def test_direct_typst_math_delimiter_failure_uses_llm_repair_before_retry() -> None:
    item = _body_item()
    item["math_mode"] = "direct_typst"
    broken = "请在 $ m' 数学片段附近保持语法。"

    def fail_with_math_delimiter(*args, **kwargs):
        raise MathDelimiterError(
            item["item_id"],
            source_text=item["translation_unit_protected_source_text"],
            translated_text=broken,
        )

    def repair_math_delimiters(item, **kwargs):
        return {
            item["item_id"]: {
                "decision": "translate",
                "translated_text": "请在 $ m' $ 数学片段附近保持语法。",
                "final_status": "translated",
                "translation_diagnostics": {
                    "route_path": ["block_level", "direct_typst", "typst_repair"],
                    "degradation_reason": "typst_math_repaired",
                },
            }
        }

    result = translate_direct_typst_plain_text_with_retries(
        item,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="unit",
        context=build_translation_control_context(mode="sci"),
        diagnostics=None,
        translator=None,
        translate_plain_fn=fail_with_math_delimiter,
        translate_unstructured_fn=fail_with_math_delimiter,
        repair_math_delimiters_fn=repair_math_delimiters,
    )

    payload = result[item["item_id"]]
    assert payload["decision"] == "translate"
    assert "$ m' $" in payload["translated_text"]
    assert payload["translation_diagnostics"]["degradation_reason"] == "typst_math_repaired"


def test_direct_typst_no_longer_auto_escapes_manual_style_bare_dollar_variables() -> None:
    item = _body_item()
    item["math_mode"] = "direct_typst"
    translated = "要启用该计算，请在 $rem 部分设置 INCDFT = 2，并使用 $active_orbitals 输入段。"

    result = canonicalize_batch_result([item], {item["item_id"]: result_entry("translate", translated)})

    validate_batch_result([item], result)
    assert result[item["item_id"]]["translated_text"] == translated
