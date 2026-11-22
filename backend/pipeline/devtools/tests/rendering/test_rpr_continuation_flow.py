"""跨栏、跨页接续组交给 rpr 引擎按容量顺流切分（2026-11-22）：renderer 把各块的引擎文本接成整段，标在 flow 上。"""

from __future__ import annotations

from retainpdf_pipeline.render.output.rpr_fit.renderer import _translation_items


def _member(item_id: str, block_idx: int, translated: str, **extra) -> dict:
    item = {
        "item_id": item_id,
        "page_idx": int(item_id[1:4]) - 1,
        "block_idx": block_idx,
        "block_type": "text",
        "policy_translate": True,
        "should_translate": True,
        "source_text": "Some English source text that continues",
        "translated_text": translated,
        "protected_translated_text": translated,
        "continuation_group": "cg-001-001",
        "translation_unit_id": "__cg__:cg-001-001",
        "translation_unit_kind": "group",
        "translation_unit_member_ids": ["p001-b007", "p002-b000"],
        "bbox": [50, 600, 300, 700],
    }
    item.update(extra)
    return item


def _flows(pages: dict) -> dict:
    return {entry["item_id"]: entry.get("flow") for entry in _translation_items(pages)}


def test_members_carry_the_whole_paragraph_in_reading_order() -> None:
    first = _member("p001-b007", 7, "力场方法的基础是这样一个观察：分子往往由")
    second = _member("p002-b000", 0, "结构相似的单元组成，例如 $E_{vdw}$ 项。")
    flows = _flows({0: [first], 1: [second]})
    assert flows["p001-b007"]["index"] == 0 and flows["p002-b000"]["index"] == 1
    assert flows["p001-b007"]["count"] == 2
    text = flows["p001-b007"]["text"]
    assert text == flows["p002-b000"]["text"]
    assert text.startswith("力场方法的基础") and "由结构相似" in text  # 汉字之间直接接上，不加空格
    assert "$E_{vdw}$" in text


def test_latin_boundary_gets_a_space() -> None:
    first = _member("p001-b007", 7, "参见 Allinger and")
    second = _member("p002-b000", 0, "Burkert 的书。")
    assert "and Burkert" in _flows({0: [first], 1: [second]})["p001-b007"]["text"]


def test_groups_the_engine_must_not_recut_keep_the_translation_stage_split() -> None:
    first = _member("p001-b007", 7, "前半段")
    # 成员之间夹着独立公式：翻译阶段已在公式处切开
    gap = _member("p002-b000", 0, "后半段", translation_unit_formula_before="$$E=mc^2$$")
    assert _flows({0: [first], 1: [gap]}) == {"p001-b007": None, "p002-b000": None}
    # 有成员不在这次渲染里
    assert _flows({0: [_member("p001-b007", 7, "前半段")]}) == {"p001-b007": None}
    # 有成员没有译文
    empty = _member("p002-b000", 0, "", protected_translated_text="")
    assert _flows({0: [_member("p001-b007", 7, "前半段")], 1: [empty]})["p001-b007"] is None
