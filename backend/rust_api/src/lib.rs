pub mod auth;
pub mod config;
pub mod db;
pub mod error;
pub mod job_events;
pub mod job_failure;
pub mod job_runner;
pub mod models;
pub mod ocr_provider;
pub mod routes;
pub mod services;
pub mod storage_paths;

use std::collections::HashSet;
use std::future::pending;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;

use anyhow::Result;
use axum::extract::DefaultBodyLimit;
use axum::middleware;
use axum::routing::{get, post};
use axum::Router;
use tokio::sync::{oneshot, Mutex, RwLock, Semaphore};
use tokio::task::JoinHandle;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::config::AppConfig;
use crate::db::Db;
use crate::routes::glossaries;
use crate::routes::health;
use crate::routes::jobs;
use crate::routes::providers;
use crate::routes::uploads;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<AppConfig>,
    pub db: Arc<Db>,
    pub downloads_lock: Arc<Mutex<()>>,
    pub canceled_jobs: Arc<RwLock<HashSet<String>>>,
    pub job_slots: Arc<Semaphore>,
}

pub struct RunningServers {
    pub base_url: String,
    pub simple_base_url: String,
    shutdown_tx: Option<oneshot::Sender<()>>,
    join_handle: JoinHandle<Result<()>>,
}

impl RunningServers {
    pub async fn shutdown(mut self) -> Result<()> {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
        self.join_handle.await?
    }
}

pub fn build_state(config: Arc<AppConfig>) -> Result<AppState> {
    let db = Arc::new(Db::new(
        config.jobs_db_path.clone(),
        config.data_root.clone(),
    ));
    db.init()?;

    Ok(AppState {
        config: config.clone(),
        db,
        downloads_lock: Arc::new(Mutex::new(())),
        canceled_jobs: Arc::new(RwLock::new(HashSet::new())),
        job_slots: Arc::new(Semaphore::new(config.max_running_jobs)),
    })
}

pub fn build_app(state: AppState) -> Router {
    let api_routes = Router::new()
        .route(
            "/api/v1/ocr/jobs",
            post(jobs::create_ocr_job)
                .get(jobs::list_ocr_jobs)
                .layer(DefaultBodyLimit::disable()),
        )
        .route("/api/v1/ocr/jobs/:job_id", get(jobs::get_ocr_job))
        .route(
            "/api/v1/ocr/jobs/:job_id/events",
            get(jobs::get_ocr_job_events),
        )
        .route(
            "/api/v1/ocr/jobs/:job_id/artifacts",
            get(jobs::get_ocr_job_artifacts),
        )
        .route(
            "/api/v1/ocr/jobs/:job_id/artifacts-manifest",
            get(jobs::get_ocr_job_artifacts_manifest),
        )
        .route(
            "/api/v1/ocr/jobs/:job_id/artifacts/:artifact_key",
            get(jobs::download_ocr_artifact_by_key),
        )
        .route(
            "/api/v1/ocr/jobs/:job_id/normalized-document",
            get(jobs::download_ocr_normalized_document),
        )
        .route(
            "/api/v1/ocr/jobs/:job_id/normalization-report",
            get(jobs::download_ocr_normalization_report),
        )
        .route(
            "/api/v1/ocr/jobs/:job_id/cancel",
            post(jobs::cancel_ocr_job),
        )
        .route(
            "/api/v1/uploads",
            post(uploads::upload_pdf).layer(DefaultBodyLimit::disable()),
        )
        .route(
            "/api/v1/glossaries/parse-csv",
            post(glossaries::parse_glossary_csv_route),
        )
        .route(
            "/api/v1/glossaries",
            post(glossaries::create_glossary_route).get(glossaries::list_glossaries_route),
        )
        .route(
            "/api/v1/glossaries/:glossary_id",
            get(glossaries::get_glossary_route)
                .put(glossaries::update_glossary_route)
                .delete(glossaries::delete_glossary_route),
        )
        .route("/api/v1/jobs", post(jobs::create_job).get(jobs::list_jobs))
        .route("/api/v1/jobs/:job_id", get(jobs::get_job))
        .route("/api/v1/jobs/:job_id/events", get(jobs::get_job_events))
        .route(
            "/api/v1/jobs/:job_id/artifacts",
            get(jobs::get_job_artifacts),
        )
        .route(
            "/api/v1/jobs/:job_id/artifacts-manifest",
            get(jobs::get_job_artifacts_manifest),
        )
        .route(
            "/api/v1/jobs/:job_id/artifacts/:artifact_key",
            get(jobs::download_artifact_by_key),
        )
        .route("/api/v1/jobs/:job_id/pdf", get(jobs::download_pdf))
        .route(
            "/api/v1/jobs/:job_id/normalized-document",
            get(jobs::download_normalized_document),
        )
        .route(
            "/api/v1/jobs/:job_id/normalization-report",
            get(jobs::download_normalization_report),
        )
        .route(
            "/api/v1/jobs/:job_id/markdown",
            get(jobs::download_markdown),
        )
        .route(
            "/api/v1/jobs/:job_id/markdown/images/*path",
            get(jobs::download_markdown_image),
        )
        .route("/api/v1/jobs/:job_id/download", get(jobs::download_bundle))
        .route("/api/v1/jobs/:job_id/cancel", post(jobs::cancel_job))
        .route(
            "/api/v1/providers/mineru/validate-token",
            post(providers::validate_mineru_token),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_api_key,
        ));

    Router::new()
        .route("/health", get(health::health))
        .merge(api_routes)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

pub fn build_simple_app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::health))
        .route(
            "/api/v1/translate/bundle",
            post(jobs::translate_bundle).layer(DefaultBodyLimit::disable()),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_api_key,
        ))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn serve_with_shutdown(
    config: Arc<AppConfig>,
    shutdown: impl std::future::Future<Output = ()> + Send + 'static,
) -> Result<()> {
    let state = build_state(config.clone())?;
    let app = build_app(state.clone());
    let simple_app = build_simple_app(state);

    let bind_ip: IpAddr = config.bind_host.parse()?;
    let addr = SocketAddr::new(bind_ip, config.port);
    let simple_addr = SocketAddr::new(bind_ip, config.simple_port);
    tracing::info!(
        "rust_api auth enabled: {} keys, max running jobs: {}",
        config.api_keys.len(),
        config.max_running_jobs
    );
    tracing::info!("rust_api full api listening on {}", addr);
    tracing::info!("rust_api simple api listening on {}", simple_addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    let simple_listener = tokio::net::TcpListener::bind(simple_addr).await?;

    let shutdown_signal = Arc::new(tokio::sync::Notify::new());
    let shutdown_waiter = shutdown_signal.clone();
    tokio::spawn(async move {
        shutdown.await;
        shutdown_waiter.notify_waiters();
    });

    let full_server = axum::serve(listener, app).with_graceful_shutdown({
        let shutdown_signal = shutdown_signal.clone();
        async move { shutdown_signal.notified().await }
    });
    let simple_server = axum::serve(simple_listener, simple_app)
        .with_graceful_shutdown(async move { shutdown_signal.notified().await });

    tokio::try_join!(full_server, simple_server)?;
    Ok(())
}

pub async fn run_servers(config: AppConfig) -> Result<()> {
    serve_with_shutdown(Arc::new(config), pending()).await
}

pub fn spawn_servers(config: AppConfig) -> RunningServers {
    let base_url = format!("http://127.0.0.1:{}", config.port);
    let simple_base_url = format!("http://127.0.0.1:{}", config.simple_port);
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    let config = Arc::new(config);
    let join_handle = tokio::spawn(async move {
        serve_with_shutdown(config, async move {
            let _ = shutdown_rx.await;
        })
        .await
    });

    RunningServers {
        base_url,
        simple_base_url,
        shutdown_tx: Some(shutdown_tx),
        join_handle,
    }
}
