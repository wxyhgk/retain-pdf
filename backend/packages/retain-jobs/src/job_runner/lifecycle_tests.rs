use super::*;
use crate::models::request::CreateJobInput;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use tokio::sync::Notify;

struct Fixture {
    deps: ProcessRuntimeDeps,
    root: std::path::PathBuf,
}
impl Fixture {
    fn new(slots: usize) -> Self {
        let deps = super::super::process_runner::tests::test_runtime_deps(slots);
        let root = deps.config.project_root.clone();
        Self { deps, root }
    }
    fn job(&self, id: &str, status: JobStatusKind) -> JobSnapshot {
        let mut job = JobSnapshot::new(
            id.into(),
            CreateJobInput::default(),
            vec!["fake-worker".into()],
        );
        job.status = status;
        self.deps.db.save_job(&job).unwrap();
        job
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

async fn succeeded(_: ProcessRuntimeDeps, mut job: JobRuntimeState) -> Result<JobRuntimeState> {
    job.status = JobStatusKind::Succeeded;
    Ok(job)
}

#[test]
fn workflow_dispatch_does_not_embed_large_pipeline_futures() {
    fn future_size<F, Fut>(_: F) -> usize
    where
        F: FnOnce(ProcessRuntimeDeps, JobRuntimeState) -> Fut,
        Fut: std::future::Future<Output = Result<JobRuntimeState>>,
    {
        std::mem::size_of::<Fut>()
    }
    let size = future_size(dispatch_workflow);
    assert!(
        size <= 64 * 1024,
        "workflow dispatcher retains {size} bytes; pipeline branches must be heap-pinned"
    );
}

#[tokio::test]
async fn repeated_launch_has_one_driver_even_while_queued() {
    let fixture = Fixture::new(1);
    fixture.job("same", JobStatusKind::Queued);
    let permit = fixture
        .deps
        .job_slots
        .clone()
        .acquire_owned()
        .await
        .unwrap();
    let count = Arc::new(AtomicUsize::new(0));
    let worker_count = count.clone();
    let handle = spawn_job_with_workflow(
        fixture.deps.clone(),
        "same".into(),
        move |deps, job| async move {
            worker_count.fetch_add(1, Ordering::SeqCst);
            succeeded(deps, job).await
        },
    )
    .unwrap();
    for _ in 0..100 {
        assert!(spawn_job_with_workflow(fixture.deps.clone(), "same".into(), succeeded).is_none());
    }
    assert_eq!(count.load(Ordering::SeqCst), 0);
    drop(permit);
    handle.await.unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 1);
    assert!(fixture.deps.job_drivers.claim("same").is_some());
}

#[tokio::test]
async fn terminal_launch_never_dispatches_or_changes_snapshot() {
    let fixture = Fixture::new(1);
    for (id, status) in [
        ("done", JobStatusKind::Succeeded),
        ("failed", JobStatusKind::Failed),
        ("cancel", JobStatusKind::Canceled),
    ] {
        fixture.job(id, status);
        let before = serde_json::to_value(fixture.deps.db.get_job(id).unwrap()).unwrap();
        spawn_job_with_workflow(fixture.deps.clone(), id.into(), |_, _| async {
            panic!("terminal job dispatched");
            #[allow(unreachable_code)]
            Ok(unreachable!())
        })
        .unwrap()
        .await
        .unwrap();
        assert_eq!(
            serde_json::to_value(fixture.deps.db.get_job(id).unwrap()).unwrap(),
            before
        );
    }
}

#[tokio::test]
async fn canceled_stale_snapshot_rejects_queue_cas_and_dispatch() {
    let fixture = Fixture::new(1);
    let mut stale = fixture.job("race", JobStatusKind::Queued);
    fixture.job("race", JobStatusKind::Canceled);
    assert!(!persist_queued_job(&fixture.deps, &mut stale).unwrap());
    assert_eq!(
        fixture.deps.db.get_job("race").unwrap().status,
        JobStatusKind::Canceled
    );
    run_job(fixture.deps.clone(), "race".into(), |_, _| async {
        panic!("canceled job dispatched");
        #[allow(unreachable_code)]
        Ok(unreachable!())
    })
    .await
    .unwrap();
}

#[tokio::test]
async fn two_jobs_share_slot_limit_and_waiting_cancel_never_dispatches() {
    let fixture = Fixture::new(1);
    fixture.job("first", JobStatusKind::Queued);
    fixture.job("second", JobStatusKind::Queued);
    let entered = Arc::new(Notify::new());
    let release = Arc::new(Notify::new());
    let (worker_entered, worker_release) = (entered.clone(), release.clone());
    let first = spawn_job_with_workflow(
        fixture.deps.clone(),
        "first".into(),
        move |deps, job| async move {
            worker_entered.notify_one();
            worker_release.notified().await;
            succeeded(deps, job).await
        },
    )
    .unwrap();
    entered.notified().await;
    let second = spawn_job_with_workflow(fixture.deps.clone(), "second".into(), |_, _| async {
        panic!("waiting canceled job dispatched");
        #[allow(unreachable_code)]
        Ok(unreachable!())
    })
    .unwrap();
    tokio::task::yield_now().await;
    assert_eq!(fixture.deps.job_slots.available_permits(), 0);
    fixture.job("second", JobStatusKind::Canceled);
    second.await.unwrap();
    release.notify_one();
    first.await.unwrap();
    assert_eq!(fixture.deps.job_slots.available_permits(), 1);
}

#[tokio::test]
async fn failure_and_abort_release_driver_ownership() {
    let fixture = Fixture::new(1);
    fixture.job("error", JobStatusKind::Queued);
    spawn_job_with_workflow(fixture.deps.clone(), "error".into(), |_, _| async {
        anyhow::bail!("synthetic failure")
    })
    .unwrap()
    .await
    .unwrap();
    assert_eq!(
        fixture.deps.db.get_job("error").unwrap().status,
        JobStatusKind::Failed
    );
    assert!(fixture.deps.job_drivers.claim("error").is_some());
    fixture.job("abort", JobStatusKind::Queued);
    let handle = spawn_job_with_workflow(fixture.deps.clone(), "abort".into(), |_, _| async {
        std::future::pending().await
    })
    .unwrap();
    handle.abort();
    assert!(handle.await.unwrap_err().is_cancelled());
    assert!(fixture.deps.job_drivers.claim("abort").is_some());
}

#[tokio::test]
async fn repeated_launch_starts_only_one_real_local_worker() {
    let fixture = Fixture::new(1);
    let marker = fixture.root.join("worker-starts.txt");
    let mut job = fixture.job("real-worker", JobStatusKind::Queued);
    job.command = vec![
        "python3".into(),
        "-c".into(),
        "import pathlib,sys; p=pathlib.Path(sys.argv[1]); p.open('a').write('started\\n')".into(),
        marker.to_string_lossy().into_owned(),
    ];
    fixture.deps.db.save_job(&job).unwrap();
    let handle = spawn_job_with_workflow(
        fixture.deps.clone(),
        job.job_id.clone(),
        |deps, job| async move {
            super::super::process_runner::execute_process_job(deps, job, &[]).await
        },
    )
    .unwrap();
    for _ in 0..100 {
        assert!(
            spawn_job_with_workflow(fixture.deps.clone(), job.job_id.clone(), succeeded).is_none()
        );
    }
    handle.await.unwrap();
    assert_eq!(std::fs::read_to_string(marker).unwrap(), "started\n");
    assert_eq!(
        fixture.deps.db.get_job(&job.job_id).unwrap().status,
        JobStatusKind::Succeeded
    );
}

/// 取消标记在队列门被消费掉之后，任务必须落终态，不能挂着。
///
/// `wait_for_execution_slot` 命中标记会清掉它并返回 None，driver 随即退出。
/// 正常取消路径靠 `cancel_job` 紧接着的 CAS 写兜底，但 `cancel_job(ocr_only=true)`
/// 在 `stage != "queued"` 时一个字都不写 DB——于是没人收尾，任务永久卡在
/// queued/running 且再无 driver 驱动，用户看到永久转圈、连重跑都点不了。
///
/// 反证方式：把 `run_job` 里 `None => { persist_canceled_job(..)?; .. }` 退回
/// `None => return Ok(())`，这个测试必须变红——行会停在 Queued。
#[tokio::test]
async fn consumed_cancel_flag_still_lands_a_terminal_state() {
    let fx = Fixture::new(1);
    let job = fx.job("job-consumed-flag", JobStatusKind::Queued);

    // 模拟 cancel_job(ocr_only=true) + stage != "queued"：只塞注册表，不写 DB。
    super::super::cancel_registry::request_cancel_with_registry(
        fx.deps.canceled_jobs.as_ref(),
        &job.job_id,
    )
    .await;

    let handle = spawn_job_with_workflow(fx.deps.clone(), job.job_id.clone(), succeeded);
    if let Some(h) = handle {
        let _ = h.await;
    }

    let after = fx.deps.db.get_job(&job.job_id).unwrap();
    assert_eq!(
        after.status,
        JobStatusKind::Canceled,
        "取消标记被队列门消费掉之后，必须有人落终态；停在 {:?} 就是永久挂起",
        after.status
    );
    assert!(
        !super::super::cancel_registry::is_cancel_requested_with_registry(
            fx.deps.canceled_jobs.as_ref(),
            &job.job_id,
        )
        .await,
        "标记应当已被清除"
    );
}

/// 取消在「等待执行槽位」期间到达时，同样必须落终态。
///
/// 这条走的是 `wait_for_execution_slot` 里的取消分支，和上面那个测试不是同一处出口：
/// `should_skip_job_execution` 在 job 启动的一瞬间只查一次，之后 job 可能在队列里
/// 等很久，取消完全可能落在这段窗口里。队列门命中标记后同样会**清掉标记并返回
/// None**，若无人收尾，任务就永久挂着。
///
/// 做法：先把唯一的槽位占掉，让 job 卡在轮询循环里，再塞取消标记。
///
/// 反证方式：把 `run_job` 里 `None => { persist_canceled_job(..)?; .. }` 退回
/// `None => return Ok(())`，这个测试必须变红。
#[tokio::test]
async fn cancel_while_waiting_for_a_slot_still_lands_a_terminal_state() {
    let fx = Fixture::new(1);
    let job = fx.job("job-canceled-in-queue", JobStatusKind::Queued);

    // 占住唯一的槽位，逼 job 停在 wait_for_execution_slot 的轮询里。
    let hold = fx.deps.job_slots.clone().acquire_owned().await.unwrap();

    let handle = spawn_job_with_workflow(fx.deps.clone(), job.job_id.clone(), succeeded);

    // 让它先跑过 should_skip_job_execution，确保确实是在队列门里等。
    tokio::time::sleep(std::time::Duration::from_millis(60)).await;
    assert_eq!(
        fx.deps.db.get_job(&job.job_id).unwrap().status,
        JobStatusKind::Queued,
        "此刻应当已经进入排队状态"
    );

    super::super::cancel_registry::request_cancel_with_registry(
        fx.deps.canceled_jobs.as_ref(),
        &job.job_id,
    )
    .await;

    if let Some(h) = handle {
        let _ = tokio::time::timeout(std::time::Duration::from_secs(5), h).await;
    }
    drop(hold);

    let after = fx.deps.db.get_job(&job.job_id).unwrap();
    assert_eq!(
        after.status,
        JobStatusKind::Canceled,
        "队列门消费掉标记之后必须落终态；停在 {:?} 就是永久挂起",
        after.status
    );
}
