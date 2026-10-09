//! 数据库备份的应用服务:后台每天自动备份、立即备份、恢复、删除。
//!
//! 备份本身(格式、保留规则、怎么恢复进正在用的库、同步记账怎么处理)在
//! `retain_db::db::backup`。这里负责:
//! - 后台每小时看一次,最新的自动备份超过 `RUST_API_BACKUP_INTERVAL_HOURS`(默认 24,
//!   0 关掉自动备份)就再存一份,并按保留规则清掉多余的;
//! - 同一时间只做一件事(备份或恢复);
//! - 恢复:有任务在跑时不恢复;先存一份「恢复前」备份;恢复期间停住同步,免得同步
//!   读写到一半换了库。

pub mod api;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use chrono::Utc;

use crate::db::backup::{BackupInfo, RestoreRefusal, KIND_AUTO, KIND_BEFORE_RESTORE, KIND_MANUAL};
use crate::db::Db;
use crate::models::api::{BackupItemView, BackupRestoreView, BackupStatusView};
use crate::services::sync::SyncService;

/// 多久看一次要不要自动备份。
const CHECK_EVERY: Duration = Duration::from_secs(3600);

fn interval_hours_from_env() -> u64 {
    retain_core::config::env_vars::env_u64("RUST_API_BACKUP_INTERVAL_HOURS", 24)
}

/// 不能照做的原因(给用户看)。
#[derive(Debug)]
pub enum BackupRefusal {
    NotFound(String),
    /// 备份文件坏了或来自更新的版本。
    Invalid(String),
    /// 有任务在跑等。
    Busy(String),
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

pub struct BackupService {
    db: Arc<Db>,
    sync: Arc<SyncService>,
    interval_hours: u64,
    lock: tokio::sync::Mutex<()>,
    running: AtomicBool,
}

impl BackupService {
    pub fn new(db: Arc<Db>, sync: Arc<SyncService>) -> Self {
        Self {
            db,
            sync,
            interval_hours: interval_hours_from_env(),
            lock: tokio::sync::Mutex::new(()),
            running: AtomicBool::new(false),
        }
    }

    pub fn status(&self) -> Result<BackupStatusView> {
        let items = self.db.list_backups()?;
        let last_auto_at = items
            .iter()
            .find(|b| b.kind == KIND_AUTO)
            .map(|b| item_view(b).created_at);
        Ok(BackupStatusView {
            dir: self.db.backups_dir().to_string_lossy().to_string(),
            auto_interval_hours: self.interval_hours,
            last_auto_at,
            running: self.running.load(Ordering::SeqCst),
            restore_blockers: self.db.restore_blockers()?,
            items: items.iter().map(item_view).collect(),
        })
    }

    /// 在后台线程里做一件事,期间标着「正在进行」。调用方已拿到锁。
    async fn blocking<T: Send + 'static>(
        &self,
        work: impl FnOnce(&Db) -> Result<T> + Send + 'static,
    ) -> Result<T> {
        self.running.store(true, Ordering::SeqCst);
        let db = self.db.clone();
        let outcome = tokio::task::spawn_blocking(move || work(&db)).await;
        self.running.store(false, Ordering::SeqCst);
        outcome?
    }

    async fn create(&self, kind: &'static str) -> Result<BackupInfo> {
        let _guard = self.lock.lock().await;
        self.blocking(move |db| {
            let info = db.create_backup(kind)?;
            db.prune_backups()?;
            Ok(info)
        })
        .await
    }

    pub async fn create_manual(&self) -> Result<BackupItemView> {
        Ok(item_view(&self.create(KIND_MANUAL).await?))
    }

    pub async fn delete(&self, id: &str) -> Result<std::result::Result<(), BackupRefusal>> {
        let _guard = self.lock.lock().await;
        Ok(if self.db.delete_backup(id)? {
            Ok(())
        } else {
            Err(BackupRefusal::NotFound(RestoreRefusal::NotFound.to_string()))
        })
    }

    pub async fn restore(&self, id: &str) -> Result<std::result::Result<BackupRestoreView, BackupRefusal>> {
        let _guard = self.lock.lock().await;
        if !self.db.list_backups()?.iter().any(|b| b.id == id) {
            return Ok(Err(BackupRefusal::NotFound(RestoreRefusal::NotFound.to_string())));
        }
        let blockers = self.db.restore_blockers()?;
        if !blockers.is_empty() {
            return Ok(Err(BackupRefusal::Busy(format!(
                "{}，等它们结束后再恢复",
                blockers.join("，")
            ))));
        }
        // 同步正在跑的话等它这一轮跑完;恢复完之前不再开始新的一轮。
        let _sync_paused = self.sync.pause().await;
        let id = id.to_string();
        let outcome = self
            .blocking(move |db| {
                let safety = db.create_backup(KIND_BEFORE_RESTORE)?;
                let restored = db.restore_backup(&id)?;
                db.prune_backups()?;
                Ok((safety, restored, id))
            })
            .await?;
        let (safety, restored, id) = outcome;
        if let Err(refusal) = restored {
            return Ok(Err(match refusal {
                RestoreRefusal::NotFound => BackupRefusal::NotFound(refusal.to_string()),
                _ => BackupRefusal::Invalid(refusal.to_string()),
            }));
        }
        tracing::warn!(backup = %id, safety = %safety.id, "database restored from a backup");
        Ok(Ok(BackupRestoreView {
            restored: id,
            safety_backup: safety.id,
            status: self.status()?,
        }))
    }

    /// 最新的自动备份过期了就再存一份。
    async fn auto_backup_if_due(&self) -> Result<()> {
        if self.interval_hours == 0 {
            return Ok(());
        }
        let newest = self.db.list_backups()?.into_iter().find(|b| b.kind == KIND_AUTO);
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
