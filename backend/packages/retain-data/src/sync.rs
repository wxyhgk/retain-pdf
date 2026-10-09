//! 多设备同步:几台设备通过一个「同步文件夹」(网盘客户端同步的目录)交换书库。
//!
//! 同步文件夹里只有文件,不需要任何一端跑服务;网盘只负责把文件搬到各台设备上。
//!
//! ```text
//! <同步文件夹>/
//!   format.json                     格式名与版本
//!   blobs/<前两位>/<sha256>          文件内容,按内容指纹命名,写了就不再改
//!   devices/<设备号>/device.json     设备说明
//!   devices/<设备号>/changes/<序号>.jsonl
//!                                   这台设备的改动记录,分段追加,每段写完不再改,
//!                                   最后一行是结束标记(没有就是还没同步完整)
//! ```
//!
//! 每台设备只写自己的 `devices/<设备号>/`,内容文件按指纹命名,所以没有两台设备会写
//! 同一个文件,网盘不会生成冲突副本。所有文件先写临时名再改名,读的一方看不到半个文件。
//!
//! 一条改动记录是一个实体(见 `retain_db::db::sync`)的完整新状态,或它被删除。每个字段
//! (根表的每一列、每张子表、文件清单)各带一个时钟,只有真正变了的字段换新时钟;收到
//! 时逐个字段比,时钟新的胜出。时钟是混合逻辑时钟(看到别的设备的时钟后,本机时钟不会
//! 落在它后面)。所以两台设备改了同一本书的不同地方都保留,改了同一处以后改的为准,
//! 而且不论各设备按什么顺序同步,结果都一样。删除也是一条带时钟的记录:比它旧的改动
//! 不会让实体复活,比它新的改动(删除之后又改过)会。依赖还没到的改动(文件还没同步
//! 过来、指向的书或任务还不在)放进等待区,之后每轮重试。
//!
//! 不同步:渲染中间文件(各设备自己重新生成)、还在排队或运行的任务、凭据。

mod clock;
mod engine;
mod files;
mod folder;

pub use engine::{SyncEngine, SyncReport};
pub use folder::{SyncFolder, SYNC_FORMAT, SYNC_FORMAT_VERSION};

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
#[path = "sync/tests.rs"]
mod tests;
