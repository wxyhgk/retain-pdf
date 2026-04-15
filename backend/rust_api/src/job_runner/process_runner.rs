#[cfg(unix)]
use std::io;
use std::path::Path;
use std::process::Stdio;
use std::time::Instant;

#[cfg(windows)]
use anyhow::anyhow;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::time::{sleep, timeout, Duration};
use tracing::info;

use crate::job_events::{
    persist_job_with_resources, persist_runtime_job, persist_runtime_job_with_resources,
    record_custom_runtime_event_with_resources,
};
#[cfg(test)]
use crate::models::JobArtifacts;
use crate::models::{now_iso, JobAiDiagnostic, JobRuntimeState, JobStatusKind, ProcessResult};
use crate::storage_paths::resolve_data_path;
use crate::AppState;

use super::lifecycle::is_cancel_requested_any;
use super::runtime_state::apply_job_stdout_line;
use super::{
    attach_job_provider_failure, clear_canceled_runtime_artifacts, clear_job_failure,
    refresh_job_failure, sync_runtime_state,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ProcessCompletionKind {
    Canceled,
    Succeeded,
    SucceededWithShutdownNoise,
    Failed,
}

#[derive(Debug, Serialize)]
struct FailureAiDiagnosisRequest<'a> {
    job_id: &'a str,
    workflow: &'a crate::models::WorkflowKind,
    status: &'a JobStatusKind,
    stage: Option<&'a str>,
    stage_detail: Option<&'a str>,
    failure: &'a crate::models::JobFailureInfo,
    error: Option<&'a str>,
    log_tail: &'a [String],
    request_payload: &'a crate::models::ResolvedJobSpec,
    runtime: Option<&'a crate::models::JobRuntimeInfo>,
    ocr_provider_diagnostics: Option<&'a crate::ocr_provider::OcrProviderDiagnostics>,
}

#[derive(Debug, Deserialize)]
struct FailureAiDiagnosisResponse {
    status: Option<String>,
    summary: Option<String>,
    root_cause: Option<String>,
    suggestion: Option<String>,
    confidence: Option<String>,
    observed_signals: Option<Vec<String>>,
}

pub(crate) async fn execute_process_job(
    state: AppState,
    mut job: JobRuntimeState,
    extra_cancel_job_ids: &[String],
) -> Result<JobRuntimeState> {
    job.status = JobStatusKind::Running;
    if job.started_at.is_none() {
        job.started_at = Some(now_iso());
    }
    if job.stage.is_none() || matches!(job.stage.as_deref(), Some("queued")) {
        job.stage = Some("running".to_string());
        job.stage_detail = Some("正在启动 Python worker".to_string());
    }
    job.updated_at = now_iso();
    sync_runtime_state(&mut job);

    let mut command = Command::new(&job.command[0]);
    command
        .args(&job.command[1..])
        .env("RUST_API_DATA_ROOT", &state.config.data_root)
        .env("RUST_API_OUTPUT_ROOT", &state.config.output_root)
        .env("OUTPUT_ROOT", &state.config.output_root)
        .env("PYTHONUNBUFFERED", "1")
        .current_dir(&state.config.project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if !job.request_payload.translation.api_key.trim().is_empty() {
        command.env(
            "RETAIN_TRANSLATION_API_KEY",
            job.request_payload.translation.api_key.trim(),
        );
    }
    if !job.request_payload.ocr.mineru_token.trim().is_empty() {
        command.env(
            "RETAIN_MINERU_API_TOKEN",
            job.request_payload.ocr.mineru_token.trim(),
        );
    }
    configure_child_process(&mut command);

    let program = job.command.first().cloned().unwrap_or_default();
    let mut child = command
        .spawn()
        .with_context(|| format!("failed to spawn python worker: {program}"))?;
    job.pid = child.id();
    persist_runtime_job(&state, &job)?;
    info!("started job {} pid={:?}", job.job_id, job.pid);

    if is_cancel_requested_any(&state, &job.job_id, extra_cancel_job_ids).await {
        if let Some(pid) = job.pid {
            terminate_job_process_tree(pid).await?;
        }
    }

    let stdout = child.stdout.take().context("missing stdout pipe")?;
    let stderr = child.stderr.take().context("missing stderr pipe")?;
    let child_pid = job.pid;
    let timeout_secs = job.request_payload.runtime.timeout_seconds;
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
                apply_timeout_failure(&mut timed_out_job, now_iso());
                persist_job_with_resources(
                    state.db.as_ref(),
                    &state.config.data_root,
                    &state.config.output_root,
                    &timed_out_job,
                )?;
                return Ok(timed_out_job.into_runtime());
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

    let completion = classify_process_completion(
        is_cancel_requested_any(&state, &latest_job.job_id, extra_cancel_job_ids).await,
        status.success(),
        should_treat_shutdown_noise_as_success(&latest_job, &stderr_text),
    );
    apply_process_completion(&mut latest_job, completion, &stderr_text);
    maybe_attach_ai_failure_diagnosis(
        state.db.as_ref(),
        state.config.as_ref(),
        &mut latest_job,
    )
    .await;
    Ok(latest_job)
}

fn timeout_detail_for_stage(stage: Option<&str>) -> &'static str {
    match stage {
        Some("normalizing") => "normalization timeout",
        _ => "provider timeout",
    }
}

fn apply_timeout_failure(job: &mut crate::models::JobSnapshot, timestamp: String) {
    let timeout_detail = timeout_detail_for_stage(job.stage.as_deref()).to_string();
    job.pid = None;
    job.updated_at = timestamp.clone();
    job.finished_at = Some(timestamp);
    job.status = JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.stage_detail = Some(timeout_detail.clone());
    job.error = Some(timeout_detail);
    job.sync_runtime_state();
    job.replace_failure_info(crate::job_failure::classify_job_failure(job));
}

fn classify_process_completion(
    canceled: bool,
    process_success: bool,
    shutdown_noise_success: bool,
) -> ProcessCompletionKind {
    if canceled {
        ProcessCompletionKind::Canceled
    } else if process_success {
        ProcessCompletionKind::Succeeded
    } else if shutdown_noise_success {
        ProcessCompletionKind::SucceededWithShutdownNoise
    } else {
        ProcessCompletionKind::Failed
    }
}

fn apply_process_completion(
    job: &mut JobRuntimeState,
    completion: ProcessCompletionKind,
    stderr_text: &str,
) {
    match completion {
        ProcessCompletionKind::Canceled => {
            job.status = JobStatusKind::Canceled;
            job.stage = Some("canceled".to_string());
            job.stage_detail = Some("任务已取消".to_string());
            clear_canceled_runtime_artifacts(job);
            clear_job_failure(job);
        }
        ProcessCompletionKind::Succeeded => {
            job.status = JobStatusKind::Succeeded;
            job.stage = Some("finished".to_string());
            job.stage_detail = Some("任务完成".to_string());
            clear_job_failure(job);
        }
        ProcessCompletionKind::SucceededWithShutdownNoise => {
            job.status = JobStatusKind::Succeeded;
            job.stage = Some("finished".to_string());
            job.stage_detail = Some("任务完成（已忽略 Python 退出阶段的收尾噪音）".to_string());
            job.error = None;
            clear_job_failure(job);
            job.append_log(
                "INFO: ignored Python shutdown noise after artifacts were already written successfully",
            );
        }
        ProcessCompletionKind::Failed => {
            attach_job_provider_failure(job, stderr_text);
            job.status = JobStatusKind::Failed;
            job.stage = Some("failed".to_string());
            if job
                .stage_detail
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .is_none()
            {
                job.stage_detail = Some("Python worker 执行失败".to_string());
            }
            job.error = Some(stderr_text.to_string());
            refresh_job_failure(job);
        }
    }
    sync_runtime_state(job);
}

fn should_treat_shutdown_noise_as_success(job: &JobRuntimeState, stderr_text: &str) -> bool {
    let stderr = stderr_text.trim();
    if stderr.is_empty() {
        return false;
    }
    let is_shutdown_noise = is_shutdown_noise(stderr);
    if !is_shutdown_noise {
        return false;
    }
    let Some(artifacts) = job.artifacts.as_ref() else {
        return false;
    };
    let output_pdf_ready = artifacts
        .output_pdf
        .as_deref()
        .map(Path::new)
        .is_some_and(Path::exists);
    let translations_ready = artifacts
        .translations_dir
        .as_deref()
        .map(Path::new)
        .is_some_and(Path::exists);
    let summary_ready = artifacts
        .summary
        .as_deref()
        .map(Path::new)
        .is_some_and(Path::exists);
    match job.workflow {
        crate::models::WorkflowKind::Translate => translations_ready && summary_ready,
        _ => output_pdf_ready && summary_ready,
    }
}

async fn maybe_attach_ai_failure_diagnosis(
    db: &crate::db::Db,
    config: &crate::config::AppConfig,
    job: &mut JobRuntimeState,
) {
    let Some(failure_snapshot) = job.failure.clone() else {
        return;
    };
    if failure_snapshot.category != "unknown" || failure_snapshot.ai_diagnostic.is_some() {
        return;
    }
    let script_path = &config.run_failure_ai_diagnosis_script;
    if !script_path.exists() {
        return;
    }

    let job_root = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.job_root.as_ref())
        .and_then(|job_root| resolve_data_path(&config.data_root, job_root).ok())
        .unwrap_or_else(|| config.output_root.join(&job.job_id));
    let logs_dir = job_root.join("logs");
    let request_path = logs_dir.join("failure-ai-diagnosis.request.json");
    let response_path = logs_dir.join("failure-ai-diagnosis.response.json");
    if std::fs::create_dir_all(&logs_dir).is_err() {
        return;
    }

    let request_payload = FailureAiDiagnosisRequest {
        job_id: &job.job_id,
        workflow: &job.workflow,
        status: &job.status,
        stage: job.stage.as_deref(),
        stage_detail: job.stage_detail.as_deref(),
        failure: &failure_snapshot,
        error: job.error.as_deref(),
        log_tail: &job.log_tail,
        request_payload: &job.request_payload,
        runtime: job.runtime.as_ref(),
        ocr_provider_diagnostics: job
            .artifacts
            .as_ref()
            .and_then(|artifacts| artifacts.ocr_provider_diagnostics.as_ref()),
    };

    let request_json = match serde_json::to_string_pretty(&request_payload) {
        Ok(value) => value,
        Err(_) => return,
    };
    if std::fs::write(&request_path, request_json).is_err() {
        return;
    }

    let mut command = Command::new(&config.python_bin);
    command
        .arg("-u")
        .arg(script_path)
        .arg("--input-json")
        .arg(&request_path)
        .arg("--api-key")
        .arg(&job.request_payload.translation.api_key)
        .arg("--model")
        .arg(&job.request_payload.translation.model)
        .arg("--base-url")
        .arg(&job.request_payload.translation.base_url)
        .env("RUST_API_DATA_ROOT", &config.data_root)
        .env("RUST_API_OUTPUT_ROOT", &config.output_root)
        .env("OUTPUT_ROOT", &config.output_root)
        .env("PYTHONUNBUFFERED", "1")
        .current_dir(&config.project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let output = match timeout(Duration::from_secs(60), command.output()).await {
        Ok(Ok(value)) => value,
        _ => return,
    };

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let response_record = json!({
        "status_code": output.status.code(),
        "stdout": stdout,
        "stderr": stderr,
    });
    let _ = std::fs::write(
        &response_path,
        serde_json::to_string_pretty(&response_record).unwrap_or_default(),
    );

    if !output.status.success() || stdout.is_empty() {
        return;
    }

    let Ok(response) = serde_json::from_str::<FailureAiDiagnosisResponse>(&stdout) else {
        return;
    };
    if response.status.as_deref() != Some("ok") {
        return;
    }
    let summary = response.summary.unwrap_or_default().trim().to_string();
    if summary.is_empty() {
        return;
    }
    let ai_diagnostic = JobAiDiagnostic {
        summary: summary.clone(),
        root_cause: response.root_cause.filter(|value| !value.trim().is_empty()),
        suggestion: response.suggestion.filter(|value| !value.trim().is_empty()),
        confidence: response.confidence.filter(|value| !value.trim().is_empty()),
        observed_signals: response.observed_signals.unwrap_or_default(),
    };
    if let Some(failure) = job.failure.as_mut() {
        failure.ai_diagnostic = Some(ai_diagnostic.clone());
    }
    job.updated_at = now_iso();
    let event_payload = json!({
        "category": failure_snapshot.category,
        "summary": failure_snapshot.summary,
        "ai_diagnostic": ai_diagnostic,
    });
    record_custom_runtime_event_with_resources(
        db,
        &config.data_root,
        &config.output_root,
        &job.snapshot(),
        "info",
        "failure_ai_diagnosed",
        "AI 辅助诊断已生成",
        Some(event_payload),
    );
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
    mut job: JobRuntimeState,
    stdout: tokio::process::ChildStdout,
    extra_cancel_job_ids: Vec<String>,
) -> Result<(String, JobRuntimeState)> {
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
        apply_job_stdout_line(&mut job, &line);
        if is_cancel_requested_any(&state, &job.job_id, &extra_cancel_job_ids).await
            && !should_continue_after_cancel(&job)
        {
            break;
        }
        job.updated_at = now_iso();
        persist_runtime_job_with_resources(
            state.db.as_ref(),
            &state.config.data_root,
            &state.config.output_root,
            &job,
        )?;
    }
    Ok((out, job))
}

fn should_continue_after_cancel(job: &JobRuntimeState) -> bool {
    matches!(job.stage.as_deref(), Some("normalizing"))
}

fn is_shutdown_noise(stderr: &str) -> bool {
    stderr.contains("Exception ignored in")
        || stderr.contains("sys.unraisablehook")
        || stderr.contains("Exception ignored in sys.unraisablehook")
}

#[cfg(unix)]
fn configure_child_process(command: &mut Command) {
    unsafe {
        command.pre_exec(|| {
            if libc::setpgid(0, 0) != 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(())
        });
    }
}

#[cfg(windows)]
fn configure_child_process(_command: &mut Command) {}

pub async fn terminate_job_process_tree(pid: u32) -> Result<()> {
    #[cfg(windows)]
    {
        let status = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await
            .context("failed to invoke taskkill")?;
        if status.success() {
            return Ok(());
        }
        return Err(anyhow!("taskkill failed for pid {pid}"));
    }

    #[cfg(unix)]
    {
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
}

#[cfg(unix)]
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

#[cfg(unix)]
fn process_group_exists(pgid: i32) -> bool {
    let rc = unsafe { libc::kill(-pgid, 0) };
    if rc == 0 {
        return true;
    }
    !matches!(io::Error::last_os_error().raw_os_error(), Some(libc::ESRCH))
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::fs;
    use std::sync::Arc;

    use super::*;
    use crate::config::AppConfig;
    use crate::db::Db;
    use crate::models::CreateJobInput;
    use crate::AppState;
    use tokio::sync::{Mutex, RwLock, Semaphore};

    fn build_job() -> JobRuntimeState {
        crate::models::JobSnapshot::new(
            "job-test".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        )
        .into_runtime()
    }

    fn test_state(test_name: &str) -> AppState {
        let root = std::env::temp_dir().join(format!(
            "rust-api-process-runner-{test_name}-{}-{}",
            std::process::id(),
            now_iso().replace([':', '.'], "-")
        ));
        let data_root = root.join("data");
        let output_root = data_root.join("jobs");
        let downloads_dir = data_root.join("downloads");
        let uploads_dir = data_root.join("uploads");
        let db_dir = data_root.join("db");
        let rust_api_root = root.join("rust_api");
        let scripts_dir = root.join("scripts");
        fs::create_dir_all(&output_root).expect("create output root");
        fs::create_dir_all(&downloads_dir).expect("create downloads dir");
        fs::create_dir_all(&uploads_dir).expect("create uploads dir");
        fs::create_dir_all(&db_dir).expect("create db dir");
        fs::create_dir_all(&rust_api_root).expect("create rust_api root");
        fs::create_dir_all(&scripts_dir).expect("create scripts dir");

        let config = Arc::new(AppConfig {
            project_root: root.clone(),
            rust_api_root,
            data_root: data_root.clone(),
            scripts_dir: scripts_dir.clone(),
            run_mineru_case_script: scripts_dir.join("run_mineru_case.py"),
            run_ocr_job_script: scripts_dir.join("run_ocr_job.py"),
            run_normalize_ocr_script: scripts_dir.join("run_normalize_ocr.py"),
            run_translate_from_ocr_script: scripts_dir.join("run_translate_from_ocr.py"),
            run_translate_only_script: scripts_dir.join("run_translate_only.py"),
            run_render_only_script: scripts_dir.join("run_render_only.py"),
            run_failure_ai_diagnosis_script: scripts_dir.join("diagnose_failure_with_ai.py"),
            uploads_dir,
            downloads_dir,
            jobs_db_path: data_root.join("db").join("jobs.db"),
            output_root,
            python_bin: "python3".to_string(),
            bind_host: "127.0.0.1".to_string(),
            port: 41000,
            simple_port: 41001,
            upload_max_bytes: 0,
            upload_max_pages: 0,
            api_keys: HashSet::new(),
            max_running_jobs: 1,
        });

        let db = Arc::new(Db::new(
            config.jobs_db_path.clone(),
            config.data_root.clone(),
        ));
        db.init().expect("init db");

        AppState {
            config,
            db,
            downloads_lock: Arc::new(Mutex::new(())),
            canceled_jobs: Arc::new(RwLock::new(HashSet::new())),
            job_slots: Arc::new(Semaphore::new(1)),
        }
    }

    #[test]
    fn should_continue_after_cancel_only_for_normalizing_stage() {
        let mut job = build_job();
        job.stage = Some("normalizing".to_string());
        assert!(should_continue_after_cancel(&job));

        job.stage = Some("translating".to_string());
        assert!(!should_continue_after_cancel(&job));
    }

    #[test]
    fn shutdown_noise_requires_known_patterns() {
        assert!(is_shutdown_noise("Exception ignored in sys.unraisablehook"));
        assert!(is_shutdown_noise("Exception ignored in"));
        assert!(!is_shutdown_noise("normal stderr"));
    }

    #[test]
    fn shutdown_noise_success_requires_written_artifacts() {
        let mut job = build_job();
        job.artifacts = Some(JobArtifacts {
            output_pdf: Some("/definitely/missing.pdf".to_string()),
            summary: Some("/definitely/missing.json".to_string()),
            ..JobArtifacts::default()
        });
        assert!(!should_treat_shutdown_noise_as_success(
            &job,
            "Exception ignored in sys.unraisablehook"
        ));
    }

    #[test]
    fn timeout_detail_distinguishes_normalizing_stage() {
        assert_eq!(
            timeout_detail_for_stage(Some("normalizing")),
            "normalization timeout"
        );
        assert_eq!(
            timeout_detail_for_stage(Some("translating")),
            "provider timeout"
        );
        assert_eq!(timeout_detail_for_stage(None), "provider timeout");
    }

    #[test]
    fn classify_process_completion_prefers_cancel_then_success_then_noise() {
        assert_eq!(
            classify_process_completion(true, true, true),
            ProcessCompletionKind::Canceled
        );
        assert_eq!(
            classify_process_completion(false, true, true),
            ProcessCompletionKind::Succeeded
        );
        assert_eq!(
            classify_process_completion(false, false, true),
            ProcessCompletionKind::SucceededWithShutdownNoise
        );
        assert_eq!(
            classify_process_completion(false, false, false),
            ProcessCompletionKind::Failed
        );
    }

    #[test]
    fn apply_timeout_failure_marks_job_failed() {
        let mut job = crate::models::JobSnapshot::new(
            "job-test".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.stage = Some("normalizing".to_string());
        apply_timeout_failure(&mut job, "2026-04-04T00:00:00Z".to_string());
        assert_eq!(job.status, JobStatusKind::Failed);
        assert_eq!(job.stage.as_deref(), Some("failed"));
        assert_eq!(job.stage_detail.as_deref(), Some("normalization timeout"));
        assert_eq!(job.error.as_deref(), Some("normalization timeout"));
    }

    #[test]
    fn apply_process_completion_marks_cancel_and_clears_runtime_artifacts() {
        let mut job = build_job();
        job.artifacts = Some(JobArtifacts {
            normalized_document_json: Some("/tmp/doc.json".to_string()),
            normalization_report_json: Some("/tmp/doc.report.json".to_string()),
            schema_version: Some("document.v1".to_string()),
            ..JobArtifacts::default()
        });
        apply_process_completion(&mut job, ProcessCompletionKind::Canceled, "");
        assert_eq!(job.status, JobStatusKind::Canceled);
        assert_eq!(job.stage.as_deref(), Some("canceled"));
        let artifacts = job.artifacts.as_ref().unwrap();
        assert!(artifacts.normalized_document_json.is_none());
        assert!(artifacts.normalization_report_json.is_none());
        assert!(artifacts.schema_version.is_none());
    }

    #[tokio::test]
    async fn maybe_attach_ai_failure_diagnosis_persists_ai_result_and_event() {
        let state = test_state("ai-diagnosis");
        let script = r#"#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--input-json", required=True)
parser.add_argument("--api-key")
parser.add_argument("--model")
parser.add_argument("--base-url")
args = parser.parse_args()

payload = json.loads(Path(args.input_json).read_text(encoding="utf-8"))
assert payload["failure"]["category"] == "unknown"
print(json.dumps({
    "status": "ok",
    "summary": "AI diagnosis summary",
    "root_cause": "AI root cause",
    "suggestion": "AI suggestion",
    "confidence": "medium",
    "observed_signals": ["unknown-category", "runtime-test"]
}))
"#;
        fs::write(&state.config.run_failure_ai_diagnosis_script, script).expect("write script");

        let mut job = build_job();
        job.job_id = "job-ai-diagnosis".to_string();
        job.request_payload.runtime.job_id = job.job_id.clone();
        job.request_payload.translation.api_key = "sk-test".to_string();
        job.request_payload.translation.model = "deepseek-chat".to_string();
        job.request_payload.translation.base_url = "https://api.deepseek.com/v1".to_string();
        job.status = JobStatusKind::Failed;
        job.stage = Some("failed".to_string());
        job.stage_detail = Some("Python worker 执行失败".to_string());
        job.error = Some("Traceback (most recent call last):\nRuntimeError: boom".to_string());
        job.failure = Some(crate::models::JobFailureInfo {
            stage: "translation".to_string(),
            category: "unknown".to_string(),
            code: None,
            summary: "任务失败，但暂未识别出明确根因".to_string(),
            root_cause: Some("Traceback (most recent call last):".to_string()),
            retryable: true,
            upstream_host: None,
            provider: Some("translation".to_string()),
            suggestion: Some("查看日志".to_string()),
            last_log_line: Some("RuntimeError: boom".to_string()),
            raw_error_excerpt: Some("RuntimeError: boom".to_string()),
            raw_diagnostic: None,
            ai_diagnostic: None,
        });
        job.artifacts = Some(JobArtifacts {
            job_root: Some(format!("jobs/{}", job.job_id)),
            ..JobArtifacts::default()
        });
        persist_runtime_job(&state, &job).expect("persist runtime job");

        maybe_attach_ai_failure_diagnosis(state.db.as_ref(), state.config.as_ref(), &mut job).await;

        let failure = job.failure.as_ref().expect("failure");
        assert_eq!(failure.category, "unknown");
        let ai = failure.ai_diagnostic.as_ref().expect("ai diagnosis");
        assert_eq!(ai.summary, "AI diagnosis summary");
        assert_eq!(ai.root_cause.as_deref(), Some("AI root cause"));
        assert_eq!(ai.suggestion.as_deref(), Some("AI suggestion"));
        assert_eq!(ai.confidence.as_deref(), Some("medium"));
        assert_eq!(
            ai.observed_signals,
            vec!["unknown-category".to_string(), "runtime-test".to_string()]
        );

        let request_log = state
            .config
            .output_root
            .join(&job.job_id)
            .join("logs")
            .join("failure-ai-diagnosis.request.json");
        let response_log = state
            .config
            .output_root
            .join(&job.job_id)
            .join("logs")
            .join("failure-ai-diagnosis.response.json");
        assert!(request_log.exists());
        assert!(response_log.exists());

        let events = state
            .db
            .list_job_events(&job.job_id, 20, 0)
            .expect("list events");
        let event = events
            .iter()
            .find(|item| item.event == "failure_ai_diagnosed")
            .expect("failure_ai_diagnosed event");
        let payload = event.payload.as_ref().expect("event payload");
        assert_eq!(payload["category"], "unknown");
        assert_eq!(payload["summary"], "任务失败，但暂未识别出明确根因");
        assert_eq!(payload["ai_diagnostic"]["summary"], "AI diagnosis summary");
    }
}
