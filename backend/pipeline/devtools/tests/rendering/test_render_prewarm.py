"""渲染源预热：source 预热 manifest 的复用与失效、render plan 跳过同步分析、二次预热刷新 payload。

首行缩进、payload manifest、指纹、背景页 spec 各自拆到了
test_prewarm_first_line_indent.py / test_payload_prewarm_manifest.py /
test_render_prewarm_fingerprint.py / test_prewarm_background_specs.py。
"""

import tempfile
import json
from pathlib import Path
from unittest import mock

import fitz

from devtools.tests.rendering_support.prewarm_fixtures import empty_region_page_payload as _empty_region_page_payload
from devtools.tests.rendering_support.prewarm_fixtures import page_payload as _page_payload
from devtools.tests.rendering_support.prewarm_fixtures import source_document_analysis
from devtools.tests.rendering_support.prewarm_fixtures import translated_page_payload as _translated_page_payload
from devtools.tests.rendering_support.prewarm_fixtures import write_pseudo_editable_scan_pdf as _pseudo_editable_scan_pdf
from devtools.tests.rendering_support.prewarm_fixtures import write_source_pdf as _source_pdf
from retainpdf_pipeline.render.render_plan import RenderPlan
from retainpdf_pipeline.render.render_inputs import RenderInputs
from retainpdf_pipeline.render.source.prewarm import RenderPrewarmSpec
from retainpdf_pipeline.render.source.prewarm import build_render_prewarm_fingerprint
from retainpdf_pipeline.render.source.prewarm import prewarm_manifest_path_from_artifacts_dir
from retainpdf_pipeline.render.source.prewarm import start_render_source_prewarm
from retainpdf_pipeline.render.source.prewarm import try_load_render_payload_prewarm
from retainpdf_pipeline.render.source.prewarm import try_load_prewarmed_render_source_pdf
from retainpdf_pipeline.render.source.prewarm import _pages_for_prewarm_mode_probe
from retainpdf_pipeline.render.pdf_structure_profile import pdf_structure_profile_path_from_prewarm_manifest
from retainpdf_pipeline.render.workflow.executor import execute_render_plan
from retainpdf_pipeline.render.workflow.prewarm_cache import merge_payload_prewarm


def test_render_source_prewarm_manifest_is_reused_without_temp_cleanup(monkeypatch) -> None:
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
        ), mock.patch.dict(
            "retainpdf_pipeline.render.workflow.modes.RENDER_MODE_HANDLERS",
            {"overlay": _fake_overlay},
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


def test_render_plan_persists_sync_overlay_source_cleanup_for_next_render(monkeypatch) -> None:
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
        ), mock.patch.dict(
            "retainpdf_pipeline.render.workflow.modes.RENDER_MODE_HANDLERS",
            {"overlay": _fake_overlay},
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
        ), mock.patch.dict(
            "retainpdf_pipeline.render.workflow.modes.RENDER_MODE_HANDLERS",
            {"overlay": _fake_overlay},
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


def test_render_plan_reuses_source_prewarm_without_sync_document_analysis(monkeypatch) -> None:
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

        with mock.patch.dict(
            "retainpdf_pipeline.render.workflow.modes.RENDER_MODE_HANDLERS",
            {"overlay": _fake_overlay},
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
        ), mock.patch.dict(
            "retainpdf_pipeline.render.workflow.modes.RENDER_MODE_HANDLERS",
            {"overlay": _fake_overlay},
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


def test_cold_sync_render_prepare_emits_main_lane_steps_and_warm_render_skips_them(monkeypatch) -> None:
    # These render stubs intentionally do not produce a PDF.
    monkeypatch.setattr(
        "retainpdf_pipeline.render.workflow.executor.relocate_translated_links",
        lambda *args: {"moved": 0, "unchanged": 0, "unresolved": []},
    )
    from retainpdf_base.events import PipelineEventWriter
    from retainpdf_base.events import pipeline_event_writer_scope

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
            return 1, {"route": "render-prepare-events-test"}

        def _render_and_collect(job_id: str) -> list[dict]:
            logs_dir = root / job_id / "logs"
            writer = PipelineEventWriter(job_id=job_id, job_root=root / job_id, logs_dir=logs_dir)
            with pipeline_event_writer_scope(writer), mock.patch.dict(
                "retainpdf_pipeline.render.workflow.modes.RENDER_MODE_HANDLERS",
                {"overlay": _fake_overlay},
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
            events_path = logs_dir / "pipeline_events.jsonl"
            if not events_path.exists():
                return []
            return [
                json.loads(line)
                for line in events_path.read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]

        cold_rows = _render_and_collect("cold")
        prepare_rows = [row for row in cold_rows if row["substage"] == "render_prepare"]
        assert [(row["progress_current"], row["progress_total"]) for row in prepare_rows] == [
            (0, 4),
            (1, 4),
            (2, 4),
            (3, 4),
            (4, 4),
        ]
        assert [row["payload"]["render_prepare_step"] for row in prepare_rows] == [
            "document_analysis",
            "source_cleanup",
            "payload_layout_color",
            "background_specs",
            "done",
        ]
        assert {row["stage"] for row in prepare_rows} == {"rendering"}
        assert {row["user_stage"] for row in prepare_rows} == {"render"}
        assert {row["progress_unit"] for row in prepare_rows} == {"step"}
        assert all(row["event_type"] == "stage_progress" for row in prepare_rows)
        # Preparation progress must not masquerade as a 0/N render page event.
        assert not any(
            row["substage"] == "render_pages" and row["progress_current"] == 0 for row in cold_rows
        )

        warm_rows = _render_and_collect("warm")
        assert [row for row in warm_rows if row["substage"] == "render_prepare"] == []


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


def test_sync_source_prewarm_preserves_existing_payload_prewarm(monkeypatch) -> None:
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

        with mock.patch.dict(
            "retainpdf_pipeline.render.workflow.modes.RENDER_MODE_HANDLERS",
            {"overlay": _fake_overlay},
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
