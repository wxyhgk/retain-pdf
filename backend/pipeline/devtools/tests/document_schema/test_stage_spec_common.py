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

def test_stage_spec_loaders_preserve_zero_end_page(tmp_path: Path) -> None:
    job_root = tmp_path / "20260513-zero-end-page"
    ensure_job_dirs(resolve_job_dirs(job_root))
    source_pdf = tmp_path / "source.pdf"
    source_json = tmp_path / "document.v1.json"
    layout_json = tmp_path / "layout.json"
    translations_dir = job_root / "translated"
    manifest = translations_dir / "translation-manifest.json"
    source_pdf.write_bytes(b"%PDF-1.4\n")
    source_json.write_text("{}", encoding="utf-8")
    layout_json.write_text("{}", encoding="utf-8")
    translations_dir.mkdir(parents=True, exist_ok=True)
    manifest.write_text("{}", encoding="utf-8")
    specs_dir = job_root / "specs"
    specs_dir.mkdir(parents=True, exist_ok=True)
    job = {
        "job_id": "20260513-zero-end-page",
        "job_root": str(job_root),
        "workflow": "book",
    }
    translation = {
        "start_page": 0,
        "end_page": 0,
        "batch_size": 1,
        "workers": 1,
        "mode": "sci",
        "math_mode": "direct_typst",
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
        "model": "deepseek-chat",
        "base_url": "https://api.deepseek.com/v1",
        "credential_ref": "",
    }
    render = {
        "start_page": 0,
        "end_page": 0,
        "render_mode": "typst",
        "compile_workers": 0,
        "typst_font_family": "",
        "pdf_compress_dpi": 150,
        "translated_pdf_name": "out.pdf",
        "body_font_size_factor": 1.0,
        "body_leading_factor": 1.0,
        "inner_bbox_shrink_x": 0.0,
        "inner_bbox_shrink_y": 0.0,
        "inner_bbox_dense_shrink_x": 0.0,
        "inner_bbox_dense_shrink_y": 0.0,
        "font_unify_mode": "off",
        "model": "deepseek-chat",
        "base_url": "https://api.deepseek.com/v1",
        "credential_ref": "",
    }

    translate_path = specs_dir / "translate.spec.json"
    translate_path.write_text(
        json.dumps(
            {
                "schema_version": TRANSLATE_STAGE_SCHEMA_VERSION,
                "stage": "translate",
                "job": job,
                "inputs": {"source_json": str(source_json), "source_pdf": str(source_pdf), "layout_json": ""},
                "params": translation,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    render_path = specs_dir / "render.spec.json"
    render_path.write_text(
        json.dumps(
            {
                "schema_version": RENDER_STAGE_SCHEMA_VERSION,
                "stage": "render",
                "job": job,
                "inputs": {
                    "source_pdf": str(source_pdf),
                    "translations_dir": str(translations_dir),
                    "translation_manifest": str(manifest),
                },
                "params": render,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    provider_path = specs_dir / "provider.spec.json"
    provider_path.write_text(
        json.dumps(
            {
                "schema_version": PROVIDER_STAGE_SCHEMA_VERSION,
                "stage": "provider",
                "job": job,
                "source": {"file_url": "", "file_path": str(source_pdf)},
                "ocr": {"provider": "paddle", "credential_ref": "", "page_ranges": "1"},
                "translation": translation,
                "render": {key: value for key, value in render.items() if key not in {"start_page", "end_page", "model", "base_url", "credential_ref"}},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    book_path = specs_dir / "book.spec.json"
    book_path.write_text(
        json.dumps(
            {
                "schema_version": BOOK_STAGE_SCHEMA_VERSION,
                "stage": "book",
                "job": job,
                "inputs": {"source_json": str(source_json), "source_pdf": str(source_pdf), "layout_json": str(layout_json)},
                "translation": translation,
                "render": {key: value for key, value in render.items() if key not in {"start_page", "end_page", "model", "base_url", "credential_ref"}},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    assert TranslateStageSpec.load(translate_path).params.end_page == 0
    assert RenderStageSpec.load(render_path).params.end_page == 0
    assert RenderStageSpec.load(render_path).params.font_unify_mode == "off"
    assert ProviderStageSpec.load(provider_path).translation.end_page == 0
    assert ProviderStageSpec.load(provider_path).render.font_unify_mode == "off"
    assert BookStageSpec.load(book_path).translation.end_page == 0
    assert BookStageSpec.load(book_path).render.font_unify_mode == "off"


def test_build_stage_invocation_metadata_is_always_stage_spec() -> None:
    spec_invocation = build_stage_invocation_metadata(
        stage="book",
        stage_spec_schema_version=BOOK_STAGE_SCHEMA_VERSION,
    )
    legacy_like_invocation = build_stage_invocation_metadata(
        stage="translate",
    )

    assert spec_invocation == {
        "stage": "book",
        "input_protocol": "stage_spec",
        "stage_spec_schema_version": BOOK_STAGE_SCHEMA_VERSION,
    }
    assert legacy_like_invocation == {
        "stage": "translate",
        "input_protocol": "stage_spec",
        "stage_spec_schema_version": "",
    }
