#[cfg(windows)]
use std::process::Command as StdCommand;
use std::process::Stdio;

#[cfg(windows)]
use anyhow::anyhow;
use anyhow::{Context, Result};
use retain_data::credentials::resolve_credential;
use sha2::{Digest, Sha256};
use tokio::process::{Child, Command};

pub(super) struct ModelWorkerBinding {
    api_url: String,
    job_id: String,
    capability: String,
    wait_seconds: u64,
    fingerprint: String,
}

pub(super) struct ModelWorkerLease {
    db: retain_data::db::Db,
    job_id: Option<String>,
}
impl ModelWorkerLease {
    pub(super) fn for_job(db: &retain_data::db::Db, job: &JobRuntimeState) -> Self {
        Self {
            db: db.clone(),
            job_id: if job
                .request_payload
                .translation
                .execution_connection
                .is_some()
                && job
                    .command
                    .windows(2)
                    .any(|args| args[0] == "-m" && args[1] == "retainpdf_pipeline.translate")
            {
                Some(job.job_id.clone())
            } else {
                None
            },
        }
    }
}
impl Drop for ModelWorkerLease {
    fn drop(&mut self) {
        if let Some(job_id) = &self.job_id {
            if self.db.close_model_worker_session(job_id).is_err() {
                tracing::error!("could not revoke stopped model worker session");
            }
        }
    }
}

pub(super) fn prepare_model_worker_binding(
    db: &retain_data::db::Db,
    job: &JobRuntimeState,
    api_url: Option<&str>,
) -> Result<Option<ModelWorkerBinding>> {
    let Some(profile) = job
        .request_payload
        .translation
        .execution_connection
        .as_ref()
    else {
        return Ok(None);
    };
    let translation_worker = job
        .command
        .windows(2)
        .any(|args| args[0] == "-m" && args[1] == "retainpdf_pipeline.translate");
    if !translation_worker {
        return Ok(None);
    }
    let raw_url =
        api_url.context("RETAIN_MODEL_EXECUTOR_URL is required for a Rust model worker")?;
    let url = reqwest::Url::parse(raw_url)
        .map_err(|_| anyhow::anyhow!("invalid model executor origin"))?;
    let local = url
        .host_str()
        .and_then(|host| {
            host.trim_matches(['[', ']'])
                .parse::<std::net::IpAddr>()
                .ok()
        })
        .is_some_and(|ip| ip.is_loopback());
    if url.scheme() != "http"
        || !local
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() != "/"
    {
        anyhow::bail!("model executor origin must be explicit loopback HTTP without credentials");
    }
    let persisted = db.get_job(&job.job_id)?;
    if persisted
        .request_payload
        .translation
        .execution_connection
        .as_ref()
        != Some(profile)
    {
        anyhow::bail!("worker model connection differs from submitted snapshot");
    }
    let mut random = [0u8; 32];
    getrandom::getrandom(&mut random)
        .map_err(|_| anyhow::anyhow!("worker capability generation failed"))?;
    let capability: String = random.iter().map(|b| format!("{b:02x}")).collect();
    let hash: String = Sha256::digest(capability.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    let ttl = (job.request_payload.runtime.timeout_seconds.max(0) as u64)
        .saturating_add(600)
        .clamp(3600, 86400);
    db.create_model_session(
        &job.job_id,
        &hash,
        chrono_now_seconds() + ttl as i64,
        &serde_json::to_value(profile)?,
    )?;
    let fingerprint = Sha256::digest(serde_json::to_vec(profile)?)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    Ok(Some(ModelWorkerBinding {
        api_url: url.as_str().trim_end_matches('/').to_owned(),
        job_id: job.job_id.clone(),
        capability,
        wait_seconds: (profile.deadlines.queue_ms + profile.deadlines.total_ms).div_ceil(1000) + 30,
        fingerprint,
    }))
}

fn chrono_now_seconds() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

use crate::config::WorkerProcessRuntimeConfig;
use crate::models::domain::{JobRuntimeState, WorkflowKind};
use crate::ocr_provider::{
    configured_provider_credential_env, is_configured_command_provider, provider_token,
    provider_token_env_name, require_supported_provider,
};

use super::runtime_credentials::resolve_ocr_provider_token;

pub(super) fn spawn_worker_process(
    config: &WorkerProcessRuntimeConfig<'_>,
    job: &JobRuntimeState,
    model_binding: Option<&ModelWorkerBinding>,
) -> Result<(Child, Vec<String>)> {
    let mut command = Command::new(&job.command[0]);
    command
        .args(&job.command[1..])
        .env("RUST_API_DATA_ROOT", config.data_root)
        .env("RUST_API_OUTPUT_ROOT", config.output_root)
        .env("OUTPUT_ROOT", config.output_root)
        .env(
            "RETAIN_OCR_PROVIDER_CONFIG",
            config.ocr_provider_config_path,
        )
        .env("PYTHONUNBUFFERED", "1")
        // 模型用量台账：每次模型返回追加一行（Python usage_ledger）。
        .env(
            "RETAIN_USAGE_LEDGER",
            crate::storage_paths::JobPaths::for_job(config.output_root, &job.job_id).token_usage_ledger(),
        )
        .env("RETAIN_USAGE_JOB_ID", &job.job_id)
        .current_dir(config.project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut runtime_secrets = apply_job_credentials(&mut command, config.data_root, job)?;
    // Never inherit another worker's capability or select Rust by ambient env.
    for name in [
        "RETAIN_MODEL_CAPABILITY",
        "RETAIN_MODEL_JOB_ID",
        "RETAIN_MODEL_WAIT_SECONDS",
        "RETAIN_MODEL_CONNECTION_FINGERPRINT",
    ] {
        command.env_remove(name);
    }
    command.env("RETAIN_TRANSLATION_TRANSPORT", "legacy");
    if let Some(binding) = model_binding {
        command
            .env("RETAIN_TRANSLATION_TRANSPORT", "rust")
            .env("RETAIN_MODEL_EXECUTOR_URL", &binding.api_url)
            .env("RETAIN_MODEL_JOB_ID", &binding.job_id)
            .env("RETAIN_MODEL_CAPABILITY", &binding.capability)
            .env("RETAIN_MODEL_CONNECTION_FINGERPRINT", &binding.fingerprint)
            .env(
                "RETAIN_MODEL_WAIT_SECONDS",
                binding.wait_seconds.to_string(),
            );
        runtime_secrets.push(binding.capability.clone());
    } else if job
        .request_payload
        .translation
        .execution_connection
        .is_some()
        && job
            .command
            .windows(2)
            .any(|args| args[0] == "-m" && args[1] == "retainpdf_pipeline.translate")
    {
        anyhow::bail!("Rust model worker requires a task capability; direct fallback is disabled");
    }
    configure_child_process(&mut command);

    let program = job.command.first().cloned().unwrap_or_default();
    let child = command
        .spawn()
        .with_context(|| format!("failed to spawn python worker: {program}"))?;
    Ok((child, runtime_secrets))
}

fn apply_job_credentials(
    command: &mut Command,
    data_root: &std::path::Path,
    job: &JobRuntimeState,
) -> Result<Vec<String>> {
    let mut runtime_secrets = Vec::new();
    if job
        .request_payload
        .translation
        .execution_connection
        .is_some()
    {
        for name in [
            "RETAIN_TRANSLATION_API_KEY",
            "DEEPSEEK_API_KEY",
            "OPENAI_API_KEY",
            "DASHSCOPE_API_KEY",
            "QWEN_API_KEY",
            "RUST_API_KEYS",
            REVIEWER_API_KEY_ENV_NAME,
        ] {
            command.env_remove(name);
        }
    } else {
        // 渲染任务保留了凭据引用（原地重渲染不再清引用），只为渲染前的精修备用。
        // 引用解析不了（凭据已被删）时渲染本身不能失败：精修拿不到 key 会在报告里
        // 记 llm_unavailable，渲染照常进行。翻译任务仍然严格失败。
        let lenient = matches!(job.request_payload.workflow, WorkflowKind::Render);
        if let Some(api_key) =
            tolerate_for_render(lenient, "translation", resolve_translation_api_key(data_root, job))?
        {
            command.env("RETAIN_TRANSLATION_API_KEY", &api_key);
            runtime_secrets.push(api_key);
        }
        // 审校 key 与翻译 key 走同一套：内联优先，否则解析 vault 引用；只经 env 传给
        // worker，stage spec 里只写 env 引用。没配时不设，Python 侧回退到翻译 key。
        if let Some(api_key) =
            tolerate_for_render(lenient, "reviewer", resolve_reviewer_api_key(data_root, job))?
        {
            command.env(REVIEWER_API_KEY_ENV_NAME, &api_key);
            runtime_secrets.push(api_key);
        }
    }
    if let Ok(provider_kind) = require_supported_provider(&job.request_payload.ocr.provider) {
        let referenced_token = resolve_ocr_provider_token(data_root, job)?;
        if is_configured_command_provider(&job.request_payload.ocr.provider) {
            if let Some(token) =
                apply_configured_provider_credential(command, job, referenced_token)?
            {
                runtime_secrets.push(token);
            }
            return Ok(runtime_secrets);
        }
        let token = referenced_token.unwrap_or_else(|| {
            provider_token(&provider_kind, &job.request_payload.ocr).to_string()
        });
        if !token.is_empty() {
            if let Some(env_name) = provider_token_env_name(&provider_kind) {
                command.env(env_name, &token);
                runtime_secrets.push(token);
            }
        }
    }
    Ok(runtime_secrets)
}

const REVIEWER_API_KEY_ENV_NAME: &str = "RETAIN_REVIEWER_API_KEY";

fn tolerate_for_render(
    lenient: bool,
    label: &str,
    resolved: Result<Option<String>>,
) -> Result<Option<String>> {
    match resolved {
        Err(error) if lenient => {
            // 只记引用解析失败这件事，不记错误链（里面可能带凭据引用名以外的细节）。
            tracing::warn!("render job skips unresolvable {label} credential reference");
            let _ = error;
            Ok(None)
        }
        other => other,
    }
}

fn resolve_reviewer_api_key(
    data_root: &std::path::Path,
    job: &JobRuntimeState,
) -> Result<Option<String>> {
    let inline = job.request_payload.translation.reviewer_api_key.trim();
    if !inline.is_empty() {
        return Ok(Some(inline.to_string()));
    }
    let credential_ref = job.request_payload.translation.reviewer_credential_ref.trim();
    if credential_ref.is_empty() {
        return Ok(None);
    }
    let resolved = resolve_credential(data_root, credential_ref, "translation_api_key")
        .with_context(|| format!("resolve reviewer credential_ref {credential_ref}"))?;
    Ok(Some(resolved.secret))
}

fn resolve_translation_api_key(
    data_root: &std::path::Path,
    job: &JobRuntimeState,
) -> Result<Option<String>> {
    let inline = job.request_payload.translation.api_key.trim();
    if !inline.is_empty() {
        return Ok(Some(inline.to_string()));
    }
    let credential_ref = job.request_payload.translation.credential_ref.trim();
    if credential_ref.is_empty() {
        return Ok(None);
    }
    let resolved = resolve_credential(data_root, credential_ref, "translation_api_key")
        .with_context(|| format!("resolve translation credential_ref {credential_ref}"))?;
    Ok(Some(resolved.secret))
}

fn apply_configured_provider_credential(
    command: &mut Command,
    job: &JobRuntimeState,
    referenced_token: Option<String>,
) -> Result<Option<String>> {
    let token = referenced_token.unwrap_or_else(|| configured_provider_token(job));
    if token.is_empty() {
        return Ok(None);
    }
    if let Some(env_name) = configured_provider_credential_env(&job.request_payload.ocr.provider) {
        command.env(env_name, &token);
    }
    command.env("RETAIN_OCR_CREDENTIAL", &token);
    Ok(Some(token))
}

fn configured_provider_token(job: &JobRuntimeState) -> String {
    for key in ["credential", "token", "api_key"] {
        let Some(value) = job.request_payload.ocr.options.get(key) else {
            continue;
        };
        if let Some(text) = value
            .as_str()
            .map(str::trim)
            .filter(|item| !item.is_empty())
        {
            return text.to_string();
        }
    }
    std::env::var(
        configured_provider_credential_env(&job.request_payload.ocr.provider).unwrap_or_default(),
    )
    .unwrap_or_default()
    .trim()
    .to_string()
}

// 进程工具已迁往 retain-proc（ADR-002 Phase 2：零任务语义的 OS 操作
// 不应住在任务执行栈里）。此处 re-export 保持 job_runner:: 路径不变。
pub use retain_proc::{
    configure_child_process, terminate_job_process_tree, terminate_job_process_tree_blocking,
    worker_process_exists,
};

#[cfg(test)]
mod tests;
