"""Source-layout migration must not redirect runtime data or lose resources."""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys

import pytest


REPO_ROOT = Path(__file__).resolve().parents[5]


@pytest.mark.parametrize("explicit_root", [False, True])
def test_repository_paths_from_unrelated_working_directory(tmp_path, explicit_root):
    environment = dict(os.environ)
    for name in ("RETAIN_PDF_PROJECT_ROOT", "RUST_API_PROJECT_ROOT", "OUTPUT_ROOT",
                 "RUST_API_OUTPUT_ROOT", "RETAIN_PDF_FONTS_DIR", "RETAIN_OCR_PROVIDER_CONFIG"):
        environment.pop(name, None)
    environment["PYTHONPATH"] = str(REPO_ROOT / "backend/pipeline")
    if explicit_root:
        environment["RETAIN_PDF_PROJECT_ROOT"] = str(REPO_ROOT)
    result = subprocess.run(
        [sys.executable, "-c", """
import json
from retainpdf_pipeline.foundation.config.paths import ROOT_DIR, BACKEND_ROOT, OUTPUT_DIR
from retainpdf_pipeline.foundation.config.fonts import _default_fonts_dir
from retainpdf_pipeline.ocr.ocr_provider_config import _config_path
print(json.dumps(list(map(str, [ROOT_DIR, BACKEND_ROOT, OUTPUT_DIR, _default_fonts_dir(), _config_path()]))))
"""], cwd=tmp_path, env=environment, text=True, capture_output=True, check=True,
    )
    assert json.loads(result.stdout) == [
        str(REPO_ROOT), str(REPO_ROOT / "backend"), str(REPO_ROOT / "data"),
        str(REPO_ROOT / "resources/fonts"), str(REPO_ROOT / "backend/config/ocr_providers.json"),
    ]
