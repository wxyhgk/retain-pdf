from __future__ import annotations

import sys
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from devtools import check_pipeline_architecture
from devtools.architecture_checks import common as architecture_common
from devtools.architecture_checks import rendering as rendering_checks


def test_pipeline_architecture_contract_passes() -> None:
    assert check_pipeline_architecture.main() == 0


def test_pipeline_architecture_rejects_removed_bbox_preparation_import(tmp_path: Path) -> None:
    rendering_root = tmp_path / "render"
    source_root = rendering_root / "source"
    source_root.mkdir(parents=True)
    offender = source_root / "bad_import.py"
    offender.write_text(
        "from retainpdf_pipeline.render.source.preparation.bbox_text_strip_engine import run\n",
        encoding="utf-8",
    )

    errors: list[str] = []
    with (
        mock.patch.object(rendering_checks, "RENDERING_ROOT", rendering_root),
        mock.patch.object(rendering_checks, "RENDERING_SOURCE_ROOT", source_root),
        mock.patch.object(
            rendering_checks,
            "RENDERING_SOURCE_CLEANUP_ROOT",
            rendering_root / "source_cleanup",
        ),
        mock.patch.object(
            rendering_checks,
            "RENDERING_PROFILE_ROOT",
            rendering_root / "analysis" / "profile",
        ),
        mock.patch.object(
            rendering_checks,
            "RENDERING_ROUTE_ROOT",
            rendering_root / "analysis" / "route",
        ),
        mock.patch.object(
            rendering_checks,
            "RENDERING_TYPST_ROOT",
            rendering_root / "output" / "typst",
        ),
        mock.patch.object(
            rendering_checks,
            "RENDERING_LAYOUT_ROOT",
            rendering_root / "layout",
        ),
        mock.patch.object(rendering_checks, "SCRIPTS_ROOT", tmp_path),
        mock.patch.object(architecture_common, "SCRIPTS_ROOT", tmp_path),
    ):
        rendering_checks.check_rendering_internal_boundaries(errors)

    assert any("removed bbox source-preparation module" in item for item in errors)


def test_pipeline_architecture_rejects_source_cleanup_next_mainline_import(tmp_path: Path) -> None:
    rendering_root = tmp_path / "render"
    source_cleanup_root = rendering_root / "source_cleanup"
    source_cleanup_root.mkdir(parents=True)
    offender = source_cleanup_root / "bad_import.py"
    offender.write_text(
        "from retainpdf_pipeline.render.source_cleanup import build_source_cleanup_plan\n"
        "from retainpdf_pipeline.render.source_cleanup.planning.decision_builder import build_decision\n",
        encoding="utf-8",
    )

    errors: list[str] = []
    with (
        mock.patch.object(rendering_checks, "RENDERING_ROOT", rendering_root),
        mock.patch.object(rendering_checks, "RENDERING_SOURCE_ROOT", rendering_root / "source"),
        mock.patch.object(
            rendering_checks,
            "RENDERING_SOURCE_CLEANUP_ROOT",
            source_cleanup_root,
        ),
        mock.patch.object(
            rendering_checks,
            "RENDERING_PROFILE_ROOT",
            rendering_root / "analysis" / "profile",
        ),
        mock.patch.object(
            rendering_checks,
            "RENDERING_ROUTE_ROOT",
            rendering_root / "analysis" / "route",
        ),
        mock.patch.object(
            rendering_checks,
            "RENDERING_TYPST_ROOT",
            rendering_root / "output" / "typst",
        ),
        mock.patch.object(
            rendering_checks,
            "RENDERING_LAYOUT_ROOT",
            rendering_root / "layout",
        ),
        mock.patch.object(rendering_checks, "SCRIPTS_ROOT", tmp_path),
        mock.patch.object(architecture_common, "SCRIPTS_ROOT", tmp_path),
    ):
        rendering_checks.check_rendering_internal_boundaries(errors)

    assert any("source_cleanup_next experiment module" in item for item in errors)
    assert any("experimental source cleanup symbol 'build_source_cleanup_plan'" in item for item in errors)
