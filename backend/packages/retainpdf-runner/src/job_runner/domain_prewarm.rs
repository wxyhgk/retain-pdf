//! OCR 期间先做识别领域（辅助进程，不是任务阶段）。
//!
//! 提交 OCR 后拉起 `python -m retainpdf_pipeline.translate.entrypoints.domain_prewarm`：识别领域只读源 PDF 前两页的文本层，
//! 不依赖 OCR，结果按（模型, 预览文本）存进各任务共用的缓存；翻译阶段到时命中缓存，不再串行等这一个请求
//! （2026-10-30 Jensen 第 12 章：OCR 跑了 37 秒，翻译开始后又等了 6.6 秒识别领域）。
//!
//! 它只是缓存预热：不改任务状态、不写事件流；起不来、失败、超时都只记日志，翻译阶段照常自己问。
//! 和渲染准备不同，它要调翻译模型，所以注入翻译 key（只经 env，spec 里只写 env 引用）。
//! 走 Rust 模型执行器的任务不拉起（模型请求归执行器管）；任务被取消或 driver 退出时句柄被丢弃，`kill_on_drop` 结束进程。

use std::fs::File;
use std::path::Path;
use std::process::Stdio;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use tokio::process::{Child, Command};
use tracing::{info, warn};

use crate::models::domain::JobRuntimeState;
use crate::storage_paths::JobPaths;
use crate::worker_command::{build_worker_stage_command, WorkerStageCommand};

use super::worker_process::resolve_translation_api_key;
use super::ProcessRuntimeDeps;

/// OCR 结束后最多再等多久（OCR 通常比识别领域慢得多，这里多半立刻返回；没等到，翻译阶段就自己问）。
pub(super) const DOMAIN_PREWARM_FINISH_TIMEOUT: Duration = Duration::from_secs(30);
const DOMAIN_PREWARM_LOG_FILE_NAME: &str = "domain-prewarm.log";

pub(super) struct DomainPrewarmProcess {
    job_id: String,
    child: Child,
    started: Instant,
}

/// 要不要拉起：只有学术模式（识别领域只在 sci 下做）、走 Python 请求、有翻译 key 的任务。
fn wanted(job: &JobRuntimeState) -> bool {
    job.request_payload.translation.mode == "sci"
        && job.request_payload.translation.execution_connection.is_none()
}

/// 拉起识别领域进程；不需要或任何一步失败都返回 None（只记日志）。
pub(super) fn start_domain_prewarm(
    deps: &ProcessRuntimeDeps,
    job: &JobRuntimeState,
    job_paths: &JobPaths,
    source_pdf_path: &Path,
) -> Option<DomainPrewarmProcess> {
    if !wanted(job) {
        return None;
    }
    match spawn(deps, job, job_paths, source_pdf_path) {
        Ok(Some(child)) => {
            info!(job_id = %job.job_id, "domain inference started alongside OCR");
            Some(DomainPrewarmProcess {
                job_id: job.job_id.clone(),
                child,
                started: Instant::now(),
            })
        }
        Ok(None) => None,
        Err(err) => {
            warn!(job_id = %job.job_id, error = %format!("{err:#}"), "domain prewarm not started");
            None
        }
    }
}

fn spawn(
    deps: &ProcessRuntimeDeps,
    job: &JobRuntimeState,
    job_paths: &JobPaths,
    source_pdf_path: &Path,
) -> Result<Option<Child>> {
    let config = deps.worker_process_runtime();
    let Some(api_key) = resolve_translation_api_key(config.data_root, job)? else {
        return Ok(None);
    };
    let argv = build_worker_stage_command(
        &deps.worker_command_runtime(),
        &job.request_payload,
        job_paths,
        WorkerStageCommand::DomainPrewarm { source_pdf_path },
    )?;
    let (program, args) = argv
        .split_first()
        .context("domain prewarm command is empty")?;
    std::fs::create_dir_all(&job_paths.logs_dir)
        .with_context(|| format!("create logs dir: {}", job_paths.logs_dir.display()))?;
    let log_path = job_paths.logs_dir.join(DOMAIN_PREWARM_LOG_FILE_NAME);
    let log = File::create(&log_path)
        .with_context(|| format!("create domain prewarm log: {}", log_path.display()))?;
    let mut command = Command::new(program);
    command
        .args(args)
        // 与阶段进程同样的运行环境；只带翻译 key，不带 OCR、审校的凭据。
        .env("RUST_API_DATA_ROOT", config.data_root)
        .env("RUST_API_OUTPUT_ROOT", config.output_root)
        .env("OUTPUT_ROOT", config.output_root)
        .env("PYTHONUNBUFFERED", "1")
        .env("RETAIN_TRANSLATION_API_KEY", &api_key)
        .env_remove("RETAIN_OCR_CREDENTIAL")
        .current_dir(config.project_root)
        .stdin(Stdio::null())
        .stdout(Stdio::from(log.try_clone()?))
        .stderr(Stdio::from(log))
        .kill_on_drop(true);
    let child = command
        .spawn()
        .with_context(|| format!("spawn domain prewarm: {program}"))?;
    Ok(Some(child))
}

impl DomainPrewarmProcess {
    /// 限时等它收尾；超时就结束它（翻译阶段自己问）。
    pub(super) async fn finish(mut self, timeout: Duration) {
        match tokio::time::timeout(timeout, self.child.wait()).await {
            Ok(Ok(status)) if status.success() => info!(
                job_id = %self.job_id,
                elapsed_ms = self.started.elapsed().as_millis() as u64,
                "domain prewarm finished"
            ),
            Ok(Ok(status)) => warn!(job_id = %self.job_id, status = %status, "domain prewarm exited with failure"),
            Ok(Err(err)) => warn!(job_id = %self.job_id, error = %err, "domain prewarm wait failed"),
            Err(_) => {
                warn!(job_id = %self.job_id, timeout_secs = timeout.as_secs(), "domain prewarm timed out; stopping it");
                let _ = self.child.kill().await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::job_runner::test_support::runtime_job;

    #[test]
    fn only_sci_jobs_that_call_the_model_from_python_prewarm() {
        let mut job = runtime_job();
        job.request_payload.translation.mode = "sci".to_string();
        assert!(wanted(&job));
        job.request_payload.translation.mode = "fast".to_string();
        assert!(!wanted(&job), "domain inference only runs in sci mode");

        let mut executor = runtime_job();
        executor.request_payload.translation.mode = "sci".to_string();
        executor.request_payload.translation.execution_connection = Some(
            serde_json::from_value(serde_json::json!({"id":"qwen-main","revision":1,"provider":"qwen",
                "base_url":"https://dashscope.aliyuncs.com/compatible-mode/v1","model":"qwen3.8-flash",
                "credential_ref":"cred_translation","concurrency":2}))
            .unwrap(),
        );
        assert!(!wanted(&executor), "the Rust model executor owns model requests");
    }
}
