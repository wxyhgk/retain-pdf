from retainpdf_translation.services.continuation.rules import bbox
from retainpdf_translation.services.continuation.rules import normalize_text


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
    """复核通过的一对对块连成组。两块原来已经在组里（规则、OCR 判的）的，整组一起并进来，按阅读顺序排成一串。

    以前只把通过的这一串另起一个组号，覆盖掉块原来的组：2026-10-31 ACS 论文第 8—10 页同一段话
    p008-b021 → p009-b005 → p009-b006 → p010-b010 → p010-b011，复核把前两块连成一组，p009-b005 原来和 p009-b006
    的那组被覆盖，p009-b006 落单单独翻。返回改了的块数。"""
    if not approved_pairs:
        return 0
    order = {str(item.get("item_id", "")): index for index, item in enumerate(payload)}
    item_by_id = {str(item.get("item_id", "")): item for item in payload}
    parent: dict[str, str] = {}

    def find(item_id: str) -> str:
        parent.setdefault(item_id, item_id)
        while parent[item_id] != item_id:
            parent[item_id] = parent[parent[item_id]]
            item_id = parent[item_id]
        return item_id

    def union(a: str, b: str) -> None:
        parent[find(a)] = find(b)

    approved = [(a, b) for a, b in approved_pairs if a in item_by_id and b in item_by_id]
    for a, b in approved:
        union(a, b)
    # 已有的组：块所在的组整组并进来
    existing: dict[str, list[str]] = {}
    for item in payload:
        group_id = str(item.get("continuation_group") or "")
        if group_id:
            existing.setdefault(group_id, []).append(str(item.get("item_id", "")))
    touched = {find(i) for pair in approved for i in pair}
    for members in existing.values():
        if any(find(m) in touched for m in members if m in parent):
            for member in members[1:]:
                union(members[0], member)
    components: dict[str, list[str]] = {}
    for item_id in list(parent):
        components.setdefault(find(item_id), []).append(item_id)

    group_index = 1000
    annotated = 0
    for members in sorted(components.values(), key=lambda ids: min(order[i] for i in ids)):
        if len(members) < 2:
            continue
        chain = [item_by_id[i] for i in sorted(members, key=order.__getitem__)]
        group_index += 1
        group_id = f"cg-review-{group_index:04d}"
        for pos, item in enumerate(chain):
            if item.get("continuation_decision") != "review_joined" or item.get("continuation_group") != group_id:
                annotated += 1
            item["continuation_group"] = group_id
            item["continuation_decision"] = "review_joined"
            item["continuation_candidate_prev_id"] = ""
            item["continuation_candidate_next_id"] = ""
            item["continuation_prev_text"] = normalize_text(chain[pos - 1].get("protected_source_text", "")) if pos > 0 else ""
            item["continuation_next_text"] = normalize_text(chain[pos + 1].get("protected_source_text", "")) if pos < len(chain) - 1 else ""
    return annotated
