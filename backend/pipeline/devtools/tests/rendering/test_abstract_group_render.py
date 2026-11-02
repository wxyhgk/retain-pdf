"""摘要这类「合并几何」的翻译组：整段一次翻译，再按原来的几个框分开填，每段只画一次。

实测（BMC Neurol 2021, 21:433，Paddle）：摘要的 Background / Methodology / Results 三块被
翻译阶段合成一组（translation_group_strategy=aggregate_geometry）一起翻，渲染出来三个框
里各画了一遍整段译文。原因是 prepare_render_payloads_by_page 已经把整段按框切好，
build_render_blocks 又对每个 item seed_render_fields 一遍，按「组成员取整组译文」把切好的
结果覆盖回整段。

框保持原样、不合并：摘要可能分成好几块（同栏上下几块，或者绕着图一个窄框 + 一个通栏框），
设计就是一次翻译、分开填充。
"""

from retainpdf_pipeline.render.layout.payload.blocks import build_render_blocks
from retainpdf_pipeline.render.layout.payload.prepare import prepare_render_payloads_by_page
from retainpdf_pipeline.render.output.typst.source_builder import build_typst_book_overlay_source


UNIT_TEXT = (
    "背景：血管源性认知障碍正日益成为突出的健康威胁。"
    "方法：在一家三级医院开展了横断面研究，采用连续抽样招募门诊患者。"
    "结果：共纳入一千二百零一例高血压患者，约四成存在认知障碍。"
)
SOURCE_TEXTS = [
    "Background: The evolution of cognitive impairment of vascular origin is a growing health threat.",
    "Methodology: A hospital-based cross-sectional study was conducted using consecutive sampling.",
    "Results: A total of 1201 hypertensive patients were enrolled and about 40% had impairment.",
]
BOXES = [[59.0, 295.0, 532.0, 380.0], [59.0, 382.0, 531.0, 480.0], [57.0, 481.0, 532.0, 580.0]]


def _abstract_items() -> list[dict]:
    member_ids = [f"p001-b00{index}" for index in (8, 9, 10)]
    items = []
    for index, (item_id, bbox, source) in enumerate(zip(member_ids, BOXES, SOURCE_TEXTS)):
        items.append(
            {
                "item_id": item_id,
                "page_idx": 0,
                "block_idx": 8 + index,
                "reading_order": 8 + index,
                "block_type": "text",
                "block_kind": "text",
                "block_class": "body",
                "semantic_role": "abstract",
                "bbox": bbox,
                "source_text": source,
                "protected_source_text": source,
                "should_translate": True,
                "final_status": "translated",
                "translation_unit_id": "__cg__:abstract:p001-b008",
                "translation_unit_kind": "group",
                "translation_unit_member_ids": member_ids,
                "translation_unit_protected_source_text": " ".join(SOURCE_TEXTS),
                "translation_unit_protected_translated_text": UNIT_TEXT,
                "translation_unit_translated_text": UNIT_TEXT,
                "translation_group_id": "abstract:p001-b008",
                "translation_group_kind": "abstract",
                "translation_group_strategy": "aggregate_geometry",
                # 翻译阶段按比例切出来的成员译文：切点故意落在词中间。
                "protected_translated_text": UNIT_TEXT[index * 30 : (index + 1) * 30],
                "translated_text": UNIT_TEXT[index * 30 : (index + 1) * 30],
                "formula_map": [],
            }
        )
    return items


def test_aggregate_geometry_group_is_split_across_the_original_boxes() -> None:
    prepared = prepare_render_payloads_by_page({0: _abstract_items()}, first_line_indent_lookup={})[0]

    assert [item["bbox"] for item in prepared] == BOXES, "框被改了：摘要要按原来的几个框分开填"
    chunks = [item["render_protected_text"] for item in prepared]
    assert all(chunks), f"有框没分到译文：{chunks}"
    assert all(chunk != UNIT_TEXT for chunk in chunks), "某个框里塞了整段译文"
    assert "".join(chunks).count("背景：血管源性") == 1


def test_build_render_blocks_does_not_reseed_prepared_items() -> None:
    prepared = prepare_render_payloads_by_page({0: _abstract_items()}, first_line_indent_lookup={})

    blocks = build_render_blocks(prepared[0], page_width=595.0, page_height=791.0)

    texts = [block.plain_text for block in blocks if block.plain_text]
    assert sum("背景：血管源性" in text for text in texts) == 1, f"整段译文画了不止一次：{texts}"


def test_typst_overlay_source_contains_the_abstract_once() -> None:
    prepared = prepare_render_payloads_by_page({0: _abstract_items()}, first_line_indent_lookup={})

    source = build_typst_book_overlay_source([(595.0, 791.0, prepared[0])])

    assert source.count("背景：血管源性") == 1


def test_abstract_wrapping_a_figure_is_not_merged() -> None:
    """图旁窄框 + 图下通栏框：并集会盖住图，不能合并，仍按容量切回各框。"""
    items = _abstract_items()[:2]
    items[0]["bbox"] = [48.0, 270.0, 310.0, 415.0]
    items[1]["bbox"] = [48.5, 415.0, 557.0, 526.0]
    for item in items:
        item["translation_unit_member_ids"] = [items[0]["item_id"], items[1]["item_id"]]

    prepared = prepare_render_payloads_by_page({0: items}, first_line_indent_lookup={})[0]

    assert [item["bbox"] for item in prepared] == [[48.0, 270.0, 310.0, 415.0], [48.5, 415.0, 557.0, 526.0]]
    assert all(item["render_protected_text"] for item in prepared), "两个框都该有自己那一截"
    assert "".join(item["render_protected_text"] for item in prepared).count("背景：血管源性") == 1


def test_rpr_fit_lays_out_each_member_once() -> None:
    # rpr_fit 不走 prepare_render_payloads_by_page，每块直接 seed_render_fields：以前每块都拿整组译文，
    # 同一段话排两遍（2026-11-02 481 页的书第 395 页，一章开头的两段）。
    from retainpdf_pipeline.render.output.rpr_fit.renderer import _engine_text

    texts = [_engine_text(item) for item in _abstract_items()]
    assert all(texts), texts
    assert "".join(texts).count("背景：血管源性") == 1, texts


def test_a_failed_block_keeps_the_original_instead_of_the_ocr_text() -> None:
    # 一张带 Goldstone 图的表被 OCR 当成正文，翻译失败。以前按 OCR 文字（含公式）重排一遍盖上去，图没了；
    # 底图本来就没去掉它的原文，交给引擎空的（保留元素）原文就在。
    from retainpdf_pipeline.render.layout.payload.render_item import seed_render_fields
    from retainpdf_pipeline.render.output.rpr_fit.renderer import _engine_text

    item = {
        "item_id": "p379-b001",
        "page_idx": 378,
        "block_type": "text",
        "bbox": [36.0, 73.5, 330.9, 548.5],
        "source_text": r"1 $r$ $a$ $(-)^{2+2} \left(\frac{1}{2}\right) \sum_{abrs} x$",
        "protected_source_text": r"1 $r$ $a$ $(-)^{2+2} \left(\frac{1}{2}\right) \sum_{abrs} x$",
        "translated_text": "",
        "should_translate": True,
        "final_status": "failed",
        "formula_map": [],
    }
    assert _engine_text(dict(item)) == ""
    seeded = dict(item)
    seed_render_fields(seeded)
    assert seeded["render_protected_text"] == ""
    # 没失败、只是不翻译的公式块照旧按原文重排
    formula = dict(item, final_status="kept_origin", should_translate=False, skip_reason="skip_inline_formula")
    seed_render_fields(formula)
    assert formula["render_protected_text"]
