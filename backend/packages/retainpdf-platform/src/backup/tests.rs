//! 恢复、立即备份在请求断开时的行为,恢复的竞态(审计 C1、C2、C8)。

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use retainpdf_data::db::Db;

use super::{BackupRefusal, BackupService};
use crate::sync::SyncService;

fn setup(name: &str) -> (PathBuf, Arc<Db>, Arc<BackupService>) {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let root = std::env::temp_dir().join(format!("retain-platform-{name}-{}-{nanos}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let root = std::fs::canonicalize(root).unwrap();
    let db = Arc::new(Db::new(root.join("db").join("jobs.db"), root.clone()));
    db.init().unwrap();
    let sync = Arc::new(SyncService::new(db.clone(), root.clone()));
    let service = Arc::new(BackupService::new(db.clone(), sync));
    (root, db, service)
}

fn queued_job(db: &Db, id: &str) {
    let job = retainpdf_core::models::domain::JobSnapshot::new(
        id.to_string(),
        retainpdf_core::models::CreateJobInput::default(),
        vec![],
    );
    db.save_job(&job).unwrap();
}

fn kinds(db: &Db) -> Vec<String> {
    db.list_backups().unwrap().into_iter().map(|b| b.kind).collect()
}

/// 回归（审计 C1）：恢复的请求中途断开时，以前锁和「停住同步」随请求的 future 一起放掉，
/// 阻塞线程里的活却照跑：别的恢复、同步可以马上进来，恢复后的钩子也不跑。现在整段在单独的
/// 任务里做完：活干完之前锁不放、同步不开始，钩子照跑，`running` 最后回到 false。
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_restore_finishes_and_holds_its_locks_even_if_the_request_goes_away() {
    let (root, _db, service) = setup("drop-restore");
    let backup = service.create_manual().await.unwrap();
    let (release, wait) = std::sync::mpsc::channel::<()>();
    let wait = Mutex::new(wait);
    let ran = Arc::new(AtomicBool::new(false));
    let hook_ran = ran.clone();
    service.set_after_restore(Arc::new(move || {
        let _ = wait.lock().unwrap().recv();
        hook_ran.store(true, Ordering::SeqCst);
        Ok(0)
    }));
    // 请求等了一会儿就断开(恢复的钩子还卡着)。
    let request = service.restore(&backup.id);
    assert!(tokio::time::timeout(Duration::from_millis(500), request).await.is_err());
    assert!(service.lock.try_lock().is_err(), "活没干完，锁不能放");
    assert!(service.sync.is_paused(), "恢复没完，同步不能开始新的一轮");
    assert!(service.running.load(Ordering::SeqCst));

    release.send(()).unwrap();
    let held = tokio::time::timeout(Duration::from_secs(30), service.lock.lock()).await.expect("恢复做完放锁");
    assert!(ran.load(Ordering::SeqCst), "恢复后的钩子跑了");
    assert!(!service.running.load(Ordering::SeqCst), "running 回到 false");
    assert!(!service.sync.is_paused());
    drop(held);
    let last = service.status().await.unwrap().last_restore.expect("记下了最近一次恢复");
    assert!(last.ok, "{last:?}");
    assert_eq!(last.backup_id, backup.id);
    assert!(last.safety_backup.as_deref().is_some_and(|id| id.starts_with("before-restore-")), "{last:?}");
    std::fs::remove_dir_all(root).ok();
}

/// 回归（审计 C1）：立即备份的请求刚交给阻塞线程就断开，以前 `running` 永远停在 true
/// （「立即备份」按钮禁用到下一次自动备份）。
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_manual_backup_whose_request_goes_away_still_finishes_and_clears_running() {
    let (root, db, service) = setup("drop-backup");
    let request = service.create_manual();
    let _ = tokio::time::timeout(Duration::ZERO, request).await;
    let finished = async {
        loop {
            {
                let _held = service.lock.lock().await;
                if kinds(&db).iter().any(|kind| kind == "manual") {
                    return;
                }
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    };
    tokio::time::timeout(Duration::from_secs(30), finished).await.expect("备份做完");
    assert!(!service.running.load(Ordering::SeqCst), "running 回到 false");
    std::fs::remove_dir_all(root).ok();
}

/// 回归（审计 C2）：「有没有任务在跑」以前只在恢复开头查一次，之后要等同步停下、做恢复前
/// 备份，期间进来的任务换库后就没了。现在换库前再查一次，有就放弃（409），恢复前备份也删掉。
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_job_created_while_the_restore_waits_for_sync_stops_the_restore() {
    let (root, db, service) = setup("restore-race");
    let backup = service.create_manual().await.unwrap();
    let paused = service.sync.pause().await;
    let restoring = {
        let service = service.clone();
        let id = backup.id.clone();
        tokio::spawn(async move { service.restore(&id).await })
    };
    // 等恢复拿到锁、查过一次、开始等同步停下。
    tokio::time::timeout(Duration::from_secs(30), async {
        while service.lock.try_lock().is_ok() {
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .unwrap();
    tokio::time::sleep(Duration::from_millis(300)).await;
    queued_job(&db, "j-late");
    drop(paused);

    let outcome = restoring.await.unwrap().unwrap();
    assert!(matches!(outcome, Err(BackupRefusal::Busy(_))), "{outcome:?}");
    assert!(db.get_job("j-late").is_ok(), "换库前查到有任务：什么都没改");
    assert!(!kinds(&db).iter().any(|kind| kind == "before-restore"), "{:?}", kinds(&db));
    std::fs::remove_dir_all(root).ok();
}

/// 回归（审计 C8）：恢复失败（坏备份）以前也先存一份「恢复前」备份并按 3 份清理，连点几次
/// 坏备份，真正能退回的那份就被挤掉了。现在先检查备份，检查不过不存。
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn refused_restores_do_not_push_out_the_real_safety_backups() {
    let (root, db, service) = setup("restore-damaged");
    let good = service.create_manual().await.unwrap();
    service.restore(&good.id).await.unwrap().unwrap();
    assert_eq!(kinds(&db).iter().filter(|kind| *kind == "before-restore").count(), 1);
    let damaged = "manual-20261009T120000000Z-v19";
    std::fs::write(db.backups_dir().join(format!("{damaged}.db.gz")), b"not gzip").unwrap();
    for _ in 0..4 {
        let outcome = service.restore(damaged).await.unwrap();
        assert!(matches!(outcome, Err(BackupRefusal::Damaged(_))), "{outcome:?}");
    }
    assert_eq!(kinds(&db).iter().filter(|kind| *kind == "before-restore").count(), 1, "{:?}", kinds(&db));
    std::fs::remove_dir_all(root).ok();
}

/// 恢复整段拿着「恢复中」的写锁（`Db::begin_restore`）：正在建的任务、上传（拿着 `hold_off_restore`）做完它才开始换库，
/// 期间新来的直接被拒（409 `restore_in_progress`，见 rust_api 的 `api_tests::restore_in_progress`）。
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_restore_waits_for_work_already_holding_off_the_restore() {
    let (root, db, service) = setup("restore-gate");
    let backup = service.create_manual().await.unwrap();
    let in_progress = db.hold_off_restore().unwrap();
    let restoring = {
        let service = service.clone();
        let id = backup.id.clone();
        tokio::spawn(async move { service.restore(&id).await })
    };
    tokio::time::sleep(Duration::from_millis(500)).await;
    assert!(!restoring.is_finished(), "the restore must wait for the work in progress");

    drop(in_progress);
    let outcome = tokio::time::timeout(Duration::from_secs(30), restoring).await.unwrap().unwrap().unwrap();
    assert!(outcome.is_ok(), "{outcome:?}");
    assert!(db.hold_off_restore().is_ok(), "the gate opens again after the restore");
    std::fs::remove_dir_all(root).ok();
}
