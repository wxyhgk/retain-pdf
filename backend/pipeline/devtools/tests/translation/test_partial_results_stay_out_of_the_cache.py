"""降级过的译文不许被当成完整成功结果缓存起来。

direct_typst 的长文切分（>4000 字符）把大块切开分别翻译。某个块失败时走「部分接受」:
用**原始英文/LaTeX 源文**顶替那一段,不因一个块的瞬时失败作废整条大块。

问题出在错位:result_entry 无条件把顶层 final_status 设成 "translated",而
should_store_translation_result 读的正是顶层。降级信息只写进了 translation_diagnostics,
于是一段夹着未翻译英文的译文被当成完整成功结果写进单元缓存（默认 TTL 90 天）,
此后每一次重翻都命中它,而且表现成「重翻也没用」。

这和 `<f5-4bb/>` 那次缓存污染是同一种事故:一次写入,污染此后每一次运行。区别在于
那次靠 token 形状还能识别,这次的坏数据看起来和好数据一模一样。

sentence_level 那条降级路径一直是在顶层写的,长文切分漏了。两条路必须一致。
"""

from __future__ import annotations


from retainpdf_translation.core.payload.parts.final_status import (  # noqa: E402
    PARTIALLY_TRANSLATED_STATUS,
)
from retainpdf_translation_classic.llm.shared.orchestration.direct_typst_long_text import (  # noqa: E402
    translate_direct_typst_long_text_chunks,
)
from retainpdf_translation_classic.llm.shared.orchestration.metadata import (  # noqa: E402
    should_store_translation_result,
)

ITEM_ID = "p001-b001"
# 每句都够长,切出来稳定多于一块（阈值 4000 字符 / 目标 2200）。
SENTENCE = "The conical intersection governs the nonadiabatic dynamics of this molecular system. "
SOURCE = SENTENCE * 70


def _item() -> dict:
    return {
        "item_id": ITEM_ID,
        "page_idx": 0,
        "math_mode": "direct_typst",
        "protected_source_text": SOURCE,
        "translation_unit_protected_source_text": SOURCE,
    }


def _run(*, fail_chunk: int | None) -> dict:
    """跑一次长文切分,fail_chunk 指定第几块翻译失败（None 表示全部成功）。"""
    calls: list[str] = []

    def translator(chunk_item, **_kwargs):
        index = len(calls)
        calls.append(chunk_item["protected_source_text"])
        if index == fail_chunk:
            return {ITEM_ID: {"decision": "translate", "translated_text": ""}}
        return {ITEM_ID: {"decision": "translate", "translated_text": f"译文{index}"}}

    result = translate_direct_typst_long_text_chunks(
        _item(),
        api_key="k",
        model="m",
        base_url="http://localhost",
        request_label="",
        context=None,
        diagnostics=None,
        translator=translator,
    )
    assert result is not None and len(calls) > 1, "源文没有被切成多块，用例失效"
    return result[ITEM_ID]


def test_every_chunk_succeeded_is_cacheable() -> None:
    payload = _run(fail_chunk=None)

    assert payload["final_status"] == "translated"
    assert should_store_translation_result(payload)


def test_a_partially_accepted_result_never_reaches_the_cache() -> None:
    """一个块失败 → 顶层降级 → 缓存判定拒绝它。

    这三步缺一不可:降级信息只写进 diagnostics 时,缓存判定看不到。
    """
    payload = _run(fail_chunk=1)

    assert payload["final_status"] == PARTIALLY_TRANSLATED_STATUS, (
        "顶层仍是 translated,夹着英文原文的译文会被写进 90 天缓存"
    )
    assert not should_store_translation_result(payload)


def test_the_failed_chunk_is_replaced_by_untranslated_source() -> None:
    """钉住「为什么这条结果不能缓存」——它里面真的有未翻译的英文。

    部分接受本身是有意的取舍（不因一个块的瞬时失败作废 4000+ 字符）,坏的是把这种
    结果当成完整成功存起来。
    """
    payload = _run(fail_chunk=1)

    assert "conical intersection" in payload["translated_text"], "失败块没有回填原文，用例失效"
    assert payload["translation_diagnostics"]["degraded_chunk_count"] == 1
    assert payload["translation_diagnostics"]["final_status"] == PARTIALLY_TRANSLATED_STATUS
