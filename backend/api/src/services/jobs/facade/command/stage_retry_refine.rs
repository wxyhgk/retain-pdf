//! `retry-stage stage=refine`：对已提交的译文原地精修，再原地重渲染一次。
//!
//! 精修放在渲染阶段里、真正渲染之前跑（Python `run_refine_for_render`），所以这里不新增
//! workflow：原地提交一次 Render workflow，并把这次的精修参数写成一次性覆盖
//! （`specs/refine-override.json`，见 retain-data `worker_command::refine_override`）。
//! 覆盖**不**进任务的 `translation.refine`：否则之后每次普通重渲染都会再精修、再花钱。

use std::path::Path;

use serde_json::Value;

use crate::error::AppError;
use crate::models::api::RefineRetryRequest;
use crate::models::domain::{now_iso, CreateJobInput, JobSnapshot, RefineOverride};
use crate::services::job_validation::validate_translation_credential_reference;
use crate::storage_paths::JobPaths;
use crate::worker_command::refine_override::clear_refine_override;

use super::rerun::prepare_in_place_render_job;
use super::stage_retry_overrides::{apply_retry_overrides_to_resolved_spec, discard_ocr_secret_sources};

/// 精修重试允许的模式。`off` 不在里面：不精修的重渲染请用 stage=render。
const REFINE_RETRY_MODES: &[&str] = &["review_only", "review_and_fix"];
const DEFAULT_REFINE_RETRY_MODE: &str = "review_and_fix";

/// 校验 `refine` 对象并归一成要落盘的一次性覆盖。省略 = 全书 review_and_fix。
pub(super) fn validate_refine_request(
    request: Option<&RefineRetryRequest>,
) -> Result<RefineOverride, AppError> {
    let default = RefineRetryRequest::default();
    let request = request.unwrap_or(&default);
    let mode = request
        .mode
        .as_deref()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_REFINE_RETRY_MODE.to_string());
    if !REFINE_RETRY_MODES.contains(&mode.as_str()) {
        return Err(AppError::bad_request(format!(
            "refine.mode must be one of: {} (use stage=render to re-render without refine)",
            REFINE_RETRY_MODES.join(", ")
        )));
    }
    for (field, value) in [
        ("refine.start_page", request.start_page),
        ("refine.end_page", request.end_page),
    ] {
        if value.is_some_and(|page| page < 1) {
            return Err(AppError::bad_request(format!(
                "{field} is 1-based and must be >= 1"
            )));
        }
    }
    if let (Some(start), Some(end)) = (request.start_page, request.end_page) {
        if start > end {
            return Err(AppError::bad_request(
                "refine.start_page must be <= refine.end_page (inclusive range)",
            ));
        }
    }
    Ok(RefineOverride {
        mode,
        start_page: request.start_page,
        end_page: request.end_page,
        requested_at: now_iso(),
    })
}

/// 把源任务改写成一次原地 Render workflow，并保留精修要用的模型凭据引用。
///
/// 精修要调模型：保留**引用**（credential_ref / reviewer_credential_ref），内联 key 一律
/// 清掉（普通原地重渲染现在也保留引用，见 rerun.rs）。任务上没有引用时，调用方可以用
/// `overrides.translation.credential_ref`（或 reviewer_*）补上；不接受内联 key。
pub(super) fn prepare_in_place_refine_job(
    source_job: JobSnapshot,
    overrides: &Value,
    data_root: &Path,
) -> Result<JobSnapshot, AppError> {
    reject_inline_keys(overrides)?;
    let credential_ref = source_job.request_payload.translation.credential_ref.clone();
    let reviewer_credential_ref = source_job
        .request_payload
        .translation
        .reviewer_credential_ref
        .clone();
    let mut job = prepare_in_place_render_job(source_job)?;
    {
        let translation = &mut job.request_payload.translation;
        translation.credential_ref = credential_ref;
        translation.reviewer_credential_ref = reviewer_credential_ref;
    }
    apply_retry_overrides_to_resolved_spec(&mut job.request_payload, overrides)?;
    discard_ocr_secret_sources(&mut job.request_payload.ocr);
    job.request_payload.translation.api_key.clear();
    job.request_payload.translation.reviewer_api_key.clear();
    require_refine_model(&job)?;
    validate_translation_credential_reference(
        &CreateJobInput {
            translation: job.request_payload.translation.clone(),
            ..CreateJobInput::default()
        },
        data_root,
    )?;
    job.request_payload.runtime.job_id = job.job_id.clone();
    job.sync_runtime_state();
    Ok(job)
}

/// 任何一次原地渲染提交前清掉没用完的精修覆盖（不存在时是空操作）。
pub(super) fn clear_pending_refine_override(
    output_root: &Path,
    job_id: &str,
) -> Result<(), AppError> {
    clear_refine_override(&JobPaths::for_job(output_root, job_id))
        .map_err(|error| AppError::internal(format!("failed to clear refine override: {error:#}")))
}

fn reject_inline_keys(overrides: &Value) -> Result<(), AppError> {
    let translation = overrides.get("translation");
    for key in ["api_key", "reviewer_api_key"] {
        if translation
            .and_then(|section| section.get(key))
            .and_then(Value::as_str)
            .is_some_and(|value| !value.trim().is_empty())
        {
            return Err(AppError::bad_request(format!(
                "refine retry does not accept inline translation.{key}; pass a vault credential reference (credential_ref / reviewer_credential_ref)"
            )));
        }
    }
    Ok(())
}

/// 精修至少要有一套能用的模型：审校三件套齐全，或翻译三件套齐全（审校留空回退到它）。
fn require_refine_model(job: &JobSnapshot) -> Result<(), AppError> {
    let translation = &job.request_payload.translation;
    let complete = |model: &str, base_url: &str, credential_ref: &str| {
        !model.trim().is_empty() && !base_url.trim().is_empty() && !credential_ref.trim().is_empty()
    };
    if complete(
        &translation.reviewer_model,
        &translation.reviewer_base_url,
        &translation.reviewer_credential_ref,
    ) || complete(
        &translation.model,
        &translation.base_url,
        &translation.credential_ref,
    ) {
        return Ok(());
    }
    Err(AppError::bad_request(
        "refine needs a model credential, but this job has none (for example it was created without one or the credential was deleted); pass overrides.translation.{model, base_url, credential_ref}",
    ))
}
