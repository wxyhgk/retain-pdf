//! retain-jobsd：任务运行时守护进程（ADR-002：壳 + 后端进程组）。
//!
//! 它只做一件事：**拥有 worker 子进程的生命周期**。壳（rust_api）经内部
//! HTTP 把 launch/cancel/terminate 交过来，契约见
//! `backend-root/contracts/jobs-control.v1.schema.json`。
//!
//! 这么切的理由是变更频率：路由与业务逻辑天天改，任务调度几周才动一次。
//! 拆开之后改壳只重启壳，正在跑的翻译任务毫发无伤——这正是拆分要买的东西。
//!
//! 数据面不经 HTTP：jobsd 与壳共用同一个 SQLite（已启用 WAL + busy_timeout），
//! 任务状态由 jobsd 写、壳直接读，进度/SSE 因此无需任何跨进程改造。

use std::collections::HashSet;
use std::sync::Arc;

use anyhow::{Context, Result};
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::json;
use tokio::sync::{RwLock, Semaphore};

use retain_core::config::AppConfig;
use retain_data::db::Db;
use retain_jobs::job_runner::{
    clear_cancel_request_with_registry, reconcile_stale_running_jobs, request_cancel_with_registry,
    requeue_stuck_queued_jobs, spawn_job, terminate_job_process_tree, ProcessRuntimeDeps,
};

#[cfg(test)]
mod contract_lock;

#[derive(Clone)]
struct JobsdState {
    config: Arc<AppConfig>,
    db: Arc<Db>,
    canceled_jobs: Arc<RwLock<HashSet<String>>>,
    job_slots: Arc<Semaphore>,
    job_drivers: Arc<retain_jobs::job_runner::JobDriverRegistry>,
    api_keys: Arc<HashSet<String>>,
}

impl JobsdState {
    fn runtime_deps(&self) -> ProcessRuntimeDeps {
        ProcessRuntimeDeps::new(
            self.config.clone(),
            self.db.clone(),
            self.canceled_jobs.clone(),
            self.job_slots.clone(),
            self.job_drivers.clone(),
        )
    }
}

/// 鉴权：与壳同源的 RETAIN_API_KEYS。仅监听回环，这层是纵深防御而非边界。
fn authorized(state: &JobsdState, headers: &HeaderMap) -> bool {
    if state.api_keys.is_empty() {
        return true;
    }
    headers
        .get("X-API-Key")
        .and_then(|value| value.to_str().ok())
        .map(|key| state.api_keys.contains(key.trim()))
        .unwrap_or(false)
}

fn ack() -> (StatusCode, Json<serde_json::Value>) {
    (StatusCode::OK, Json(json!({ "accepted": true })))
}

fn unauthorized() -> (StatusCode, Json<serde_json::Value>) {
    (StatusCode::UNAUTHORIZED, Json(json!({ "accepted": false })))
}

async fn launch_job(
    State(state): State<JobsdState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !authorized(&state, &headers) {
        return unauthorized();
    }
    // 与拆分前闭包同语义：受理即返回，任务异步跑。
    tracing::info!("launch job {job_id}");
    spawn_job(state.runtime_deps(), job_id);
    ack()
}

async fn cancel_job(
    State(state): State<JobsdState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !authorized(&state, &headers) {
        return unauthorized();
    }
    request_cancel_with_registry(&state.canceled_jobs, &job_id).await;
    ack()
}

async fn clear_cancel_job(
    State(state): State<JobsdState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !authorized(&state, &headers) {
        return unauthorized();
    }
    clear_cancel_request_with_registry(&state.canceled_jobs, &job_id).await;
    ack()
}

async fn terminate_process(
    State(state): State<JobsdState>,
    headers: HeaderMap,
    Path(pid): Path<u32>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !authorized(&state, &headers) {
        return unauthorized();
    }
    match terminate_job_process_tree(
        pid,
        state.config.job_runner.worker_terminate_grace_secs,
        state.config.job_runner.worker_terminate_poll_ms,
    )
    .await
    {
        Ok(()) => ack(),
        Err(error) => {
            tracing::warn!("terminate pid={pid} failed: {error}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "accepted": false })),
            )
        }
    }
}

fn build_router(state: JobsdState) -> Router {
    Router::new()
        .route("/healthz", get(|| async { Json(json!({ "ok": true })) }))
        .route("/internal/v1/jobs/:job_id/launch", post(launch_job))
        .route(
            "/internal/v1/jobs/:job_id/cancel",
            post(cancel_job).delete(clear_cancel_job),
        )
        .route(
            "/internal/v1/processes/:pid/terminate",
            post(terminate_process),
        )
        .with_state(state)
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let config = Arc::new(AppConfig::from_env().context("load config")?);
    let port = config.jobs_service.port;
    let bind_host = config.jobs_service.bind_host.clone();
    // Acquire the runtime-owner lease before touching running jobs. If a
    // second jobsd is started accidentally, it must fail on bind without
    // reconciling workers owned by the existing instance.
    let listener = tokio::net::TcpListener::bind((bind_host.as_str(), port))
        .await
        .with_context(|| format!("bind {bind_host}:{port}"))?;

    let db = Arc::new(Db::new(
        config.jobs_db_path.clone(),
        config.data_root.clone(),
    ));
    // 建表由壳负责（它是先起来的那个）；这里只确保 schema 就绪即可，
    // WAL 下多进程各自 init 是幂等的。
    db.init().context("init db")?;
    reconcile_stale_running_jobs(config.as_ref(), db.as_ref())
        .context("reconcile stale jobsd workers")?;

    let state = JobsdState {
        api_keys: Arc::new(config.api_keys.clone()),
        job_slots: Arc::new(Semaphore::new(config.max_running_jobs)),
        job_drivers: Arc::default(),
        canceled_jobs: Arc::new(RwLock::new(HashSet::new())),
        db,
        config,
    };
    let resumable_job_ids = state
        .db
        .list_resumable_pipeline_job_ids()
        .context("list resumable pipeline jobs")?;
    for job_id in resumable_job_ids {
        tracing::warn!("jobsd startup resuming durable pipeline job {job_id}");
        spawn_job(state.runtime_deps(), job_id);
    }
    for job_id in requeue_stuck_queued_jobs(state.config.as_ref(), &state.db)
        .context("requeue stuck queued jobs")?
    {
        tracing::warn!("jobsd startup requeuing stuck queued job {job_id}");
        spawn_job(state.runtime_deps(), job_id);
    }

    tracing::info!("retain-jobsd listening on {bind_host}:{port}");
    axum::serve(listener, build_router(state))
        .await
        .context("serve")?;
    Ok(())
}
