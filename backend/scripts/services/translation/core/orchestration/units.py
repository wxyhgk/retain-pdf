from __future__ import annotations

from services.translation.core.payload.parts.common import clear_singleton_continuation_group
from services.translation.core.payload.parts.common import seed_orchestration_metadata
from services.translation.core.payload.parts.translation_units import refresh_payload_translation_units


def finalize_payload_orchestration_metadata(payload: list[dict]) -> None:
    group_counts: dict[str, int] = {}
    for item in payload:
        group_id = str(item.get("continuation_group", "") or "").strip()
        if group_id:
            group_counts[group_id] = group_counts.get(group_id, 0) + 1

    for item in payload:
        clear_singleton_continuation_group(item, group_counts=group_counts)
        seed_orchestration_metadata(item)
    refresh_payload_translation_units(payload)


def finalize_orchestration_metadata_by_page(page_payloads: dict[int, list[dict]]) -> None:
    # phải thực hiện một lần với phạm vi toàn sách phẳng, nhất quán với phạm vi refresh của save_pages.
    # khi thực hiện theo từng trang, các nhóm continuation xuyên trang trên mỗi trang chỉ có 1 thành viên:
    # - nhóm được ghép bởi review (candidate ids đã bị xóa, không có provider id) sẽ bị
    #   clear_singleton_continuation_group coi là nhóm mồ côi và xóa trực tiếp;
    # - nhóm xuyên trang của provider tuy giữ được group id, nhưng trường unit cũng bị hạ cấp thành single,
    #   mâu thuẫn với kết luận phân nhóm phẳng của save_pages sau đó.
    flat_payload = [item for page_idx in sorted(page_payloads) for item in page_payloads[page_idx]]
    finalize_payload_orchestration_metadata(flat_payload)


__all__ = [
    "finalize_payload_orchestration_metadata",
    "finalize_orchestration_metadata_by_page",
]
