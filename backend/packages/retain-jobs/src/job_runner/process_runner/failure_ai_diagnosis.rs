use std::process::Stdio;

use retain_data::credentials::resolve_credential;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

use crate::job_events::record_custom_runtime_event_with_resources;
use crate::models::api::{
    public_request_payload, redact_text, sensitive_values, PublicResolvedJobSpec,
};
use crate::models::domain::{
    now_iso, JobAiDiagnostic, JobFailureInfo, JobRuntimeInfo, JobRuntimeState, JobStatusKind,
    WorkflowKind,
};
use crate::storage_paths::resolve_data_path;

#[derive(Debug, Serialize)]
struct FailureAiDiagnosisRequest<'a> {
    job_id: &'a str,
    workflow: &'a WorkflowKind,
    status: &'a JobStatusKind,
    stage: Option<&'a str>,
    stage_detail: Option<&'a str>,
    failure: &'a JobFailureInfo,
    error: Option<&'a str>,
    log_tail: &'a [String],
    request_payload: &'a PublicResolvedJobSpec,
    runtime: Option<&'a JobRuntimeInfo>,
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

pub(super) async fn maybe_attach_ai_failure_diagnosis(
    db: &crate::db::Db,
    config: &crate::config::FailureAiDiagnosisRuntimeConfig<'_>,
    job: &mut JobRuntimeState,
) {
    let Some(failure_snapshot) = job.failure.clone() else {
        return;
    };
    if failure_snapshot.category != "unknown" || failure_snapshot.ai_diagnostic.is_some() {
        return;
    }

    let job_root = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.job_root.as_ref())
        .and_then(|job_root| resolve_data_path(config.data_root, job_root).ok())
        .unwrap_or_else(|| config.output_root.join(&job.job_id));
    let logs_dir = job_root.join("logs");
    let request_path = logs_dir.join("failure-ai-diagnosis.request.json");
    let response_path = logs_dir.join("failure-ai-diagnosis.response.json");
    if std::fs::create_dir_all(&logs_dir).is_err() {
        return;
    }

    let public_request_payload = public_request_payload(&job.request_payload);
    let request_payload = FailureAiDiagnosisRequest {
        job_id: &job.job_id,
        workflow: &job.workflow,
        status: &job.status,
        stage: job.stage.as_deref(),
        stage_detail: job.stage_detail.as_deref(),
        failure: &failure_snapshot,
        error: job.error.as_deref(),
        log_tail: &job.log_tail,
        request_payload: &public_request_payload,
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

    let mut command = failure_ai_diagnosis_command(config);
    command
        .arg("--input-json")
        .arg(&request_path)
        .arg("--model")
        .arg(&job.request_payload.translation.model)
        .arg("--base-url")
        .arg(&job.request_payload.translation.base_url)
        .env("RUST_API_DATA_ROOT", config.data_root)
        .env("RUST_API_OUTPUT_ROOT", config.output_root)
        .env("OUTPUT_ROOT", config.output_root)
        .env("PYTHONUNBUFFERED", "1")
        .current_dir(config.project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let runtime_secret = if !job.request_payload.translation.api_key.trim().is_empty() {
        Some(job.request_payload.translation.api_key.trim().to_string())
    } else if !job
        .request_payload
        .translation
        .credential_ref
        .trim()
        .is_empty()
    {
        let Ok(credential) = resolve_credential(
            config.data_root,
            job.request_payload.translation.credential_ref.trim(),
            "translation_api_key",
        ) else {
            return;
        };
        Some(credential.secret)
    } else {
        None
    };
    if let Some(secret) = runtime_secret.as_deref() {
        command.env("RETAIN_TRANSLATION_API_KEY", secret);
    }

    let output = match timeout(Duration::from_secs(config.timeout_secs), command.output()).await {
        Ok(Ok(value)) => value,
        _ => return,
    };

    let mut secrets = sensitive_values(&job.request_payload);
    if let Some(secret) = runtime_secret {
        secrets.push(secret);
    }
    let stdout = redact_text(String::from_utf8_lossy(&output.stdout).trim(), &secrets);
    let stderr = redact_text(String::from_utf8_lossy(&output.stderr).trim(), &secrets);
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
        config.data_root,
        config.output_root,
        &job.snapshot(),
        "info",
        "failure_ai_diagnosed",
        "AI 辅助诊断已生成",
        Some(event_payload),
    );
}

fn failure_ai_diagnosis_command(
    config: &crate::config::FailureAiDiagnosisRuntimeConfig<'_>,
) -> Command {
    let mut command = Command::new(config.pipeline_command);
    command.arg("diagnose-failure");
    command
}

#[cfg(test)]
mod command_tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn does_not_require_the_source_wrapper() {
        let config = crate::config::FailureAiDiagnosisRuntimeConfig {
            pipeline_command: "/opt/retainpdf/bin/retainpdf-pipeline",
            project_root: Path::new("/app"),
            data_root: Path::new("/data"),
            output_root: Path::new("/data/jobs"),
            timeout_secs: 60,
        };
        let command = failure_ai_diagnosis_command(&config);
        let command = command.as_std();
        assert_eq!(
            command.get_program(),
            "/opt/retainpdf/bin/retainpdf-pipeline"
        );
        assert_eq!(
            command.get_args().collect::<Vec<_>>(),
            vec![std::ffi::OsStr::new("diagnose-failure")]
        );
    }
}
