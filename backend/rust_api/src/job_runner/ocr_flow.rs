use std::path::{Path, PathBuf};
use std::time::Instant;

use anyhow::{anyhow, Context, Result};
use serde_json::json;
use tokio::time::{sleep, Duration};

use crate::job_events::persist_job;
use crate::models::{now_iso, JobStatusKind, StoredJob};
use crate::ocr_provider::mineru::{
    client::MineruTrace, find_extract_result_in_batch, map_task_status, parse_extra_formats,
    MineruClient,
};
use crate::ocr_provider::paddle::{map_task_status as map_paddle_task_status, PaddleClient};
use crate::ocr_provider::{parse_provider_kind, OcrProviderKind, OcrTaskHandle, OcrTaskStatus};
use crate::AppState;

use super::{
    append_error_chain_log, attach_job_paths, attach_provider_failure, build_job_paths,
    build_normalize_ocr_command, discard_canceled_ocr_artifacts, ensure_artifacts,
    ensure_ocr_provider, execute_process_job, format_error_chain, is_cancel_requested,
    MINERU_BUNDLE_FILE_NAME, MINERU_LAYOUT_JSON_FILE_NAME, MINERU_RESULT_FILE_NAME,
    MINERU_UNPACK_DIR_NAME,
};

const MINERU_POLL_RETRY_LIMIT: usize = 5;
const MINERU_POLL_RETRY_BASE_DELAY_SECS: u64 = 2;

async fn save_ocr_job(
    state: &AppState,
    job: &StoredJob,
    parent_job_id: Option<&str>,
) -> Result<()> {
    persist_job(state, job)?;
    if let Some(parent_job_id) = parent_job_id {
        mirror_parent_ocr_status(state, parent_job_id, job).await?;
    }
    Ok(())
}

async fn mirror_parent_ocr_status(
    state: &AppState,
    parent_job_id: &str,
    ocr_job: &StoredJob,
) -> Result<()> {
    let mut parent_job = state.db.get_job(parent_job_id)?;
    if matches!(
        parent_job.status,
        JobStatusKind::Succeeded | JobStatusKind::Failed | JobStatusKind::Canceled
    ) {
        return Ok(());
    }
    let parent_artifacts = ensure_artifacts(&mut parent_job);
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
    persist_job(state, &parent_job)?;
    Ok(())
}

pub async fn execute_ocr_job(
    state: AppState,
    mut job: StoredJob,
    output_job_id_override: Option<String>,
    parent_job_id: Option<String>,
) -> Result<StoredJob> {
    let provider_kind = parse_provider_kind(&job.request_payload.ocr_provider);
    job.status = JobStatusKind::Running;
    if job.started_at.is_none() {
        job.started_at = Some(now_iso());
    }
    job.updated_at = now_iso();
    job.stage = Some("ocr_upload".to_string());
    job.stage_detail = Some("OCR provider transport 启动中".to_string());
    save_ocr_job(&state, &job, parent_job_id.as_deref()).await?;

    let output_job_id = output_job_id_override.unwrap_or_else(|| job.job_id.clone());
    let job_paths = build_job_paths(&state, &output_job_id)?;
    attach_job_paths(&mut job, &job_paths);
    let source_dir = job_paths.source_dir.clone();
    let ocr_dir = job_paths.ocr_dir.clone();
    let provider_result_json_path = match provider_kind {
        OcrProviderKind::Paddle => ocr_dir.join("paddle_result.json"),
        _ => ocr_dir.join(MINERU_RESULT_FILE_NAME),
    };
    let provider_zip_path = match provider_kind {
        OcrProviderKind::Paddle => ocr_dir.join("paddle_bundle.zip"),
        _ => ocr_dir.join(MINERU_BUNDLE_FILE_NAME),
    };
    let provider_raw_dir = match provider_kind {
        OcrProviderKind::Paddle => ocr_dir.join("paddle_raw"),
        _ => ocr_dir.join(MINERU_UNPACK_DIR_NAME),
    };
    let layout_json_path = match provider_kind {
        OcrProviderKind::Paddle => provider_result_json_path.clone(),
        _ => provider_raw_dir.join(MINERU_LAYOUT_JSON_FILE_NAME),
    };
    std::fs::create_dir_all(&source_dir)?;
    std::fs::create_dir_all(&ocr_dir)?;
    std::fs::create_dir_all(&provider_raw_dir)?;

    {
        let artifacts = ensure_artifacts(&mut job);
        artifacts.job_root = Some(job_paths.root.to_string_lossy().to_string());
        artifacts.provider_summary_json =
            Some(provider_result_json_path.to_string_lossy().to_string());
        artifacts.provider_zip = Some(provider_zip_path.to_string_lossy().to_string());
        artifacts.provider_raw_dir = Some(provider_raw_dir.to_string_lossy().to_string());
        artifacts.layout_json = Some(layout_json_path.to_string_lossy().to_string());
        artifacts.schema_version = Some("document.v1".to_string());
    }
    {
        let provider_artifacts = &mut ensure_ocr_provider(&mut job).artifacts;
        provider_artifacts.provider_result_json =
            Some(provider_result_json_path.to_string_lossy().to_string());
        provider_artifacts.provider_bundle_zip =
            Some(provider_zip_path.to_string_lossy().to_string());
        provider_artifacts.layout_json = Some(layout_json_path.to_string_lossy().to_string());
    }
    save_ocr_job(&state, &job, parent_job_id.as_deref()).await?;

    let transport_result: Result<PathBuf> = if let Some(upload_id) = job
        .upload_id
        .clone()
        .filter(|value| !value.trim().is_empty())
    {
        let upload = state.db.get_upload(&upload_id)?;
        let upload_path = PathBuf::from(&upload.stored_path);
        if !upload_path.exists() {
            return Err(anyhow!("uploaded file missing: {}", upload_path.display()));
        }
        let target_path = source_dir.join(&upload.filename);
        if upload_path != target_path {
            tokio::fs::copy(&upload_path, &target_path)
                .await
                .with_context(|| {
                    format!("failed to copy source pdf to {}", target_path.display())
                })?;
        }
        match provider_kind {
            OcrProviderKind::Mineru => {
                let client = MineruClient::new("", job.request_payload.mineru_token.clone());
                run_local_ocr_transport_mineru(
                    &state,
                    &mut job,
                    &client,
                    &upload_path,
                    &provider_result_json_path,
                    parent_job_id.as_deref(),
                )
                .await?;
            }
            OcrProviderKind::Paddle => {
                let client = PaddleClient::new(
                    job.request_payload.paddle_api_url.clone(),
                    job.request_payload.paddle_token.clone(),
                );
                run_local_ocr_transport_paddle(
                    &state,
                    &mut job,
                    &client,
                    &upload_path,
                    &provider_result_json_path,
                    parent_job_id.as_deref(),
                )
                .await?;
            }
            OcrProviderKind::Unknown => return Err(anyhow!("unsupported OCR provider")),
        }
        Ok(target_path)
    } else {
        match provider_kind {
            OcrProviderKind::Mineru => {
                let client = MineruClient::new("", job.request_payload.mineru_token.clone());
                run_remote_ocr_transport_mineru(
                    &state,
                    &mut job,
                    &client,
                    &provider_result_json_path,
                    parent_job_id.as_deref(),
                )
                .await?;
            }
            OcrProviderKind::Paddle => {
                let client = PaddleClient::new(
                    job.request_payload.paddle_api_url.clone(),
                    job.request_payload.paddle_token.clone(),
                );
                run_remote_ocr_transport_paddle(
                    &state,
                    &mut job,
                    &client,
                    &provider_result_json_path,
                    parent_job_id.as_deref(),
                )
                .await?;
            }
            OcrProviderKind::Unknown => return Err(anyhow!("unsupported OCR provider")),
        }
        if is_cancel_requested(&state, &job.job_id).await {
            Ok(PathBuf::new())
        } else {
            match provider_kind {
                OcrProviderKind::Mineru => {
                    ensure_source_pdf_from_bundle(&provider_raw_dir, &source_dir)
                }
                OcrProviderKind::Paddle => {
                    download_source_pdf(&job.request_payload.source_url, &source_dir).await
                }
                OcrProviderKind::Unknown => Err(anyhow!("unsupported OCR provider")),
            }
        }
    };
    let source_pdf_path = match transport_result {
        Ok(path) => path,
        Err(err) => {
            let message = format_error_chain(&err);
            append_error_chain_log(&mut job, &err);
            attach_provider_failure(&mut job, &message);
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
            return Ok(job);
        }
    };

    if is_cancel_requested(&state, &job.job_id).await {
        job.status = JobStatusKind::Canceled;
        job.stage = Some("canceled".to_string());
        job.stage_detail = Some("OCR 任务已取消".to_string());
        job.updated_at = now_iso();
        job.finished_at = Some(now_iso());
        discard_canceled_ocr_artifacts(&mut job);
        save_ocr_job(&state, &job, parent_job_id.as_deref()).await?;
        return Ok(job);
    }

    let source_pdf_string = source_pdf_path.to_string_lossy().to_string();
    ensure_artifacts(&mut job).source_pdf = Some(source_pdf_string);

    job.command = build_normalize_ocr_command(
        &state,
        &job.request_payload,
        &job_paths,
        &layout_json_path,
        &source_pdf_path,
        &provider_result_json_path,
        &provider_zip_path,
        &provider_raw_dir,
    );
    job.stage = Some("normalizing".to_string());
    job.stage_detail = Some("OCR provider 已完成，开始标准化 document.v1".to_string());
    job.updated_at = now_iso();
    save_ocr_job(&state, &job, parent_job_id.as_deref()).await?;

    execute_process_job(state, job, &[]).await
}

async fn run_local_ocr_transport_mineru(
    state: &AppState,
    job: &mut StoredJob,
    client: &MineruClient,
    upload_path: &Path,
    provider_result_json_path: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let upload_file_name = upload_path
        .file_name()
        .and_then(|item| item.to_str())
        .ok_or_else(|| anyhow!("invalid upload filename"))?;
    let upload_target = apply_mineru_upload_url_with_retry(
        state,
        job,
        client,
        upload_file_name,
        started_poll_timeout_window(job.request_payload.poll_timeout),
        std::cmp::max(job.request_payload.poll_timeout, 1) as u64,
        parent_job_id,
    )
    .await?;
    record_provider_trace(job, upload_target.trace_id.clone());
    {
        let diagnostics = ensure_ocr_provider(job);
        diagnostics.handle.batch_id = Some(upload_target.batch_id.clone());
        diagnostics.handle.file_name = upload_path
            .file_name()
            .and_then(|item| item.to_str())
            .map(|item| item.to_string());
    }
    job.append_log(&format!("batch_id: {}", upload_target.batch_id));
    job.stage = Some("mineru_upload".to_string());
    job.stage_detail = Some("已获取 MinerU 上传地址，开始上传文件".to_string());
    job.updated_at = now_iso();
    save_ocr_job(state, job, parent_job_id.as_deref()).await?;

    client
        .upload_file(&upload_target.upload_url, upload_path)
        .await
        .with_context(|| format!("failed to upload file {}", upload_path.display()))?;
    job.append_log(&format!("upload done: {}", upload_path.display()));
    job.stage = Some("mineru_processing".to_string());
    job.stage_detail = Some("文件上传完成，等待 MinerU 解析".to_string());
    job.updated_at = now_iso();
    save_ocr_job(state, job, parent_job_id.as_deref()).await?;

    let poll_interval = std::cmp::max(job.request_payload.poll_interval, 1) as u64;
    let timeout_secs = std::cmp::max(job.request_payload.poll_timeout, 1) as u64;
    let started = Instant::now();
    let file_name = upload_path
        .file_name()
        .and_then(|item| item.to_str())
        .ok_or_else(|| anyhow!("invalid upload filename"))?
        .to_string();

    loop {
        if is_cancel_requested(state, &job.job_id).await {
            return Ok(());
        }
        let Some(batch) = query_mineru_batch_status_with_retry(
            state,
            job,
            client,
            &upload_target.batch_id,
            started,
            timeout_secs,
            parent_job_id,
        )
        .await?
        else {
            if started.elapsed().as_secs() > timeout_secs {
                return Err(anyhow!(
                    "Timed out waiting for MinerU batch result: {}",
                    upload_target.batch_id
                ));
            }
            sleep(Duration::from_secs(poll_interval)).await;
            continue;
        };
        record_provider_trace(job, batch.trace_id.clone());
        let item: crate::ocr_provider::mineru::models::MineruBatchResultItem =
            match find_extract_result_in_batch(&batch.data, &file_name) {
                Some(item) => item.clone(),
                None => {
                    job.append_log(&format!(
                        "batch {}: waiting for extract_result",
                        upload_target.batch_id
                    ));
                    job.updated_at = now_iso();
                    save_ocr_job(state, job, parent_job_id.as_deref()).await?;
                    if started.elapsed().as_secs() > timeout_secs {
                        return Err(anyhow!(
                            "Timed out waiting for MinerU batch result: {}",
                            upload_target.batch_id
                        ));
                    }
                    sleep(Duration::from_secs(poll_interval)).await;
                    continue;
                }
            };

        job.append_log(&format!(
            "batch {}: state={}",
            upload_target.batch_id, item.state
        ));
        update_ocr_job_from_status(
            state,
            job,
            map_task_status(
                &item.state,
                OcrTaskHandle {
                    batch_id: Some(upload_target.batch_id.clone()),
                    task_id: None,
                    file_name: Some(file_name.clone()),
                },
                Some(item.err_msg.clone()),
                batch.trace_id.clone(),
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
            let result = serde_json::json!({
                "code": 0,
                "data": item,
                "msg": "ok",
                "trace_id": batch.trace_id.clone().unwrap_or_default(),
            });
            persist_provider_result(job, provider_result_json_path, &result).await?;
            return download_and_unpack_after_success(
                state,
                job,
                client,
                result["data"]["full_zip_url"].as_str().unwrap_or_default(),
                parent_job_id,
            )
            .await;
        }
        if item.state == "failed" {
            return Err(anyhow!(
                "MinerU batch task failed: {}",
                item.err_msg.trim().to_string()
            ));
        }
        if started.elapsed().as_secs() > timeout_secs {
            return Err(anyhow!(
                "Timed out waiting for MinerU batch result: {}",
                upload_target.batch_id
            ));
        }
        sleep(Duration::from_secs(poll_interval)).await;
    }
}

async fn apply_mineru_upload_url_with_retry(
    state: &AppState,
    job: &mut StoredJob,
    client: &MineruClient,
    file_name: &str,
    started: Instant,
    timeout_secs: u64,
    parent_job_id: Option<&str>,
) -> Result<crate::ocr_provider::mineru::client::MineruUploadTarget> {
    let mut attempt = 0usize;
    loop {
        match client
            .apply_upload_url(
                file_name,
                &job.request_payload.model_version,
                &job.request_payload.data_id,
            )
            .await
        {
            Ok(target) => return Ok(target),
            Err(err) => {
                attempt += 1;
                if !should_retry_mineru_poll_error(&err) || started.elapsed().as_secs() >= timeout_secs {
                    return Err(err);
                }
                if attempt >= MINERU_POLL_RETRY_LIMIT {
                    return Err(err);
                }
                let delay_secs = std::cmp::min(
                    MINERU_POLL_RETRY_BASE_DELAY_SECS * attempt as u64,
                    10,
                );
                job.append_log(&format!(
                    "MinerU apply upload url retry {attempt}/{MINERU_POLL_RETRY_LIMIT}: {file_name} after error: {}",
                    err
                ));
                job.stage = Some("ocr_upload".to_string());
                job.stage_detail = Some(format!(
                    "MinerU 上传地址申请异常，{delay_secs}s 后重试（第 {attempt}/{MINERU_POLL_RETRY_LIMIT} 次）"
                ));
                job.updated_at = now_iso();
                save_ocr_job(state, job, parent_job_id).await?;
                sleep(Duration::from_secs(delay_secs)).await;
            }
        }
    }
}

fn started_poll_timeout_window(poll_timeout: i64) -> Instant {
    let _ = poll_timeout;
    Instant::now()
}

async fn run_remote_ocr_transport_mineru(
    state: &AppState,
    job: &mut StoredJob,
    client: &MineruClient,
    provider_result_json_path: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let created = client
        .create_extract_task(
            &job.request_payload.source_url,
            &job.request_payload.model_version,
            job.request_payload.is_ocr,
            !job.request_payload.disable_formula,
            !job.request_payload.disable_table,
            &job.request_payload.language,
            &job.request_payload.page_ranges,
            &job.request_payload.data_id,
            job.request_payload.no_cache,
            job.request_payload.cache_tolerance,
            &parse_extra_formats(&job.request_payload.extra_formats),
        )
        .await?;
    record_provider_trace(job, created.trace_id.clone());
    ensure_ocr_provider(job).handle.task_id = Some(created.task_id.clone());
    job.append_log(&format!("task_id: {}", created.task_id));
    job.stage = Some("mineru_processing".to_string());
    job.stage_detail = Some("远程 PDF 已提交到 MinerU，等待解析".to_string());
    job.updated_at = now_iso();
    save_ocr_job(state, job, parent_job_id.as_deref()).await?;

    let poll_interval = std::cmp::max(job.request_payload.poll_interval, 1) as u64;
    let timeout_secs = std::cmp::max(job.request_payload.poll_timeout, 1) as u64;
    let started = Instant::now();

    loop {
        if is_cancel_requested(state, &job.job_id).await {
            return Ok(());
        }
        let Some(task) = query_mineru_task_with_retry(
            state,
            job,
            client,
            &created.task_id,
            started,
            timeout_secs,
            parent_job_id,
        )
        .await?
        else {
            if started.elapsed().as_secs() > timeout_secs {
                return Err(anyhow!(
                    "Timed out waiting for MinerU task {}",
                    created.task_id
                ));
            }
            sleep(Duration::from_secs(poll_interval)).await;
            continue;
        };
        record_provider_trace(job, task.trace_id.clone());
        let item = task.data;
        job.append_log(&format!("task {}: state={}", created.task_id, item.state));
        update_ocr_job_from_status(
            state,
            job,
            map_task_status(
                &item.state,
                OcrTaskHandle {
                    batch_id: None,
                    task_id: Some(created.task_id.clone()),
                    file_name: None,
                },
                Some(item.err_msg.clone()),
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
            let result = serde_json::json!({
                "code": 0,
                "data": item,
                "msg": "ok",
                "trace_id": task.trace_id.clone().unwrap_or_default(),
            });
            persist_provider_result(job, provider_result_json_path, &result).await?;
            return download_and_unpack_after_success(
                state,
                job,
                client,
                result["data"]["full_zip_url"].as_str().unwrap_or_default(),
                parent_job_id,
            )
            .await;
        }
        if item.state == "failed" {
            return Err(anyhow!(
                "MinerU task failed: {}",
                item.err_msg.trim().to_string()
            ));
        }
        if started.elapsed().as_secs() > timeout_secs {
            return Err(anyhow!(
                "Timed out waiting for MinerU task {}",
                created.task_id
            ));
        }
        sleep(Duration::from_secs(poll_interval)).await;
    }
}

async fn query_mineru_batch_status_with_retry(
    state: &AppState,
    job: &mut StoredJob,
    client: &MineruClient,
    batch_id: &str,
    started: Instant,
    timeout_secs: u64,
    parent_job_id: Option<&str>,
) -> Result<Option<MineruTrace<crate::ocr_provider::mineru::models::MineruBatchStatusData>>> {
    let mut attempt = 0usize;
    loop {
        match client.query_batch_status(batch_id).await {
            Ok(batch) => return Ok(Some(batch)),
            Err(err) => {
                attempt += 1;
                if !should_retry_mineru_poll_error(&err) || started.elapsed().as_secs() >= timeout_secs {
                    return Err(err);
                }
                if attempt >= MINERU_POLL_RETRY_LIMIT {
                    job.append_log(&format!(
                        "MinerU batch poll degraded after {attempt} retries, keep waiting next cycle: {batch_id} error: {}",
                        err
                    ));
                    job.stage = Some("mineru_processing".to_string());
                    job.stage_detail = Some("MinerU 状态查询连续异常，稍后自动继续拉取".to_string());
                    job.updated_at = now_iso();
                    save_ocr_job(state, job, parent_job_id).await?;
                    return Ok(None);
                }
                let delay_secs = std::cmp::min(
                    MINERU_POLL_RETRY_BASE_DELAY_SECS * attempt as u64,
                    10,
                );
                job.append_log(&format!(
                    "MinerU batch poll retry {attempt}/{MINERU_POLL_RETRY_LIMIT}: {batch_id} after error: {}",
                    err
                ));
                job.stage = Some("mineru_processing".to_string());
                job.stage_detail = Some(format!(
                    "MinerU 状态查询异常，{delay_secs}s 后重试（第 {attempt}/{MINERU_POLL_RETRY_LIMIT} 次）"
                ));
                job.updated_at = now_iso();
                save_ocr_job(state, job, parent_job_id).await?;
                sleep(Duration::from_secs(delay_secs)).await;
            }
        }
    }
}

async fn query_mineru_task_with_retry(
    state: &AppState,
    job: &mut StoredJob,
    client: &MineruClient,
    task_id: &str,
    started: Instant,
    timeout_secs: u64,
    parent_job_id: Option<&str>,
) -> Result<Option<MineruTrace<crate::ocr_provider::mineru::models::MineruTaskData>>> {
    let mut attempt = 0usize;
    loop {
        match client.query_task(task_id).await {
            Ok(task) => return Ok(Some(task)),
            Err(err) => {
                attempt += 1;
                if !should_retry_mineru_poll_error(&err) || started.elapsed().as_secs() >= timeout_secs {
                    return Err(err);
                }
                if attempt >= MINERU_POLL_RETRY_LIMIT {
                    job.append_log(&format!(
                        "MinerU task poll degraded after {attempt} retries, keep waiting next cycle: {task_id} error: {}",
                        err
                    ));
                    job.stage = Some("mineru_processing".to_string());
                    job.stage_detail = Some("MinerU 状态查询连续异常，稍后自动继续拉取".to_string());
                    job.updated_at = now_iso();
                    save_ocr_job(state, job, parent_job_id).await?;
                    return Ok(None);
                }
                let delay_secs = std::cmp::min(
                    MINERU_POLL_RETRY_BASE_DELAY_SECS * attempt as u64,
                    10,
                );
                job.append_log(&format!(
                    "MinerU task poll retry {attempt}/{MINERU_POLL_RETRY_LIMIT}: {task_id} after error: {}",
                    err
                ));
                job.stage = Some("mineru_processing".to_string());
                job.stage_detail = Some(format!(
                    "MinerU 状态查询异常，{delay_secs}s 后重试（第 {attempt}/{MINERU_POLL_RETRY_LIMIT} 次）"
                ));
                job.updated_at = now_iso();
                save_ocr_job(state, job, parent_job_id).await?;
                sleep(Duration::from_secs(delay_secs)).await;
            }
        }
    }
}

fn should_retry_mineru_poll_error(err: &anyhow::Error) -> bool {
    let text = err.to_string().to_ascii_lowercase();
    text.contains("timed out")
        || text.contains("connection timed out")
        || text.contains("server disconnected")
        || text.contains("connection reset")
        || text.contains("connection error")
        || text.contains("sendrequest")
        || text.contains("tempor")
        || text.contains("service unavailable")
        || text.contains("502")
        || text.contains("503")
        || text.contains("504")
}

async fn run_local_ocr_transport_paddle(
    state: &AppState,
    job: &mut StoredJob,
    client: &PaddleClient,
    upload_path: &Path,
    provider_result_json_path: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let created = client
        .submit_local_file(
            upload_path,
            &job.request_payload.paddle_model,
            &build_paddle_optional_payload(&job.request_payload.paddle_model),
        )
        .await?;
    run_paddle_poll_loop(
        state,
        job,
        client,
        created.data,
        created.trace_id,
        provider_result_json_path,
        parent_job_id,
    )
    .await
}

async fn run_remote_ocr_transport_paddle(
    state: &AppState,
    job: &mut StoredJob,
    client: &PaddleClient,
    provider_result_json_path: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let created = client
        .submit_remote_url(
            &job.request_payload.source_url,
            &job.request_payload.paddle_model,
            &build_paddle_optional_payload(&job.request_payload.paddle_model),
        )
        .await?;
    run_paddle_poll_loop(
        state,
        job,
        client,
        created.data,
        created.trace_id,
        provider_result_json_path,
        parent_job_id,
    )
    .await
}

async fn run_paddle_poll_loop(
    state: &AppState,
    job: &mut StoredJob,
    client: &PaddleClient,
    job_id: String,
    trace_id: Option<String>,
    provider_result_json_path: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    record_provider_trace(job, trace_id);
    ensure_ocr_provider(job).handle.task_id = Some(job_id.clone());
    job.append_log(&format!("task_id: {}", job_id));
    job.stage = Some("ocr_processing".to_string());
    job.stage_detail = Some("Paddle 任务已提交，等待解析".to_string());
    job.updated_at = now_iso();
    save_ocr_job(state, job, parent_job_id.as_deref()).await?;

    let poll_interval = std::cmp::max(job.request_payload.poll_interval, 1) as u64;
    let timeout_secs = std::cmp::max(job.request_payload.poll_timeout, 1) as u64;
    let started = Instant::now();

    loop {
        if is_cancel_requested(state, &job.job_id).await {
            return Ok(());
        }
        let task = client.query_job(&job_id).await?;
        record_provider_trace(job, task.trace_id.clone());
        let item = task.data;
        job.append_log(&format!("paddle task {}: state={}", job_id, item.state));
        update_ocr_job_from_status(
            state,
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
                .ok_or_else(|| anyhow!("Paddle task finished but resultUrl.jsonUrl is missing"))?;
            let result = client.download_jsonl_result(&jsonl_url).await?;
            ensure_ocr_provider(job).artifacts.full_zip_url = Some(jsonl_url.clone());
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
            return Ok(());
        }
        if item.state == "failed" {
            return Err(anyhow!(
                "Paddle task failed: {}",
                item.error_msg.trim().to_string()
            ));
        }
        if started.elapsed().as_secs() > timeout_secs {
            return Err(anyhow!("Timed out waiting for Paddle task {}", job_id));
        }
        sleep(Duration::from_secs(poll_interval)).await;
    }
}

async fn persist_provider_result(
    job: &mut StoredJob,
    provider_result_json_path: &Path,
    result: &serde_json::Value,
) -> Result<()> {
    if let Some(parent) = provider_result_json_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(
        provider_result_json_path,
        serde_json::to_vec_pretty(result).context("failed to serialize provider result")?,
    )
    .await
    .with_context(|| format!("failed to write {}", provider_result_json_path.display()))?;
    ensure_artifacts(job).provider_summary_json =
        Some(provider_result_json_path.to_string_lossy().to_string());
    ensure_ocr_provider(job).artifacts.provider_result_json =
        Some(provider_result_json_path.to_string_lossy().to_string());
    Ok(())
}

async fn download_and_unpack_after_success(
    state: &AppState,
    job: &mut StoredJob,
    client: &MineruClient,
    full_zip_url: &str,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let artifacts = ensure_artifacts(job);
    let provider_zip = artifacts
        .provider_zip
        .clone()
        .ok_or_else(|| anyhow!("provider_zip path missing"))?;
    let provider_raw_dir = artifacts
        .provider_raw_dir
        .clone()
        .ok_or_else(|| anyhow!("provider_raw_dir path missing"))?;
    ensure_ocr_provider(job).artifacts.full_zip_url = Some(full_zip_url.to_string());
    job.stage = Some("translation_prepare".to_string());
    job.stage_detail = Some("MinerU 结果已就绪，正在下载原始 bundle".to_string());
    job.updated_at = now_iso();
    save_ocr_job(state, job, parent_job_id.as_deref()).await?;
    download_mineru_bundle_with_retry(
        state,
        job,
        client,
        full_zip_url,
        Path::new(&provider_zip),
        std::cmp::max(job.request_payload.poll_timeout, 1) as u64,
        parent_job_id,
    )
    .await?;
    client.unpack_zip(Path::new(&provider_zip), Path::new(&provider_raw_dir))?;
    Ok(())
}

async fn download_mineru_bundle_with_retry(
    state: &AppState,
    job: &mut StoredJob,
    client: &MineruClient,
    full_zip_url: &str,
    dest_path: &Path,
    timeout_secs: u64,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let started = Instant::now();
    let mut attempt = 0usize;
    loop {
        match client.download_bundle(full_zip_url, dest_path).await {
            Ok(()) => return Ok(()),
            Err(err) => {
                attempt += 1;
                if !should_retry_mineru_poll_error(&err)
                    || started.elapsed().as_secs() >= timeout_secs
                    || attempt >= MINERU_POLL_RETRY_LIMIT
                {
                    return Err(err);
                }
                let delay_secs =
                    std::cmp::min(MINERU_POLL_RETRY_BASE_DELAY_SECS * attempt as u64, 10);
                job.append_log(&format!(
                    "MinerU download bundle retry {attempt}/{MINERU_POLL_RETRY_LIMIT}: {full_zip_url} after error: {}",
                    err
                ));
                job.stage = Some("translation_prepare".to_string());
                job.stage_detail = Some(format!(
                    "MinerU bundle 下载异常，{delay_secs}s 后重试（第 {attempt}/{MINERU_POLL_RETRY_LIMIT} 次）"
                ));
                job.updated_at = now_iso();
                save_ocr_job(state, job, parent_job_id).await?;
                sleep(Duration::from_secs(delay_secs)).await;
            }
        }
    }
}

async fn update_ocr_job_from_status(
    state: &AppState,
    job: &mut StoredJob,
    status: OcrTaskStatus,
    current: Option<i64>,
    total: Option<i64>,
    parent_job_id: Option<&str>,
) -> Result<()> {
    ensure_ocr_provider(job).last_status = Some(status.clone());
    if let Some(stage) = status.stage.clone() {
        job.stage = Some(stage);
    }
    job.stage_detail = status.detail.clone().or(status.provider_message.clone());
    job.progress_current = current;
    job.progress_total = total;
    record_provider_trace(job, status.trace_id.clone());
    job.updated_at = now_iso();
    save_ocr_job(state, job, parent_job_id).await?;
    Ok(())
}

fn record_provider_trace(job: &mut StoredJob, trace_id: Option<String>) {
    if let Some(trace_id) = trace_id.filter(|item| !item.trim().is_empty()) {
        ensure_artifacts(job).provider_trace_id = Some(trace_id);
    }
}

fn build_paddle_optional_payload(model: &str) -> serde_json::Value {
    let normalized = model.trim().to_ascii_lowercase();
    if normalized.contains("pp-structurev3") {
        return json!({
            "markdownIgnoreLabels": [
                "header",
                "header_image",
                "footer",
                "footer_image",
                "number",
                "footnote",
                "aside_text"
            ],
            "useChartRecognition": false,
            "useRegionDetection": true,
            "useDocOrientationClassify": false,
            "useDocUnwarping": false,
            "useTextlineOrientation": false,
            "useSealRecognition": true,
            "useFormulaRecognition": true,
            "useTableRecognition": true,
            "layoutThreshold": 0.5,
            "layoutNms": true,
            "layoutUnclipRatio": 1,
            "textDetLimitType": "min",
            "textDetLimitSideLen": 64,
            "textDetThresh": 0.3,
            "textDetBoxThresh": 0.6,
            "textDetUnclipRatio": 1.5,
            "textRecScoreThresh": 0,
            "sealDetLimitType": "min",
            "sealDetLimitSideLen": 736,
            "sealDetThresh": 0.2,
            "sealDetBoxThresh": 0.6,
            "sealDetUnclipRatio": 0.5,
            "sealRecScoreThresh": 0,
            "useTableOrientationClassify": true,
            "useOcrResultsWithTableCells": true,
            "useE2eWiredTableRecModel": false,
            "useE2eWirelessTableRecModel": false,
            "useWiredTableCellsTransToHtml": false,
            "useWirelessTableCellsTransToHtml": false,
            "parseLanguage": "default",
            "visualize": false
        });
    }

    json!({
        "mergeLayoutBlocks": false,
        "markdownIgnoreLabels": [
            "header",
            "header_image",
            "footer",
            "footer_image",
            "number",
            "footnote",
            "aside_text"
        ],
        "useDocOrientationClassify": false,
        "useDocUnwarping": false,
        "useLayoutDetection": true,
        "useChartRecognition": false,
        "useSealRecognition": true,
        "useOcrForImageBlock": false,
        "mergeTables": true,
        "relevelTitles": true,
        "layoutShapeMode": "auto",
        "promptLabel": "ocr",
        "repetitionPenalty": 1,
        "temperature": 0,
        "topP": 1,
        "minPixels": 147384,
        "maxPixels": 2822400,
        "layoutNms": true,
        "restructurePages": true,
        "visualize": false
    })
}

fn ensure_source_pdf_from_bundle(provider_raw_dir: &Path, source_dir: &Path) -> Result<PathBuf> {
    let mut origin_pdf = None;
    for entry in std::fs::read_dir(provider_raw_dir)
        .with_context(|| format!("failed to read {}", provider_raw_dir.display()))?
    {
        let entry = entry?;
        let path = entry.path();
        if path
            .file_name()
            .and_then(|item| item.to_str())
            .map(|name| name.ends_with("_origin.pdf"))
            .unwrap_or(false)
        {
            origin_pdf = Some(path);
            break;
        }
    }
    let origin_pdf = origin_pdf.ok_or_else(|| {
        anyhow!(
            "MinerU unpacked bundle does not contain *_origin.pdf in {}",
            provider_raw_dir.display()
        )
    })?;
    let target_path = source_dir.join(
        origin_pdf
            .file_name()
            .ok_or_else(|| anyhow!("invalid origin pdf filename"))?,
    );
    std::fs::create_dir_all(source_dir)?;
    std::fs::copy(&origin_pdf, &target_path).with_context(|| {
        format!(
            "failed to copy source pdf from {} to {}",
            origin_pdf.display(),
            target_path.display()
        )
    })?;
    Ok(target_path)
}

async fn download_source_pdf(source_url: &str, source_dir: &Path) -> Result<PathBuf> {
    let response = reqwest::get(source_url)
        .await
        .with_context(|| format!("failed to download source pdf from {source_url}"))?
        .error_for_status()
        .with_context(|| format!("source pdf download returned error status: {source_url}"))?;
    let file_name = source_url
        .rsplit('/')
        .next()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("source.pdf");
    let target_path = source_dir.join(file_name);
    let bytes = response
        .bytes()
        .await
        .with_context(|| format!("failed to read source pdf bytes from {source_url}"))?;
    tokio::fs::create_dir_all(source_dir).await?;
    tokio::fs::write(&target_path, &bytes)
        .await
        .with_context(|| format!("failed to write source pdf to {}", target_path.display()))?;
    Ok(target_path)
}

pub fn sync_parent_with_ocr_child(parent_job: &mut StoredJob, ocr_finished: &StoredJob) {
    let parent_artifacts = ensure_artifacts(parent_job);
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
