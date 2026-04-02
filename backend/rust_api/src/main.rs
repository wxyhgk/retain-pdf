use rust_api::config::AppConfig;
use rust_api::run_servers;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rust_api=info,tower_http=info".into()),
        )
        .init();

    run_servers(AppConfig::from_env()?).await
}
