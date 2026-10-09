use std::path::Path;

use anyhow::Result;

use crate::config::WorkerCommandRuntimeConfig;
use crate::models::domain::{RefineOverride, ResolvedJobSpec};
use crate::storage_paths::JobPaths;

use super::entrypoints::{
    normalize_ocr_command as build_normalize_entrypoint,
    render_only_command as build_render_only_entrypoint,
    render_prepare_command as build_render_prepare_entrypoint,
    translate_only_command as build_translate_only_entrypoint,
};
use super::stage_specs::{
    write_normalize_stage_spec, write_render_prepare_stage_spec, write_render_stage_spec,
    write_translate_stage_spec,
};

/// 这次渲染要不要先精修译文（写进 render.spec.json 的 `params.refine`）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RenderRefine {
    /// 不精修（普通重渲染、rerun 恢复出来的渲染）。
    Off,
    /// 紧跟翻译的那次渲染：用任务的 `translation.refine`（默认 off），trigger=auto。
    AfterTranslation,
    /// `retry-stage stage=refine` 的一次性覆盖，trigger=manual。
    Manual(RefineOverride),
}

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
        refine: RenderRefine,
    },
    /// 与翻译并行的渲染准备（辅助进程，不是任务阶段：不改任务状态，失败不影响任务）。
    RenderPrepare {
        source_json_path: &'a Path,
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
            refine,
        } => build_render_only_command(
            config,
            request,
            job_paths,
            source_pdf_path,
            translations_dir,
            &refine,
        ),
        WorkerStageCommand::RenderPrepare {
            source_json_path,
            source_pdf_path,
            translations_dir,
        } => {
            let spec_path = write_render_prepare_stage_spec(
                request,
                job_paths,
                source_json_path,
                source_pdf_path,
                translations_dir,
            )?;
            Ok(build_render_prepare_entrypoint(config, &spec_path))
        }
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
    refine: &RenderRefine,
) -> Result<Vec<String>> {
    let spec_path = write_render_stage_spec(
        request,
        job_paths,
        source_pdf_path,
        translations_dir,
        refine,
    )?;
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
