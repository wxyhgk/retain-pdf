use std::sync::Arc;

use anyhow::Result;

use crate::config::AppConfig;
use crate::db::Db;
use crate::job_runner::{
    acquire_runtime_owner_lock, adopt_unlinked_job_sources, fail_unlaunched_job, launch_job,
    reconcile_stale_running_jobs, recover_jobs_after_database_restore, requeue_stuck_queued_jobs,
    spawn_driverless_job_sweeper, spawn_job, terminate_running_workers_on_shutdown, ProcessRuntimeDeps,
    RuntimeOwnerLock,
};
use crate::services::jobs::{
    build_jobs_facade, CommandJobsDeps, ControlDeps, JobLaunchDeps, JobRuntimeLauncher, JobsFacade,
    JobSubmitDeps, QueryJobsDeps, ReplayDeps, SnapshotBuildDeps,
};

use super::state::AppState;

/// 进程内模式下，真实服务在 `build_state`（里面有启动对账）之前先拿任务库的运行时锁；拿不到说明
/// 同一个任务库上已经有运行时（另一个进程内模式的 rust_api，或者 jobsd），直接报错退出、不对账。
/// 远端模式不拿：壳不对账，锁归 jobsd。只在 `serve_with_shutdown` 里调——单测直接调 `build_state`，
/// 同一个测试进程里并存好几个 `AppState` 也不受影响。
pub(super) fn acquire_owned_runtime_lock(config: &AppConfig) -> Result<Option<RuntimeOwnerLock>> {
    if config.jobs_service.is_remote() {
        return Ok(None);
    }
    acquire_runtime_owner_lock(&config.jobs_db_path).map(Some)
}

/// 进程内模式的后端退出时停掉还在跑的 worker（用户 2026-10-24 定，见
/// `terminate_running_workers_on_shutdown`）。要在 tokio 运行时停掉以后调（`main.rs`）：driver 不再写库。
///
/// 停机返回时运行时锁已经放了，这里重新拿一次：拿不到说明新的运行时已经接手（例如马上重开了应用），
/// 库里 running 任务的 worker 可能是它的，一个都不碰。远端模式不管（worker 归 jobsd）。
pub fn stop_owned_workers_after_shutdown(config: &AppConfig) {
    if config.jobs_service.is_remote() {
        return;
    }
    let _lock = match acquire_runtime_owner_lock_after_release(&config.jobs_db_path) {
        Ok(lock) => lock,
        Err(error) => {
            tracing::warn!("shutdown: runtime lock is held by another process; leaving its workers alone: {error:#}");
            return;
        }
    };
    let db = Db::new(config.jobs_db_path.clone(), config.data_root.clone());
    match terminate_running_workers_on_shutdown(config, &db) {
        Ok(0) => {}
        Ok(count) => tracing::info!("shutdown: terminated {count} running worker(s); they resume on next start"),
        Err(error) => tracing::warn!("shutdown: could not list running workers: {error:#}"),
    }
}

/// 停机时自己刚放掉运行时锁，马上重新拿：在 1 秒内反复试，过了还拿不到才算别的运行时在用。
///
/// 锁是 flock，挂在打开的文件上。别的线程这时正好 fork 子进程的话，子进程在 exec 之前也拿着这个文件，
/// 锁跟着它多留一会儿；只试一次就会把自己的 worker 当成别人的、一个都不停（并发跑测试时偶发，2026-11-04）。
fn acquire_runtime_owner_lock_after_release(jobs_db_path: &std::path::Path) -> Result<RuntimeOwnerLock> {
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(1);
    loop {
        match acquire_runtime_owner_lock(jobs_db_path) {
            Ok(lock) => return Ok(lock),
            Err(error) if std::time::Instant::now() >= deadline => return Err(error),
            Err(_) => std::thread::sleep(std::time::Duration::from_millis(20)),
        }
    }
}

pub(super) fn reconcile_owned_runtime(config: &AppConfig, db: &Db) -> Result<usize> {
    if config.jobs_service.is_remote() {
        // Remote jobs are owned by retain-jobsd. A shell restart must not
        // reinterpret jobsd-owned workers as orphaned processes.
        return Ok(0);
    }
    reconcile_stale_running_jobs(config, db)
}

/// 启动时把还没归属到书的老任务（从 `source_url` 建的、早年没登记上传的）按原文 PDF 归到书上。
/// 有了书，书架、文件清单里的原文都能走书的地址 `/documents/:id/files/source.pdf`。
pub(super) fn adopt_unlinked_job_documents(config: &AppConfig, db: &Db) -> Result<usize> {
    adopt_unlinked_job_sources(config, db)
}

pub(super) fn resume_requeued_pipeline_jobs(state: &AppState) -> Result<usize> {
    if state.config.jobs_service.is_remote() {
        return Ok(0);
    }
    let job_ids = state.db.list_resumable_pipeline_job_ids()?;
    for job_id in &job_ids {
        spawn_job(build_process_runtime_deps(state), job_id.clone());
    }
    let stuck = requeue_stuck_queued_jobs(&state.config, &state.db)?;
    for job_id in &stuck {
        spawn_job(build_process_runtime_deps(state), job_id.clone());
    }
    Ok(job_ids.len() + stuck.len())
}

/// 运行期巡检：定期回收「库里 queued/running、进程内却没有 driver」的任务（发射丢了的）。
/// 远端模式 driver 在 jobsd 里，由 jobsd 自己巡检，壳不碰。
pub(super) fn start_driverless_sweeper(state: &AppState) -> Option<tokio::task::JoinHandle<()>> {
    if state.config.jobs_service.is_remote() {
        return None;
    }
    Some(spawn_driverless_job_sweeper(build_process_runtime_deps(state)))
}

/// 数据库从备份恢复后，立即对账备份里带回来的排队/运行中任务（规则同启动恢复，见
/// `recover_jobs_after_database_restore`）。远端模式 driver 在 jobsd 里，壳不碰：恢复时 pid
/// 已经清掉，jobsd 的运行期巡检（每 30 秒）会接手，不会误杀进程。
pub(super) fn install_restore_recovery(state: &AppState) {
    if state.config.jobs_service.is_remote() {
        return;
    }
    let deps = build_process_runtime_deps(state);
    state
        .backup
        .set_after_restore(Arc::new(move || recover_jobs_after_database_restore(&deps)));
}

fn build_process_runtime_deps(state: &AppState) -> ProcessRuntimeDeps {
    ProcessRuntimeDeps::new(
        state.config.clone(),
        state.db.clone(),
        state.canceled_jobs.clone(),
        state.job_slots.clone(),
        state.job_drivers.clone(),
    )
}

pub fn build_jobs_facade_from_state(state: &AppState) -> JobsFacade<'_> {
    // ADR-002：发射落点二选一。进程内是历史行为；远端把任务交给 jobsd，
    // 于是壳重启不再牵连正在跑的 worker。
    let runtime_launcher = if state.config.jobs_service.is_remote() {
        let job_runtime = state.job_runtime.clone();
        let runtime_state = state.clone();
        JobRuntimeLauncher::new(Arc::new(move |job_id| {
            let job_runtime = job_runtime.clone();
            let runtime_state = runtime_state.clone();
            tokio::spawn(async move {
                // 重试之后仍交不出去：任务行是 queued、jobsd 不知道它，没人会跑 → 落成失败，写清原因。
                if let Err(error) = job_runtime.launch_remote(job_id.clone()).await {
                    let deps = build_process_runtime_deps(&runtime_state);
                    let reason = error.to_string();
                    let outcome = tokio::task::spawn_blocking(move || {
                        fail_unlaunched_job(&deps, &job_id, &reason)
                    })
                    .await;
                    if !matches!(outcome, Ok(Ok(_))) {
                        tracing::error!("remote launch failed and the job could not be marked failed: {outcome:?}");
                    }
                }
            });
        }))
    } else {
        let runtime_state = state.clone();
        JobRuntimeLauncher::new(Arc::new(move |job_id| {
            launch_job(build_process_runtime_deps(&runtime_state), job_id)
        }))
    };
    build_jobs_facade_with_launcher(state, runtime_launcher)
}

/// 同上，任务交给 `runtime_launcher` 发射。测试用它换一个只记下任务编号、不真跑的发射器。
pub(crate) fn build_jobs_facade_with_launcher(
    state: &AppState,
    runtime_launcher: JobRuntimeLauncher,
) -> JobsFacade<'_> {
    let launcher = JobLaunchDeps::new(
        state.db.as_ref(),
        &state.config.data_root,
        &state.config.output_root,
        runtime_launcher,
    )
    .with_platform(state.config.accounts.mode.is_multi().then_some(
        crate::services::accounts::PlatformSource {
            db: state.db.as_ref(),
            env: &state.config.accounts.platform,
        },
    ))
    .with_page_quota(state.config.accounts.mode.is_multi())
    .with_min_free_disk(state.config.min_free_disk_bytes)
    .with_max_queued_jobs(state.config.job_runner.max_queued_jobs);
    let snapshot = SnapshotBuildDeps::new(state.db.as_ref(), state.config.job_snapshot_runtime());
    let submit = JobSubmitDeps::new(snapshot, launcher);
    let control = ControlDeps::new(
        state.db.as_ref(),
        &state.config.job_runner,
        &state.config.data_root,
        &state.config.output_root,
        state.job_runtime.as_ref(),
    );
    let replay = ReplayDeps::new(
        &state.config.project_root,
        &state.config.scripts_dir,
        &state.config.python_bin,
        &state.config.pipeline_command,
        &state.config.data_root,
    );
    build_jobs_facade(
        CommandJobsDeps::new(state.db.as_ref(), submit, control),
        QueryJobsDeps::new(state.db.as_ref(), &state.config.data_root, replay),
    )
}
