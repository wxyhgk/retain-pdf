use rust_api::config::AppConfig;
use rust_api::run_servers_with_shutdown;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
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
async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}
