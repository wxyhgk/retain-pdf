from __future__ import annotations

import sys
from pathlib import Path

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.redaction import redaction_routes


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

    monkeypatch.setattr(redaction_routes, "collect_page_drawing_rects", lambda _page: [fitz.Rect(0, 0, 120, 60)])
    monkeypatch.setattr(redaction_routes, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(redaction_routes, "item_removable_text_rects", lambda _page, _item, _rect: [removable_rect])
    monkeypatch.setattr(
        redaction_routes,
        "draw_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )
    monkeypatch.setattr(redaction_routes, "resolved_fill_color", lambda _page, _rect, fill: fill)

    redaction_routes.apply_standard_redaction(page, valid_items)

    assert covered_rects == []
    assert page.redact_annots == [(removable_rect, None)]
    assert page.redaction_calls == [
        {
            "images": fitz.PDF_REDACT_IMAGE_NONE,
            "graphics": fitz.PDF_REDACT_LINE_ART_NONE,
            "text": fitz.PDF_REDACT_TEXT_REMOVE,
        }
    ]


def test_apply_standard_redaction_keeps_text_redaction_for_plain_text(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(10, 10, 100, 40)
    valid_items = [(rect, {"item_id": "p004-b003"}, "正文")]
    covered_rects: list[fitz.Rect] = []

    monkeypatch.setattr(redaction_routes, "collect_page_drawing_rects", lambda _page: [fitz.Rect(0, 0, 120, 60)])
    monkeypatch.setattr(redaction_routes, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(redaction_routes, "item_removable_text_rects", lambda _page, _item, _rect: [rect])
    monkeypatch.setattr(
        redaction_routes,
        "draw_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )
    monkeypatch.setattr(redaction_routes, "resolved_fill_color", lambda _page, _rect, fill: fill)

    redaction_routes.apply_standard_redaction(page, valid_items)

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

    monkeypatch.setattr(redaction_routes, "collect_page_drawing_rects", lambda _page: [])
    monkeypatch.setattr(redaction_routes, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(
        redaction_routes,
        "item_removable_text_rects",
        lambda _page, item, _rect: fragmented_rects_a if item["item_id"] == "p040-b001" else fragmented_rects_b,
    )
    monkeypatch.setattr(
        redaction_routes,
        "draw_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )

    diagnostics = redaction_routes.apply_standard_redaction(page, valid_items)

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

    monkeypatch.setattr(redaction_routes, "collect_page_drawing_rects", lambda _page: [])
    monkeypatch.setattr(redaction_routes, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(
        redaction_routes,
        "item_removable_text_rects",
        lambda _page, _item, _rect: [fitz.Rect(320, 320, 540, 430)],
    )
    monkeypatch.setattr(redaction_routes, "resolved_fill_color", lambda _page, _rect, fill: fill)

    diagnostics = redaction_routes.apply_standard_redaction(page, valid_items)

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

    monkeypatch.setattr(redaction_routes, "collect_page_drawing_rects", lambda _page: [])
    monkeypatch.setattr(redaction_routes, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(redaction_routes, "item_removable_text_rects", _unexpected_removable_call)
    monkeypatch.setattr(
        redaction_routes,
        "draw_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )

    diagnostics = redaction_routes.apply_standard_redaction(page, valid_items)

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

    monkeypatch.setattr(redaction_routes, "collect_page_drawing_rects", lambda _page: [])
    monkeypatch.setattr(redaction_routes, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(
        redaction_routes,
        "item_removable_text_rects",
        lambda _page, _item, _rect: [removable_rect],
    )
    monkeypatch.setattr(redaction_routes, "resolved_fill_color", lambda _page, _rect, fill: fill)

    diagnostics = redaction_routes.apply_standard_redaction(page, valid_items)

    assert diagnostics["raw_removable_rects"] == 1
    assert diagnostics["merged_removable_rects"] == 1
    assert page.redact_annots == [(removable_rect, None)]


def test_apply_standard_redaction_uses_cover_for_unsafe_items(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    valid_items = [(rect, {"item_id": "p010-b002"}, "中文")]
    covered_rects: list[fitz.Rect] = []

    monkeypatch.setattr(redaction_routes, "collect_page_drawing_rects", lambda _page: [])
    monkeypatch.setattr(redaction_routes, "page_should_use_cover_only", lambda _rects: False)
    monkeypatch.setattr(
        redaction_routes,
        "item_removable_text_rects",
        lambda _page, _item, _rect: [],
    )
    monkeypatch.setattr(
        redaction_routes,
        "draw_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )

    diagnostics = redaction_routes.apply_standard_redaction(page, valid_items)

    assert diagnostics["route"] == "standard_redaction"
    assert diagnostics["cover_rects"] == 1
    assert covered_rects == [rect]
    assert page.redact_annots == []
    assert page.redaction_calls == []


def test_apply_redaction_route_cover_only_defaults_to_visual_only(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    valid_items = [(rect, {"item_id": "p010-b002"}, "中文")]
    covered_rects: list[fitz.Rect] = []

    monkeypatch.setattr(
        redaction_routes,
        "draw_flat_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )

    diagnostics = redaction_routes.apply_redaction_route(page, valid_items, cover_only=True)

    assert diagnostics["route"] == "visual_only"
    assert diagnostics["strategy"] == "visual_only"
    assert diagnostics["fast_page_cover_only"] is True
    assert covered_rects == [rect]
    assert page.redact_annots == []
    assert page.redaction_calls == []


def test_apply_redaction_route_visual_and_text_removes_text_layer(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    valid_items = [(rect, {"item_id": "p010-b002"}, "中文")]
    covered_rects: list[fitz.Rect] = []

    monkeypatch.setattr(
        redaction_routes,
        "draw_white_covers",
        lambda _page, rects: covered_rects.extend(rects),
    )

    diagnostics = redaction_routes.apply_redaction_route(page, valid_items, strategy="visual_and_text")

    assert diagnostics["route"] == "visual_and_text"
    assert diagnostics["strategy"] == "visual_and_text"
    assert covered_rects == [rect]
    assert page.redact_annots == [(rect, False)]
    assert page.redaction_calls == [
        {
            "images": fitz.PDF_REDACT_IMAGE_NONE,
            "graphics": fitz.PDF_REDACT_LINE_ART_NONE,
            "text": fitz.PDF_REDACT_TEXT_REMOVE,
        }
    ]


def test_apply_redaction_route_auto_removes_safe_plain_text_layer(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    removable_rect = fitz.Rect(24, 24, 110, 54)
    valid_items = [(rect, {"item_id": "p010-b002", "source_text": "plain text"}, "中文")]
    covered_rects: list[fitz.Rect] = []

    monkeypatch.setattr(redaction_routes, "draw_white_covers", lambda _page, rects: covered_rects.extend(rects))
    monkeypatch.setattr(redaction_routes, "collect_page_math_protection_rects", lambda _page: [])
    monkeypatch.setattr(redaction_routes, "collect_page_non_math_span_heights", lambda _page: [])
    monkeypatch.setattr(redaction_routes, "page_has_intrusive_math_protection", lambda *_args: False)
    monkeypatch.setattr(redaction_routes, "item_removable_text_rects", lambda _page, _item, _rect: [removable_rect])

    diagnostics = redaction_routes.apply_redaction_route(page, valid_items)

    assert diagnostics["route"] == "auto"
    assert diagnostics["strategy"] == "auto"
    assert diagnostics["raw_removable_rects"] == 1
    assert diagnostics["merged_removable_rects"] == 1
    assert covered_rects == [rect]
    assert page.redact_annots == [(removable_rect, False)]
    assert page.redaction_calls == [
        {
            "images": fitz.PDF_REDACT_IMAGE_NONE,
            "graphics": fitz.PDF_REDACT_LINE_ART_NONE,
            "text": fitz.PDF_REDACT_TEXT_REMOVE,
        }
    ]


def test_apply_redaction_route_auto_skips_formula_item_text_cleanup(monkeypatch) -> None:
    page = _FakePage()
    rect = fitz.Rect(20, 20, 120, 60)
    valid_items = [
        (
            rect,
            {
                "item_id": "p010-b002",
                "source_text": "text [[FORMULA_1]]",
                "formula_map": [{"placeholder": "[[FORMULA_1]]", "formula_text": "x^2"}],
            },
            "中文 [[FORMULA_1]]",
        )
    ]
    covered_rects: list[fitz.Rect] = []
    removable_calls = 0

    def _unexpected_removable_call(_page, _item, _rect):
        nonlocal removable_calls
        removable_calls += 1
        return [rect]

    monkeypatch.setattr(redaction_routes, "draw_white_covers", lambda _page, rects: covered_rects.extend(rects))
    monkeypatch.setattr(redaction_routes, "collect_page_math_protection_rects", lambda _page: [])
    monkeypatch.setattr(redaction_routes, "collect_page_non_math_span_heights", lambda _page: [])
    monkeypatch.setattr(redaction_routes, "page_has_intrusive_math_protection", lambda *_args: False)
    monkeypatch.setattr(redaction_routes, "item_removable_text_rects", _unexpected_removable_call)

    diagnostics = redaction_routes.apply_redaction_route(page, valid_items)

    assert diagnostics["route"] == "auto"
    assert diagnostics["strategy"] == "auto"
    assert diagnostics["auto_text_cleanup_items_skipped"] == 1
    assert diagnostics["raw_removable_rects"] == 0
    assert covered_rects == [rect]
    assert removable_calls == 0
    assert page.redact_annots == []
    assert page.redaction_calls == []
