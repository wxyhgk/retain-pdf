from translation.continuation.rules import eligible
from translation.continuation.rules import normalize_text
from translation.continuation.rules import pair_decision


def clear_continuation_state(item: dict) -> None:
    item["continuation_group"] = ""
    item["continuation_prev_text"] = ""
    item["continuation_next_text"] = ""
    item["continuation_decision"] = ""
    item["continuation_candidate_prev_id"] = ""
    item["continuation_candidate_next_id"] = ""


def _next_candidate_index(payload: list[dict], start: int) -> int | None:
    if start >= len(payload):
        return None
    current_page_idx = payload[start - 1].get("page_idx", -1) if start > 0 else payload[start].get("page_idx", -1)
    for idx in range(start, len(payload)):
        item = payload[idx]
        page_idx = item.get("page_idx", -1)
        if page_idx < current_page_idx:
            continue
        if page_idx - current_page_idx > 1:
            return None
        if eligible(item):
            return idx
    return None


def annotate_continuation_context(payload: list[dict]) -> int:
    for item in payload:
        clear_continuation_state(item)

    group_index = 0
    annotated = 0
    i = 0

    while i < len(payload) - 1:
        current = payload[i]
        next_idx = _next_candidate_index(payload, i + 1)
        if next_idx is None:
            break
        nxt = payload[next_idx]
        decision = pair_decision(current, nxt)
        if decision != "join":
            if decision == "candidate":
                current["continuation_decision"] = "candidate_break"
                current["continuation_candidate_next_id"] = nxt.get("item_id", "")
                nxt["continuation_decision"] = "candidate_break"
                nxt["continuation_candidate_prev_id"] = current.get("item_id", "")
            i += 1
            continue

        group_index += 1
        group_id = f"cg-{current.get('page_idx', 0) + 1:03d}-{group_index:03d}"
        chain = [current, nxt]
        j = next_idx
        while j < len(payload) - 1:
            probe_idx = _next_candidate_index(payload, j + 1)
            if probe_idx is None or pair_decision(payload[j], payload[probe_idx]) != "join":
                break
            chain.append(payload[probe_idx])
            j = probe_idx

        for pos, item in enumerate(chain):
            item["continuation_group"] = group_id
            item["continuation_decision"] = "joined"
            if pos > 0:
                item["continuation_prev_text"] = normalize_text(chain[pos - 1].get("protected_source_text", ""))
            if pos < len(chain) - 1:
                item["continuation_next_text"] = normalize_text(chain[pos + 1].get("protected_source_text", ""))
            annotated += 1
        i = j + 1

    return annotated


def annotate_continuation_context_global(payloads_by_page: dict[int, list[dict]]) -> int:
    ordered_pages = sorted(payloads_by_page)
    flat_payload: list[dict] = []
    for page_idx in ordered_pages:
        flat_payload.extend(payloads_by_page[page_idx])
    return annotate_continuation_context(flat_payload)


def summarize_continuation_decisions(payload: list[dict]) -> dict[str, int]:
    summary = {
        "joined_items": 0,
        "candidate_break_items": 0,
    }
    for item in payload:
        decision = item.get("continuation_decision", "")
        if decision == "joined":
            summary["joined_items"] += 1
        elif decision == "candidate_break":
            summary["candidate_break_items"] += 1
    return summary

