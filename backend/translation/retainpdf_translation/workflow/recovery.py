"""Offline relocation of completed translations into a new, unpublished job copy.

The caller owns OCR recovery and supplies a normalized document plus a proven
old-block-to-new-block mapping. This operation owns translation references and
durable checkpoint identity; it never calls a translation/OCR provider or
publishes the copy to the database.
"""

from __future__ import annotations

import json
import shutil
from copy import deepcopy
from pathlib import Path

from retainpdf_base.io import save_json_atomic
from retainpdf_translation.core.orchestration.zones import (
    annotate_payload_layout_zones,
)
from retainpdf_translation.core.payload.manifest import (
    load_translation_manifest,
)
from retainpdf_translation.workflow.checkpoint.contract import (
    CHECKPOINT_PHASES,
    advance_checkpoint,
    project_progress,
    validate_checkpoint,
)
from retainpdf_translation.workflow.checkpoint.identity import (
    build_document_identity,
)
from retainpdf_translation.workflow.checkpoint.store import CheckpointStore


def _item_id(block: dict) -> str:
    return f"p{block['page_index'] + 1:03d}-b{block['order']:03d}"


def _remap_references(value, ids: dict[str, str], targets: dict[str, dict]):
    if isinstance(value, str):
        return ids.get(value, value)
    if isinstance(value, list):
        return [_remap_references(item, ids, targets) for item in value]
    if not isinstance(value, dict):
        return value
    result = {
        ids.get(key, key): _remap_references(item, ids, targets)
        for key, item in value.items()
    }
    target = targets.get(value.get("item_id", ""))
    if target:
        for key, updated in (
            ("page_idx", target["page_index"]),
            ("page_index", target["page_index"]),
            ("page_number", target["page_index"] + 1),
            ("block_idx", target["order"]),
            ("reading_order", target["order"]),
        ):
            if key in result:
                result[key] = updated
    return result


def _relocation_targets(old: dict, new: dict, mapping: dict[str, dict]) -> dict[str, dict]:
    old_blocks = {
        block["block_id"]: block for page in old["pages"] for block in page["blocks"]
    }
    new_blocks = {
        block["block_id"]: block for page in new["pages"] for block in page["blocks"]
    }
    if old["document_id"] != new["document_id"] or set(mapping) != set(old_blocks):
        raise ValueError("Relocation mapping must cover the original document")
    target_ids = {block["block_id"] for block in mapping.values()}
    if len(mapping) != len(new_blocks) or target_ids != set(new_blocks):
        raise ValueError(
            "Relocation mapping must be one-to-one and cover the recovered document"
        )
    for block_id, target in mapping.items():
        if (
            target != new_blocks[target["block_id"]]
            or target["text"] != old_blocks[block_id]["text"]
        ):
            raise ValueError(
                "Relocation mapping must preserve source text and target geometry"
            )
    return {_item_id(block): mapping[block_id] for block_id, block in old_blocks.items()}


def prepare_relocated_translation_copy(
    *,
    source: Path,
    output: Path,
    normalized_document: dict,
    normalization_report: dict,
    block_mapping: dict[str, dict],
    expected_relocated_count: int,
) -> dict:
    """Reuse completed translation text after OCR block relocation, without publishing.

    ``block_mapping`` maps every original document block ID to its unchanged-text
    block in ``normalized_document``. Only single translation units may move
    between pages. Output must be a new separate directory; source bytes and
    historical checkpoint snapshots are never changed.
    """
    source, output = Path(source).resolve(), Path(output).resolve()
    if output.exists() or output.is_relative_to(source) or source.is_relative_to(output):
        raise ValueError("Output must be a new, separate job directory")
    if expected_relocated_count <= 0:
        raise ValueError("Recovery must relocate at least one block")
    old = json.loads(
        (source / "ocr/normalized/document.v1.json").read_text(encoding="utf-8")
    )
    targets = _relocation_targets(old, normalized_document, block_mapping)
    ids = {key: _item_id(block) for key, block in targets.items()}
    ids.update({key: block["block_id"] for key, block in block_mapping.items()})
    old_paths = load_translation_manifest(source / "translated")
    paths = {page: output / "translated" / path.name for page, path in old_paths.items()}
    for path in old_paths.values():
        if (
            path.parent.resolve() != (source / "translated").resolve()
            or not path.name.startswith("page-")
            or not path.name.endswith(".json")
        ):
            raise ValueError("Offline recovery requires direct page payload paths")
    payloads = {page: [] for page in old_paths}
    moved = []
    seen_items: set[str] = set()
    for old_page, path in old_paths.items():
        for item in json.loads(path.read_text(encoding="utf-8")):
            item_id = item["item_id"]
            if item_id in seen_items:
                raise ValueError("A translation item occurs more than once")
            seen_items.add(item_id)
            target = targets[item_id]
            if target["page_index"] not in payloads:
                raise ValueError(
                    "Recovered page falls outside the existing translation manifest"
                )
            updated = _remap_references(item, ids, targets)
            updated["bbox"] = deepcopy(target["bbox"])
            if old_page != target["page_index"]:
                if item.get("translation_unit_kind") != "single":
                    raise ValueError(
                        "Cannot relocate a grouped translation without rebuilding its group"
                    )
                updated["metadata"].update(target["metadata"])
                moved.append(
                    {
                        "old_item_id": item_id,
                        "new_item_id": updated["item_id"],
                        "from_page": old_page + 1,
                        "to_page": target["page_index"] + 1,
                    }
                )
            if (item["source_text"], item["translated_text"]) != (
                updated["source_text"], updated["translated_text"]
            ):
                raise ValueError("Recovery must preserve source and translated text exactly")
            payloads[target["page_index"]].append(updated)
    if len(moved) != expected_relocated_count:
        raise ValueError("Not every recovered block has a reusable translation")
    for items in payloads.values():
        items.sort(key=lambda item: item["block_idx"])
        annotate_payload_layout_zones(items)

    # Parse every existing translation-owned reference and checkpoint before
    # creating a copy, so malformed/incomplete inputs do not leave partial jobs.
    references = {}
    for relative in (
        "translated/translation-manifest.json",
        "artifacts/translation_debug_index.json",
        "artifacts/translation_review.json",
        "artifacts/translation_diagnostics.json",
    ):
        path = source / relative
        if path.is_file():
            references[relative] = _remap_references(
                json.loads(path.read_text(encoding="utf-8")), ids, targets
            )
    original_checkpoint_path = source / "translated/translation-checkpoint.v1.json"
    checkpoint = validate_checkpoint(
        json.loads(original_checkpoint_path.read_text(encoding="utf-8")),
        path=original_checkpoint_path,
    )
    if checkpoint["status"] != "complete":
        raise ValueError("Only completed checkpoints can be repaired offline")
    if checkpoint.get("phase") not in CHECKPOINT_PHASES:
        raise ValueError("Unknown translation checkpoint phase")
    if not isinstance(checkpoint.get("generation"), int) or not isinstance(
        checkpoint.get("parameters_sha256"), str
    ):
        raise ValueError("Translation checkpoint is missing its durable identity")

    shutil.copytree(source, output)
    save_json_atomic(output / "ocr/normalized/document.v1.json", normalized_document)
    save_json_atomic(output / "ocr/normalized/document.v1.report.json", normalization_report)
    for page, items in payloads.items():
        save_json_atomic(paths[page], items)
    for relative, payload in references.items():
        save_json_atomic(output / relative, payload)
    pages, progress = project_progress(
        output_dir=output / "translated",
        page_payloads=payloads,
        translation_paths=paths,
    )
    checkpoint = advance_checkpoint(
        checkpoint, phase="committed", pages=pages, progress=progress
    )
    checkpoint["status"] = "complete"
    checkpoint["generation"] += 1
    checkpoint.update(
        build_document_identity(
            normalized_document_path=output / "ocr/normalized/document.v1.json",
            parameters_sha256=checkpoint["parameters_sha256"],
        )
    )
    checkpoint["committed_pages"] = []
    checkpoint["committed_pages_event"] = {
        **checkpoint.get("committed_pages_event", {}),
        "producer_generation": checkpoint["generation"],
        "committed_pages": [],
        "progress": progress,
    }
    store = CheckpointStore(output / "translated/translation-checkpoint.v1.json")
    store.acquire()
    try:
        store.snapshot_pages(checkpoint)
        store.save(checkpoint)
    finally:
        store.close()
    return {
        "job_id": old["document_id"],
        "block_count": len(block_mapping),
        "reused_translation_count": len(seen_items),
        "moves": moved,
        "producer_generation": checkpoint["generation"],
        "provider_calls": 0,
    }
