from __future__ import annotations

from copy import deepcopy

from retainpdf_pipeline.translate.core.orchestration.abstract_groups import annotate_abstract_translation_groups
from retainpdf_pipeline.translate.core.payload.parts.common import clear_singleton_continuation_group
from retainpdf_pipeline.translate.core.payload.parts.common import seed_orchestration_metadata
from retainpdf_pipeline.translate.core.payload.parts.translation_units import refresh_payload_translation_units


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


def finalize_payload_orchestration_metadata(payload: list[dict]) -> None:
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
    "refresh_translation_units_and_collect_changed_pages",
    "refresh_translation_units_by_page",
    "finalize_payload_orchestration_metadata",
    "finalize_orchestration_metadata_by_page",
]
