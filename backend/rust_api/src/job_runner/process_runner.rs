#[cfg(test)]
use crate::models::JobArtifacts;
use crate::models::JobRuntimeState;
use anyhow::Result;

use super::cancel_registry::is_cancel_requested_any;
use super::process_contract::validate_successful_worker_outputs;
use super::ProcessRuntimeDeps;

mod completion;
mod execution;
mod failure_ai_diagnosis;
mod io_support;
mod result_support;
mod startup;
mod timeout_support;

#[cfg(test)]
use self::completion::is_shutdown_noise;
use self::completion::{
    apply_process_completion, classify_process_completion, should_treat_shutdown_noise_as_success,
    ProcessCompletionKind,
};
use self::execution::{collect_process_execution, ProcessExecution};
use self::failure_ai_diagnosis::maybe_attach_ai_failure_diagnosis;
#[cfg(test)]
use self::io_support::should_continue_after_cancel;
use self::result_support::attach_process_result;
use self::startup::spawn_started_process;
#[cfg(test)]
use self::timeout_support::apply_timeout_failure;
#[cfg(test)]
use self::timeout_support::timeout_detail_for_stage;

pub(crate) async fn execute_process_job(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
    extra_cancel_job_ids: &[String],
) -> Result<JobRuntimeState> {
    let worker_runtime = deps.worker_process_runtime();
    let (job, child) = spawn_started_process(
        &deps.persist,
        &deps.canceled_jobs,
        &worker_runtime,
        job,
        extra_cancel_job_ids,
    )
    .await?;
    let execution = collect_process_execution(
        &deps.persist,
        &deps.canceled_jobs,
        &worker_runtime,
        child,
        job,
        extra_cancel_job_ids,
    )
    .await?;
    let completed = match execution {
        ProcessExecution::Completed(completed) => completed,
        ProcessExecution::TimedOut(timed_out_job) => return Ok(timed_out_job),
    };
    let mut latest_job = completed.latest_job;
    attach_process_result(
        &mut latest_job,
        &completed.status,
        completed.started,
        completed.stdout_text,
        &completed.stderr_text,
        worker_runtime.project_root,
    );

    let mut completion = classify_process_completion(
        is_cancel_requested_any(
            &deps.canceled_jobs,
            &latest_job.job_id,
            extra_cancel_job_ids,
        )
        .await,
        completed.status.success(),
        should_treat_shutdown_noise_as_success(&latest_job, &completed.stderr_text),
    );
    if matches!(
        completion,
        ProcessCompletionKind::Succeeded | ProcessCompletionKind::SucceededWithShutdownNoise
    ) {
        if let Err(err) = validate_successful_worker_outputs(&latest_job, &deps.persist.data_root) {
            latest_job.append_log(&format!("ERROR: worker output contract failed: {err}"));
            latest_job.stage_detail =
                Some(format!("Python worker 成功退出，但必需产物缺失：{err}"));
            completion = ProcessCompletionKind::Failed;
        }
    }
    apply_process_completion(&mut latest_job, completion, &completed.stderr_text);
    maybe_attach_ai_failure_diagnosis(
        deps.db.as_ref(),
        &deps.failure_ai_diagnosis_runtime(),
        &mut latest_job,
    )
    .await;
    Ok(latest_job)
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::fs;
    use std::sync::Arc;

    use super::*;
    use crate::config::AppConfig;
    use crate::db::Db;
    use crate::job_events::persist_runtime_job_with_resources;
    use crate::models::{now_iso, CreateJobInput, JobStatusKind};
    use crate::ocr_provider::{provider_token_env_name, OcrProviderKind};
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
            run_provider_case_script: scripts_dir.join("run_provider_case.py"),
            run_provider_ocr_script: scripts_dir.join("run_provider_ocr.py"),
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
            provider_limits: crate::config::ProviderLimitsConfig::default(),
            provider_runtime: crate::config::ProviderRuntimeConfig::default(),
            job_runner: crate::config::JobRunnerConfig::default(),
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

    #[tokio::test]
    async fn execute_process_job_preserves_timeout_process_output() {
        let state = test_state("timeout-output");
        let mut job = crate::models::JobSnapshot::new(
            "job-timeout-output".to_string(),
            CreateJobInput::default(),
            vec![
                "python3".to_string(),
                "-c".to_string(),
                "import sys, time; print('stdout-before-timeout', flush=True); print('stderr-before-timeout', file=sys.stderr, flush=True); time.sleep(5)".to_string(),
            ],
        )
        .into_runtime();
        job.request_payload.runtime.job_id = job.job_id.clone();
        job.request_payload.runtime.timeout_seconds = 1;

        let finished = execute_process_job(
            ProcessRuntimeDeps::new(
                state.config.clone(),
                state.db.clone(),
                state.canceled_jobs.clone(),
                state.job_slots.clone(),
            ),
            job,
            &[],
        )
        .await
        .expect("execute process job");

        assert_eq!(finished.status, JobStatusKind::Failed);
        assert_eq!(finished.stage_detail.as_deref(), Some("provider timeout"));
        let result = finished.result.as_ref().expect("process result");
        assert!(!result.success);
        assert_eq!(result.return_code, -1);
        assert_eq!(
            finished
                .failure
                .as_ref()
                .and_then(|failure| failure.failure_code.as_deref()),
            Some("process_timeout")
        );
        assert_eq!(
            finished
                .failure
                .as_ref()
                .and_then(|failure| failure.failure_category.as_deref()),
            Some("timeout")
        );
        assert!(finished
            .failure
            .as_ref()
            .and_then(|failure| failure.root_cause.as_deref())
            .is_some_and(|root_cause| root_cause.contains("timeout_seconds=1")));
        assert!(result.stdout.contains("stdout-before-timeout"));
        assert!(result.stderr.contains("stderr-before-timeout"));
        assert!(result.duration_seconds >= 1.0);
        assert!(finished
            .log_tail
            .iter()
            .any(|line| line.contains("stdout-before-timeout")));
        assert!(finished
            .log_tail
            .iter()
            .any(|line| line.contains("stderr-before-timeout")));
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
import os
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--input-json", required=True)
parser.add_argument("--model")
parser.add_argument("--base-url")
args = parser.parse_args()

payload = json.loads(Path(args.input_json).read_text(encoding="utf-8"))
assert payload["failure"]["category"] == "unknown"
assert payload["request_payload"]["translation"]["api_key"] == ""
assert payload["request_payload"]["translation"]["api_key_configured"] is True
assert payload["request_payload"]["ocr"]["mineru_token"] == ""
assert payload["request_payload"]["ocr"]["mineru_token_configured"] is False
assert os.environ.get("RETAIN_TRANSLATION_API_KEY") == "sk-test"
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
        job.request_payload.translation.model = "deepseek-v4-flash".to_string();
        job.request_payload.translation.base_url = "https://api.deepseek.com/v1".to_string();
        job.status = JobStatusKind::Failed;
        job.stage = Some("failed".to_string());
        job.stage_detail = Some("Python worker 执行失败".to_string());
        job.error = Some("Traceback (most recent call last):\nRuntimeError: boom".to_string());
        job.failure = Some(crate::models::JobFailureInfo {
            stage: "translation".to_string(),
            category: "unknown".to_string(),
            code: None,
            failed_stage: Some("translation".to_string()),
            failure_code: Some("unknown".to_string()),
            failure_category: Some("internal".to_string()),
            provider_stage: None,
            provider_code: None,
            summary: "任务失败，但暂未识别出明确根因".to_string(),
            root_cause: Some("Traceback (most recent call last):".to_string()),
            retryable: true,
            upstream_host: None,
            provider: Some("translation".to_string()),
            suggestion: Some("查看日志".to_string()),
            last_log_line: Some("RuntimeError: boom".to_string()),
            raw_excerpt: Some("RuntimeError: boom".to_string()),
            raw_error_excerpt: Some("RuntimeError: boom".to_string()),
            raw_diagnostic: None,
            ai_diagnostic: None,
        });
        job.artifacts = Some(JobArtifacts {
            job_root: Some(format!("jobs/{}", job.job_id)),
            ..JobArtifacts::default()
        });
        persist_runtime_job_with_resources(
            state.db.as_ref(),
            &state.config.data_root,
            &state.config.output_root,
            &job,
        )
        .expect("persist runtime job");

        maybe_attach_ai_failure_diagnosis(
            state.db.as_ref(),
            &state.config.failure_ai_diagnosis_runtime(),
            &mut job,
        )
        .await;

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
        let request_payload: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&request_log).expect("read request log"))
                .expect("parse request log");
        assert_eq!(
            request_payload["request_payload"]["translation"]["api_key"],
            ""
        );
        assert_eq!(
            request_payload["request_payload"]["translation"]["api_key_configured"],
            true
        );
        assert_eq!(
            request_payload["request_payload"]["ocr"]["mineru_token"],
            ""
        );
        assert_eq!(
            request_payload["request_payload"]["ocr"]["mineru_token_configured"],
            false
        );
        assert!(!fs::read_to_string(&request_log)
            .expect("request log text")
            .contains("sk-test"));

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

    #[tokio::test]
    async fn execute_process_job_injects_provider_and_translation_envs() {
        let state = test_state("provider-envs");
        let paddle_env = provider_token_env_name(&OcrProviderKind::Paddle).expect("paddle env");
        let mineru_env = provider_token_env_name(&OcrProviderKind::Mineru).expect("mineru env");
        let mut job = crate::models::JobSnapshot::new(
            "job-provider-envs".to_string(),
            CreateJobInput::default(),
            vec![
                "python3".to_string(),
                "-c".to_string(),
                format!(
                    r#"import json, os
print(json.dumps({{
  "translation": os.environ.get("RETAIN_TRANSLATION_API_KEY", ""),
  "paddle": os.environ.get({paddle_env:?}, ""),
  "mineru": os.environ.get({mineru_env:?}, "")
}}, ensure_ascii=False))"#
                ),
            ],
        )
        .into_runtime();
        job.request_payload.runtime.job_id = job.job_id.clone();
        job.request_payload.translation.api_key = "sk-env-test".to_string();
        job.request_payload.ocr.provider = "paddle".to_string();
        job.request_payload.ocr.paddle_token = "paddle-env-test".to_string();
        job.request_payload.ocr.mineru_token = String::new();

        let finished = execute_process_job(
            ProcessRuntimeDeps::new(
                state.config.clone(),
                state.db.clone(),
                state.canceled_jobs.clone(),
                state.job_slots.clone(),
            ),
            job,
            &[],
        )
        .await
        .expect("execute process job");

        assert_eq!(finished.status, JobStatusKind::Succeeded);
        let result = finished.result.as_ref().expect("process result");
        assert!(result.success);
        assert!(result.stdout.contains("\"translation\": \"sk-env-test\""));
        assert!(result.stdout.contains("\"paddle\": \"paddle-env-test\""));
        assert!(result.stdout.contains("\"mineru\": \"\""));
    }
}
