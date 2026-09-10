from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.foundation.shared.job_dirs import ensure_job_dirs
from retainpdf_pipeline.foundation.shared.job_dirs import resolve_job_dirs
from retainpdf_pipeline.foundation.shared.stage_specs import NormalizeStageSpec
from retainpdf_pipeline.foundation.shared.stage_specs import build_stage_invocation_metadata
from retainpdf_pipeline.foundation.shared.stage_specs import BookStageSpec
from retainpdf_pipeline.foundation.shared.stage_specs import BOOK_STAGE_SCHEMA_VERSION
from retainpdf_pipeline.foundation.shared.stage_specs import NORMALIZE_STAGE_SCHEMA_VERSION
from retainpdf_pipeline.foundation.shared.stage_specs import ProviderStageSpec
from retainpdf_pipeline.foundation.shared.stage_specs import PROVIDER_STAGE_SCHEMA_VERSION
from retainpdf_pipeline.foundation.shared.stage_specs import resolve_credential_ref
from retainpdf_pipeline.foundation.shared.stage_specs import TranslateStageSpec
from retainpdf_pipeline.foundation.shared.stage_specs import TRANSLATE_STAGE_SCHEMA_VERSION
from retainpdf_pipeline.foundation.shared.stage_specs import RenderStageSpec
from retainpdf_pipeline.foundation.shared.stage_specs import RENDER_STAGE_SCHEMA_VERSION
from retainpdf_pipeline.foundation.config import fonts

def test_normalize_stage_spec_loads_and_derives_job_dirs(tmp_path: Path) -> None:
    job_root = tmp_path / "20260414-testjob"
    ensure_job_dirs(resolve_job_dirs(job_root))
    source_json = tmp_path / "layout.json"
    source_pdf = tmp_path / "source.pdf"
    source_json.write_text("{}", encoding="utf-8")
    source_pdf.write_bytes(b"%PDF-1.4\n")
    spec_path = job_root / "specs" / "normalize.spec.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": NORMALIZE_STAGE_SCHEMA_VERSION,
                "stage": "normalize",
                "job": {
                    "job_id": "20260414-testjob",
                    "job_root": str(job_root),
                    "workflow": "ocr",
                },
                "inputs": {
                    "provider": "mineru",
                    "source_json": str(source_json),
                    "source_pdf": str(source_pdf),
                    "provider_version": "v1",
                    "provider_result_json": "",
                    "provider_zip": "",
                    "provider_raw_dir": "",
                },
                "params": {},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    spec = NormalizeStageSpec.load(spec_path)

    assert spec.stage == "normalize"
    assert spec.schema_version == NORMALIZE_STAGE_SCHEMA_VERSION
    assert spec.job.job_id == "20260414-testjob"
    assert spec.inputs.provider == "mineru"
    assert spec.job_dirs.root == job_root.resolve()
    assert spec.job_dirs.ocr_dir == job_root.resolve() / "ocr"


def test_normalize_stage_spec_rejects_wrong_schema_version(tmp_path: Path) -> None:
    source_json = tmp_path / "layout.json"
    source_pdf = tmp_path / "source.pdf"
    source_json.write_text("{}", encoding="utf-8")
    source_pdf.write_bytes(b"%PDF-1.4\n")
    spec_path = tmp_path / "normalize.spec.json"
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": "normalize.stage.v999",
                "stage": "normalize",
                "job": {
                    "job_id": "job-1",
                    "job_root": str(tmp_path / "job-1"),
                    "workflow": "ocr",
                },
                "inputs": {
                    "provider": "mineru",
                    "source_json": str(source_json),
                    "source_pdf": str(source_pdf),
                },
                "params": {},
            }
        ),
        encoding="utf-8",
    )

    try:
        NormalizeStageSpec.load(spec_path)
    except RuntimeError as exc:
        assert "unsupported normalize stage schema_version" in str(exc)
    else:
        raise AssertionError("expected schema version error")


