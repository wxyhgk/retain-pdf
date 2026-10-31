use anyhow::Result;
use serde_json::json;
use std::path::Path;
use std::time::Duration;
use tokio::sync::watch;

use crate::models::domain::{now_iso, JobRuntimeState};
use crate::ocr_provider::paddle::{
    map_task_status as map_paddle_task_status, normalize_model_name, PaddleClient,
    PaddleProviderError, PaddleTrace,
};
use crate::ocr_provider::OcrTaskHandle;

use super::artifacts::persist_provider_result;
use super::dispatch_journal::{
    begin_ocr_dispatch, mark_submit_outcome_unknown, receipt_ocr_dispatch, receipt_optional_string,
    receipt_string, settle_failed_submit, OcrDispatchDecision,
};
use super::paddle_errors::attach_paddle_runtime_error;
use super::paddle_markdown::{materialize_paddle_markdown_artifacts, ImageProgress};
use super::paddle_payload::build_paddle_optional_payload;
use super::polling::{
    near_done_poll_interval, should_stop_polling, wait_next_poll_or_timeout_for,
};
use super::status::{record_provider_trace, update_ocr_job_from_status};
use super::transfer_watch::{
    format_megabytes, upload_detail, watch_transfer, with_elapsed, Watched,
    TRANSFER_PROGRESS_INTERVAL,
};
use crate::job_runner::{ocr_provider_diagnostics_mut, ProcessRuntimeDeps};

use super::save_ocr_job;

/// 插图进度的刷新间隔（节流）：16 张图并发下载只要一两秒，没必要每张都写一次库。
const IMAGE_PROGRESS_INTERVAL: Duration = Duration::from_secs(1);

pub(super) async fn run_local_ocr_transport_paddle(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &PaddleClient,
    upload_path: &Path,
    provider_result_json_path: &Path,
    job_root: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    log_paddle_unsupported_options(job);
    let model_name = normalize_model_name(&job.request_payload.ocr.paddle_model);
    job.request_payload.ocr.paddle_model = model_name.clone();
    let optional_payload =
        build_paddle_optional_payload(&model_name, deps.paddle_runtime().max_input_images);
    let request_identity = json!({
        "source_kind": "local_upload",
        "upload_id": job.request_payload.source.upload_id,
        "file_name": upload_path.file_name().and_then(|value| value.to_str()),
        "model": model_name,
        "optional_payload": optional_payload,
    });
    let created =
        match begin_ocr_dispatch(deps, job, "paddle", "submit_local_file", &request_identity)? {
            OcrDispatchDecision::Send { cursor } => {
                let file_bytes = tokio::fs::metadata(upload_path)
                    .await
                    .ok()
                    .map(|meta| meta.len());
                let detail = upload_detail("Paddle", file_bytes);
                job.stage = Some("ocr_upload".to_string());
                job.stage_detail = Some(detail.clone());
                job.updated_at = now_iso();
                save_ocr_job(deps, job, parent_job_id).await?;
                let submitted = watch_transfer(
                    deps,
                    job,
                    parent_job_id,
                    client.submit_local_file(upload_path, &model_name, &optional_payload),
                    TRANSFER_PROGRESS_INTERVAL,
                    |elapsed| Some(with_elapsed(&detail, elapsed)),
                )
                .await
                .map_err(|err| settle_failed_submit(deps, &cursor, err))?;
                let created = match submitted {
                    Watched::Finished(result) => result.map_err(|err| {
                        settle_failed_submit(deps, &cursor, attach_paddle_runtime_error(job, err, "submit"))
                    })?,
                    Watched::Canceled => {
                        // 上传 future 已被丢弃、连接已断。不写回执：Paddle 可能已经收下
                        // 了文件，这次提交的结果本来就说不清，把 intent 标成 ambiguous。
                        // 终态由 mod.rs 的取消检查点写。
                        if let Err(error) = mark_submit_outcome_unknown(
                            deps,
                            &cursor,
                            "OCR upload was canceled mid-flight; the provider may have accepted the file",
                        ) {
                            tracing::warn!(
                                "mark canceled OCR upload of job {} ambiguous failed: {error:#}",
                                job.job_id
                            );
                        }
                        job.append_log("paddle upload interrupted by cancel request");
                        return Ok(());
                    }
                };
                receipt_ocr_dispatch(
                    deps,
                    &cursor,
                    &json!({
                        "kind": "paddle_task",
                        "task_id": created.data,
                        "trace_id": created.trace_id,
                    }),
                )?;
                created
            }
            OcrDispatchDecision::Resume { receipt } => PaddleTrace {
                data: receipt_string(&receipt, "task_id")?,
                trace_id: receipt_optional_string(&receipt, "trace_id"),
            },
        };
    run_paddle_poll_loop(
        deps,
        job,
        client,
        created.data,
        created.trace_id,
        provider_result_json_path,
        job_root,
        parent_job_id,
    )
    .await
}

pub(super) async fn run_remote_ocr_transport_paddle(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &PaddleClient,
    provider_result_json_path: &Path,
    job_root: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    log_paddle_unsupported_options(job);
    let model_name = normalize_model_name(&job.request_payload.ocr.paddle_model);
    job.request_payload.ocr.paddle_model = model_name.clone();
    let optional_payload =
        build_paddle_optional_payload(&model_name, deps.paddle_runtime().max_input_images);
    let request_identity = json!({
        "source_kind": "remote_url",
        "source_url": job.request_payload.source.source_url,
        "model": model_name,
        "optional_payload": optional_payload,
    });
    let created =
        match begin_ocr_dispatch(deps, job, "paddle", "submit_remote_url", &request_identity)? {
            OcrDispatchDecision::Send { cursor } => {
                let created = client
                    .submit_remote_url(
                        &job.request_payload.source.source_url,
                        &model_name,
                        &optional_payload,
                    )
                    .await
                    .map_err(|err| {
                        settle_failed_submit(deps, &cursor, attach_paddle_runtime_error(job, err, "submit"))
                    })?;
                receipt_ocr_dispatch(
                    deps,
                    &cursor,
                    &json!({
                        "kind": "paddle_task",
                        "task_id": created.data,
                        "trace_id": created.trace_id,
                    }),
                )?;
                created
            }
            OcrDispatchDecision::Resume { receipt } => PaddleTrace {
                data: receipt_string(&receipt, "task_id")?,
                trace_id: receipt_optional_string(&receipt, "trace_id"),
            },
        };
    run_paddle_poll_loop(
        deps,
        job,
        client,
        created.data,
        created.trace_id,
        provider_result_json_path,
        job_root,
        parent_job_id,
    )
    .await
}

async fn run_paddle_poll_loop(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &PaddleClient,
    job_id: String,
    trace_id: Option<String>,
    provider_result_json_path: &Path,
    job_root: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    record_provider_trace(job, trace_id);
    ocr_provider_diagnostics_mut(job).handle.task_id = Some(job_id.clone());
    job.append_log(&format!("task_id: {}", job_id));
    job.stage = Some("ocr_processing".to_string());
    job.stage_detail = Some("Paddle 任务已提交，等待解析".to_string());
    job.updated_at = now_iso();
    save_ocr_job(deps, job, parent_job_id).await?;

    let poll_interval = std::cmp::max(job.request_payload.ocr.poll_interval, 1) as u64;
    let timeout_secs = std::cmp::max(job.request_payload.ocr.poll_timeout, 1) as u64;

    let started = std::time::Instant::now();
    loop {
        if should_stop_polling(deps, &job.job_id, parent_job_id).await {
            return Ok(());
        }
        let task = client
            .query_job(&job_id)
            .await
            .map_err(|err| attach_paddle_runtime_error(job, err, "poll"))?;
        record_provider_trace(job, task.trace_id.clone());
        let item = task.data;
        job.append_log(&format!("paddle task {}: state={}", job_id, item.state));
        update_ocr_job_from_status(
            deps,
            job,
            map_paddle_task_status(
                &item.state,
                OcrTaskHandle {
                    batch_id: None,
                    task_id: Some(job_id.clone()),
                    file_name: None,
                },
                Some(item.error_msg.clone()),
                task.trace_id.clone(),
            ),
            item.extract_progress
                .as_ref()
                .and_then(|progress| progress.extracted_pages),
            item.extract_progress
                .as_ref()
                .and_then(|progress| progress.total_pages),
            parent_job_id,
        )
        .await?;

        if item.state == "done" {
            let jsonl_url = item
                .result_url
                .as_ref()
                .map(|v| v.json_url.trim().to_string())
                .filter(|v| !v.is_empty())
                .ok_or_else(|| {
                    anyhow::Error::new(PaddleProviderError::invalid_response(
                        "poll",
                        "Paddle task finished but resultUrl.jsonUrl is missing",
                        task.trace_id.as_deref(),
                    ))
                })
                .map_err(|err| attach_paddle_runtime_error(job, err, "poll"))?;
            let download = client
                .open_jsonl_result(&jsonl_url)
                .await
                .map_err(|err| attach_paddle_runtime_error(job, err, "download"))?;
            // 结果正文（样本 1.8 MB）要下十几秒，之前这段时间界面一直停在「结果已就绪」。
            let detail = match download.content_length() {
                Some(bytes) => format!("正在下载 Paddle 识别结果（{}）", format_megabytes(bytes)),
                None => "正在下载 Paddle 识别结果".to_string(),
            };
            job.stage_detail = Some(detail.clone());
            job.updated_at = now_iso();
            save_ocr_job(deps, job, parent_job_id).await?;
            let result = match watch_transfer(
                deps,
                job,
                parent_job_id,
                download.into_payload(),
                TRANSFER_PROGRESS_INTERVAL,
                |elapsed| Some(with_elapsed(&detail, elapsed)),
            )
            .await?
            {
                Watched::Finished(result) => {
                    result.map_err(|err| attach_paddle_runtime_error(job, err, "download"))?
                }
                Watched::Canceled => return Ok(()),
            };
            ocr_provider_diagnostics_mut(job).artifacts.full_zip_url = Some(jsonl_url.clone());
            let mut payload = result.payload;
            if let Some(meta) = payload.get_mut("_meta").and_then(|v| v.as_object_mut()) {
                meta.insert("provider".to_string(), json!("paddle"));
                meta.insert("taskId".to_string(), json!(job_id));
                meta.insert("jsonlUrl".to_string(), json!(jsonl_url));
                meta.insert(
                    "traceId".to_string(),
                    json!(task.trace_id.clone().unwrap_or_default()),
                );
            }
            persist_provider_result(job, provider_result_json_path, &payload).await?;
            let (image_progress, image_progress_rx) = watch::channel(ImageProgress::default());
            let mut last_reported = ImageProgress::default();
            let materialized = watch_transfer(
                deps,
                job,
                parent_job_id,
                materialize_paddle_markdown_artifacts(
                    &payload,
                    job_root,
                    client.http_client(),
                    &image_progress,
                ),
                IMAGE_PROGRESS_INTERVAL,
                |_| {
                    let current = *image_progress_rx.borrow();
                    if current.total == 0 || current == last_reported {
                        return None;
                    }
                    last_reported = current;
                    Some(format!("正在下载插图 {}/{}", current.done, current.total))
                },
            )
            .await?;
            match materialized {
                Watched::Finished(result) => {
                    if let Some(markdown_path) = result? {
                        job.append_log(&format!(
                            "published markdown: {}",
                            markdown_path.display()
                        ));
                    }
                }
                Watched::Canceled => return Ok(()),
            }
            return Ok(());
        }
        if item.state == "failed" {
            let err = anyhow::Error::new(PaddleProviderError::provider_failed(
                item.error_msg.trim(),
                task.trace_id.as_deref(),
            ));
            return Err(attach_paddle_runtime_error(job, err, "poll"));
        }
        let interval = near_done_poll_interval(
            poll_interval,
            item.extract_progress
                .as_ref()
                .and_then(|progress| progress.extracted_pages),
            item.extract_progress
                .as_ref()
                .and_then(|progress| progress.total_pages),
        );
        wait_next_poll_or_timeout_for(started, timeout_secs, interval, || {
            format!("Timed out waiting for Paddle task {}", job_id)
        })
        .await
        .map_err(|_err| {
            let err = anyhow::Error::new(PaddleProviderError::poll_timeout(&job_id));
            attach_paddle_runtime_error(job, err, "poll")
        })?;
    }
}

fn log_paddle_unsupported_options(job: &mut JobRuntimeState) {
    if job.request_payload.ocr.disable_formula {
        job.append_log("paddle provider note: disable_formula is not supported by rust_api transport and will be ignored");
    }
    if job.request_payload.ocr.disable_table {
        job.append_log("paddle provider note: disable_table is not supported by rust_api transport and will be ignored");
    }
    if !job.request_payload.ocr.extra_formats.trim().is_empty() {
        job.append_log("paddle provider note: extra_formats is not supported and will be ignored");
    }
}
