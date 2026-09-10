from __future__ import annotations

from copy import deepcopy
from math import floor


MIN_EMPTY_SLOT_AREA = 8_000.0
MIN_EMPTY_SLOT_HEIGHT = 48.0
MIN_SAME_BAND_DONOR_TEXT_LENGTH = 12
MIN_CARRYOVER_DONOR_TEXT_LENGTH = 48
BODY_LABEL_WHITELIST = {"text", "abstract"}


def repair_body_cross_column_blocks(
    *,
    parsing_res_list: list[dict],
    column_signals: dict,
) -> tuple[list[dict], dict[int, dict], dict]:
    repaired_blocks = [deepcopy(block) for block in (parsing_res_list or [])]
    repair_metadata: dict[int, dict] = {}
    repaired_pairs: list[dict] = []
    visited_orders: set[int] = set()

    body_records = _build_body_records(repaired_blocks, column_signals=column_signals)
    body_by_order = {record["order"]: record for record in body_records}
    if not _looks_like_double_column_body_page(body_records):
        return repaired_blocks, repair_metadata, _build_summary(repaired_pairs, repair_metadata)

    empty_slots = [record for record in body_records if _is_repairable_empty_slot(record)]

    # Strategy A: first slot in a column is empty, but the previous column's last body block ends mid-sentence.
    for slot in empty_slots:
        if slot["order"] in visited_orders:
            continue
        donor = _find_column_carryover_donor(slot=slot, body_records=body_records, visited_orders=visited_orders)
        if donor is None:
            continue
        if _apply_repair(
            donor=donor,
            slot=slot,
            repaired_blocks=repaired_blocks,
            repair_metadata=repair_metadata,
            repaired_pairs=repaired_pairs,
            visited_orders=visited_orders,
            strategy="column_carryover",
        ):
            body_by_order[donor["order"]]["text"] = str(repaired_blocks[donor["order"]].get("block_content", "") or "").strip()
            body_by_order[slot["order"]]["text"] = str(repaired_blocks[slot["order"]].get("block_content", "") or "").strip()

    # Strategy B: same-band empty slot, likely one-to-one absorbed peer.
    for slot in empty_slots:
        if slot["order"] in visited_orders:
            continue
        donor = _find_same_band_donor(slot=slot, body_records=body_records, visited_orders=visited_orders)
        if donor is None:
            continue
        if _apply_repair(
            donor=donor,
            slot=slot,
            repaired_blocks=repaired_blocks,
            repair_metadata=repair_metadata,
            repaired_pairs=repaired_pairs,
            visited_orders=visited_orders,
            strategy="same_band",
        ):
            body_by_order[donor["order"]]["text"] = str(repaired_blocks[donor["order"]].get("block_content", "") or "").strip()
            body_by_order[slot["order"]]["text"] = str(repaired_blocks[slot["order"]].get("block_content", "") or "").strip()

    return repaired_blocks, repair_metadata, _build_summary(repaired_pairs, repair_metadata)


def _build_summary(repaired_pairs: list[dict], repair_metadata: dict[int, dict]) -> dict:
    return {
        "body_repair_pair_count": len(repaired_pairs),
        "body_repair_pairs": repaired_pairs,
        "body_repair_block_count": sum(1 for meta in repair_metadata.values() if meta.get("provider_body_repair_applied")),
    }


def _apply_repair(
    *,
    donor: dict,
    slot: dict,
    repaired_blocks: list[dict],
    repair_metadata: dict[int, dict],
    repaired_pairs: list[dict],
    visited_orders: set[int],
    strategy: str,
) -> bool:
    donor_text = str(repaired_blocks[donor["order"]].get("block_content", "") or "").strip()
    slot_text = str(repaired_blocks[slot["order"]].get("block_content", "") or "").strip()
    if not donor_text or slot_text:
        return False

    split_result = _split_absorbed_text(
        absorber_text=donor_text,
        absorber_bbox=donor["bbox"],
        peer_bbox=slot["bbox"],
    )
    if split_result is None:
        _mark_failed_attempt(repair_metadata, donor["order"], slot["order"], reason="unsafe_split", strategy=strategy)
        return False

    donor_repaired_text, slot_repaired_text, split_index = split_result
    if not donor_repaired_text or not slot_repaired_text:
        _mark_failed_attempt(repair_metadata, donor["order"], slot["order"], reason="unsafe_split", strategy=strategy)
        return False

    repaired_blocks[donor["order"]]["block_content"] = donor_repaired_text
    repaired_blocks[slot["order"]]["block_content"] = slot_repaired_text
    visited_orders.add(donor["order"])
    visited_orders.add(slot["order"])
    repaired_pairs.append(
        {
            "absorber_order": donor["order"],
            "peer_order": slot["order"],
            "split_index": split_index,
            "strategy": strategy,
        }
    )
    repair_metadata.setdefault(donor["order"], {}).update(
        {
            "provider_body_repair_attempted": True,
            "provider_body_repair_applied": True,
            "provider_body_repair_role": "absorber",
            "provider_body_repair_strategy": strategy,
            "provider_body_repair_peer_order": slot["order"],
            "provider_suspected_peer_order": slot["order"],
            "provider_body_repair_split_index": split_index,
            "provider_body_repair_original_text_length": len(donor_text),
            "provider_body_repair_final_text_length": len(donor_repaired_text),
        }
    )
    repair_metadata.setdefault(slot["order"], {}).update(
        {
            "provider_body_repair_attempted": True,
            "provider_body_repair_applied": True,
            "provider_body_repair_role": "peer",
            "provider_body_repair_strategy": strategy,
            "provider_body_repair_peer_order": donor["order"],
            "provider_suspected_peer_order": donor["order"],
            "provider_body_repair_split_index": split_index,
            "provider_body_repair_original_text_length": 0,
            "provider_body_repair_final_text_length": len(slot_repaired_text),
        }
    )
    return True


def _mark_failed_attempt(
    repair_metadata: dict[int, dict],
    donor_order: int,
    slot_order: int,
    *,
    reason: str,
    strategy: str,
) -> None:
    repair_metadata.setdefault(donor_order, {}).update(
        {
            "provider_body_repair_attempted": True,
            "provider_body_repair_applied": False,
            "provider_body_repair_reason": reason,
            "provider_body_repair_strategy": strategy,
            "provider_suspected_peer_order": slot_order,
        }
    )
    repair_metadata.setdefault(slot_order, {}).update(
        {
            "provider_body_repair_attempted": True,
            "provider_body_repair_applied": False,
            "provider_body_repair_reason": reason,
            "provider_body_repair_strategy": strategy,
            "provider_suspected_peer_order": donor_order,
        }
    )


def _build_body_records(
    parsing_res_list: list[dict],
    *,
    column_signals: dict | None = None,
) -> list[dict]:
    body_flow_start_order = _body_flow_start_order(parsing_res_list)
    result = []
    for order, block in enumerate(parsing_res_list):
        if not _is_body_candidate(parsing_res_list, order, body_flow_start_order):
            continue
        bbox = _bbox(block)
        if not bbox:
            continue
        text = str(block.get("block_content", "") or "").strip()
        result.append(
            {
                "order": order,
                "bbox": bbox,
                "text": text,
                "empty_text": len(text) < 2,
                "column_guess": _column_guess(order=order, bbox=bbox, column_signals=column_signals),
                "area": _bbox_capacity(bbox),
                "y0": bbox[1],
                "y1": bbox[3],
            }
        )
    return result


def _looks_like_double_column_body_page(body_records: list[dict]) -> bool:
    left = [record for record in body_records if record["column_guess"] == "left"]
    right = [record for record in body_records if record["column_guess"] == "right"]
    if not left or not right:
        return False
    if len(left) >= 2 and len(right) >= 2:
        return True
    return any(record["empty_text"] for record in left + right)


def _is_repairable_empty_slot(record: dict) -> bool:
    return (
        record["empty_text"]
        and record["area"] >= MIN_EMPTY_SLOT_AREA
        and _bbox_height(record["bbox"]) >= MIN_EMPTY_SLOT_HEIGHT
        and record["column_guess"] in {"left", "right"}
    )


def _find_same_band_donor(
    *,
    slot: dict,
    body_records: list[dict],
    visited_orders: set[int],
) -> dict | None:
    if _has_column_carryover_candidate(slot, body_records, visited_orders):
        return None
    candidates = []
    for record in body_records:
        if record["order"] in visited_orders or record["order"] == slot["order"]:
            continue
        if record["empty_text"] or record["column_guess"] == slot["column_guess"]:
            continue
        if len(record["text"]) < MIN_SAME_BAND_DONOR_TEXT_LENGTH:
            continue
        if not _vertical_overlap(record["bbox"], slot["bbox"]):
            continue
        candidates.append(record)
    if not candidates:
        return None
    return max(candidates, key=lambda record: record["area"])


def _find_column_carryover_donor(
    *,
    slot: dict,
    body_records: list[dict],
    visited_orders: set[int],
) -> dict | None:
    if slot["column_guess"] not in {"left", "right"}:
        return None
    if not _is_first_slot_in_column(slot, body_records):
        return None
    if not _has_same_column_body_context(slot, body_records):
        return None

    return _resolve_column_carryover_candidate(slot, body_records, visited_orders)


def _is_first_slot_in_column(slot: dict, body_records: list[dict]) -> bool:
    same_column_records = [
        record for record in body_records if record["column_guess"] == slot["column_guess"] and _is_substantive_body_record(record)
    ]
    if not same_column_records:
        return False
    first_slot_order = min(same_column_records, key=lambda record: (record["y0"], record["order"]))["order"]
    return slot["order"] == first_slot_order


def _has_same_column_body_context(slot: dict, body_records: list[dict]) -> bool:
    for record in body_records:
        if record["order"] == slot["order"]:
            continue
        if record["column_guess"] != slot["column_guess"]:
            continue
        if record["empty_text"]:
            continue
        if len(record["text"]) < MIN_CARRYOVER_DONOR_TEXT_LENGTH:
            continue
        gap = _vertical_gap(slot["bbox"], record["bbox"])
        if gap <= 96:
            return True
    return False


def _has_column_carryover_candidate(slot: dict, body_records: list[dict], visited_orders: set[int]) -> bool:
    return _find_column_carryover_donor(slot=slot, body_records=body_records, visited_orders=visited_orders) is not None


def _resolve_column_carryover_candidate(
    slot: dict,
    body_records: list[dict],
    visited_orders: set[int],
) -> dict | None:
    opposite_column = "right" if slot["column_guess"] == "left" else "left"
    prior_opposite_records = [
        record
        for record in body_records
        if (
            record["column_guess"] == opposite_column
            and not record["empty_text"]
            and record["order"] not in visited_orders
            and record["order"] < slot["order"]
        )
    ]
    if prior_opposite_records:
        donor = max(prior_opposite_records, key=lambda record: record["order"])
        if len(donor["text"]) >= MIN_CARRYOVER_DONOR_TEXT_LENGTH:
            return donor

    opposite_records = [
        record
        for record in body_records
        if record["column_guess"] == opposite_column and not record["empty_text"] and record["order"] not in visited_orders
    ]
    if not opposite_records:
        return None
    donor = max(opposite_records, key=lambda record: (record["y1"], record["order"]))
    if len(donor["text"]) < MIN_CARRYOVER_DONOR_TEXT_LENGTH:
        return None
    return donor


def _is_substantive_body_record(record: dict) -> bool:
    return bool(record["area"] >= MIN_EMPTY_SLOT_AREA or len(record["text"]) >= MIN_CARRYOVER_DONOR_TEXT_LENGTH)


def _is_body_candidate(
    parsing_res_list: list[dict],
    order: int,
    body_flow_start_order: int,
) -> bool:
    if order < 0 or order >= len(parsing_res_list):
        return False
    raw_label = str((parsing_res_list[order].get("block_label", "") or "")).strip().lower()
    if raw_label not in BODY_LABEL_WHITELIST:
        return False
    if body_flow_start_order >= 0 and order < body_flow_start_order:
        return False
    return True


def _body_flow_start_order(parsing_res_list: list[dict]) -> int:
    has_front_matter = False
    front_matter_end_order = -1
    for order, block in enumerate(parsing_res_list):
        label = str((block.get("block_label", "") or "")).strip().lower()
        text = " ".join(str(block.get("block_content", "") or "").split()).strip().lower()
        if label in {"doc_title", "abstract"}:
            has_front_matter = True
            front_matter_end_order = order
            continue
        if label == "paragraph_title" and text == "abstract":
            has_front_matter = True
            front_matter_end_order = order
            continue
    if not has_front_matter:
        return -1

    for order, block in enumerate(parsing_res_list):
        if order <= front_matter_end_order:
            continue
        label = str((block.get("block_label", "") or "")).strip().lower()
        text = " ".join(str(block.get("block_content", "") or "").split()).strip().lower()
        if label == "paragraph_title" and text and text != "abstract":
            return order
        if label in BODY_LABEL_WHITELIST and text and not _looks_like_front_matter_text(text):
            return order
    return -1


def _split_absorbed_text(
    *,
    absorber_text: str,
    absorber_bbox: list[float],
    peer_bbox: list[float],
) -> tuple[str, str, int] | None:
    normalized_text = " ".join(absorber_text.split())
    if len(normalized_text) < 16:
        return None

    absorber_capacity = _bbox_capacity(absorber_bbox)
    peer_capacity = _bbox_capacity(peer_bbox)
    total_capacity = absorber_capacity + peer_capacity
    if total_capacity <= 0:
        return None

    peer_ratio = max(0.18, min(0.55, peer_capacity / total_capacity))
    donor_prefix_ratio = 1.0 - peer_ratio
    target_index = floor(len(normalized_text) * donor_prefix_ratio)
    split_index = _choose_split_index(normalized_text, target_index)
    if split_index is None:
        return None

    donor_text = normalized_text[:split_index].strip()
    peer_text = normalized_text[split_index:].strip()
    if len(donor_text) < 6 or len(peer_text) < 6:
        return None
    return donor_text, peer_text, split_index


def _choose_split_index(text: str, target_index: int) -> int | None:
    length = len(text)
    if length < 2:
        return None
    lower = max(4, target_index - max(8, length // 6))
    upper = min(length - 4, target_index + max(8, length // 6))
    if lower >= upper:
        return None

    preferred = []
    for index, char in enumerate(text):
        if char == "\n":
            preferred.append(index)
        elif char.isspace():
            preferred.append(index)

    candidates = [index for index in preferred if lower <= index <= upper]
    if not candidates:
        return None
    return min(candidates, key=lambda index: abs(index - target_index))


def _column_guess(*, order: int, bbox: list[float], column_signals: dict | None) -> str:
    if len(bbox) != 4:
        return "unknown"
    block_signals = dict(((column_signals or {}).get("block_signals") or {}))
    signal = dict(block_signals.get(order) or {})
    signal_guess = str(signal.get("provider_column_index_guess", "") or "").strip().lower()
    if signal_guess in {"left", "right", "full"}:
        return signal_guess

    split_x = float(((column_signals or {}).get("split_x", 0) or 0))
    if split_x <= 0:
        return "unknown"
    return "left" if _center_x(bbox) <= split_x else "right"


def _looks_like_front_matter_text(text: str) -> bool:
    compact = " ".join((text or "").split()).strip().lower()
    if not compact:
        return False
    return compact.startswith("keywords:")


def _center_x(bbox: list[float]) -> float:
    return (bbox[0] + bbox[2]) / 2.0 if len(bbox) == 4 else 0.0


def _bbox_capacity(bbox: list[float]) -> float:
    if len(bbox) != 4:
        return 0.0
    width = max(1.0, bbox[2] - bbox[0])
    height = max(1.0, bbox[3] - bbox[1])
    return width * height


def _bbox_height(bbox: list[float]) -> float:
    if len(bbox) != 4:
        return 0.0
    return max(0.0, bbox[3] - bbox[1])


def _bbox(block: dict) -> list[float]:
    value = block.get("block_bbox") or []
    if not isinstance(value, list) or len(value) != 4:
        return []
    try:
        return [float(item or 0) for item in value[:4]]
    except (TypeError, ValueError):
        return []


def _vertical_overlap(a: list[float], b: list[float]) -> bool:
    if len(a) != 4 or len(b) != 4:
        return False
    overlap = min(a[3], b[3]) - max(a[1], b[1])
    min_height = min(max(1.0, a[3] - a[1]), max(1.0, b[3] - b[1]))
    return overlap >= min_height * 0.25


def _vertical_gap(a: list[float], b: list[float]) -> float:
    if len(a) != 4 or len(b) != 4:
        return float("inf")
    if _vertical_overlap(a, b):
        return 0.0
    if a[3] < b[1]:
        return b[1] - a[3]
    if b[3] < a[1]:
        return a[1] - b[3]
    return 0.0


__all__ = [
    "repair_body_cross_column_blocks",
]
