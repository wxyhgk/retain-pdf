use rust_api::config::{AppConfig, JOB_WORKER_THREAD_STACK_BYTES};
use rust_api::run_servers_with_shutdown;

/// 手建 runtime 而不是 `#[tokio::main]`,只为显式设定 worker 栈大小。
///
/// InProcess 模式下 job 就跑在这个进程的 worker 线程上,与 jobsd 是同一条
/// 调用链,所以同样需要——见 `JOB_WORKER_THREAD_STACK_BYTES`。
fn main() -> anyhow::Result<()> {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .thread_stack_size(JOB_WORKER_THREAD_STACK_BYTES)
        .build()?
        .block_on(run())
}

async fn run() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rust_api=info,tower_http=info".into()),
        )
        .init();

    run_servers_with_shutdown(AppConfig::from_env()?, shutdown_signal()).await
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
