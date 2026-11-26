//! 任务运行时（进程内模式的 rust_api、retain-jobsd）退出时，停掉还在跑的 worker。
//!
//! worker 自成进程组、没有 `kill_on_drop`，运行时退出后它们接着跑：桌面版关掉以后接着翻、接着花模型的钱，
//! 没人读它的 stdout，进度也不进库，直到下次启动被 `reconcile_stale_running_jobs` 杀掉。
//! 用户 2026-10-24 定：退出时停掉（11-26 再确认：打包桌面版走 jobsd，也要停）。Docker 里容器停了进程本来就全没，
//! 这里只是一样的结果提前到退出时。
//!
//! 停之前 worker 先收到 SIGTERM：Python 翻译借这段宽限把在途的模型请求等回来、在请求日志里写上终态
//! （`retainpdf_translation/workflow/shutdown_drain.py`），宽限到了还没回来的留成「结果不明」。
//! 下次启动的对账看请求日志：干净的自动续跑，有结果不明的请求就不自动续跑、等用户确认（用户 11-26 定）。

use std::path::Path;
use std::time::{Duration, Instant};

use anyhow::Result;
use tracing::{info, warn};

use crate::config::AppConfig;
use crate::db::Db;
use crate::models::domain::JobStatusKind;

use super::runtime_owner::{acquire_runtime_owner_lock, RuntimeOwnerLock};
use super::worker_identity::{classify_process_record, RecordedWorker};
use super::worker_process::terminate_job_process_tree_blocking;

/// 终止库里 running 任务还活着的 worker 进程树（杀之前核对进程身份，pid 被别的进程复用了不碰），**不改库**：
/// 任务行留在 running，下次启动由 `reconcile_stale_running_jobs` 接手：请求日志干净、有检查点的自动续跑；
/// 翻译阶段留下了结果不明的请求的，不自动续跑，落 `translation_request_ambiguous` 等用户确认。
///
/// 调用前要先停掉 tokio 运行时：driver 和读 stdout 的任务不再跑，不会把被终止的 worker 当成失败写进库。
/// 几个 worker 并行终止（各自 SIGTERM、宽限 `worker_terminate_grace_secs` 后 SIGKILL），桌面版只给后端 10 秒退出。
/// 返回终止了几个。调用方要拿着运行时锁（见 [`stop_owned_workers_after_runtime_shutdown`]）。
pub fn terminate_running_workers_on_shutdown(config: &AppConfig, db: &Db) -> Result<usize> {
    let pids: Vec<(String, u32)> = db
        .list_job_process_records_with_status(&JobStatusKind::Running)?
        .into_iter()
        .filter_map(|record| match classify_process_record(&record) {
            Some((pid, RecordedWorker::Ours)) => Some((record.job_id.clone(), pid)),
            _ => None,
        })
        .collect();
    let grace = config.job_runner.worker_terminate_grace_secs;
    let poll = config.job_runner.worker_terminate_poll_ms;
    std::thread::scope(|scope| {
        for (job_id, pid) in &pids {
            scope.spawn(move || {
                info!("shutdown: terminating worker pid={pid} of job {job_id}; next start reconciles it");
                if let Err(error) = terminate_job_process_tree_blocking(*pid, grace, poll) {
                    warn!("shutdown: failed to terminate worker pid={pid} of job {job_id}: {error:#}");
                }
            });
        }
    });
    Ok(pids.len())
}

/// 运行时停下以后停掉自己的 worker：进程内模式的 rust_api 和 retain-jobsd 退出时都走这里。
/// 要在 tokio 运行时停掉以后调：driver 不再写库。
///
/// `owner_lock`：还拿着运行时锁就交进来（jobsd 一直拿到这里），停完才放；已经放掉的传 `None`，这里重新拿
/// （进程内模式的锁随 `serve_with_shutdown` 返回放掉）。重新拿不到说明新的运行时已经接手（例如马上重开了应用），
/// 库里 running 任务的 worker 可能是它的，一个都不碰。返回终止了几个。
pub fn stop_owned_workers_after_runtime_shutdown(
    config: &AppConfig,
    owner_lock: Option<RuntimeOwnerLock>,
) -> usize {
    let _lock = match owner_lock {
        Some(lock) => lock,
        None => match acquire_runtime_owner_lock_after_release(&config.jobs_db_path) {
            Ok(lock) => lock,
            Err(error) => {
                warn!("shutdown: runtime lock is held by another process; leaving its workers alone: {error:#}");
                return 0;
            }
        },
    };
    let db = Db::new(config.jobs_db_path.clone(), config.data_root.clone());
    match terminate_running_workers_on_shutdown(config, &db) {
        Ok(0) => 0,
        Ok(count) => {
            info!(
                "shutdown: terminated {count} running worker(s); next start resumes them unless the request journal has unresolved requests"
            );
            count
        }
        Err(error) => {
            warn!("shutdown: could not list running workers: {error:#}");
            0
        }
    }
}

/// 停机时自己刚放掉运行时锁，马上重新拿：在 1 秒内反复试，过了还拿不到才算别的运行时在用。
///
/// 锁是 flock，挂在打开的文件上。别的线程这时正好 fork 子进程的话，子进程在 exec 之前也拿着这个文件，
/// 锁跟着它多留一会儿；只试一次就会把自己的 worker 当成别人的、一个都不停（并发跑测试时偶发，2026-11-04）。
fn acquire_runtime_owner_lock_after_release(jobs_db_path: &Path) -> Result<RuntimeOwnerLock> {
    let deadline = Instant::now() + Duration::from_secs(1);
    loop {
        match acquire_runtime_owner_lock(jobs_db_path) {
            Ok(lock) => return Ok(lock),
            Err(error) if Instant::now() >= deadline => return Err(error),
            Err(_) => std::thread::sleep(Duration::from_millis(20)),
        }
    }
}

#[cfg(all(test, any(target_os = "linux", target_os = "macos")))]
mod tests {
    use std::os::unix::process::CommandExt;

    use crate::models::domain::{JobSnapshot, JobStatusKind};
    use crate::models::request::CreateJobInput;

    fn spawn_group_leader_sleep() -> std::process::Child {
        std::process::Command::new("sleep")
            .arg("60")
            .process_group(0)
            .spawn()
            .expect("spawn sleep")
    }

    fn seed_running(db: &crate::db::Db, id: &str, pid: u32) {
        let mut job = JobSnapshot::new(id.to_string(), CreateJobInput::default(), vec![]);
        job.status = JobStatusKind::Running;
        job.stage = Some("translating".to_string());
        job.pid = Some(pid);
        db.save_job(&job).expect("save job");
    }

    /// 自己的 worker 被终止，任务行一个字都不改（留给下次启动的对账）；pid 被复用了的不碰。
    #[test]
    fn shutdown_terminates_our_workers_and_leaves_the_rows_for_next_start() {
        let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
        let db = deps.db.as_ref();
        let mut ours = spawn_group_leader_sleep();
        seed_running(db, "ours", ours.id());
        db.record_worker_identity("ours", retainpdf_proc::process_identity(ours.id()).as_deref())
            .unwrap();
        let mut stranger = spawn_group_leader_sleep();
        seed_running(db, "reused", stranger.id());
        db.record_worker_identity("reused", Some(&format!("{}@darwin:1.000000", stranger.id())))
            .unwrap();
        let before = db.get_job("ours").unwrap();

        let terminated = super::terminate_running_workers_on_shutdown(&deps.config, db).expect("shutdown");

        assert_eq!(terminated, 1);
        assert!(!ours.wait().expect("reap").success(), "自己的 worker 应被信号终止");
        std::thread::sleep(std::time::Duration::from_millis(200));
        assert!(stranger.try_wait().expect("poll").is_none(), "pid 被复用的进程不能碰");
        let after = db.get_job("ours").unwrap();
        assert_eq!(after.status, JobStatusKind::Running);
        assert_eq!(after.pid, before.pid);
        assert_eq!(after.updated_at, before.updated_at);
        let _ = stranger.kill();
        let _ = stranger.wait();
        let _ = std::fs::remove_dir_all(deps.config.project_root.clone());
    }

    /// jobsd 一直拿着运行时锁到停 worker：锁交进来就直接停，不再重新拿（重新拿会撞上自己手里这把，一个都不停）。
    #[test]
    fn stop_after_shutdown_uses_the_lock_the_runtime_still_holds() {
        let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
        let db = deps.db.as_ref();
        let mut worker = spawn_group_leader_sleep();
        seed_running(db, "held", worker.id());
        db.record_worker_identity("held", retainpdf_proc::process_identity(worker.id()).as_deref())
            .unwrap();
        let lock = crate::job_runner::acquire_runtime_owner_lock(&deps.config.jobs_db_path).expect("hold lock");

        let stopped = super::stop_owned_workers_after_runtime_shutdown(&deps.config, Some(lock));

        assert_eq!(stopped, 1);
        assert!(!worker.wait().expect("reap").success(), "拿着锁交进来时应当终止自己的 worker");
        assert_eq!(db.get_job("held").unwrap().status, JobStatusKind::Running, "库不改，留给下次启动");
        let _ = std::fs::remove_dir_all(deps.config.project_root.clone());
    }
}
