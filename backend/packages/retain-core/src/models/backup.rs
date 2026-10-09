//! 数据库备份的接口视图(/api/v1/backups)。

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct BackupItemView {
    pub id: String,
    /// auto(每天自动)、manual(手动)、before-restore(恢复前)、before-upgrade(升级前)。
    pub kind: String,
    pub created_at: String,
    /// 备份时数据库的结构版本。
    pub schema_version: i64,
    /// 压缩后的大小。
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct BackupStatusView {
    /// 备份放在哪个目录。
    pub dir: String,
    /// 自动备份间隔(小时);0 表示关掉了自动备份。
    pub auto_interval_hours: u64,
    pub last_auto_at: Option<String>,
    /// 正在备份或恢复。
    pub running: bool,
    /// 现在恢复的话要先等什么(空表示可以恢复)。
    pub restore_blockers: Vec<String>,
    /// 新的在前。
    pub items: Vec<BackupItemView>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BackupRestoreView {
    pub restored: String,
    /// 恢复前自动存的那份(恢复错了用它退回)。
    pub safety_backup: String,
    pub status: BackupStatusView,
}
