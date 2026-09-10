import json
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.artifacts import blocking_untranslated_items
from retainpdf_pipeline.translate.services.finalization import recover_blocking_untranslated_items
from retainpdf_pipeline.translate.workflow import stages
from retainpdf_pipeline.translate.workflow.phases import repair as repair_phase


def _failed_item(item_id: str, source_text: str) -> dict:
    return {
        "item_id": item_id,
        "page_idx": 0,
        "block_type": "text",
        "block_kind": "text",
        "raw_block_type": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "source_text": source_text,
        "protected_source_text": source_text,
        "translation_unit_protected_source_text": source_text,
        "should_translate": True,
        "final_status": "failed",
        "translation_diagnostics": {
            "final_status": "failed",
            "degradation_reason": "sentence_level_fallback_failed",
            "fallback_to": "retry_required",
        },
        "protected_map": [],
        "formula_map": [],
        "translation_unit_protected_map": [],
        "translation_unit_formula_map": [],
    }


def test_final_untranslated_recovery_translates_blocking_item() -> None:
    payload = [_failed_item("p001-b001", "The density functional is evaluated on the numerical grid.")]

    def _fake_request(*_args, **_kwargs):
        return "密度泛函在数值网格上求值。"

    summary = recover_blocking_untranslated_items(
        {0: payload},
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        request_chat_content_fn=_fake_request,
    )

    assert summary.recovered_items == 1
    assert summary.blocking_after == 0
    assert payload[0]["translated_text"] == "密度泛函在数值网格上求值。"
    assert payload[0]["final_status"] == "translated"
    assert blocking_untranslated_items({0: payload}) == []


def test_final_untranslated_recovery_dead_letters_unrecoverable_item() -> None:
    payload = [_failed_item("p001-b002", "The output remains unavailable after all retry stages.")]

    def _fake_request(*_args, **_kwargs):
        raise TimeoutError("provider timeout")

    summary = recover_blocking_untranslated_items(
        {0: payload},
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        request_chat_content_fn=_fake_request,
    )

    assert summary.recovered_items == 0
    assert summary.dead_letter_items == 1
    assert summary.blocking_after == 1
    assert payload[0]["final_status"] == "failed"
    assert payload[0]["should_translate"] is True
    assert payload[0]["classification_label"] == ""
    assert payload[0]["skip_reason"] == ""
    assert payload[0]["source_text"] == "The output remains unavailable after all retry stages."
    assert payload[0]["translation_diagnostics"]["dead_letter"] is True
    assert len(blocking_untranslated_items({0: payload})) == 1


def test_final_untranslated_recovery_skips_protocol_hex_dump() -> None:
    source = "Answer(slave-Base module):\n" + " ".join(["01", "03", "40", "FF", "00"] * 80)
    payload = [_failed_item("p182-b016", source)]
    calls = 0

    def _fake_request(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        raise AssertionError("hex dump should not call provider")

    summary = recover_blocking_untranslated_items(
        {0: payload},
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        request_chat_content_fn=_fake_request,
    )

    assert calls == 0
    assert summary.attempted_items == 0
    assert blocking_untranslated_items({0: payload}) == []


def test_final_untranslated_recovery_stage_saves_pages(monkeypatch, tmp_path: Path) -> None:
    path = tmp_path / "page-001.json"
    payload = [_failed_item("p001-b003", "The matrix is diagonalized in the basis.")]
    path.write_text(json.dumps(payload), encoding="utf-8")

    monkeypatch.setattr(repair_phase, "request_chat_content", lambda *_args, **_kwargs: "该矩阵在基组中被对角化。")
    summary = stages.run_final_untranslated_recovery_stage(
        page_payloads={0: payload},
        translation_paths={0: path},
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        translation_context=None,
        workers=4,
    )

    saved = json.loads(path.read_text(encoding="utf-8"))
    assert summary["recovered_items"] == 1
    assert saved[0]["translated_text"] == "该矩阵在基组中被对角化。"


def test_final_untranslated_recovery_respects_item_budget(monkeypatch) -> None:
    payload = [
        _failed_item("p001-b001", "The density functional is evaluated."),
        _failed_item("p001-b002", "The basis set is optimized."),
    ]
    calls = 0

    def _fake_request(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        return "已翻译。"

    monkeypatch.setenv("RETAIN_TRANSLATION_FINAL_RECOVERY_MAX_ITEMS", "1")
    summary = recover_blocking_untranslated_items(
        {0: payload},
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        request_chat_content_fn=_fake_request,
    )

    assert calls == 1
    assert summary.attempted_items == 1
    assert summary.skipped_by_budget == 1


def test_final_recovery_limit_defaults_to_small_fast_budget(monkeypatch) -> None:
    monkeypatch.delenv("RETAIN_TRANSLATION_REPAIR_PROFILE", raising=False)
    monkeypatch.delenv("RETAIN_TRANSLATION_FINAL_RECOVERY_MAX_ITEMS", raising=False)

    assert repair_phase._final_recovery_limit_from_env() == 4


def test_final_recovery_limit_uses_quality_budget(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_TRANSLATION_REPAIR_PROFILE", "quality")
    monkeypatch.delenv("RETAIN_TRANSLATION_FINAL_RECOVERY_MAX_ITEMS", raising=False)

    assert repair_phase._final_recovery_limit_from_env() == 64
