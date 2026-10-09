//! 多设备同步的接口视图(GET/PUT /api/v1/sync、POST /api/v1/sync/run、POST /api/v1/sync/test)。

use serde::{Deserialize, Serialize};

/// 修改同步设置;没给的字段不变。
#[derive(Debug, Clone, Default, Deserialize)]
pub struct SyncSettingsInput {
    pub enabled: Option<bool>,
    /// 用户选的文件夹(绝对路径)。里面已经是同步文件夹就直接用,否则在里面建
    /// `RetainPDF-Sync` 子目录。空串表示清除。
    pub folder: Option<String>,
    pub device_name: Option<String>,
    /// "folder"(网盘文件夹)或 "webdav"。
    pub transport: Option<String>,
    /// WebDAV 上的同步文件夹地址(http:// 或 https://)。
    pub webdav_url: Option<String>,
    pub webdav_username: Option<String>,
    /// 只写:给了就保存(空串清除),状态里只报告有没有。
    pub webdav_password: Option<String>,
}

/// 连通性测试的结果。
#[derive(Debug, Clone, Serialize)]
pub struct SyncTestView {
    pub ok: bool,
    /// 测的是哪里(本机路径或不带账号的 WebDAV 地址)。
    pub location: String,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

/// 最近一轮同步的结果。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SyncRunView {
    pub started_at: String,
    pub finished_at: String,
    pub ok: bool,
    pub error: Option<String>,
    /// 发出去的改动条数。
    pub exported: usize,
    /// 收到并应用的改动条数(含删除)。
    pub applied: usize,
    pub deleted: usize,
    pub files_uploaded: usize,
    pub files_downloaded: usize,
    pub rejected: usize,
    /// 这一轮发现换了同步文件夹,本机书库全部重新发。
    pub folder_changed: bool,
    /// 这一轮发现数据目录是从别处复制来的,换了新设备号。
    pub device_renewed: bool,
}

/// 等待区里的一条:还在等文件或等相关的书、任务同步过来。
#[derive(Debug, Clone, Serialize)]
pub struct SyncPendingItemView {
    pub kind: String,
    pub key: String,
    pub reason: String,
    pub attempts: i64,
}

/// 同步文件夹里的另一台设备。
#[derive(Debug, Clone, Serialize)]
pub struct SyncPeerView {
    pub device_id: String,
    pub name: String,
    pub segments_read: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SyncStatusView {
    pub enabled: bool,
    /// "folder" 或 "webdav"。
    pub transport: String,
    pub webdav_url: Option<String>,
    pub webdav_username: Option<String>,
    pub webdav_has_password: bool,
    /// 用户选的文件夹。
    pub folder: Option<String>,
    /// 实际读写的同步文件夹(folder 本身或其中的 RetainPDF-Sync;WebDAV 时是地址)。
    pub sync_root: Option<String>,
    pub device_id: Option<String>,
    pub device_name: String,
    pub running: bool,
    pub interval_seconds: u64,
    pub last_run: Option<SyncRunView>,
    pub pending_total: usize,
    pub pending: Vec<SyncPendingItemView>,
    pub peers: Vec<SyncPeerView>,
}
