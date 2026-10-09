//! 多设备同步的应用服务:后台定时同步、立即同步、连通性测试、状态。
//!
//! 同步本身在 `retain_data::sync`(格式与合并规则见那里),设置的读写与「跑一轮并记下
//! 结果」在 `retain_data::sync::control`(命令行在后端没开时也用它)。这里负责:
//! - 后台每隔 `RUST_API_SYNC_INTERVAL_SECS`(默认 60)秒跑一轮,改设置或点「立即同步」
//!   时马上跑;同一时间只跑一轮;数据库恢复期间停住(`pause`);
//! - 其它设备的列表在每轮结束时记在内存里:界面查状态不会再去问 NAS。

pub mod api;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::Result;
pub use retain_data::sync::control::{sync_root_for, SYNC_SUBDIR};
use retain_data::sync::{SyncControl, SyncSettingsError};

use crate::db::Db;
use crate::models::api::{SyncPeerView, SyncRunView, SyncSettingsInput, SyncStatusView, SyncTestView};
use crate::models::domain::now_iso;

fn interval_from_env() -> Duration {
    Duration::from_secs(
        retain_core::config::env_vars::env_u64("RUST_API_SYNC_INTERVAL_SECS", 60).max(10),
    )
}

pub struct SyncService {
    control: SyncControl,
    interval: Duration,
    /// 同一时间只跑一轮。
    run_lock: tokio::sync::Mutex<()>,
    running: AtomicBool,
    peers: Mutex<Vec<SyncPeerView>>,
    wake: tokio::sync::Notify,
}

impl SyncService {
    pub fn new(db: Arc<Db>, data_root: PathBuf) -> Self {
        Self {
            control: SyncControl::new((*db).clone(), data_root),
            interval: interval_from_env(),
            run_lock: tokio::sync::Mutex::new(()),
            running: AtomicBool::new(false),
            peers: Mutex::new(Vec::new()),
            wake: tokio::sync::Notify::new(),
        }
    }

    pub fn status(&self) -> Result<SyncStatusView> {
        self.control.status_view(
            self.running.load(Ordering::SeqCst),
            self.interval.as_secs(),
            self.peers.lock().expect("sync peers poisoned").clone(),
        )
    }

    /// 改设置。开启时必须已配好同步目标。改完马上跑一轮。
    pub fn update(&self, input: &SyncSettingsInput) -> Result<std::result::Result<(), SyncSettingsError>> {
        let outcome = self.control.update(input)?;
        self.wake.notify_one();
        Ok(outcome)
    }

    /// 用给的设置(没给的用已保存的)测一次能不能读写。不改设置、不碰同步数据。
    pub async fn test(self: &Arc<Self>, input: &SyncSettingsInput) -> Result<SyncTestView> {
        let control = self.control.clone();
        let input = input.clone();
        Ok(match tokio::task::spawn_blocking(move || control.test(&input)).await {
            Ok(view) => view?,
            Err(error) => SyncTestView {
                ok: false,
                location: String::new(),
                latency_ms: None,
                error: Some(format!("测试中断：{error}")),
            },
        })
    }

    /// 跑一轮(已经有一轮在跑就等它跑完,再跑一轮)。开关关着或没配好时不跑,返回 None。
    pub async fn run_once(self: &Arc<Self>) -> Result<Option<SyncRunView>> {
        let _guard = self.run_lock.lock().await;
        if !self.control.enabled()? || self.control.target(None)?.is_none() {
            return Ok(None);
        }
        self.running.store(true, Ordering::SeqCst);
        let started_at = now_iso();
        let control = self.control.clone();
        let outcome = tokio::task::spawn_blocking(move || control.run_recorded()).await;
        self.running.store(false, Ordering::SeqCst);
        match outcome {
            Ok(Ok(Some((view, peers)))) => {
                if view.ok {
                    *self.peers.lock().expect("sync peers poisoned") = peers;
                }
                Ok(Some(view))
            }
            Ok(Ok(None)) => Ok(None),
            Ok(Err(error)) => Err(error),
            Err(error) => Ok(Some(SyncRunView {
                started_at,
                finished_at: now_iso(),
                error: Some(format!("同步中断：{error}")),
                ..SyncRunView::default()
            })),
        }
    }

    /// 停住同步(数据库恢复期间):正在跑的一轮先跑完,拿着它期间不开始新的一轮。
    pub async fn pause(&self) -> tokio::sync::MutexGuard<'_, ()> {
        self.run_lock.lock().await
    }

    /// 后台定时同步;改设置时立即醒来。
    pub fn spawn_loop(self: Arc<Self>, mut shutdown: tokio::sync::watch::Receiver<bool>) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            // 启动后稍等一会儿再跑第一轮,不跟启动抢资源。
            let mut next = Duration::from_secs(10);
            loop {
                tokio::select! {
                    _ = tokio::time::sleep(next) => {}
                    _ = self.wake.notified() => {}
                    _ = shutdown.changed() => return,
                }
                if *shutdown.borrow() {
                    return;
                }
                if let Err(error) = self.run_once().await {
                    tracing::warn!("sync: {error:#}");
                }
                next = self.interval;
            }
        })
    }
}
