import json
from dataclasses import replace
from unittest import mock

import pytest
import requests

from retainpdf_pipeline.translate.llm.providers.deepseek import translation_client
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
from retainpdf_pipeline.translate.llm.shared.orchestration import single_item_flow as flow
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import DeferredTransportRetry
from retainpdf_pipeline.translate.llm.shared.structured_models import TRANSLATION_GROUP_MEMBER_RESPONSE_SCHEMA


def group_item():
    return {
        "item_id": "__cg__:test", "translation_unit_id": "__cg__:test",
        "translation_unit_member_ids": ["a", "b"],
        "protected_source_text": "The energy continues.",
        "translation_unit_protected_source_text": "The energy continues.",
        "math_mode": "direct_typst", "block_type": "text",
        "metadata": {"structure_role": "body"},
    }


def test_member_only_result_is_assembled_in_source_order():
    payload = {"member_translations": [
        {"item_id": "b", "translated_text": "继续。"},
        {"item_id": "a", "translated_text": "能量"},
    ]}
    with mock.patch.object(translation_client, "request_chat_content", return_value=json.dumps(payload)) as request:
        result = translation_client.translate_continuation_group_members(group_item())["__cg__:test"]
    assert result["translated_text"] == "能量 继续。"
    assert [m["item_id"] for m in result["member_translations"]] == ["a", "b"]
    assert request.call_count == 1
    schema = TRANSLATION_GROUP_MEMBER_RESPONSE_SCHEMA["json_schema"]["schema"]
    assert schema["required"] == ["member_translations"]
    assert "translated_text" not in schema["properties"]


@pytest.mark.parametrize("members", [
    [{"item_id": "a", "translated_text": "能量"}],
    [{"item_id": "a", "translated_text": "能量"}, {"item_id": "a", "translated_text": "重复"}],
    [{"item_id": "a", "translated_text": "$x"}, {"item_id": "b", "translated_text": "$继续"}],
])
def test_invalid_member_only_result_cannot_silently_export(members):
    with mock.patch.object(translation_client, "request_chat_content", return_value=json.dumps({"member_translations": members})) as request:
        with pytest.raises(ValueError, match="Invalid continuation member translations"):
            translation_client.translate_continuation_group_members(group_item())
    assert request.call_count == 2


@pytest.mark.parametrize("defer", [True, False])
def test_group_timeout_does_not_restart_through_legacy(defer):
    group = mock.Mock(side_effect=requests.exceptions.ReadTimeout("read timed out"))
    legacy = mock.Mock(side_effect=AssertionError("must not enter legacy route"))
    deps = replace(flow._default_flow_deps(), translate_group_members_fn=group)
    with mock.patch.object(flow, "translate_direct_typst_route", legacy):
        with pytest.raises(DeferredTransportRetry if defer else requests.exceptions.ReadTimeout):
            flow.translate_single_item_plain_text_with_retries(
                group_item(), context=build_translation_control_context(mode="sci"),
                allow_transport_tail_defer=defer, deps=deps,
            )
    assert group.call_count == 1
    legacy.assert_not_called()
