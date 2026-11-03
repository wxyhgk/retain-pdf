from __future__ import annotations


import pytest

from devtools.architecture_checks import translation_surface as checks


def _check_sources(tmp_path, monkeypatch, script="", recovery=""):
    devtools = tmp_path / "devtools"
    workflow = tmp_path / "translate" / "workflow"
    devtools.mkdir()
    workflow.mkdir(parents=True)
    (devtools / "repair_mineru_cross_page.py").write_text(script, encoding="utf-8")
    (workflow / "recovery.py").write_text(recovery, encoding="utf-8")
    monkeypatch.setattr(checks, "DEVTOOLS_ROOT", devtools)
    monkeypatch.setattr(checks, "TRANSLATION_ROOT", workflow.parent)
    monkeypatch.setattr(checks, "rel", lambda path: path.relative_to(tmp_path))
    errors = []
    checks.check_translation_recovery_boundary(errors)
    return errors


def test_repair_can_import_only_the_public_operation(tmp_path, monkeypatch):
    assert not _check_sources(
        tmp_path, monkeypatch,
        script="from retainpdf_translation.public import prepare_relocated_translation_copy as recover\n",
        recovery="from retainpdf_translation.workflow.checkpoint.store import CheckpointStore\n",
    )


@pytest.mark.parametrize("statement", [
    "from retainpdf_translation.workflow.checkpoint.store import CheckpointStore",
    "from retainpdf_translation.public import CheckpointStore",
    "from retainpdf_translation.public import *",
    "import retainpdf_translation.public as translation",
    "from retainpdf_translation.public.recovery import prepare_relocated_translation_copy",
    "def nested():\n    from retainpdf_translation.core.payload import manifest as m",
])
def test_repair_cannot_reach_translation_internals_or_widen_its_api(tmp_path, monkeypatch, statement):
    errors = _check_sources(tmp_path, monkeypatch, script=statement)
    assert any("only the public" in error for error in errors)


@pytest.mark.parametrize("module", [
    "retainpdf_pipeline.ocr.mineru_provider.artifacts",
    "retainpdf_pipeline.ocr.document_schema.adapters",
    "devtools.repair_mineru_cross_page",
])
def test_translation_recovery_cannot_import_provider_or_caller_implementations(tmp_path, monkeypatch, module):
    errors = _check_sources(tmp_path, monkeypatch, recovery=f"import {module} as implementation\n")
    assert any("normalized documents and mappings" in error for error in errors)


def test_recovery_does_not_export_checkpoint_implementation_helpers():
    from retainpdf_translation import public

    assert "prepare_relocated_translation_copy" in public.__all__
    assert not set(public.__all__) & {
        "CheckpointStore", "advance_checkpoint", "project_progress", "build_document_identity",
        "_atomic_write_json", "_sha256_json",
    }


def test_recovery_boundary_ignores_comments_and_literals(tmp_path, monkeypatch):
    assert not _check_sources(
        tmp_path, monkeypatch,
        script='# from retainpdf_translation.public import CheckpointStore\n',
        recovery='NOTE = "import retainpdf_pipeline.ocr.mineru_provider"\n',
    )
