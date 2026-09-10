"""Fresh continuation payloads shared by provider-boundary tests.

Defaults mirror the original fixtures; the caller-owned bbox reference is retained.
"""


def payload_item(
    *,
    item_id: str,
    page_idx: int,
    text: str,
    bbox: list[float],
    ocr_source: str = "",
    ocr_group_id: str = "",
    ocr_scope: str = "",
    ocr_order: int = -1,
    layout_mode: str = "",
    layout_zone: str = "",
    layout_boundary_role: str = "",
    provider_body_repair_applied: bool = False,
) -> dict:
    return {
        "item_id": item_id,
        "page_idx": page_idx,
        "block_idx": 0,
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": True,
        "raw_block_type": "text",
        "normalized_sub_type": "",
        "bbox": bbox,
        "protected_source_text": text,
        "ocr_continuation_source": ocr_source,
        "ocr_continuation_group_id": ocr_group_id,
        "ocr_continuation_scope": ocr_scope,
        "ocr_continuation_reading_order": ocr_order,
        "layout_mode": layout_mode,
        "layout_zone": layout_zone,
        "layout_boundary_role": layout_boundary_role,
        "body_repair_applied": provider_body_repair_applied,
        "provider_body_repair_applied": provider_body_repair_applied,
    }
