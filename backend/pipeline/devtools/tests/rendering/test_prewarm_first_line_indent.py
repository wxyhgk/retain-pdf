"""预热阶段的首行缩进探测：结构化行 bbox、像素探测的默认开关与诊断记录。

从 test_render_prewarm.py 整块拆出，用例本身未改。
"""

import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import fitz
import pytest

from retainpdf_pipeline.foundation.config import layout
from retainpdf_pipeline.render.source.prewarm_payload import collect_first_line_indent_lookup
from retainpdf_pipeline.render.source.prewarm_payload import first_line_indent_from_item_lines
from retainpdf_pipeline.render.source.prewarm_payload import build_payload_prewarm


def test_first_line_indent_from_item_lines_uses_structured_line_bboxes() -> None:
    item = {
        "lines": [
            {"bbox": [42.0, 10.0, 180.0, 20.0]},
            {"bbox": [24.0, 22.0, 180.0, 32.0]},
            {"bbox": [24.5, 34.0, 180.0, 44.0]},
        ]
    }

    assert first_line_indent_from_item_lines(item, font_size_pt=12.0) == 17.75


def test_first_line_indent_from_item_lines_ignores_small_offsets() -> None:
    item = {
        "lines": [
            {"bbox": [29.0, 10.0, 180.0, 20.0]},
            {"bbox": [24.0, 22.0, 180.0, 32.0]},
        ]
    }

    assert first_line_indent_from_item_lines(item, font_size_pt=12.0) == 0.0


def _pixmap_indent_candidate_item() -> dict:
    return {
        "item_id": "p001-b001",
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "bbox": [18.0, 30.0, 210.0, 88.0],
        "source_text": "First line second line third line",
        "protected_source_text": "First line second line third line",
        "lines": [],
    }


def _pixmap_indent_metrics() -> SimpleNamespace:
    return SimpleNamespace(base_metrics={0: (10.0, 1.2)}, page_text_width_med=160.0)


def test_pixmap_first_line_indent_can_be_switched_off(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_RENDER_PIXMAP_INDENT", "0")
    doc = fitz.open()
    for _ in range(3):
        doc.new_page(width=240, height=180)
    stats: dict[str, object] = {
        "pixmap_candidates": 0,
        "pixmap_checked": 0,
        "pixmap_hits": 0,
        "pixmap_disabled_candidates": 0,
    }
    sink: dict[str, float] = {}

    with mock.patch(
        "retainpdf_pipeline.render.source.prewarm_payload.detect_first_line_indent_pt_with_displaylist",
        side_effect=AssertionError("RETAIN_RENDER_PIXMAP_INDENT=0 turns the pixmap path off"),
    ):
        collect_first_line_indent_lookup(
            source_doc=doc,
            page_idx=0,
            items=[_pixmap_indent_candidate_item()],
            metrics=_pixmap_indent_metrics(),
            sink=sink,
            stats=stats,
        )
    doc.close()

    assert sink == {}
    assert stats["pixmap_candidates"] == 1
    assert stats["pixmap_disabled_candidates"] == 1
    assert stats["pixmap_checked"] == 0
    assert stats["pixmap_enabled"] is False
    assert stats["pixmap_reason"] == "env_disabled"


def test_pixmap_first_line_indent_env_opt_in_runs_detector(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_RENDER_PIXMAP_INDENT", "1")
    doc = fitz.open()
    for _ in range(3):
        doc.new_page(width=240, height=180)
    stats: dict[str, object] = {
        "pixmap_candidates": 0,
        "pixmap_checked": 0,
        "pixmap_hits": 0,
        "pixmap_disabled_candidates": 0,
    }
    sink: dict[str, float] = {}

    with mock.patch(
        "retainpdf_pipeline.render.source.prewarm_payload.detect_first_line_indent_pt_with_displaylist",
        return_value=12.5,
    ) as detector:
        collect_first_line_indent_lookup(
            source_doc=doc,
            page_idx=0,
            items=[_pixmap_indent_candidate_item()],
            metrics=_pixmap_indent_metrics(),
            sink=sink,
            stats=stats,
        )
    doc.close()

    assert sink == {"p001-b001": 12.5}
    assert detector.call_count == 1
    assert stats["pixmap_candidates"] == 1
    assert stats["pixmap_disabled_candidates"] == 0
    assert stats["pixmap_checked"] == 1
    assert stats["pixmap_hits"] == 1
    assert stats["pixmap_enabled"] is True
    assert stats["pixmap_reason"] == "env_enabled"


def test_pixmap_first_line_indent_is_on_by_default_for_books(monkeypatch) -> None:
    # 2026-11-02 起默认打开：以前只给 2 页以内的文档开，481 页的扫描书一块缩进都没有。
    monkeypatch.delenv("RETAIN_RENDER_PIXMAP_INDENT", raising=False)
    doc = fitz.open()
    for _ in range(481):
        doc.new_page(width=240, height=180)
    stats: dict[str, object] = {
        "pixmap_candidates": 0,
        "pixmap_checked": 0,
        "pixmap_hits": 0,
        "pixmap_disabled_candidates": 0,
    }
    sink: dict[str, float] = {}

    with mock.patch(
        "retainpdf_pipeline.render.source.prewarm_payload.detect_first_line_indent_pt_with_displaylist",
        return_value=9.25,
    ):
        collect_first_line_indent_lookup(
            source_doc=doc,
            page_idx=0,
            items=[_pixmap_indent_candidate_item()],
            metrics=_pixmap_indent_metrics(),
            sink=sink,
            stats=stats,
        )
    doc.close()

    assert sink == {"p001-b001": 9.25}
    assert stats["pixmap_enabled"] is True
    assert stats["pixmap_reason"] == "default_enabled"


def test_pixmap_first_line_indent_time_limit_grows_with_the_pages(monkeypatch) -> None:
    from retainpdf_pipeline.render.source import prewarm_payload

    monkeypatch.delenv("RETAIN_RENDER_PIXMAP_INDENT_MAX_SECONDS", raising=False)
    assert prewarm_payload._pixmap_first_line_indent_max_seconds(page_count=10) == 8.0
    assert prewarm_payload._pixmap_first_line_indent_max_seconds(page_count=481) == pytest.approx(48.1)
    monkeypatch.setenv("RETAIN_RENDER_PIXMAP_INDENT_MAX_SECONDS", "3")
    assert prewarm_payload._pixmap_first_line_indent_max_seconds(page_count=481) == 3.0


def test_payload_prewarm_records_default_pixmap_indent_diagnostics(monkeypatch) -> None:
    monkeypatch.delenv("RETAIN_RENDER_PIXMAP_INDENT", raising=False)
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        manifest_path = root / "artifacts" / "render_prewarm" / "render_source_prewarm_manifest.json"
        manifest_path.parent.mkdir(parents=True)
        doc = fitz.open()
        for _ in range(3):
            doc.new_page(width=200, height=200)
        doc.save(source_pdf)
        doc.close()

        payload = build_payload_prewarm(
            source_pdf_path=source_pdf,
            translated_pages={0: [_pixmap_indent_candidate_item()]},
            manifest_path=manifest_path,
            effective_render_mode="overlay",
            source_cleanup_strategy=layout.SOURCE_CLEANUP_TYPST_FILL,
        )

    diagnostics = payload["first_line_indent_diagnostics"]
    assert diagnostics["pixmap_enabled"] is True
    assert diagnostics["pixmap_reason"] == "default_enabled"
    assert diagnostics["pixmap_candidates"] == 1
    assert diagnostics["pixmap_disabled_candidates"] == 0
    assert diagnostics["pixmap_checked"] == 1
    assert diagnostics["pixmap_max_seconds"] == 8.0
