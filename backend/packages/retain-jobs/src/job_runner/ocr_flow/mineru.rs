use anyhow::{anyhow, Context, Result};
use serde_json::json;
use std::path::Path;

use crate::job_runner::{ocr_provider_diagnostics_mut, ProcessRuntimeDeps};
use crate::models::domain::{now_iso, JobRuntimeState};
use crate::ocr_provider::mineru::client::{MineruCreatedTask, MineruUploadTarget};
use crate::ocr_provider::mineru::{parse_extra_formats, MineruClient};

use super::dispatch_journal::{
    begin_ocr_dispatch, receipt_ocr_dispatch, receipt_optional_string, receipt_string,
    OcrDispatchDecision,
};
use super::mineru_polling::{poll_remote_task_until_ready, poll_uploaded_batch_until_ready};
use super::save_ocr_job;
use super::status::record_provider_trace;

pub(super) async fn run_local_ocr_transport_mineru(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &MineruClient,
    upload_path: &Path,
    provider_result_json_path: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let upload_file_name = upload_path
        .file_name()
        .and_then(|item| item.to_str())
        .ok_or_else(|| anyhow!("invalid upload filename"))?;
    let request_identity = json!({
        "source_kind": "local_upload",
        "upload_id": job.request_payload.source.upload_id,
        "file_name": upload_file_name,
        "model_version": job.request_payload.ocr.model_version,
        "page_ranges": job.request_payload.ocr.page_ranges,
        "data_id": job.request_payload.ocr.data_id,
    });
    let upload_target =
        match begin_ocr_dispatch(deps, job, "mineru", "apply_upload_url", &request_identity)? {
            OcrDispatchDecision::Send { cursor } => {
                let target = client
                    .apply_upload_url(
                        upload_file_name,
                        &job.request_payload.ocr.model_version,
                        &job.request_payload.ocr.page_ranges,
                        &job.request_payload.ocr.data_id,
                    )
                    .await?;
                receipt_ocr_dispatch(
                    deps,
                    &cursor,
                    &json!({
                        "kind": "mineru_upload_target",
                        "batch_id": target.batch_id,
                        "upload_url": target.upload_url,
                        "trace_id": target.trace_id,
                    }),
                )?;
                target
            }
            OcrDispatchDecision::Resume { receipt } => MineruUploadTarget {
                batch_id: receipt_string(&receipt, "batch_id")?,
                upload_url: receipt_string(&receipt, "upload_url")?,
                trace_id: receipt_optional_string(&receipt, "trace_id"),
            },
        };
    record_provider_trace(job, upload_target.trace_id.clone());
    {
        let diagnostics = ocr_provider_diagnostics_mut(job);
        diagnostics.handle.batch_id = Some(upload_target.batch_id.clone());
        diagnostics.handle.file_name = upload_path
            .file_name()
            .and_then(|item| item.to_str())
            .map(|item| item.to_string());
    }
    job.append_log(&format!("batch_id: {}", upload_target.batch_id));
    job.stage = Some("mineru_upload".to_string());
    job.stage_detail = Some("已获取 OCR provider 上传地址，开始上传文件".to_string());
    job.updated_at = now_iso();
    save_ocr_job(deps, job, parent_job_id).await?;

    client
        .upload_file(&upload_target.upload_url, upload_path)
        .await
        .with_context(|| format!("failed to upload file {}", upload_path.display()))?;
    job.append_log(&format!("upload done: {}", upload_path.display()));
    job.stage = Some("mineru_processing".to_string());
    job.stage_detail = Some("文件上传完成，等待 OCR provider 解析".to_string());
    job.updated_at = now_iso();
    save_ocr_job(deps, job, parent_job_id).await?;

    let file_name = upload_path
        .file_name()
        .and_then(|item| item.to_str())
        .ok_or_else(|| anyhow!("invalid upload filename"))?
        .to_string();
    poll_uploaded_batch_until_ready(
        deps,
        job,
        client,
        &upload_target.batch_id,
        &file_name,
        provider_result_json_path,
        parent_job_id,
    )
    .await
}

pub(super) async fn run_remote_ocr_transport_mineru(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &MineruClient,
    provider_result_json_path: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let extra_formats = parse_extra_formats(&job.request_payload.ocr.extra_formats);
    let request_identity = json!({
        "source_kind": "remote_url",
        "source_url": job.request_payload.source.source_url,
        "model_version": job.request_payload.ocr.model_version,
        "is_ocr": job.request_payload.ocr.is_ocr,
        "enable_formula": !job.request_payload.ocr.disable_formula,
        "enable_table": !job.request_payload.ocr.disable_table,
        "language": job.request_payload.ocr.language,
        "page_ranges": job.request_payload.ocr.page_ranges,
        "data_id": job.request_payload.ocr.data_id,
        "no_cache": job.request_payload.ocr.no_cache,
        "cache_tolerance": job.request_payload.ocr.cache_tolerance,
        "extra_formats": extra_formats,
    });
    let created = match begin_ocr_dispatch(
        deps,
        job,
        "mineru",
        "create_extract_task",
        &request_identity,
    )? {
        OcrDispatchDecision::Send { cursor } => {
            let created = client
                .create_extract_task(
                    &job.request_payload.source.source_url,
                    &job.request_payload.ocr.model_version,
                    job.request_payload.ocr.is_ocr,
                    !job.request_payload.ocr.disable_formula,
                    !job.request_payload.ocr.disable_table,
                    &job.request_payload.ocr.language,
                    &job.request_payload.ocr.page_ranges,
                    &job.request_payload.ocr.data_id,
                    job.request_payload.ocr.no_cache,
                    job.request_payload.ocr.cache_tolerance,
                    &extra_formats,
                )
                .await?;
            receipt_ocr_dispatch(
                deps,
                &cursor,
                &json!({
                    "kind": "mineru_task",
                    "task_id": created.task_id,
                    "trace_id": created.trace_id,
                }),
            )?;
            created
        }
        OcrDispatchDecision::Resume { receipt } => MineruCreatedTask {
            task_id: receipt_string(&receipt, "task_id")?,
            trace_id: receipt_optional_string(&receipt, "trace_id"),
        },
    };
    record_provider_trace(job, created.trace_id.clone());
    ocr_provider_diagnostics_mut(job).handle.task_id = Some(created.task_id.clone());
    job.append_log(&format!("task_id: {}", created.task_id));
    job.stage = Some("mineru_processing".to_string());
    job.stage_detail = Some("远程 PDF 已提交到 OCR provider，等待解析".to_string());
    job.updated_at = now_iso();
    save_ocr_job(deps, job, parent_job_id).await?;
    poll_remote_task_until_ready(
        deps,
        job,
        client,
        &created.task_id,
        provider_result_json_path,
        parent_job_id,
    )
    .await
}
