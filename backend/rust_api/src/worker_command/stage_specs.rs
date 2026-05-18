use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde_json::json;

use crate::models::ResolvedJobSpec;
use crate::ocr_provider::{provider_model_version, require_supported_provider};
#[cfg(test)]
use crate::ocr_provider::{provider_token, provider_token_env_name};
use crate::storage_paths::JobPaths;

const NORMALIZE_STAGE_SCHEMA_VERSION: &str = "normalize.stage.v1";
const TRANSLATE_STAGE_SCHEMA_VERSION: &str = "translate.stage.v1";
const RENDER_STAGE_SCHEMA_VERSION: &str = "render.stage.v1";
#[cfg(test)]
const PROVIDER_STAGE_SCHEMA_VERSION: &str = "provider.stage.v1";
pub(crate) const TRANSLATION_API_KEY_ENV_NAME: &str = "RETAIN_TRANSLATION_API_KEY";

fn normalize_stage_spec_path(job_paths: &JobPaths) -> PathBuf {
    job_paths.specs_dir.join("normalize.spec.json")
}

fn translate_stage_spec_path(job_paths: &JobPaths) -> PathBuf {
    job_paths.specs_dir.join("translate.spec.json")
}

fn render_stage_spec_path(job_paths: &JobPaths) -> PathBuf {
    job_paths.specs_dir.join("render.spec.json")
}

#[cfg(test)]
fn provider_stage_spec_path(job_paths: &JobPaths) -> PathBuf {
    job_paths.specs_dir.join("provider.spec.json")
}

fn ensure_specs_dir(job_paths: &JobPaths) -> Result<()> {
    fs::create_dir_all(&job_paths.specs_dir)
        .with_context(|| format!("create specs dir: {}", job_paths.specs_dir.display()))
}

fn translated_pdf_name(request: &ResolvedJobSpec, source_pdf_path: &Path) -> String {
    let explicit = request.render.translated_pdf_name.trim();
    if !explicit.is_empty() {
        return explicit.to_string();
    }
    let stem = source_pdf_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("translated");
    format!("{stem}-translated.pdf")
}

pub(crate) fn write_normalize_stage_spec(
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
    provider_result_json_path: &Path,
    provider_zip_path: &Path,
    provider_raw_dir: &Path,
) -> Result<PathBuf> {
    ensure_specs_dir(job_paths)?;
    let spec_path = normalize_stage_spec_path(job_paths);
    let provider_kind = require_supported_provider(&request.ocr.provider)
        .context("resolve OCR provider for normalize stage spec")?;
    let provider_version = provider_model_version(&provider_kind, &request.ocr).to_string();
    let payload = json!({
        "schema_version": NORMALIZE_STAGE_SCHEMA_VERSION,
        "stage": "normalize",
        "job": {
            "job_id": request.job_id,
            "job_root": job_paths.root,
            "workflow": request.workflow,
        },
        "inputs": {
            "provider": request.ocr.provider,
            "source_json": source_json_path,
            "source_pdf": source_pdf_path,
            "provider_version": provider_version,
            "provider_result_json": provider_result_json_path,
            "provider_zip": provider_zip_path,
            "provider_raw_dir": provider_raw_dir,
        },
        "params": {},
    });
    let content = serde_json::to_string_pretty(&payload)?;
    fs::write(&spec_path, content)
        .with_context(|| format!("write normalize stage spec: {}", spec_path.display()))?;
    Ok(spec_path)
}

pub(crate) fn write_translate_stage_spec(
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
    layout_json_path: Option<&Path>,
) -> Result<PathBuf> {
    ensure_specs_dir(job_paths)?;
    let spec_path = translate_stage_spec_path(job_paths);
    let credential_ref = if request.translation.api_key.trim().is_empty() {
        String::new()
    } else {
        format!("env:{TRANSLATION_API_KEY_ENV_NAME}")
    };
    let render_prewarm_output_pdf_path = job_paths
        .rendered_dir
        .join(translated_pdf_name(request, source_pdf_path));
    let payload = json!({
        "schema_version": TRANSLATE_STAGE_SCHEMA_VERSION,
        "stage": "translate",
        "job": {
            "job_id": request.job_id,
            "job_root": job_paths.root,
            "workflow": request.workflow,
        },
        "inputs": {
            "source_json": source_json_path,
            "source_pdf": source_pdf_path,
            "layout_json": layout_json_path,
        },
        "params": {
            "start_page": request.translation.start_page,
            "end_page": request.translation.end_page,
            "batch_size": request.translation.batch_size,
            "workers": request.resolved_workers(),
            "mode": request.translation.mode,
            "math_mode": request.translation.math_mode,
            "skip_title_translation": request.translation.skip_title_translation,
            "classify_batch_size": request.translation.classify_batch_size,
            "rule_profile_name": request.translation.rule_profile_name,
            "custom_rules_text": request.translation.custom_rules_text,
            "glossary_id": request.translation.glossary_id,
            "glossary_name": request.translation.glossary_name,
            "glossary_resource_entry_count": request.translation.glossary_resource_entry_count,
            "glossary_inline_entry_count": request.translation.glossary_inline_entry_count,
            "glossary_overridden_entry_count": request.translation.glossary_overridden_entry_count,
            "glossary_entries": request.translation.glossary_entries,
            "model": request.translation.model,
            "base_url": request.translation.base_url,
            "credential_ref": credential_ref,
            "render_prewarm_output_pdf_path": render_prewarm_output_pdf_path,
            "render_prewarm_mode": request.render.render_mode,
            "render_prewarm_pdf_compress_dpi": request.render.pdf_compress_dpi,
            "render_prewarm_source_cleanup_strategy": request.render.source_cleanup_strategy,
        },
    });
    let content = serde_json::to_string_pretty(&payload)?;
    fs::write(&spec_path, content)
        .with_context(|| format!("write translate stage spec: {}", spec_path.display()))?;
    Ok(spec_path)
}

pub(crate) fn write_render_stage_spec(
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_pdf_path: &Path,
    translations_dir: &Path,
) -> Result<PathBuf> {
    ensure_specs_dir(job_paths)?;
    let spec_path = render_stage_spec_path(job_paths);
    let credential_ref = if request.translation.api_key.trim().is_empty() {
        String::new()
    } else {
        format!("env:{TRANSLATION_API_KEY_ENV_NAME}")
    };
    let payload = json!({
        "schema_version": RENDER_STAGE_SCHEMA_VERSION,
        "stage": "render",
        "job": {
            "job_id": request.job_id,
            "job_root": job_paths.root,
            "workflow": request.workflow,
        },
        "inputs": {
            "source_pdf": source_pdf_path,
            "translations_dir": translations_dir,
            "translation_manifest": translations_dir.join("translation-manifest.json"),
        },
        "params": {
            "start_page": request.translation.start_page,
            "end_page": request.translation.end_page,
            "render_mode": request.render.render_mode,
            "compile_workers": request.render.compile_workers,
            "typst_font_family": request.render.typst_font_family,
            "pdf_compress_dpi": request.render.pdf_compress_dpi,
            "translated_pdf_name": request.render.translated_pdf_name,
            "body_font_size_factor": request.render.body_font_size_factor,
            "body_leading_factor": request.render.body_leading_factor,
            "inner_bbox_shrink_x": request.render.inner_bbox_shrink_x,
            "inner_bbox_shrink_y": request.render.inner_bbox_shrink_y,
            "inner_bbox_dense_shrink_x": request.render.inner_bbox_dense_shrink_x,
            "inner_bbox_dense_shrink_y": request.render.inner_bbox_dense_shrink_y,
            "font_unify_mode": request.render.font_unify_mode,
            "source_cleanup_strategy": request.render.source_cleanup_strategy,
            "model": request.translation.model,
            "base_url": request.translation.base_url,
            "credential_ref": credential_ref,
        },
    });
    let content = serde_json::to_string_pretty(&payload)?;
    fs::write(&spec_path, content)
        .with_context(|| format!("write render stage spec: {}", spec_path.display()))?;
    Ok(spec_path)
}

#[cfg(test)]
pub(crate) fn write_provider_stage_spec(
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    upload_path: &Path,
) -> Result<PathBuf> {
    ensure_specs_dir(job_paths)?;
    let spec_path = provider_stage_spec_path(job_paths);
    let provider_kind = require_supported_provider(&request.ocr.provider)
        .context("resolve OCR provider for provider stage spec")?;
    let provider_credential_ref = if provider_token(&provider_kind, &request.ocr).is_empty() {
        String::new()
    } else {
        let env_name = provider_token_env_name(&provider_kind)
            .context("resolve OCR provider token env for provider stage spec")?;
        format!("env:{env_name}")
    };
    let translation_credential_ref = if request.translation.api_key.trim().is_empty() {
        String::new()
    } else {
        format!("env:{TRANSLATION_API_KEY_ENV_NAME}")
    };
    let payload = json!({
        "schema_version": PROVIDER_STAGE_SCHEMA_VERSION,
        "stage": "provider",
        "job": {
            "job_id": request.job_id,
            "job_root": job_paths.root,
            "workflow": request.workflow,
        },
        "source": {
            "file_url": request.source.source_url,
            "file_path": upload_path,
        },
        "ocr": {
            "provider": request.ocr.provider,
            "credential_ref": provider_credential_ref,
            "model_version": request.ocr.model_version,
            "paddle_api_url": request.ocr.paddle_api_url,
            "paddle_model": request.ocr.paddle_model,
            "is_ocr": request.ocr.is_ocr,
            "disable_formula": request.ocr.disable_formula,
            "disable_table": request.ocr.disable_table,
            "language": request.ocr.language,
            "page_ranges": request.ocr.page_ranges,
            "data_id": request.ocr.data_id,
            "no_cache": request.ocr.no_cache,
            "cache_tolerance": request.ocr.cache_tolerance,
            "extra_formats": request.ocr.extra_formats,
            "poll_interval": request.ocr.poll_interval,
            "poll_timeout": request.ocr.poll_timeout,
        },
        "translation": {
            "start_page": request.translation.start_page,
            "end_page": request.translation.end_page,
            "batch_size": request.translation.batch_size,
            "workers": request.resolved_workers(),
            "mode": request.translation.mode,
            "math_mode": request.translation.math_mode,
            "skip_title_translation": request.translation.skip_title_translation,
            "classify_batch_size": request.translation.classify_batch_size,
            "rule_profile_name": request.translation.rule_profile_name,
            "custom_rules_text": request.translation.custom_rules_text,
            "glossary_id": request.translation.glossary_id,
            "glossary_name": request.translation.glossary_name,
            "glossary_resource_entry_count": request.translation.glossary_resource_entry_count,
            "glossary_inline_entry_count": request.translation.glossary_inline_entry_count,
            "glossary_overridden_entry_count": request.translation.glossary_overridden_entry_count,
            "glossary_entries": request.translation.glossary_entries,
            "model": request.translation.model,
            "base_url": request.translation.base_url,
            "credential_ref": translation_credential_ref,
        },
        "render": {
            "render_mode": request.render.render_mode,
            "compile_workers": request.render.compile_workers,
            "typst_font_family": request.render.typst_font_family,
            "pdf_compress_dpi": request.render.pdf_compress_dpi,
            "translated_pdf_name": request.render.translated_pdf_name,
            "body_font_size_factor": request.render.body_font_size_factor,
            "body_leading_factor": request.render.body_leading_factor,
            "inner_bbox_shrink_x": request.render.inner_bbox_shrink_x,
            "inner_bbox_shrink_y": request.render.inner_bbox_shrink_y,
            "inner_bbox_dense_shrink_x": request.render.inner_bbox_dense_shrink_x,
            "inner_bbox_dense_shrink_y": request.render.inner_bbox_dense_shrink_y,
            "font_unify_mode": request.render.font_unify_mode,
            "source_cleanup_strategy": request.render.source_cleanup_strategy,
        },
    });
    let content = serde_json::to_string_pretty(&payload)?;
    fs::write(&spec_path, content)
        .with_context(|| format!("write provider stage spec: {}", spec_path.display()))?;
    Ok(spec_path)
}
