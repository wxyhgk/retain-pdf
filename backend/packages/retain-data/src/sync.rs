//! 多设备同步:几台设备通过一个「同步文件夹」交换书库。同步文件夹可以是网盘客户端
//! 同步的本机目录(iCloud、坚果云、Dropbox…,`folder.rs`),也可以在 WebDAV 上(群晖、
//! 坚果云、Nextcloud…,`webdav.rs`);两者只是「存文件」这一层不同,布局与格式见
//! `store.rs`:格式说明、每台设备自己的改动记录段,以及每段新增文件打成的包。
//!
//! 同步文件夹里只有文件,不需要任何一端跑服务。每台设备只写自己的 `devices/<设备号>/`,
//! 不会有两台设备写同一个文件(网盘不会生成冲突副本);改动记录段先写临时名再改名,读的
//! 一方看不到半段;文件包先于记录段写好,取出的每个文件都按指纹核对。
//!
//! 一条改动记录是一个实体(见 `retain_db::db::sync`)的完整新状态,或它被删除。每个字段
//! (根表的每一列、每张子表、文件清单)各带一个时钟,只有真正变了的字段换新时钟;收到
//! 时逐个字段比,时钟新的胜出。时钟是混合逻辑时钟(看到别的设备的时钟后,本机时钟不会
//! 落在它后面)。所以两台设备改了同一本书的不同地方都保留,改了同一处以后改的为准,
//! 而且不论各设备按什么顺序同步,结果都一样。删除也是一条带时钟的记录:比它旧的改动
//! 不会让实体复活,比它新的改动(删除之后又改过)会。依赖还没到的改动(文件还没同步
//! 过来、指向的书或任务还不在)放进等待区,之后每轮重试。
//!
//! 同步文件夹只增不减的话会越来越大、新设备要从头读起:每台设备每天看一次要不要整理自己
//! 的目录(`maintain.rs`,格式 3):旧的改动记录段合并成每个实体一条,没人用的文件包先停用、
//! 7 天后删,大半没用的包把还在用的内容重新打包。
//!
//! 不同步:渲染中间文件(各设备自己重新生成)、还没结束的任务 / AI 计算 / AI 改文档、
//! AI 对话在本机接着哪个会话(`local_only_columns`)、凭据。本机版本不认识的种类放进
//! 等待区,升级后再应用。

mod clock;
mod engine;
mod files;
mod folder;
mod store;
mod webdav;

pub use engine::{MaintenancePolicy, SyncEngine, SyncPeer, SyncReport};
pub use folder::FolderBackend;
pub use store::{Backend, SYNC_FORMAT, SYNC_FORMAT_VERSION};
pub use webdav::{WebDavBackend, WebDavConfig};

use serde::{Deserialize, Serialize};

use crate::db::sync::SyncRows;

/// 改动记录里的一个文件:相对数据目录的路径、内容指纹、大小。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SyncFileEntry {
    pub path: String,
    pub sha256: String,
    pub size: u64,
}

/// 一条改动记录(同步文件夹里改动记录段的一行)。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChangeRecord {
    pub kind: String,
    pub key: String,
    pub clock: String,
    pub device: String,
    #[serde(default)]
    pub deleted: bool,
    /// 数据目录的绝对路径写成 `{{data_root}}`,应用时换成本机的。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rows: Option<SyncRows>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub files: Vec<SyncFileEntry>,
    /// 每个字段的时钟:根表的列是 `<表>.<列>`,子表整表是 `<表>`,文件清单是 `$files`。
    /// 缺的字段按 `clock` 算。
    #[serde(default, skip_serializing_if = "std::collections::BTreeMap::is_empty")]
    pub clocks: std::collections::BTreeMap<String, String>,
}

#[cfg(test)]
#[path = "sync/test_dav.rs"]
mod test_dav;
#[cfg(test)]
#[path = "sync/tests.rs"]
mod tests;
