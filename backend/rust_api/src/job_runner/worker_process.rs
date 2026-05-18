#[cfg(unix)]
use std::io;
use std::path::Path;
#[cfg(windows)]
use std::process::Command as StdCommand;
use std::process::Stdio;
use std::time::Instant;

#[cfg(windows)]
use anyhow::anyhow;
use anyhow::{Context, Result};
use tokio::process::{Child, Command};
use tokio::time::{sleep, Duration};

use crate::config::WorkerProcessRuntimeConfig;
use crate::models::JobRuntimeState;
use crate::ocr_provider::{provider_token, provider_token_env_name, require_supported_provider};

pub(super) fn spawn_worker_process(
    config: &WorkerProcessRuntimeConfig<'_>,
    job: &JobRuntimeState,
) -> Result<Child> {
    let mut command = Command::new(&job.command[0]);
    command
        .args(&job.command[1..])
        .env("RUST_API_DATA_ROOT", config.data_root)
        .env("RUST_API_OUTPUT_ROOT", config.output_root)
        .env("OUTPUT_ROOT", config.output_root)
        .env("PYTHONUNBUFFERED", "1")
        .current_dir(config.project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_job_credentials(&mut command, job);
    configure_child_process(&mut command);

    let program = job.command.first().cloned().unwrap_or_default();
    command
        .spawn()
        .with_context(|| format!("failed to spawn python worker: {program}"))
}

fn apply_job_credentials(command: &mut Command, job: &JobRuntimeState) {
    if !job.request_payload.translation.api_key.trim().is_empty() {
        command.env(
            "RETAIN_TRANSLATION_API_KEY",
            job.request_payload.translation.api_key.trim(),
        );
    }
    if let Ok(provider_kind) = require_supported_provider(&job.request_payload.ocr.provider) {
        let token = provider_token(&provider_kind, &job.request_payload.ocr);
        if !token.is_empty() {
            if let Some(env_name) = provider_token_env_name(&provider_kind) {
                command.env(env_name, token);
            }
        }
    }
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

#[cfg(unix)]
pub(crate) fn worker_process_exists(pid: u32) -> bool {
    let path = format!("/proc/{pid}");
    Path::new(&path).exists()
}

#[cfg(not(unix))]
pub(crate) fn worker_process_exists(_pid: u32) -> bool {
    false
}

pub async fn terminate_job_process_tree(
    pid: u32,
    grace_secs: u64,
    poll_interval_ms: u64,
) -> Result<()> {
    #[cfg(windows)]
    {
        let status = StdCommand::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .context("failed to invoke taskkill")?;
        if status.success() {
            return Ok(());
        }
        return Err(anyhow!("taskkill failed for pid={pid}"));
    }

    #[cfg(unix)]
    {
        let group_pid = -(pid as i32);
        let deadline = Instant::now() + Duration::from_secs(grace_secs);
        let poll_interval = Duration::from_millis(poll_interval_ms);
        let _ = unsafe { libc::kill(group_pid, libc::SIGTERM) };
        while Instant::now() < deadline {
            if !worker_process_exists(pid) {
                return Ok(());
            }
            sleep(poll_interval).await;
        }
        let _ = unsafe { libc::kill(group_pid, libc::SIGKILL) };
        Ok(())
    }
}
