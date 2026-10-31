"""跨栏跨页的一段话被拆成好几块：页首是图注时也要接上；规则和模型复核各连了一截时要并成一组。

回归：2026-10-31 ACS 论文第 8—10 页同一段话 p008-b021 → p009-b005 → p009-b006 → p010-b010 → p010-b011，
第 10 页最上面是图注，"As macro-" / "phages are …" 被判成接到页中间、没人复核；复核把前两块连成新组时覆盖了
p009-b005 原来和 p009-b006 的那组，p009-b006 落单单独翻。
"""

from retainpdf_translation.services.continuation import pairs
from retainpdf_translation.services.continuation import state


def _body(item_id: str, page_idx: int, text: str, *, rank: int, size: int, top: float = 600) -> dict:
    return {
        "item_id": item_id,
        "page_idx": page_idx,
        "block_idx": rank,
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": True,
        "raw_block_type": "text",
        "normalized_sub_type": "body",
        "bbox": [60, top, 540, top + 60],
        "protected_source_text": text,
        "source_text": text,
        "layout_mode": "single",
        "layout_zone": "single_column",
        "layout_zone_rank": rank,
        "layout_zone_size": size,
        "layout_boundary_role": "single" if size == 1 else ("head" if rank == 0 else "tail" if rank == size - 1 else "middle"),
    }


def _caption(item_id: str, page_idx: int, text: str, *, rank: int, size: int) -> dict:
    item = _body(item_id, page_idx, text, rank=rank, size=size, top=80)
    item.update(layout_role="caption", semantic_role="metadata", structure_role="figure_caption", normalized_sub_type="figure_caption")
    return item


def _payload() -> list[dict]:
    return [
        _body("p1-a", 0, "The engineered vesicles were tracked in the lungs over three days after inhalation, and as macro-", rank=0, size=1),
        _caption("p2-cap", 1, "Figure 6. Inhibition of lung metastasis after nebulized inhalation of the engineered vesicles.", rank=0, size=2),
        _body("p2-a", 1, "phages are the main immune clearance cells in the lungs, we stained the sections and found that", rank=1, size=2),
    ]


def test_a_caption_at_the_top_of_the_next_page_does_not_block_the_join() -> None:
    payload = _payload()
    state.annotate_continuation_context(payload)
    by_id = {item["item_id"]: item for item in payload}
    assert by_id["p1-a"]["continuation_group"] and by_id["p1-a"]["continuation_group"] == by_id["p2-a"]["continuation_group"]
    assert not by_id["p2-cap"].get("continuation_group")


def test_a_review_join_merges_the_groups_its_blocks_already_belong_to() -> None:
    texts = ["first part of the paragraph that goes on", "and on in the left column of the page", "then the right column continues the", "same sentence to its end on the next page."]
    payload = [_body(f"b{i}", i // 2, text, rank=i % 2, size=2) for i, text in enumerate(texts)]
    for item in payload[1:3]:
        item["continuation_group"] = "cg-rule"  # 规则连好的中间两块
    payload[3]["continuation_group"] = "cg-other"
    assert pairs.apply_candidate_pair_joins(payload, [("b0", "b1"), ("b2", "b3")]) == 4
    groups = {item["continuation_group"] for item in payload}
    assert len(groups) == 1 and next(iter(groups)).startswith("cg-review-")
    assert [item["continuation_prev_text"] != "" for item in payload] == [False, True, True, True]


def test_a_join_rejected_while_extending_a_chain_goes_to_review() -> None:
    """链条延伸到跨页那一对时，判定说"落在下一页中间、不能直接连"：以前就此断开、谁也不审，现在标成候选交给模型复核。"""
    payload = [
        _body("a", 0, "Earlier in the same paragraph the authors note that the engineered", rank=0, size=1),
        _body("b", 1, "vesicles were tracked in the lungs over three days, and as macro-", rank=0, size=1),
        _body("c", 2, "phages are the main immune clearance cells in the lungs, we stained the sections", rank=0, size=1),
    ]
    for item in payload[2:]:
        # 下一页的分区排序不全（只知道它在页中间）：照旧按 layout_boundary_role 判
        item.update(layout_boundary_role="middle", layout_zone_rank=-1, layout_zone_size=-1)
    state.annotate_continuation_context(payload)
    a, b, c = payload
    assert a["continuation_group"] and a["continuation_group"] == b["continuation_group"] and not c.get("continuation_group")
    assert [(p["prev_item_id"], p["next_item_id"]) for p in pairs.candidate_continuation_pairs(payload)] == [("b", "c")]
