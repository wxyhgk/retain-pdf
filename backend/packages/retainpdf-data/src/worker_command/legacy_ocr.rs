use std::path::Path;

use anyhow::Result;

use crate::config::WorkerCommandRuntimeConfig;
use crate::models::domain::ResolvedJobSpec;
use crate::storage_paths::JobPaths;

use super::entrypoints::provider_ocr_command as build_provider_ocr_entrypoint;
use super::stage_specs::write_provider_stage_spec;

pub fn build_ocr_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    upload_path: Option<&Path>,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
) -> Result<Vec<String>> {
    let spec_path = write_provider_stage_spec(request, job_paths, upload_path, false)?;
    Ok(build_provider_ocr_entrypoint(config, &spec_path))
}

/// OCR 和翻译并行时的 OCR 命令：spec 里 `ocr.stream_pages = true`，Python 那边能按片的服务商（Paddle）按片并行提交、
/// 做完一片公布一片（`paddle_chunked.py`）；GLM-OCR 本来就一片片公布。
pub fn build_streaming_ocr_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    upload_path: Option<&Path>,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
) -> Result<Vec<String>> {
    let spec_path = write_provider_stage_spec(request, job_paths, upload_path, true)?;
    Ok(build_provider_ocr_entrypoint(config, &spec_path))
}
