import json
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.agents import RepairAgent
from retainpdf_pipeline.translate.services.agents import TranslationAgentCoordinator
from retainpdf_pipeline.translate.services.agents import TranslationRepairRequest
from retainpdf_pipeline.translate.llm.shared.control_context import GlossaryEntry
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
from retainpdf_pipeline.translate.services.quality import TranslationQualityIssue


def _item() -> dict:
    return {
        "item_id": "p001-b001",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": "The SCF cycle preserves <f1-abc/> in the final energy.",
    }


def test_repair_agent_builds_llm_task_with_matched_issues_and_glossary() -> None:
    agent = RepairAgent(
        glossary_entries=[
            GlossaryEntry(source="SCF", target="自洽场", level="preferred"),
            GlossaryEntry(source="DFTB", target="密度泛函紧束缚", level="preferred"),
        ]
    )
    request = TranslationRepairRequest(
        item=_item(),
        translated_result={"translated_text": "SCF cycle preserves <f2-def/> in the final energy."},
        issues=[
            TranslationQualityIssue("p001-b001", "glossary_term_missing", "warning", "missing term", retryable=False),
            TranslationQualityIssue("p001-b001", "placeholder_inventory_mismatch", "error", "placeholder mismatch"),
        ],
    )

    task = agent.build_task(request, model="deepseek-chat", base_url="https://api.deepseek.com/v1")
    user_payload = json.loads(task.messages[1]["content"])

    assert task.agent == "repair"
    assert task.response_format["type"] == "json_schema"
    assert user_payload["source_placeholders"] == ["<f1-abc/>"]
    assert [issue["kind"] for issue in user_payload["issues"]] == ["glossary_term_missing"]
    assert '"source": "SCF"' in user_payload["matched_glossary_guidance"]
    assert '"target": "自洽场"' in user_payload["matched_glossary_guidance"]
    assert "DFTB" not in user_payload["matched_glossary_guidance"]


def test_repair_agent_parse_result_accepts_translation_alias_and_bounds_confidence() -> None:
    result = RepairAgent().parse_result(
        item_id="p001-b001",
        content='{"translation":"自洽场循环保留 <f1-abc/>。","applied_issue_kinds":"glossary_term_missing","confidence":1.5,"needs_manual_review":false,"notes":"ok"}',
    )

    assert result.repaired_text == "自洽场循环保留 <f1-abc/>。"
    assert result.applied_issue_kinds == ["glossary_term_missing"]
    assert result.confidence == 1.0
    assert not result.needs_manual_review


def test_repair_agent_can_execute_with_injected_request_function() -> None:
    captured: dict[str, object] = {}

    def _fake_request(messages, **kwargs):
        captured["messages"] = messages
        captured["kwargs"] = kwargs
        return json.dumps(
            {
                "repaired_text": "自洽场循环保留 <f1-abc/>。",
                "applied_issue_kinds": ["glossary_term_missing"],
                "confidence": 0.9,
                "needs_manual_review": False,
                "notes": "",
            },
            ensure_ascii=False,
        )

    result = RepairAgent().repair_with_llm(
        TranslationRepairRequest(
            item=_item(),
            translated_result={"translated_text": "SCF cycle preserves <f1-abc/>."},
            issues=[TranslationQualityIssue("p001-b001", "english_residue", "error", "english")],
        ),
        request_chat_content_fn=_fake_request,
        api_key="sk-test",
        model="demo",
        base_url="https://example.com/v1",
    )

    assert result.repaired_text == "自洽场循环保留 <f1-abc/>。"
    assert captured["kwargs"]["request_label"] == "repair p001-b001"


def test_coordinator_exposes_repair_task_builder() -> None:
    context = build_translation_control_context(
        glossary_entries=[GlossaryEntry(source="SCF", target="自洽场", level="preferred")]
    )
    task = TranslationAgentCoordinator.from_control_context(context).build_repair_task(
        TranslationRepairRequest(
            item=_item(),
            translated_result={"translated_text": "SCF cycle preserves <f1-abc/>."},
            issues=[TranslationQualityIssue("p001-b001", "glossary_term_missing", "warning", "missing", retryable=False)],
        )
    )

    assert task.task_id == "repair:p001-b001"
    user_payload = json.loads(task.messages[1]["content"])
    assert '"source": "SCF"' in user_payload["matched_glossary_guidance"]
    assert '"target": "自洽场"' in user_payload["matched_glossary_guidance"]
