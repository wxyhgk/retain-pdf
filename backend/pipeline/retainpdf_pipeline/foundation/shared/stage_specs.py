from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.foundation.shared.job_dirs import JobDirs, resolve_job_dirs
from retainpdf_pipeline.ocr.ocr_provider_config import (
    paddle_default_model,
)

NORMALIZE_STAGE_SCHEMA_VERSION = "normalize.stage.v1"
TRANSLATE_STAGE_SCHEMA_VERSION = "translate.stage.v1"
RENDER_STAGE_SCHEMA_VERSION = "render.stage.v1"
# render.engine：typst = 现有路线；rpr = 自研排版引擎（retain-pdf-rendering）。缺省 / 未知值一律 typst。
RENDER_ENGINE_TYPST = "typst"
RENDER_ENGINE_RPR = "rpr"
# rpr_fit：字号也由 rpr 引擎按测量决定（fit-model 的 retain 规则），不走 retain-pdf 的缩字规则。
RENDER_ENGINE_RPR_FIT = "rpr_fit"
RENDER_ENGINES = (RENDER_ENGINE_TYPST, RENDER_ENGINE_RPR, RENDER_ENGINE_RPR_FIT)
PROVIDER_STAGE_SCHEMA_VERSION = "provider.stage.v1"
BOOK_STAGE_SCHEMA_VERSION = "book.stage.v1"

# Rust 侧 `retain-core/src/models/defaults.rs::default_batch_size` 的兜底值。
#
# 兜底值只在 key 缺失时生效，所以两边不一致今天不咬人——spec 里这个 key 从来没
# 缺过。但兜底值存在的意义就是 key 缺失时用：Rust 缺失时用 8，Python 缺失时用 1，
# 而 1 会禁用批翻译队列（每个文本块单独发一次请求）。同一份 spec 少一个 key，
# 两边就跑出两种翻译行为，且不会有任何报错。
#
# devtools/tests/test_stage_spec_contract.py 直接读 defaults.rs 断言这两个数字
# 相同；改这里而不改那边（或反过来）会让那条用例转红。
#
# 三个 loader 都用 `_int_field` 取这个值，而不是原先的 `get(..., 1) or 1`：
# 只有「key 缺失 / None / 空串」才走兜底，显式写进 spec 的 0 仍然原样传下去，
# 由 `translate/workflow` 里那几处 `max(1, batch_size)` 收口——和改之前完全一样。
# 这次只动兜底值，不顺手改显式值的语义。
DEFAULT_TRANSLATION_BATCH_SIZE = 8


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


def normalize_render_engine(value: Any) -> str:
    engine = str(value or "").strip().lower()
    return engine if engine in RENDER_ENGINES else RENDER_ENGINE_TYPST


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


def _int_field(parent: dict[str, Any], key: str, default: int) -> int:
    value = parent.get(key, default)
    if value is None or value == "":
        value = default
    return int(value)


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
    def load(cls, path: Path) -> NormalizeStageSpec:
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
            provider_version=str(
                inputs_payload.get("provider_version", "") or ""
            ).strip(),
            provider_result_json=_optional_path(
                inputs_payload.get("provider_result_json")
            ),
            provider_zip=_optional_path(inputs_payload.get("provider_zip")),
            provider_raw_dir=_optional_path(inputs_payload.get("provider_raw_dir")),
        )
        source_can_be_discovered = (
            inputs.provider == "mineru"
            and inputs.provider_raw_dir is not None
            and inputs.provider_raw_dir.is_dir()
        )
        if not inputs.source_json.exists() and not source_can_be_discovered:
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


def _preparation_and_reviewer_fields(payload: dict[str, Any]) -> dict[str, str]:
    """三种 spec（translate / provider / book）共用的译前准备与 reviewer 字段。

    preparation 在这里只做 strip/lower，取值归一化（未知值 -> off）由
    translate 层的 normalize_preparation_mode 负责，与 context_mode 等字段一致。
    """
    return {
        "preparation": str(payload.get("preparation", "off") or "off").strip().lower(),
        "reviewer_model": str(payload.get("reviewer_model", "") or "").strip(),
        "reviewer_base_url": str(payload.get("reviewer_base_url", "") or "").strip(),
        "reviewer_credential_ref": str(payload.get("reviewer_credential_ref", "") or ""),
    }


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
    context_mode: str
    glossary_mode: str
    memory_mode: str
    model: str
    base_url: str
    credential_ref: str
    # 译前准备档位与审校模型配置位。旧 spec 没有这些 key，一律按默认值（off / 空串）读。
    preparation: str
    reviewer_model: str
    reviewer_base_url: str
    reviewer_credential_ref: str


@dataclass(frozen=True)
class TranslateStageSpec:
    schema_version: str
    stage: str
    job: StageJobRef
    inputs: TranslateStageInputs
    params: TranslateStageParams

    @classmethod
    def load(cls, path: Path) -> TranslateStageSpec:
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
            raise RuntimeError(
                "stage spec field 'params.glossary_entries' must be a list"
            )
        params = TranslateStageParams(
            start_page=_int_field(params_payload, "start_page", 0),
            end_page=_int_field(params_payload, "end_page", -1),
            batch_size=_int_field(
                params_payload, "batch_size", DEFAULT_TRANSLATION_BATCH_SIZE
            ),
            workers=int(params_payload.get("workers", 1) or 1),
            mode=str(params_payload.get("mode", "sci") or "sci"),
            math_mode=str(
                params_payload.get("math_mode", "direct_typst") or "direct_typst"
            ),
            skip_title_translation=bool(
                params_payload.get("skip_title_translation", False)
            ),
            classify_batch_size=int(
                params_payload.get("classify_batch_size", 12) or 12
            ),
            rule_profile_name=str(
                params_payload.get("rule_profile_name", "general_sci") or "general_sci"
            ),
            custom_rules_text=str(params_payload.get("custom_rules_text", "") or ""),
            glossary_id=str(params_payload.get("glossary_id", "") or ""),
            glossary_name=str(params_payload.get("glossary_name", "") or ""),
            glossary_resource_entry_count=int(
                params_payload.get("glossary_resource_entry_count", 0) or 0
            ),
            glossary_inline_entry_count=int(
                params_payload.get("glossary_inline_entry_count", 0) or 0
            ),
            glossary_overridden_entry_count=int(
                params_payload.get("glossary_overridden_entry_count", 0) or 0
            ),
            glossary_entries=glossary_entries,
            context_mode=str(params_payload.get("context_mode", "needed") or "needed")
            .strip()
            .lower(),
            glossary_mode=str(
                params_payload.get("glossary_mode", "matched") or "matched"
            )
            .strip()
            .lower(),
            memory_mode=str(params_payload.get("memory_mode", "matched") or "matched")
            .strip()
            .lower(),
            model=str(params_payload.get("model", "") or ""),
            base_url=str(params_payload.get("base_url", "") or ""),
            credential_ref=str(params_payload.get("credential_ref", "") or ""),
            **_preparation_and_reviewer_fields(params_payload),
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


RENDER_REFINE_MODES = ("off", "review_only", "review_and_fix")
RENDER_REFINE_TRIGGERS = ("auto", "manual")
RENDER_REFINE_DEFAULT_MAX_ITEMS = 300
RENDER_REFINE_DEFAULT_MAX_TOKENS = 400000


def _refine_optional_page(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _refine_limit(value: Any, default: int) -> int:
    if value is None or value == "" or isinstance(value, bool):
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return number if number >= 0 else default


@dataclass(frozen=True)
class RenderStageRefineParams:
    """渲染前精修（params.refine）。旧 spec 没有这个对象，按 mode=off 读，行为不变。

    mode 非法值归一成 off；trigger 非法值按 auto；页码 1-based 闭区间，null/≤0 = 不限；
    max_items / max_tokens 为 ≥0 的整数（0 = 不限），缺失或非法用默认值。
    """

    mode: str = "off"
    trigger: str = "auto"
    start_page: int | None = None
    end_page: int | None = None
    max_items: int = RENDER_REFINE_DEFAULT_MAX_ITEMS
    max_tokens: int = RENDER_REFINE_DEFAULT_MAX_TOKENS
    reviewer_model: str = ""
    reviewer_base_url: str = ""
    reviewer_credential_ref: str = ""

    @property
    def enabled(self) -> bool:
        return self.mode != "off"

    @classmethod
    def from_payload(cls, payload: Any) -> "RenderStageRefineParams":
        if not isinstance(payload, dict):
            return cls()
        mode = str(payload.get("mode", "off") or "off").strip().lower()
        trigger = str(payload.get("trigger", "auto") or "auto").strip().lower()
        return cls(
            mode=mode if mode in RENDER_REFINE_MODES else "off",
            trigger=trigger if trigger in RENDER_REFINE_TRIGGERS else "auto",
            start_page=_refine_optional_page(payload.get("start_page")),
            end_page=_refine_optional_page(payload.get("end_page")),
            max_items=_refine_limit(payload.get("max_items"), RENDER_REFINE_DEFAULT_MAX_ITEMS),
            max_tokens=_refine_limit(payload.get("max_tokens"), RENDER_REFINE_DEFAULT_MAX_TOKENS),
            reviewer_model=str(payload.get("reviewer_model", "") or "").strip(),
            reviewer_base_url=str(payload.get("reviewer_base_url", "") or "").strip(),
            reviewer_credential_ref=str(payload.get("reviewer_credential_ref", "") or "").strip(),
        )

    def as_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "trigger": self.trigger,
            "start_page": self.start_page,
            "end_page": self.end_page,
            "max_items": self.max_items,
            "max_tokens": self.max_tokens,
            "reviewer_model": self.reviewer_model,
            "reviewer_base_url": self.reviewer_base_url,
            "reviewer_credential_ref": self.reviewer_credential_ref,
        }


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
    font_unify_mode: str
    source_cleanup_strategy: str
    model: str
    base_url: str
    credential_ref: str
    refine: RenderStageRefineParams = field(default_factory=RenderStageRefineParams)
    engine: str = RENDER_ENGINE_TYPST


@dataclass(frozen=True)
class RenderStageSpec:
    schema_version: str
    stage: str
    job: StageJobRef
    inputs: RenderStageInputs
    params: RenderStageParams

    @classmethod
    def load(cls, path: Path) -> RenderStageSpec:
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
            translations_dir=Path(
                _require_text(inputs_payload, "translations_dir")
            ).resolve(),
            translation_manifest=_optional_path(
                inputs_payload.get("translation_manifest")
            ),
        )
        if not inputs.source_pdf.exists():
            raise RuntimeError(f"source pdf not found: {inputs.source_pdf}")
        if not inputs.translations_dir.exists():
            raise RuntimeError(f"translations dir not found: {inputs.translations_dir}")
        params = RenderStageParams(
            start_page=_int_field(params_payload, "start_page", 0),
            end_page=_int_field(params_payload, "end_page", -1),
            render_mode=str(params_payload.get("render_mode", "typst") or "typst"),
            compile_workers=int(params_payload.get("compile_workers", 0) or 0),
            typst_font_family=str(
                params_payload.get("typst_font_family", "") or ""
            ).strip()
            or fonts.TYPST_DEFAULT_FONT_FAMILY,
            pdf_compress_dpi=int(params_payload.get("pdf_compress_dpi", 0) or 0),
            translated_pdf_name=str(
                params_payload.get("translated_pdf_name", "") or ""
            ),
            body_font_size_factor=float(
                params_payload.get("body_font_size_factor", 1.0) or 1.0
            ),
            body_leading_factor=float(
                params_payload.get("body_leading_factor", 1.0) or 1.0
            ),
            inner_bbox_shrink_x=float(
                params_payload.get("inner_bbox_shrink_x", 0.0) or 0.0
            ),
            inner_bbox_shrink_y=float(
                params_payload.get("inner_bbox_shrink_y", 0.0) or 0.0
            ),
            inner_bbox_dense_shrink_x=float(
                params_payload.get("inner_bbox_dense_shrink_x", 0.0) or 0.0
            ),
            inner_bbox_dense_shrink_y=float(
                params_payload.get("inner_bbox_dense_shrink_y", 0.0) or 0.0
            ),
            font_unify_mode=str(
                params_payload.get("font_unify_mode", "role_min") or "role_min"
            )
            .strip()
            .lower(),
            source_cleanup_strategy=str(
                params_payload.get("source_cleanup_strategy", "pikepdf_text_strip")
                or "pikepdf_text_strip"
            )
            .strip()
            .lower(),
            model=str(params_payload.get("model", "") or ""),
            base_url=str(params_payload.get("base_url", "") or ""),
            credential_ref=str(params_payload.get("credential_ref", "") or ""),
            refine=RenderStageRefineParams.from_payload(params_payload.get("refine")),
            engine=normalize_render_engine(params_payload.get("engine")),
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
class ProviderStageSource:
    file_url: str
    file_path: Path | None


@dataclass(frozen=True)
class ProviderStageOcrParams:
    provider: str
    credential_ref: str
    model_version: str
    paddle_api_url: str
    paddle_model: str
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
    options: dict[str, Any]


@dataclass(frozen=True)
class ProviderStageTranslationParams:
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
    context_mode: str
    glossary_mode: str
    memory_mode: str
    model: str
    base_url: str
    credential_ref: str
    # 译前准备档位与审校模型配置位。旧 spec 没有这些 key，一律按默认值（off / 空串）读。
    preparation: str
    reviewer_model: str
    reviewer_base_url: str
    reviewer_credential_ref: str


@dataclass(frozen=True)
class ProviderStageRenderParams:
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
    font_unify_mode: str
    source_cleanup_strategy: str
    engine: str = RENDER_ENGINE_TYPST


@dataclass(frozen=True)
class ProviderStageSpec:
    schema_version: str
    stage: str
    job: StageJobRef
    source: ProviderStageSource
    ocr: ProviderStageOcrParams
    translation: ProviderStageTranslationParams
    render: ProviderStageRenderParams

    @classmethod
    def load(cls, path: Path) -> ProviderStageSpec:
        spec_path = path.resolve()
        if not spec_path.exists():
            raise RuntimeError(f"stage spec not found: {spec_path}")
        payload = _load_json(spec_path)
        schema_version = _require_text(payload, "schema_version")
        if schema_version != PROVIDER_STAGE_SCHEMA_VERSION:
            raise RuntimeError(
                f"unsupported provider stage schema_version: {schema_version}"
            )
        stage = _require_text(payload, "stage")
        if stage != "provider":
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
            raise RuntimeError(
                "provider stage spec requires source.file_url or source.file_path"
            )
        source = ProviderStageSource(file_url=file_url, file_path=file_path)
        ocr = ProviderStageOcrParams(
            provider=str(ocr_payload.get("provider", "mineru") or "mineru")
            .strip()
            .lower(),
            credential_ref=str(ocr_payload.get("credential_ref", "") or ""),
            model_version=str(ocr_payload.get("model_version", "vlm") or "vlm"),
            paddle_api_url=str(ocr_payload.get("paddle_api_url", "") or ""),
            paddle_model=str(
                ocr_payload.get("paddle_model", paddle_default_model())
                or paddle_default_model()
            ),
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
            options=dict(ocr_payload.get("options") or {})
            if isinstance(ocr_payload.get("options"), dict)
            else {},
        )
        glossary_entries = translation_payload.get("glossary_entries") or []
        if not isinstance(glossary_entries, list):
            raise RuntimeError(
                "stage spec field 'translation.glossary_entries' must be a list"
            )
        translation = ProviderStageTranslationParams(
            start_page=_int_field(translation_payload, "start_page", 0),
            end_page=_int_field(translation_payload, "end_page", -1),
            batch_size=_int_field(
                translation_payload, "batch_size", DEFAULT_TRANSLATION_BATCH_SIZE
            ),
            workers=int(translation_payload.get("workers", 1) or 1),
            mode=str(translation_payload.get("mode", "sci") or "sci"),
            math_mode=str(
                translation_payload.get("math_mode", "direct_typst") or "direct_typst"
            ),
            skip_title_translation=bool(
                translation_payload.get("skip_title_translation", False)
            ),
            classify_batch_size=int(
                translation_payload.get("classify_batch_size", 12) or 12
            ),
            rule_profile_name=str(
                translation_payload.get("rule_profile_name", "general_sci")
                or "general_sci"
            ),
            custom_rules_text=str(
                translation_payload.get("custom_rules_text", "") or ""
            ),
            glossary_id=str(translation_payload.get("glossary_id", "") or ""),
            glossary_name=str(translation_payload.get("glossary_name", "") or ""),
            glossary_resource_entry_count=int(
                translation_payload.get("glossary_resource_entry_count", 0) or 0
            ),
            glossary_inline_entry_count=int(
                translation_payload.get("glossary_inline_entry_count", 0) or 0
            ),
            glossary_overridden_entry_count=int(
                translation_payload.get("glossary_overridden_entry_count", 0) or 0
            ),
            glossary_entries=glossary_entries,
            context_mode=str(
                translation_payload.get("context_mode", "needed") or "needed"
            )
            .strip()
            .lower(),
            glossary_mode=str(
                translation_payload.get("glossary_mode", "matched") or "matched"
            )
            .strip()
            .lower(),
            memory_mode=str(
                translation_payload.get("memory_mode", "matched") or "matched"
            )
            .strip()
            .lower(),
            model=str(translation_payload.get("model", "") or ""),
            base_url=str(translation_payload.get("base_url", "") or ""),
            credential_ref=str(translation_payload.get("credential_ref", "") or ""),
            **_preparation_and_reviewer_fields(translation_payload),
        )
        render = ProviderStageRenderParams(
            render_mode=str(render_payload.get("render_mode", "typst") or "typst"),
            compile_workers=int(render_payload.get("compile_workers", 0) or 0),
            typst_font_family=str(
                render_payload.get("typst_font_family", "") or ""
            ).strip()
            or fonts.TYPST_DEFAULT_FONT_FAMILY,
            pdf_compress_dpi=int(render_payload.get("pdf_compress_dpi", 0) or 0),
            translated_pdf_name=str(
                render_payload.get("translated_pdf_name", "") or ""
            ),
            body_font_size_factor=float(
                render_payload.get("body_font_size_factor", 1.0) or 1.0
            ),
            body_leading_factor=float(
                render_payload.get("body_leading_factor", 1.0) or 1.0
            ),
            inner_bbox_shrink_x=float(
                render_payload.get("inner_bbox_shrink_x", 0.0) or 0.0
            ),
            inner_bbox_shrink_y=float(
                render_payload.get("inner_bbox_shrink_y", 0.0) or 0.0
            ),
            inner_bbox_dense_shrink_x=float(
                render_payload.get("inner_bbox_dense_shrink_x", 0.0) or 0.0
            ),
            inner_bbox_dense_shrink_y=float(
                render_payload.get("inner_bbox_dense_shrink_y", 0.0) or 0.0
            ),
            font_unify_mode=str(
                render_payload.get("font_unify_mode", "role_min") or "role_min"
            )
            .strip()
            .lower(),
            source_cleanup_strategy=str(
                render_payload.get("source_cleanup_strategy", "pikepdf_text_strip")
                or "pikepdf_text_strip"
            )
            .strip()
            .lower(),
            engine=normalize_render_engine(render_payload.get("engine")),
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
    context_mode: str
    glossary_mode: str
    memory_mode: str
    model: str
    base_url: str
    credential_ref: str
    # 译前准备档位与审校模型配置位。旧 spec 没有这些 key，一律按默认值（off / 空串）读。
    preparation: str
    reviewer_model: str
    reviewer_base_url: str
    reviewer_credential_ref: str


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
    font_unify_mode: str
    source_cleanup_strategy: str
    engine: str = RENDER_ENGINE_TYPST


@dataclass(frozen=True)
class BookStageSpec:
    schema_version: str
    stage: str
    job: StageJobRef
    inputs: BookStageInputs
    translation: BookStageTranslationParams
    render: BookStageRenderParams

    @classmethod
    def load(cls, path: Path) -> BookStageSpec:
        spec_path = path.resolve()
        if not spec_path.exists():
            raise RuntimeError(f"stage spec not found: {spec_path}")
        payload = _load_json(spec_path)
        schema_version = _require_text(payload, "schema_version")
        if schema_version != BOOK_STAGE_SCHEMA_VERSION:
            raise RuntimeError(
                f"unsupported book stage schema_version: {schema_version}"
            )
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
            raise RuntimeError(
                "stage spec field 'translation.glossary_entries' must be a list"
            )
        translation = BookStageTranslationParams(
            start_page=_int_field(translation_payload, "start_page", 0),
            end_page=_int_field(translation_payload, "end_page", -1),
            batch_size=_int_field(
                translation_payload, "batch_size", DEFAULT_TRANSLATION_BATCH_SIZE
            ),
            workers=int(translation_payload.get("workers", 1) or 1),
            mode=str(translation_payload.get("mode", "sci") or "sci"),
            math_mode=str(
                translation_payload.get("math_mode", "direct_typst") or "direct_typst"
            ),
            skip_title_translation=bool(
                translation_payload.get("skip_title_translation", False)
            ),
            classify_batch_size=int(
                translation_payload.get("classify_batch_size", 12) or 12
            ),
            rule_profile_name=str(
                translation_payload.get("rule_profile_name", "general_sci")
                or "general_sci"
            ),
            custom_rules_text=str(
                translation_payload.get("custom_rules_text", "") or ""
            ),
            glossary_id=str(translation_payload.get("glossary_id", "") or ""),
            glossary_name=str(translation_payload.get("glossary_name", "") or ""),
            glossary_resource_entry_count=int(
                translation_payload.get("glossary_resource_entry_count", 0) or 0
            ),
            glossary_inline_entry_count=int(
                translation_payload.get("glossary_inline_entry_count", 0) or 0
            ),
            glossary_overridden_entry_count=int(
                translation_payload.get("glossary_overridden_entry_count", 0) or 0
            ),
            glossary_entries=glossary_entries,
            context_mode=str(
                translation_payload.get("context_mode", "needed") or "needed"
            )
            .strip()
            .lower(),
            glossary_mode=str(
                translation_payload.get("glossary_mode", "matched") or "matched"
            )
            .strip()
            .lower(),
            memory_mode=str(
                translation_payload.get("memory_mode", "matched") or "matched"
            )
            .strip()
            .lower(),
            model=str(translation_payload.get("model", "") or ""),
            base_url=str(translation_payload.get("base_url", "") or ""),
            credential_ref=str(translation_payload.get("credential_ref", "") or ""),
            **_preparation_and_reviewer_fields(translation_payload),
        )
        render = BookStageRenderParams(
            render_mode=str(render_payload.get("render_mode", "typst") or "typst"),
            compile_workers=int(render_payload.get("compile_workers", 0) or 0),
            typst_font_family=str(
                render_payload.get("typst_font_family", "") or ""
            ).strip()
            or fonts.TYPST_DEFAULT_FONT_FAMILY,
            pdf_compress_dpi=int(render_payload.get("pdf_compress_dpi", 0) or 0),
            translated_pdf_name=str(
                render_payload.get("translated_pdf_name", "") or ""
            ),
            body_font_size_factor=float(
                render_payload.get("body_font_size_factor", 1.0) or 1.0
            ),
            body_leading_factor=float(
                render_payload.get("body_leading_factor", 1.0) or 1.0
            ),
            inner_bbox_shrink_x=float(
                render_payload.get("inner_bbox_shrink_x", 0.0) or 0.0
            ),
            inner_bbox_shrink_y=float(
                render_payload.get("inner_bbox_shrink_y", 0.0) or 0.0
            ),
            inner_bbox_dense_shrink_x=float(
                render_payload.get("inner_bbox_dense_shrink_x", 0.0) or 0.0
            ),
            inner_bbox_dense_shrink_y=float(
                render_payload.get("inner_bbox_dense_shrink_y", 0.0) or 0.0
            ),
            font_unify_mode=str(
                render_payload.get("font_unify_mode", "role_min") or "role_min"
            )
            .strip()
            .lower(),
            source_cleanup_strategy=str(
                render_payload.get("source_cleanup_strategy", "pikepdf_text_strip")
                or "pikepdf_text_strip"
            )
            .strip()
            .lower(),
            engine=normalize_render_engine(render_payload.get("engine")),
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
