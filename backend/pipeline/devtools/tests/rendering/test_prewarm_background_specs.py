"""预热产出的背景页 spec：坏块要 fail closed、overlay 模式跳过、typst visual 直接复用。

从 test_render_prewarm.py 整块拆出，用例本身未改。
"""

import tempfile
from pathlib import Path
from unittest import mock

from devtools.tests.rendering_support.prewarm_fixtures import translated_page_payload as _translated_page_payload
from devtools.tests.rendering_support.prewarm_fixtures import write_source_pdf as _source_pdf
from retainpdf_pipeline.render.render_plan import RenderPlan
from retainpdf_pipeline.render.render_inputs import RenderInputs
from retainpdf_pipeline.render.source.prewarm import RenderPrewarmSpec
from retainpdf_pipeline.render.source.prewarm import start_render_source_prewarm
from retainpdf_pipeline.render.source.prewarm import try_load_render_payload_prewarm
from retainpdf_pipeline.render.source.prewarm_payload import build_payload_prewarm
from retainpdf_pipeline.render.source.prewarm_page_specs import render_page_specs_from_manifest
from retainpdf_pipeline.render.workflow.executor import execute_render_plan


def test_background_page_specs_manifest_fails_closed_on_bad_block() -> None:
    manifest = {
        "algorithm": "background_render_page_specs_v4_visual_profile",
        "page_count": 1,
        "block_count": 1,
        "block_ids_by_page": {"0": ["item-p001-b001"]},
        "page_specs": [
            {
                "page_index": 0,
                "page_width_pt": 200.0,
                "page_height_pt": 200.0,
                "block_count": 1,
                "block_ids": ["item-p001-b001"],
                "blocks": [
                    {
                        "block_id": "item-p001-b001",
                        "page_index": 0,
                        "background_rect": [10.0, 20.0, 150.0, 60.0],
                        "content_rect": ["bad"],
                        "content_kind": "markdown",
                        "content_text": "译文",
                        "plain_text": "译文",
                        "math_map": [],
                        "font_size_pt": 10.0,
                        "leading_em": 0.56,
                    }
                ],
            }
        ],
    }

    assert render_page_specs_from_manifest(manifest) is None


def test_payload_prewarm_exposes_background_render_page_specs() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "rendered" / "out.pdf"
        artifacts_dir = root / "artifacts"
        output_pdf.parent.mkdir()
        _source_pdf(source_pdf)

        handle = start_render_source_prewarm(
            RenderPrewarmSpec(
                source_pdf_path=source_pdf,
                output_pdf_path=output_pdf,
                artifacts_dir=artifacts_dir,
                translated_pages=_translated_page_payload(),
                render_mode="typst_visual",
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
            )
        )
        manifest_path = handle.wait()

        payload_prewarm = try_load_render_payload_prewarm(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=_translated_page_payload(),
            effective_render_mode="typst_visual",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
        )

        assert payload_prewarm is not None
        assert payload_prewarm.background_render_page_specs is not None
        assert len(payload_prewarm.background_render_page_specs) == 1
        assert payload_prewarm.background_render_page_specs[0].blocks[0].plain_text


def test_overlay_payload_prewarm_skips_background_specs_but_keeps_cover_fill() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        manifest_path = root / "artifacts" / "render_prewarm" / "render_source_prewarm_manifest.json"
        _source_pdf(source_pdf)

        payload = build_payload_prewarm(
            source_pdf_path=source_pdf,
            translated_pages=_translated_page_payload(),
            manifest_path=manifest_path,
            effective_render_mode="overlay",
            source_cleanup_strategy="bbox_text_strip",
        )

        assert payload["background_render_page_specs"] == {}
        prepared_pages = payload["prepared_overlay_pages"]
        assert prepared_pages
        first_page_items = prepared_pages["0"]
        assert first_page_items
        assert first_page_items[0].get("_render_cover_fill")


def test_execute_typst_visual_uses_prewarmed_background_page_specs(monkeypatch) -> None:
    # These render stubs intentionally do not produce a PDF.
    monkeypatch.setattr(
        "retainpdf_pipeline.render.workflow.executor.relocate_translated_links",
        lambda *args: {"moved": 0, "unchanged": 0, "unresolved": []},
    )
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "rendered" / "out.pdf"
        artifacts_dir = root / "artifacts"
        translations_dir = root / "translated"
        output_pdf.parent.mkdir()
        translations_dir.mkdir()
        _source_pdf(source_pdf)

        handle = start_render_source_prewarm(
            RenderPrewarmSpec(
                source_pdf_path=source_pdf,
                output_pdf_path=output_pdf,
                artifacts_dir=artifacts_dir,
                translated_pages=_translated_page_payload(),
                render_mode="typst_visual",
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
            )
        )
        manifest_path = handle.wait()
        render_plan = RenderPlan(
            render_inputs=RenderInputs(
                source_pdf_path=source_pdf,
                translations_dir=translations_dir,
                translation_manifest_path=None,
            ),
            selected_pages=_translated_page_payload(),
            effective_render_mode="typst_visual",
        )

        def _fake_background(*, source_pdf_path, translated_pages, context):
            assert context.background_render_page_specs is not None
            assert context.background_render_page_specs[0].blocks[0].plain_text
            return 1, {"route": "prewarmed-background-specs"}

        with mock.patch.dict(
            "retainpdf_pipeline.render.workflow.modes.RENDER_MODE_HANDLERS",
            {"typst_visual": _fake_background},
        ):
            pages = execute_render_plan(
                render_plan=render_plan,
                output_pdf_path=output_pdf,
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="pikepdf_text_strip",
                render_prewarm_manifest_path=manifest_path,
            )

        assert pages == 1


def test_background_specs_manifest_builds_without_precomputed_color_pages() -> None:
    from retainpdf_pipeline.render.source.prewarm_page_specs import build_background_render_page_specs_manifest

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        _source_pdf(source_pdf)

        manifest = build_background_render_page_specs_manifest(
            source_pdf_path=source_pdf,
            translated_pages=_translated_page_payload(),
            first_line_indent_lookup={},
            effective_inner_bbox_lookup={},
            prepared_translated_pages=None,
            color_adapted_pages=None,
        )

        assert manifest.get("page_count") == 1
        assert manifest.get("block_count", 0) >= 1
