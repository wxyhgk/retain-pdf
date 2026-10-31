from __future__ import annotations

from retainpdf_translation.services.continuation.rules import eligible
from retainpdf_translation.services.continuation.rules import normalize_text
from retainpdf_translation.services.continuation.rules import pair_decision

PROVIDER_JOIN_DECISION = "provider_joined"
RULE_JOIN_DECISION = "joined"
REVIEW_JOIN_DECISION = "review_joined"
BOUNDARY_HEAD_ROLES = {"head", "single"}
BOUNDARY_TAIL_ROLES = {"tail", "single"}
FLOW_LAYOUT_ZONES = {"single_column", "left_column", "right_column", "full_width"}
MIN_CROSS_PAGE_SIDE_TEXT_CHARS = 8
MIN_CROSS_PAGE_COMBINED_TEXT_CHARS = 32


def clear_continuation_state(item: dict) -> None:
    item["continuation_group"] = ""
    item["continuation_prev_text"] = ""
    item["continuation_next_text"] = ""
    item["continuation_decision"] = ""
    item["continuation_candidate_prev_id"] = ""
    item["continuation_candidate_next_id"] = ""


def _provider_hint_key(item: dict, key: str, default):
    value = item.get(key, default)
    return default if value is None else value


def _item_int(item: dict, key: str, default: int) -> int:
    value = item.get(key, default)
    if isinstance(value, bool):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _provider_groups_by_scope(payload: list[dict], scope: str) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = {}
    for item in payload:
        if not eligible(item):
            continue
        if _provider_hint_key(item, "ocr_continuation_source", "") != "provider":
            continue
        if _provider_hint_key(item, "ocr_continuation_scope", "") != scope:
            continue
        group_id = str(_provider_hint_key(item, "ocr_continuation_group_id", "") or "").strip()
        if not group_id:
            continue
        groups.setdefault(group_id, []).append(item)
    return groups


def _provider_group_reading_order_is_usable(items: list[dict]) -> bool:
    if len(items) < 2:
        return False
    reading_orders = []
    for item in items:
        reading_order = item.get("ocr_continuation_reading_order", -1)
        if isinstance(reading_order, bool) or not isinstance(reading_order, int) or reading_order < 0:
            return False
        reading_orders.append(reading_order)
    return len(reading_orders) == len(set(reading_orders))


def _provider_group_ordered_items(items: list[dict]) -> list[dict]:
    return sorted(
        items,
        key=lambda item: (
            _item_int(item, "ocr_continuation_reading_order", -1),
            _item_int(item, "page_idx", -1),
            _item_int(item, "block_idx", 0),
        ),
    )


def _provider_intra_page_group_is_usable(items: list[dict]) -> bool:
    if not _provider_group_reading_order_is_usable(items):
        return False
    return len({_item_int(item, "page_idx", -1) for item in items}) == 1


def _boundary_role(item: dict) -> str:
    return str(item.get("layout_boundary_role", "") or "").strip().lower()


def _layout_mode(item: dict) -> str:
    return str(item.get("layout_mode", "") or "").strip().lower()


def _layout_zone(item: dict) -> str:
    return str(item.get("layout_zone", "") or "").strip().lower()


def _text_signal_chars(item: dict) -> int:
    return len("".join(normalize_text(item.get("protected_source_text", "")).split()))


def _provider_cross_page_text_is_usable(prev_item: dict, next_item: dict) -> bool:
    prev_chars = _text_signal_chars(prev_item)
    next_chars = _text_signal_chars(next_item)
    return (
        prev_chars >= MIN_CROSS_PAGE_SIDE_TEXT_CHARS
        and next_chars >= MIN_CROSS_PAGE_SIDE_TEXT_CHARS
        and prev_chars + next_chars >= MIN_CROSS_PAGE_COMBINED_TEXT_CHARS
    )


def _provider_cross_page_zone_is_usable(prev_item: dict, next_item: dict) -> bool:
    prev_mode = _layout_mode(prev_item)
    next_mode = _layout_mode(next_item)
    prev_zone = _layout_zone(prev_item)
    next_zone = _layout_zone(next_item)
    if prev_zone not in FLOW_LAYOUT_ZONES or next_zone not in FLOW_LAYOUT_ZONES:
        return False
    if prev_mode == "double" and prev_zone != "right_column":
        return False
    if next_mode == "double" and next_zone != "left_column":
        return False
    if prev_mode != "double" and prev_zone not in {"single_column", "full_width"}:
        return False
    if next_mode != "double" and next_zone not in {"single_column", "full_width"}:
        return False
    return True


def _body_boundary_roles(payload: list[dict]) -> dict[str, str]:
    """每页每个分区里，只算能接续的正文块（`eligible`）的头尾：页首是图注、图片时，下面第一段正文照样算页首。

    `layout_boundary_role` 把图注也算进分区排序，2026-10-31 ACS 论文第 10 页最上面是图 6 的图注，接着上一页的正文
    "As macro-" / "phages are …" 被标成 middle，跨页判定不让接。"""
    zones: dict[tuple[int, str], list[dict]] = {}
    for item in payload:
        if _boundary_role(item):
            zones.setdefault((_item_int(item, "page_idx", -1), _layout_zone(item)), []).append(item)
    roles: dict[str, str] = {}
    for items in zones.values():
        items.sort(key=lambda item: _item_int(item, "layout_zone_rank", -1))
        complete = [_item_int(item, "layout_zone_rank", -1) for item in items] == list(range(len(items))) and all(
            _item_int(item, "layout_zone_size", -1) == len(items) for item in items
        )
        if not complete:
            continue  # 分区排序不全（缺块、手写的头尾）：不知道前后还有什么，照旧用 layout_boundary_role
        body = [item for item in items if eligible(item)]
        for index, item in enumerate(body):
            if len(body) == 1:
                role = "single"
            elif index == 0:
                role = "head"
            elif index == len(body) - 1:
                role = "tail"
            else:
                role = "middle"
            roles[str(item.get("item_id", ""))] = role
    return roles


def _cross_page_body_transition_is_usable(prev_item: dict, next_item: dict, body_roles: dict[str, str] | None = None) -> bool:
    """Cross-page continuation joins body blocks only: tail -> head.

    The previous item must close its page (tail/single) and the next item
    must open the following page (head/single) — but only when boundary roles
    are actually annotated. Payloads without role annotation keep the
    historical scoring behavior so a zones miss never silently kills a join;
    it is downgraded to review instead (see ``annotate_continuation_context``).
    """
    if _item_int(prev_item, "page_idx", -1) == _item_int(next_item, "page_idx", -1):
        return True
    roles = body_roles or {}
    prev_role = roles.get(str(prev_item.get("item_id", ""))) or _boundary_role(prev_item)
    next_role = roles.get(str(next_item.get("item_id", ""))) or _boundary_role(next_item)
    if prev_role and prev_role not in BOUNDARY_TAIL_ROLES:
        return False
    if next_role and next_role not in BOUNDARY_HEAD_ROLES:
        return False
    return True


def _provider_cross_page_transition_is_usable(prev_item: dict, next_item: dict) -> bool:
    prev_page_idx = _item_int(prev_item, "page_idx", -1)
    next_page_idx = _item_int(next_item, "page_idx", -1)
    if next_page_idx != prev_page_idx + 1:
        return False
    if _boundary_role(prev_item) not in BOUNDARY_TAIL_ROLES:
        return False
    if _boundary_role(next_item) not in BOUNDARY_HEAD_ROLES:
        return False
    if not _provider_cross_page_zone_is_usable(prev_item, next_item):
        return False
    if not _provider_cross_page_text_is_usable(prev_item, next_item):
        return False
    return True


def _provider_cross_page_group_is_usable(items: list[dict]) -> bool:
    if not _provider_group_reading_order_is_usable(items):
        return False
    ordered = _provider_group_ordered_items(items)
    unique_pages = sorted({_item_int(item, "page_idx", -1) for item in ordered})
    if len(unique_pages) != 2:
        return False
    if unique_pages[1] != unique_pages[0] + 1:
        return False
    page_transition_count = 0
    for prev_item, next_item in zip(ordered, ordered[1:]):
        prev_page_idx = _item_int(prev_item, "page_idx", -1)
        next_page_idx = _item_int(next_item, "page_idx", -1)
        if next_page_idx < prev_page_idx or next_page_idx - prev_page_idx > 1:
            return False
        if next_page_idx > prev_page_idx:
            page_transition_count += 1
            if not _provider_cross_page_transition_is_usable(prev_item, next_item):
                return False
    return page_transition_count == 1


def _annotate_provider_group(ordered: list[dict], group_id: str) -> int:
    annotated = 0
    for pos, item in enumerate(ordered):
        item["continuation_group"] = group_id
        item["continuation_decision"] = PROVIDER_JOIN_DECISION
        item["continuation_candidate_prev_id"] = ""
        item["continuation_candidate_next_id"] = ""
        item["continuation_prev_text"] = normalize_text(ordered[pos - 1].get("protected_source_text", "")) if pos > 0 else ""
        item["continuation_next_text"] = normalize_text(ordered[pos + 1].get("protected_source_text", "")) if pos < len(ordered) - 1 else ""
        annotated += 1
    return annotated


def _annotate_provider_continuation_context(payload: list[dict]) -> int:
    annotated = 0
    for group_id, items in _provider_groups_by_scope(payload, "intra_page").items():
        if not _provider_intra_page_group_is_usable(items):
            continue
        annotated += _annotate_provider_group(_provider_group_ordered_items(items), group_id)
    for group_id, items in _provider_groups_by_scope(payload, "cross_page").items():
        if not _provider_cross_page_group_is_usable(items):
            continue
        annotated += _annotate_provider_group(_provider_group_ordered_items(items), group_id)
    return annotated


def _next_candidate_index(payload: list[dict], start: int) -> int | None:
    """Return the next eligible item index at or after ``start``.

    Missing intermediate page indices (e.g. page 4 then page 6 in the flat
    payload) must not abort the scan: pair_join_score still rejects non-adjacent
    page_idx pairs, while later adjacent pairs remain discoverable.
    """
    if start >= len(payload):
        return None
    current_page_idx = payload[start - 1].get("page_idx", -1) if start > 0 else payload[start].get("page_idx", -1)
    for idx in range(start, len(payload)):
        item = payload[idx]
        if item.get("continuation_decision") == PROVIDER_JOIN_DECISION:
            continue
        page_idx = item.get("page_idx", -1)
        if page_idx < current_page_idx:
            continue
        if eligible(item):
            return idx
    return None


def _mark_candidate(prev_item: dict, next_item: dict) -> None:
    """拿不准的一对：留给模型复核（`pairs.candidate_continuation_pairs` 按这两个字段收集）。已经在组里的块不改它的决定。"""
    prev_item["continuation_candidate_next_id"] = next_item.get("item_id", "")
    next_item["continuation_candidate_prev_id"] = prev_item.get("item_id", "")
    for item in (prev_item, next_item):
        if not item.get("continuation_group"):
            item["continuation_decision"] = "candidate_break"


def annotate_continuation_context(payload: list[dict]) -> int:
    for item in payload:
        clear_continuation_state(item)

    annotated = _annotate_provider_continuation_context(payload)
    body_roles = _body_boundary_roles(payload)
    group_index = 0
    i = 0

    while i < len(payload) - 1:
        current = payload[i]
        if current.get("continuation_decision") == PROVIDER_JOIN_DECISION:
            i += 1
            continue
        next_idx = _next_candidate_index(payload, i + 1)
        if next_idx is None:
            # No further eligible items after this point — advance instead of
            # aborting the whole remainder of the book (historical bug: break).
            i += 1
            continue
        nxt = payload[next_idx]
        decision = pair_decision(current, nxt)
        if decision == "join" and not _cross_page_body_transition_is_usable(current, nxt, body_roles):
            # Score says join but the boundary roles disagree (e.g. a page tail
            # paired with a non-head block such as a caption that slipped past
            # tagging). Do not join silently — leave it to LLM review.
            decision = "candidate"
        if decision != "join":
            if decision == "candidate":
                _mark_candidate(current, nxt)
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
            if not _cross_page_body_transition_is_usable(payload[j], payload[probe_idx], body_roles):
                # 和上面一样不悄悄放过：标成候选交给模型复核（以前链条延伸到这里就断了，这一对谁也不审）
                _mark_candidate(payload[j], payload[probe_idx])
                break
            chain.append(payload[probe_idx])
            j = probe_idx

        for pos, item in enumerate(chain):
            item["continuation_group"] = group_id
            item["continuation_decision"] = RULE_JOIN_DECISION
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
        "provider_joined_items": 0,
        "rule_joined_items": 0,
        "review_joined_items": 0,
        "candidate_break_items": 0,
    }
    for item in payload:
        decision = item.get("continuation_decision", "")
        if decision == PROVIDER_JOIN_DECISION:
            summary["joined_items"] += 1
            summary["provider_joined_items"] += 1
        elif decision == RULE_JOIN_DECISION:
            summary["joined_items"] += 1
            summary["rule_joined_items"] += 1
        elif decision == REVIEW_JOIN_DECISION:
            summary["joined_items"] += 1
            summary["review_joined_items"] += 1
        elif decision == "candidate_break":
            summary["candidate_break_items"] += 1
    return summary
