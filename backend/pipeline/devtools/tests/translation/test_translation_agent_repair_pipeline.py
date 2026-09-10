import json
import sys
from threading import Barrier
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.agents import TranslationAgentCoordinator
from retainpdf_pipeline.translate.services.agents import TranslationAgentRuntime
from retainpdf_pipeline.translate.services.agents import run_agent_repair_pipeline
from retainpdf_pipeline.translate.llm.shared.control_context import GlossaryEntry
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context


def _item(item_id: str, source_text: str, **overrides) -> dict:
    item = {
        "item_id": item_id,
        "page_idx": 0,
        "block_type": "text",
        "source_text": source_text,
        "protected_source_text": source_text,
        "translation_unit_protected_source_text": source_text,
        "should_translate": True,
        "protected_map": [],
        "formula_map": [],
        "translation_unit_protected_map": [],
        "translation_unit_formula_map": [],
        "metadata": {"structure_role": "body"},
    }
    item.update(overrides)
    return item


def test_agent_repair_pipeline_repairs_english_residue_and_applies_result() -> None:
    payload = [
        _item(
            "p001-b001",
            (
                "The self-consistent field procedure computes the molecular orbitals <f1-abc/> "
                "before the final energy is evaluated for the system."
            ),
            protected_map=[{"token_tag": "<f1-abc/>", "restore_text": "$E$"}],
            translation_unit_protected_map=[{"token_tag": "<f1-abc/>", "restore_text": "$E$"}],
        )
    ]
    translated_results = {
            "p001-b001": {
                "decision": "translate",
                "translated_text": (
                    "The self-consistent field procedure computes the molecular orbitals <f1-abc/> "
                    "before the final energy is evaluated for the system."
                ),
            }
        }

    def _fake_request(*_args, **_kwargs):
        return json.dumps(
            {
                "repaired_text": "自洽场循环保留 <f1-abc/> 于最终能量计算中。",
                "applied_issue_kinds": ["english_residue"],
                "confidence": 0.9,
                "needs_manual_review": False,
                "notes": "",
            },
            ensure_ascii=False,
        )

    summary = run_agent_repair_pipeline(
        payload=payload,
        translated_results=translated_results,
        coordinator=TranslationAgentCoordinator(),
        runtime=TranslationAgentRuntime(request_chat_content_fn=_fake_request),
    )

    assert summary.as_dict() == {
        "reviewed_items": 1,
        "candidate_items": 1,
        "repaired_items": 1,
        "skipped_items": 0,
        "failed_items": 0,
    }
    assert payload[0]["protected_translated_text"] == "自洽场循环保留 <f1-abc/> 于最终能量计算中。"
    assert payload[0]["translated_text"] == "自洽场循环保留 $E$ 于最终能量计算中。"
    assert payload[0]["translation_diagnostics"]["agent_repaired"] is True
    assert payload[0]["translation_diagnostics"]["applied_issue_kinds"] == ["english_residue"]


def test_agent_repair_pipeline_repairs_empty_translation_and_applies_result() -> None:
    payload = [
        _item(
            "p020-b012",
            "We need only to diagonalize the matrix $ F' $",
            raw_block_type="text",
            block_kind="text",
            layout_role="paragraph",
            semantic_role="body",
            structure_role="body",
            math_mode="direct_typst",
        )
    ]
    translated_results = {
        "p020-b012": {
            "decision": "translate",
            "translated_text": "",
            "final_status": "failed",
        }
    }

    def _fake_request(*_args, **_kwargs):
        return json.dumps(
            {
                "repaired_text": "我们只需要对角化矩阵 $ F' $",
                "applied_issue_kinds": ["empty_translation"],
                "confidence": 0.94,
                "needs_manual_review": False,
                "notes": "",
            },
            ensure_ascii=False,
        )

    summary = run_agent_repair_pipeline(
        payload=payload,
        translated_results=translated_results,
        coordinator=TranslationAgentCoordinator(),
        runtime=TranslationAgentRuntime(request_chat_content_fn=_fake_request),
    )

    assert summary.candidate_items == 1
    assert summary.repaired_items == 1
    assert payload[0]["translated_text"] == "我们只需要对角化矩阵 $ F' $"
    assert payload[0]["final_status"] == "translated"
    assert payload[0]["translation_diagnostics"]["agent_repaired"] is True
    assert payload[0]["translation_diagnostics"]["applied_issue_kinds"] == ["empty_translation"]


def test_agent_repair_pipeline_accepts_common_repair_response_aliases() -> None:
    payload = [
        _item(
            "p020-b013",
            "The density functional approximation is evaluated for each grid point.",
            raw_block_type="text",
            block_kind="text",
        )
    ]
    translated_results = {
        "p020-b013": {
            "decision": "translate",
            "translated_text": "",
            "final_status": "failed",
        }
    }

    def _fake_request(*_args, **_kwargs):
        return json.dumps(
            {
                "result": {
                    "translation": "对每个网格点计算密度泛函近似。",
                    "applied_issues": ["empty_translation"],
                    "confidence": 0.91,
                    "needs_manual_review": False,
                }
            },
            ensure_ascii=False,
        )

    summary = run_agent_repair_pipeline(
        payload=payload,
        translated_results=translated_results,
        coordinator=TranslationAgentCoordinator(),
        runtime=TranslationAgentRuntime(request_chat_content_fn=_fake_request),
    )

    assert summary.repaired_items == 1
    assert payload[0]["translated_text"] == "对每个网格点计算密度泛函近似。"
    assert payload[0]["final_status"] == "translated"


def test_agent_repair_pipeline_rejects_invalid_repair_output() -> None:
    payload = [
        _item(
            "p001-b009",
            "The self-consistent field procedure computes molecular orbitals before final energy is evaluated.",
        )
    ]
    translated_results = {
        "p001-b009": {
            "decision": "translate",
            "translated_text": "",
            "final_status": "failed",
        }
    }

    def _fake_request(*_args, **_kwargs):
        return json.dumps(
            {
                "repaired_text": "The self-consistent field procedure computes molecular orbitals before final energy is evaluated.",
                "applied_issue_kinds": ["empty_translation"],
                "confidence": 0.9,
                "needs_manual_review": False,
                "notes": "",
            },
            ensure_ascii=False,
        )

    summary = run_agent_repair_pipeline(
        payload=payload,
        translated_results=translated_results,
        coordinator=TranslationAgentCoordinator(),
        runtime=TranslationAgentRuntime(request_chat_content_fn=_fake_request),
    )

    assert summary.candidate_items == 1
    assert summary.repaired_items == 0
    assert summary.failed_items == 1
    assert payload[0].get("final_status") != "translated"
    diagnostics = payload[0]["translation_diagnostics"]
    assert diagnostics["agent_repair_error_type"] == "RepairValidationError"
    assert "english_residue" in diagnostics["agent_repair_issue_kinds"]


def test_agent_repair_pipeline_runs_candidates_in_parallel() -> None:
    payload = [
        _item(
            f"p001-b00{index}",
            "The self-consistent field procedure computes the molecular orbitals before final energy.",
        )
        for index in range(4)
    ]
    translated_results = {
        item["item_id"]: {
            "decision": "translate",
            "translated_text": "The self-consistent field procedure computes the molecular orbitals before final energy.",
        }
        for item in payload
    }

    requests_entered = Barrier(len(payload), timeout=5)

    def _fake_request(*_args, **_kwargs):
        # No request can finish until all four are in flight. Serial execution
        # breaks the barrier and fails the repaired-items assertion below.
        requests_entered.wait()
        return json.dumps(
            {
                "repaired_text": "自洽场过程在最终能量前计算分子轨道。",
                "applied_issue_kinds": ["english_residue"],
                "confidence": 0.9,
                "needs_manual_review": False,
                "notes": "",
            },
            ensure_ascii=False,
        )

    summary = run_agent_repair_pipeline(
        payload=payload,
        translated_results=translated_results,
        coordinator=TranslationAgentCoordinator(),
        runtime=TranslationAgentRuntime(request_chat_content_fn=_fake_request),
    )

    assert summary.candidate_items == 4
    assert summary.repaired_items == 4
    assert all(item["translation_diagnostics"]["agent_repaired"] is True for item in payload)


def test_agent_repair_pipeline_skips_placeholder_blocking_issues() -> None:
    payload = [
        _item(
            "p001-b002",
            "The final energy <f1-abc/> is reported.",
        )
    ]
    translated_results = {
        "p001-b002": {
            "decision": "translate",
            "translated_text": "最终能量 <f9-bad/> 被报告。",
        }
    }

    summary = run_agent_repair_pipeline(
        payload=payload,
        translated_results=translated_results,
        coordinator=TranslationAgentCoordinator(),
        runtime=TranslationAgentRuntime(request_chat_content_fn=lambda *_args, **_kwargs: "{}"),
    )

    assert summary.candidate_items == 0
    assert summary.repaired_items == 0
    assert summary.skipped_items == 1
    assert payload[0]["translation_diagnostics"]["agent_repair_skipped"] is True
    assert payload[0]["translation_diagnostics"]["agent_repair_skip_reason"] == "blocking_quality_issue"


def test_agent_repair_pipeline_skips_continuation_group_members() -> None:
    payload = [
        _item(
            "p011-b012",
            "are the integration weights, which are derived from",
            continuation_group="cg-1",
            translation_unit_id="group:cg-1",
        )
    ]
    translated_results = {
        "p011-b012": {
            "decision": "translate",
            "translated_text": "",
            "final_status": "failed",
        }
    }

    summary = run_agent_repair_pipeline(
        payload=payload,
        translated_results=translated_results,
        coordinator=TranslationAgentCoordinator(),
        runtime=TranslationAgentRuntime(request_chat_content_fn=lambda *_args, **_kwargs: "{}"),
    )

    assert summary.candidate_items == 0
    assert summary.repaired_items == 0
    assert summary.skipped_items == 1
    assert payload[0]["translation_diagnostics"]["agent_repair_skip_reason"] == "continuation_group_member"


def test_agent_repair_pipeline_skips_policy_keep_origin_display_formula() -> None:
    payload = [
        _item(
            "p002-b008",
            "$$ E = mc^2 $$",
            raw_block_type="display_formula",
            block_type="formula",
            block_kind="formula",
            should_translate=False,
            policy_translate=False,
        )
    ]
    translated_results = {
        "p002-b008": {
            "decision": "translate",
            "translated_text": "",
            "final_status": "kept_origin",
        }
    }

    summary = run_agent_repair_pipeline(
        payload=payload,
        translated_results=translated_results,
        coordinator=TranslationAgentCoordinator(),
        runtime=TranslationAgentRuntime(request_chat_content_fn=lambda *_args, **_kwargs: "{}"),
    )

    assert summary.candidate_items == 0
    assert summary.repaired_items == 0
    assert summary.skipped_items == 1
    assert payload[0]["translation_diagnostics"]["agent_repair_skip_reason"] == "policy_keep_origin_item"


def test_agent_coordinator_respects_glossary_mode_off() -> None:
    context = build_translation_control_context(
        glossary_entries=[GlossaryEntry(source="SCF", target="自洽场")],
        glossary_mode="off",
    )

    coordinator = TranslationAgentCoordinator.from_control_context(context)

    assert coordinator.reviewer_agent is not None
    assert coordinator.reviewer_agent._glossary_entries == []
