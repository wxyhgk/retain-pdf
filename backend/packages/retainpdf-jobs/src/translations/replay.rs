use std::path::Path;

use retainpdf_data::credentials::resolve_credential;
use tokio::process::Command;

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::api::{redact_json_value, redact_text, sensitive_values};
use crate::views::{TranslationReplayCandidate, TranslationReplayView};
use retainpdf_core::models::domain::JobSnapshot;
use retainpdf_core::storage_paths::{resolve_job_root, usage_ledger_env};

use crate::deps::ReplayDeps;
use crate::translations::item::load_translation_debug_item_view;
use crate::translations::revision::{validate_item_id, REPLAY_TIMEOUT};

/// 重放会调翻译模型，和阶段 worker 一样带上用量台账（S57），花的钱记进这个任务。
fn replay_command(
    deps: &ReplayDeps<'_>,
    script_path: &Path,
    job_root: &Path,
    item_id: &str,
    job_id: &str,
) -> Command {
    let mut command = Command::new(deps.python_bin);
    command
        .arg(script_path)
        .arg("--job-root")
        .arg(job_root)
        .arg("--item-id")
        .arg(item_id)
        .current_dir(deps.project_root)
        .env("PYTHONUNBUFFERED", "1")
        .envs(usage_ledger_env(deps.output_root, job_id))
        // 超时或客户端断开时 future 被丢弃,进程跟着被杀,不留在后台调模型。
        .kill_on_drop(true);
    command
}

pub(crate) async fn replay_translation_item(
    deps: &ReplayDeps<'_>,
    job: &JobSnapshot,
    item_id: &str,
) -> Result<TranslationReplayView, AppError> {
    // 和 PATCH 一样先挡坏编号(400),再确认条目存在(404):条目编号会直接做 argv,
    // 条目不存在时 Python 只会抛 RuntimeError,对外成了 500。
    validate_item_id(item_id)?;
    let item_id = load_translation_debug_item_view(deps.data_root, job, item_id)?.item_id;
    let item_id = item_id.as_str();
    let job_root = resolve_job_root(job, deps.data_root)
        .ok_or_else(|| AppError::not_ready("translation manifest"))?;
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

    let mut command = replay_command(deps, &script_path, &job_root, item_id, &job.job_id);
    let runtime_secret = if let Some(api_key) = job.inline_translation_api_key() {
        Some(api_key.to_string())
    } else if let Some(credential_ref) = job.translation_credential_ref() {
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

    let output = tokio::time::timeout(REPLAY_TIMEOUT, command.output())
        .await
        .map_err(|_| AppError::internal("translation replay timed out"))?
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
    let payload = redact_json_value(&payload, &secrets);
    Ok(TranslationReplayView {
        job_id: job.job_id.clone(),
        item_id: item_id.to_string(),
        candidate: TranslationReplayCandidate::from_payload(&payload),
        payload,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replay_command_carries_the_usage_ledger_env() {
        let deps = ReplayDeps::new(
            Path::new("/app"),
            Path::new("/app/scripts"),
            "python3",
            "retainpdf-pipeline",
            Path::new("/data"),
            Path::new("/data/jobs"),
        );
        let command = replay_command(
            &deps,
            Path::new("/app/scripts/devtools/replay_translation_item.py"),
            Path::new("/data/jobs/job-replay"),
            "p001-b001",
            "job-replay",
        );
        let envs: std::collections::HashMap<_, _> = command
            .as_std()
            .get_envs()
            .map(|(key, value)| (key.to_owned(), value.map(|value| value.to_owned())))
            .collect();
        for (name, value) in usage_ledger_env(Path::new("/data/jobs"), "job-replay") {
            assert_eq!(
                envs.get(std::ffi::OsStr::new(name)),
                Some(&Some(value)),
                "{name}"
            );
        }
    }
}
