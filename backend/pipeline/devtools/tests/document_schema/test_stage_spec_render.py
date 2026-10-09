from __future__ import annotations

import json
from pathlib import Path


from retainpdf_pipeline.foundation.shared.job_dirs import ensure_job_dirs
from retainpdf_pipeline.foundation.shared.job_dirs import resolve_job_dirs
from retainpdf_pipeline.foundation.shared.stage_specs import RenderStageSpec
from retainpdf_pipeline.foundation.shared.stage_specs import RENDER_STAGE_SCHEMA_VERSION
from retainpdf_pipeline.foundation.config import fonts

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
                    "model": "deepseek-flash",
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
                    "model": "deepseek-flash",
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




def _write_minimal_render_spec(tmp_path: Path, params_extra: dict) -> Path:
    job_root = tmp_path / "20261008-render-engine"
    ensure_job_dirs(resolve_job_dirs(job_root))
    source_pdf = tmp_path / "source.pdf"
    source_pdf.write_bytes(b"%PDF-1.4\n")
    translations_dir = job_root / "translated"
    translations_dir.mkdir(parents=True, exist_ok=True)
    spec_path = job_root / "specs" / "render.spec.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(
            {
                "schema_version": RENDER_STAGE_SCHEMA_VERSION,
                "stage": "render",
                "job": {"job_id": "20261008-render-engine", "job_root": str(job_root), "workflow": "render"},
                "inputs": {"source_pdf": str(source_pdf), "translations_dir": str(translations_dir)},
                "params": {"start_page": 0, "end_page": -1, "render_mode": "auto", **params_extra},
            }
        ),
        encoding="utf-8",
    )
    return spec_path


def test_render_stage_spec_engine_defaults_to_rpr_fit(tmp_path: Path) -> None:
    spec = RenderStageSpec.load(_write_minimal_render_spec(tmp_path, {}))
    assert spec.params.engine == "rpr_fit"


def test_render_stage_spec_reads_rpr_engine_and_tolerates_case(tmp_path: Path) -> None:
    spec = RenderStageSpec.load(_write_minimal_render_spec(tmp_path, {"engine": " RPR"}))
    assert spec.params.engine == "rpr"


def test_render_stage_spec_unknown_engine_falls_back_to_the_default(tmp_path: Path) -> None:
    spec = RenderStageSpec.load(_write_minimal_render_spec(tmp_path, {"engine": "latex"}))
    assert spec.params.engine == "rpr_fit"


def test_render_only_passes_engine_to_render_stage(tmp_path: Path) -> None:
    from retainpdf_pipeline.render.workflow.render_only import _args_from_spec

    spec = RenderStageSpec.load(_write_minimal_render_spec(tmp_path, {"engine": "rpr"}))
    assert _args_from_spec(spec).render_engine == "rpr"
