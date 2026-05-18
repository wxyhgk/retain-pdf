from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from foundation.shared.job_dirs import ensure_job_dirs
from foundation.shared.job_dirs import resolve_job_dirs
from foundation.shared.stage_specs import NormalizeStageSpec
from foundation.shared.stage_specs import build_stage_invocation_metadata
from foundation.shared.stage_specs import BookStageSpec
from foundation.shared.stage_specs import BOOK_STAGE_SCHEMA_VERSION
from foundation.shared.stage_specs import NORMALIZE_STAGE_SCHEMA_VERSION
from foundation.shared.stage_specs import ProviderStageSpec
from foundation.shared.stage_specs import PROVIDER_STAGE_SCHEMA_VERSION
from foundation.shared.stage_specs import resolve_credential_ref
from foundation.shared.stage_specs import TranslateStageSpec
from foundation.shared.stage_specs import TRANSLATE_STAGE_SCHEMA_VERSION
from foundation.shared.stage_specs import RenderStageSpec
from foundation.shared.stage_specs import RENDER_STAGE_SCHEMA_VERSION
from foundation.config import fonts


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


def test_translate_stage_spec_loads_and_resolves_env_credential(tmp_path: Path, monkeypatch) -> None:
    job_root = tmp_path / "20260414-translatejob"
    ensure_job_dirs(resolve_job_dirs(job_root))
    source_json = tmp_path / "document.v1.json"
    source_pdf = tmp_path / "source.pdf"
    source_json.write_text("{}", encoding="utf-8")
    source_pdf.write_bytes(b"%PDF-1.4\n")
    spec_path = job_root / "specs" / "translate.spec.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": TRANSLATE_STAGE_SCHEMA_VERSION,
                "stage": "translate",
                "job": {
                    "job_id": "20260414-translatejob",
                    "job_root": str(job_root),
                    "workflow": "translate",
                },
                "inputs": {
                    "source_json": str(source_json),
                    "source_pdf": str(source_pdf),
                    "layout_json": "",
                },
                "params": {
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
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("RETAIN_TRANSLATION_API_KEY", "sk-stage-test")

    spec = TranslateStageSpec.load(spec_path)

    assert spec.stage == "translate"
    assert spec.params.model == "deepseek-v4-flash"
    assert resolve_credential_ref(spec.params.credential_ref) == "sk-stage-test"


def test_translate_stage_spec_defaults_math_mode_to_direct_typst(tmp_path: Path) -> None:
    job_root = tmp_path / "20260414-translatejob-default-math"
    ensure_job_dirs(resolve_job_dirs(job_root))
    source_json = tmp_path / "document.v1.json"
    source_pdf = tmp_path / "source.pdf"
    source_json.write_text("{}", encoding="utf-8")
    source_pdf.write_bytes(b"%PDF-1.4\n")
    spec_path = job_root / "specs" / "translate.spec.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": TRANSLATE_STAGE_SCHEMA_VERSION,
                "stage": "translate",
                "job": {
                    "job_id": "20260414-translatejob-default-math",
                    "job_root": str(job_root),
                    "workflow": "translate",
                },
                "inputs": {
                    "source_json": str(source_json),
                    "source_pdf": str(source_pdf),
                    "layout_json": "",
                },
                "params": {
                    "model": "deepseek-v4-flash",
                    "base_url": "https://api.deepseek.com/v1",
                    "credential_ref": "",
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    spec = TranslateStageSpec.load(spec_path)

    assert spec.params.math_mode == "direct_typst"


def test_render_stage_spec_loads_and_resolves_paths(tmp_path: Path) -> None:
    job_root = tmp_path / "20260414-renderjob"
    ensure_job_dirs(resolve_job_dirs(job_root))
    source_pdf = tmp_path / "source.pdf"
    translations_dir = job_root / "translated"
    translation_manifest = translations_dir / "translation-manifest.json"
    source_pdf.write_bytes(b"%PDF-1.4\n")
    translations_dir.mkdir(parents=True, exist_ok=True)
    translation_manifest.write_text("{}", encoding="utf-8")
    spec_path = job_root / "specs" / "render.spec.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": RENDER_STAGE_SCHEMA_VERSION,
                "stage": "render",
                "job": {
                    "job_id": "20260414-renderjob",
                    "job_root": str(job_root),
                    "workflow": "render",
                },
                "inputs": {
                    "source_pdf": str(source_pdf),
                    "translations_dir": str(translations_dir),
                    "translation_manifest": str(translation_manifest),
                },
                "params": {
                    "start_page": 0,
                    "end_page": -1,
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
                    "font_unify_mode": "off",
                    "model": "deepseek-v4-flash",
                    "base_url": "https://api.deepseek.com/v1",
                    "credential_ref": "",
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    spec = RenderStageSpec.load(spec_path)

    assert spec.stage == "render"
    assert spec.inputs.source_pdf == source_pdf.resolve()
    assert spec.inputs.translations_dir == translations_dir.resolve()
    assert spec.inputs.translation_manifest == translation_manifest.resolve()


def test_render_stage_spec_empty_font_family_uses_default_font(tmp_path: Path) -> None:
    job_root = tmp_path / "20260414-renderjob-default-font"
    ensure_job_dirs(resolve_job_dirs(job_root))
    source_pdf = tmp_path / "source.pdf"
    translations_dir = job_root / "translated"
    translation_manifest = translations_dir / "translation-manifest.json"
    source_pdf.write_bytes(b"%PDF-1.4\n")
    translations_dir.mkdir(parents=True, exist_ok=True)
    translation_manifest.write_text("{}", encoding="utf-8")
    spec_path = job_root / "specs" / "render.spec.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": RENDER_STAGE_SCHEMA_VERSION,
                "stage": "render",
                "job": {
                    "job_id": "20260414-renderjob-default-font",
                    "job_root": str(job_root),
                    "workflow": "render",
                },
                "inputs": {
                    "source_pdf": str(source_pdf),
                    "translations_dir": str(translations_dir),
                    "translation_manifest": str(translation_manifest),
                },
                "params": {
                    "start_page": 0,
                    "end_page": -1,
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
                    "model": "deepseek-v4-flash",
                    "base_url": "https://api.deepseek.com/v1",
                    "credential_ref": ""
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    spec = RenderStageSpec.load(spec_path)

    assert spec.params.typst_font_family == fonts.TYPST_DEFAULT_FONT_FAMILY


def test_provider_stage_spec_loads_and_resolves_credentials(tmp_path: Path, monkeypatch) -> None:
    job_root = tmp_path / "20260414-providerjob"
    source_dir = job_root / "source"
    ensure_job_dirs(resolve_job_dirs(job_root))
    source_pdf = source_dir / "book.pdf"
    source_dir.mkdir(parents=True, exist_ok=True)
    source_pdf.write_bytes(b"%PDF-1.4\n")
    spec_path = job_root / "specs" / "provider.spec.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": PROVIDER_STAGE_SCHEMA_VERSION,
                "stage": "provider",
                "job": {
                    "job_id": "20260414-providerjob",
                    "job_root": str(job_root),
                    "workflow": "book",
                },
                "source": {
                    "file_url": "",
                    "file_path": str(source_pdf),
                },
                "ocr": {
                    "credential_ref": "env:RETAIN_MINERU_API_TOKEN",
                    "model_version": "vlm",
                    "is_ocr": False,
                    "disable_formula": False,
                    "disable_table": False,
                    "language": "ch",
                    "page_ranges": "",
                    "data_id": "",
                    "no_cache": False,
                    "cache_tolerance": 900,
                    "extra_formats": "",
                    "poll_interval": 5,
                    "poll_timeout": 1800,
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
    monkeypatch.setenv("RETAIN_MINERU_API_TOKEN", "mineru-env-test")
    monkeypatch.setenv("RETAIN_TRANSLATION_API_KEY", "sk-stage-test")

    spec = ProviderStageSpec.load(spec_path)

    assert spec.stage == "provider"
    assert spec.source.file_path == source_pdf.resolve()
    assert resolve_credential_ref(spec.ocr.credential_ref) == "mineru-env-test"
    assert resolve_credential_ref(spec.translation.credential_ref) == "sk-stage-test"


def test_provider_stage_spec_loads_paddle_provider_fields(tmp_path: Path, monkeypatch) -> None:
    job_root = tmp_path / "20260418-provider-paddle"
    source_dir = job_root / "source"
    ensure_job_dirs(resolve_job_dirs(job_root))
    source_pdf = source_dir / "book.pdf"
    source_dir.mkdir(parents=True, exist_ok=True)
    source_pdf.write_bytes(b"%PDF-1.4\n")
    spec_path = job_root / "specs" / "provider.spec.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": PROVIDER_STAGE_SCHEMA_VERSION,
                "stage": "provider",
                "job": {
                    "job_id": "20260418-provider-paddle",
                    "job_root": str(job_root),
                    "workflow": "book",
                },
                "source": {
                    "file_url": "",
                    "file_path": str(source_pdf),
                },
                "ocr": {
                    "provider": "paddle",
                    "credential_ref": "env:RETAIN_PADDLE_API_TOKEN",
                    "model_version": "vlm",
                    "paddle_api_url": "https://paddleocr.aistudio-app.com",
                    "paddle_model": "PaddleOCR-VL-1.5",
                    "is_ocr": False,
                    "disable_formula": False,
                    "disable_table": False,
                    "language": "ch",
                    "page_ranges": "",
                    "data_id": "",
                    "no_cache": False,
                    "cache_tolerance": 900,
                    "extra_formats": "",
                    "poll_interval": 5,
                    "poll_timeout": 1800,
                },
                "translation": {
                    "model": "deepseek-v4-flash",
                    "base_url": "https://api.deepseek.com/v1",
                    "credential_ref": "env:RETAIN_TRANSLATION_API_KEY",
                    "glossary_entries": [],
                },
                "render": {
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
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("RETAIN_PADDLE_API_TOKEN", "paddle-env-test")
    monkeypatch.setenv("RETAIN_TRANSLATION_API_KEY", "sk-stage-test")

    spec = ProviderStageSpec.load(spec_path)

    assert spec.ocr.provider == "paddle"
    assert spec.ocr.paddle_api_url == "https://paddleocr.aistudio-app.com"
    assert spec.ocr.paddle_model == "PaddleOCR-VL-1.5"
    assert resolve_credential_ref(spec.ocr.credential_ref) == "paddle-env-test"
    assert resolve_credential_ref(spec.translation.credential_ref) == "sk-stage-test"


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
