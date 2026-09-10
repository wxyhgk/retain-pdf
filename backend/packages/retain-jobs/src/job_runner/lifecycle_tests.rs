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
