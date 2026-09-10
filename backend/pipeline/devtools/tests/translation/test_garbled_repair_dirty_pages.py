from copy import deepcopy
import json

from retainpdf_pipeline.translate.core.orchestration.units import (
    refresh_translation_units_and_collect_changed_pages,
    refresh_translation_units_by_page,
)
from retainpdf_pipeline.translate.services.results.page_io import save_pages
from retainpdf_pipeline.translate.workflow.phases import repair


def _pages():
    pages = {
        index: [{"item_id": f"p{index + 1:03d}-b000", "page_idx": index,
                 "source_text": f"Source page {index}",
                 "protected_source_text": f"Source page {index}",
                 "should_translate": True}]
        for index in (2, 3, 4)
    }
    for index in (2, 3):
        pages[index][0]["continuation_group"] = "cross-page"
    refresh_translation_units_by_page(pages)
    return pages


def test_refresh_reports_cross_page_metadata_changes_and_is_idempotent():
    pages = _pages()
    pages[3][0]["translation_unit_member_ids"] = ["p004-b000"]
    assert refresh_translation_units_and_collect_changed_pages(pages) == {3}
    assert pages[3][0]["translation_unit_member_ids"] == ["p003-b000", "p004-b000"]
    assert refresh_translation_units_and_collect_changed_pages(pages) == set()


def test_refresh_reports_group_translation_cleanup_not_only_unit_identity():
    pages = _pages()
    pages[4][0]["group_translated_text"] = "Stale group translation"
    pages[4][0]["group_protected_translated_text"] = "Stale protected translation"
    assert refresh_translation_units_and_collect_changed_pages(pages) == {4}
    assert pages[4][0]["group_translated_text"] == ""
    assert pages[4][0]["group_protected_translated_text"] == ""


def test_garbled_stage_persists_refresh_changed_peer_without_writing_unchanged_page(tmp_path, monkeypatch):
    pages = _pages()
    # A stale peer is repaired by full-scope preparation, although the model
    # reconstruction itself only reports the first page as dirty.
    pages[3][0]["translation_unit_member_ids"] = ["p004-b000"]
    paths = {index: tmp_path / f"page-{index}.json" for index in pages}
    paths[99] = tmp_path / "outside-selection.json"
    paths[99].write_text("outside selection", encoding="utf-8")
    save_pages(pages, paths)
    unchanged_bytes = paths[4].read_bytes()
    before_unchanged = deepcopy(pages[4])
    writes = []

    def reconstruct(payloads, **kwargs):
        payloads[2][0]["translated_text"] = "已修复"
        return {"garbled_reconstructed": 1, "garbled_candidates": 1, "dirty_pages": [2]}

    def persist(payloads, translation_paths, page_indices):
        writes.append(set(page_indices))
        save_pages(payloads, translation_paths, page_indices)

    monkeypatch.setattr(repair, "_garbled_reconstruction_enabled", lambda: True)
    monkeypatch.setattr(repair, "_garbled_reconstruction_runtime", lambda **kwargs: object())
    monkeypatch.setattr(repair, "reconstruct_garbled_page_payloads", reconstruct)
    monkeypatch.setattr(repair, "save_pages", persist)
    repair.run_garbled_reconstruction_stage(
        page_payloads=pages, translation_paths=paths, api_key="",
        model="offline", base_url="https://example.invalid", workers=1,
        run_diagnostics=None,
    )

    assert writes == [{2, 3}]
    assert json.loads(paths[2].read_text(encoding="utf-8")) == pages[2]
    assert json.loads(paths[3].read_text(encoding="utf-8")) == pages[3]
    assert pages[3][0]["translation_unit_member_ids"] == ["p003-b000", "p004-b000"]
    assert pages[4] == before_unchanged
    assert paths[4].read_bytes() == unchanged_bytes
    assert paths[99].read_text(encoding="utf-8") == "outside selection"


def test_garbled_stage_group_change_propagates_from_clean_dirty_page_to_peer(tmp_path, monkeypatch):
    pages = _pages()
    # Begin with consistent, already persisted metadata: no preexisting repair
    # is needed on the peer. The reconstruction boundary changes only page 2.
    assert refresh_translation_units_and_collect_changed_pages(pages) == set()
    paths = {index: tmp_path / f"page-{index}.json" for index in pages}
    save_pages(pages, paths)
    before_peer = deepcopy(pages[3])
    before_unchanged = deepcopy(pages[4])
    unchanged_bytes = paths[4].read_bytes()
    writes = []

    def reconstruct(payloads, **kwargs):
        payloads[2][0]["continuation_group"] = "reconstructed-separate-paragraph"
        payloads[2][0]["translated_text"] = "独立段落的修复译文"
        assert payloads[3] == before_peer
        return {"garbled_reconstructed": 1, "garbled_candidates": 1, "dirty_pages": [2]}

    def persist(payloads, translation_paths, page_indices):
        writes.append(set(page_indices))
        save_pages(payloads, translation_paths, page_indices)

    monkeypatch.setattr(repair, "_garbled_reconstruction_enabled", lambda: True)
    monkeypatch.setattr(repair, "_garbled_reconstruction_runtime", lambda **kwargs: object())
    monkeypatch.setattr(repair, "reconstruct_garbled_page_payloads", reconstruct)
    monkeypatch.setattr(repair, "save_pages", persist)
    repair.run_garbled_reconstruction_stage(
        page_payloads=pages, translation_paths=paths, api_key="",
        model="offline", base_url="https://example.invalid", workers=1,
        run_diagnostics=None,
    )

    assert writes == [{2, 3}]
    assert before_peer[0]["translation_unit_kind"] == "group"
    assert pages[3][0]["translation_unit_kind"] == "single"
    assert pages[3][0]["translation_unit_member_ids"] == ["p004-b000"]
    assert pages[3] != before_peer
    assert json.loads(paths[3].read_text(encoding="utf-8")) == pages[3]
    assert json.loads(paths[2].read_text(encoding="utf-8")) == pages[2]
    assert pages[4] == before_unchanged
    assert paths[4].read_bytes() == unchanged_bytes
    assert refresh_translation_units_and_collect_changed_pages(pages) == set()


def test_garbled_stage_without_dirty_pages_does_not_prepare_or_write(monkeypatch):
    pages = _pages()
    before = deepcopy(pages)
    monkeypatch.setattr(repair, "_garbled_reconstruction_enabled", lambda: True)
    monkeypatch.setattr(repair, "_garbled_reconstruction_runtime", lambda **kwargs: object())
    monkeypatch.setattr(repair, "reconstruct_garbled_page_payloads", lambda *args, **kwargs: {
        "garbled_reconstructed": 0, "garbled_candidates": 0, "dirty_pages": [],
    })

    def unexpected(*args, **kwargs):
        raise AssertionError("clean repair must not prepare or persist pages")

    monkeypatch.setattr(repair, "refresh_translation_units_and_collect_changed_pages", unexpected)
    monkeypatch.setattr(repair, "save_pages", unexpected)
    repair.run_garbled_reconstruction_stage(
        page_payloads=pages, translation_paths={}, api_key="",
        model="offline", base_url="https://example.invalid", workers=1,
        run_diagnostics=None,
    )
    assert pages == before
