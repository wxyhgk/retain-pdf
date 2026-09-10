import sys
import tempfile
import json
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import fitz

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from devtools.tests.rendering_support.prewarm_fixtures import empty_region_page_payload as _empty_region_page_payload
from devtools.tests.rendering_support.prewarm_fixtures import page_payload as _page_payload
from devtools.tests.rendering_support.prewarm_fixtures import source_document_analysis
from devtools.tests.rendering_support.prewarm_fixtures import tight_gap_page_payload as _tight_gap_page_payload
from devtools.tests.rendering_support.prewarm_fixtures import translated_page_payload as _translated_page_payload
from devtools.tests.rendering_support.prewarm_fixtures import write_document_v1 as _document_v1
from devtools.tests.rendering_support.prewarm_fixtures import write_pseudo_editable_scan_pdf as _pseudo_editable_scan_pdf
from devtools.tests.rendering_support.prewarm_fixtures import write_source_pdf as _source_pdf
from retainpdf_pipeline.render.render_plan import RenderPlan
from retainpdf_pipeline.render.render_inputs import RenderInputs
from retainpdf_pipeline.foundation.config import layout
from retainpdf_pipeline.render.source.prewarm import RenderPrewarmSpec
from retainpdf_pipeline.render.source.prewarm import PAYLOAD_RENDER_ALGORITHM_VERSION
from retainpdf_pipeline.render.source.prewarm import build_render_prewarm_fingerprint
from retainpdf_pipeline.render.source.prewarm import prewarm_manifest_path_from_artifacts_dir
from retainpdf_pipeline.render.source.prewarm import start_render_source_prewarm
from retainpdf_pipeline.render.source.prewarm import try_load_render_payload_prewarm
from retainpdf_pipeline.render.source.prewarm import try_load_prewarmed_render_source_pdf
from retainpdf_pipeline.render.source.prewarm import _pages_for_prewarm_mode_probe
from retainpdf_pipeline.render.source.prewarm_payload import collect_first_line_indent_lookup
from retainpdf_pipeline.render.source.prewarm_payload import first_line_indent_from_item_lines
from retainpdf_pipeline.render.source.prewarm_payload import build_payload_prewarm
from retainpdf_pipeline.render.source.prewarm_page_specs import render_page_specs_from_manifest
from retainpdf_pipeline.render.pdf_structure_profile import pdf_structure_profile_path_from_prewarm_manifest
from retainpdf_pipeline.render.visual_profile import visual_profile_path_from_prewarm_manifest
from retainpdf_pipeline.render.visual_profile.contracts import VISUAL_PROFILE_ALGORITHM_VERSION
from retainpdf_pipeline.render.workflow.executor import execute_render_plan
from retainpdf_pipeline.render.workflow.prewarm_cache import merge_payload_prewarm
from retainpdf_pipeline.render.workflow.prewarm_entry import run_ocr_render_preprocess


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


def test_pixmap_first_line_indent_defaults_disabled_for_larger_prewarm(monkeypatch) -> None:
    monkeypatch.delenv("RETAIN_RENDER_PIXMAP_INDENT", raising=False)
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
        side_effect=AssertionError("pixmap indent should be opt-in for larger documents"),
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
    assert stats["pixmap_reason"] == "default_disabled"


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


def test_pixmap_first_line_indent_auto_enabled_for_tiny_documents(monkeypatch) -> None:
    monkeypatch.delenv("RETAIN_RENDER_PIXMAP_INDENT", raising=False)
    doc = fitz.open()
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
    assert stats["pixmap_reason"] == "small_document_auto_enabled"


def test_render_source_prewarm_manifest_is_reused_without_temp_cleanup() -> None:
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
                render_mode="overlay",
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="bbox_text_strip",
                document_analysis=source_document_analysis(source_pdf),
            )
        )
        manifest_path = handle.wait()
        assert manifest_path == prewarm_manifest_path_from_artifacts_dir(artifacts_dir)
        assert manifest_path.exists()

        render_plan = RenderPlan(
            render_inputs=RenderInputs(
                source_pdf_path=source_pdf,
                translations_dir=translations_dir,
                translation_manifest_path=None,
            ),
            selected_pages=_translated_page_payload(),
            effective_render_mode="overlay",
        )

        def _fake_overlay(*, source_pdf_path, translated_pages, context):
            assert artifacts_dir in source_pdf_path.parents
            assert source_pdf_path.exists()
            return 1, {"route": "prewarm-test"}

        with mock.patch(
            "retainpdf_pipeline.render.workflow.executor.build_render_source_pdf",
            side_effect=AssertionError("synchronous render source prep should not run"),
        ), mock.patch(
            "retainpdf_pipeline.render.workflow.executor.run_overlay_render",
            side_effect=_fake_overlay,
        ):
            pages = execute_render_plan(
                render_plan=render_plan,
                output_pdf_path=output_pdf,
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="bbox_text_strip",
                render_prewarm_manifest_path=manifest_path,
            )

        assert pages == 1
        assert any(path.name.endswith(".source-bbox-text-stripped.pdf") for path in artifacts_dir.rglob("*.pdf"))


def test_render_source_prewarm_accepts_absolute_page_keys_for_partial_ranges() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "rendered" / "out.pdf"
        artifacts_dir = root / "artifacts"
        output_pdf.parent.mkdir()
        doc = fitz.open()
        for page_idx in range(8):
            page = doc.new_page(width=200, height=200)
            page.insert_text((20, 40), f"page {page_idx + 1}", fontsize=12)
        doc.save(source_pdf)
        doc.close()
        base_item = _translated_page_payload()[0][0]
        translated_pages = {
            5: [dict(base_item, item_id="p006-b001")],
            6: [dict(base_item, item_id="p007-b001")],
        }

        handle = start_render_source_prewarm(
            RenderPrewarmSpec(
                source_pdf_path=source_pdf,
                output_pdf_path=output_pdf,
                artifacts_dir=artifacts_dir,
                translated_pages=translated_pages,
                render_mode="overlay",
                start_page=5,
                end_page=6,
                pdf_compress_dpi=0,
                source_cleanup_strategy="bbox_text_strip",
                document_analysis=source_document_analysis(source_pdf),
            )
        )

        manifest_path = handle.wait()
        assert manifest_path == prewarm_manifest_path_from_artifacts_dir(artifacts_dir)
        assert manifest_path.exists()


def test_render_plan_persists_sync_overlay_source_cleanup_for_next_render() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "rendered" / "out.pdf"
        artifacts_dir = root / "artifacts"
        translations_dir = root / "translated"
        output_pdf.parent.mkdir()
        translations_dir.mkdir()
        _source_pdf(source_pdf)
        manifest_path = prewarm_manifest_path_from_artifacts_dir(artifacts_dir)
        translated_pages = _translated_page_payload()
        translated_pages[0][0]["lines"] = [
            {"bbox": [34.0, 20.0, 150.0, 30.0]},
            {"bbox": [12.0, 32.0, 150.0, 42.0]},
            {"bbox": [12.5, 44.0, 150.0, 54.0]},
        ]
        render_plan = RenderPlan(
            render_inputs=RenderInputs(
                source_pdf_path=source_pdf,
                translations_dir=translations_dir,
                translation_manifest_path=None,
            ),
            selected_pages=translated_pages,
            effective_render_mode="overlay",
        )

        seen_indents: list[dict[str, float]] = []
        original_build_render_source_pdf = execute_render_plan.__globals__["build_render_source_pdf"]

        def _fake_overlay(*, source_pdf_path, translated_pages, context):
            assert source_pdf_path.exists()
            seen_indents.append(context.first_line_indent_lookup or {})
            return 1, {"route": "sync-cache-test"}

        def _spy_build_render_source_pdf(**kwargs):
            assert kwargs["source_cleanup_strategy"] == "bbox_text_strip"
            profile_path = kwargs.get("pdf_structure_profile_path")
            assert profile_path == pdf_structure_profile_path_from_prewarm_manifest(manifest_path)
            assert profile_path.exists()
            return original_build_render_source_pdf(**kwargs)

        with mock.patch(
            "retainpdf_pipeline.render.workflow.executor.build_render_source_pdf",
            side_effect=_spy_build_render_source_pdf,
        ), mock.patch(
            "retainpdf_pipeline.render.workflow.executor.run_overlay_render",
            side_effect=_fake_overlay,
        ):
            pages = execute_render_plan(
                render_plan=render_plan,
                output_pdf_path=output_pdf,
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="bbox_text_strip",
                render_prewarm_manifest_path=manifest_path,
            )

        assert pages == 1
        assert manifest_path.exists()
        assert any(path.name.endswith(".source-bbox-text-stripped.pdf") for path in artifacts_dir.rglob("*.pdf"))
        payload_prewarm = try_load_render_payload_prewarm(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=translated_pages,
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
            source_cleanup_strategy="bbox_text_strip",
        )
        assert payload_prewarm is not None
        cached_indent = payload_prewarm.first_line_indent_lookup["p001-b001"]
        assert cached_indent > 0
        assert seen_indents and seen_indents[0]["p001-b001"] == cached_indent
        assert payload_prewarm.bbox_text_strip_candidates is not None
        assert payload_prewarm.bbox_text_strip_candidates.candidate_source == "manifest"

        with mock.patch(
            "retainpdf_pipeline.render.workflow.executor.build_render_source_pdf",
            side_effect=AssertionError("persisted sync render source should be reused"),
        ), mock.patch(
            "retainpdf_pipeline.render.workflow.executor.run_overlay_render",
            side_effect=_fake_overlay,
        ):
            pages = execute_render_plan(
                render_plan=render_plan,
                output_pdf_path=output_pdf,
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="bbox_text_strip",
                render_prewarm_manifest_path=manifest_path,
            )

        assert pages == 1
        diagnostics = dict(getattr(execute_render_plan, "last_render_diagnostics", {}) or {})
        assert diagnostics["bbox_text_strip_candidate_source"] == "manifest"
        assert diagnostics["bbox_text_strip_candidate_pages"] > 0


def test_render_plan_reuses_source_prewarm_without_sync_document_analysis() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "rendered" / "out.pdf"
        artifacts_dir = root / "artifacts"
        translations_dir = root / "translated"
        output_pdf.parent.mkdir()
        translations_dir.mkdir()
        _source_pdf(source_pdf)
        manifest_path = prewarm_manifest_path_from_artifacts_dir(artifacts_dir)
        render_plan = RenderPlan(
            render_inputs=RenderInputs(
                source_pdf_path=source_pdf,
                translations_dir=translations_dir,
                translation_manifest_path=None,
            ),
            selected_pages=_translated_page_payload(),
            effective_render_mode="overlay",
        )

        def _fake_overlay(*, source_pdf_path, translated_pages, context):
            assert source_pdf_path.exists()
            return 1, {"route": "sync-cache-test"}

        with mock.patch(
            "retainpdf_pipeline.render.workflow.executor.run_overlay_render",
            side_effect=_fake_overlay,
        ):
            execute_render_plan(
                render_plan=render_plan,
                output_pdf_path=output_pdf,
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="bbox_text_strip",
                render_prewarm_manifest_path=manifest_path,
            )

        with mock.patch(
            "retainpdf_pipeline.render.analysis.document.builder.build_render_document_analysis",
            side_effect=AssertionError("cached render source should not trigger document analysis scan"),
        ), mock.patch(
            "retainpdf_pipeline.render.workflow.executor.build_render_source_pdf",
            side_effect=AssertionError("persisted sync render source should be reused"),
        ), mock.patch(
            "retainpdf_pipeline.render.workflow.executor.run_overlay_render",
            side_effect=_fake_overlay,
        ):
            pages = execute_render_plan(
                render_plan=render_plan,
                output_pdf_path=output_pdf,
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="bbox_text_strip",
                render_prewarm_manifest_path=manifest_path,
            )

        assert pages == 1


def test_legacy_fast_cover_source_manifest_is_ignored() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "rendered" / "out.pdf"
        artifacts_dir = root / "artifacts"
        output_pdf.parent.mkdir()
        _source_pdf(source_pdf)
        manifest_path = prewarm_manifest_path_from_artifacts_dir(artifacts_dir)
        manifest_path.parent.mkdir(parents=True)
        manifest_path.write_text(
            json.dumps(
                {
                    "schema": "render_source_prewarm_v1",
                    "fingerprint": build_render_prewarm_fingerprint(
                        source_pdf_path=source_pdf,
                        translated_pages=_translated_page_payload(),
                        effective_render_mode="overlay",
                        start_page=0,
                        end_page=0,
                        pdf_compress_dpi=0,
                        source_cleanup_strategy="bbox_text_strip",
                    ),
                    "render_source": {
                        "path": str(source_pdf),
                        "bbox_text_stripped_page_indices": [],
                        "bbox_text_strip_skipped_page_indices": [0],
                        "source_text_precleaned_page_indices": [],
                    },
                    "payload_prewarm": {},
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        prepared = try_load_prewarmed_render_source_pdf(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=_translated_page_payload(),
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
            source_cleanup_strategy="bbox_text_strip",
        )

        assert prepared is None


def test_sync_source_prewarm_preserves_existing_payload_prewarm() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "rendered" / "out.pdf"
        artifacts_dir = root / "artifacts"
        translations_dir = root / "translated"
        output_pdf.parent.mkdir()
        translations_dir.mkdir()
        _source_pdf(source_pdf)
        manifest_path = prewarm_manifest_path_from_artifacts_dir(artifacts_dir)
        manifest_path.parent.mkdir(parents=True)
        render_plan = RenderPlan(
            render_inputs=RenderInputs(
                source_pdf_path=source_pdf,
                translations_dir=translations_dir,
                translation_manifest_path=None,
            ),
            selected_pages=_translated_page_payload(),
            effective_render_mode="overlay",
        )
        existing_payload = {
            "first_line_indent_by_item_id": {"p001-b001": 12.5},
            "effective_inner_bbox_by_item_id": {"p001-b001": [10, 20, 100, 80]},
            "render_color_profile": {
                "algorithm": "render_color_profile_v2_tuple_color",
                "colors_by_item_id": {
                    "p001-b001": {
                        "cover_fill": [0.9, 0.9, 0.9],
                        "text_color": [0.1, 0.1, 0.1],
                    }
                },
            },
        }
        manifest_path.write_text(
            json.dumps(
                {
                    "schema": "render_source_prewarm_v1",
                    "fingerprint": build_render_prewarm_fingerprint(
                        source_pdf_path=source_pdf,
                        translated_pages=_translated_page_payload(),
                        effective_render_mode="overlay",
                        start_page=0,
                        end_page=0,
                        pdf_compress_dpi=0,
                        source_cleanup_strategy="bbox_text_strip",
                    ),
                    "render_source": {"path": "missing.pdf"},
                    "payload_prewarm": existing_payload,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        seen_colors: list[dict] = []

        def _fake_overlay(*, source_pdf_path, translated_pages, context):
            assert source_pdf_path.exists()
            seen_colors.append(context.render_colors_by_item_id or {})
            return 1, {"route": "sync-cache-payload-preserve"}

        with mock.patch(
            "retainpdf_pipeline.render.workflow.executor.run_overlay_render",
            side_effect=_fake_overlay,
        ):
            pages = execute_render_plan(
                render_plan=render_plan,
                output_pdf_path=output_pdf,
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="bbox_text_strip",
                render_prewarm_manifest_path=manifest_path,
            )

        assert pages == 1
        payload_prewarm = try_load_render_payload_prewarm(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=_translated_page_payload(),
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
            source_cleanup_strategy="bbox_text_strip",
        )
        assert payload_prewarm is not None
        assert payload_prewarm.first_line_indent_lookup["p001-b001"] == 12.5
        assert payload_prewarm.render_colors_by_item_id is not None
        assert payload_prewarm.render_colors_by_item_id["p001-b001"]["text_color"] == (0.1, 0.1, 0.1)
        assert payload_prewarm.visual_profile_path is not None
        assert payload_prewarm.visual_profile_path.exists()
        assert seen_colors and seen_colors[0]["p001-b001"]["cover_fill"] == (0.9, 0.9, 0.9)


def test_sync_payload_algorithm_change_replaces_stale_geometry() -> None:
    existing = {
        "geometry_adjustment_algorithm": "geometry_adjustments_v1",
        "payload_render_algorithm": "payload_render_v1",
        "effective_inner_bbox_by_item_id": {
            "p001-abstract": [20.0, 40.0, 250.0, 130.0],
        },
    }
    fresh = {
        "geometry_adjustment_algorithm": "geometry_adjustments_v3_stale_merge_guard",
        "payload_render_algorithm": "payload_render_v2",
        "effective_inner_bbox_by_item_id": {
            "p001-abstract": [20.0, 40.0, 220.0, 130.0],
        },
    }

    merged = merge_payload_prewarm(existing, fresh)

    assert merged["geometry_adjustment_algorithm"] == "geometry_adjustments_v3_stale_merge_guard"
    assert merged["effective_inner_bbox_by_item_id"]["p001-abstract"] == [20.0, 40.0, 220.0, 130.0]


def test_ocr_render_preprocess_manifest_matches_translated_payload() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        source_json = root / "ocr" / "normalized" / "document.v1.json"
        output_pdf = root / "rendered" / "out.pdf"
        artifacts_dir = root / "artifacts"
        output_pdf.parent.mkdir()
        _source_pdf(source_pdf)
        _document_v1(source_json)

        manifest_path = run_ocr_render_preprocess(
            source_json_path=source_json,
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            artifacts_dir=artifacts_dir,
            render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
            source_cleanup_strategy="bbox_text_strip",
            math_mode="direct_typst",
        )

        translated_payload = _translated_page_payload()
        translated_payload[0][0]["item_id"] = "p001-b000"
        translated_payload[0][0]["translation_unit_id"] = "p001-b000"
        translated_payload[0][0]["translation_unit_member_ids"] = ["p001-b000"]
        translated_payload[0][0]["raw_block_type"] = "text"
        translated_payload[0][0]["normalized_sub_type"] = "text"

        assert manifest_path == prewarm_manifest_path_from_artifacts_dir(artifacts_dir)
        assert try_load_prewarmed_render_source_pdf(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=translated_payload,
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
            source_cleanup_strategy="bbox_text_strip",
        ) is None
        payload = try_load_render_payload_prewarm(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=translated_payload,
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
            source_cleanup_strategy=layout.SOURCE_CLEANUP_TYPST_FILL,
        )
        assert payload is not None
        assert payload.render_colors_by_item_id
        assert payload.document_analysis is not None


def test_payload_prewarm_writes_visual_profile_color_manifest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        manifest_path = root / "artifacts" / "render_prewarm" / "render_source_prewarm_manifest.json"
        manifest_path.parent.mkdir(parents=True)
        _source_pdf(source_pdf)

        payload = build_payload_prewarm(
            source_pdf_path=source_pdf,
            translated_pages=_translated_page_payload(),
            manifest_path=manifest_path,
            effective_render_mode="overlay",
            source_cleanup_strategy=layout.SOURCE_CLEANUP_TYPST_FILL,
        )

        color_profile = payload["render_color_profile"]
        assert color_profile["algorithm"] == "render_color_profile_v3_visual_profile"
        assert payload["pdf_structure_profile_path"] == "pdf_structure_profile.v1.json"
        assert payload["visual_profile_path"] == "visual_profile.v1.json"
        assert color_profile["visual_profile_path"] == "visual_profile.v1.json"
        assert color_profile["colors_by_item_id"]
        visual_profile_path = visual_profile_path_from_prewarm_manifest(manifest_path)
        visual_profile = json.loads(visual_profile_path.read_text(encoding="utf-8"))
        assert visual_profile["algorithm"] == VISUAL_PROFILE_ALGORITHM_VERSION
        assert "p001-b001" in visual_profile["pages"]["0"]["items"]
        structure_profile_path = pdf_structure_profile_path_from_prewarm_manifest(manifest_path)
        structure_profile = json.loads(structure_profile_path.read_text(encoding="utf-8"))
        assert structure_profile["algorithm"] == "pdf_structure_profile_v1"
        assert structure_profile["pages"]["0"]["text_objects"]


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
    assert diagnostics["pixmap_enabled"] is False
    assert diagnostics["pixmap_reason"] == "default_disabled"
    assert diagnostics["pixmap_candidates"] == 1
    assert diagnostics["pixmap_disabled_candidates"] == 1
    assert diagnostics["pixmap_checked"] == 0


def test_payload_prewarm_loads_visual_profile_path_from_manifest() -> None:
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
                render_mode="overlay",
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy=layout.SOURCE_CLEANUP_TYPST_FILL,
            )
        )
        manifest_path = handle.wait()

        payload_prewarm = try_load_render_payload_prewarm(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=_translated_page_payload(),
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
            source_cleanup_strategy=layout.SOURCE_CLEANUP_TYPST_FILL,
        )

        assert payload_prewarm is not None
        assert payload_prewarm.visual_profile_path == visual_profile_path_from_prewarm_manifest(manifest_path)
        assert payload_prewarm.visual_profile_path.exists()
        assert payload_prewarm.pdf_structure_profile_path == pdf_structure_profile_path_from_prewarm_manifest(manifest_path)
        assert payload_prewarm.pdf_structure_profile_path.exists()
        assert payload_prewarm.render_colors_by_item_id


def test_prewarm_mode_probe_uses_source_text_without_mutating_payload() -> None:
    pages = _page_payload()
    assert pages[0][0].get("render_protected_text") is None

    probed = _pages_for_prewarm_mode_probe(pages)

    assert probed[0][0]["render_protected_text"] == "inside source"
    assert pages[0][0].get("render_protected_text") is None


def test_second_prewarm_reuses_existing_source_and_refreshes_payload() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "rendered" / "out.pdf"
        artifacts_dir = root / "artifacts"
        output_pdf.parent.mkdir()
        _source_pdf(source_pdf)

        first_handle = start_render_source_prewarm(
            RenderPrewarmSpec(
                source_pdf_path=source_pdf,
                output_pdf_path=output_pdf,
                artifacts_dir=artifacts_dir,
                translated_pages=_translated_page_payload(),
                render_mode="overlay",
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="bbox_text_strip",
                document_analysis=source_document_analysis(source_pdf),
            )
        )
        manifest_path = first_handle.wait()

        with mock.patch(
            "retainpdf_pipeline.render.source.prewarm.build_render_source_pdf",
            side_effect=AssertionError("existing prewarmed source should be reused"),
        ):
            second_handle = start_render_source_prewarm(
                RenderPrewarmSpec(
                    source_pdf_path=source_pdf,
                    output_pdf_path=output_pdf,
                    artifacts_dir=artifacts_dir,
                    translated_pages=_translated_page_payload(),
                    render_mode="overlay",
                    start_page=0,
                    end_page=0,
                    pdf_compress_dpi=0,
                    source_cleanup_strategy="bbox_text_strip",
                )
            )
            assert second_handle.wait() == manifest_path

        payload_prewarm = try_load_render_payload_prewarm(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=_translated_page_payload(),
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
            source_cleanup_strategy="bbox_text_strip",
        )
        assert payload_prewarm is not None
        assert payload_prewarm.render_colors_by_item_id


def test_payload_prewarm_manifest_exposes_bbox_candidates() -> None:
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
                render_mode="overlay",
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="bbox_text_strip",
                document_analysis=source_document_analysis(source_pdf),
            )
        )
        manifest_path = handle.wait()

        payload_prewarm = try_load_render_payload_prewarm(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=_translated_page_payload(),
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
            source_cleanup_strategy="bbox_text_strip",
        )

        assert payload_prewarm is not None
        assert payload_prewarm.document_analysis is not None
        assert payload_prewarm.document_analysis.page(0) is not None
        assert payload_prewarm.bbox_text_strip_candidates is not None
        assert payload_prewarm.bbox_text_strip_candidates.page_rects


def test_payload_prewarm_pikepdf_text_strip_exposes_bbox_candidates() -> None:
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
                render_mode="overlay",
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="pikepdf_text_strip",
            )
        )
        manifest_path = handle.wait()

        payload_prewarm = try_load_render_payload_prewarm(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=_translated_page_payload(),
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
            source_cleanup_strategy="pikepdf_text_strip",
        )

        assert payload_prewarm is not None
        assert payload_prewarm.bbox_text_strip_candidates is not None
        assert payload_prewarm.bbox_text_strip_candidates.page_rects


def test_render_source_prewarm_keeps_no_text_overlap_pages_as_precleaned() -> None:
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
                translated_pages=_empty_region_page_payload(),
                render_mode="overlay",
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="bbox_text_strip",
            )
        )
        manifest_path = handle.wait()

        prepared = try_load_prewarmed_render_source_pdf(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=_empty_region_page_payload(),
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
            source_cleanup_strategy="bbox_text_strip",
        )

        assert prepared is not None
        assert prepared.bbox_text_stripped_page_indices == frozenset()
        assert prepared.bbox_text_strip_skipped_page_indices == frozenset({0})
        assert prepared.source_text_precleaned_page_indices == frozenset()
        assert prepared.source_cleanup_cover_fallback_page_indices == frozenset({0})


def test_pseudo_editable_scan_pages_keep_cover_fallback_without_physical_strip() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "rendered" / "out.pdf"
        artifacts_dir = root / "artifacts"
        output_pdf.parent.mkdir()
        _pseudo_editable_scan_pdf(source_pdf)

        handle = start_render_source_prewarm(
            RenderPrewarmSpec(
                source_pdf_path=source_pdf,
                output_pdf_path=output_pdf,
                artifacts_dir=artifacts_dir,
                translated_pages=_translated_page_payload(),
                render_mode="overlay",
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="pikepdf_text_strip",
            )
        )
        manifest_path = handle.wait()

        prepared = try_load_prewarmed_render_source_pdf(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=_translated_page_payload(),
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
            source_cleanup_strategy="pikepdf_text_strip",
        )

        assert prepared is not None
        assert prepared.bbox_text_stripped_page_indices == frozenset()
        assert prepared.bbox_text_strip_skipped_page_indices == frozenset({0})
        assert prepared.source_text_precleaned_page_indices == frozenset()
        assert prepared.source_cleanup_cover_fallback_page_indices == frozenset({0})


def test_payload_prewarm_default_pikepdf_text_strip_exposes_bbox_candidates() -> None:
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
                render_mode="overlay",
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
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
        )

        assert payload_prewarm is not None
        assert payload_prewarm.bbox_text_strip_candidates is not None
        assert payload_prewarm.bbox_text_strip_candidates.page_rects


def test_render_prewarm_fingerprint_tracks_payload_render_algorithm() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        _source_pdf(source_pdf)

        fingerprint = build_render_prewarm_fingerprint(
            source_pdf_path=source_pdf,
            translated_pages=_translated_page_payload(),
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
        )

    assert fingerprint["payload_render_algorithm"] == PAYLOAD_RENDER_ALGORITHM_VERSION
    assert fingerprint["bbox_text_strip_algorithm"] == "bbox_text_strip"
    assert len(str(fingerprint["bbox_text_strip_implementation_hash"])) == 64


def test_render_prewarm_fingerprint_tracks_translated_text_changes() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        _source_pdf(source_pdf)

        first_payload = _translated_page_payload()
        second_payload = _translated_page_payload()
        second_payload[0][0]["protected_translated_text"] = "另一版译文"

        first = build_render_prewarm_fingerprint(
            source_pdf_path=source_pdf,
            translated_pages=first_payload,
            effective_render_mode="typst_visual",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
        )
        second = build_render_prewarm_fingerprint(
            source_pdf_path=source_pdf,
            translated_pages=second_payload,
            effective_render_mode="typst_visual",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
        )

    assert first["render_payload_hash"] != second["render_payload_hash"]
    assert first != second


def test_render_prewarm_fingerprint_tracks_formula_map_changes() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        _source_pdf(source_pdf)

        first_payload = _translated_page_payload()
        second_payload = _translated_page_payload()
        first_payload[0][0]["formula_map"] = [{"placeholder": "<f0-abc/>", "formula_text": "c_{\\kappa}"}]
        second_payload[0][0]["formula_map"] = [{"placeholder": "<f0-abc/>", "formula_text": "c_{\\lambda}"}]

        first = build_render_prewarm_fingerprint(
            source_pdf_path=source_pdf,
            translated_pages=first_payload,
            effective_render_mode="typst_visual",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
        )
        second = build_render_prewarm_fingerprint(
            source_pdf_path=source_pdf,
            translated_pages=second_payload,
            effective_render_mode="typst_visual",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
        )

    assert first["render_payload_hash"] != second["render_payload_hash"]
    assert first != second


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


def test_execute_typst_visual_uses_prewarmed_background_page_specs() -> None:
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

        def _fake_background(*, source_pdf_path, translated_pages, context, visual_only_background):
            assert visual_only_background is True
            assert context.background_render_page_specs is not None
            assert context.background_render_page_specs[0].blocks[0].plain_text
            return 1, {"route": "prewarmed-background-specs"}

        with mock.patch(
            "retainpdf_pipeline.render.workflow.executor.run_background_typst_render",
            side_effect=_fake_background,
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


def test_redact_restore_formula_strategy_is_runtime_alias_for_pikepdf_text_strip() -> None:
    assert layout.normalize_source_cleanup_strategy("redact_restore_formulas") == "pikepdf_text_strip"
    assert layout.use_bbox_text_strip_cleanup("redact_restore_formulas") is True
    assert layout.use_redact_restore_formula_cleanup("redact_restore_formulas") is False


def test_payload_prewarm_explicit_typst_fill_skips_bbox_candidates() -> None:
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
                render_mode="overlay",
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
                source_cleanup_strategy="typst_fill",
            )
        )
        manifest_path = handle.wait()

        payload_prewarm = try_load_render_payload_prewarm(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=_translated_page_payload(),
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
            source_cleanup_strategy="typst_fill",
        )

        assert payload_prewarm is not None
        assert payload_prewarm.bbox_text_strip_candidates is None


def test_payload_prewarm_manifest_exposes_geometry_adjustments() -> None:
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
                translated_pages=_tight_gap_page_payload(),
                render_mode="overlay",
                start_page=0,
                end_page=0,
                pdf_compress_dpi=0,
            )
        )
        manifest_path = handle.wait()

        payload_prewarm = try_load_render_payload_prewarm(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf,
            translated_pages=_tight_gap_page_payload(),
            effective_render_mode="overlay",
            start_page=0,
            end_page=0,
            pdf_compress_dpi=0,
        )

        assert payload_prewarm is not None
        adjusted = payload_prewarm.effective_inner_bbox_lookup["p001-b001"]
        assert adjusted[1] > 20.0
        assert adjusted[3] < 70.0
