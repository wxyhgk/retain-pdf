"""同一段里出现两个完全一样的 span 时，跨页恢复不该炸。

4.2.5 的两个缺陷，成因不同、触发条件也不同，但都只在「重复 key」时暴露 ——
单个 span 的路径上两处写法恰好都是对的，所以一直没被发现：

1. `physical[_key(span)]` 按 span 逐条 append。同段两个一样的 span 会塞进两条，
   但**两条指向同一个 block**。`len(matches) != 1` 本意是拦「页面归属不明确」，
   去重前分不清「同一个 block 被数了两次」和「落在不同 block 上」。
2. 覆盖检查写的是 `existing | plan["spans"]`，`Counter.__or__` 取逐键 max。
   段落被跨页切开、切开的两半各有一个一样的 span 时，existing=1 / plan=1 →
   max 仍是 1，而 expected=2，误报 incomplete coverage。

这两条都不能靠放宽检查来修 —— 真歧义、真覆盖不全必须继续挡住，见文件末尾。
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.cross_page import (  # noqa: E402
    restore_cross_page_spans,
)

FORMULA = {"type": "inline_equation", "content": "E=mc^2", "bbox": [10, 10, 50, 20]}
CROSS = {**FORMULA, "cross_page": True}


def _block(spans, *, index=0):
    return {
        "type": "text",
        "index": index,
        "bbox": [0, 0, 100, 30],
        "lines": [{"bbox": [0, 0, 100, 30], "spans": [dict(s) for s in spans]}],
    }


def _page(para=(), preproc=()):
    return {
        "para_blocks": list(para),
        "preproc_blocks": list(preproc),
        "discarded_blocks": [],
    }


@pytest.mark.parametrize("count", [1, 2, 3])
def test_identical_spans_in_one_paragraph_recover(count: int) -> None:
    """缺陷 1：整段都在前一页、被整体标成 cross_page。"""
    pages = [
        _page(para=[_block([CROSS] * count)]),
        _page(para=[_block([])], preproc=[_block([FORMULA] * count)]),
    ]
    _, stats = restore_cross_page_spans(pages)
    assert stats["cross_page_recovered_span_count"] == count
    assert stats["cross_page_recovered_block_count"] == 1


def test_paragraph_split_across_pages_with_identical_spans() -> None:
    """缺陷 2：段落真被切开，两半各有一个一样的 span。

    existing=1、plan=1、expected=2 —— 取 max 会算成 1 而误报覆盖不全。
    """
    pages = [
        _page(para=[_block([CROSS])]),
        _page(para=[_block([FORMULA])], preproc=[_block([FORMULA, FORMULA])]),
    ]
    _, stats = restore_cross_page_spans(pages)
    assert stats["cross_page_recovered_span_count"] == 1


# —— 下面三条守的是「别为了修上面两条把闸门拆了」——


def test_same_content_on_two_different_pages_is_still_ambiguous() -> None:
    with pytest.raises(ValueError, match="physical matches"):
        restore_cross_page_spans([
            _page(para=[_block([CROSS])]),
            _page(para=[_block([])], preproc=[_block([FORMULA], index=0)]),
            _page(para=[_block([])], preproc=[_block([FORMULA], index=1)]),
        ])


def test_missing_physical_evidence_still_fails() -> None:
    with pytest.raises(ValueError, match="physical matches"):
        restore_cross_page_spans([
            _page(para=[_block([CROSS])]),
            _page(para=[_block([])]),
        ])


def test_incomplete_span_coverage_still_fails() -> None:
    other = {**FORMULA, "content": "F=ma"}
    with pytest.raises(ValueError, match="incomplete span coverage"):
        restore_cross_page_spans([
            _page(para=[_block([CROSS])]),
            _page(para=[_block([])], preproc=[_block([FORMULA, other])]),
        ])
