from __future__ import annotations

from retainpdf_pipeline.translate.services.results.applier import (
    TranslationResultApplier,
)


class _MemoryUpdater:
    def __init__(self) -> None:
        self.calls: list[tuple[list[dict], dict]] = []

    def update_from_batch(self, batch: list[dict], translated: dict) -> int:
        self.calls.append((batch, translated))
        return 1


class _FlushState:
    def __init__(self) -> None:
        self.dirty_pages: set[int] = set()
        self.dirty_item_ids_by_page: dict[int, set[str]] = {}

    def mark_dirty(self, pages: set[int], changed_item_ids_by_page: dict[int, set[str]]) -> None:
        self.dirty_pages.update(pages)
        for page_idx, item_ids in changed_item_ids_by_page.items():
            self.dirty_item_ids_by_page.setdefault(page_idx, set()).update(item_ids)


def test_result_applier_uses_memory_updater_protocol(tmp_path) -> None:
    payload = [{"item_id": "a", "page_idx": 0, "source_text": "SCF", "translated_text": ""}]
    memory = _MemoryUpdater()
    applier = TranslationResultApplier(
        flat_payload=payload,
        item_to_page={"a": 0},
        duplicate_items_by_rep_id={},
        flush_state=_FlushState(),
        memory_store=memory,
    )
    batch = [{"item_id": "a", "source_text": "SCF"}]
    translated = {"a": {"decision": "translate", "translated_text": "自洽场"}}

    touched = applier.apply_batch(batch, translated)

    assert touched == {0}
    assert len(memory.calls) == 1
    assert memory.calls[0][0] is batch
    assert memory.calls[0][1]["a"]["translated_text"] == "自洽场"
    assert applier.flush_state.dirty_item_ids_by_page == {0: {"a"}}


def test_result_applier_skips_memory_for_immediate_results(tmp_path) -> None:
    payload = [{"item_id": "a", "page_idx": 0, "source_text": "SCF", "translated_text": ""}]
    memory = _MemoryUpdater()
    applier = TranslationResultApplier(
        flat_payload=payload,
        item_to_page={"a": 0},
        duplicate_items_by_rep_id={},
        flush_state=_FlushState(),
        memory_store=memory,
    )

    applier.apply_immediate({"a": {"decision": "keep_origin", "translated_text": ""}})

    assert memory.calls == []


def test_result_applier_tracks_original_items_after_duplicate_expansion() -> None:
    representative = {
        "item_id": "rep",
        "page_idx": 0,
        "source_text": "same",
        "translated_text": "",
    }
    duplicate = {
        "item_id": "dup",
        "page_idx": 1,
        "source_text": "same",
        "translated_text": "",
    }
    flush_state = _FlushState()
    applier = TranslationResultApplier(
        flat_payload=[representative, duplicate],
        item_to_page={"rep": 0, "dup": 1},
        duplicate_items_by_rep_id={"rep": [duplicate]},
        flush_state=flush_state,
        memory_store=None,
    )

    applier.apply_batch(
        [representative],
        {
            "rep": {
                "decision": "translate",
                "translated_text": "相同",
                "final_status": "translated",
            }
        },
    )

    assert flush_state.dirty_item_ids_by_page == {0: {"rep"}, 1: {"dup"}}


def test_result_applier_tracks_every_original_continuation_group_member() -> None:
    members = [
        {
            "item_id": "g-a",
            "page_idx": 0,
            "source_text": "A",
            "protected_source_text": "A",
            "translated_text": "",
            "should_translate": True,
            "translation_unit_id": "__cg__:cross-page",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["g-a", "g-b"],
        },
        {
            "item_id": "g-b",
            "page_idx": 1,
            "source_text": "B",
            "protected_source_text": "B",
            "translated_text": "",
            "should_translate": True,
            "translation_unit_id": "__cg__:cross-page",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["g-a", "g-b"],
        },
    ]
    flush_state = _FlushState()
    applier = TranslationResultApplier(
        flat_payload=members,
        item_to_page={"g-a": 0, "g-b": 1},
        duplicate_items_by_rep_id={},
        flush_state=flush_state,
        memory_store=None,
    )

    applier.apply_batch(
        members,
        {
            "__cg__:cross-page": {
                "decision": "translate",
                "translated_text": "甲。乙。",
                "member_translations": [
                    {"item_id": "g-a", "translated_text": "甲。"},
                    {"item_id": "g-b", "translated_text": "乙。"},
                ],
                "final_status": "translated",
            }
        },
    )

    assert flush_state.dirty_item_ids_by_page == {0: {"g-a"}, 1: {"g-b"}}


def test_result_applier_does_not_dirty_page_for_identical_translation() -> None:
    item = {
        "item_id": "a",
        "page_idx": 0,
        "source_text": "A",
        "translated_text": "甲",
        "protected_translated_text": "甲",
        "translation_unit_translated_text": "甲",
        "translation_unit_protected_translated_text": "甲",
        "final_status": "translated",
    }
    flush_state = _FlushState()
    applier = TranslationResultApplier(
        flat_payload=[item],
        item_to_page={"a": 0},
        duplicate_items_by_rep_id={},
        flush_state=flush_state,
        memory_store=None,
    )

    touched = applier.apply_batch(
        [item],
        {
            "a": {
                "decision": "translate",
                "translated_text": "甲",
                "final_status": "translated",
            }
        },
    )

    assert touched == set()
    assert flush_state.dirty_item_ids_by_page == {}
