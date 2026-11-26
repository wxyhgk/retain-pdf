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
use std::time::Duration;

use anyhow::{Context, Result};
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::json;
use tokio::sync::{RwLock, Semaphore};

use retainpdf_core::config::{AppConfig, JOB_WORKER_THREAD_STACK_BYTES};
use retainpdf_data::db::Db;
use retainpdf_runner::job_runner::{
    acquire_runtime_owner_lock, clear_cancel_request_with_registry, launch_job as launch_new_run,
    reconcile_stale_running_jobs, registered_running_worker, request_cancel_with_registry,
    requeue_stuck_queued_jobs, spawn_driverless_job_sweeper, spawn_job,
    stop_owned_workers_after_runtime_shutdown, terminate_job_process_tree, ProcessRuntimeDeps,
    RuntimeOwnerLock,
};

#[cfg(test)]
mod contract_lock;

#[cfg(test)]
mod tests {
    use super::{validate_terminate_pid, TerminateRejection};

    /// 回归（状态审计 6-#3 第 5 步）：pid=0 会变成 `kill(0, …)`（jobsd 自己的进程组），pid=1 会变成
    /// `kill(-1, …)`（当前用户的所有进程）。只在这里测 1：改坏了的版本在真实接口上跑这个用例会杀掉一切。
    #[test]
    fn terminate_rejects_pid_zero_and_one_before_any_lookup() {
        assert_eq!(validate_terminate_pid(0), Err(TerminateRejection::InvalidPid));
        assert_eq!(validate_terminate_pid(1), Err(TerminateRejection::InvalidPid));
        assert_eq!(validate_terminate_pid(2), Ok(()));
    }
}

#[derive(Clone)]
struct JobsdState {
    config: Arc<AppConfig>,
    db: Arc<Db>,
    canceled_jobs: Arc<RwLock<HashSet<String>>>,
    job_slots: Arc<Semaphore>,
    job_drivers: Arc<retainpdf_runner::job_runner::JobDriverRegistry>,
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
/// 没配 key 时谁都不放（以前是全放；配置加载保证非空，那条路走不到，但写法是"出错就放行"）。
fn authorized(state: &JobsdState, headers: &HeaderMap) -> bool {
    headers
        .get("X-API-Key")
        .and_then(|value| value.to_str().ok())
        .map(|key| retainpdf_core::config::api_key_matches(&state.api_keys, key.trim()))
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
    launch_new_run(state.runtime_deps(), job_id);
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

/// terminate 接口不受理的 pid。
#[derive(Debug, PartialEq, Eq)]
enum TerminateRejection {
    /// 0 / 1 不可能是 worker：`kill(-0)` 是 jobsd 自己的进程组，`kill(-1)` 是当前用户能发信号的所有进程。
    InvalidPid,
    /// 库里没有 running 任务记着这个 pid，或者记着但身份对不上（worker 已退出、号被复用）。
    NotARegisteredWorker,
}

impl TerminateRejection {
    fn response(&self) -> (StatusCode, Json<serde_json::Value>) {
        let (status, reason) = match self {
            Self::InvalidPid => (StatusCode::BAD_REQUEST, "invalid_pid"),
            Self::NotARegisteredWorker => (StatusCode::NOT_FOUND, "not_a_registered_worker"),
        };
        (status, Json(json!({ "accepted": false, "reason": reason })))
    }
}

/// 不碰库、不碰进程的那一半：pid 本身合不合法。
fn validate_terminate_pid(pid: u32) -> Result<(), TerminateRejection> {
    if pid <= 1 {
        return Err(TerminateRejection::InvalidPid);
    }
    Ok(())
}

/// 只杀自己登记过的 worker：某个 running 任务记着这个 pid，且 spawn 时记下的进程身份对得上
/// （`registered_running_worker`，和启动对账同一套核对）。
fn check_terminate_target(db: &Db, pid: u32) -> Result<(), TerminateRejection> {
    validate_terminate_pid(pid)?;
    match registered_running_worker(db, pid) {
        Ok(Some(_job_id)) => Ok(()),
        Ok(None) => Err(TerminateRejection::NotARegisteredWorker),
        Err(error) => {
            // 查不了库就不杀：宁可让这次取消晚一点生效，也不按一个核对不了的 pid 组杀。
            tracing::warn!("terminate pid={pid}: worker registry lookup failed: {error:#}");
            Err(TerminateRejection::NotARegisteredWorker)
        }
    }
}

async fn terminate_process(
    State(state): State<JobsdState>,
    headers: HeaderMap,
    Path(pid): Path<u32>,
) -> (StatusCode, Json<serde_json::Value>) {
    if !authorized(&state, &headers) {
        return unauthorized();
    }
    if let Err(rejection) = check_terminate_target(&state.db, pid) {
        tracing::warn!("terminate pid={pid} refused: {rejection:?}");
        return rejection.response();
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

/// 手建 runtime 而不是 `#[tokio::main]`,只为显式设定 worker 栈大小,
/// 以及退出时先停掉 runtime、再停 worker（和进程内模式的 rust_api 一样）。
/// 见 [`JOB_WORKER_THREAD_STACK_BYTES`]:默认的 2 MiB 会让 book 工作流栈溢出,
/// 而溢出杀死的是整个 jobsd 进程,不只是那一个 job。
fn main() -> Result<()> {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .thread_stack_size(JOB_WORKER_THREAD_STACK_BYTES)
        .build()
        .context("build jobsd runtime")?;
    let stopped = runtime.block_on(run());
    // 先停 runtime：driver、读 stdout 的任务不再跑，下面被终止的 worker 不会被当成失败写进库。
    // 最多等 1 秒（spawn_blocking 里的任务不等，进程马上就退出）。
    runtime.shutdown_timeout(Duration::from_secs(1));
    let stopped = stopped?;
    // 退出时停掉自己起的 worker（用户 2026-10-24、11-26 定）。以前 jobsd 收到 SIGTERM 直接死、监督者没了就
    // `exit(0)`，worker 成了孤儿，接着花模型的钱，直到下次启动才被对账杀掉（状态管理设计 S04）。
    // 运行时锁一直拿到停完：停的过程中别的运行时接手不了，也就不会去对账这些 worker。
    stop_owned_workers_after_runtime_shutdown(&stopped.config, Some(stopped.runtime_owner));
    Ok(())
}

/// `run` 正常结束（收到停机信号）后交回来的东西：停 worker 要用的配置和还拿着的运行时锁。
struct Stopped {
    config: Arc<AppConfig>,
    runtime_owner: RuntimeOwnerLock,
}

/// 等到该停的时候：SIGTERM（监督者 rust_api 退出时组杀、`docker stop`、systemd）、Ctrl-C，或者监督者
/// 被强杀（不在了，没人会再给 SIGTERM）。返回原因，只用来写日志。
async fn shutdown_requested(terminate: TerminateSignal) -> &'static str {
    tokio::select! {
        reason = termination_signal(terminate) => reason,
        _ = retainpdf_proc::wait_for_supervisor_exit() => "supervisor process exited",
    }
}

/// SIGTERM 的处理要在开端口之前装好（2026-11-26）：端口一开，监督者（和测试）就当 jobsd 起来了、随时会发 SIGTERM；
/// 装好之前到的 SIGTERM 走默认动作，jobsd 直接死、自己起的 worker 成孤儿。`signal()` 一调就登记，不用等第一次 poll。
#[cfg(unix)]
type TerminateSignal = std::io::Result<tokio::signal::unix::Signal>;
#[cfg(not(unix))]
type TerminateSignal = ();

#[cfg(unix)]
fn install_terminate_signal() -> TerminateSignal {
    tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
}

#[cfg(not(unix))]
fn install_terminate_signal() -> TerminateSignal {}

#[cfg(unix)]
async fn termination_signal(terminate: TerminateSignal) -> &'static str {
    match terminate {
        Ok(mut terminate) => {
            tokio::select! {
                _ = tokio::signal::ctrl_c() => "received Ctrl-C",
                _ = terminate.recv() => "received SIGTERM",
            }
        }
        Err(error) => {
            tracing::warn!("failed to install SIGTERM handler: {error}");
            let _ = tokio::signal::ctrl_c().await;
            "received Ctrl-C"
        }
    }
}

/// Windows 没有 SIGTERM：桌面壳用 `taskkill /T /F` 连 worker 一起强杀，不走这里；Ctrl-C 照样有序停。
#[cfg(not(unix))]
async fn termination_signal(_terminate: TerminateSignal) -> &'static str {
    let _ = tokio::signal::ctrl_c().await;
    "received Ctrl-C"
}

async fn run() -> Result<Stopped> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();
    // Windows：jobsd 被强杀时它起的 worker 跟着没（见 `retainpdf_proc::kill_descendants_on_exit`）。失败只记日志。
    if let Err(error) = retainpdf_proc::kill_descendants_on_exit() {
        tracing::warn!("could not tie worker processes to this process's lifetime: {error}");
    }

    // 开端口之前装好 SIGTERM（见 `install_terminate_signal`）
    let terminate = install_terminate_signal();

    let config = Arc::new(AppConfig::from_env().context("load config")?);
    let port = config.jobs_service.port;
    let bind_host = config.jobs_service.bind_host.clone();
    // Acquire the runtime-owner lease before touching running jobs. If a
    // second jobsd is started accidentally, it must fail on bind without
    // reconciling workers owned by the existing instance.
    let listener = tokio::net::TcpListener::bind((bind_host.as_str(), port))
        .await
        .with_context(|| format!("bind {bind_host}:{port}"))?;

    // 端口只挡得住同一个端口上的二次启动；同一个任务库上的另一个运行时（进程内模式的 rust_api、
    // 换了端口的 jobsd）靠运行时锁挡。拿不到就退出，不对账——对账会杀掉那个运行时正在管的 worker。
    let runtime_owner = acquire_runtime_owner_lock(&config.jobs_db_path)?;

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

    // 运行期巡检：发射丢了、driver 没落终态的任务，不用等下次启动。
    let _driverless_sweep_handle = spawn_driverless_job_sweeper(state.runtime_deps());

    tracing::info!("retain-jobsd listening on {bind_host}:{port}");
    let config = state.config.clone();
    tokio::select! {
        served = axum::serve(listener, build_router(state)) => {
            // 正常不会走到这里（serve 只在监听出错时返回）；照样按停机收尾，停掉 worker 再退出。
            if let Err(error) = served {
                tracing::error!("retain-jobsd serve failed: {error:#}");
            }
        }
        reason = shutdown_requested(terminate) => {
            // 不等还开着的连接：壳那边已经在退出，launch/cancel 这些请求丢了也没关系。
            tracing::warn!("{reason}; retain-jobsd stopping its workers and shutting down");
        }
    }
    Ok(Stopped { config, runtime_owner })
}
