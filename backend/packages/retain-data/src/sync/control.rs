//! 同步的设置与「跑一轮并记下结果」:后端的同步服务和命令行(后端没开时)共用。
//!
//! - 设置存在数据库 `sync_state` 里,跟着数据目录走:同步方式(网盘文件夹 / WebDAV)、
//!   文件夹路径或 WebDAV 地址与账号密码、设备名、开关。WebDAV 密码只写不读,也不进同步数据;
//! - 每轮的结果记成 `last_run`,整理同步文件夹的结果记成 `last_maintenance`(都写进
//!   sync_state,重启后、换个程序看都还在)。
//!
//! 网盘文件夹:用户选的文件夹里已经是同步文件夹(有 format.json)就直接用,否则在里面建
//! `RetainPDF-Sync`,选网盘根目录也不会把东西撒在用户自己的文件中间。WebDAV 地址就是
//! 同步文件夹本身(比如 `http://nas:5005/webdav/retainpdf`)。
//!
//! 同一个数据目录同一时间只能有一个程序在同步:后端开着时命令行转给后端。

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use retain_core::models::api::{
    SyncMaintenanceView, SyncPeerView, SyncPendingItemView, SyncRunView, SyncSettingsInput, SyncStatusView,
    SyncTestView,
};
use retain_core::models::domain::now_iso;

use super::{SyncEngine, WebDavBackend, WebDavConfig};
use crate::db::Db;

pub const KEY_ENABLED: &str = "enabled";
pub const KEY_TRANSPORT: &str = "transport";
pub const KEY_FOLDER: &str = "folder";
pub const KEY_WEBDAV_URL: &str = "webdav_url";
pub const KEY_WEBDAV_USERNAME: &str = "webdav_username";
pub const KEY_WEBDAV_PASSWORD: &str = "webdav_password";
pub const KEY_DEVICE_NAME: &str = "device_name";
pub const KEY_DEVICE_ID: &str = "device_id";
pub const KEY_LAST_RUN: &str = "last_run";
pub const KEY_LAST_MAINTENANCE: &str = "last_maintenance";
/// 用户选的文件夹里建的子目录名。
pub const SYNC_SUBDIR: &str = "RetainPDF-Sync";
pub const TRANSPORT_FOLDER: &str = "folder";
pub const TRANSPORT_WEBDAV: &str = "webdav";

/// 这台电脑的名字(给其它设备看)。macOS 用「电脑名称」,其它系统用主机名。
pub fn default_device_name() -> String {
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
pub enum SyncTarget {
    Folder(PathBuf),
    WebDav(WebDavConfig),
}

impl SyncTarget {
    /// 给人看的位置(本机路径或不带账号的 WebDAV 地址)。
    pub fn location(&self) -> String {
        match self {
            SyncTarget::Folder(folder) => sync_root_for(folder).to_string_lossy().to_string(),
            SyncTarget::WebDav(config) => config.url.trim().trim_end_matches('/').to_string(),
        }
    }
}

/// 设置校验失败(给用户看的原因)。
#[derive(Debug)]
pub struct SyncSettingsError(pub String);

fn invalid(reason: impl Into<String>) -> SyncSettingsError {
    SyncSettingsError(reason.into())
}

pub fn check_webdav_url(url: &str) -> std::result::Result<(), SyncSettingsError> {
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

/// 一个数据目录的同步设置与运行。
#[derive(Clone)]
pub struct SyncControl {
    db: Db,
    data_root: PathBuf,
}

impl SyncControl {
    pub fn new(db: Db, data_root: PathBuf) -> Self {
        Self { db, data_root }
    }

    pub fn get(&self, key: &str) -> Result<Option<String>> {
        Ok(self.db.sync_state_get(key)?.filter(|v| !v.is_empty()))
    }

    pub fn enabled(&self) -> Result<bool> {
        Ok(self.get(KEY_ENABLED)?.as_deref() == Some("1"))
    }

    pub fn transport(&self) -> Result<String> {
        Ok(self.get(KEY_TRANSPORT)?.unwrap_or_else(|| TRANSPORT_FOLDER.to_string()))
    }

    /// 由已保存的设置(叠上 `overlay` 里给了的字段)得到同步目标;没配好为 None。
    pub fn target(&self, overlay: Option<&SyncSettingsInput>) -> Result<Option<SyncTarget>> {
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
            return Ok(Some(SyncTarget::WebDav(WebDavConfig { url, username, password })));
        }
        Ok(pick(overlay.map(|o| &o.folder), KEY_FOLDER)?.map(|f| SyncTarget::Folder(PathBuf::from(f))))
    }

    pub fn device_name(&self) -> Result<String> {
        match self.get(KEY_DEVICE_NAME)?.filter(|n| !n.trim().is_empty()) {
            Some(name) => Ok(name),
            None => {
                let name = default_device_name();
                self.db.sync_state_set(KEY_DEVICE_NAME, &name)?;
                Ok(name)
            }
        }
    }

    pub fn engine(&self, target: &SyncTarget, device_name: &str) -> Result<SyncEngine> {
        match target {
            SyncTarget::Folder(folder) => {
                let root = sync_root_for(folder);
                std::fs::create_dir_all(&root)
                    .with_context(|| format!("无法访问同步文件夹 {}", root.display()))?;
                SyncEngine::new(self.db.clone(), &self.data_root, &root, device_name)
            }
            SyncTarget::WebDav(config) => {
                let backend = WebDavBackend::new(config, &self.data_root.join("sync-work"))?;
                SyncEngine::with_backend(self.db.clone(), &self.data_root, Box::new(backend), device_name)
            }
        }
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
            if enabled && self.target(None)?.is_none() {
                return Ok(Err(invalid(if self.transport()? == TRANSPORT_WEBDAV {
                    "请先填写 WebDAV 地址"
                } else {
                    "请先选择同步文件夹"
                })));
            }
            self.db.sync_state_set(KEY_ENABLED, if enabled { "1" } else { "0" })?;
        }
        Ok(Ok(()))
    }

    pub fn check_folder(&self, folder: &Path) -> std::result::Result<(), SyncSettingsError> {
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

    /// 用给的设置(没给的用已保存的)测一次能不能读写。不改设置、不碰同步数据。会阻塞
    /// (访问 NAS),异步调用方放到阻塞线程里。
    pub fn test(&self, input: &SyncSettingsInput) -> Result<SyncTestView> {
        if let Some(url) = input.webdav_url.as_deref().map(str::trim).filter(|u| !u.is_empty()) {
            if let Err(reason) = check_webdav_url(url) {
                return Ok(SyncTestView { ok: false, location: url.to_string(), latency_ms: None, error: Some(reason.0) });
            }
        }
        let Some(target) = self.target(Some(input))? else {
            return Ok(SyncTestView {
                ok: false,
                location: String::new(),
                latency_ms: None,
                error: Some("还没有填写同步位置".into()),
            });
        };
        if let SyncTarget::Folder(folder) = &target {
            if let Err(reason) = self.check_folder(folder) {
                return Ok(SyncTestView { ok: false, location: target.location(), latency_ms: None, error: Some(reason.0) });
            }
        }
        let location = target.location();
        let device_name = self.device_name()?;
        Ok(match self.engine(&target, &device_name).and_then(|engine| engine.probe()) {
            Ok(latency) => SyncTestView { ok: true, location, latency_ms: Some(latency), error: None },
            Err(error) => SyncTestView { ok: false, location, latency_ms: None, error: Some(format!("{error:#}")) },
        })
    }

    /// 跑一轮并记下结果(`last_run`,整理过的话还有 `last_maintenance`)。开关关着或没配好
    /// 时不跑,返回 None。会阻塞;同一数据目录同一时间只能跑一轮,由调用方保证。
    pub fn run_recorded(&self) -> Result<Option<(SyncRunView, Vec<SyncPeerView>)>> {
        if !self.enabled()? {
            return Ok(None);
        }
        let Some(target) = self.target(None)? else {
            return Ok(None);
        };
        let device_name = self.device_name()?;
        let started_at = now_iso();
        let outcome = (|| {
            let engine = self.engine(&target, &device_name)?;
            let report = engine.run_cycle()?;
            let peers = engine.peers().unwrap_or_default();
            Ok::<_, anyhow::Error>((report, peers))
        })();
        let mut view = SyncRunView { started_at, finished_at: now_iso(), ..SyncRunView::default() };
        let mut peer_views = Vec::new();
        match outcome {
            Ok((report, peers)) => {
                view.ok = true;
                view.exported = report.exported;
                view.applied = report.applied;
                view.deleted = report.deleted;
                view.files_uploaded = report.blobs_uploaded;
                view.files_downloaded = report.files_written;
                view.rejected = report.rejected;
                view.folder_changed = report.folder_changed;
                view.device_renewed = report.device_renewed;
                if report.maintained || report.maintenance_error.is_some() {
                    let maintenance = SyncMaintenanceView {
                        at: now_iso(),
                        segments_compacted: report.segments_compacted,
                        packs_retired: report.packs_retired,
                        packs_deleted: report.packs_deleted,
                        bytes_freed: report.bytes_freed,
                        bytes_repacked: report.bytes_repacked,
                        error: report.maintenance_error.clone(),
                    };
                    if let Ok(json) = serde_json::to_string(&maintenance) {
                        let _ = self.db.sync_state_set(KEY_LAST_MAINTENANCE, &json);
                    }
                }
                peer_views = peers
                    .into_iter()
                    .map(|peer| SyncPeerView { device_id: peer.device_id, name: peer.name, segments_read: peer.segments_read })
                    .collect();
                if report.exported + report.applied > 0 {
                    tracing::info!(exported = report.exported, applied = report.applied, pending = report.pending, "sync cycle");
                }
            }
            Err(error) => {
                tracing::warn!("sync cycle failed: {error:#}");
                view.error = Some(format!("{error:#}"));
            }
        }
        if let Ok(json) = serde_json::to_string(&view) {
            let _ = self.db.sync_state_set(KEY_LAST_RUN, &json);
        }
        Ok(Some((view, peer_views)))
    }

    /// 状态视图。`running`、`interval_seconds`、`peers` 由调用方给(后端在内存里记着;
    /// 命令行离线时没有在跑,其它设备由它自己去问)。
    pub fn status_view(
        &self,
        running: bool,
        interval_seconds: u64,
        peers: Vec<SyncPeerView>,
    ) -> Result<SyncStatusView> {
        let (pending_total, pending) = self.db.sync_pending_summary(20)?;
        let target = self.target(None)?;
        Ok(SyncStatusView {
            enabled: self.enabled()?,
            transport: self.transport()?,
            webdav_url: self.get(KEY_WEBDAV_URL)?,
            webdav_username: self.get(KEY_WEBDAV_USERNAME)?,
            webdav_has_password: self.get(KEY_WEBDAV_PASSWORD)?.is_some(),
            folder: self.get(KEY_FOLDER)?,
            sync_root: target.as_ref().map(SyncTarget::location),
            device_id: self.get(KEY_DEVICE_ID)?,
            device_name: self.device_name()?,
            running,
            interval_seconds,
            last_run: self.last_run(),
            last_maintenance: self.last_maintenance(),
            pending_total,
            pending: pending
                .into_iter()
                .map(|p| SyncPendingItemView { kind: p.kind, key: p.key, reason: p.reason, attempts: p.attempts })
                .collect(),
            peers,
        })
    }

    pub fn last_run(&self) -> Option<SyncRunView> {
        self.get(KEY_LAST_RUN).ok().flatten().and_then(|json| serde_json::from_str(&json).ok())
    }

    pub fn last_maintenance(&self) -> Option<SyncMaintenanceView> {
        self.get(KEY_LAST_MAINTENANCE).ok().flatten().and_then(|json| serde_json::from_str(&json).ok())
    }
}
