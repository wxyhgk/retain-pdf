from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from foundation.config import fonts
from foundation.shared.job_dirs import JobDirs
from foundation.shared.job_dirs import resolve_job_dirs


NORMALIZE_STAGE_SCHEMA_VERSION = "normalize.stage.v1"
TRANSLATE_STAGE_SCHEMA_VERSION = "translate.stage.v1"
RENDER_STAGE_SCHEMA_VERSION = "render.stage.v1"
MINERU_STAGE_SCHEMA_VERSION = "mineru.stage.v1"
BOOK_STAGE_SCHEMA_VERSION = "book.stage.v1"


def build_stage_invocation_metadata(
    *,
    stage: str,
    stage_spec_schema_version: str = "",
) -> dict[str, Any]:
    return {
        "stage": stage,
        "input_protocol": "stage_spec",
        "stage_spec_schema_version": stage_spec_schema_version.strip(),
    }


def _load_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise RuntimeError(f"stage spec must be a JSON object: {path}")
    return data


def _require_object(parent: dict[str, Any], key: str) -> dict[str, Any]:
    value = parent.get(key)
    if not isinstance(value, dict):
        raise RuntimeError(f"stage spec field '{key}' must be an object")
    return value


def _require_text(parent: dict[str, Any], key: str) -> str:
    value = parent.get(key)
    if not isinstance(value, str) or not value.strip():
        raise RuntimeError(f"stage spec field '{key}' must be a non-empty string")
    return value.strip()


@dataclass(frozen=True)
class StageJobRef:
    job_id: str
    job_root: Path
    workflow: str


@dataclass(frozen=True)
class NormalizeStageInputs:
    provider: str
    source_json: Path
    source_pdf: Path
    provider_version: str
    provider_result_json: Path | None
    provider_zip: Path | None
    provider_raw_dir: Path | None


@dataclass(frozen=True)
class NormalizeStageSpec:
    schema_version: str
    stage: str
    job: StageJobRef
    inputs: NormalizeStageInputs

    @classmethod
    def load(cls, path: Path) -> "NormalizeStageSpec":
        spec_path = path.resolve()
        if not spec_path.exists():
            raise RuntimeError(f"stage spec not found: {spec_path}")
        payload = _load_json(spec_path)
        schema_version = _require_text(payload, "schema_version")
        if schema_version != NORMALIZE_STAGE_SCHEMA_VERSION:
            raise RuntimeError(
                f"unsupported normalize stage schema_version: {schema_version}"
            )
        stage = _require_text(payload, "stage")
        if stage != "normalize":
            raise RuntimeError(f"unexpected stage spec kind: {stage}")
        job_payload = _require_object(payload, "job")
        inputs_payload = _require_object(payload, "inputs")

        job = StageJobRef(
            job_id=_require_text(job_payload, "job_id"),
            job_root=Path(_require_text(job_payload, "job_root")).resolve(),
            workflow=_require_text(job_payload, "workflow"),
        )
        inputs = NormalizeStageInputs(
            provider=_require_text(inputs_payload, "provider").lower(),
            source_json=Path(_require_text(inputs_payload, "source_json")).resolve(),
            source_pdf=Path(_require_text(inputs_payload, "source_pdf")).resolve(),
            provider_version=str(inputs_payload.get("provider_version", "") or "").strip(),
            provider_result_json=_optional_path(inputs_payload.get("provider_result_json")),
            provider_zip=_optional_path(inputs_payload.get("provider_zip")),
            provider_raw_dir=_optional_path(inputs_payload.get("provider_raw_dir")),
        )
        if not inputs.source_json.exists():
            raise RuntimeError(f"source json not found: {inputs.source_json}")
        if not inputs.source_pdf.exists():
            raise RuntimeError(f"source pdf not found: {inputs.source_pdf}")
        return cls(
            schema_version=schema_version,
            stage=stage,
            job=job,
            inputs=inputs,
        )

    @property
    def job_dirs(self) -> JobDirs:
        return resolve_job_dirs(self.job.job_root)


def _optional_path(value: Any) -> Path | None:
    if not isinstance(value, str) or not value.strip():
        return None
    return Path(value.strip()).resolve()


def resolve_credential_ref(credential_ref: str) -> str:
    ref = (credential_ref or "").strip()
    if not ref:
        return ""
    if ref.startswith("env:"):
        import os

        env_name = ref[4:].strip()
        if not env_name:
            raise RuntimeError("invalid credential_ref: missing env var name")
        return os.environ.get(env_name, "").strip()
    raise RuntimeError(f"unsupported credential_ref: {credential_ref}")


@dataclass(frozen=True)
class TranslateStageInputs:
    source_json: Path
    source_pdf: Path
    layout_json: Path | None


@dataclass(frozen=True)
class TranslateStageParams:
    start_page: int
    end_page: int
    batch_size: int
    workers: int
    mode: str
    math_mode: str
    skip_title_translation: bool
    classify_batch_size: int
    rule_profile_name: str
    custom_rules_text: str
    glossary_id: str
    glossary_name: str
    glossary_resource_entry_count: int
    glossary_inline_entry_count: int
    glossary_overridden_entry_count: int
    glossary_entries: list[dict[str, Any]]
    model: str
    base_url: str
    credential_ref: str


@dataclass(frozen=True)
class TranslateStageSpec:
    schema_version: str
    stage: str
    job: StageJobRef
    inputs: TranslateStageInputs
    params: TranslateStageParams

    @classmethod
    def load(cls, path: Path) -> "TranslateStageSpec":
        spec_path = path.resolve()
        if not spec_path.exists():
            raise RuntimeError(f"stage spec not found: {spec_path}")
        payload = _load_json(spec_path)
        schema_version = _require_text(payload, "schema_version")
        if schema_version != TRANSLATE_STAGE_SCHEMA_VERSION:
            raise RuntimeError(
                f"unsupported translate stage schema_version: {schema_version}"
            )
        stage = _require_text(payload, "stage")
        if stage != "translate":
            raise RuntimeError(f"unexpected stage spec kind: {stage}")
        job_payload = _require_object(payload, "job")
        inputs_payload = _require_object(payload, "inputs")
        params_payload = _require_object(payload, "params")
        job = StageJobRef(
            job_id=_require_text(job_payload, "job_id"),
            job_root=Path(_require_text(job_payload, "job_root")).resolve(),
            workflow=_require_text(job_payload, "workflow"),
        )
        inputs = TranslateStageInputs(
            source_json=Path(_require_text(inputs_payload, "source_json")).resolve(),
            source_pdf=Path(_require_text(inputs_payload, "source_pdf")).resolve(),
            layout_json=_optional_path(inputs_payload.get("layout_json")),
        )
        if not inputs.source_json.exists():
            raise RuntimeError(f"source json not found: {inputs.source_json}")
        if not inputs.source_pdf.exists():
            raise RuntimeError(f"source pdf not found: {inputs.source_pdf}")
        glossary_entries = params_payload.get("glossary_entries") or []
        if not isinstance(glossary_entries, list):
            raise RuntimeError("stage spec field 'params.glossary_entries' must be a list")
        params = TranslateStageParams(
            start_page=int(params_payload.get("start_page", 0) or 0),
            end_page=int(params_payload.get("end_page", -1) or -1),
            batch_size=int(params_payload.get("batch_size", 1) or 1),
            workers=int(params_payload.get("workers", 1) or 1),
            mode=str(params_payload.get("mode", "sci") or "sci"),
            math_mode=str(params_payload.get("math_mode", "placeholder") or "placeholder"),
            skip_title_translation=bool(params_payload.get("skip_title_translation", False)),
            classify_batch_size=int(params_payload.get("classify_batch_size", 12) or 12),
            rule_profile_name=str(params_payload.get("rule_profile_name", "general_sci") or "general_sci"),
            custom_rules_text=str(params_payload.get("custom_rules_text", "") or ""),
            glossary_id=str(params_payload.get("glossary_id", "") or ""),
            glossary_name=str(params_payload.get("glossary_name", "") or ""),
            glossary_resource_entry_count=int(params_payload.get("glossary_resource_entry_count", 0) or 0),
            glossary_inline_entry_count=int(params_payload.get("glossary_inline_entry_count", 0) or 0),
            glossary_overridden_entry_count=int(params_payload.get("glossary_overridden_entry_count", 0) or 0),
            glossary_entries=glossary_entries,
            model=str(params_payload.get("model", "") or ""),
            base_url=str(params_payload.get("base_url", "") or ""),
            credential_ref=str(params_payload.get("credential_ref", "") or ""),
        )
        return cls(
            schema_version=schema_version,
            stage=stage,
            job=job,
            inputs=inputs,
            params=params,
        )

    @property
    def job_dirs(self) -> JobDirs:
        return resolve_job_dirs(self.job.job_root)


@dataclass(frozen=True)
class RenderStageInputs:
    source_pdf: Path
    translations_dir: Path
    translation_manifest: Path | None


@dataclass(frozen=True)
class RenderStageParams:
    start_page: int
    end_page: int
    render_mode: str
    compile_workers: int
    typst_font_family: str
    pdf_compress_dpi: int
    translated_pdf_name: str
    body_font_size_factor: float
    body_leading_factor: float
    inner_bbox_shrink_x: float
    inner_bbox_shrink_y: float
    inner_bbox_dense_shrink_x: float
    inner_bbox_dense_shrink_y: float
    model: str
    base_url: str
    credential_ref: str


@dataclass(frozen=True)
class RenderStageSpec:
    schema_version: str
    stage: str
    job: StageJobRef
    inputs: RenderStageInputs
    params: RenderStageParams

    @classmethod
    def load(cls, path: Path) -> "RenderStageSpec":
        spec_path = path.resolve()
        if not spec_path.exists():
            raise RuntimeError(f"stage spec not found: {spec_path}")
        payload = _load_json(spec_path)
        schema_version = _require_text(payload, "schema_version")
        if schema_version != RENDER_STAGE_SCHEMA_VERSION:
            raise RuntimeError(
                f"unsupported render stage schema_version: {schema_version}"
            )
        stage = _require_text(payload, "stage")
        if stage != "render":
            raise RuntimeError(f"unexpected stage spec kind: {stage}")
        job_payload = _require_object(payload, "job")
        inputs_payload = _require_object(payload, "inputs")
        params_payload = _require_object(payload, "params")
        job = StageJobRef(
            job_id=_require_text(job_payload, "job_id"),
            job_root=Path(_require_text(job_payload, "job_root")).resolve(),
            workflow=_require_text(job_payload, "workflow"),
        )
        inputs = RenderStageInputs(
            source_pdf=Path(_require_text(inputs_payload, "source_pdf")).resolve(),
            translations_dir=Path(_require_text(inputs_payload, "translations_dir")).resolve(),
            translation_manifest=_optional_path(inputs_payload.get("translation_manifest")),
        )
        if not inputs.source_pdf.exists():
            raise RuntimeError(f"source pdf not found: {inputs.source_pdf}")
        if not inputs.translations_dir.exists():
            raise RuntimeError(f"translations dir not found: {inputs.translations_dir}")
        params = RenderStageParams(
            start_page=int(params_payload.get("start_page", 0) or 0),
            end_page=int(params_payload.get("end_page", -1) or -1),
            render_mode=str(params_payload.get("render_mode", "typst") or "typst"),
            compile_workers=int(params_payload.get("compile_workers", 0) or 0),
            typst_font_family=str(params_payload.get("typst_font_family", "") or "").strip()
            or fonts.TYPST_DEFAULT_FONT_FAMILY,
            pdf_compress_dpi=int(params_payload.get("pdf_compress_dpi", 0) or 0),
            translated_pdf_name=str(params_payload.get("translated_pdf_name", "") or ""),
            body_font_size_factor=float(params_payload.get("body_font_size_factor", 1.0) or 1.0),
            body_leading_factor=float(params_payload.get("body_leading_factor", 1.0) or 1.0),
            inner_bbox_shrink_x=float(params_payload.get("inner_bbox_shrink_x", 0.0) or 0.0),
            inner_bbox_shrink_y=float(params_payload.get("inner_bbox_shrink_y", 0.0) or 0.0),
            inner_bbox_dense_shrink_x=float(params_payload.get("inner_bbox_dense_shrink_x", 0.0) or 0.0),
            inner_bbox_dense_shrink_y=float(params_payload.get("inner_bbox_dense_shrink_y", 0.0) or 0.0),
            model=str(params_payload.get("model", "") or ""),
            base_url=str(params_payload.get("base_url", "") or ""),
            credential_ref=str(params_payload.get("credential_ref", "") or ""),
        )
        return cls(
            schema_version=schema_version,
            stage=stage,
            job=job,
            inputs=inputs,
            params=params,
        )

    @property
    def job_dirs(self) -> JobDirs:
        return resolve_job_dirs(self.job.job_root)


@dataclass(frozen=True)
class MineruStageSource:
    file_url: str
    file_path: Path | None


@dataclass(frozen=True)
class MineruStageOcrParams:
    credential_ref: str
    model_version: str
    is_ocr: bool
    disable_formula: bool
    disable_table: bool
    language: str
    page_ranges: str
    data_id: str
    no_cache: bool
    cache_tolerance: int
    extra_formats: str
    poll_interval: int
    poll_timeout: int


@dataclass(frozen=True)
class MineruStageTranslationParams:
    start_page: int
    end_page: int
    batch_size: int
    workers: int
    mode: str
    math_mode: str
    skip_title_translation: bool
    classify_batch_size: int
    rule_profile_name: str
    custom_rules_text: str
    glossary_id: str
    glossary_name: str
    glossary_resource_entry_count: int
    glossary_inline_entry_count: int
    glossary_overridden_entry_count: int
    glossary_entries: list[dict[str, Any]]
    model: str
    base_url: str
    credential_ref: str


@dataclass(frozen=True)
class MineruStageRenderParams:
    render_mode: str
    compile_workers: int
    typst_font_family: str
    pdf_compress_dpi: int
    translated_pdf_name: str
    body_font_size_factor: float
    body_leading_factor: float
    inner_bbox_shrink_x: float
    inner_bbox_shrink_y: float
    inner_bbox_dense_shrink_x: float
    inner_bbox_dense_shrink_y: float


@dataclass(frozen=True)
class MineruStageSpec:
    schema_version: str
    stage: str
    job: StageJobRef
    source: MineruStageSource
    ocr: MineruStageOcrParams
    translation: MineruStageTranslationParams
    render: MineruStageRenderParams

    @classmethod
    def load(cls, path: Path) -> "MineruStageSpec":
        spec_path = path.resolve()
        if not spec_path.exists():
            raise RuntimeError(f"stage spec not found: {spec_path}")
        payload = _load_json(spec_path)
        schema_version = _require_text(payload, "schema_version")
        if schema_version != MINERU_STAGE_SCHEMA_VERSION:
            raise RuntimeError(f"unsupported mineru stage schema_version: {schema_version}")
        stage = _require_text(payload, "stage")
        if stage != "mineru":
            raise RuntimeError(f"unexpected stage spec kind: {stage}")
        job_payload = _require_object(payload, "job")
        source_payload = _require_object(payload, "source")
        ocr_payload = _require_object(payload, "ocr")
        translation_payload = _require_object(payload, "translation")
        render_payload = _require_object(payload, "render")
        job = StageJobRef(
            job_id=_require_text(job_payload, "job_id"),
            job_root=Path(_require_text(job_payload, "job_root")).resolve(),
            workflow=_require_text(job_payload, "workflow"),
        )
        file_url = str(source_payload.get("file_url", "") or "").strip()
        file_path = _optional_path(source_payload.get("file_path"))
        if not file_url and file_path is None:
            raise RuntimeError("mineru stage spec requires source.file_url or source.file_path")
        source = MineruStageSource(file_url=file_url, file_path=file_path)
        ocr = MineruStageOcrParams(
            credential_ref=str(ocr_payload.get("credential_ref", "") or ""),
            model_version=str(ocr_payload.get("model_version", "vlm") or "vlm"),
            is_ocr=bool(ocr_payload.get("is_ocr", False)),
            disable_formula=bool(ocr_payload.get("disable_formula", False)),
            disable_table=bool(ocr_payload.get("disable_table", False)),
            language=str(ocr_payload.get("language", "ch") or "ch"),
            page_ranges=str(ocr_payload.get("page_ranges", "") or ""),
            data_id=str(ocr_payload.get("data_id", "") or ""),
            no_cache=bool(ocr_payload.get("no_cache", False)),
            cache_tolerance=int(ocr_payload.get("cache_tolerance", 900) or 900),
            extra_formats=str(ocr_payload.get("extra_formats", "") or ""),
            poll_interval=int(ocr_payload.get("poll_interval", 5) or 5),
            poll_timeout=int(ocr_payload.get("poll_timeout", 1800) or 1800),
        )
        glossary_entries = translation_payload.get("glossary_entries") or []
        if not isinstance(glossary_entries, list):
            raise RuntimeError("stage spec field 'translation.glossary_entries' must be a list")
        translation = MineruStageTranslationParams(
            start_page=int(translation_payload.get("start_page", 0) or 0),
            end_page=int(translation_payload.get("end_page", -1) or -1),
            batch_size=int(translation_payload.get("batch_size", 1) or 1),
            workers=int(translation_payload.get("workers", 1) or 1),
            mode=str(translation_payload.get("mode", "sci") or "sci"),
            math_mode=str(translation_payload.get("math_mode", "placeholder") or "placeholder"),
            skip_title_translation=bool(translation_payload.get("skip_title_translation", False)),
            classify_batch_size=int(translation_payload.get("classify_batch_size", 12) or 12),
            rule_profile_name=str(translation_payload.get("rule_profile_name", "general_sci") or "general_sci"),
            custom_rules_text=str(translation_payload.get("custom_rules_text", "") or ""),
            glossary_id=str(translation_payload.get("glossary_id", "") or ""),
            glossary_name=str(translation_payload.get("glossary_name", "") or ""),
            glossary_resource_entry_count=int(translation_payload.get("glossary_resource_entry_count", 0) or 0),
            glossary_inline_entry_count=int(translation_payload.get("glossary_inline_entry_count", 0) or 0),
            glossary_overridden_entry_count=int(translation_payload.get("glossary_overridden_entry_count", 0) or 0),
            glossary_entries=glossary_entries,
            model=str(translation_payload.get("model", "") or ""),
            base_url=str(translation_payload.get("base_url", "") or ""),
            credential_ref=str(translation_payload.get("credential_ref", "") or ""),
        )
        render = MineruStageRenderParams(
            render_mode=str(render_payload.get("render_mode", "typst") or "typst"),
            compile_workers=int(render_payload.get("compile_workers", 0) or 0),
            typst_font_family=str(render_payload.get("typst_font_family", "") or "").strip()
            or fonts.TYPST_DEFAULT_FONT_FAMILY,
            pdf_compress_dpi=int(render_payload.get("pdf_compress_dpi", 0) or 0),
            translated_pdf_name=str(render_payload.get("translated_pdf_name", "") or ""),
            body_font_size_factor=float(render_payload.get("body_font_size_factor", 1.0) or 1.0),
            body_leading_factor=float(render_payload.get("body_leading_factor", 1.0) or 1.0),
            inner_bbox_shrink_x=float(render_payload.get("inner_bbox_shrink_x", 0.0) or 0.0),
            inner_bbox_shrink_y=float(render_payload.get("inner_bbox_shrink_y", 0.0) or 0.0),
            inner_bbox_dense_shrink_x=float(render_payload.get("inner_bbox_dense_shrink_x", 0.0) or 0.0),
            inner_bbox_dense_shrink_y=float(render_payload.get("inner_bbox_dense_shrink_y", 0.0) or 0.0),
        )
        return cls(
            schema_version=schema_version,
            stage=stage,
            job=job,
            source=source,
            ocr=ocr,
            translation=translation,
            render=render,
        )

    @property
    def job_dirs(self) -> JobDirs:
        return resolve_job_dirs(self.job.job_root)


@dataclass(frozen=True)
class BookStageInputs:
    source_json: Path
    source_pdf: Path
    layout_json: Path | None


@dataclass(frozen=True)
class BookStageTranslationParams:
    start_page: int
    end_page: int
    batch_size: int
    workers: int
    mode: str
    math_mode: str
    skip_title_translation: bool
    classify_batch_size: int
    rule_profile_name: str
    custom_rules_text: str
    glossary_id: str
    glossary_name: str
    glossary_resource_entry_count: int
    glossary_inline_entry_count: int
    glossary_overridden_entry_count: int
    glossary_entries: list[dict[str, Any]]
    model: str
    base_url: str
    credential_ref: str


@dataclass(frozen=True)
class BookStageRenderParams:
    render_mode: str
    compile_workers: int
    typst_font_family: str
    pdf_compress_dpi: int
    translated_pdf_name: str
    body_font_size_factor: float
    body_leading_factor: float
    inner_bbox_shrink_x: float
    inner_bbox_shrink_y: float
    inner_bbox_dense_shrink_x: float
    inner_bbox_dense_shrink_y: float


@dataclass(frozen=True)
class BookStageSpec:
    schema_version: str
    stage: str
    job: StageJobRef
    inputs: BookStageInputs
    translation: BookStageTranslationParams
    render: BookStageRenderParams

    @classmethod
    def load(cls, path: Path) -> "BookStageSpec":
        spec_path = path.resolve()
        if not spec_path.exists():
            raise RuntimeError(f"stage spec not found: {spec_path}")
        payload = _load_json(spec_path)
        schema_version = _require_text(payload, "schema_version")
        if schema_version != BOOK_STAGE_SCHEMA_VERSION:
            raise RuntimeError(f"unsupported book stage schema_version: {schema_version}")
        stage = _require_text(payload, "stage")
        if stage != "book":
            raise RuntimeError(f"unexpected stage spec kind: {stage}")
        job_payload = _require_object(payload, "job")
        inputs_payload = _require_object(payload, "inputs")
        translation_payload = _require_object(payload, "translation")
        render_payload = _require_object(payload, "render")
        job = StageJobRef(
            job_id=_require_text(job_payload, "job_id"),
            job_root=Path(_require_text(job_payload, "job_root")).resolve(),
            workflow=_require_text(job_payload, "workflow"),
        )
        inputs = BookStageInputs(
            source_json=Path(_require_text(inputs_payload, "source_json")).resolve(),
            source_pdf=Path(_require_text(inputs_payload, "source_pdf")).resolve(),
            layout_json=_optional_path(inputs_payload.get("layout_json")),
        )
        if not inputs.source_json.exists():
            raise RuntimeError(f"source json not found: {inputs.source_json}")
        if not inputs.source_pdf.exists():
            raise RuntimeError(f"source pdf not found: {inputs.source_pdf}")
        glossary_entries = translation_payload.get("glossary_entries") or []
        if not isinstance(glossary_entries, list):
            raise RuntimeError("stage spec field 'translation.glossary_entries' must be a list")
        translation = BookStageTranslationParams(
            start_page=int(translation_payload.get("start_page", 0) or 0),
            end_page=int(translation_payload.get("end_page", -1) or -1),
            batch_size=int(translation_payload.get("batch_size", 1) or 1),
            workers=int(translation_payload.get("workers", 1) or 1),
            mode=str(translation_payload.get("mode", "sci") or "sci"),
            math_mode=str(translation_payload.get("math_mode", "placeholder") or "placeholder"),
            skip_title_translation=bool(translation_payload.get("skip_title_translation", False)),
            classify_batch_size=int(translation_payload.get("classify_batch_size", 12) or 12),
            rule_profile_name=str(translation_payload.get("rule_profile_name", "general_sci") or "general_sci"),
            custom_rules_text=str(translation_payload.get("custom_rules_text", "") or ""),
            glossary_id=str(translation_payload.get("glossary_id", "") or ""),
            glossary_name=str(translation_payload.get("glossary_name", "") or ""),
            glossary_resource_entry_count=int(translation_payload.get("glossary_resource_entry_count", 0) or 0),
            glossary_inline_entry_count=int(translation_payload.get("glossary_inline_entry_count", 0) or 0),
            glossary_overridden_entry_count=int(translation_payload.get("glossary_overridden_entry_count", 0) or 0),
            glossary_entries=glossary_entries,
            model=str(translation_payload.get("model", "") or ""),
            base_url=str(translation_payload.get("base_url", "") or ""),
            credential_ref=str(translation_payload.get("credential_ref", "") or ""),
        )
        render = BookStageRenderParams(
            render_mode=str(render_payload.get("render_mode", "typst") or "typst"),
            compile_workers=int(render_payload.get("compile_workers", 0) or 0),
            typst_font_family=str(render_payload.get("typst_font_family", "") or "").strip()
            or fonts.TYPST_DEFAULT_FONT_FAMILY,
            pdf_compress_dpi=int(render_payload.get("pdf_compress_dpi", 0) or 0),
            translated_pdf_name=str(render_payload.get("translated_pdf_name", "") or ""),
            body_font_size_factor=float(render_payload.get("body_font_size_factor", 1.0) or 1.0),
            body_leading_factor=float(render_payload.get("body_leading_factor", 1.0) or 1.0),
            inner_bbox_shrink_x=float(render_payload.get("inner_bbox_shrink_x", 0.0) or 0.0),
            inner_bbox_shrink_y=float(render_payload.get("inner_bbox_shrink_y", 0.0) or 0.0),
            inner_bbox_dense_shrink_x=float(render_payload.get("inner_bbox_dense_shrink_x", 0.0) or 0.0),
            inner_bbox_dense_shrink_y=float(render_payload.get("inner_bbox_dense_shrink_y", 0.0) or 0.0),
        )
        return cls(
            schema_version=schema_version,
            stage=stage,
            job=job,
            inputs=inputs,
            translation=translation,
            render=render,
        )

    @property
    def job_dirs(self) -> JobDirs:
        return resolve_job_dirs(self.job.job_root)
