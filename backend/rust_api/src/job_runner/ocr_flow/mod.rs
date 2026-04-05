use anyhow::Result;

use crate::job_events::persist_runtime_job;
use crate::models::{now_iso, JobRuntimeState, JobStatusKind};
use crate::ocr_provider::parse_provider_kind;
use crate::AppState;

use super::{
    append_error_chain_log, attach_job_provider_failure, build_normalize_ocr_command,
    clear_canceled_runtime_artifacts, clear_job_failure, execute_process_job, format_error_chain,
    is_cancel_requested, job_artifacts_mut, refresh_job_failure, sync_runtime_state,
};

mod artifacts;
mod bundle_download;
mod markdown_bundle;
mod mineru;
mod mineru_polling;
mod mineru_retry;
mod paddle;
mod page_subset;
mod polling;
mod provider_result;
mod status;
mod transport;
mod workspace;

use transport::execute_transport;
use workspace::OcrWorkspace;

async fn save_ocr_job(
    state: &AppState,
    job: &JobRuntimeState,
    parent_job_id: Option<&str>,
) -> Result<()> {
    persist_runtime_job(state, job)?;
    if let Some(parent_job_id) = parent_job_id {
        mirror_parent_ocr_status(state, parent_job_id, job).await?;
    }
    Ok(())
}

async fn mirror_parent_ocr_status(
    state: &AppState,
    parent_job_id: &str,
    ocr_job: &JobRuntimeState,
) -> Result<()> {
    let mut parent_job = state.db.get_job(parent_job_id)?.into_runtime();
    if matches!(
        parent_job.status,
        JobStatusKind::Succeeded | JobStatusKind::Failed | JobStatusKind::Canceled
    ) {
        return Ok(());
    }
    let parent_artifacts = job_artifacts_mut(&mut parent_job);
    parent_artifacts.ocr_job_id = Some(ocr_job.job_id.clone());
    parent_artifacts.ocr_status = Some(ocr_job.status.clone());
    parent_artifacts.ocr_trace_id = ocr_job
        .artifacts
        .as_ref()
        .and_then(|item| item.trace_id.clone());
    parent_artifacts.ocr_provider_trace_id = ocr_job
        .artifacts
        .as_ref()
        .and_then(|item| item.provider_trace_id.clone());
    parent_artifacts.ocr_provider_diagnostics = ocr_job
        .artifacts
        .as_ref()
        .and_then(|item| item.ocr_provider_diagnostics.clone());

    parent_job.status = JobStatusKind::Running;
    parent_job.stage = ocr_job.stage.clone().or(Some("ocr_submitting".to_string()));
    parent_job.stage_detail = ocr_job
        .stage_detail
        .as_ref()
        .map(|detail| format!("OCR 子任务：{detail}"))
        .or_else(|| Some("OCR 子任务运行中".to_string()));
    parent_job.progress_current = ocr_job.progress_current;
    parent_job.progress_total = ocr_job.progress_total;
    parent_job.updated_at = now_iso();
    parent_job.replace_failure_info(None);
    parent_job.sync_runtime_state();
    persist_runtime_job(state, &parent_job)?;
    Ok(())
}

pub async fn execute_ocr_job(
    state: AppState,
    mut job: JobRuntimeState,
    output_job_id_override: Option<String>,
    parent_job_id: Option<String>,
) -> Result<JobRuntimeState> {
    let provider_kind = parse_provider_kind(&job.request_payload.ocr.provider);
    job.status = JobStatusKind::Running;
    if job.started_at.is_none() {
        job.started_at = Some(now_iso());
    }
    job.updated_at = now_iso();
    job.stage = Some("ocr_upload".to_string());
    job.stage_detail = Some("OCR provider transport 启动中".to_string());
    clear_job_failure(&mut job);
    sync_runtime_state(&mut job);
    save_ocr_job(&state, &job, parent_job_id.as_deref()).await?;

    let workspace =
        OcrWorkspace::prepare(&state, &mut job, &provider_kind, output_job_id_override)?;
    save_ocr_job(&state, &job, parent_job_id.as_deref()).await?;

    let source_pdf_path = match execute_transport(
        &state,
        &mut job,
        &provider_kind,
        &workspace,
        parent_job_id.as_deref(),
    )
    .await
    {
        Ok(path) => path,
        Err(err) => {
            fail_ocr_transport(&mut job, &err);
            return Ok(job);
        }
    };

    if is_cancel_requested(&state, &job.job_id).await {
        job.status = JobStatusKind::Canceled;
        job.stage = Some("canceled".to_string());
        job.stage_detail = Some("OCR 任务已取消".to_string());
        job.updated_at = now_iso();
        job.finished_at = Some(now_iso());
        clear_canceled_runtime_artifacts(&mut job);
        clear_job_failure(&mut job);
        sync_runtime_state(&mut job);
        save_ocr_job(&state, &job, parent_job_id.as_deref()).await?;
        return Ok(job);
    }

    let source_pdf_string = source_pdf_path.to_string_lossy().to_string();
    job_artifacts_mut(&mut job).source_pdf = Some(source_pdf_string);

    job.command = build_normalize_ocr_command(
        &state,
        &job.request_payload,
        &workspace.job_paths,
        &workspace.layout_json_path,
        &source_pdf_path,
        &workspace.provider_result_json_path,
        &workspace.provider_zip_path,
        &workspace.provider_raw_dir,
    );
    job.stage = Some("normalizing".to_string());
    job.stage_detail = Some("OCR provider 已完成，开始标准化 document.v1".to_string());
    job.updated_at = now_iso();
    sync_runtime_state(&mut job);
    save_ocr_job(&state, &job, parent_job_id.as_deref()).await?;

    execute_process_job(state, job, &[]).await
}

fn fail_ocr_transport(job: &mut JobRuntimeState, err: &anyhow::Error) {
    let message = format_error_chain(err);
    append_error_chain_log(job, err);
    attach_job_provider_failure(job, &message);
    job.status = JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    if job
        .stage_detail
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        job.stage_detail = Some("OCR provider transport 失败".to_string());
    }
    job.error = Some(message);
    job.updated_at = now_iso();
    job.finished_at = Some(now_iso());
    refresh_job_failure(job);
    sync_runtime_state(job);
}

pub fn sync_parent_with_ocr_child(
    parent_job: &mut JobRuntimeState,
    ocr_finished: &JobRuntimeState,
) {
    let parent_artifacts = job_artifacts_mut(parent_job);
    parent_artifacts.ocr_job_id = Some(ocr_finished.job_id.clone());
    parent_artifacts.ocr_status = Some(ocr_finished.status.clone());
    parent_artifacts.ocr_trace_id = ocr_finished
        .artifacts
        .as_ref()
        .and_then(|item| item.trace_id.clone());
    parent_artifacts.ocr_provider_trace_id = ocr_finished
        .artifacts
        .as_ref()
        .and_then(|item| item.provider_trace_id.clone());

    if let Some(child_artifacts) = ocr_finished.artifacts.as_ref() {
        if parent_artifacts.job_root.is_none() {
            parent_artifacts.job_root = child_artifacts.job_root.clone();
        }
        parent_artifacts.source_pdf = child_artifacts.source_pdf.clone();
        parent_artifacts.layout_json = child_artifacts.layout_json.clone();
        parent_artifacts.normalized_document_json =
            child_artifacts.normalized_document_json.clone();
        parent_artifacts.normalization_report_json =
            child_artifacts.normalization_report_json.clone();
        parent_artifacts.provider_raw_dir = child_artifacts.provider_raw_dir.clone();
        parent_artifacts.provider_zip = child_artifacts.provider_zip.clone();
        parent_artifacts.provider_summary_json = child_artifacts.provider_summary_json.clone();
        parent_artifacts.schema_version = child_artifacts.schema_version.clone();
        parent_artifacts.trace_id = parent_artifacts
            .trace_id
            .clone()
            .or(child_artifacts.trace_id.clone());
        parent_artifacts.provider_trace_id = child_artifacts.provider_trace_id.clone();
        parent_artifacts.ocr_provider_diagnostics =
            child_artifacts.ocr_provider_diagnostics.clone();
    }
}
