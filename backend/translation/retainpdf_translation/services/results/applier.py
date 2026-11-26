from __future__ import annotations

import retainpdf_translation.llm.result_payload as result_payload
from retainpdf_translation.artifacts.models import FinalStatus
from retainpdf_translation.core.payload.parts.apply import (
    apply_group_translated_entry,
    apply_single_translated_entry,
)
from retainpdf_translation.core.payload.parts.common import (
    effective_translation_unit_id,
    existing_group_unit_id,
    is_group_unit_id,
)
# 只用记忆更新器的协议（底座）；任务记忆本身属于普通翻译引擎，由它把更新器传进来（2026-11-20 拆包）
from retainpdf_translation.services.memory.updater import (
    TranslationMemoryUpdater,
    update_translation_memory,
    update_translation_memory_many,
)
from retainpdf_translation.core.payload.parts.fingerprints import (
    translation_item_fingerprint,
)
from retainpdf_translation.services.results.flush import (
    TranslationFlushState,
)


def _clone_result_for_item(payload: dict[str, str], *, item: dict) -> dict[str, str]:
    cloned = dict(payload)
    diagnostics = dict(cloned.get("translation_diagnostics") or {})
    if diagnostics:
        diagnostics["item_id"] = item.get("item_id", "")
        diagnostics["page_idx"] = item.get("page_idx")
        cloned["translation_diagnostics"] = diagnostics
    return cloned


def expand_duplicate_results(
    translated: dict[str, dict[str, str]],
    *,
    duplicate_items_by_rep_id: dict[str, list[dict]],
) -> dict[str, dict[str, str]]:
    if not duplicate_items_by_rep_id:
        return translated
    expanded = dict(translated)
    for rep_id, duplicate_items in duplicate_items_by_rep_id.items():
        rep_payload = translated.get(rep_id)
        if not rep_payload:
            continue
        if _is_keep_origin_result(rep_payload):
            expanded.update(_kept_origin_duplicate_results(rep_payload, duplicate_items))
            continue
        if not _is_duplicate_expandable_result(rep_payload):
            # 代表块这次没翻成（超时、校验不过、内容审核……）：副本跟代表块同命，记成同样的失败，留在待办里，
            # 尾部重试、最终补救、续跑、「重翻死信」都还会再翻它；同一次运行里代表块后来翻成了，副本也跟着拿到译文。
            # 以前记成「模型判保留原文」（`skip_model_keep_origin`、`should_translate=False`），永远救不回来（2026-11-26，S21）
            expanded.update(_failed_duplicate_results(rep_payload, duplicate_items))
            continue
        for duplicate_item in duplicate_items:
            expanded[str(duplicate_item.get("item_id", "") or "")] = _clone_result_for_item(
                rep_payload,
                item=duplicate_item,
            )
    return expanded


def _is_keep_origin_result(payload: dict[str, str]) -> bool:
    """代表块被判保留原文（模型的 keep_origin 决定，或者策略保留）：同一段原文的副本同样保留。"""
    final_status = str(payload.get("final_status", "") or "").strip()
    if final_status == FinalStatus.FAILED.value:
        return False
    return final_status == FinalStatus.KEPT_ORIGIN.value or str(payload.get("decision", "") or "").strip() == "keep_origin"


def _is_duplicate_expandable_result(payload: dict[str, str]) -> bool:
    final_status = str(payload.get("final_status", "") or "").strip()
    if final_status in {FinalStatus.FAILED.value, FinalStatus.KEPT_ORIGIN.value}:
        return False
    decision = str(payload.get("decision", "") or "").strip()
    if decision == "keep_origin":
        return False
    translated_text = str(
        payload.get("translated_text")
        or payload.get("protected_translated_text")
        or ""
    ).strip()
    if not translated_text:
        return False
    return True


def _failed_duplicate_results(rep_payload: dict[str, str], duplicate_items: list[dict]) -> dict[str, dict[str, str]]:
    """副本照抄代表块的失败结果（改成副本自己的 item_id、页号），轨迹里多记一条「跟着代表块失败」。"""
    failed: dict[str, dict[str, str]] = {}
    for duplicate_item in duplicate_items:
        payload = _clone_result_for_item(rep_payload, item=duplicate_item)
        diagnostics = dict(payload.get("translation_diagnostics") or {})
        error_trace = diagnostics.get("error_trace")
        diagnostics["item_id"] = duplicate_item.get("item_id", "")
        diagnostics["page_idx"] = duplicate_item.get("page_idx")
        diagnostics["error_trace"] = [
            *(error_trace if isinstance(error_trace, list) else []),
            {
                "type": "dedupe",
                "code": "duplicate_representative_failed",
                "message": "Duplicate item shares the failed result of its representative and stays pending for retry.",
            },
        ]
        payload["translation_diagnostics"] = diagnostics
        failed[str(duplicate_item.get("item_id", "") or "")] = payload
    return failed


def _kept_origin_duplicate_results(rep_payload: dict[str, str], duplicate_items: list[dict]) -> dict[str, dict[str, str]]:
    source_diagnostics = dict(rep_payload.get("translation_diagnostics") or {})
    source_reason = str(source_diagnostics.get("degradation_reason", "") or "").strip()
    error_trace = source_diagnostics.get("error_trace")
    if not isinstance(error_trace, list):
        error_trace = []
    reason = source_reason or "duplicate_representative_not_expandable"
    failed: dict[str, dict[str, str]] = {}
    for duplicate_item in duplicate_items:
        item_id = str(duplicate_item.get("item_id", "") or "")
        payload = result_payload.result_entry("keep_origin", "")
        payload["translation_diagnostics"] = {
            "item_id": item_id,
            "page_idx": duplicate_item.get("page_idx"),
            "route_path": ["block_level", "duplicate_dedupe", "fast_path_keep_origin"],
            "error_trace": [
                *error_trace,
                {
                    "type": "dedupe",
                    "code": "duplicate_representative_not_expandable",
                    "message": "Duplicate item was kept as origin because representative translation did not succeed.",
                },
            ],
            "fallback_to": "keep_origin",
            "degradation_reason": reason,
            "final_status": "kept_origin",
        }
        failed[item_id] = payload
    return failed


class TranslationResultApplier:
    def __init__(
        self,
        *,
        flat_payload: list[dict],
        item_to_page: dict[str, int],
        duplicate_items_by_rep_id: dict[str, list[dict]],
        flush_state: TranslationFlushState,
        memory_store: TranslationMemoryUpdater | None,
    ) -> None:
        self.flat_payload = flat_payload
        self.item_to_page = item_to_page
        self.duplicate_items_by_rep_id = duplicate_items_by_rep_id
        self.flush_state = flush_state
        self.memory_store = memory_store
        self.item_by_id: dict[str, dict] = {
            str(item.get("item_id", "") or ""): item
            for item in flat_payload
            if str(item.get("item_id", "") or "")
        }
        self.next_item_by_id: dict[str, dict | None] = {
            str(item.get("item_id", "") or ""): flat_payload[index + 1] if index + 1 < len(flat_payload) else None
            for index, item in enumerate(flat_payload)
            if str(item.get("item_id", "") or "")
        }
        self.group_items_by_unit_id: dict[str, list[dict]] = {}
        self._rebuild_group_index()

    def _rebuild_group_index(self) -> None:
        grouped: dict[str, list[dict]] = {}
        for item in self.flat_payload:
            unit_id = effective_translation_unit_id(item)
            if is_group_unit_id(unit_id):
                grouped.setdefault(unit_id, []).append(item)
        self.group_items_by_unit_id = grouped

    def apply_immediate(self, translated: dict[str, dict[str, str]]) -> set[int]:
        return self.apply_batch([], translated, update_memory=False)

    def apply_batch(
        self,
        batch: list[dict],
        translated: dict[str, dict[str, str]],
        *,
        update_memory: bool = True,
    ) -> set[int]:
        expanded = expand_duplicate_results(
            translated,
            duplicate_items_by_rep_id=self.duplicate_items_by_rep_id,
        )
        changed_item_ids_by_page = self._apply_translated_results(expanded)
        if update_memory:
            update_translation_memory(self.memory_store, batch=batch, translated=expanded)
        touched_pages = set(changed_item_ids_by_page)
        self.flush_state.mark_dirty(touched_pages, changed_item_ids_by_page)
        return touched_pages

    def apply_batches(
        self,
        results: list[tuple[list[dict], dict[str, dict[str, str]]]],
        *,
        update_memory: bool = True,
    ) -> set[int]:
        touched_pages: set[int] = set()
        if not results:
            return touched_pages
        memory_updates: list[tuple[list[dict], dict[str, dict[str, str]]]] = []
        changed_item_ids_by_page: dict[int, set[str]] = {}
        for batch, translated in results:
            expanded = expand_duplicate_results(
                translated,
                duplicate_items_by_rep_id=self.duplicate_items_by_rep_id,
            )
            batch_changes = self._apply_translated_results(expanded)
            for page_idx, item_ids in batch_changes.items():
                changed_item_ids_by_page.setdefault(page_idx, set()).update(item_ids)
            touched_pages.update(batch_changes)
            if update_memory:
                memory_updates.append((batch, expanded))
        if update_memory:
            update_translation_memory_many(self.memory_store, memory_updates)
        self.flush_state.mark_dirty(touched_pages, changed_item_ids_by_page)
        return touched_pages

    def _apply_translated_results(
        self,
        translated: dict[str, dict[str, str]],
    ) -> dict[int, set[str]]:
        if not translated:
            return {}
        candidates = self._candidate_items_for_expanded(translated)
        before = {
            item_id: translation_item_fingerprint(item)
            for item_id, item in candidates.items()
        }
        for item_id, raw_result in translated.items():
            if is_group_unit_id(str(item_id)):
                apply_group_translated_entry(self.group_items_by_unit_id.get(str(item_id), []), raw_result)
                continue
            item = self.item_by_id.get(str(item_id))
            if item is None:
                continue
            preserved_group_unit_id = existing_group_unit_id(item)
            apply_single_translated_entry(
                item,
                raw_result,
                next_item=self.next_item_by_id.get(str(item_id)),
                preserved_group_unit_id=preserved_group_unit_id,
            )
        if any(is_group_unit_id(str(item_id)) or existing_group_unit_id(self.item_by_id.get(str(item_id), {})) for item_id in translated):
            self._rebuild_group_index()

        changed: dict[int, set[str]] = {}
        for item_id, item in candidates.items():
            if before[item_id] == translation_item_fingerprint(item):
                continue
            page_idx = item.get("page_idx")
            if page_idx is None:
                page_idx = self.item_to_page.get(item_id)
            if page_idx is not None:
                changed.setdefault(int(page_idx), set()).add(item_id)
        return changed

    def _candidate_items_for_expanded(
        self,
        translated: dict[str, dict[str, str]],
    ) -> dict[str, dict]:
        candidates: dict[str, dict] = {}
        for raw_item_id in translated:
            item_id = str(raw_item_id)
            if is_group_unit_id(item_id):
                for item in self.group_items_by_unit_id.get(item_id, []):
                    member_id = str(item.get("item_id", "") or "")
                    if member_id:
                        candidates[member_id] = item
                continue
            item = self.item_by_id.get(item_id)
            if item is not None:
                candidates[item_id] = item
        return candidates

__all__ = [
    "TranslationResultApplier",
    "expand_duplicate_results",
]
