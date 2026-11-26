from __future__ import annotations

from copy import deepcopy

from retainpdf_translation.core.orchestration.abstract_groups import annotate_abstract_translation_groups
from retainpdf_translation.core.payload.parts.apply import apply_detached_member_text
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


def _unit_translation_text(item: dict) -> str:
    """这一块身上记的整组（单元）译文，空白压成一个空格，用来认「上一轮是同一个单元一起译的」。"""
    return " ".join(
        str(item.get("translation_unit_protected_translated_text") or item.get("group_protected_translated_text") or "").split()
    )


def _member_translation_text(item: dict) -> str:
    return str(item.get("protected_translated_text") or item.get("translated_text") or "").strip()


def keep_translated_blocks_out_of_mixed_groups(payload: list[dict]) -> int:
    """续跑时重新分出来的接续组，不把已有译文的块和还没译的块拼在一起：没译的块挪出去另外成组，有译文的块不再整组重翻。返回挪出的有译文的块数。

    续跑（重试、断点接着翻）每次都从头重新分组：规则那一遍清掉上一轮的拼接重新算，模型复核再按记下的结论（memo）
    或者新问的结论连上。和上一轮分得不一样时——上一轮复核那一批回复解析不了、这次重问判了「连」；或者规则的输入变了——
    一块已经单独译好的块会和一块还没译（或者转成了死信）的块连成一组。这一组算不上译完（`group_translation_complete`），
    整组成员都进待办，已完成的块「变回待办」，断点守卫（`workflow/checkpoint/contract.py` 的 `advance_checkpoint`）
    当场报 regressed，整本书失败（2026-11-26，1000 多页的书续跑到 893 页，p028-b003 等 4 块）。复核的结论在报错前已经
    落盘，以后每次重试都稳定地再失败一次。守卫防的是真的丢译文，不动它；改这里，不让重新分组造出这种组。

    整组都有译文（`group_translation_complete` 认可）的组不动；整组都没译的组不动（新任务第一次分组都是这样，
    所以对没有译文的任务不起作用）。摘要组（`translation_group_id`）在 `abstract_groups.py` 里已经是同样的规矩。

    混着的组这样拆（2026-11-26 审查第 7、8 条补的）：

    - 上一轮整组一起译完的单元不拆：成员身上记着同一段整组译文、而且全书记着这段译文的块都在这一组里，它们留在一起
      另成一组（组里的第一组沿用原来的组号，后面的加 `-rN`）。以前这种块也一块块挪出去，成员级译文是空的那块
      （上一轮切分时整段放进了别的成员）挪出来后渲染退回整组译文，同一段排两遍。
    - 别的有译文的块挪出组，单元译文换成它自己那一段（`apply.apply_detached_member_text`）。只有一种例外：它自己那一段
      是空的、上一轮的同组成员又不全在这一组里（拆不回原来的单元）。这时照旧留着整组译文、仍算译完：它的内容在
      同组别的成员那一段里，再单独翻一遍内容会重复；而且它在旧断点里是已完成的，改成待办会让守卫报 regressed，
      整本失败。渲染上和它在原来那组里时一样（组里成员级为空也退回整组译文），没有变坏。
    - 没译的块按阅读顺序、被有译文的块隔开的几段各自成组；一段里要翻的块不到两块就不成组。
    - 不翻的成员（`should_translate=False`）不算有译文也不算没译，跟着它所在的那一段走，不单独占一段、也不让一段
      凑够两块。写回时只按要翻的成员切分（`core/payload/parts/apply.py` 的 `apply_group_translated_entry`）。
    """
    groups: dict[str, list[dict]] = {}
    unit_text_holders: dict[str, list[dict]] = {}
    for item in payload:
        group_id = str(item.get("continuation_group", "") or "").strip()
        if group_id:
            groups.setdefault(group_id, []).append(item)
        if item.get("should_translate", True):
            unit_text = _unit_translation_text(item)
            if unit_text:
                unit_text_holders.setdefault(unit_text, []).append(item)
    detached = 0
    for group_id, members in groups.items():
        active = [item for item in members if item.get("should_translate", True)]
        translated = [item for item in active if has_item_translation(item) or has_group_translation(item)]
        if not translated or group_translation_complete(active):
            continue
        member_ids = {id(item) for item in members}
        # 上一轮一起译完、而且整个单元都在这一组里的那些块：按整组译文认单元
        kept_unit_of: dict[int, str] = {}
        by_unit_text: dict[str, list[dict]] = {}
        for item in translated:
            unit_text = _unit_translation_text(item)
            if unit_text:
                by_unit_text.setdefault(unit_text, []).append(item)
        for unit_text, unit_members in by_unit_text.items():
            holders = unit_text_holders.get(unit_text, [])
            if (
                len(unit_members) >= 2
                and all(id(holder) in member_ids for holder in holders)
                and group_translation_complete(unit_members)
            ):
                for item in unit_members:
                    kept_unit_of[id(item)] = unit_text
        translated_ids = {id(item) for item in translated}

        segments: list[tuple[str, list[dict]]] = [("run", [])]
        unit_segments: dict[str, list[dict]] = {}
        for item in continuation_reading_order(members):
            unit_text = kept_unit_of.get(id(item))
            if unit_text is not None:
                if unit_text not in unit_segments:
                    unit_segments[unit_text] = []
                    segments.append(("unit", unit_segments[unit_text]))
                    segments.append(("run", []))
                unit_segments[unit_text].append(item)
            elif id(item) in translated_ids:
                item["continuation_group"] = ""
                item["continuation_decision"] = KEPT_TRANSLATED_DECISION
                if _member_translation_text(item):
                    apply_detached_member_text(item)
                detached += 1
                segments.append(("run", []))
            else:
                segments[-1][1].append(item)
        # 第一组沿用原来的组号，后面的加后缀；要翻的块不到两块的那一段不成组
        part = 0
        for kind, segment in segments:
            if kind == "unit" or sum(1 for item in segment if item.get("should_translate", True)) >= 2:
                segment_group_id = group_id if part == 0 else f"{group_id}-r{part + 1}"
                part += 1
                for item in segment:
                    item["continuation_group"] = segment_group_id
            else:
                for item in segment:
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
