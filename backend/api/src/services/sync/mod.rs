//! 多设备同步的应用服务:设置、后台定时同步、立即同步、状态。
//!
//! 同步本身在 `retain_data::sync`(格式与合并规则见那里)。这里负责:
//! - 设置存在数据库 `sync_state` 里(enabled / folder / device_name),跟着数据目录走,
//!   桌面版、网页版、Docker 都一样;
//! - 后台每隔 `RUST_API_SYNC_INTERVAL_SECS`(默认 60)秒跑一轮,改设置或点「立即同步」
//!   时马上跑;同一时间只跑一轮;
//! - 每轮的结果记成 `last_run`(也写进 sync_state,重启后还看得到)。
//!
//! 用户选的文件夹里已经是同步文件夹(有 format.json)就直接用,否则在里面建
//! `RetainPDF-Sync`:选网盘根目录也不会把东西撒在用户自己的文件中间。

pub mod api;

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{Context, Result};
use retain_data::sync::SyncEngine;

use crate::db::Db;
use crate::models::api::{
    SyncPeerView, SyncPendingItemView, SyncRunView, SyncSettingsInput, SyncStatusView,
};
use crate::models::domain::now_iso;

const KEY_ENABLED: &str = "enabled";
const KEY_FOLDER: &str = "folder";
const KEY_DEVICE_NAME: &str = "device_name";
const KEY_DEVICE_ID: &str = "device_id";
const KEY_LAST_RUN: &str = "last_run";
/// 用户选的文件夹里建的子目录名。
pub const SYNC_SUBDIR: &str = "RetainPDF-Sync";

fn interval_from_env() -> Duration {
    Duration::from_secs(
        retain_core::config::env_vars::env_u64("RUST_API_SYNC_INTERVAL_SECS", 60).max(10),
    )
}

/// 这台电脑的名字(给其它设备看)。macOS 用「电脑名称」,其它系统用主机名。
fn default_device_name() -> String {
    let run = |program: &str, args: &[&str]| {
        std::process::Command::new(program)
            .args(args)
            .output()
            .ok()
            .filter(|out| out.status.success())
            .map(|out| String::from_utf8_lossy(&out.stdout).trim().to_string())
            .filter(|name| !name.is_empty())
    };
    #[cfg(target_os = "macos")]
    if let Some(name) = run("scutil", &["--get", "ComputerName"]) {
        return name;
    }
    run("hostname", &[]).unwrap_or_else(|| "RetainPDF".to_string())
}

/// 用户选的文件夹 -> 实际读写的同步文件夹。
pub fn sync_root_for(folder: &Path) -> PathBuf {
    if folder.join("format.json").is_file() {
        folder.to_path_buf()
    } else {
        folder.join(SYNC_SUBDIR)
    }
}

pub struct SyncService {
    db: Arc<Db>,
    data_root: PathBuf,
    interval: Duration,
    /// 同一时间只跑一轮。
    run_lock: tokio::sync::Mutex<()>,
    running: AtomicBool,
    last_run: Mutex<Option<SyncRunView>>,
    wake: tokio::sync::Notify,
}

/// 设置校验失败(给用户看的原因)。
#[derive(Debug)]
pub struct SyncSettingsError(pub String);

impl SyncService {
    pub fn new(db: Arc<Db>, data_root: PathBuf) -> Self {
        let last_run = db
            .sync_state_get(KEY_LAST_RUN)
            .ok()
            .flatten()
            .and_then(|json| serde_json::from_str(&json).ok());
        Self {
            db,
            data_root,
            interval: interval_from_env(),
            run_lock: tokio::sync::Mutex::new(()),
            running: AtomicBool::new(false),
            last_run: Mutex::new(last_run),
            wake: tokio::sync::Notify::new(),
        }
    }

    fn enabled(&self) -> Result<bool> {
        Ok(self.db.sync_state_get(KEY_ENABLED)?.as_deref() == Some("1"))
    }

    fn folder(&self) -> Result<Option<PathBuf>> {
        Ok(self
            .db
            .sync_state_get(KEY_FOLDER)?
            .filter(|f| !f.is_empty())
            .map(PathBuf::from))
    }

    fn device_name(&self) -> Result<String> {
        match self.db.sync_state_get(KEY_DEVICE_NAME)?.filter(|n| !n.trim().is_empty()) {
            Some(name) => Ok(name),
            None => {
                let name = default_device_name();
                self.db.sync_state_set(KEY_DEVICE_NAME, &name)?;
                Ok(name)
            }
        }
    }

    pub fn status(&self) -> Result<SyncStatusView> {
        let folder = self.folder()?;
        let sync_root = folder.as_deref().map(sync_root_for);
        let (pending_total, pending) = self.db.sync_pending_summary(20)?;
        let peers = match &sync_root {
            Some(root) if root.join("format.json").is_file() => {
                SyncEngine::new((*self.db).clone(), &self.data_root, root, "")
                    .and_then(|engine| engine.peers())
                    .unwrap_or_default()
                    .into_iter()
                    .map(|peer| SyncPeerView {
                        device_id: peer.device_id,
                        name: peer.name,
                        segments_read: peer.segments_read,
                    })
                    .collect()
            }
            _ => Vec::new(),
        };
        Ok(SyncStatusView {
            enabled: self.enabled()?,
            folder: folder.map(|f| f.to_string_lossy().to_string()),
            sync_root: sync_root.map(|r| r.to_string_lossy().to_string()),
            device_id: self.db.sync_state_get(KEY_DEVICE_ID)?,
            device_name: self.device_name()?,
            running: self.running.load(Ordering::SeqCst),
            interval_seconds: self.interval.as_secs(),
            last_run: self.last_run.lock().expect("sync last_run poisoned").clone(),
            pending_total,
            pending: pending
                .into_iter()
                .map(|p| SyncPendingItemView {
                    kind: p.kind,
                    key: p.key,
                    reason: p.reason,
                    attempts: p.attempts,
                })
                .collect(),
            peers,
        })
    }

    /// 改设置。开启时必须已有可用的文件夹。
    pub fn update(&self, input: &SyncSettingsInput) -> Result<std::result::Result<(), SyncSettingsError>> {
        if let Some(folder) = &input.folder {
            let folder = folder.trim();
            if folder.is_empty() {
                self.db.sync_state_set(KEY_FOLDER, "")?;
            } else {
                if let Err(reason) = self.check_folder(Path::new(folder)) {
                    return Ok(Err(reason));
                }
                self.db.sync_state_set(KEY_FOLDER, folder)?;
            }
        }
        if let Some(name) = &input.device_name {
            let name = name.trim();
            if name.chars().count() > 64 {
                return Ok(Err(SyncSettingsError("设备名最多 64 个字".into())));
            }
            self.db.sync_state_set(KEY_DEVICE_NAME, name)?;
        }
        if let Some(enabled) = input.enabled {
            if enabled && self.folder()?.is_none() {
                return Ok(Err(SyncSettingsError("请先选择同步文件夹".into())));
            }
            self.db.sync_state_set(KEY_ENABLED, if enabled { "1" } else { "0" })?;
        }
        self.wake.notify_one();
        Ok(Ok(()))
    }

    fn check_folder(&self, folder: &Path) -> std::result::Result<(), SyncSettingsError> {
        if !folder.is_absolute() {
            return Err(SyncSettingsError("请填写完整路径".into()));
        }
        let Ok(canonical) = std::fs::canonicalize(folder) else {
            return Err(SyncSettingsError("文件夹不存在".into()));
        };
        if !canonical.is_dir() {
            return Err(SyncSettingsError("这不是一个文件夹".into()));
        }
        let data_root = std::fs::canonicalize(&self.data_root).unwrap_or_else(|_| self.data_root.clone());
        if canonical.starts_with(&data_root) || data_root.starts_with(&canonical) {
            return Err(SyncSettingsError("同步文件夹不能放在 RetainPDF 的数据目录里，也不能包含它".into()));
        }
        let root = sync_root_for(&canonical);
        let probe = (|| -> Result<()> {
            std::fs::create_dir_all(&root)?;
            let test = root.join(format!(".write-test-{:08x}", fastrand::u32(..)));
            std::fs::write(&test, b"ok")?;
            std::fs::remove_file(&test)?;
            Ok(())
        })();
        probe.map_err(|error| SyncSettingsError(format!("无法写入这个文件夹：{error}")))
    }

    /// 跑一轮(已经有一轮在跑就等它跑完,再跑一轮)。开关关着或没设文件夹时不跑,返回 None。
    pub async fn run_once(self: &Arc<Self>) -> Result<Option<SyncRunView>> {
        let _guard = self.run_lock.lock().await;
        if !self.enabled()? {
            return Ok(None);
        }
        let Some(folder) = self.folder()? else {
            return Ok(None);
        };
        let device_name = self.device_name()?;
        self.running.store(true, Ordering::SeqCst);
        let started_at = now_iso();
        let service = self.clone();
        let outcome = tokio::task::spawn_blocking(move || {
            let root = sync_root_for(&folder);
            std::fs::create_dir_all(&root)
                .with_context(|| format!("无法访问同步文件夹 {}", root.display()))?;
            SyncEngine::new((*service.db).clone(), &service.data_root, &root, &device_name)?.run_cycle()
        })
        .await;
        self.running.store(false, Ordering::SeqCst);
        let mut view = SyncRunView {
            started_at,
            finished_at: now_iso(),
            ..SyncRunView::default()
        };
        match outcome {
            Ok(Ok(report)) => {
                view.ok = true;
                view.exported = report.exported;
                view.applied = report.applied;
                view.deleted = report.deleted;
                view.files_uploaded = report.blobs_uploaded;
                view.files_downloaded = report.files_written;
                view.rejected = report.rejected;
                view.folder_changed = report.folder_changed;
                view.device_renewed = report.device_renewed;
                if report.exported + report.applied > 0 {
                    tracing::info!(
                        exported = report.exported,
                        applied = report.applied,
                        pending = report.pending,
                        "sync cycle"
                    );
                }
            }
            Ok(Err(error)) => {
                tracing::warn!("sync cycle failed: {error:#}");
                view.error = Some(format!("{error:#}"));
            }
            Err(error) => view.error = Some(format!("同步中断：{error}")),
        }
        if let Ok(json) = serde_json::to_string(&view) {
            let _ = self.db.sync_state_set(KEY_LAST_RUN, &json);
        }
        *self.last_run.lock().expect("sync last_run poisoned") = Some(view.clone());
        Ok(Some(view))
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
