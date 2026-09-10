import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
from retainpdf_pipeline.translate.services.memory import JobMemorySnapshot
from retainpdf_pipeline.translate.services.results.applier import expand_duplicate_results as _expand_duplicate_results
from retainpdf_pipeline.translate.workflow.batching import pending_units
from retainpdf_pipeline.translate.workflow.batching.plan import _dedupe_pending_items


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


def test_duplicate_plain_items_are_collapsed_and_expanded_with_item_diagnostics() -> None:
    pending = [
        _item("a", "A", block_type="image_caption", page_idx=0),
        _item("b", "A", block_type="image_caption", page_idx=1),
        _item("c", "B", block_type="image_caption", page_idx=1),
    ]
    unique, duplicates = _dedupe_pending_items(pending)
    assert [item["item_id"] for item in unique] == ["a", "c"]
    assert [item["item_id"] for item in duplicates["a"]] == ["b"]

    expanded = _expand_duplicate_results(
        {
            "a": {
                "decision": "translate",
                "translated_text": "甲",
                "final_status": "translated",
                "translation_diagnostics": {"item_id": "a", "page_idx": 0, "route_path": ["block_level"]},
            }
        },
        duplicate_items_by_rep_id=duplicates,
    )
    assert expanded["b"]["translated_text"] == "甲"
    assert expanded["b"]["translation_diagnostics"]["item_id"] == "b"
    assert expanded["b"]["translation_diagnostics"]["page_idx"] == 1


def test_duplicate_plain_items_keep_origin_when_representative_result_failed() -> None:
    pending = [
        _item("a", "A", block_type="image_caption", page_idx=0),
        _item("b", "A", block_type="image_caption", page_idx=1),
    ]
    _unique, duplicates = _dedupe_pending_items(pending)

    expanded = _expand_duplicate_results(
        {
            "a": {
                "decision": "translate",
                "translated_text": "",
                "final_status": "failed",
                "translation_diagnostics": {"item_id": "a", "page_idx": 0},
            }
        },
        duplicate_items_by_rep_id=duplicates,
    )

    assert expanded["b"]["final_status"] == "kept_origin"
    assert expanded["b"]["translation_diagnostics"]["item_id"] == "b"
    assert expanded["b"]["translation_diagnostics"]["page_idx"] == 1
    assert expanded["b"]["translation_diagnostics"]["fallback_to"] == "keep_origin"
    assert "fast_path_keep_origin" in expanded["b"]["translation_diagnostics"]["route_path"]
    assert expanded["b"]["translation_diagnostics"]["degradation_reason"] == "duplicate_representative_not_expandable"


def test_translate_pending_units_uses_readonly_memory_snapshot_by_default(monkeypatch, tmp_path: Path) -> None:
    captured: dict[str, object] = {}

    class _FakeApplier:
        def __init__(self, **kwargs) -> None:
            captured["memory_store"] = kwargs["memory_store"]

        def apply_immediate(self, _translated):
            return set()

    monkeypatch.setattr(pending_units, "TranslationResultApplier", _FakeApplier)

    def _capture_parallel(**kwargs) -> None:
        captured["worker_memory_store"] = kwargs["memory_store"]

    monkeypatch.setattr(pending_units, "run_translation_batches_parallel", _capture_parallel)
    monkeypatch.setattr(pending_units, "run_translation_batches_sequential", lambda **_kwargs: None)
    monkeypatch.setattr(pending_units, "_save_flush_interval", lambda **_kwargs: 1)

    payload = {"pages": []}
    page_payloads = {0: [_item("a", "SCF cycle converges before energy evaluation.", page_idx=0)]}
    translation_paths = {0: tmp_path / "page-0001.json"}

    stats = pending_units.translate_pending_units(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
        batch_size=1,
        workers=2,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        translation_context=build_translation_control_context(),
    )

    assert payload == {"pages": []}
    assert stats["pending_items"] == 1
    assert captured["memory_store"] is None
    assert isinstance(captured["worker_memory_store"], JobMemorySnapshot)


def test_translate_pending_units_can_enable_live_memory_updates(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("RETAIN_TRANSLATION_LIVE_MEMORY_UPDATES", "1")
    captured: dict[str, object] = {}

    class _FakeApplier:
        def __init__(self, **kwargs) -> None:
            captured["memory_store"] = kwargs["memory_store"]

        def apply_immediate(self, _translated):
            return set()

    monkeypatch.setattr(pending_units, "TranslationResultApplier", _FakeApplier)
    monkeypatch.setattr(pending_units, "run_translation_batches_parallel", lambda **_kwargs: None)
    monkeypatch.setattr(pending_units, "run_translation_batches_sequential", lambda **_kwargs: None)
    monkeypatch.setattr(pending_units, "_save_flush_interval", lambda **_kwargs: 1)

    page_payloads = {0: [_item("a", "SCF cycle converges before energy evaluation.", page_idx=0)]}
    translation_paths = {0: tmp_path / "page-0001.json"}

    pending_units.translate_pending_units(
        page_payloads=page_payloads,
        translation_paths=translation_paths,
        batch_size=1,
        workers=2,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        translation_context=build_translation_control_context(),
    )

    assert captured["memory_store"] is not None
