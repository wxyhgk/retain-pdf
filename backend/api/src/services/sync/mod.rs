//! 多设备同步的应用服务:设置、后台定时同步、立即同步、连通性测试、状态。
//!
//! 同步本身在 `retain_data::sync`(格式与合并规则见那里)。这里负责:
//! - 设置存在数据库 `sync_state` 里,跟着数据目录走,桌面版、网页版、Docker 都一样:
//!   同步方式(网盘文件夹 / WebDAV)、文件夹路径或 WebDAV 地址与账号密码、设备名、开关。
//!   WebDAV 密码只写不读(状态里只报告有没有),也不进同步数据;
//! - 后台每隔 `RUST_API_SYNC_INTERVAL_SECS`(默认 60)秒跑一轮,改设置或点「立即同步」
//!   时马上跑;同一时间只跑一轮;
//! - 每轮的结果记成 `last_run`(也写进 sync_state,重启后还看得到),其它设备的列表在
//!   每轮结束时记下:界面查状态不会再去问 NAS。
//!
//! 网盘文件夹:用户选的文件夹里已经是同步文件夹(有 format.json)就直接用,否则在里面建
//! `RetainPDF-Sync`,选网盘根目录也不会把东西撒在用户自己的文件中间。WebDAV 地址就是
//! 同步文件夹本身(比如 `http://nas:5005/webdav/retainpdf`)。

pub mod api;

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{Context, Result};
use retain_data::sync::{SyncEngine, WebDavBackend, WebDavConfig};

use crate::db::Db;
use crate::models::api::{
    SyncPeerView, SyncPendingItemView, SyncRunView, SyncSettingsInput, SyncStatusView,
    SyncTestView,
};
use crate::models::domain::now_iso;

const KEY_ENABLED: &str = "enabled";
const KEY_TRANSPORT: &str = "transport";
const KEY_FOLDER: &str = "folder";
const KEY_WEBDAV_URL: &str = "webdav_url";
const KEY_WEBDAV_USERNAME: &str = "webdav_username";
const KEY_WEBDAV_PASSWORD: &str = "webdav_password";
const KEY_DEVICE_NAME: &str = "device_name";
const KEY_DEVICE_ID: &str = "device_id";
const KEY_LAST_RUN: &str = "last_run";
/// 用户选的文件夹里建的子目录名。
pub const SYNC_SUBDIR: &str = "RetainPDF-Sync";
const TRANSPORT_FOLDER: &str = "folder";
const TRANSPORT_WEBDAV: &str = "webdav";

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

/// 同步到哪里。
#[derive(Clone)]
enum Target {
    Folder(PathBuf),
    WebDav(WebDavConfig),
}

impl Target {
    fn location(&self) -> String {
        match self {
            Target::Folder(folder) => sync_root_for(folder).to_string_lossy().to_string(),
            Target::WebDav(config) => config.url.trim().trim_end_matches('/').to_string(),
        }
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
    peers: Mutex<Vec<SyncPeerView>>,
    wake: tokio::sync::Notify,
}

/// 设置校验失败(给用户看的原因)。
#[derive(Debug)]
pub struct SyncSettingsError(pub String);

fn invalid(reason: impl Into<String>) -> SyncSettingsError {
    SyncSettingsError(reason.into())
}

fn check_webdav_url(url: &str) -> std::result::Result<(), SyncSettingsError> {
    let parsed = reqwest::Url::parse(url).map_err(|_| invalid("WebDAV 地址不对，应当像 http://192.168.1.2:5005/webdav/retainpdf"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(invalid("WebDAV 地址要以 http:// 或 https:// 开头"));
    }
    if parsed.host_str().unwrap_or("").is_empty() {
        return Err(invalid("WebDAV 地址缺少主机名"));
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(invalid("账号密码请填在下面的输入框里，不要写进地址"));
    }
    Ok(())
}

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
            peers: Mutex::new(Vec::new()),
            wake: tokio::sync::Notify::new(),
        }
    }

    fn get(&self, key: &str) -> Result<Option<String>> {
        Ok(self.db.sync_state_get(key)?.filter(|v| !v.is_empty()))
    }

    fn enabled(&self) -> Result<bool> {
        Ok(self.get(KEY_ENABLED)?.as_deref() == Some("1"))
    }

    fn transport(&self) -> Result<String> {
        Ok(self.get(KEY_TRANSPORT)?.unwrap_or_else(|| TRANSPORT_FOLDER.to_string()))
    }

    /// 由已保存的设置(叠上 `overlay` 里给了的字段)得到同步目标;没配好为 None。
    fn target_with(&self, overlay: Option<&SyncSettingsInput>) -> Result<Option<Target>> {
        let pick = |given: Option<&Option<String>>, key: &str| -> Result<Option<String>> {
            match given {
                Some(Some(value)) => Ok(Some(value.trim().to_string()).filter(|v| !v.is_empty())),
                _ => self.get(key),
            }
        };
        let transport = pick(overlay.map(|o| &o.transport), KEY_TRANSPORT)?
            .unwrap_or_else(|| TRANSPORT_FOLDER.to_string());
        if transport == TRANSPORT_WEBDAV {
            let Some(url) = pick(overlay.map(|o| &o.webdav_url), KEY_WEBDAV_URL)? else {
                return Ok(None);
            };
            let username = pick(overlay.map(|o| &o.webdav_username), KEY_WEBDAV_USERNAME)?.unwrap_or_default();
            // 密码不去空格(可能本来就含空格);没给就用已保存的。
            let password = match overlay.and_then(|o| o.webdav_password.clone()) {
                Some(password) if !password.is_empty() => password,
                _ => self.get(KEY_WEBDAV_PASSWORD)?.unwrap_or_default(),
            };
            return Ok(Some(Target::WebDav(WebDavConfig { url, username, password })));
        }
        Ok(pick(overlay.map(|o| &o.folder), KEY_FOLDER)?.map(|f| Target::Folder(PathBuf::from(f))))
    }

    fn device_name(&self) -> Result<String> {
        match self.get(KEY_DEVICE_NAME)?.filter(|n| !n.trim().is_empty()) {
            Some(name) => Ok(name),
            None => {
                let name = default_device_name();
                self.db.sync_state_set(KEY_DEVICE_NAME, &name)?;
                Ok(name)
            }
        }
    }

    fn engine(&self, target: &Target, device_name: &str) -> Result<SyncEngine> {
        match target {
            Target::Folder(folder) => {
                let root = sync_root_for(folder);
                std::fs::create_dir_all(&root)
                    .with_context(|| format!("无法访问同步文件夹 {}", root.display()))?;
                SyncEngine::new((*self.db).clone(), &self.data_root, &root, device_name)
            }
            Target::WebDav(config) => {
                let backend = WebDavBackend::new(config, &self.data_root.join("sync-work"))?;
                SyncEngine::with_backend((*self.db).clone(), &self.data_root, Box::new(backend), device_name)
            }
        }
    }

    pub fn status(&self) -> Result<SyncStatusView> {
        let (pending_total, pending) = self.db.sync_pending_summary(20)?;
        let target = self.target_with(None)?;
        Ok(SyncStatusView {
            enabled: self.enabled()?,
            transport: self.transport()?,
            webdav_url: self.get(KEY_WEBDAV_URL)?,
            webdav_username: self.get(KEY_WEBDAV_USERNAME)?,
            webdav_has_password: self.get(KEY_WEBDAV_PASSWORD)?.is_some(),
            folder: self.get(KEY_FOLDER)?,
            sync_root: target.as_ref().map(Target::location),
            device_id: self.get(KEY_DEVICE_ID)?,
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
            peers: self.peers.lock().expect("sync peers poisoned").clone(),
        })
    }

    /// 改设置。开启时必须已配好同步目标。
    pub fn update(&self, input: &SyncSettingsInput) -> Result<std::result::Result<(), SyncSettingsError>> {
        if let Some(transport) = &input.transport {
            if transport != TRANSPORT_FOLDER && transport != TRANSPORT_WEBDAV {
                return Ok(Err(invalid("同步方式只能是网盘文件夹或 WebDAV")));
            }
        }
        if let Some(folder) = &input.folder {
            let folder = folder.trim();
            if !folder.is_empty() {
                if let Err(reason) = self.check_folder(Path::new(folder)) {
                    return Ok(Err(reason));
                }
            }
        }
        if let Some(url) = &input.webdav_url {
            let url = url.trim();
            if !url.is_empty() {
                if let Err(reason) = check_webdav_url(url) {
                    return Ok(Err(reason));
                }
            }
        }
        if let Some(name) = &input.device_name {
            if name.trim().chars().count() > 64 {
                return Ok(Err(invalid("设备名最多 64 个字")));
            }
        }
        for (value, key) in [
            (&input.transport, KEY_TRANSPORT),
            (&input.folder, KEY_FOLDER),
            (&input.webdav_url, KEY_WEBDAV_URL),
            (&input.webdav_username, KEY_WEBDAV_USERNAME),
            (&input.device_name, KEY_DEVICE_NAME),
        ] {
            if let Some(value) = value {
                self.db.sync_state_set(key, value.trim())?;
            }
        }
        if let Some(password) = &input.webdav_password {
            self.db.sync_state_set(KEY_WEBDAV_PASSWORD, password)?;
        }
        if let Some(enabled) = input.enabled {
            if enabled && self.target_with(None)?.is_none() {
                return Ok(Err(invalid(if self.transport()? == TRANSPORT_WEBDAV {
                    "请先填写 WebDAV 地址"
                } else {
                    "请先选择同步文件夹"
                })));
            }
            self.db.sync_state_set(KEY_ENABLED, if enabled { "1" } else { "0" })?;
        }
        self.wake.notify_one();
        Ok(Ok(()))
    }

    fn check_folder(&self, folder: &Path) -> std::result::Result<(), SyncSettingsError> {
        if !folder.is_absolute() {
            return Err(invalid("请填写完整路径"));
        }
        let Ok(canonical) = std::fs::canonicalize(folder) else {
            return Err(invalid("文件夹不存在"));
        };
        if !canonical.is_dir() {
            return Err(invalid("这不是一个文件夹"));
        }
        let data_root = std::fs::canonicalize(&self.data_root).unwrap_or_else(|_| self.data_root.clone());
        if canonical.starts_with(&data_root) || data_root.starts_with(&canonical) {
            return Err(invalid("同步文件夹不能放在 RetainPDF 的数据目录里，也不能包含它"));
        }
        let root = sync_root_for(&canonical);
        let probe = (|| -> Result<()> {
            std::fs::create_dir_all(&root)?;
            let test = root.join(format!(".write-test-{:08x}", fastrand::u32(..)));
            std::fs::write(&test, b"ok")?;
            std::fs::remove_file(&test)?;
            Ok(())
        })();
        probe.map_err(|error| invalid(format!("无法写入这个文件夹：{error}")))
    }

    /// 用给的设置(没给的用已保存的)测一次能不能读写。不改设置、不碰同步数据。
    pub async fn test(self: &Arc<Self>, input: &SyncSettingsInput) -> Result<SyncTestView> {
        if let Some(url) = input.webdav_url.as_deref().map(str::trim).filter(|u| !u.is_empty()) {
            if let Err(reason) = check_webdav_url(url) {
                return Ok(SyncTestView { ok: false, location: url.to_string(), latency_ms: None, error: Some(reason.0) });
            }
        }
        let Some(target) = self.target_with(Some(input))? else {
            return Ok(SyncTestView {
                ok: false,
                location: String::new(),
                latency_ms: None,
                error: Some("还没有填写同步位置".into()),
            });
        };
        if let Target::Folder(folder) = &target {
            if let Err(reason) = self.check_folder(folder) {
                return Ok(SyncTestView { ok: false, location: target.location(), latency_ms: None, error: Some(reason.0) });
            }
        }
        let location = target.location();
        let device_name = self.device_name()?;
        let service = self.clone();
        let outcome = tokio::task::spawn_blocking(move || service.engine(&target, &device_name)?.probe()).await;
        Ok(match outcome {
            Ok(Ok(latency)) => SyncTestView { ok: true, location, latency_ms: Some(latency), error: None },
            Ok(Err(error)) => SyncTestView { ok: false, location, latency_ms: None, error: Some(format!("{error:#}")) },
            Err(error) => SyncTestView { ok: false, location, latency_ms: None, error: Some(format!("测试中断：{error}")) },
        })
    }

    /// 跑一轮(已经有一轮在跑就等它跑完,再跑一轮)。开关关着或没配好时不跑,返回 None。
    pub async fn run_once(self: &Arc<Self>) -> Result<Option<SyncRunView>> {
        let _guard = self.run_lock.lock().await;
        if !self.enabled()? {
            return Ok(None);
        }
        let Some(target) = self.target_with(None)? else {
            return Ok(None);
        };
        let device_name = self.device_name()?;
        self.running.store(true, Ordering::SeqCst);
        let started_at = now_iso();
        let service = self.clone();
        let outcome = tokio::task::spawn_blocking(move || {
            let engine = service.engine(&target, &device_name)?;
            let report = engine.run_cycle()?;
            let peers = engine.peers().unwrap_or_default();
            Ok::<_, anyhow::Error>((report, peers))
        })
        .await;
        self.running.store(false, Ordering::SeqCst);
        let mut view = SyncRunView {
            started_at,
            finished_at: now_iso(),
            ..SyncRunView::default()
        };
        match outcome {
            Ok(Ok((report, peers))) => {
                view.ok = true;
                view.exported = report.exported;
                view.applied = report.applied;
                view.deleted = report.deleted;
                view.files_uploaded = report.blobs_uploaded;
                view.files_downloaded = report.files_written;
                view.rejected = report.rejected;
                view.folder_changed = report.folder_changed;
                view.device_renewed = report.device_renewed;
                *self.peers.lock().expect("sync peers poisoned") = peers
                    .into_iter()
                    .map(|peer| SyncPeerView {
                        device_id: peer.device_id,
                        name: peer.name,
                        segments_read: peer.segments_read,
                    })
                    .collect();
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
