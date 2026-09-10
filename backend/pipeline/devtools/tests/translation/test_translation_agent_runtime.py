import json
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.agents import AgentRunContext
from retainpdf_pipeline.translate.services.agents import AgentPlan
from retainpdf_pipeline.translate.services.agents import LLMTask
from retainpdf_pipeline.translate.services.agents import TranslationAgentCoordinator
from retainpdf_pipeline.translate.services.agents import TranslationAgentRuntime
from retainpdf_pipeline.translate.services.agents import TranslationRepairRequest
from retainpdf_pipeline.translate.services.quality import TranslationQualityIssue


def test_agent_runtime_executes_task_with_provider_request_contract() -> None:
    captured: dict[str, object] = {}

    def _fake_request(messages, **kwargs):
        captured["messages"] = messages
        captured["kwargs"] = kwargs
        return "ok"

    runtime = TranslationAgentRuntime(
        api_key="sk-test",
        context=AgentRunContext(model="default-model", base_url="https://default.example/v1"),
        request_chat_content_fn=_fake_request,
    )
    result = runtime.execute_task(
        LLMTask(
            task_id="task-1",
            agent="demo",
            messages=[{"role": "user", "content": "hello"}],
            timeout_s=9,
            metadata={"item_id": "p001-b001"},
        )
    )

    assert result.success
    assert result.content == "ok"
    assert captured["kwargs"]["api_key"] == "sk-test"
    assert captured["kwargs"]["model"] == "default-model"
    assert captured["kwargs"]["base_url"] == "https://default.example/v1"
    assert captured["kwargs"]["timeout"] == 9
    assert captured["kwargs"]["request_label"] == "agent:demo:p001-b001"
    assert result.metadata["request_label"] == "agent:demo:p001-b001"


def test_agent_runtime_returns_failed_result_without_raising() -> None:
    def _fake_request(*_args, **_kwargs):
        raise TimeoutError("slow")

    runtime = TranslationAgentRuntime(request_chat_content_fn=_fake_request)
    result = runtime.execute_task(
        LLMTask(
            task_id="task-2",
            agent="demo",
            messages=[{"role": "user", "content": "hello"}],
        )
    )

    assert not result.success
    assert "TimeoutError: slow" in result.error


def test_agent_runtime_executes_plan_in_order() -> None:
    seen: list[str] = []

    def _fake_request(messages, **_kwargs):
        seen.append(messages[0]["content"])
        return messages[0]["content"]

    runtime = TranslationAgentRuntime(request_chat_content_fn=_fake_request)
    result = runtime.execute_plan(
        AgentPlan(
            plan_id="plan-1",
            tasks=[
                LLMTask(task_id="a", agent="demo", messages=[{"role": "user", "content": "first"}]),
                LLMTask(task_id="b", agent="demo", messages=[{"role": "user", "content": "second"}]),
            ],
        )
    )

    assert result.success
    assert seen == ["first", "second"]
    assert [item.content for item in result.results] == ["first", "second"]


def test_coordinator_can_run_repair_through_agent_runtime() -> None:
    def _fake_request(*_args, **_kwargs):
        return json.dumps(
            {
                "repaired_text": "自洽场循环保留 <f1-abc/>。",
                "applied_issue_kinds": ["english_residue"],
                "confidence": 0.91,
                "needs_manual_review": False,
                "notes": "",
            },
            ensure_ascii=False,
        )

    request = TranslationRepairRequest(
        item={
            "item_id": "p001-b001",
            "translation_unit_protected_source_text": "The SCF cycle preserves <f1-abc/>.",
        },
        translated_result={"translated_text": "SCF cycle preserves <f1-abc/>."},
        issues=[TranslationQualityIssue("p001-b001", "english_residue", "error", "english")],
    )

    result = TranslationAgentCoordinator().run_repair(
        request,
        runtime=TranslationAgentRuntime(request_chat_content_fn=_fake_request),
    )

    assert result.repaired_text == "自洽场循环保留 <f1-abc/>。"
    assert result.applied_issue_kinds == ["english_residue"]
