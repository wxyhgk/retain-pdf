//! 数据库备份的应用服务:后台每天自动备份、立即备份、恢复、删除。
//!
//! 备份本身(格式、保留规则、怎么恢复进正在用的库、同步记账怎么处理)在
//! `retainpdf_db::db::backup`。这里负责:
//! - 后台每小时看一次,最新的自动备份超过 `RUST_API_BACKUP_INTERVAL_HOURS`(默认 24,
//!   0 关掉自动备份)就再存一份,并按保留规则清掉多余的;
//! - 同一时间只做一件事(备份或恢复);
//! - 恢复:有任务在跑时不恢复;先检查备份(坏的、来自新版本的直接拒绝),再存一份「恢复前」
//!   备份;恢复期间停住同步(也不改同步设置),免得同步读写到一半换了库;换库前再查一次有没有
//!   在跑的任务;恢复成功后调应用装配层给的 [`AfterRestoreHook`](进程内模式下立即对账备份里
//!   带回来的排队/运行中任务,见 `recover_jobs_after_database_restore`);
//! - 立即备份、恢复整段在单独的 tokio 任务里做完(`crate::detached`):HTTP 请求断开时,锁、
//!   「停住同步」在活真正结束后才放,`running` 不会卡住;恢复的结果记成 `last_restore`。

pub mod api;
pub mod views;
#[cfg(test)]
mod tests;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use anyhow::Result;
use chrono::Utc;

use retainpdf_core::models::domain::now_iso;
use retainpdf_data::db::backup::{BackupInfo, RestoreRefusal, KIND_AUTO, KIND_BEFORE_RESTORE, KIND_MANUAL};
use retainpdf_data::db::Db;
use views::{BackupItemView, BackupRestoreView, BackupStatusView, LastRestoreView};
use crate::detached::{blocking, detached, Running};
use crate::sync::SyncService;

/// 多久看一次要不要自动备份。
const CHECK_EVERY: Duration = Duration::from_secs(3600);

fn interval_hours_from_env() -> u64 {
    retainpdf_core::config::env_vars::env_u64("RUST_API_BACKUP_INTERVAL_HOURS", 24)
}

/// 不能照做的原因(给用户看)。
#[derive(Debug)]
pub enum BackupRefusal {
    NotFound(String),
    /// 备份文件坏了(解不开或完整性检查不过)。
    Damaged(String),
    /// 备份来自更新版本的程序。
    Newer(String),
    /// 有任务在跑等。
    Busy(String),
}

impl BackupRefusal {
    fn message(&self) -> &str {
        match self {
            Self::NotFound(m) | Self::Damaged(m) | Self::Newer(m) | Self::Busy(m) => m,
        }
    }

    /// 稳定原因:409 的 `error.details.reason`,也记进 `last_restore.reason`。
    pub(crate) fn reason(&self) -> &'static str {
        match self {
            Self::NotFound(_) => "not_found",
            Self::Damaged(_) => "backup_damaged",
            Self::Newer(_) => "backup_newer",
            Self::Busy(_) => "restore_blocked",
        }
    }
}

impl From<RestoreRefusal> for BackupRefusal {
    fn from(refusal: RestoreRefusal) -> Self {
        let message = refusal.to_string();
        match refusal {
            RestoreRefusal::NotFound => Self::NotFound(message),
            RestoreRefusal::Damaged(_) => Self::Damaged(message),
            RestoreRefusal::Newer { .. } => Self::Newer(message),
            RestoreRefusal::Blocked(_) => Self::Busy(message),
        }
    }
}

fn item_view(info: &BackupInfo) -> BackupItemView {
    BackupItemView {
        id: info.id.clone(),
        kind: info.kind.clone(),
        created_at: info.created_at.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        schema_version: info.schema_version,
        bytes: info.bytes,
    }
}

/// 恢复成功后要做的事,返回处理了几个任务。在阻塞线程里调。
pub type AfterRestoreHook = Arc<dyn Fn() -> Result<usize> + Send + Sync>;

/// 一次恢复在阻塞线程里的结果:恢复前备份的编号(存了的话)和恢复本身的结果。
type RestoreAttempt = (Option<String>, Result<std::result::Result<(), RestoreRefusal>>);

pub struct BackupService {
    db: Arc<Db>,
    sync: Arc<SyncService>,
    interval_hours: u64,
    /// 同一时间只做一件事(备份、恢复、删除)。只在 [`detached`] 起的任务里拿着跨过阻塞活。
    lock: tokio::sync::Mutex<()>,
    running: AtomicBool,
    /// 最近一次恢复(不论成败);只在内存里,重启后为空。
    last_restore: Mutex<Option<LastRestoreView>>,
    after_restore: OnceLock<AfterRestoreHook>,
}

impl BackupService {
    pub fn new(db: Arc<Db>, sync: Arc<SyncService>) -> Self {
        Self {
            db,
            sync,
            interval_hours: interval_hours_from_env(),
            lock: tokio::sync::Mutex::new(()),
            running: AtomicBool::new(false),
            last_restore: Mutex::new(None),
            after_restore: OnceLock::new(),
        }
    }

    /// 装配时设一次;再设无效。
    pub fn set_after_restore(&self, hook: AfterRestoreHook) {
        let _ = self.after_restore.set(hook);
    }

    /// 状态(读目录、连库数在跑的任务,在阻塞线程里做)。
    pub async fn status(&self) -> Result<BackupStatusView> {
        let db = self.db.clone();
        let (items, restore_blockers) = blocking(move || Ok((db.list_backups()?, db.restore_blockers()?))).await?;
        let last_auto_at = items
            .iter()
            .find(|b| b.kind == KIND_AUTO)
            .map(|b| item_view(b).created_at);
        Ok(BackupStatusView {
            dir: self.db.backups_dir().to_string_lossy().to_string(),
            auto_interval_hours: self.interval_hours,
            last_auto_at,
            running: self.running.load(Ordering::SeqCst),
            restore_blockers,
            last_restore: self.last_restore.lock().expect("last restore poisoned").clone(),
            items: items.iter().map(item_view).collect(),
        })
    }

    /// 存一份。整段在单独的任务里做完:请求断开也不提前放锁、不让 `running` 卡在 true。
    async fn create(self: &Arc<Self>, kind: &'static str) -> Result<BackupInfo> {
        let this = self.clone();
        detached(async move {
            let _guard = this.lock.lock().await;
            let _running = Running::raise(&this.running);
            let db = this.db.clone();
            blocking(move || {
                let info = db.create_backup(kind)?;
                db.prune_backups()?;
                Ok(info)
            })
            .await
        })
        .await
    }

    pub async fn create_manual(self: &Arc<Self>) -> Result<BackupItemView> {
        Ok(item_view(&self.create(KIND_MANUAL).await?))
    }

    pub async fn delete(&self, id: &str) -> Result<std::result::Result<(), BackupRefusal>> {
        let _guard = self.lock.lock().await;
        let db = self.db.clone();
        let id = id.to_string();
        Ok(if blocking(move || db.delete_backup(&id)).await? {
            Ok(())
        } else {
            Err(BackupRefusal::NotFound(RestoreRefusal::NotFound.to_string()))
        })
    }

    /// 恢复。整段(拿锁、停住同步、换库、恢复后的钩子、放锁)在单独的任务里做完,请求只等
    /// 结果;请求断开时活照样做完,结果记进 `last_restore`。
    pub async fn restore(self: &Arc<Self>, id: &str) -> Result<std::result::Result<BackupRestoreView, BackupRefusal>> {
        let this = self.clone();
        let id = id.to_string();
        detached(async move { this.restore_detached(id).await }).await
    }

    async fn restore_detached(&self, id: String) -> Result<std::result::Result<BackupRestoreView, BackupRefusal>> {
        let _guard = self.lock.lock().await;
        let started_at = now_iso();
        let (safety, outcome) = self.restore_locked(&id).await;
        let record = LastRestoreView {
            backup_id: id.clone(),
            ok: matches!(outcome, Ok(Ok(()))),
            safety_backup: safety.clone(),
            reason: match &outcome {
                Ok(Err(refusal)) => Some(refusal.reason().to_string()),
                _ => None,
            },
            error: match &outcome {
                Ok(Ok(())) => None,
                Ok(Err(refusal)) => Some(refusal.message().to_string()),
                Err(_) => Some("恢复没有完成，数据库没有改动（原因见服务日志）".to_string()),
            },
            started_at,
            finished_at: now_iso(),
        };
        *self.last_restore.lock().expect("last restore poisoned") = Some(record);
        match outcome {
            Ok(Ok(())) => {}
            Ok(Err(refusal)) => return Ok(Err(refusal)),
            Err(error) => {
                tracing::warn!(backup = %id, safety = ?safety, "restoring a backup failed: {error:#}");
                return Err(error);
            }
        }
        Ok(Ok(BackupRestoreView {
            restored: id,
            safety_backup: safety.unwrap_or_default(),
            status: self.status().await?,
        }))
    }

    /// 已拿着锁。返回恢复前备份的编号(存了的话)和结果。
    async fn restore_locked(
        &self,
        id: &str,
    ) -> (Option<String>, Result<std::result::Result<(), BackupRefusal>>) {
        let db = self.db.clone();
        let wanted = id.to_string();
        let precheck = blocking(move || {
            if !db.list_backups()?.iter().any(|b| b.id == wanted) {
                return Ok(Err(BackupRefusal::NotFound(RestoreRefusal::NotFound.to_string())));
            }
            let blockers = db.restore_blockers()?;
            if !blockers.is_empty() {
                return Ok(Err(BackupRefusal::from(RestoreRefusal::Blocked(blockers))));
            }
            Ok(Ok(()))
        })
        .await;
        match precheck {
            Ok(Ok(())) => {}
            Ok(Err(refusal)) => return (None, Ok(Err(refusal))),
            Err(error) => return (None, Err(error)),
        }
        // 同步正在跑的话等它这一轮跑完;恢复完之前不再开始新的一轮,也不改同步设置。
        let _sync_paused = self.sync.pause().await;
        let _running = Running::raise(&self.running);
        let db = self.db.clone();
        let wanted = id.to_string();
        let attempt = blocking(move || -> Result<RestoreAttempt> { Ok(restore_in_place(&db, &wanted)) }).await;
        let (safety, restored) = match attempt {
            Ok(attempt) => attempt,
            Err(error) => return (None, Err(error)),
        };
        match restored {
            Ok(Ok(())) => {}
            Ok(Err(refusal)) => return (safety, Ok(Err(refusal.into()))),
            Err(error) => return (safety, Err(error)),
        }
        tracing::warn!(backup = %id, safety = ?safety, "database restored from a backup");
        // 备份里带回来的排队/运行中任务没有 driver:立即对账,不让它们一直转圈。
        // 失败只记日志——恢复已经完成,运行期巡检还会再兜一次。
        if let Some(hook) = self.after_restore.get().cloned() {
            match tokio::task::spawn_blocking(move || hook()).await {
                Ok(Ok(0)) => {}
                Ok(Ok(count)) => {
                    tracing::warn!("reconciled {count} restored queued/running job(s) after the restore")
                }
                Ok(Err(error)) => tracing::warn!("reconciling restored jobs failed: {error:#}"),
                Err(error) => tracing::warn!("reconciling restored jobs panicked: {error}"),
            }
        }
        (safety, Ok(Ok(())))
    }

    /// 最新的自动备份过期了就再存一份。
    async fn auto_backup_if_due(self: &Arc<Self>) -> Result<()> {
        if self.interval_hours == 0 {
            return Ok(());
        }
        let db = self.db.clone();
        let newest = blocking(move || Ok(db.list_backups()?.into_iter().find(|b| b.kind == KIND_AUTO))).await?;
        let due = newest.map_or(true, |b| {
            Utc::now() - b.created_at >= chrono::Duration::hours(self.interval_hours as i64)
        });
        if due {
            let info = self.create(KIND_AUTO).await?;
            tracing::info!(backup = %info.id, bytes = info.bytes, "database backed up");
        }
        Ok(())
    }

    pub fn spawn_loop(self: Arc<Self>, mut shutdown: tokio::sync::watch::Receiver<bool>) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            // 启动后稍等一会儿,不跟启动抢资源。
            let mut next = Duration::from_secs(60);
            loop {
                tokio::select! {
                    _ = tokio::time::sleep(next) => {}
                    _ = shutdown.changed() => return,
                }
                if *shutdown.borrow() {
                    return;
                }
                if let Err(error) = self.auto_backup_if_due().await {
                    tracing::warn!("backup: {error:#}");
                }
                next = CHECK_EVERY;
            }
        })
    }
}

/// 在阻塞线程里:先检查备份(坏的、来自新版本的不存恢复前备份,见审计 C8),再存恢复前备份,
/// 再换库(换库前 `restore_checked` 会再查一次有没有在跑的任务)。换库前又查到在跑的任务时,
/// 刚存的恢复前备份和当前库一模一样,删掉,不挤占保留名额。
fn restore_in_place(db: &Db, id: &str) -> RestoreAttempt {
    // 从这里到换库完，建任务、重跑、上传落库都回 409 `restore_in_progress`（见 `Db::begin_restore`）。
    let _restoring = db.begin_restore();
    let mut safety: Option<String> = None;
    let outcome = (|| -> Result<std::result::Result<(), RestoreRefusal>> {
        let checked = match db.check_backup(id)? {
            Ok(checked) => checked,
            Err(refusal) => return Ok(Err(refusal)),
        };
        let made = db.create_backup(KIND_BEFORE_RESTORE)?;
        safety = Some(made.id.clone());
        let restored = db.restore_checked(checked)?;
        match &restored {
            Ok(()) => {
                if let Err(error) = db.prune_backups() {
                    tracing::warn!("pruning backups after a restore failed: {error:#}");
                }
            }
            Err(RestoreRefusal::Blocked(_)) => {
                if db.delete_backup(&made.id).unwrap_or(false) {
                    safety = None;
                }
            }
            Err(_) => {}
        }
        Ok(restored)
    })();
    (safety, outcome)
}
