from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from unittest import mock

import fitz
import pytest


from retainpdf_pipeline.render.layout.payload import prepare
from retainpdf_pipeline.render.output.typst import overlay_ops
from retainpdf_pipeline.render.output.typst import overlay_prepare
from retainpdf_pipeline.render.visual_profile.io import read_document_visual_profile
from retainpdf_pipeline.render.visual_profile.io import write_visual_profile_manifest
from retainpdf_pipeline.render.workflow.context import RenderExecutionContext
from retainpdf_pipeline.render.workflow import modes


def _write_pdf(path: Path, backgrounds: list[tuple[float, float, float]]) -> None:
    with fitz.open() as doc:
        for page_idx, background in enumerate(backgrounds):
            page = doc.new_page(width=200, height=300)
            page.draw_rect(page.rect, color=background, fill=background)
            page.insert_text((20, 250), f"source page {page_idx}", fontsize=10)
        doc.save(path)


def _item(page_idx: int) -> dict:
    return {
        "item_id": f"p{page_idx + 1:03d}-b001",
        "source_item_id": f"p{page_idx + 1:03d}-b001",
        "document_id": "stable-document",
        "page_idx": page_idx,
        "block_type": "text",
        "bbox": [20.0, 30.0, 180.0, 90.0],
        "protected_source_text": "original paragraph",
        "protected_translated_text": "translated paragraph",
        "_render_overlay_fill": "sampled",
        "metadata": {"source_page_index": page_idx},
    }


def _capture_compile(monkeypatch, tmp_path: Path) -> list[list[tuple]]:
    captured = []

    def compile_book(book_specs, **kwargs):
        captured.append(deepcopy(book_specs))
        output_path = tmp_path / f"overlay-{len(captured)}.pdf"
        with fitz.open() as doc:
            for width, height, _items in book_specs:
                page = doc.new_page(width=width, height=height)
                page.insert_text((2, 10), "mock overlay", fontsize=5)
            doc.save(output_path)
        return output_path

    monkeypatch.setattr(overlay_ops, "compile_book_overlay_pdf", compile_book)
    return captured


@pytest.mark.parametrize("separate_prepared_source", [False, True])
@pytest.mark.parametrize("cached_colors", [False, True])
def test_selected_page_samples_matching_original_page(
    tmp_path: Path, monkeypatch, separate_prepared_source: bool, cached_colors: bool
) -> None:
    original = tmp_path / "original.pdf"
    _write_pdf(original, [(0, 0, 0), (1, 1, 1)])
    base = original
    if separate_prepared_source:
        base = tmp_path / "cleaned.pdf"
        _write_pdf(base, [(0.5, 0.5, 0.5), (0, 0, 0)])
    translated = {0: [_item(0)], 1: [_item(1)]}
    before = deepcopy(translated)
    colors = {"p002-b001": {"cover_fill": (1, 1, 1), "text_color": (0, 0, 0)}}
    captured = _capture_compile(monkeypatch, tmp_path)
    # Observe the real extracted sampling document used by indent detection.
    sampled_pages = []

    def detect_indent(source_doc, displaylist, item, *, page_idx, **kwargs):
        sampled_pages.append((page_idx, source_doc[page_idx].get_text()))
        return 14.0

    monkeypatch.setattr(prepare, "is_first_line_indent_candidate", lambda *args, **kwargs: True)
    monkeypatch.setattr(prepare, "detect_first_line_indent_pt_with_displaylist", detect_indent)
    context = RenderExecutionContext(
        output_pdf_path=tmp_path / "out.pdf",
        start_page=1,
        end_page=1,
        indent_detection_pdf_path=original,
        render_colors_by_item_id=colors if cached_colors else None,
        source_image_compressed=True,
    )

    page_count, _diagnostics = modes.run_selected_pages_overlay_render(
        source_pdf_path=base, translated_pages=translated, context=context
    )

    assert page_count == 1
    assert len(captured) == 1
    rendered_item = captured[0][0][2][0]
    assert rendered_item["_render_cover_fill"] == (1, 1, 1)
    assert rendered_item["_render_text_color"] == (0, 0, 0)
    assert rendered_item["_render_first_line_indent_pt"] == 14.0
    assert sampled_pages == [(0, "source page 1\n")]
    assert rendered_item["page_idx"] == 0
    assert rendered_item["item_id"] == "p002-b001"
    assert rendered_item["document_id"] == "stable-document"
    assert translated == before
    with fitz.open(context.output_pdf_path) as doc:
        assert len(doc) == 1
        assert "source page 1" in doc[0].get_text()


@pytest.mark.parametrize("no_cache", [False, True])
def test_selected_page_forwards_no_cache_to_source_cache(
    tmp_path: Path, monkeypatch, no_cache: bool
) -> None:
    source = tmp_path / "original.pdf"
    _write_pdf(source, [(0, 0, 0), (1, 1, 1)])
    _capture_compile(monkeypatch, tmp_path)
    context = RenderExecutionContext(
        output_pdf_path=tmp_path / "out.pdf",
        start_page=1,
        end_page=1,
        no_cache=no_cache,
        source_image_compressed=True,
        first_line_indent_lookup={},
        # A full-book source is never valid for a selected-page overlay.
        overlay_source_path=tmp_path / "full-book-cached.typ",
    )
    with mock.patch.object(overlay_ops, "resolve_prebuilt_overlay_source", return_value=(None, 0.0)) as resolve:
        modes.run_selected_pages_overlay_render(
            source_pdf_path=source, translated_pages={1: [_item(1)]}, context=context
        )
    assert resolve.call_count == (0 if no_cache else 1)
    if not no_cache:
        assert resolve.call_args.kwargs["prebuilt_source_path"] is None


def test_selected_prepared_payload_remaps_page_structures_without_mutation(tmp_path: Path) -> None:
    source = tmp_path / "original.pdf"
    _write_pdf(source, [(0, 0, 0), (1, 1, 1), (0.5, 0.5, 0.5), (0, 0, 0)])
    translated = {page: [_item(page)] for page in range(4)}
    prepared = deepcopy(translated)
    for items in prepared.values():
        items[0]["_render_cover_fill"] = (0.8, 0.7, 0.6)
    translated_before, prepared_before = deepcopy(translated), deepcopy(prepared)
    profile_path = tmp_path / "visual-profile.json"
    write_visual_profile_manifest(
        profile_path,
        {
            "algorithm": "visual_profile_v1",
            "pages": {
                str(page): {
                    "background_rgb": [page / 4] * 3,
                    "items": {f"p{page + 1:03d}-b001": {"page_index": page, "bbox": [20, 30, 180, 90]}},
                }
                for page in range(4)
            },
        },
    )
    profile_before = profile_path.read_bytes()
    indents = {"p003-b001": 12.0}
    inner_boxes = {"p003-b001": [21.0, 31.0, 179.0, 89.0]}
    colors = {"p003-b001": {"cover_fill": (0.8, 0.7, 0.6)}}
    context = RenderExecutionContext(
        output_pdf_path=tmp_path / "out.pdf",
        start_page=1,
        end_page=2,
        prepared_overlay_pages=prepared,
        first_line_indent_lookup=indents,
        effective_inner_bbox_lookup=inner_boxes,
        render_colors_by_item_id=colors,
        source_text_precleaned_page_indices=frozenset({0, 2, 3}),
        visual_cover_page_indices=frozenset({0, 1, 3}),
        visual_profile_path=profile_path,
        source_image_compressed=True,
    )
    with mock.patch.object(modes, "build_book_typst_pdf", return_value={}) as build:
        count, _diagnostics = modes.run_selected_pages_overlay_render(
            source_pdf_path=source, translated_pages=translated, context=context
        )
    assert count == 2
    kwargs = build.call_args.kwargs
    for key in ("translated_pages", "prepared_overlay_pages"):
        assert list(kwargs[key]) == [0, 1]
        assert [kwargs[key][page][0]["page_idx"] for page in (0, 1)] == [0, 1]
        assert [kwargs[key][page][0]["item_id"] for page in (0, 1)] == ["p002-b001", "p003-b001"]
    assert kwargs["source_text_precleaned_page_indices"] == frozenset({1})
    assert kwargs["visual_cover_page_indices"] == frozenset({0})
    assert kwargs["first_line_indent_lookup"] == indents
    assert kwargs["effective_inner_bbox_lookup"] == inner_boxes
    assert kwargs["precomputed_colors_by_item_id"] == colors
    profile = read_document_visual_profile(kwargs["visual_profile_path"])
    assert profile is not None
    assert list(profile.pages) == [0, 1]
    assert profile.pages[0].background_rgb == (0.25, 0.25, 0.25)
    assert profile.pages[0].items["p002-b001"].page_index == 0
    assert profile.pages[1].items["p003-b001"].page_index == 1
    assert kwargs["indent_detection_pdf_path"] == kwargs["source_pdf_path"]
    kwargs["prepared_overlay_pages"][0][0]["metadata"]["source_page_index"] = 99
    assert translated == translated_before
    assert prepared == prepared_before
    assert profile_path.read_bytes() == profile_before


def test_selected_prepared_payload_keeps_prewarmed_colors(tmp_path: Path, monkeypatch) -> None:
    source = tmp_path / "source.pdf"
    _write_pdf(source, [(0, 0, 0), (0, 0, 0)])
    prepared = {1: [{**_item(1), "_render_cover_fill": (1, 1, 1), "_render_text_color": (0, 0, 0)}]}
    captured = _capture_compile(monkeypatch, tmp_path)
    context = RenderExecutionContext(
        output_pdf_path=tmp_path / "out.pdf",
        start_page=1,
        end_page=1,
        prepared_overlay_pages=prepared,
        source_image_compressed=True,
    )
    with (
        mock.patch.object(overlay_prepare, "prepare_translated_pages_for_render", side_effect=AssertionError("reprepared")),
        mock.patch.object(overlay_prepare, "apply_overlay_page_colors", side_effect=AssertionError("resampled")),
    ):
        modes.run_selected_pages_overlay_render(
            source_pdf_path=source, translated_pages={1: [_item(1)]}, context=context
        )
    assert captured[0][0][2][0]["_render_cover_fill"] == (1, 1, 1)
    assert captured[0][0][2][0]["page_idx"] == 0
    assert prepared[1][0]["page_idx"] == 1


def test_selected_translation_group_uses_local_page_metrics(tmp_path: Path, monkeypatch) -> None:
    source = tmp_path / "source.pdf"
    _write_pdf(source, [(1, 1, 1)] * 3)
    aggregate = "translated first paragraph, translated second paragraph"
    translated = {
        page: [{
            **_item(page),
            "translation_unit_id": "stable-cross-page-unit",
            "translation_unit_kind": "group",
            "translation_unit_protected_translated_text": aggregate,
            "translation_unit_protected_source_text": "original first paragraph, original second paragraph",
        }]
        for page in (1, 2)
    }
    before = deepcopy(translated)
    captured = _capture_compile(monkeypatch, tmp_path)
    context = RenderExecutionContext(
        output_pdf_path=tmp_path / "out.pdf",
        start_page=1,
        end_page=2,
        source_image_compressed=True,
        first_line_indent_lookup={},
    )
    with mock.patch.object(
        overlay_prepare, "prepare_translated_pages_for_render", wraps=overlay_prepare.prepare_translated_pages_for_render
    ) as preparation:
        modes.run_selected_pages_overlay_render(
            source_pdf_path=source, translated_pages=translated, context=context
        )
    preparation.assert_called_once()
    rendered = [spec[2][0] for spec in captured[0]]
    assert [item["page_idx"] for item in rendered] == [0, 1]
    assert [item["item_id"] for item in rendered] == ["p002-b001", "p003-b001"]
    assert all(item["translation_unit_id"] == "stable-cross-page-unit" for item in rendered)
    assert all(item["render_protected_text"] for item in rendered)
    assert translated == before
