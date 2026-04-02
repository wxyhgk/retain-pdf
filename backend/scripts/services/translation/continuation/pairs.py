from services.translation.continuation.rules import bbox
from services.translation.continuation.rules import normalize_text


def candidate_continuation_pairs(payload: list[dict]) -> list[dict]:
    item_by_id = {item.get("item_id", ""): item for item in payload}
    pairs: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for item in payload:
        next_id = item.get("continuation_candidate_next_id", "") or ""
        item_id = item.get("item_id", "") or ""
        if not item_id or not next_id:
            continue
        pair_key = (item_id, next_id)
        if pair_key in seen:
            continue
        next_item = item_by_id.get(next_id)
        if not next_item:
            continue
        seen.add(pair_key)
        pairs.append(
            {
                "prev_item_id": item_id,
                "next_item_id": next_id,
                "prev_text": normalize_text(item.get("protected_source_text", "")),
                "next_text": normalize_text(next_item.get("protected_source_text", "")),
                "prev_page_idx": item.get("page_idx", -1),
                "next_page_idx": next_item.get("page_idx", -1),
                "prev_bbox": bbox(item),
                "next_bbox": bbox(next_item),
            }
        )
    return pairs


def apply_candidate_pair_joins(payload: list[dict], approved_pairs: list[tuple[str, str]]) -> int:
    if not approved_pairs:
        return 0
    item_by_id = {item.get("item_id", ""): item for item in payload}
    next_map = {prev_id: next_id for prev_id, next_id in approved_pairs}
    prev_targets = {next_id for _, next_id in approved_pairs}
    starts = [prev_id for prev_id, _ in approved_pairs if prev_id not in prev_targets]
    group_index = 1000
    annotated = 0

    def assign_chain(start_id: str) -> None:
        nonlocal group_index
        chain: list[dict] = []
        current_id = start_id
        visited: set[str] = set()
        while current_id and current_id not in visited:
            visited.add(current_id)
            item = item_by_id.get(current_id)
            if not item:
                break
            chain.append(item)
            current_id = next_map.get(current_id, "")
        if len(chain) < 2:
            return
        group_index += 1
        group_id = f"cg-review-{group_index:04d}"
        for pos, item in enumerate(chain):
            item["continuation_group"] = group_id
            item["continuation_decision"] = "review_joined"
            item["continuation_candidate_prev_id"] = ""
            item["continuation_candidate_next_id"] = ""
            item["continuation_prev_text"] = normalize_text(chain[pos - 1].get("protected_source_text", "")) if pos > 0 else ""
            item["continuation_next_text"] = normalize_text(chain[pos + 1].get("protected_source_text", "")) if pos < len(chain) - 1 else ""

    for start_id in starts:
        before = sum(1 for item in payload if item.get("continuation_decision") == "review_joined")
        assign_chain(start_id)
        after = sum(1 for item in payload if item.get("continuation_decision") == "review_joined")
        annotated += max(0, after - before)

    return annotated

