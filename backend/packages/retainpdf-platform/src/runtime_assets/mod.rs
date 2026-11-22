//! 按需下载的运行时资源（字体、Typst）的接口门面：下载、校验、缓存在 retainpdf-data 的 `runtime_assets`，
//! 这里给设置页一个看进度、手动重试的出口。方案见 `docs/ops/planning/desktop-size/`。

use std::path::{Path, PathBuf};

use serde::Serialize;

pub use retainpdf_data::runtime_assets::{spawn_runtime_assets_prefetch, RuntimeAssetView};

/// `GET /api/v1/runtime-assets` 的返回。
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct RuntimeAssetsView {
    /// 桌面端打开了按需下载（`RETAIN_PDF_RUNTIME_ASSETS=download`）。没打开时（Docker、开发环境）资源都在包里，
    /// 每项多半是 `bundled`；缺的也不会去下。
    pub downloads_enabled: bool,
    pub assets: Vec<RuntimeAssetView>,
}

/// 接口要的两个目录：看包里带没带（项目根）、缓存在哪（数据目录）。
pub struct RuntimeAssetsApiDeps<'a> {
    project_root: &'a Path,
    data_root: &'a Path,
}

impl<'a> RuntimeAssetsApiDeps<'a> {
    pub fn new(project_root: &'a Path, data_root: &'a Path) -> Self {
        Self { project_root, data_root }
    }
}

pub fn runtime_assets_view(deps: &RuntimeAssetsApiDeps<'_>) -> RuntimeAssetsView {
    RuntimeAssetsView {
        downloads_enabled: retainpdf_data::runtime_assets::downloads_enabled(),
        assets: retainpdf_data::runtime_assets::runtime_assets_status(deps.data_root, Some(deps.project_root)),
    }
}

/// 手动重试：在后台把缺的、失败的再下一遍，马上返回当前状态（进度靠再 GET）。没打开按需下载时什么都不做。
pub fn start_runtime_assets_download(deps: &RuntimeAssetsApiDeps<'_>) -> RuntimeAssetsView {
    spawn_runtime_assets_prefetch(PathBuf::from(deps.data_root), Some(PathBuf::from(deps.project_root)));
    runtime_assets_view(deps)
}
