from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from retainpdf_pipeline.translate.core.payload.parts.units import (
    pending_translation_items,
)
from retainpdf_pipeline.translate.core.payload.parts.fingerprints import (
    translation_item_fingerprint,
)

TRANSLATION_CHECKPOINT_FILE_NAME = "translation-checkpoint.v1.json"
TRANSLATION_CHECKPOINT_SCHEMA = "translation_checkpoint_v1"
TRANSLATION_CHECKPOINT_SCHEMA_VERSION = 1
CHECKPOINT_PHASES = (
    "preparing",
    "policy_ready",
    "translating",
    "repairing",
    "validating",
    "committed",
)


def translation_checkpoint_path(translations_dir: Path) -> Path:
    return Path(translations_dir) / TRANSLATION_CHECKPOINT_FILE_NAME


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def validate_checkpoint(payload: object, *, path: Path) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid translation checkpoint object: {path}")
    if payload.get("schema") != TRANSLATION_CHECKPOINT_SCHEMA:
        raise RuntimeError(f"Unsupported translation checkpoint schema: {path}")
    if payload.get("schema_version") != TRANSLATION_CHECKPOINT_SCHEMA_VERSION:
        raise RuntimeError(f"Unsupported translation checkpoint version: {path}")
    return dict(payload)


def new_checkpoint(
    *,
    identity: dict[str, Any],
    attempt_id: str,
    previous: dict[str, Any] | None = None,
) -> dict[str, Any]:
    timestamp = now_iso()
    payload: dict[str, Any] = {
        "schema": TRANSLATION_CHECKPOINT_SCHEMA,
        "schema_version": TRANSLATION_CHECKPOINT_SCHEMA_VERSION,
        "status": "in_progress",
        "phase": "preparing",
        "attempt_id": attempt_id,
        "created_at": str((previous or {}).get("created_at", "") or timestamp),
        "updated_at": timestamp,
        # Monotonic producer generation. Rust owns the authoritative fencing
        # generation; this value lets it reject/replay worker checkpoint rows
        # deterministically without changing the v1 compatibility envelope.
        "generation": int((previous or {}).get("generation", 0) or 0),
        **identity,
        "pages": list((previous or {}).get("pages", [])),
        "progress": dict((previous or {}).get("progress", {})),
        # Durable stdout outbox. It is replaced on every checkpoint write, so
        # a crash after save and before stdout can replay precisely that write.
        "committed_pages": list((previous or {}).get("committed_pages", [])),
        "final_manifest": None,
    }
    previous_attempt = str((previous or {}).get("attempt_id", "") or "")
    if previous_attempt and previous_attempt != attempt_id:
        payload["resumed_from_attempt_id"] = previous_attempt
    return payload


def project_progress(
    *,
    output_dir: Path,
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    flat_payload = [
        item
        for page_idx in sorted(page_payloads)
        for item in page_payloads[page_idx]
        if isinstance(item, dict)
    ]
    pending_ids: set[str] = set()
    for unit in pending_translation_items(flat_payload):
        member_ids = [
            str(item_id or "")
            for item_id in unit.get("translation_unit_member_ids", [])
            if str(item_id or "")
        ]
        if len(member_ids) > 1:
            pending_ids.update(member_ids)
            continue
        item_id = str(unit.get("item_id", "") or "")
        if item_id:
            pending_ids.add(item_id)
    pages: list[dict[str, Any]] = []
    completed_total = 0
    item_total = 0
    resolved_output_dir = Path(output_dir).resolve()
    unit_order = 0
    for page_idx in sorted(page_payloads):
        items = [item for item in page_payloads[page_idx] if isinstance(item, dict)]
        item_ids = [str(item.get("item_id", "") or "") for item in items]
        pending_page_ids = [item_id for item_id in item_ids if item_id in pending_ids]
        completed = len(item_ids) - len(pending_page_ids)
        completed_total += completed
        item_total += len(item_ids)
        relative_path = (
            Path(translation_paths[page_idx])
            .resolve()
            .relative_to(resolved_output_dir)
            .as_posix()
        )
        page_path = Path(translation_paths[page_idx])
        page_hash = hashlib.sha256(page_path.read_bytes()).hexdigest()
        completed_units: list[dict[str, Any]] = []
        for item_id in item_ids:
            current_order = unit_order
            unit_order += 1
            if item_id and item_id not in pending_ids:
                completed_units.append(
                    {
                        "unit_key": item_id,
                        "unit_order": current_order,
                    }
                )
        pages.append(
            {
                "page_index": page_idx,
                "path": relative_path,
                "item_count": len(item_ids),
                "completed_item_count": completed,
                "pending_item_ids": pending_page_ids,
                "page_hash": page_hash,
                "item_fingerprints": {
                    item_id: translation_item_fingerprint(item)
                    for item_id, item in zip(item_ids, items)
                    if item_id
                },
                "last_committed_unit": completed_units[-1] if completed_units else None,
            }
        )
    return pages, {
        "item_count": item_total,
        "completed_item_count": completed_total,
        "pending_item_count": max(0, item_total - completed_total),
    }


def advance_checkpoint(
    payload: dict[str, Any],
    *,
    phase: str,
    pages: list[dict[str, Any]],
    progress: dict[str, int],
) -> dict[str, Any]:
    current_phase = str(payload.get("phase", "") or "")
    if current_phase not in CHECKPOINT_PHASES or phase not in CHECKPOINT_PHASES:
        raise RuntimeError(f"Unknown translation checkpoint phase: {current_phase}->{phase}")
    if CHECKPOINT_PHASES.index(phase) < CHECKPOINT_PHASES.index(current_phase):
        raise RuntimeError(
            f"Translation checkpoint phase cannot move backwards: {current_phase}->{phase}"
        )
    previous_pending = {
        str(item_id)
        for page in payload.get("pages", [])
        if isinstance(page, dict)
        for item_id in page.get("pending_item_ids", [])
    }
    current_pending = {
        str(item_id)
        for page in pages
        for item_id in page.get("pending_item_ids", [])
    }
    if payload.get("pages"):
        regressed = current_pending - previous_pending
        if regressed:
            preview = ", ".join(sorted(regressed)[:8])
            raise RuntimeError(
                f"Translation checkpoint completed items regressed to pending: {preview}"
            )
    payload.update(
        {
            "status": "in_progress",
            "phase": phase,
            "updated_at": now_iso(),
            "pages": pages,
            "progress": progress,
        }
    )
    committed = [
        {
            **unit,
            "page_index": int(page["page_index"]),
            "page_hash": str(page["page_hash"]),
        }
        for page in pages
        if isinstance(page, dict)
        for unit in [page.get("last_committed_unit")]
        if isinstance(unit, dict)
    ]
    payload["last_committed_unit"] = (
        max(committed, key=lambda item: int(item["unit_order"])) if committed else None
    )
    return payload


def changed_item_ids_by_page(
    previous_pages: list[dict[str, Any]],
    current_pages: list[dict[str, Any]],
    *,
    include_new_items: bool = False,
) -> dict[int, set[str]]:
    previous_by_page = {
        int(page.get("page_index", -1)): page
        for page in previous_pages
        if isinstance(page, dict)
    }
    changed: dict[int, set[str]] = {}
    for page in current_pages:
        if not isinstance(page, dict):
            continue
        page_idx = int(page.get("page_index", -1))
        current = page.get("item_fingerprints")
        if not isinstance(current, dict):
            continue
        previous_page = previous_by_page.get(page_idx, {})
        previous = previous_page.get("item_fingerprints")
        if not isinstance(previous, dict):
            previous = {}
        page_changes = {
            str(item_id)
            for item_id, fingerprint in current.items()
            if str(item_id)
            and (
                (include_new_items and item_id not in previous)
                or (item_id in previous and previous.get(item_id) != fingerprint)
            )
        }
        if page_changes:
            changed[page_idx] = page_changes
    return changed


def committed_pages_for_changes(
    pages: list[dict[str, Any]],
    changed_by_page: dict[int, set[str]],
) -> list[dict[str, Any]]:
    page_by_index = {
        int(page["page_index"]): page
        for page in pages
        if isinstance(page, dict) and "page_index" in page
    }
    committed: list[dict[str, Any]] = []
    for page_idx in sorted(changed_by_page):
        changed_ids = sorted({str(value) for value in changed_by_page[page_idx] if str(value)})
        if not changed_ids:
            continue
        page = page_by_index.get(int(page_idx))
        if page is None:
            raise RuntimeError(f"Changed translation page is missing from checkpoint: {page_idx}")
        fingerprints = page.get("item_fingerprints")
        if not isinstance(fingerprints, dict):
            raise RuntimeError(f"Translation checkpoint page lacks item fingerprints: {page_idx}")
        missing = [item_id for item_id in changed_ids if item_id not in fingerprints]
        if missing:
            preview = ", ".join(missing[:8])
            raise RuntimeError(
                f"Changed translation items are missing from page {page_idx}: {preview}"
            )
        committed.append(
            {
                "unit_key": f"page:{page_idx}",
                "unit_order": int(page_idx),
                "page_index": int(page_idx),
                "page_hash": str(page.get("page_hash", "") or ""),
                "changed_item_ids": changed_ids,
            }
        )
    return committed


def commit_checkpoint(payload: dict[str, Any], *, manifest_name: str) -> dict[str, Any]:
    if payload.get("phase") != "validating":
        raise RuntimeError("Translation checkpoint can only commit after validation")
    if int((payload.get("progress") or {}).get("pending_item_count", -1)) != 0:
        raise RuntimeError("Translation checkpoint cannot commit with pending items")
    payload.update(
        {
            "status": "complete",
            "phase": "committed",
            "updated_at": now_iso(),
            "final_manifest": manifest_name,
        }
    )
    return payload
