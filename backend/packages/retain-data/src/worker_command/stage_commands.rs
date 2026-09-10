use std::path::Path;

use anyhow::Result;

use crate::config::WorkerCommandRuntimeConfig;
use crate::models::domain::ResolvedJobSpec;
use crate::storage_paths::JobPaths;

use super::entrypoints::{
    normalize_ocr_command as build_normalize_entrypoint,
    render_only_command as build_render_only_entrypoint,
    translate_only_command as build_translate_only_entrypoint,
};
use super::stage_specs::{
    write_normalize_stage_spec, write_render_stage_spec, write_translate_stage_spec,
};

pub enum WorkerStageCommand<'a> {
    NormalizeOcr {
        source_json_path: &'a Path,
        source_pdf_path: &'a Path,
        provider_result_json_path: &'a Path,
        provider_zip_path: &'a Path,
        provider_raw_dir: &'a Path,
    },
    Translate {
        source_json_path: &'a Path,
        source_pdf_path: &'a Path,
        layout_json_path: Option<&'a Path>,
    },
    Render {
        source_pdf_path: &'a Path,
        translations_dir: &'a Path,
    },
}

pub fn build_worker_stage_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    command: WorkerStageCommand<'_>,
) -> Result<Vec<String>> {
    match command {
        WorkerStageCommand::NormalizeOcr {
            source_json_path,
            source_pdf_path,
            provider_result_json_path,
            provider_zip_path,
            provider_raw_dir,
        } => build_normalize_ocr_command(
            config,
            request,
            job_paths,
            source_json_path,
            source_pdf_path,
            provider_result_json_path,
            provider_zip_path,
            provider_raw_dir,
        ),
        WorkerStageCommand::Translate {
            source_json_path,
            source_pdf_path,
            layout_json_path,
        } => build_translate_only_command(
            config,
            request,
            job_paths,
            source_json_path,
            source_pdf_path,
            layout_json_path,
        ),
        WorkerStageCommand::Render {
            source_pdf_path,
            translations_dir,
        } => build_render_only_command(
            config,
            request,
            job_paths,
            source_pdf_path,
            translations_dir,
        ),
    }
}

fn build_translate_only_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
    layout_json_path: Option<&Path>,
) -> Result<Vec<String>> {
    let spec_path = write_translate_stage_spec(
        request,
        job_paths,
        source_json_path,
        source_pdf_path,
        layout_json_path,
    )?;
    Ok(build_translate_only_entrypoint(config, &spec_path))
}

fn build_render_only_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_pdf_path: &Path,
    translations_dir: &Path,
) -> Result<Vec<String>> {
    let spec_path = write_render_stage_spec(request, job_paths, source_pdf_path, translations_dir)?;
    Ok(build_render_only_entrypoint(config, &spec_path))
}

fn build_normalize_ocr_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
    provider_result_json_path: &Path,
    provider_zip_path: &Path,
    provider_raw_dir: &Path,
) -> Result<Vec<String>> {
    let spec_path = write_normalize_stage_spec(
        request,
        job_paths,
        source_json_path,
        source_pdf_path,
        provider_result_json_path,
        provider_zip_path,
        provider_raw_dir,
    )?;
    Ok(build_normalize_entrypoint(config, &spec_path))
}
