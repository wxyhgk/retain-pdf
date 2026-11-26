from __future__ import annotations

from copy import deepcopy

from retainpdf_translation.core.orchestration.abstract_groups import annotate_abstract_translation_groups
from retainpdf_translation.core.payload.parts.common import clear_singleton_continuation_group
from retainpdf_translation.core.payload.parts.common import has_group_translation
from retainpdf_translation.core.payload.parts.common import has_item_translation
from retainpdf_translation.core.payload.parts.common import seed_orchestration_metadata
from retainpdf_translation.core.payload.parts.translation_units import refresh_payload_translation_units
from retainpdf_translation.core.payload.parts.units import group_translation_complete
from retainpdf_translation.core.reading_order import continuation_reading_order

# 已有译文、被挪出新接续组的块（`keep_translated_blocks_out_of_mixed_groups`）。
KEPT_TRANSLATED_DECISION = "kept_translated"


def refresh_translation_units_by_page(page_payloads: dict[int, list[dict]]) -> None:
    """Explicit unit preparation; unlike page persistence, this mutates payloads."""
    refresh_payload_translation_units([
        item for page_idx in sorted(page_payloads) for item in page_payloads[page_idx]
    ])


def refresh_translation_units_and_collect_changed_pages(
    page_payloads: dict[int, list[dict]],
) -> set[int]:
    """Prepare units and report every changed page within the supplied scope.

    Partial writers need the full mutation footprint, including cleared group
    translations which are not part of the unit identity snapshot. Keep this
    tracking opt-in so ordinary preparation does not copy the document.
    """
    before = deepcopy(page_payloads)
    refresh_translation_units_by_page(page_payloads)
    return {page_idx for page_idx, payload in page_payloads.items() if payload != before[page_idx]}


def keep_translated_blocks_out_of_mixed_groups(payload: list[dict]) -> int:
    """续跑时重新分出来的接续组，不把已有译文的块和还没译的块拼在一起：有译文的块挪出组，没译的块照旧成组。返回挪出的块数。

    续跑（重试、断点接着翻）每次都从头重新分组：规则那一遍清掉上一轮的拼接重新算，模型复核再按记下的结论（memo）
    或者新问的结论连上。和上一轮分得不一样时——上一轮复核那一批回复解析不了、这次重问判了「连」；或者规则的输入变了——
    一块已经单独译好的块会和一块还没译（或者转成了死信）的块连成一组。这一组算不上译完（`group_translation_complete`），
    整组成员都进待办，已完成的块「变回待办」，断点守卫（`workflow/checkpoint/contract.py` 的 `advance_checkpoint`）
    当场报 regressed，整本书失败（2026-11-26，1000 多页的书续跑到 893 页，p028-b003 等 4 块）。复核的结论在报错前已经
    落盘，以后每次重试都稳定地再失败一次。守卫防的是真的丢译文，不动它；改这里，不让重新分组造出这种组。

    整组都有自己的译文（`group_translation_complete` 认可）的组不动；整组都没译的组不动（新任务第一次分组都是这样，
    所以对没有译文的任务不起作用）。已经译好的块不再整组重翻，没译的块单独（或者和相邻的没译的块一起）翻。
    摘要组（`translation_group_id`）在 `abstract_groups.py` 里已经是同样的规矩。
    """
    groups: dict[str, list[dict]] = {}
    for item in payload:
        group_id = str(item.get("continuation_group", "") or "").strip()
        if group_id:
            groups.setdefault(group_id, []).append(item)
    detached = 0
    for group_id, members in groups.items():
        active = [item for item in members if item.get("should_translate", True)]
        translated = [item for item in active if has_item_translation(item) or has_group_translation(item)]
        if not translated or group_translation_complete(active):
            continue
        translated_ids = {id(item) for item in translated}
        runs: list[list[dict]] = [[]]
        for item in continuation_reading_order(members):
            if id(item) in translated_ids:
                item["continuation_group"] = ""
                item["continuation_decision"] = KEPT_TRANSLATED_DECISION
                detached += 1
                runs.append([])
            else:
                runs[-1].append(item)
        # 被有译文的块隔开的几段各自成组：第一段沿用原来的组号，后面的加后缀
        part = 0
        for run in runs:
            if len(run) >= 2:
                run_group_id = group_id if part == 0 else f"{group_id}-r{part + 1}"
                part += 1
                for item in run:
                    item["continuation_group"] = run_group_id
            else:
                for item in run:
                    item["continuation_group"] = ""
    return detached


def finalize_payload_orchestration_metadata(payload: list[dict]) -> None:
    keep_translated_blocks_out_of_mixed_groups(payload)
    group_counts: dict[str, int] = {}
    for item in payload:
        group_id = str(item.get("continuation_group", "") or "").strip()
        if group_id:
            group_counts[group_id] = group_counts.get(group_id, 0) + 1

    for item in payload:
        clear_singleton_continuation_group(item, group_counts=group_counts)
    annotate_abstract_translation_groups(payload)
    for item in payload:
        seed_orchestration_metadata(item)
    refresh_payload_translation_units(payload)


def finalize_orchestration_metadata_by_page(page_payloads: dict[int, list[dict]]) -> None:
    # 必须以全书扁平口径执行一次,与 save_pages 的 refresh 口径一致。
    # 逐页执行时跨页 continuation 组在每页都只有 1 个成员:
    # - review 拼接的组(candidate ids 已清空、无 provider id)会被
    #   clear_singleton_continuation_group 当孤儿直接抹掉;
    # - provider 跨页组虽保住 group id,unit 字段也会被降级成 single,
    #   与随后 save_pages 的扁平分组结论互相矛盾。
    flat_payload = [item for page_idx in sorted(page_payloads) for item in page_payloads[page_idx]]
    finalize_payload_orchestration_metadata(flat_payload)


__all__ = [
    "KEPT_TRANSLATED_DECISION",
    "keep_translated_blocks_out_of_mixed_groups",
    "refresh_translation_units_and_collect_changed_pages",
    "refresh_translation_units_by_page",
    "finalize_payload_orchestration_metadata",
    "finalize_orchestration_metadata_by_page",
]
