"""Pre-refactor message digests and isolation of formerly live raw-item reads."""
from dataclasses import FrozenInstanceError
import hashlib
import json

import pytest

from retainpdf_pipeline.translate.core.context import build_item_context, TranslationItemContext
from retainpdf_pipeline.translate.llm.shared.prompt_building import (
    build_messages, build_group_member_messages, build_single_item_fallback_messages,
)


def _item(math_mode):
    return dict(item_id="a", source_text="Energy $E$ remains.", math_mode=math_mode,
                structure_role="reference", _scoped_terms_guidance="Energy => 能量",
                translation_unit_member_ids=[" b ", "a", "b", "missing"],
                translation_unit_members=[{"item_id": "b", "source_text": "First."},
                                          {"item_id": "a", "protected_source_text": "Energy $E$"},
                                          {"item_id": "b", "source_text": "Last."}],
                translation_context_after="Next sentence.")


_BUILDERS = [build_single_item_fallback_messages, lambda item: build_messages([item]), build_group_member_messages]
# Captured from the previous implementation, not computed by the new renderer.
#
# direct_typst 这组在 mitex 升到 0.2.7 后重录过一次:公式指引改成明确要求 LaTeX
# (原文说的是"direct_typst 公式直出模式",含糊到模型真的会吐 Typst 语法),并去掉
# 了让模型把 \hbar 之类换成 Unicode 的降级要求。提示词是有意改的,所以摘要跟着变。
#
# placeholder 那组一字未动,正说明改动只落在 direct_typst 路径上——重录时要一并
# 确认这一点,否则就是改宽了。
#
# 第二次重录:引用规则从「论文引用统一输出 $^{117}$」改成「行内方括号 [n] 原样、原文是上标才
# 输出上标」(模型曾把行内 [n] 改上标且只改一部分,同篇混排)。placeholder 那组同样一字未动。
#
# 第三次重录：两组都变了，因为改的是两组共用的系统提示——把系统提示和任务说明里重复的规则
# 合并成一份分节的提示（「半句照翻」原来写了 3 遍），并新增三条有数据支撑的规则：交叉引用
# 对照（31 本书里 Equation 译「式」360 次、「方程」83 次、「公式」15 次）、中文全角标点、
# 有通行译名的术语一律译出。公式指引去掉了 mitex 专属的说法（默认渲染已是自研引擎）。
_DIGESTS = {
    False: ["08de9ab4706cf7e51eda603ddedd873151bdf31b963ca98289f8465e3a0d345f",
            "3a0a2fb7259d3f50fb40436f1e0ef928e94baf0bc474c98c58f8be2133eaf2ba",
            "3b590084224ff45e9cf64a3c50d22fc94d8436a1fe3b4eefee85f2188fdaf967"],
    True: ["0d047272000fd9d4440c09dcb413311fe9b5f26d3a30a9f03f4dd85a288defe2",
           "63f5b6bcd5ef33873f43bfd084f8659315877c243a9ce478e1cfd89bb89508dd",
           "f79fab60e64d467f8ea8786a9e1f5e2eacedf09175249f4b86909062c8188176"],
}


@pytest.mark.parametrize("math_mode", ["placeholder", "direct_typst", " direct_typst ", ""])
@pytest.mark.parametrize("route", range(3))
def test_messages_match_pre_snapshot_bytes(math_mode, route):
    messages = _BUILDERS[route](_item(math_mode))
    digest = hashlib.sha256(json.dumps(messages, ensure_ascii=False).encode()).hexdigest()
    # 空串走默认值,而默认值已从 placeholder 改成 direct_typst——所以这里只有明确
    # 写了 "placeholder" 才算 placeholder,其余(含空串)都是 direct_typst。
    is_direct = math_mode.strip() != "placeholder"
    assert digest == _DIGESTS[is_direct][route]


@pytest.mark.parametrize("direct_constructor", [False, True])
def test_source_mutation_cannot_change_prompt_values(direct_constructor):
    original = _item("direct_typst")
    context = (TranslationItemContext(item_id="a", source_text=original["source_text"],
                                     protected_source_text=original["source_text"],
                                     math_mode="direct_typst", raw_item=original)
               if direct_constructor else build_item_context(original))
    before = [builder(context) for builder in _BUILDERS]
    original["_scoped_terms_guidance"] = "CHANGED"
    original["structure_role"] = "title"
    original["math_mode"] = "placeholder"
    original["translation_unit_member_ids"].reverse()
    original["translation_unit_members"][2]["source_text"] = "CHANGED"
    original["translation_unit_members"].append({"item_id": "missing", "source_text": "NEW"})
    assert [builder(context) for builder in _BUILDERS] == before
    assert context.raw_item is original  # Compatibility handle, not prompt authority.
    with pytest.raises(FrozenInstanceError):
        context.scoped_terms_guidance = "changed"
    group = json.loads(before[2][1]["content"])["group"]
    assert group["member_ids"] == ["b", "a", "b", "missing"]
    assert group["members"][0]["source_text"] == "Last."
    assert group["combined_source_text"] == original["source_text"]


def test_direct_constructor_keeps_historical_raw_math_mode_distinction():
    context = TranslationItemContext(item_id="a", source_text="$E", protected_source_text="$E",
                                     math_mode="direct_typst", raw_item={})
    payload = json.loads(build_group_member_messages(context)[1]["content"])
    assert "math_delimiter_note" not in payload["group"]
    assert payload["group"]["member_ids"] == ["a"]


@pytest.mark.parametrize("value", [None, [], 7, "invalid"])
def test_optional_unused_member_metadata_does_not_break_single_route(value):
    original = _item("placeholder")
    original.pop("translation_unit_member_ids")
    original.pop("translation_unit_members")
    expected = build_single_item_fallback_messages(original)
    original.update(translation_unit_member_ids=value, translation_unit_members=value)
    assert build_single_item_fallback_messages(original) == expected


@pytest.mark.parametrize("field", ["translation_unit_member_ids", "translation_unit_members"])
@pytest.mark.parametrize("value", [None, 7, False])
def test_invalid_group_metadata_fails_only_when_group_consumes_it(field, value):
    original = _item("placeholder")
    original[field] = value
    context = build_item_context(original)
    build_single_item_fallback_messages(context)
    # Mutating the source after extraction cannot erase the captured failure.
    original[field] = []
    with pytest.raises(TypeError, match=f"'{type(value).__name__}' object is not iterable"):
        build_group_member_messages(context)


def test_historical_iterable_member_metadata_is_not_newly_validated():
    original = _item("placeholder")
    original.update(translation_unit_member_ids="ab", translation_unit_members={"a": "ignored"})
    group = json.loads(build_group_member_messages(original)[1]["content"])["group"]
    assert group["member_ids"] == ["a", "b"]
    assert [member["source_text"] for member in group["members"]] == ["", ""]
