"""Shared assertions against persisted translation artifacts and their consumer."""
import json

import pytest

from support.translation_io_support import SOURCES, TRANSLATIONS, read_artifacts


def assert_complete_artifacts(root, expected_pages):
    """Read the actual published pages through the rendering consumer."""
    pages, manifest, checkpoint = read_artifacts(root)
    assert set(pages) == set(expected_pages)
    assert manifest["status"] == checkpoint["status"] == "complete"
    assert checkpoint["phase"] == "committed"
    assert {page["page_index"] for page in manifest["pages"]} == set(expected_pages)
    assert {page["page_index"] for page in checkpoint["pages"]} == set(expected_pages)
    assert len(manifest["pages"]) == len(checkpoint["pages"]) == len(expected_pages)
    total = sum(map(len, expected_pages.values()))
    translated = sum(
        1
        for items in pages.values()
        for item in items
        if str(item.get("translated_text", "") or "").strip()
    )
    assert checkpoint["progress"] == {
        "item_count": total, "completed_item_count": total, "pending_item_count": 0,
        "blocking_item_count": 0, "translated_item_count": translated,
    }
    by_id = {}
    for page_index, expected_ids in expected_pages.items():
        items = pages[page_index]
        assert [item["item_id"] for item in items] == expected_ids
        for item in items:
            identity = item["item_id"]
            assert identity not in by_id
            by_id[identity] = item
            assert item["page_idx"] == page_index
            assert item["source_text"] == SOURCES[identity]
            if identity == "p001-b002":
                assert item["final_status"] == "kept_origin"
                assert item["translated_text"] == ""
                assert not item["should_translate"]
            else:
                assert item["final_status"] == "translated"
                assert item["translated_text"] == TRANSLATIONS[identity]
    for page in checkpoint["pages"]:
        expected_ids = expected_pages[page["page_index"]]
        assert page["item_count"] == page["completed_item_count"] == len(expected_ids)
        assert page["pending_item_ids"] == []
        assert set(page["item_fingerprints"]) == set(expected_ids)
        assert (root / "translated" / page["path"]).is_file()
        assert (root / "translated" / page["snapshot_path"]).is_file()
    assert manifest["unresolved_translation_count"] == 0
    assert manifest["dead_letter_count"] == 0
    assert manifest["status_summary"] == {
        "translated": total - ("p001-b002" in by_id),
        "partially_translated": 0,
        "kept_origin": int("p001-b002" in by_id),
        "failed": 0,
    }
    return by_id


def assert_unpublished(root):
    """Check persisted state, not the probe's reported completion flag."""
    output = root / "translated"
    assert not (output / "translation-manifest.json").exists()
    checkpoint = json.loads((output / "translation-checkpoint.v1.json").read_text())
    assert checkpoint["status"] == "in_progress"
    assert checkpoint["final_manifest"] is None
    from retainpdf_pipeline.render.translation_loader import load_translated_pages
    with pytest.raises(RuntimeError, match="Translation manifest not found"):
        load_translated_pages(output)
