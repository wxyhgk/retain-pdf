"""Reader publication boundary: committed bytes only, with legacy compatibility."""
from __future__ import annotations

import hashlib
import json

import pytest

from retainpdf_pipeline.render import translation_loader as reader
from retainpdf_pipeline.render.source.translation_manifest import REQUIRED_CONTRACT_FIELDS


def publication(tmp_path, *, checkpoint=True):
    item = {field: "" for field in REQUIRED_CONTRACT_FIELDS}
    item.update(item_id="p001-b000", source_text="Source", translated_text="译文")
    page = tmp_path / "page-001.json"
    page.write_text(json.dumps([item]), encoding="utf-8")
    manifest = tmp_path / "translation-manifest.json"
    manifest.write_text(json.dumps({"schema": "translation_manifest_v1", "status": "complete",
                                   "pages": [{"page_index": 0, "path": page.name}]}))
    payload = {"schema": "translation_checkpoint_v1", "schema_version": 1,
               "status": "complete", "phase": "committed", "generation": 5,
               "progress": {"pending_item_count": 0}, "final_manifest": manifest.name,
               "pages": [{"page_index": 0, "path": page.name,
                          "page_hash": hashlib.sha256(page.read_bytes()).hexdigest()}]}
    marker = tmp_path / "translation-checkpoint.v1.json"
    if checkpoint:
        marker.write_text(json.dumps(payload))
    return page, manifest, marker, payload


@pytest.mark.parametrize("checkpoint", [True, False])
def test_committed_and_historical_publications_remain_readable(tmp_path, checkpoint):
    publication(tmp_path, checkpoint=checkpoint)
    assert reader.load_translated_pages(tmp_path)[0][0]["translated_text"] == "译文"


@pytest.mark.parametrize("mutation", ["in_progress", "pending", "wrong_manifest", "wrong_path",
                                       "missing_page", "duplicate_page", "no_hash", "bad_schema"])
def test_checkpoint_and_manifest_must_describe_same_commit(tmp_path, mutation):
    _, manifest, marker, payload = publication(tmp_path)
    if mutation == "in_progress":
        payload.update(status="in_progress", phase="preparing")
    elif mutation == "pending":
        payload["progress"]["pending_item_count"] = 1
    elif mutation == "wrong_manifest":
        payload["final_manifest"] = "other.json"
    elif mutation == "wrong_path":
        payload["pages"][0]["path"] = "other.json"
    elif mutation == "missing_page":
        payload["pages"] = []
    elif mutation == "duplicate_page":
        payload["pages"] *= 2
    elif mutation == "no_hash":
        payload["pages"][0].pop("page_hash")
    elif mutation == "bad_schema":
        payload["schema_version"] = 2
    marker.write_text(json.dumps(payload))
    with pytest.raises(RuntimeError, match="not committed or consistent"):
        reader.load_translated_pages(tmp_path)
    assert manifest.exists(), "Reject reading without deleting the previous output"


def test_changed_page_bytes_cannot_reuse_complete_manifest(tmp_path):
    page, _, _, _ = publication(tmp_path)
    page.write_text(page.read_text() + "\n")
    with pytest.raises(RuntimeError, match="hash mismatch"):
        reader.load_translated_pages(tmp_path)


@pytest.mark.parametrize("change", ["checkpoint", "manifest", "checkpoint_created"])
def test_publication_change_during_read_is_rejected(tmp_path, monkeypatch, change):
    _, manifest, marker, payload = publication(tmp_path, checkpoint=change != "checkpoint_created")
    original = reader.load_translations

    def load_then_change(path, **kwargs):
        result = original(path, **kwargs)
        if change == "manifest":
            manifest.write_text(manifest.read_text() + "\n")
        else:
            payload.update(status="in_progress", phase="preparing", generation=6)
            marker.write_text(json.dumps(payload))
        return result

    monkeypatch.setattr(reader, "load_translations", load_then_change)
    with pytest.raises(RuntimeError, match="changed while reading"):
        reader.load_translated_pages(tmp_path)
