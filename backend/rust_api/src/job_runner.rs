use std::io;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Instant;

use anyhow::{anyhow, Context, Result};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::{OwnedSemaphorePermit, TryAcquireError};
use tokio::time::{sleep, timeout, Duration};
use tracing::{error, info};

use crate::job_events::{persist_job, record_custom_job_event};
use crate::models::{now_iso, JobArtifacts, JobStatusKind, ProcessResult, StoredJob};
use crate::ocr_provider::{parse_provider_kind, provider_capabilities, OcrProviderDiagnostics};
use crate::AppState;

mod commands;
mod ocr_flow;
mod stdout_parser;

pub(crate) use commands::{
    build_command, build_normalize_ocr_command, build_ocr_command, build_translate_from_ocr_command,
};
use ocr_flow::{execute_ocr_job, sync_parent_with_ocr_child};
use stdout_parser::{apply_line, attach_provider_failure};

const QUEUE_POLL_INTERVAL_MS: u64 = 250;
const OUTPUT_SOURCE_DIR_NAME: &str = "source";
const OUTPUT_OCR_DIR_NAME: &str = "ocr";
const OUTPUT_TRANSLATED_DIR_NAME: &str = "translated";
const OUTPUT_RENDERED_DIR_NAME: &str = "rendered";
const OUTPUT_ARTIFACTS_DIR_NAME: &str = "artifacts";
const OUTPUT_LOGS_DIR_NAME: &str = "logs";
const MINERU_RESULT_FILE_NAME: &str = "mineru_result.json";
const MINERU_BUNDLE_FILE_NAME: &str = "mineru_bundle.zip";
const MINERU_UNPACK_DIR_NAME: &str = "unpacked";
const MINERU_LAYOUT_JSON_FILE_NAME: &str = "layout.json";

#[derive(Clone, Debug)]
pub(crate) struct JobPaths {
    pub root: PathBuf,
    pub source_dir: PathBuf,
    pub ocr_dir: PathBuf,
    pub translated_dir: PathBuf,
    pub rendered_dir: PathBuf,
    pub artifacts_dir: PathBuf,
    pub logs_dir: PathBuf,
}

impl JobPaths {
    pub(crate) fn for_job(output_root: &Path, job_id: &str) -> Self {
        let root = output_root.join(job_id);
        Self {
            source_dir: root.join(OUTPUT_SOURCE_DIR_NAME),
            ocr_dir: root.join(OUTPUT_OCR_DIR_NAME),
            translated_dir: root.join(OUTPUT_TRANSLATED_DIR_NAME),
            rendered_dir: root.join(OUTPUT_RENDERED_DIR_NAME),
            artifacts_dir: root.join(OUTPUT_ARTIFACTS_DIR_NAME),
            logs_dir: root.join(OUTPUT_LOGS_DIR_NAME),
            root,
        }
    }

    pub(crate) fn create_all(&self) -> Result<()> {
        for path in [
            &self.root,
            &self.source_dir,
            &self.ocr_dir,
            &self.translated_dir,
            &self.rendered_dir,
            &self.artifacts_dir,
            &self.logs_dir,
        ] {
            std::fs::create_dir_all(path)?;
        }
        Ok(())
    }
}

pub(crate) fn build_job_paths(state: &AppState, job_id: &str) -> Result<JobPaths> {
    let job_paths = JobPaths::for_job(&state.config.output_root, job_id);
    job_paths.create_all()?;
    Ok(job_paths)
}

pub(crate) fn attach_job_paths(job: &mut StoredJob, job_paths: &JobPaths) {
    ensure_artifacts(job).job_root = Some(job_paths.root.to_string_lossy().to_string());
}

pub(crate) fn format_error_chain(err: &anyhow::Error) -> String {
    let causes: Vec<String> = err
        .chain()
        .map(|cause| cause.to_string().trim().to_string())
        .filter(|cause| !cause.is_empty())
        .collect();
    if causes.is_empty() {
        return "unknown error".to_string();
    }
    if causes.len() == 1 {
        return causes[0].clone();
    }
    let mut message = causes[0].clone();
    message.push_str("\nCaused by:");
    for cause in causes.iter().skip(1) {
        message.push_str("\n- ");
        message.push_str(cause);
    }
    message
}

pub(crate) fn append_error_chain_log(job: &mut StoredJob, err: &anyhow::Error) {
    for (idx, cause) in err.chain().enumerate() {
        let text = cause.to_string().trim().to_string();
        if text.is_empty() {
            continue;
        }
        if idx == 0 {
            job.append_log(&format!("ERROR: {text}"));
        } else {
            job.append_log(&format!("CAUSE[{idx}]: {text}"));
        }
    }
}

pub fn spawn_job(state: AppState, job_id: String) {
    tokio::spawn(async move {
        if let Err(err) = run_job(state.clone(), job_id.clone()).await {
            error!("job {} failed to run: {}", job_id, err);
            if let Ok(mut job) = state.db.get_job(&job_id) {
                if matches!(job.status, JobStatusKind::Canceled) {
                    clear_cancel_request(&state, &job_id).await;
                    return;
                }
                let detail = format_error_chain(&err);
                append_error_chain_log(&mut job, &err);
                job.status = JobStatusKind::Failed;
                job.stage = Some("failed".to_string());
                job.stage_detail = Some(detail.clone());
                job.error = Some(detail);
                job.updated_at = now_iso();
                job.finished_at = Some(now_iso());
                let _ = persist_job(&state, &job);
            }
            clear_cancel_request(&state, &job_id).await;
        }
    });
}

async fn run_job(state: AppState, job_id: String) -> Result<()> {
    let mut job = state.db.get_job(&job_id)?;
    if is_cancel_requested(&state, &job_id).await || matches!(job.status, JobStatusKind::Canceled) {
        clear_cancel_request(&state, &job_id).await;
        return Ok(());
    }
    job.status = JobStatusKind::Queued;
    job.stage = Some("queued".to_string());
    job.stage_detail = Some("任务排队中，等待可用执行槽位".to_string());
    job.updated_at = now_iso();
    persist_job(&state, &job)?;

    let _permit = match wait_for_execution_slot(&state, &job_id).await? {
        Some(permit) => permit,
        None => return Ok(()),
    };

    let job = state.db.get_job(&job_id)?;
    if is_cancel_requested(&state, &job_id).await || matches!(job.status, JobStatusKind::Canceled) {
        clear_cancel_request(&state, &job_id).await;
        return Ok(());
    }
    let finished_job = match job.workflow {
        crate::models::WorkflowKind::Ocr => execute_ocr_job(state.clone(), job, None, None).await?,
        crate::models::WorkflowKind::Mineru => {
            run_translation_job_with_ocr(state.clone(), job).await?
        }
    };
    persist_job(&state, &finished_job)?;
    clear_cancel_request(&state, &job_id).await;
    Ok(())
}

async fn run_translation_job_with_ocr(
    state: AppState,
    mut parent_job: StoredJob,
) -> Result<StoredJob> {
    let parent_job_paths = build_job_paths(&state, &parent_job.job_id)?;
    attach_job_paths(&mut parent_job, &parent_job_paths);
    let upload_id = parent_job
        .upload_id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| anyhow!("parent translation job is missing upload_id"))?;
    let upload = state.db.get_upload(&upload_id)?;
    let upload_path = Path::new(&upload.stored_path);
    if !upload_path.exists() {
        return Err(anyhow!("uploaded file missing: {}", upload.stored_path));
    }

    parent_job.status = JobStatusKind::Running;
    parent_job.started_at = Some(now_iso());
    parent_job.updated_at = now_iso();
    parent_job.stage = Some("ocr_submitting".to_string());
    parent_job.stage_detail = Some("正在启动 OCR 子任务".to_string());
    persist_job(&state, &parent_job)?;

    let ocr_job_id = format!("{}-ocr", parent_job.job_id);
    let mut ocr_request = parent_job.request_payload.clone();
    ocr_request.workflow = crate::models::WorkflowKind::Ocr;
    ocr_request.job_id = ocr_job_id.clone();
    ocr_request.upload_id = upload_id.clone();
    let mut ocr_child = StoredJob::new(
        ocr_job_id.clone(),
        ocr_request.clone(),
        build_ocr_command(&state, Some(upload_path), &ocr_request, &parent_job_paths),
    );
    attach_job_paths(&mut ocr_child, &parent_job_paths);
    if let Some(artifacts) = ocr_child.artifacts.as_mut() {
        artifacts.trace_id = Some(format!("ocr-{ocr_job_id}"));
        artifacts.schema_version = Some("document.v1".to_string());
    }
    ocr_child.stage = Some("queued".to_string());
    ocr_child.stage_detail = Some("OCR 子任务已创建".to_string());
    persist_job(&state, &ocr_child)?;

    if let Some(artifacts) = parent_job.artifacts.as_mut() {
        artifacts.ocr_job_id = Some(ocr_job_id.clone());
        artifacts.ocr_trace_id = Some(format!("ocr-{ocr_job_id}"));
        artifacts.ocr_status = Some(JobStatusKind::Queued);
    }
    persist_job(&state, &parent_job)?;
    record_custom_job_event(
        &state,
        &parent_job,
        "info",
        "ocr_child_created",
        "OCR 子任务已创建",
        Some(serde_json::json!({ "ocr_job_id": ocr_job_id })),
    );

    let ocr_finished = execute_ocr_job(
        state.clone(),
        ocr_child,
        Some(parent_job.job_id.clone()),
        Some(parent_job.job_id.clone()),
    )
    .await?;
    persist_job(&state, &ocr_finished)?;
    sync_parent_with_ocr_child(&mut parent_job, &ocr_finished);
    let ocr_finished_status = ocr_finished.status.clone();
    record_custom_job_event(
        &state,
        &parent_job,
        if matches!(ocr_finished_status, JobStatusKind::Failed) {
            "error"
        } else {
            "info"
        },
        "ocr_child_finished",
        format!("OCR 子任务结束，状态={:?}", ocr_finished_status),
        Some(serde_json::json!({
            "ocr_job_id": ocr_finished.job_id.clone(),
            "status": format!("{:?}", ocr_finished_status).to_ascii_lowercase(),
        })),
    );

    match ocr_finished_status {
        JobStatusKind::Succeeded => {}
        JobStatusKind::Canceled => {
            parent_job.status = JobStatusKind::Canceled;
            parent_job.stage = Some("canceled".to_string());
            parent_job.stage_detail = Some("OCR 子任务已取消".to_string());
            parent_job.finished_at = Some(now_iso());
            parent_job.updated_at = now_iso();
            return Ok(parent_job);
        }
        _ => {
            parent_job.status = JobStatusKind::Failed;
            parent_job.stage = Some("failed".to_string());
            parent_job.stage_detail = Some("OCR 子任务失败".to_string());
            parent_job.error = ocr_finished
                .error
                .clone()
                .or(ocr_finished.stage_detail.clone());
            parent_job.finished_at = Some(now_iso());
            parent_job.updated_at = now_iso();
            return Ok(parent_job);
        }
    }

    let normalized_path = parent_job
        .artifacts
        .as_ref()
        .and_then(|item| item.normalized_document_json.as_ref())
        .map(Path::new)
        .ok_or_else(|| anyhow!("OCR succeeded but normalized_document_json is missing"))?;
    let source_pdf_path = parent_job
        .artifacts
        .as_ref()
        .and_then(|item| item.source_pdf.as_ref())
        .map(Path::new)
        .ok_or_else(|| anyhow!("OCR succeeded but source_pdf is missing"))?;
    let layout_json_path = parent_job
        .artifacts
        .as_ref()
        .and_then(|item| item.layout_json.as_ref())
        .map(Path::new);

    parent_job.command = build_translate_from_ocr_command(
        &state,
        &parent_job.request_payload,
        &parent_job_paths,
        normalized_path,
        source_pdf_path,
        layout_json_path,
    );
    parent_job.stage = Some("translating".to_string());
    parent_job.stage_detail = Some("OCR 完成，开始翻译与渲染".to_string());
    parent_job.updated_at = now_iso();
    persist_job(&state, &parent_job)?;

    execute_process_job(state, parent_job, &[]).await
}

async fn execute_process_job(
    state: AppState,
    mut job: StoredJob,
    extra_cancel_job_ids: &[String],
) -> Result<StoredJob> {
    job.status = JobStatusKind::Running;
    if job.started_at.is_none() {
        job.started_at = Some(now_iso());
    }
    if job.stage.is_none() || matches!(job.stage.as_deref(), Some("queued")) {
        job.stage = Some("running".to_string());
        job.stage_detail = Some("正在启动 Python worker".to_string());
    }
    job.updated_at = now_iso();

    let mut command = Command::new(&job.command[0]);
    command
        .args(&job.command[1..])
        .env("RUST_API_DATA_ROOT", &state.config.data_root)
        .env("RUST_API_OUTPUT_ROOT", &state.config.output_root)
        .env("OUTPUT_ROOT", &state.config.output_root)
        .current_dir(&state.config.project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    unsafe {
        command.pre_exec(|| {
            if libc::setpgid(0, 0) != 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(())
        });
    }

    let program = job.command.first().cloned().unwrap_or_default();
    let mut child = command
        .spawn()
        .with_context(|| format!("failed to spawn python worker: {program}"))?;
    job.pid = child.id();
    persist_job(&state, &job)?;
    info!("started job {} pid={:?}", job.job_id, job.pid);

    if is_cancel_requested_any(&state, &job.job_id, extra_cancel_job_ids).await {
        if let Some(pid) = job.pid {
            terminate_job_process_tree(pid).await?;
        }
    }

    let stdout = child.stdout.take().context("missing stdout pipe")?;
    let stderr = child.stderr.take().context("missing stderr pipe")?;
    let child_pid = job.pid;
    let timeout_secs = job.request_payload.timeout_seconds;
    let stdout_handle = tokio::spawn(read_stdout(
        state.clone(),
        job,
        stdout,
        extra_cancel_job_ids.to_vec(),
    ));
    let stderr_handle = tokio::spawn(read_stream(stderr));
    let started = Instant::now();

    let status = if timeout_secs > 0 {
        match timeout(Duration::from_secs(timeout_secs as u64), child.wait()).await {
            Ok(result) => result?,
            Err(_) => {
                if let Some(pid) = child_pid {
                    let _ = terminate_job_process_tree(pid).await;
                }
                let mut timed_out_job = state.db.get_job(&stdout_handle.await??.1.job_id)?;
                let previous_stage = timed_out_job.stage.clone();
                timed_out_job.pid = None;
                timed_out_job.updated_at = now_iso();
                timed_out_job.finished_at = Some(now_iso());
                timed_out_job.status = JobStatusKind::Failed;
                timed_out_job.stage = Some("failed".to_string());
                let timeout_detail = match previous_stage.as_deref() {
                    Some("normalizing") => "normalization timeout".to_string(),
                    _ => "provider timeout".to_string(),
                };
                timed_out_job.stage_detail = Some(timeout_detail.clone());
                timed_out_job.error = Some(timeout_detail);
                persist_job(&state, &timed_out_job)?;
                return Ok(timed_out_job);
            }
        }
    } else {
        child.wait().await?
    };
    let stdout_job = stdout_handle.await??;
    let stderr_text = stderr_handle.await??;
    let stdout_text = stdout_job.0;
    let mut latest_job = stdout_job.1;
    latest_job.updated_at = now_iso();
    latest_job.finished_at = Some(now_iso());
    latest_job.pid = None;
    latest_job.result = Some(ProcessResult {
        success: status.success(),
        return_code: status.code().unwrap_or(-1),
        duration_seconds: started.elapsed().as_secs_f64(),
        command: latest_job.command.clone(),
        cwd: state.config.project_root.to_string_lossy().to_string(),
        stdout: stdout_text,
        stderr: stderr_text.clone(),
    });

    if is_cancel_requested_any(&state, &latest_job.job_id, extra_cancel_job_ids).await {
        latest_job.status = JobStatusKind::Canceled;
        latest_job.stage = Some("canceled".to_string());
        latest_job.stage_detail = Some("任务已取消".to_string());
        discard_canceled_ocr_artifacts(&mut latest_job);
    } else if status.success() {
        latest_job.status = JobStatusKind::Succeeded;
        latest_job.stage = Some("finished".to_string());
        latest_job.stage_detail = Some("任务完成".to_string());
    } else {
        attach_provider_failure(&mut latest_job, &stderr_text);
        latest_job.status = JobStatusKind::Failed;
        latest_job.stage = Some("failed".to_string());
        if latest_job
            .stage_detail
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .is_none()
        {
            latest_job.stage_detail = Some("Python worker 执行失败".to_string());
        }
        latest_job.error = Some(stderr_text);
    }
    Ok(latest_job)
}

async fn wait_for_execution_slot(
    state: &AppState,
    job_id: &str,
) -> Result<Option<OwnedSemaphorePermit>> {
    loop {
        if is_cancel_requested(state, job_id).await {
            clear_cancel_request(state, job_id).await;
            return Ok(None);
        }
        let current_job = state.db.get_job(job_id)?;
        if matches!(current_job.status, JobStatusKind::Canceled) {
            clear_cancel_request(state, job_id).await;
            return Ok(None);
        }
        match state.job_slots.clone().try_acquire_owned() {
            Ok(permit) => return Ok(Some(permit)),
            Err(TryAcquireError::NoPermits) => {
                sleep(Duration::from_millis(QUEUE_POLL_INTERVAL_MS)).await
            }
            Err(TryAcquireError::Closed) => return Err(anyhow!("job execution slots are closed")),
        }
    }
}

async fn read_stream<R>(reader: R) -> Result<String>
where
    R: tokio::io::AsyncRead + Unpin,
{
    let mut lines = BufReader::new(reader).lines();
    let mut out = String::new();
    while let Some(line) = lines.next_line().await? {
        out.push_str(&line);
        out.push('\n');
    }
    Ok(out)
}

async fn read_stdout(
    state: AppState,
    mut job: StoredJob,
    stdout: tokio::process::ChildStdout,
    extra_cancel_job_ids: Vec<String>,
) -> Result<(String, StoredJob)> {
    let mut out = String::new();
    let mut lines = BufReader::new(stdout).lines();
    while let Some(line) = lines.next_line().await? {
        if is_cancel_requested_any(&state, &job.job_id, &extra_cancel_job_ids).await
            && !should_continue_after_cancel(&job)
        {
            break;
        }
        out.push_str(&line);
        out.push('\n');
        apply_line(&mut job, &line);
        if is_cancel_requested_any(&state, &job.job_id, &extra_cancel_job_ids).await
            && !should_continue_after_cancel(&job)
        {
            break;
        }
        job.updated_at = now_iso();
        persist_job(&state, &job)?;
    }
    Ok((out, job))
}

pub async fn request_cancel(state: &AppState, job_id: &str) {
    let mut canceled_jobs = state.canceled_jobs.write().await;
    canceled_jobs.insert(job_id.to_string());
}

pub async fn clear_cancel_request(state: &AppState, job_id: &str) {
    let mut canceled_jobs = state.canceled_jobs.write().await;
    canceled_jobs.remove(job_id);
}

pub async fn is_cancel_requested(state: &AppState, job_id: &str) -> bool {
    let canceled_jobs = state.canceled_jobs.read().await;
    canceled_jobs.contains(job_id)
}

async fn is_cancel_requested_any(
    state: &AppState,
    job_id: &str,
    extra_cancel_job_ids: &[String],
) -> bool {
    if is_cancel_requested(state, job_id).await {
        return true;
    }
    let canceled_jobs = state.canceled_jobs.read().await;
    extra_cancel_job_ids
        .iter()
        .any(|value| canceled_jobs.contains(value))
}

pub async fn terminate_job_process_tree(pid: u32) -> Result<()> {
    let pgid = pid as i32;
    signal_process_group(pgid, libc::SIGTERM)?;
    for _ in 0..15 {
        if !process_group_exists(pgid) {
            return Ok(());
        }
        sleep(Duration::from_millis(200)).await;
    }
    signal_process_group(pgid, libc::SIGKILL)?;
    for _ in 0..10 {
        if !process_group_exists(pgid) {
            return Ok(());
        }
        sleep(Duration::from_millis(100)).await;
    }
    Ok(())
}

fn should_continue_after_cancel(job: &StoredJob) -> bool {
    matches!(job.stage.as_deref(), Some("normalizing"))
}

fn signal_process_group(pgid: i32, signal: i32) -> Result<()> {
    let rc = unsafe { libc::kill(-pgid, signal) };
    if rc == 0 {
        return Ok(());
    }
    let err = io::Error::last_os_error();
    if matches!(err.raw_os_error(), Some(libc::ESRCH)) {
        return Ok(());
    }
    Err(err.into())
}

fn process_group_exists(pgid: i32) -> bool {
    let rc = unsafe { libc::kill(-pgid, 0) };
    if rc == 0 {
        return true;
    }
    !matches!(io::Error::last_os_error().raw_os_error(), Some(libc::ESRCH))
}

fn ensure_artifacts(job: &mut StoredJob) -> &mut JobArtifacts {
    if job.artifacts.is_none() {
        job.artifacts = Some(JobArtifacts::default());
    }
    job.artifacts.as_mut().unwrap()
}

fn discard_canceled_ocr_artifacts(job: &mut StoredJob) {
    let artifacts = ensure_artifacts(job);
    artifacts.normalized_document_json = None;
    artifacts.normalization_report_json = None;
    artifacts.schema_version = None;
}

fn ensure_ocr_provider(job: &mut StoredJob) -> &mut OcrProviderDiagnostics {
    let provider_kind = parse_provider_kind(&job.request_payload.ocr_provider);
    let artifacts = ensure_artifacts(job);
    if artifacts.ocr_provider_diagnostics.is_none() {
        let mut diagnostics = OcrProviderDiagnostics::new(provider_kind.clone());
        diagnostics.capabilities = provider_capabilities(&provider_kind);
        artifacts.ocr_provider_diagnostics = Some(diagnostics);
    } else if artifacts
        .ocr_provider_diagnostics
        .as_ref()
        .map(|diag| diag.capabilities.is_none() || diag.provider != provider_kind)
        .unwrap_or(true)
    {
        let diagnostics = artifacts.ocr_provider_diagnostics.as_mut().unwrap();
        diagnostics.provider = provider_kind.clone();
        diagnostics.capabilities = provider_capabilities(&provider_kind);
    }
    artifacts.ocr_provider_diagnostics.as_mut().unwrap()
}
