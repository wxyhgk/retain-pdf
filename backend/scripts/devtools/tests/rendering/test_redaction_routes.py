from __future__ import annotations

import sys
from pathlib import Path

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.source.cleanup import routes
from services.rendering.source.cleanup import standard
from services.rendering.source.cleanup import text_layer
from services.rendering.source.cleanup import visual_cover


class _FakePage:
    def __init__(self) -> None:
        self.redact_annots: list[tuple[fitz.Rect, object]] = []
        self.redaction_calls: list[dict[str, object]] = []

    def add_redact_annot(self, rect: fitz.Rect, fill=None) -> None:
        self.redact_annots.append((rect, fill))

    def apply_redactions(self, *, images, graphics, text) -> None:
        self.redaction_calls.append(
            {
                "images": images,
                "graphics": graphics,
                "text": text,
            }
        )


def test_apply_standard_redaction_uses_text_only_rects_for_mixed_items(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(10, 10, 100, 40)
    valid_items = [(rect, {"item_id": "p002-b001"}, "目录")]
    covered_rects: list[fitz.Rect] = []
    removable_rect = fitz.Rect(12, 12, 90, 34)

    monkeypatch.setattr(standard, "collect_page_drawing_rects", lambda _page: [fitz.Rect(0, 0, 120, 60)])
    monkeypatch.setattr(standard, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(standard, "item_removable_text_rects", lambda _page, _item, _rect, **_kwargs: [removable_rect])
    monkeypatch.setattr(
        standard,
        "draw_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )
    monkeypatch.setattr(standard, "resolved_fill_color", lambda _page, _rect, fill: fill)

    routes.apply_standard_redaction(page, valid_items)

    assert covered_rects == []
    assert page.redact_annots == [(removable_rect, None)]
    assert page.redaction_calls == [
        {
            "images": fitz.PDF_REDACT_IMAGE_NONE,
            "graphics": fitz.PDF_REDACT_LINE_ART_NONE,
            "text": fitz.PDF_REDACT_TEXT_REMOVE,
        }
    ]


def test_apply_standard_redaction_keeps_text_layer_cleanup_for_plain_text(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(10, 10, 100, 40)
    valid_items = [(rect, {"item_id": "p004-b003"}, "正文")]
    covered_rects: list[fitz.Rect] = []

    monkeypatch.setattr(standard, "collect_page_drawing_rects", lambda _page: [fitz.Rect(0, 0, 120, 60)])
    monkeypatch.setattr(standard, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(standard, "item_removable_text_rects", lambda _page, _item, _rect: [rect])
    monkeypatch.setattr(
        standard,
        "draw_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )
    monkeypatch.setattr(standard, "resolved_fill_color", lambda _page, _rect, fill: fill)

    routes.apply_standard_redaction(page, valid_items)

    assert covered_rects == []
    assert page.redact_annots == [(rect, None)]
    assert page.redaction_calls == [
        {
            "images": fitz.PDF_REDACT_IMAGE_NONE,
            "graphics": fitz.PDF_REDACT_LINE_ART_NONE,
            "text": fitz.PDF_REDACT_TEXT_REMOVE,
        }
    ]


def test_apply_standard_redaction_fast_page_cover_only_for_fragmented_page(monkeypatch) -> None:
    page = _FakePage()
    valid_items = [
        (fitz.Rect(10, 10, 100, 40), {"item_id": "p040-b001"}, "目录甲"),
        (fitz.Rect(10, 50, 100, 80), {"item_id": "p040-b002"}, "目录乙"),
    ]
    covered_rects: list[fitz.Rect] = []
    fragmented_rects_a = [fitz.Rect(x, 10, x + 2, 18) for x in range(10, 130, 4)]
    fragmented_rects_b = [fitz.Rect(x, 50, x + 2, 58) for x in range(10, 150, 4)]

    monkeypatch.setattr(standard, "collect_page_drawing_rects", lambda _page: [])
    monkeypatch.setattr(standard, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(
        standard,
        "item_removable_text_rects",
        lambda _page, item, _rect: fragmented_rects_a if item["item_id"] == "p040-b001" else fragmented_rects_b,
    )
    monkeypatch.setattr(
        standard,
        "draw_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )

    diagnostics = routes.apply_standard_redaction(page, valid_items)

    assert diagnostics["fast_page_cover_only"] is True
    assert diagnostics["route"] == "fast_page_cover_only"
    assert page.redact_annots == [
        (fitz.Rect(10, 10, 100, 40), False),
        (fitz.Rect(10, 50, 100, 80), False),
    ]
    assert page.redaction_calls == [
        {
            "images": fitz.PDF_REDACT_IMAGE_NONE,
            "graphics": fitz.PDF_REDACT_LINE_ART_NONE,
            "text": fitz.PDF_REDACT_TEXT_REMOVE,
        }
    ]
    assert covered_rects == [fitz.Rect(10, 10, 100, 40), fitz.Rect(10, 50, 100, 80)]


def test_apply_standard_redaction_uses_bbox_for_continuation_items(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(314, 296, 560, 451)
    valid_items = [(rect, {"item_id": "p007-b011", "continuation_group": "cg-007-011"}, "中文")]

    monkeypatch.setattr(standard, "collect_page_drawing_rects", lambda _page: [])
    monkeypatch.setattr(standard, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(
        standard,
        "item_removable_text_rects",
        lambda _page, _item, _rect: [fitz.Rect(320, 320, 540, 430)],
    )
    monkeypatch.setattr(standard, "resolved_fill_color", lambda _page, _rect, fill: fill)

    diagnostics = routes.apply_standard_redaction(page, valid_items)

    assert diagnostics["raw_removable_rects"] == 0
    assert page.redact_annots == [(rect, None)]


def test_apply_standard_redaction_uses_visual_cover_for_complex_inline_math(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(10, 10, 160, 46)
    item = {
        "item_id": "p003-b004",
        "source_text": r"signal $\sqrt{x_i}$ remains stable",
        "translated_text": r"信号 $\sqrt{x_i}$ 保持稳定",
    }
    valid_items = [(rect, item, item["translated_text"])]
    covered_rects: list[fitz.Rect] = []
    removable_calls = 0

    def _unexpected_removable_call(_page, _item, _rect):
        nonlocal removable_calls
        removable_calls += 1
        return [fitz.Rect(12, 12, 80, 30)]

    monkeypatch.setattr(standard, "collect_page_drawing_rects", lambda _page: [])
    monkeypatch.setattr(standard, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(standard, "item_removable_text_rects", _unexpected_removable_call)
    monkeypatch.setattr(
        standard,
        "draw_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )

    diagnostics = routes.apply_standard_redaction(page, valid_items)

    assert diagnostics["route"] == "standard_redaction"
    assert diagnostics["item_fast_cover_count"] == 1
    assert diagnostics["cover_rects"] == 1
    assert covered_rects == [rect]
    assert removable_calls == 0
    assert page.redact_annots == []
    assert page.redaction_calls == []


def test_apply_standard_redaction_uses_bbox_for_non_continuation_items(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(314, 296, 560, 451)
    removable_rect = fitz.Rect(320, 320, 540, 430)
    valid_items = [(rect, {"item_id": "p005-b010"}, "中文")]

    monkeypatch.setattr(standard, "collect_page_drawing_rects", lambda _page: [])
    monkeypatch.setattr(standard, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(
        standard,
        "item_removable_text_rects",
        lambda _page, _item, _rect: [removable_rect],
    )
    monkeypatch.setattr(standard, "resolved_fill_color", lambda _page, _rect, fill: fill)

    diagnostics = routes.apply_standard_redaction(page, valid_items)

    assert diagnostics["raw_removable_rects"] == 1
    assert diagnostics["merged_removable_rects"] == 1
    assert page.redact_annots == [(removable_rect, None)]


def test_apply_standard_redaction_uses_cover_for_unsafe_items(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    valid_items = [(rect, {"item_id": "p010-b002"}, "中文")]
    covered_rects: list[fitz.Rect] = []

    monkeypatch.setattr(standard, "collect_page_drawing_rects", lambda _page: [])
    monkeypatch.setattr(standard, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(
        standard,
        "item_removable_text_rects",
        lambda _page, _item, _rect: [],
    )
    monkeypatch.setattr(
        standard,
        "draw_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )

    diagnostics = routes.apply_standard_redaction(page, valid_items)

    assert diagnostics["route"] == "standard_redaction"
    assert diagnostics["cover_rects"] == 1
    assert covered_rects == [rect]
    assert page.redact_annots == []
    assert page.redaction_calls == []


def test_apply_redaction_route_cover_only_defaults_to_visual_cover(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    valid_items = [(rect, {"item_id": "p010-b002"}, "中文")]
    covered_rects: list[fitz.Rect] = []

    monkeypatch.setattr(
        visual_cover,
        "draw_flat_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )

    diagnostics = routes.apply_redaction_route(page, valid_items, cover_only=True)

    assert diagnostics["route"] == "visual_cover"
    assert diagnostics["strategy"] == "visual_cover"
    assert diagnostics["fast_page_cover_only"] is True
    assert covered_rects == [rect]
    assert page.redact_annots == []
    assert page.redaction_calls == []


def test_apply_redaction_route_legacy_visual_and_text_removes_text_layer(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    valid_items = [(rect, {"item_id": "p010-b002"}, "中文")]
    covered_rects: list[fitz.Rect] = []

    monkeypatch.setattr(
        visual_cover,
        "draw_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )

    diagnostics = routes.apply_redaction_route(page, valid_items, strategy="visual_and_text")

    assert diagnostics["route"] == "visual_cover_and_remove_text"
    assert diagnostics["strategy"] == "visual_cover_and_remove_text"
    assert covered_rects == [rect]
    assert page.redact_annots == [(rect, False)]
    assert page.redaction_calls == [
        {
            "images": fitz.PDF_REDACT_IMAGE_NONE,
            "graphics": fitz.PDF_REDACT_LINE_ART_NONE,
            "text": fitz.PDF_REDACT_TEXT_REMOVE,
        }
    ]


def test_apply_redaction_route_accepts_stable_strategy_names(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    valid_items = [(rect, {"item_id": "p010-b002"}, "中文")]
    covered_rects: list[fitz.Rect] = []

    monkeypatch.setattr(
        visual_cover,
        "draw_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )

    diagnostics = routes.apply_redaction_route(page, valid_items, strategy="visual_cover")

    assert diagnostics["route"] == "visual_cover"
    assert diagnostics["strategy"] == "visual_cover"
    assert covered_rects == [rect]


def test_apply_redaction_route_auto_removes_safe_plain_text_layer(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    removable_rect = fitz.Rect(24, 24, 110, 54)
    valid_items = [
        (
            rect,
            {
                "item_id": "p010-b002",
                "block_kind": "text",
                "block_type": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "source_text": "This is a long body paragraph that should be eligible for source cleanup.",
                "bbox": [20, 20, 120, 60],
            },
            "中文",
        )
    ]
    covered_rects: list[fitz.Rect] = []

    monkeypatch.setattr(routes, "draw_white_covers", lambda _page, rects: covered_rects.extend(rects))
    monkeypatch.setattr(routes, "collect_page_math_protection_rects", lambda _page: [])
    monkeypatch.setattr(routes, "collect_page_non_math_span_heights", lambda _page: [])
    monkeypatch.setattr(routes, "page_has_intrusive_math_protection", lambda *_args: False)
    monkeypatch.setattr(routes, "item_removable_text_rects", lambda _page, _item, _rect, **_kwargs: [removable_rect])

    diagnostics = routes.apply_redaction_route(page, valid_items)

    assert diagnostics["route"] == "auto"
    assert diagnostics["strategy"] == "auto"
    assert diagnostics["raw_removable_rects"] == 1
    assert diagnostics["merged_removable_rects"] == 1
    assert covered_rects == []
    assert diagnostics["cover_rects"] == 0
    assert diagnostics["fast_page_cover_only"] is False
    assert page.redact_annots == [(removable_rect, False)]
    assert page.redaction_calls == [
        {
            "images": fitz.PDF_REDACT_IMAGE_NONE,
            "graphics": fitz.PDF_REDACT_LINE_ART_NONE,
            "text": fitz.PDF_REDACT_TEXT_REMOVE,
        }
    ]


def test_apply_redaction_route_auto_uses_safe_text_cleanup_for_formula_item(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    valid_items = [
        (
            rect,
            {
                "item_id": "p010-b002",
                "block_kind": "text",
                "block_type": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "source_text": (
                    "This is a long enough body paragraph containing an inline formula [[FORMULA_1]] "
                    "that should be treated as body text but skipped by risky formula cleanup."
                ),
                "bbox": [20, 20, 120, 60],
                "formula_map": [{"placeholder": "[[FORMULA_1]]", "formula_text": "x^2"}],
            },
            "中文 [[FORMULA_1]]",
        )
    ]
    covered_rects: list[fitz.Rect] = []
    removable_rect = fitz.Rect(24, 24, 95, 54)

    def _removable_call(_page, _item, _rect, **kwargs):
        assert kwargs.get("special_math_rects") is None
        return [removable_rect]

    monkeypatch.setattr(routes, "draw_white_covers", lambda _page, rects: covered_rects.extend(rects))
    monkeypatch.setattr(routes, "collect_page_math_protection_rects", lambda _page: [])
    monkeypatch.setattr(routes, "collect_page_non_math_span_heights", lambda _page: [])
    monkeypatch.setattr(routes, "page_has_intrusive_math_protection", lambda *_args: False)
    monkeypatch.setattr(routes, "item_removable_text_rects", _removable_call)

    diagnostics = routes.apply_redaction_route(page, valid_items)

    assert diagnostics["route"] == "auto"
    assert diagnostics["strategy"] == "auto"
    assert diagnostics["auto_text_cleanup_items_skipped"] == 0
    assert diagnostics["raw_removable_rects"] == 1
    assert diagnostics["cover_rects"] == 0
    assert diagnostics["fast_page_cover_only"] is False
    assert covered_rects == []
    assert page.redact_annots == [(removable_rect, False)]
    assert page.redaction_calls == [
        {
            "images": fitz.PDF_REDACT_IMAGE_NONE,
            "graphics": fitz.PDF_REDACT_LINE_ART_NONE,
            "text": fitz.PDF_REDACT_TEXT_REMOVE,
        }
    ]


def test_apply_redaction_route_auto_covers_explicit_render_blocks(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 160, 42)
    valid_items = [
        (
            rect,
            {
                "item_id": "item-3",
                "block_kind": "render_block",
                "block_type": "render_block",
                "source_text": "Fig. 1. A figure caption should be covered when it is actually rendered.",
                "bbox": [20, 20, 160, 42],
            },
            "图1. 图注实际渲染时应该触发源页面遮盖。",
        )
    ]
    covered_rects: list[fitz.Rect] = []

    monkeypatch.setattr(routes, "draw_white_covers", lambda _page, rects: covered_rects.extend(rects))
    monkeypatch.setattr(routes, "collect_page_math_protection_rects", lambda _page: [])
    monkeypatch.setattr(routes, "collect_page_non_math_span_heights", lambda _page: [])
    monkeypatch.setattr(routes, "page_has_intrusive_math_protection", lambda *_args: False)

    diagnostics = routes.apply_redaction_route(page, valid_items)

    assert diagnostics["route"] == "auto"
    assert diagnostics["strategy"] == "auto"
    assert diagnostics["cover_rects"] == 1
    assert diagnostics["fast_page_cover_only"] is True
    assert covered_rects == [rect]
    assert page.redact_annots == []
    assert page.redaction_calls == []


def test_apply_redaction_route_auto_filters_text_cleanup_with_intrusive_math_page(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    valid_items = [
        (
            rect,
            {
                "item_id": "p010-b002",
                "block_kind": "text",
                "block_type": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "source_text": "This is a long body paragraph that should normally be redacted.",
                "bbox": [20, 20, 120, 60],
            },
            "中文",
        )
    ]
    covered_rects: list[fitz.Rect] = []
    math_rect = fitz.Rect(50, 25, 80, 45)
    removable_rect = fitz.Rect(24, 24, 45, 54)

    def _removable_call(_page, _item, _rect, **kwargs):
        assert kwargs.get("special_math_rects") == [math_rect]
        return [removable_rect]

    monkeypatch.setattr(routes, "draw_white_covers", lambda _page, rects: covered_rects.extend(rects))
    monkeypatch.setattr(routes, "collect_page_math_protection_rects", lambda _page: [math_rect])
    monkeypatch.setattr(routes, "collect_page_non_math_span_heights", lambda _page: [])
    monkeypatch.setattr(routes, "page_has_intrusive_math_protection", lambda *_args: True)
    monkeypatch.setattr(routes, "item_removable_text_rects", _removable_call)

    diagnostics = routes.apply_redaction_route(page, valid_items)

    assert diagnostics["route"] == "auto"
    assert diagnostics["strategy"] == "auto"
    assert diagnostics["auto_text_cleanup_math_protected"] is True
    assert diagnostics["auto_text_cleanup_items_skipped"] == 0
    assert diagnostics["raw_removable_rects"] == 1
    assert diagnostics["cover_rects"] == 0
    assert diagnostics["fast_page_cover_only"] is False
    assert covered_rects == []
    assert page.redact_annots == [(removable_rect, False)]
    assert page.redaction_calls == [
        {
            "images": fitz.PDF_REDACT_IMAGE_NONE,
            "graphics": fitz.PDF_REDACT_LINE_ART_NONE,
            "text": fitz.PDF_REDACT_TEXT_REMOVE,
        }
    ]


def test_apply_image_page_redaction_never_redacts_pixels_or_line_art(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    valid_items = [(rect, {"item_id": "p010-b002"}, "中文")]
    prepared: list[fitz.Rect] = []
    applied: list[list[fitz.Rect]] = []

    monkeypatch.setattr(text_layer, "prepare_background_covers", lambda _page, rects: prepared.extend(rects) or ["cover"])
    monkeypatch.setattr(text_layer, "apply_prepared_background_covers", lambda _page, covers: applied.append(covers))

    diagnostics = routes.apply_image_page_redaction(page, valid_items)

    assert diagnostics["route"] == "image_page_redaction"
    assert prepared == [rect]
    assert applied == [["cover"]]
    assert page.redact_annots == [(rect, False)]
    assert page.redaction_calls == [
        {
            "images": fitz.PDF_REDACT_IMAGE_NONE,
            "graphics": fitz.PDF_REDACT_LINE_ART_NONE,
            "text": fitz.PDF_REDACT_TEXT_REMOVE,
        }
    ]


def test_apply_vector_heavy_redaction_never_redacts_pixels_or_line_art(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    valid_items = [(rect, {"item_id": "p010-b002"}, "中文")]
    covered_rects: list[fitz.Rect] = []

    monkeypatch.setattr(text_layer, "draw_white_covers", lambda _page, rects: covered_rects.extend(rects))

    diagnostics = routes.apply_vector_heavy_redaction(page, valid_items)

    assert diagnostics["route"] == "vector_heavy_redaction"
    assert covered_rects == [rect]
    assert page.redact_annots == [(rect, False)]
    assert page.redaction_calls == [
        {
            "images": fitz.PDF_REDACT_IMAGE_NONE,
            "graphics": fitz.PDF_REDACT_LINE_ART_NONE,
            "text": fitz.PDF_REDACT_TEXT_REMOVE,
        }
    ]
