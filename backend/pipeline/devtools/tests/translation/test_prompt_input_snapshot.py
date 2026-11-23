"""Pre-refactor message digests and isolation of formerly live raw-item reads."""
from dataclasses import FrozenInstanceError
import hashlib
import json

import pytest

from retainpdf_translation.core.context import build_item_context, TranslationItemContext
from retainpdf_translation_classic.llm.shared.prompt_building import (
    build_messages, build_single_item_fallback_messages,
)


def _item(math_mode):
    return dict(item_id="a", source_text="Energy $E$ remains.", math_mode=math_mode,
                structure_role="reference", _scoped_terms_guidance="Energy => 能量",
                translation_unit_member_ids=[" b ", "a", "b", "missing"],
                translation_unit_members=[{"item_id": "b", "source_text": "First."},
                                          {"item_id": "a", "protected_source_text": "Energy $E$"},
                                          {"item_id": "b", "source_text": "Last."}],
                translation_context_after="Next sentence.")


_BUILDERS = [build_single_item_fallback_messages, lambda item: build_messages([item])]
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
#
# 第四次重录：逐段请求（route 0，两组）改了排法——前后文挪到原文前面并用起止标记括起来，
# 作答要求放最后一行（原来夹在中间，模型读完一串「后文上下文：……」后自己补了个「译文：」）。
# direct_typst 的整批请求（route 1）只换了格式示例里占位的那行；placeholder 的整批请求走 JSON，一字未动。
#
# 第五次重录（2026-11-23）：系统提示的「忠实」一句改成「不增删；只交译文，不加“这是…”“译文如下”等说明，
# 索引照译」，末句去掉重复的「不附加解释」（固定提示有 1200 字上限，加一整行会超）。两本教材里
# claude-haiku-5-5 把「这是一个索引条目列表，页码需保留。译文如下：」「…的译文需要准确。」这类话写进了译文。
# 四组请求都只有这两句变了（重录前逐字比过）；冻结基线 28 例同样只变这两句和 prompt_hash。
_DIGESTS = {
    False: ["20cdb349225152f713a31d90ecd82b43bf90a4b33290c83c300808cebb1364aa",
            "9aaea30ac6e2c18450924ffae5b39b334e5a90d01d195f4c2a39f5d6474451c4"],
    True: ["f93f23d23fa342ab387066cc0ce5e019a834f390f7ea705cb5bed22923194f0e",
           "a02a7172b24f3c4097ae254fe8e04bafc9ee73bb6a3ea9dc8aa537f371ed528e"],
}


@pytest.mark.parametrize("math_mode", ["placeholder", "direct_typst", " direct_typst ", ""])
@pytest.mark.parametrize("route", range(len(_BUILDERS)))
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


@pytest.mark.parametrize("value", [None, [], 7, "invalid"])
def test_optional_unused_member_metadata_does_not_break_single_route(value):
    original = _item("placeholder")
    original.pop("translation_unit_member_ids")
    original.pop("translation_unit_members")
    expected = build_single_item_fallback_messages(original)
    original.update(translation_unit_member_ids=value, translation_unit_members=value)
    assert build_single_item_fallback_messages(original) == expected
