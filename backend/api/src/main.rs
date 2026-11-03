use std::time::Duration;

use retainpdf_api::config::{AppConfig, JOB_WORKER_THREAD_STACK_BYTES};
use retainpdf_api::{run_servers_with_shutdown, stop_owned_workers_after_shutdown};

/// 手建 runtime 而不是 `#[tokio::main]`,只为显式设定 worker 栈大小,
/// 以及退出时先停掉 runtime、再停 worker。
///
/// InProcess 模式下 job 就跑在这个进程的 worker 线程上,与 jobsd 是同一条
/// 调用链,所以同样需要——见 `JOB_WORKER_THREAD_STACK_BYTES`。
fn main() -> anyhow::Result<()> {
    init_tracing();
    // Windows：API 被强杀时管线、渲染这些孙进程跟着没（见 `kill_descendants_on_exit`）。失败只记日志，照常起。
    if let Err(error) = retainpdf_proc::kill_descendants_on_exit() {
        tracing::warn!("could not tie worker processes to this process's lifetime: {error}");
    }
    let config = AppConfig::from_env()?;
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .thread_stack_size(JOB_WORKER_THREAD_STACK_BYTES)
        .build()?;
    let served = runtime.block_on(run_servers_with_shutdown(config.clone(), shutdown_signal()));
    // 先停 runtime：driver、读 stdout 的任务不再跑，下面被终止的 worker 不会被当成失败写进库。
    runtime.shutdown_timeout(Duration::from_secs(1));
    stop_owned_workers_after_shutdown(&config);
    served
}

/// 默认日志过滤。日志目标是写日志那段代码所在的 crate 名，rust_api 是 main.rs 自己。
/// 领域包、运行器里的日志都在各自的 crate 名下，拆出一个包就要在这里加一个，
/// 漏了的话它的 info 日志就看不到（2026-10-17 才补上拆出去的这些）。
const DEFAULT_LOG_FILTER: &str = "rust_api=info,tower_http=info,\
retainpdf_api=info,retainpdf_api_base=info,\
retainpdf_accounts=info,retainpdf_files=info,retainpdf_glossaries=info,\
retainpdf_ingest=info,retainpdf_jobs=info,retainpdf_library=info,retainpdf_platform=info,\
retainpdf_providers=info,\
retainpdf_config=info,retainpdf_core=info,retainpdf_data=info,retainpdf_db=info,retainpdf_runner=info,retainpdf_proc=info";

fn init_tracing() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| DEFAULT_LOG_FILTER.into()),
        )
        .init();
}

/// Resolve process termination to the graceful shutdown path so supervised
/// children (jobsd, ai service, workers) are terminated instead of orphaned.
/// On Windows this covers Ctrl-C / Ctrl-Break / console Close.
///
/// On Unix SIGTERM must be handled too: it is what `docker stop`, systemd and
/// Electron's `ChildProcess.kill()` send, and its default action kills the
/// process on the spot, leaving the supervised process groups orphaned.
#[cfg(unix)]
async fn shutdown_signal() {
    use tokio::signal::unix::{signal, SignalKind};

    match signal(SignalKind::terminate()) {
        Ok(mut terminate) => {
            tokio::select! {
                _ = tokio::signal::ctrl_c() => {}
                _ = terminate.recv() => tracing::info!("received SIGTERM, shutting down"),
            }
        }
        Err(error) => {
            tracing::warn!("failed to install SIGTERM handler: {error}");
            let _ = tokio::signal::ctrl_c().await;
        }
    }
}

#[cfg(not(unix))]
async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}

#[cfg(test)]
mod tests {
    use super::DEFAULT_LOG_FILTER;

    /// rust_api 依赖的每个 `retainpdf-*` 包都要在默认日志过滤里，否则它的 info 日志看不到。
    #[test]
    fn default_log_filter_covers_every_retainpdf_dependency() {
        let manifest = include_str!("../Cargo.toml");
        let directives: Vec<&str> = DEFAULT_LOG_FILTER.split(',').collect();
        let missing: Vec<String> = manifest
            .lines()
            .filter_map(|line| line.trim().strip_prefix("retainpdf-"))
            .filter_map(|rest| rest.split_whitespace().next())
            .map(|name| format!("retainpdf_{}=info", name.replace('-', "_")))
            .filter(|directive| !directives.contains(&directive.as_str()))
            .collect();
        assert!(missing.is_empty(), "默认日志过滤缺了：{missing:?}");
    }
}
