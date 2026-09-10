from __future__ import annotations

import sys
from pathlib import Path

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.source_cleanup.planning import segments


def test_split_rect_around_inline_formula_keeps_left_and_right_segments() -> None:
    rect = fitz.Rect(10, 20, 210, 50)
    guard = fitz.Rect(80, 20, 140, 50)

    split_segments = segments.split_rect_around_guards(rect, [guard])

    assert split_segments == [
        fitz.Rect(10, 20, 80, 50),
        fitz.Rect(140, 20, 210, 50),
    ]


def test_split_rect_around_display_formula_keeps_upper_and_lower_segments() -> None:
    rect = fitz.Rect(10, 20, 210, 140)
    guard = fitz.Rect(60, 55, 160, 95)

    split_segments = segments.split_rect_around_guards(rect, [guard])

    assert fitz.Rect(10, 20, 210, 55) in split_segments
    assert fitz.Rect(10, 95, 210, 140) in split_segments
    assert fitz.Rect(10, 55, 60, 95) in split_segments
    assert fitz.Rect(160, 55, 210, 95) in split_segments


def test_split_rect_around_multiple_guards_does_not_keep_protected_overlap() -> None:
    rect = fitz.Rect(0, 0, 200, 40)
    guards = [fitz.Rect(40, 0, 70, 40), fitz.Rect(120, 0, 150, 40)]

    split_segments = segments.split_rect_around_guards(rect, guards)

    assert split_segments == [
        fitz.Rect(0, 0, 40, 40),
        fitz.Rect(70, 0, 120, 40),
        fitz.Rect(150, 0, 200, 40),
    ]
    assert all((segment & guard).is_empty for segment in split_segments for guard in guards)


def test_split_rect_around_guards_drops_tiny_fragments() -> None:
    rect = fitz.Rect(0, 0, 100, 20)
    guard = fitz.Rect(1, 0, 99, 20)

    split_segments = segments.split_rect_around_guards(rect, [guard], min_width_pt=2.0)

    assert split_segments == []
