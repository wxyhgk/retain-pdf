from __future__ import annotations

import sys
from unittest.mock import patch
from pathlib import Path

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.redaction.vector_text_cleanup import collect_vector_text_rects
from services.rendering.redaction.vector_text_cleanup import cleanup_vector_text_drawings


def test_collect_vector_text_rects_detects_black_filled_glyph_drawings() -> None:
    page = fitz.open().new_page(width=300, height=400)
    target_rect = fitz.Rect(250, 40, 560, 60)
    drawings = [
        {
            "type": "f",
            "fill": (0.0, 0.0, 0.0),
            "rect": fitz.Rect(252, 46, 430, 55),
            "items": [("l", fitz.Point(0, 0), fitz.Point(1, 1))] * 20,
        },
        {
            "type": "f",
            "fill": (0.8, 0.8, 0.8),
            "rect": fitz.Rect(252, 46, 430, 55),
            "items": [("l", fitz.Point(0, 0), fitz.Point(1, 1))] * 20,
        },
        {
            "type": "f",
            "fill": (0.0, 0.0, 0.0),
            "rect": fitz.Rect(20, 200, 200, 240),
            "items": [("l", fitz.Point(0, 0), fitz.Point(1, 1))] * 20,
        },
    ]
    page.get_drawings = lambda: drawings  # type: ignore[method-assign]

    rects = collect_vector_text_rects(page, [target_rect])

    assert rects == [fitz.Rect(252, 46, 430, 55)]


def test_collect_vector_text_rects_detects_large_black_text_clusters_by_intersection() -> None:
    page = fitz.open().new_page(width=300, height=400)
    target_rect = fitz.Rect(50, 300, 250, 360)
    drawings = [
        {
            "type": "f",
            "fill": (0.0, 0.0, 0.0),
            "rect": fitz.Rect(20, 280, 280, 380),
            "items": [("l", fitz.Point(0, 0), fitz.Point(1, 1))] * 1000,
        }
    ]
    page.get_drawings = lambda: drawings  # type: ignore[method-assign]

    rects = collect_vector_text_rects(page, [target_rect])

    assert rects == [fitz.Rect(50, 300, 250, 360)]


def test_cleanup_vector_text_drawings_uses_background_covers_instead_of_redaction() -> None:
    page = fitz.open().new_page(width=300, height=400)
    target_rect = fitz.Rect(250, 40, 560, 60)
    vector_rect = fitz.Rect(252, 46, 430, 55)

    with patch(
        "services.rendering.redaction.vector_text_cleanup.collect_vector_text_rects",
        return_value=[vector_rect],
    ), patch(
        "services.rendering.redaction.vector_text_cleanup.prepare_background_covers",
        return_value=["cover"],
    ) as prepare_mock, patch(
        "services.rendering.redaction.vector_text_cleanup.apply_prepared_background_covers",
    ) as apply_mock:
        count = cleanup_vector_text_drawings(page, [target_rect])

    assert count == 1
    prepare_mock.assert_called_once_with(page, [vector_rect])
    apply_mock.assert_called_once_with(page, ["cover"])
