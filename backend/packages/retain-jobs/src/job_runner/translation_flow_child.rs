use anyhow::{anyhow, Result};

use crate::db::Db;
use crate::job_events::{
    persist_runtime_job_with_resources, record_custom_runtime_event_with_resources,
};
use crate::models::domain::{now_iso, JobRuntimeState, JobSnapshot, JobStatusKind, WorkflowKind};
use crate::storage_paths::JobPaths;

use crate::job_runner::{
    attach_job_paths, clear_job_failure, sync_runtime_state, ProcessRuntimeDeps,
};

pub(super) struct TranslationUploadSource {
    pub(super) upload_id: String,
}

pub(super) fn load_translation_upload_source(
    db: &Db,
    parent_job: &JobRuntimeState,
) -> Result<TranslationUploadSource> {
    let upload_id = parent_job
        .upload_id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| anyhow!("parent translation job is missing upload_id"))?;
    let upload = db.get_upload(&upload_id)?;
    if !std::path::Path::new(&upload.stored_path).exists() {
        return Err(anyhow!("uploaded file missing: {}", upload.stored_path));
    }
    Ok(TranslationUploadSource { upload_id })
}

pub(super) fn mark_parent_ocr_submitting(
    deps: &ProcessRuntimeDeps,
    parent_job: &mut JobRuntimeState,
) -> Result<()> {
    parent_job.status = JobStatusKind::Running;
    parent_job.started_at = Some(now_iso());
    parent_job.updated_at = now_iso();
    parent_job.stage = Some("ocr_submitting".to_string());
    parent_job.stage_detail = Some("正在启动 OCR 子任务".to_string());
    clear_job_failure(parent_job);
    sync_runtime_state(parent_job);
    persist_runtime_job_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        parent_job,
    )?;
    Ok(())
}

pub(super) fn create_ocr_child_job(
    deps: &ProcessRuntimeDeps,
    parent_job: &mut JobRuntimeState,
    parent_job_paths: &JobPaths,
    source: &TranslationUploadSource,
) -> Result<JobRuntimeState> {
    let ocr_job_id = format!("{}-ocr", parent_job.job_id);
    let mut ocr_request = parent_job.request_payload.clone();
    ocr_request.workflow = WorkflowKind::Ocr;
    ocr_request.job_id = ocr_job_id.clone();
    ocr_request.source.upload_id = source.upload_id.clone();

    let mut ocr_child = JobSnapshot::new(
        ocr_job_id.clone(),
        ocr_request.clone(),
        vec!["ocr-child-pending-provider".to_string()],
    )
    .into_runtime();
    attach_job_paths(&mut ocr_child, parent_job_paths);
    if let Some(artifacts) = ocr_child.artifacts.as_mut() {
        artifacts.trace_id = Some(format!("ocr-{ocr_job_id}"));
        artifacts.schema_version = Some("document.v1".to_string());
    }
    ocr_child.stage = Some("queued".to_string());
    ocr_child.stage_detail = Some("OCR 子任务已创建".to_string());
    sync_runtime_state(&mut ocr_child);
    persist_runtime_job_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &ocr_child,
    )?;

    if let Some(artifacts) = parent_job.artifacts.as_mut() {
        artifacts.ocr_job_id = Some(ocr_job_id.clone());
        artifacts.ocr_trace_id = Some(format!("ocr-{ocr_job_id}"));
        artifacts.ocr_status = Some(JobStatusKind::Queued);
    }
    sync_runtime_state(parent_job);
    persist_runtime_job_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        parent_job,
    )?;
    record_custom_runtime_event_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &parent_job.snapshot(),
        "info",
        "ocr_child_created",
        "OCR 子任务已创建",
        Some(serde_json::json!({ "ocr_job_id": ocr_job_id })),
    );

    Ok(ocr_child)
}
