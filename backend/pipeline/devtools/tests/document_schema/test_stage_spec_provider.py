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

    default_payload = json.loads(spec_path.read_text(encoding="utf-8"))
    default_payload["ocr"].pop("paddle_model", None)
    default_spec_path = spec_path.with_name("provider-default-paddle.spec.json")
    default_spec_path.write_text(
        json.dumps(default_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    default_spec = ProviderStageSpec.load(default_spec_path)
    assert default_spec.ocr.paddle_model == "PaddleOCR-VL-1.6"


def test_provider_stage_spec_loads_ocr_options(tmp_path: Path) -> None:
    job_root = tmp_path / "20260616-provider-options"
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
                    "job_id": job_root.name,
                    "job_root": str(job_root),
                    "workflow": "book",
                },
                "source": {"file_url": "", "file_path": str(source_pdf)},
                "ocr": {
                    "provider": "local-fast",
                    "credential_ref": "",
                    "options": {
                        "command": "python /tmp/local-fast.py",
                        "raw_provider": "generic_flat_ocr",
                    },
                },
                "translation": {"credential_ref": "", "glossary_entries": []},
                "render": {},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    spec = ProviderStageSpec.load(spec_path)

    assert spec.ocr.provider == "local-fast"
    assert spec.ocr.options["command"] == "python /tmp/local-fast.py"
    assert spec.ocr.options["raw_provider"] == "generic_flat_ocr"
