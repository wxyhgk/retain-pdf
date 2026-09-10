use retain_data::credentials::resolve_credential;
use tokio::process::Command;

use crate::error::AppError;
use crate::models::api::{redact_json_value, redact_text, sensitive_values, TranslationReplayView};
use crate::models::domain::JobSnapshot;
use crate::storage_paths::resolve_job_root;

use crate::services::jobs::deps::ReplayDeps;

pub(crate) async fn replay_translation_item(
    deps: &ReplayDeps<'_>,
    job: &JobSnapshot,
    item_id: &str,
) -> Result<TranslationReplayView, AppError> {
    let job_root = resolve_job_root(job, deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("job root not found: {}", job.job_id)))?;
    let script_path = deps
        .scripts_dir
        .join("devtools")
        .join("replay_translation_item.py");
    if !script_path.exists() {
        return Err(AppError::internal(format!(
            "replay script not found: {}",
            script_path.display()
        )));
    }

    let mut command = Command::new(deps.python_bin);
    command
        .arg(&script_path)
        .arg("--job-root")
        .arg(&job_root)
        .arg("--item-id")
        .arg(item_id)
        .current_dir(deps.project_root)
        .env("PYTHONUNBUFFERED", "1");
    let runtime_secret = if !job.request_payload.translation.api_key.trim().is_empty() {
        Some(job.request_payload.translation.api_key.trim().to_string())
    } else if !job
        .request_payload
        .translation
        .credential_ref
        .trim()
        .is_empty()
    {
        let credential_ref = job.request_payload.translation.credential_ref.trim();
        let credential = resolve_credential(deps.data_root, credential_ref, "translation_api_key")
            .map_err(|error| {
                AppError::internal(format!(
                    "resolve translation credential_ref {credential_ref}: {error}"
                ))
            })?;
        Some(credential.secret)
    } else {
        None
    };
    if let Some(secret) = runtime_secret.as_deref() {
        command.env("RETAIN_TRANSLATION_API_KEY", secret);
    }

    let mut secrets = sensitive_values(&job.request_payload);
    if let Some(secret) = runtime_secret {
        secrets.push(secret);
    }

    let output = command
        .output()
        .await
        .map_err(|err| AppError::internal(format!("spawn replay script: {err}")))?;
    if !output.status.success() {
        let stderr = redact_text(String::from_utf8_lossy(&output.stderr).trim(), &secrets);
        let excerpt = stderr.trim();
        return Err(AppError::internal(format!(
            "translation replay failed: {}",
            if excerpt.is_empty() {
                format!("exit status {}", output.status)
            } else {
                excerpt.to_string()
            }
        )));
    }
    let payload: serde_json::Value = serde_json::from_slice(&output.stdout).map_err(|err| {
        let stdout_excerpt = redact_text(String::from_utf8_lossy(&output.stdout).trim(), &secrets);
        let stderr_excerpt = redact_text(String::from_utf8_lossy(&output.stderr).trim(), &secrets);
        let stdout_excerpt = if stdout_excerpt.is_empty() {
            "<empty>".to_string()
        } else {
            stdout_excerpt.chars().take(240).collect()
        };
        let stderr_excerpt = if stderr_excerpt.is_empty() {
            "<empty>".to_string()
        } else {
            stderr_excerpt.chars().take(240).collect()
        };
        AppError::internal(format!(
            "parse replay payload: {err}; stdout={stdout_excerpt}; stderr={stderr_excerpt}"
        ))
    })?;
    Ok(TranslationReplayView {
        job_id: job.job_id.clone(),
        item_id: item_id.to_string(),
        payload: redact_json_value(&payload, &secrets),
    })
}
