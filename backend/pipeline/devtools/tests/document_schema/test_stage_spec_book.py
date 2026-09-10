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

def test_book_stage_spec_loads_and_resolves_credentials(tmp_path: Path, monkeypatch) -> None:
    job_root = tmp_path / "20260414-bookjob"
    ensure_job_dirs(resolve_job_dirs(job_root))
    source_json = tmp_path / "document.v1.json"
    source_pdf = tmp_path / "source.pdf"
    layout_json = tmp_path / "layout.json"
    source_json.write_text("{}", encoding="utf-8")
    source_pdf.write_bytes(b"%PDF-1.4\n")
    layout_json.write_text("{}", encoding="utf-8")
    spec_path = job_root / "specs" / "book.spec.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": BOOK_STAGE_SCHEMA_VERSION,
                "stage": "book",
                "job": {
                    "job_id": "20260414-bookjob",
                    "job_root": str(job_root),
                    "workflow": "translate",
                },
                "inputs": {
                    "source_json": str(source_json),
                    "source_pdf": str(source_pdf),
                    "layout_json": str(layout_json),
                },
                "translation": {
                    "start_page": 0,
                    "end_page": -1,
                    "batch_size": 8,
                    "workers": 4,
                    "mode": "sci",
                    "skip_title_translation": False,
                    "classify_batch_size": 12,
                    "rule_profile_name": "general_sci",
                    "custom_rules_text": "",
                    "glossary_id": "",
                    "glossary_name": "",
                    "glossary_resource_entry_count": 0,
                    "glossary_inline_entry_count": 0,
                    "glossary_overridden_entry_count": 0,
                    "glossary_entries": [],
                    "model": "deepseek-v4-flash",
                    "base_url": "https://api.deepseek.com/v1",
                    "credential_ref": "env:RETAIN_TRANSLATION_API_KEY",
                },
                "render": {
                    "render_mode": "typst",
                    "compile_workers": 0,
                    "typst_font_family": "Source Han Serif SC",
                    "pdf_compress_dpi": 150,
                    "translated_pdf_name": "out.pdf",
                    "body_font_size_factor": 1.0,
                    "body_leading_factor": 1.0,
                    "inner_bbox_shrink_x": 0.0,
                    "inner_bbox_shrink_y": 0.0,
                    "inner_bbox_dense_shrink_x": 0.0,
                    "inner_bbox_dense_shrink_y": 0.0,
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("RETAIN_TRANSLATION_API_KEY", "sk-stage-test")

    spec = BookStageSpec.load(spec_path)

    assert spec.stage == "book"
    assert spec.inputs.source_json == source_json.resolve()
    assert spec.inputs.layout_json == layout_json.resolve()
    assert resolve_credential_ref(spec.translation.credential_ref) == "sk-stage-test"


