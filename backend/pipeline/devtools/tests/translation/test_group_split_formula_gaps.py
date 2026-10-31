"""接续组跨过独立公式：公式原文放进拼好的整段，切回各块时在公式处切开。

2026-10-30 量子化学-14（legacy，claude-haiku-5-5）17 个接续组有 10 个两块之间夹着独立公式。拼组只用空格连两块，
模型看到 "whose $ x $ component is with similar expressions"，自己编了一个公式写进正文（p003-b022）；公式后面的
"where φ is the spatial factor" 被按比例切到公式前面那块（p002-b013）；模型把后半句的行内公式写成多行 `$$`，
切点落进 `$$` 里，两块都渲染坏（p029-b019 / p030-b004）。同一批还修句末角标被切到下一块开头（Jensen 第 12 章 p035-b008）。
"""

from __future__ import annotations

from retainpdf_translation.core.context.models import TranslationItemContext
from retainpdf_translation.core.payload.parts.apply import apply_group_translated_entry
from retainpdf_translation.core.payload.parts.group_split import split_group_protected_translation
from retainpdf_translation.core.payload.parts.units import pending_translation_items
from retainpdf_translation.llm.shared.prompt_protocols import DISPLAY_FORMULA_IN_TEXT_HINT
from retainpdf_translation.llm.shared.prompt_protocols import direct_typst_single_user_prompt

FORMULA = r"$$ \mu_{x,\mathrm{c l}}=\sum_{i}Q_{i}x_{i} $$"
HEAD = r"where $ \mathbf{r}_{i} $ is the position vector from the origin to the $ i $th charge. The electric dipole moment is a vector whose $ x $ component is"
TAIL = "with similar expressions for the other components. For a continuous charge distribution, the moment is found by summing over the infinitesimal elements of charge."


def _item(item_id: str, source: str, *, group: str = "cg-test", block_type: str = "text", translate: bool = True) -> dict:
    return {
        "item_id": item_id,
        "block_type": block_type,
        "math_mode": "direct_typst",
        "should_translate": translate,
        "continuation_group": group,
        "protected_source_text": source,
        "source_text": source,
        "formula_map": [],
        "protected_map": [],
    }


def _payload() -> list[dict]:
    return [
        _item("p003-b022", HEAD),
        _item("p004-b002", FORMULA, group="", block_type="formula", translate=False),
        _item("p004-b004", TAIL),
    ]


def test_the_formula_between_two_halves_is_put_into_the_joined_source() -> None:
    payload = _payload()
    (unit,) = pending_translation_items(payload)

    assert unit["protected_source_text"] == f"{HEAD}\n{FORMULA}\n{TAIL}"
    assert payload[2]["translation_unit_formula_before"] == FORMULA
    assert payload[0]["translation_unit_formula_before"] == ""
    assert unit["translation_unit_members"][1]["formula_before"] == FORMULA


def test_placeholder_mode_does_not_get_the_formula() -> None:
    payload = _payload()
    for item in payload:
        item["math_mode"] = "placeholder"
    (unit,) = pending_translation_items(payload)
    assert "$$" not in unit["protected_source_text"]


def test_the_split_falls_on_the_formula_and_the_formula_is_dropped() -> None:
    payload = _payload()
    pending_translation_items(payload)
    members = [payload[0], payload[2]]
    translation = (
        r"其中 $ \mathbf{r}_{i} $ 是从原点指向第 $ i $ 个电荷的位置矢量。电偶极矩是一个矢量，其 $ x $ 分量为"
        "\n" + FORMULA + "\n"
        "，其他分量的表达式类似。对于连续电荷分布，偶极矩通过对各无穷小电荷元求和得到。"
    )
    apply_group_translated_entry(members, {"decision": "translate", "translated_text": translation})

    assert payload[0]["translated_text"].endswith(r"其 $ x $ 分量为")
    assert payload[2]["translated_text"].startswith("其他分量的表达式类似。")
    assert "$$" not in payload[0]["translated_text"] + payload[2]["translated_text"]


def test_a_slightly_rewritten_formula_is_still_found() -> None:
    members = [_payload()[0], _payload()[2]]
    members[1]["translation_unit_formula_before"] = FORMULA
    translation = "前半句的译文很长很长，其 $ x $ 分量为 $$\\mu_{x,\\mathrm{c l}} = \\sum_i Q_i x_i$$ 后半句的译文。"
    first, second = split_group_protected_translation(translation, members)
    assert first == "前半句的译文很长很长，其 $ x $ 分量为" and second == "后半句的译文。"


def test_if_the_model_drops_the_formula_the_split_falls_back_to_the_ratio() -> None:
    members = [_payload()[0], _payload()[2]]
    members[1]["translation_unit_formula_before"] = FORMULA
    translation = "其中位置矢量从原点指向电荷。电偶极矩是一个矢量，其 $ x $ 分量为如上。其他分量的表达式类似。对于连续分布求和得到。"
    chunks = split_group_protected_translation(translation, members)
    assert "".join(chunks) == translation and all(chunks)


def test_display_math_is_never_cut_and_is_made_inline_when_the_source_had_none() -> None:
    # p029-b019 / p030-b004：模型把行内公式写成多行 `$$`，以前切点落在 `$$\n\` 后面
    members = [
        _item("a", "From (14.134), the z component of the effective force on nucleus a due to the element is"),
        _item("b", r"since $ \cos\theta_a = (-z_a + z)/r_a $. ( $ z_a $ is negative.)"),
    ]
    translation = "由式（14.134）可得，电子电荷元对核 a 的有效力的 z 分量为\n\n$$\n\\cos\\theta_a = (-z_a + z)/r_a\n$$\n\n其中 $z_a$ 为负值。"
    for weights in ((40, 60), (60, 40), (80, 20)):
        members[0]["protected_source_text"] = "word " * weights[0]
        members[1]["protected_source_text"] = "word " * weights[1]
        chunks = split_group_protected_translation(translation, members)
        assert all(chunk.count("$") % 2 == 0 for chunk in chunks), chunks
        assert "$$" not in "".join(chunks)
        assert r"$\cos\theta_a = (-z_a + z)/r_a$" in "".join(chunks)


def test_a_citation_after_a_full_stop_goes_with_its_sentence() -> None:
    # Jensen 第 12 章 p035-b008：`。$^{55}$` 以前被切到下一页那块的开头
    members = [
        _item("p035-b008", "The idea in Distance Geometry methods is that trial geometries can be generated from bounds. $ ^{55} $ The method"),
        _item("p036-b002", "was originally developed for generating possible geometries based on experimental information such as NMR NOE effects, " * 3),
    ]
    translation = "距离几何方法的基本思想是：可以由距离上下限生成试验几何结构。$^{55}$ 该方法最初用于根据实验信息生成可能的几何结构。" * 1 + "例如 NMR NOE 效应施加的约束。" * 6
    first, second = split_group_protected_translation(translation, members)
    assert not second.startswith("$"), second
    assert first.endswith("$^{55}$") or "$^{55}$" in first


def test_the_hint_is_added_only_when_the_source_has_a_display_formula() -> None:
    joined = f"{HEAD}\n{FORMULA}\n{TAIL}"
    with_formula = TranslationItemContext(item_id="u", source_text=joined, protected_source_text=joined)
    plain = TranslationItemContext(item_id="v", source_text=TAIL, protected_source_text=TAIL)
    assert DISPLAY_FORMULA_IN_TEXT_HINT in direct_typst_single_user_prompt(with_formula, mode="sci")
    assert DISPLAY_FORMULA_IN_TEXT_HINT not in direct_typst_single_user_prompt(plain, mode="sci")
