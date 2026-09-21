from __future__ import annotations

import hashlib
import importlib.util
import json
from copy import deepcopy
from pathlib import Path

import pytest

from retainpdf_pipeline.ocr.document_schema.adapters import (
    adapt_path_to_document_v1_with_report,
)


def _load_repair():
    spec = importlib.util.spec_from_file_location(
        "repair_mineru_cross_page_fixture",
        Path(__file__).parents[2] / "repair_mineru_cross_page.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def create_repair_fixture(source: Path) -> tuple[dict, dict]:
    def line(text: str, y: int, *, cross_page: bool = False) -> dict:
        bbox = [100, y, 500, y + 10]
        return {
            "bbox": bbox,
            "spans": [{
                "type": "text", "content": text, "bbox": bbox, "score": 1,
                **({"cross_page": True} if cross_page else {}),
            }],
        }

    tail = {
        "type": "text", "index": 3, "bbox": [98, 285, 502, 312],
        "lines": [line("bias belongs on the next physical page.", 287)],
    }
    raw = {
        "_version_name": "3.4.4",
        "pdf_info": [
            {
                "page_size": [612, 792], "preproc_blocks": [],
                "para_blocks": [{
                    "type": "text", "index": 12, "bbox": [98, 693, 502, 707],
                    "lines": [
                        line("Our experiments indicate that inductive", 695),
                        line(tail["lines"][0]["spans"][0]["content"], 287, cross_page=True),
                    ],
                }],
            },
            {
                "page_size": [700, 900], "preproc_blocks": [tail],
                "para_blocks": [{**deepcopy(tail), "lines": [], "lines_deleted": True}],
            },
        ],
    }
    layout = source / "ocr/unpacked/layout.json"
    _write_json(layout, raw)
    new, report = adapt_path_to_document_v1_with_report(
        source_json_path=layout, document_id="offline-recovery-fixture",
        provider="mineru", provider_version="3.4.4",
    )
    old = deepcopy(new)
    moved = old["pages"][1]["blocks"].pop()
    moved.update(block_id="p001-b0001", page_index=0, order=1, bbox=[98, 710, 502, 737])
    moved["source"]["raw_path"] = "/pdf_info/0/para_blocks/0"
    moved["source"]["raw_page_index"] = 0
    moved["metadata"] = {"historical_marker": "preserve this metadata"}
    old["pages"][0]["blocks"].append(moved)
    _write_json(source / "ocr/normalized/document.v1.json", old)
    _write_json(source / "ocr/normalized/document.v1.report.json", {"historical": True})

    items = []
    for index, block in enumerate(old["pages"][0]["blocks"]):
        item_id = f"p001-b{index:03d}"
        items.append({
            "item_id": item_id, "block_id": block["block_id"],
            "page_idx": 0, "page_index": 0, "page_number": 1,
            "block_idx": index, "reading_order": index,
            "bbox": block["bbox"], "metadata": deepcopy(block["metadata"]),
            "source_text": block["text"], "protected_source_text": block["text"],
            "translated_text": ["实验表明这种归纳", "偏置应在第二页。文字 p001-b001 保持不变"][index],
            "block_kind": "text", "layout_role": "paragraph",
            "semantic_role": "body", "structure_role": "body",
            "should_translate": True, "policy_translate": True,
            "translation_unit_kind": "single", "translation_unit_id": item_id,
            "translation_unit_member_ids": [item_id],
            "translation_diagnostics": {"item_id": item_id, "page_idx": 0},
        })
    _write_json(source / "translated/page-001.json", items)
    _write_json(source / "translated/page-002.json", [])
    _write_json(source / "translated/translation-manifest.json", {
        "schema": "translation_manifest_v1", "schema_version": 1, "status": "complete",
        "pages": [
            {"page_index": 0, "page_number": 1, "path": "page-001.json"},
            {"page_index": 1, "page_number": 2, "path": "page-002.json"},
        ],
        "summary": {"item_ids": ["p001-b000", "p001-b001"]},
    })
    _write_json(source / "translated/translation-checkpoint.v1.json", {
        "schema": "translation_checkpoint_v1", "schema_version": 1,
        "status": "complete", "phase": "committed", "generation": 7,
        "attempt_id": "original-attempt", "created_at": "2026-09-14T00:00:00Z",
        "updated_at": "2026-09-14T01:00:00Z", "parameters_sha256": "a" * 64,
        "normalized_document_sha256": "b" * 64, "fingerprint": "c" * 64,
        "pages": [], "progress": {},
        "committed_pages": [{"page_index": 0}],
        "committed_pages_event": {"producer_generation": 7, "committed_pages": [{"page_index": 0}]},
        "final_manifest": "translation-manifest.json",
    })
    for name in ("translation_debug_index", "translation_review", "translation_diagnostics"):
        _write_json(source / f"artifacts/{name}.json", {
            "p001-b001": {
                "item_id": "p001-b001", "block_id": "p001-b0001",
                "page_idx": 0, "page_index": 0, "page_number": 1,
                "block_idx": 1, "reading_order": 1,
                "members": ["p001-b001"], "message": "literal p001-b001 text",
            },
        })
    _write_json(source / "translated/.translation-checkpoints/generation-7/page-001.json", items)
    (source / "artifacts/unchanged.dat").write_bytes(b"original binary artifact\x00\xff")
    return new, report


def snapshot_files(directory: Path) -> dict[str, bytes]:
    return {
        path.relative_to(directory).as_posix(): path.read_bytes()
        for path in directory.rglob("*") if path.is_file()
    }


def stable_output_hashes(directory: Path, source: Path) -> dict[str, str]:
    # The original operation records the source path in document provenance,
    # and its serialized-byte hash in the checkpoint. Normalize both transitively.
    files = snapshot_files(directory)
    source_name = str(source.resolve()).encode()
    normalized_doc = files["ocr/normalized/document.v1.json"].replace(source_name, b"<SOURCE>")
    doc_hash = hashlib.sha256(normalized_doc).hexdigest()
    result = {}
    for relative, content in files.items():
        content = content.replace(source_name, b"<SOURCE>")
        if relative == "translated/translation-checkpoint.v1.json":
            checkpoint = json.loads(content)
            checkpoint["normalized_document_sha256"] = doc_hash
            identity = {key: checkpoint[key] for key in ("normalized_document_sha256", "parameters_sha256")}
            checkpoint["fingerprint"] = hashlib.sha256(json.dumps(
                identity, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
            ).encode()).hexdigest()
            content = json.dumps(checkpoint, ensure_ascii=False, indent=2).encode()
        result[relative] = hashlib.sha256(content).hexdigest()
    return result


@pytest.fixture(autouse=True)
def _offline_only(monkeypatch):
    def deny_network(*args, **kwargs):
        pytest.fail("Offline recovery must not connect to a provider")

    monkeypatch.setattr("socket.socket.connect", deny_network)
    monkeypatch.setattr("retainpdf_pipeline.translate.workflow.checkpoint.contract.now_iso", lambda: "2026-09-14T02:00:00Z")


def test_repair_matches_frozen_pre_refactor_output_and_preserves_source(tmp_path: Path) -> None:
    source, output = tmp_path / "source", tmp_path / "repaired"
    new, report = create_repair_fixture(source)
    before = snapshot_files(source)
    result = _load_repair().prepare_repaired_job(source, output)
    # Captured by executing the original devtools implementation BEFORE this
    # boundary refactor; timestamps/source path are normalized, not omitted.
    baseline = _read_json(Path(__file__).parent / "fixtures/offline_recovery_legacy_hashes.json")
    assert result == baseline["result"]
    assert stable_output_hashes(output, source) == baseline["hashes"]
    assert snapshot_files(source) == before
    assert _read_json(output / "ocr/normalized/document.v1.json") == new
    assert _read_json(output / "ocr/normalized/document.v1.report.json") == report

    pages = [_read_json(output / f"translated/page-{index:03d}.json") for index in (1, 2)]
    original_items = json.loads(before["translated/page-001.json"])
    for index, items in enumerate(pages):
        assert len(items) == 1
        item = items[0]
        target = new["pages"][index]["blocks"][0]
        assert (item["source_text"], item["translated_text"]) == (
            original_items[index]["source_text"], original_items[index]["translated_text"],
        )
        assert item["bbox"] == target["bbox"]
        assert item["block_id"] == target["block_id"]
        assert item["page_idx"] == item["page_index"] == index
        assert item["page_number"] == index + 1
        assert item["block_idx"] == item["reading_order"] == 0
        assert item["translation_unit_member_ids"] == [item["item_id"]]
        assert item["translation_diagnostics"] == {"item_id": item["item_id"], "page_idx": index}
    assert pages[1][0]["metadata"]["historical_marker"] == "preserve this metadata"
    assert "文字 p001-b001 保持不变" in pages[1][0]["translated_text"]
    for name in ("translation_debug_index", "translation_review", "translation_diagnostics"):
        diagnostics = _read_json(output / f"artifacts/{name}.json")
        assert set(diagnostics) == {"p002-b000"}
        assert diagnostics["p002-b000"] == {
            "item_id": "p002-b000", "block_id": "p002-b0000",
            "page_idx": 1, "page_index": 1, "page_number": 2,
            "block_idx": 0, "reading_order": 0,
            "members": ["p002-b000"], "message": "literal p001-b001 text",
        }

    checkpoint = _read_json(output / "translated/translation-checkpoint.v1.json")
    assert checkpoint["status"] == "complete"
    assert checkpoint["phase"] == "committed"
    assert checkpoint["generation"] == 8
    assert checkpoint["parameters_sha256"] == "a" * 64
    assert checkpoint["normalized_document_sha256"] == hashlib.sha256(
        (output / "ocr/normalized/document.v1.json").read_bytes(),
    ).hexdigest()
    identity = {key: checkpoint[key] for key in ("normalized_document_sha256", "parameters_sha256")}
    assert checkpoint["fingerprint"] == hashlib.sha256(json.dumps(
        identity, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    ).encode()).hexdigest()
    assert checkpoint["progress"] == {
        "item_count": 2, "completed_item_count": 2, "pending_item_count": 0,
        "blocking_item_count": 0, "translated_item_count": 2,
    }
    assert checkpoint["committed_pages"] == []
    assert checkpoint["committed_pages_event"] == {
        "producer_generation": 8, "committed_pages": [], "progress": checkpoint["progress"],
    }
    assert checkpoint["last_committed_unit"]["unit_key"] == "p002-b000"
    for page in checkpoint["pages"]:
        payload_bytes = (output / "translated" / page["path"]).read_bytes()
        assert page["page_hash"] == hashlib.sha256(payload_bytes).hexdigest()
        assert page["snapshot_path"].startswith(".translation-checkpoints/generation-8/")
        assert (output / "translated" / page["snapshot_path"]).read_bytes() == payload_bytes
        assert len(page["item_fingerprints"]) == 1
    historical = "translated/.translation-checkpoints/generation-7/page-001.json"
    assert (output / historical).read_bytes() == before[historical]


@pytest.mark.parametrize("failure", [
    "incomplete_checkpoint", "unknown_phase", "missing_identity", "broken_diagnostics",
    "grouped_unit", "missing_translation", "missing_destination_page", "duplicate_item",
    "unsupported_page_name",
])
def test_invalid_recovery_inputs_fail_before_copy(tmp_path: Path, failure: str) -> None:
    source, output = tmp_path / "source", tmp_path / "repaired"
    create_repair_fixture(source)
    checkpoint_path = source / "translated/translation-checkpoint.v1.json"
    if failure in {"incomplete_checkpoint", "unknown_phase", "missing_identity"}:
        checkpoint = _read_json(checkpoint_path)
        if failure == "incomplete_checkpoint":
            checkpoint["status"] = "in_progress"
        elif failure == "unknown_phase":
            checkpoint["phase"] = "unknown"
        else:
            checkpoint.pop("parameters_sha256")
        _write_json(checkpoint_path, checkpoint)
    elif failure == "broken_diagnostics":
        (source / "artifacts/translation_review.json").write_text("broken JSON", encoding="utf-8")
    elif failure in {"missing_destination_page", "unsupported_page_name"}:
        path = source / "translated/translation-manifest.json"
        manifest = _read_json(path)
        if failure == "missing_destination_page":
            manifest["pages"].pop()
        else:
            # Manifest loading itself allows this name; the existing checkpoint
            # snapshot contract has always required flat page-*.json filenames.
            manifest["pages"][0]["path"] = "custom.json"
            (source / "translated/page-001.json").rename(source / "translated/custom.json")
        _write_json(path, manifest)
    else:
        path = source / "translated/page-001.json"
        items = _read_json(path)
        if failure == "grouped_unit":
            items[-1]["translation_unit_kind"] = "group"
        elif failure == "duplicate_item":
            items.append(deepcopy(items[-1]))
        else:
            items.pop()
        _write_json(path, items)
    before = snapshot_files(source)
    with pytest.raises((ValueError, RuntimeError)):
        _load_repair().prepare_repaired_job(source, output)
    assert not output.exists()
    assert snapshot_files(source) == before


@pytest.mark.parametrize("failure", ["missing_mapping", "wrong_target", "wrong_document", "zero_moves"])
def test_public_recovery_validates_normalized_relocation_contract(tmp_path: Path, failure: str) -> None:
    from retainpdf_pipeline.translate.public import prepare_relocated_translation_copy

    source, output = tmp_path / "source", tmp_path / "repaired"
    new, report = create_repair_fixture(source)
    old = _read_json(source / "ocr/normalized/document.v1.json")
    mapping = _load_repair().build_block_mapping(old, new)
    expected = 1
    if failure == "missing_mapping":
        mapping.pop("p001-b0001")
    elif failure == "wrong_target":
        mapping = deepcopy(mapping)
        mapping["p001-b0001"]["bbox"] = [1, 2, 3, 4]
    elif failure == "wrong_document":
        new["document_id"] = "another-document"
    else:
        expected = 0
    before = snapshot_files(source)
    with pytest.raises(ValueError):
        prepare_relocated_translation_copy(
            source=source, output=output, normalized_document=new,
            normalization_report=report, block_mapping=mapping,
            expected_relocated_count=expected,
        )
    assert not output.exists()
    assert snapshot_files(source) == before
