//! 与翻译并行的渲染准备（辅助进程，不是任务阶段）。
//!
//! 翻译阶段一开始就拉起 `python -m retainpdf_pipeline.render.workflow.prepare_stage`，
//! 提前做与译文无关的渲染准备（页面分析、去隐藏文字层、障碍物扫描……，缓存在
//! `<job>/artifacts/render_prepare/`）；翻译结束后限时等它收尾，渲染阶段直接命中缓存。
//!
//! 它只是缓存预热：不改任务状态、不写事件流、不带任何凭据；起不来、失败、超时都只记日志，
//! 渲染阶段照常现做（步骤有指纹，猜错的输入只是没命中）。任务被取消或 driver 退出时，
//! 句柄被丢弃，`kill_on_drop` 结束进程。

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

use super::ProcessRuntimeDeps;

/// 翻译结束后最多再等多久（通常翻译远比准备慢，这里多半立刻返回）。
pub(super) const RENDER_PREPARE_FINISH_TIMEOUT: Duration = Duration::from_secs(120);
const RENDER_PREPARE_LOG_FILE_NAME: &str = "render-prepare.log";

pub(super) struct RenderPrepareProcess {
    job_id: String,
    child: Child,
    started: Instant,
}

/// 拉起渲染准备进程；任何一步失败都返回 None（只记日志）。
pub(super) fn start_render_prepare(
    deps: &ProcessRuntimeDeps,
    job: &JobRuntimeState,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
) -> Option<RenderPrepareProcess> {
    match spawn(deps, job, job_paths, source_json_path, source_pdf_path) {
        Ok(child) => {
            info!(job_id = %job.job_id, "render prepare started alongside translation");
            Some(RenderPrepareProcess {
                job_id: job.job_id.clone(),
                child,
                started: Instant::now(),
            })
        }
        Err(err) => {
            warn!(job_id = %job.job_id, error = %format!("{err:#}"), "render prepare not started");
            None
        }
    }
}

fn spawn(
    deps: &ProcessRuntimeDeps,
    job: &JobRuntimeState,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
) -> Result<Child> {
    let argv = build_worker_stage_command(
        &deps.worker_command_runtime(),
        &job.request_payload,
        job_paths,
        WorkerStageCommand::RenderPrepare {
            source_json_path,
            source_pdf_path,
            translations_dir: &job_paths.translated_dir,
        },
    )?;
    let (program, args) = argv
        .split_first()
        .context("render prepare command is empty")?;
    std::fs::create_dir_all(&job_paths.logs_dir)
        .with_context(|| format!("create logs dir: {}", job_paths.logs_dir.display()))?;
    let log_path = job_paths.logs_dir.join(RENDER_PREPARE_LOG_FILE_NAME);
    let log = File::create(&log_path)
        .with_context(|| format!("create render prepare log: {}", log_path.display()))?;
    let config = deps.worker_process_runtime();
    let mut command = Command::new(program);
    command
        .args(args)
        // 与阶段进程同样的运行环境，但不注入任何凭据。
        .env("RUST_API_DATA_ROOT", config.data_root)
        .env("RUST_API_OUTPUT_ROOT", config.output_root)
        .env("OUTPUT_ROOT", config.output_root)
        .env("PYTHONUNBUFFERED", "1")
        .env_remove("RETAIN_TRANSLATION_API_KEY")
        .env_remove("RETAIN_OCR_CREDENTIAL")
        .current_dir(config.project_root)
        .stdin(Stdio::null())
        .stdout(Stdio::from(log.try_clone()?))
        .stderr(Stdio::from(log))
        .kill_on_drop(true);
    command
        .spawn()
        .with_context(|| format!("spawn render prepare: {program}"))
}

impl RenderPrepareProcess {
    /// 限时等它收尾；超时就结束它（已做完的步骤都在缓存里，没做完的渲染阶段现做）。
    pub(super) async fn finish(mut self, timeout: Duration) {
        match tokio::time::timeout(timeout, self.child.wait()).await {
            Ok(Ok(status)) if status.success() => info!(
                job_id = %self.job_id,
                elapsed_ms = self.started.elapsed().as_millis() as u64,
                "render prepare finished"
            ),
            Ok(Ok(status)) => warn!(
                job_id = %self.job_id,
                status = %status,
                "render prepare exited with failure; render will prepare by itself"
            ),
            Ok(Err(err)) => warn!(job_id = %self.job_id, error = %err, "render prepare wait failed"),
            Err(_) => {
                warn!(
                    job_id = %self.job_id,
                    timeout_secs = timeout.as_secs(),
                    "render prepare timed out; stopping it"
                );
                let _ = self.child.kill().await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn process(program: &str, args: &[&str]) -> RenderPrepareProcess {
        let child = Command::new(program)
            .args(args)
            .kill_on_drop(true)
            .spawn()
            .expect("spawn test process");
        RenderPrepareProcess {
            job_id: "job".to_string(),
            child,
            started: Instant::now(),
        }
    }

    #[tokio::test]
    async fn finish_stops_a_process_that_outlives_the_timeout() {
        let started = Instant::now();
        let slow = process("sleep", &["30"]);
        assert!(slow.child.id().is_some());
        // finish 消耗句柄；超时后必须把进程结束掉，而不是一直等。
        slow.finish(Duration::from_millis(200)).await;
        assert!(started.elapsed() < Duration::from_secs(5));
    }

    #[tokio::test]
    async fn finish_returns_when_the_process_is_done() {
        let started = Instant::now();
        process("true", &[]).finish(Duration::from_secs(30)).await;
        assert!(started.elapsed() < Duration::from_secs(5));
    }
}
