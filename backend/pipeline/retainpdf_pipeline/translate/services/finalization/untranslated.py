from __future__ import annotations
from retainpdf_pipeline.translate.llm.shared.executor_context import translation_unit

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
import os

from retainpdf_pipeline.translate.artifacts import blocking_untranslated_items
from retainpdf_pipeline.translate.core.payload.parts.apply import apply_group_translated_entry
from retainpdf_pipeline.translate.core.payload.parts.apply import apply_single_translated_entry
from retainpdf_pipeline.translate.core.payload.parts.common import effective_translation_unit_id
from retainpdf_pipeline.translate.core.payload.parts.common import item_has_multi_member_group_unit
from retainpdf_pipeline.translate.core.payload.parts.diagnostics import record_translation_diagnostics
from retainpdf_pipeline.translate.core.payload.parts.policy_state import mark_keep_origin
from retainpdf_pipeline.translate.core.payload.parts.policy_state import mark_translation_failed_policy_state
from retainpdf_pipeline.translate.core.payload.parts.units import pending_translation_items
from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content
from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.translate.llm.shared import upstream_resilience as _resilience
from retainpdf_pipeline.translate.llm.validation.quality import review_translation_item
from retainpdf_pipeline.translate.services.policy import should_skip_model_by_policy


DEFAULT_MAX_WORKERS = 32
DEFAULT_MAX_ITEMS = 64
MAX_ITEMS_ENV = "RETAIN_TRANSLATION_FINAL_RECOVERY_MAX_ITEMS"


@dataclass(frozen=True)
class FinalUntranslatedRecoverySummary:
    blocking_before: int = 0
    attempted_items: int = 0
    recovered_items: int = 0
    dead_letter_items: int = 0
    blocking_after: int = 0
    skipped_by_budget: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "blocking_before": self.blocking_before,
            "attempted_items": self.attempted_items,
            "recovered_items": self.recovered_items,
            "dead_letter_items": self.dead_letter_items,
            "blocking_after": self.blocking_after,
            "skipped_by_budget": self.skipped_by_budget,
        }


def recover_blocking_untranslated_items(
    page_payloads: dict[int, list[dict]],
    *,
    api_key: str,
    model: str,
    base_url: str,
    target_language_name: str = "简体中文",
    max_items: int = DEFAULT_MAX_ITEMS,
    workers: int = DEFAULT_MAX_WORKERS,
    request_chat_content_fn=request_chat_content,
) -> FinalUntranslatedRecoverySummary:
    max_items = _max_items_from_env(max_items)
    flat_payload = [item for page_idx in sorted(page_payloads) for item in page_payloads[page_idx]]
    pending_translation_items(flat_payload)
    blocking = blocking_untranslated_items(page_payloads)
    if not blocking:
        return FinalUntranslatedRecoverySummary()
    item_by_id = _item_index(page_payloads)
    blocking_before = len(blocking)
    for item in (
        item_by_id[item["item_id"]]
        for item in blocking
        if item.get("item_id") in item_by_id and should_skip_model_by_policy(item_by_id[item["item_id"]])
    ):
        _mark_final_policy_keep_origin(item)
    blocking = blocking_untranslated_items(page_payloads)
    if not blocking:
        return FinalUntranslatedRecoverySummary(
            blocking_before=blocking_before,
            blocking_after=0,
        )
    recovery_members = _recovery_members_by_key(page_payloads)
    recoverable: list[dict] = []
    recovery_key_by_representative_id: dict[str, str] = {}
    seen_recovery_keys: set[str] = set()
    for blocked_item in blocking:
        item_id = str(blocked_item.get("item_id", "") or "")
        item = item_by_id.get(item_id)
        if item is None or not _can_final_recover(item):
            continue
        recovery_key = _recovery_key(item)
        if recovery_key in seen_recovery_keys:
            continue
        members = recovery_members.get(recovery_key) or [item]
        representative = members[0]
        representative_id = str(representative.get("item_id", "") or "")
        seen_recovery_keys.add(recovery_key)
        recovery_key_by_representative_id[representative_id] = recovery_key
        recoverable.append(representative)
    candidates = recoverable[: max(0, max_items)]
    skipped_by_budget = max(0, len(recoverable) - len(candidates))
    if not candidates:
        return FinalUntranslatedRecoverySummary(
            blocking_before=blocking_before,
            blocking_after=len(blocking),
            skipped_by_budget=skipped_by_budget,
        )

    recovered = 0
    dead_letter = 0
    max_workers = max(1, min(int(workers or 1), len(candidates)))
    if max_workers <= 1:
        results = [
            _recover_one(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                target_language_name=target_language_name,
                request_chat_content_fn=request_chat_content_fn,
            )
            for item in candidates
        ]
    else:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [
                executor.submit(
                    _recover_one,
                    item,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    target_language_name=target_language_name,
                    request_chat_content_fn=request_chat_content_fn,
                )
                for item in candidates
            ]
            results = [future.result() for future in as_completed(futures)]

    for item, payload, exc in results:
        representative_id = str(item.get("item_id", "") or "")
        recovery_key = recovery_key_by_representative_id.get(representative_id, _recovery_key(item))
        members = recovery_members.get(recovery_key) or [item]
        if payload is not None:
            if _is_aggregate_geometry_group(item):
                apply_group_translated_entry(members, payload)
            else:
                apply_single_translated_entry(item, payload)
            recovered += 1
            continue
        for member in members:
            _mark_final_dead_letter(member, exc)
        dead_letter += len(members)

    after = blocking_untranslated_items(page_payloads)
    return FinalUntranslatedRecoverySummary(
        blocking_before=blocking_before,
        attempted_items=len(candidates),
        recovered_items=recovered,
        dead_letter_items=dead_letter,
        blocking_after=len(after),
        skipped_by_budget=skipped_by_budget,
    )


def _max_items_from_env(default: int) -> int:
    raw = str(os.environ.get(MAX_ITEMS_ENV, "") or "").strip()
    if not raw:
        return max(0, int(default))
    try:
        return max(0, int(raw))
    except ValueError:
        return max(0, int(default))


def _item_index(page_payloads: dict[int, list[dict]]) -> dict[str, dict]:
    return {
        str(item.get("item_id", "") or ""): item
        for page_idx in sorted(page_payloads)
        for item in page_payloads[page_idx]
        if str(item.get("item_id", "") or "")
    }


def _is_aggregate_geometry_group(item: dict) -> bool:
    return (
        str(item.get("translation_group_strategy", "") or "").strip() == "aggregate_geometry"
        and item_has_multi_member_group_unit(item)
    )


def _recovery_key(item: dict) -> str:
    if _is_aggregate_geometry_group(item):
        return effective_translation_unit_id(item)
    return f"item:{item.get('item_id', '')}"


def _recovery_members_by_key(page_payloads: dict[int, list[dict]]) -> dict[str, list[dict]]:
    members_by_key: dict[str, list[dict]] = {}
    for page_idx in sorted(page_payloads):
        for item in page_payloads[page_idx]:
            members_by_key.setdefault(_recovery_key(item), []).append(item)
    return members_by_key


def _can_final_recover(item: dict) -> bool:
    if should_skip_model_by_policy(item):
        return False
    source_text = _source_text(item)
    return bool(source_text and any(ch.isalpha() for ch in source_text))


def _recover_one(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    target_language_name: str,
    request_chat_content_fn,
):
    try:
        translated = _request_final_translation(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            target_language_name=target_language_name,
            request_chat_content_fn=request_chat_content_fn,
        )
        payload = result_entry("translate", translated)
        payload["translation_diagnostics"] = {
            "item_id": item.get("item_id", ""),
            "page_idx": item.get("page_idx"),
            "route_path": ["block_level", "final_untranslated_recovery"],
            "fallback_to": "final_untranslated_recovery",
            "degradation_reason": "blocking_untranslated_recovered",
            "final_status": "translated",
        }
        issues = [
            issue
            for issue in review_translation_item(item, payload).issues
            if issue.severity == "error"
        ]
        if issues:
            raise ValueError("final recovery output failed validation: " + ", ".join(issue.kind for issue in issues[:3]))
        return item, payload, None
    except Exception as exc:
        return item, None, exc


@translation_unit
def _request_final_translation(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    target_language_name: str,
    request_chat_content_fn,
) -> str:
    source_text = _source_text(item)
    content = request_chat_content_fn(
        [
            {
                "role": "system",
                "content": (
                    f"Translate the current scientific PDF block into {target_language_name}.\n"
                    "Preserve every inline LaTeX math expression and placeholder exactly.\n"
                    "Return only the translated block text. Do not return JSON."
                ),
            },
            {"role": "user", "content": source_text},
        ],
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=None,
        timeout=45,
        request_label=f"final-untranslated-recovery {item.get('item_id', '')}",
        max_attempts=2,
    )
    translated = str(content or "").strip()
    if not translated:
        raise ValueError("final recovery returned empty translation")
    return translated


def _source_text(item: dict) -> str:
    return str(
        item.get("translation_unit_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    ).strip()


def _mark_final_dead_letter(item: dict, exc: Exception | None) -> None:
    # 先 mark 再 record:record 写入时重读 item 上的最新诊断,
    # 避免旧快照回写盖掉失败状态刚写入的内容。
    # 402/401/403/400 由上游 request_chat_content 直接失败（不再重试），
    # 这里把余额/Key 提示写进死信，方便快速定位充值而不是翻重试配额。
    mark_translation_failed_policy_state(item)
    record_translation_diagnostics(
        item,
        "final_recovery",
        {
            "item_id": item.get("item_id", ""),
            "page_idx": item.get("page_idx"),
            "route_path": ["block_level", "final_untranslated_recovery", "dead_letter"],
            "fallback_to": "dead_letter_queue",
            "degradation_reason": "final_untranslated_recovery_failed",
            "final_status": "failed",
            "dead_letter": True,
            "final_recovery_error_type": type(exc).__name__ if exc is not None else "UnknownError",
            "final_recovery_error": _resilience.describe_upstream_error(exc) if exc is not None else "",
        },
    )


def _mark_final_policy_keep_origin(item: dict) -> None:
    mark_keep_origin(item)
    record_translation_diagnostics(
        item,
        "final_recovery",
        {
            "item_id": item.get("item_id", ""),
            "page_idx": item.get("page_idx"),
            "route_path": ["block_level", "final_untranslated_recovery", "policy_keep_origin"],
            "fallback_to": "policy_keep_origin",
            "degradation_reason": "policy_keep_origin",
            "final_status": "kept_origin",
        },
    )


__all__ = [
    "FinalUntranslatedRecoverySummary",
    "recover_blocking_untranslated_items",
]
