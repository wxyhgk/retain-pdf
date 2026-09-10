import json
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.workflow import stages
from retainpdf_pipeline.translate.workflow.phases import repair as repair_phase


def _item(item_id: str, text: str) -> dict:
    return {
        "item_id": item_id,
        "page_idx": 0,
        "block_type": "text",
        "source_text": text,
        "protected_source_text": text,
        "translation_unit_protected_source_text": text,
        "protected_translated_text": text,
        "translated_text": text,
        "should_translate": True,
        "protected_map": [],
        "formula_map": [],
        "translation_unit_protected_map": [],
        "translation_unit_formula_map": [],
        "metadata": {"structure_role": "body"},
    }


def test_agent_repair_stage_can_be_disabled_by_env(monkeypatch, tmp_path: Path) -> None:
    path = tmp_path / "page-001.json"
    payload = [_item("p001-b001", "The self-consistent field procedure computes molecular orbitals.")]
    path.write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setenv("RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT", "0")

    summary = stages.run_agent_repair_stage(
        page_payloads={0: payload},
        translation_paths={0: path},
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        translation_context=None,
        run_diagnostics=None,
    )

    assert summary["candidate_items"] == 0
    assert json.loads(path.read_text(encoding="utf-8"))[0]["translated_text"] == payload[0]["translated_text"]


def test_agent_repair_stage_runs_limited_repair_and_saves(monkeypatch, tmp_path: Path) -> None:
    path = tmp_path / "page-001.json"
    payload = [
        _item(
            "p001-b001",
            (
                "The self-consistent field procedure computes the molecular orbitals before "
                "the final energy is evaluated for the system."
            ),
        )
    ]
    path.write_text(json.dumps(payload), encoding="utf-8")
    monkeypatch.setenv("RETAIN_TRANSLATION_REPAIR_PROFILE", "quality")
    monkeypatch.setenv("RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT", "1")

    def _fake_request(*_args, **_kwargs):
        return json.dumps(
            {
                "repaired_text": "自洽场过程计算分子轨道，然后评估体系的最终能量。",
                "applied_issue_kinds": ["english_residue"],
                "confidence": 0.9,
                "needs_manual_review": False,
                "notes": "",
            },
            ensure_ascii=False,
        )

    monkeypatch.setattr(repair_phase, "request_chat_content", _fake_request)
    summary = stages.run_agent_repair_stage(
        page_payloads={0: payload},
        translation_paths={0: path},
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        translation_context=None,
        run_diagnostics=None,
    )

    saved = json.loads(path.read_text(encoding="utf-8"))
    assert summary["candidate_items"] == 1
    assert summary["repaired_items"] == 1
    assert saved[0]["translated_text"] == "自洽场过程计算分子轨道，然后评估体系的最终能量。"
    assert saved[0]["translation_diagnostics"]["agent_repaired"] is True


def test_agent_repair_limit_scales_with_blocking_untranslated(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_TRANSLATION_REPAIR_PROFILE", "quality")
    monkeypatch.delenv("RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT", raising=False)

    assert stages._agent_repair_limit_from_env(
        payload_size=3331,
        blocking_untranslated_count=26,
    ) >= 52


def test_agent_repair_limit_defaults_to_small_fast_budget(monkeypatch) -> None:
    monkeypatch.delenv("RETAIN_TRANSLATION_REPAIR_PROFILE", raising=False)
    monkeypatch.delenv("RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT", raising=False)

    assert stages._agent_repair_limit_from_env(
        payload_size=3331,
        blocking_untranslated_count=26,
    ) == 8


def test_agent_repair_limit_env_override_still_wins(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT", "3")

    assert stages._agent_repair_limit_from_env(
        payload_size=3331,
        blocking_untranslated_count=26,
    ) == 3
