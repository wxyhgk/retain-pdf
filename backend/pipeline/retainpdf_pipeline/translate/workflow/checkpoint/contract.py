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
from retainpdf_pipeline.translate.artifacts import (
    has_translation_artifact,
    is_blocking_untranslated,
    item_final_status,
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


def _is_settled_non_blocking(unit: dict[str, Any], flat_payload: list[dict]) -> bool:
    """这个待办单元是不是「已经尘埃落定、且不阻断导出」。

    分组单元按成员判定:只要还有**任何一个**成员是阻断性未翻译,整组仍算待办。
    """
    member_ids = {
        str(item_id or "")
        for item_id in unit.get("translation_unit_member_ids", [])
        if str(item_id or "")
    }
    if len(member_ids) > 1:
        members = [
            item for item in flat_payload
            if str(item.get("item_id", "") or "") in member_ids
        ]
        if not members:
            return False
        return all(not _item_blocks(item) for item in members)
    return not _item_blocks(unit)


def _item_blocks(item: dict[str, Any]) -> bool:
    diagnostics = dict(item.get("translation_diagnostics") or {})
    # 先问「跑完了吗」,再问「阻不阻断」。两件事不能合并:
    # is_blocking_untranslated 回答的是「最终会不会挡住导出」,而一个**还没尝试过**
    # 的块 final_status 是空的,它一路走到函数末尾 return False —— 不阻断,但它
    # 当然还是待办。只看 blocking 会把半途的 checkpoint 里所有未翻块算成已完成,
    # 续跑就再也捞不回来了。
    if not item_final_status(item, diagnostics):
        return True
    return is_blocking_untranslated(item, diagnostics)


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
    # 两个集合，两个问题，别再让一个数同时回答。
    #
    # pending_ids 是**工作队列**的口径:只问"该翻吗、有译文吗"。死信(重试与两轮
    # 补救都用尽、保留原文并隔离)照样算待办 —— 这是对的，重翻正是靠它把死信捞
    # 回来，整份 checkpoint 的续跑也靠它。这个口径不能动。
    #
    # blocking_ids 是**提交门禁**的口径:问"这份文档还能不能收尾"。
    # artifacts/status.py 早就定了死信不阻断导出(ALLOWED_UNTRANSLATED_REASONS
    # 里有 dead_letter_queue，理由写在那里:一个块救不回来，不值得让同一份文档里
    # 其余上百个已成功的块一起作废)。此前这里没有第二个数，
    # assert_checkpoint_committable 只能拿 pending 凑合，于是 blocking_after=0
    # 放行了导出，pending_item_count 却还是 2，validating 当场抛 —— 重翻也卡在
    # 同样那几块。
    #
    # 复用 is_blocking_untranslated 而不是再写一份死信判定:它是这件事的唯一真相源。
    pending_ids: set[str] = set()
    blocking_ids: set[str] = set()
    for unit in pending_translation_items(flat_payload):
        member_ids = [
            str(item_id or "")
            for item_id in unit.get("translation_unit_member_ids", [])
            if str(item_id or "")
        ]
        unit_ids = (
            set(member_ids)
            if len(member_ids) > 1
            else {str(unit.get("item_id", "") or "")} - {""}
        )
        pending_ids.update(unit_ids)
        if not _is_settled_non_blocking(unit, flat_payload):
            blocking_ids.update(unit_ids)
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
    translated_total = sum(
        1 for item in flat_payload if has_translation_artifact(item)
    )
    return pages, {
        "item_count": item_total,
        "completed_item_count": completed_total,
        "pending_item_count": max(0, item_total - completed_total),
        # 待办里**真正挡住收尾**的那部分。死信不在其中；从没尝试过的块在。
        "blocking_item_count": len(blocking_ids),
        # 真的产出了译文的块数。没有它，「死信不阻断」会把一份 0 成功的文档
        # 也一路放行成 complete。
        "translated_item_count": translated_total,
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


def assert_checkpoint_committable(payload: dict[str, Any]) -> None:
    """提交的两条前置条件。单独暴露，是为了能在**发布 manifest 之前**先问一次。

    manifest 一旦落盘就带着 status="complete"，而 load_translated_pages 只认它；
    先写盘再在这里失败，会把一份「0 个块翻译成功」的文档留在输出目录里冒充完整
    结果。所以调用方必须先过这道门，再发布。
    """
    if payload.get("phase") != "validating":
        raise RuntimeError("Translation checkpoint can only commit after validation")
    progress = payload.get("progress") or {}
    pending = int(progress.get("pending_item_count", -1))
    if "blocking_item_count" not in progress:
        # 旧 checkpoint 没有分开的计数，只能退回原来那条更严的判断。
        if pending != 0:
            raise RuntimeError("Translation checkpoint cannot commit with pending items")
        return
    if int(progress.get("blocking_item_count", -1)) != 0:
        raise RuntimeError("Translation checkpoint cannot commit with pending items")
    # 死信可以放行，「一个都没译成」不行。pending>0 说明确实有块该翻而没翻成，
    # translated==0 说明整份文档一点译文都没产出 —— 这种东西冒充 complete 落盘，
    # load_translated_pages 会照单全收。
    if pending > 0 and int(progress.get("translated_item_count", 0)) == 0:
        raise RuntimeError(
            "Translation checkpoint cannot commit a document with zero translated items"
        )


def commit_checkpoint(payload: dict[str, Any], *, manifest_name: str) -> dict[str, Any]:
    assert_checkpoint_committable(payload)
    payload.update(
        {
            "status": "complete",
            "phase": "committed",
            "updated_at": now_iso(),
            "final_manifest": manifest_name,
        }
    )
    return payload
