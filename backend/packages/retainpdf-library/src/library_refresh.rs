//! 书库的后台对账：定时（默认 60 秒）比每本书的数据库戳记（`Db::document_change_stamps`），变了的书：
//!
//! 1. **重建全文索引**（`Db::rebuild_document_fts`，按用户选的译文版本）。对所有用户都做：以前索引只在任务完成、
//!    删任务时重建，改译文、切换译文版本、同步收进别的设备的改动以后搜到的还是旧的。
//! 2. **刷新书文件夹**（[`crate::book_export`]）：只在 `<数据目录>/books/` 已经存在（用户导出过一次）时做，
//!    没导出过的不花这份开销。
//!
//! 改译文、切换译文版本以后会提前叫醒（`retainpdf_data::library_signal`），不用等满一个周期；漏叫了也会在下一个
//! 周期按戳记对上，所以 jobsd 进程（任务收尾在那边）不用通知。只有 API 进程跑这个循环，`books/` 只有它写。
//!
//! 启动后的第一轮只记下戳记、不重建索引：索引在任务完成时已经建好，启动时的补索引（`backfill_fts_indexes`）
//! 负责「没有索引」「有更新的任务没进索引」两种情况；全部重建一遍几百本书要好几分钟。书文件夹第一轮照常比
//! meta.json 里记的戳记。

use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

use retainpdf_api_base::error::AppError;
use retainpdf_data::db::Db;

use crate::book_export::{refresh_folders, FolderRefreshReport, OwnedDeps};

/// 后台对账要的东西（全部持有所有权，交给后台任务）。
pub struct LibraryRefreshDeps {
    pub db: Db,
    pub data_root: PathBuf,
    pub python_bin: String,
    pub pipeline_command: String,
}

/// 书库的后台对账，带着进程内记住的上一轮状态。[`spawn_library_refresh`] 在后台循环里调 [`Self::run_once`]。
pub struct LibraryRefresher {
    owned: OwnedDeps,
    /// 上一轮每本书的正文戳记；`None` = 还没跑过第一轮。
    content: Option<HashMap<String, String>>,
    /// 书文件夹那一半处理过的戳记（见 `refresh_folders`）。
    folders: HashMap<String, String>,
}

/// 一轮做了什么（测试、日志用）。
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct LibraryRefreshReport {
    /// 重建了全文索引的书。
    pub reindexed: Vec<String>,
    /// 书文件夹：`None` = 没导出过（`books/` 不在），没做。
    pub folders: Option<FolderRefreshReport>,
}

impl LibraryRefresher {
    pub fn new(deps: LibraryRefreshDeps) -> Self {
        Self {
            owned: OwnedDeps {
                db: deps.db,
                data_root: deps.data_root,
                python_bin: deps.python_bin,
                pipeline_command: deps.pipeline_command,
            },
            content: None,
            folders: HashMap::new(),
        }
    }

    /// 跑一轮对账（在阻塞线程里调：可能重建索引、生成合并阅读、写文件）。
    pub fn run_once(&mut self) -> Result<LibraryRefreshReport, AppError> {
        let stamps = self.owned.db.document_change_stamps()?;
        let mut report = LibraryRefreshReport::default();
        let current: HashMap<String, String> =
            stamps.iter().map(|stamp| (stamp.document_id.clone(), stamp.content.clone())).collect();
        if let Some(previous) = self.content.as_ref() {
            for stamp in &stamps {
                if previous.get(&stamp.document_id) == Some(&stamp.content) {
                    continue;
                }
                match self.owned.db.rebuild_document_fts(&stamp.document_id) {
                    Ok(_) => report.reindexed.push(stamp.document_id.clone()),
                    Err(error) => tracing::warn!(document_id = %stamp.document_id, "fts refresh failed: {error:#}"),
                }
            }
        }
        self.content = Some(current);
        report.folders = refresh_folders(&self.owned, &stamps, &mut self.folders)?;
        Ok(report)
    }
}

/// 起后台对账循环：每 `interval` 一轮，或者被 `notify_library_changed` 叫醒（叫醒后等两秒再跑，连着改几处只跑一轮）。
/// 只在真正的服务里起（API 进程），单测不起。
pub fn spawn_library_refresh(deps: LibraryRefreshDeps, interval: Duration) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let refresher = std::sync::Arc::new(std::sync::Mutex::new(LibraryRefresher::new(deps)));
        loop {
            let refresher = refresher.clone();
            let outcome = tokio::task::spawn_blocking(move || {
                refresher.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).run_once()
            })
            .await;
            match outcome {
                Ok(Ok(report)) => {
                    let folders = report.folders.as_ref();
                    if !report.reindexed.is_empty() || folders.is_some_and(|f| f.checked + f.removed > 0) {
                        tracing::info!(
                            reindexed = report.reindexed.len(),
                            folders_checked = folders.map_or(0, |f| f.checked),
                            folders_exported = folders.map_or(0, |f| f.exported),
                            folders_removed = folders.map_or(0, |f| f.removed),
                            folders_failed = folders.map_or(0, |f| f.failed),
                            "library refresh"
                        );
                    }
                }
                Ok(Err(error)) => tracing::warn!("library refresh failed: {error}"),
                Err(error) => tracing::warn!("library refresh task failed: {error}"),
            }
            tokio::select! {
                _ = tokio::time::sleep(interval) => {}
                _ = retainpdf_data::library_signal::library_changed() => {
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
            }
        }
    })
}

