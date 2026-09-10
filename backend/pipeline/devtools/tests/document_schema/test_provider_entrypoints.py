from __future__ import annotations

from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]


def test_run_provider_ocr_entrypoint_targets_provider_pipeline() -> None:
    entrypoint_path = REPO_SCRIPTS_ROOT / "retainpdf_pipeline" / "entrypoints" / "run_provider_ocr.py"
    source = entrypoint_path.read_text(encoding="utf-8")

    assert "from retainpdf_pipeline.ocr.ocr_provider.provider_pipeline import main" in source
    assert "retainpdf_pipeline.ocr.mineru.ocr_pipeline" not in source
