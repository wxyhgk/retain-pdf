//! 按需下载的运行时资源（字体、Typst）：安装包里不带，后端首次启动在后台从 npm 源下到
//! `<数据目录>/runtime-assets/`，按清单（`backend/config/runtime_assets.json`）逐个文件核对 sha256。
//! 方案见 `docs/ops/planning/desktop-size/20261122-字体和Typst按需下载.md`。
//!
//! - 包里（或环境变量指定的地方）已经带着的不下：Docker 镜像、开发环境、还带着字体的旧安装包都和以前一样；
//! - 下好的写进 `current.json`，Python 渲染时据此找字体和 typst（`retainpdf_pipeline.foundation.config.runtime_assets`）；
//! - rust_api 和 retain-jobsd 两个进程都可能触发下载，用锁文件保证同一时间只有一个在下，进度写在 `progress.json`；
//! - 下不下来不让任务卡住：渲染前最多等一会儿，还没有就用包里的后备字体（Python 那边决定）。

mod download;
mod manifest;
mod store;

use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use anyhow::Result;
use serde::Serialize;

use manifest::AssetSpec;
pub use store::AssetProgress;

/// 接口里一份资源的状态。
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct RuntimeAssetView {
    /// `fonts`、`typst`。
    pub id: String,
    pub title: String,
    pub version: String,
    /// `bundled`（包里带着，不用下）、`ready`（下好了）、`missing`（还没下）、`downloading`、`failed`。
    pub state: String,
    pub bytes_done: u64,
    pub bytes_total: u64,
    /// 正在从哪个源下（`npmmirror`、`npmjs`）。
    pub source: String,
    /// 失败时的原因。
    pub error: String,
}

/// 打开按需下载的开关：桌面端不再往包里放字体、Typst 时设 `RETAIN_PDF_RUNTIME_ASSETS=download`。
/// 没设就不下（Docker 镜像、开发环境、测试都不联网），渲染前也不等。
pub const DOWNLOAD_SWITCH_ENV: &str = "RETAIN_PDF_RUNTIME_ASSETS";

pub fn downloads_enabled() -> bool {
    std::env::var(DOWNLOAD_SWITCH_ENV).map(|value| value.trim() == "download").unwrap_or(false)
}

/// 每份资源现在的状态。
pub fn runtime_assets_status(data_root: &Path, project_root: Option<&Path>) -> Vec<RuntimeAssetView> {
    status_of(data_root, project_root, &manifest::assets_for_this_machine())
}

fn status_of(data_root: &Path, project_root: Option<&Path>, specs: &[AssetSpec]) -> Vec<RuntimeAssetView> {
    let progress = store::read_progress(data_root);
    let downloading = store::lock_held(data_root);
    specs
        .iter()
        .map(|spec| {
            let total = spec.total_bytes();
            let mut view = RuntimeAssetView {
                id: spec.id.to_string(),
                title: spec.title.clone(),
                version: spec.version.clone(),
                state: String::new(),
                bytes_done: 0,
                bytes_total: total,
                source: String::new(),
                error: String::new(),
            };
            if store::bundled_elsewhere(spec, project_root) {
                view.state = "bundled".into();
                view.bytes_done = total;
            } else if store::installed_dir(data_root, spec).is_some() {
                view.state = "ready".into();
                view.bytes_done = total;
            } else if let Some(progress) = progress.get(spec.id) {
                view.state = if progress.state == "downloading" && !downloading { "failed".into() } else { progress.state.clone() };
                view.bytes_done = progress.bytes_done;
                view.bytes_total = progress.bytes_total.max(1);
                view.source = progress.source.clone();
                view.error = if view.state == "failed" && progress.error.is_empty() {
                    "下载中断了".into()
                } else {
                    progress.error.clone()
                };
            } else {
                view.state = "missing".into();
            }
            view
        })
        .collect()
}

/// 下好的这份资源所在的目录（`fonts`、`typst`）；没下、版本不对、文件不全都是 None。
pub fn installed_asset_dir(data_root: &Path, id: &str) -> Option<PathBuf> {
    manifest::assets_for_this_machine()
        .into_iter()
        .find(|spec| spec.id == id)
        .and_then(|spec| store::installed_dir(data_root, &spec))
}

fn needs_download(view: &RuntimeAssetView) -> bool {
    matches!(view.state.as_str(), "missing" | "failed")
}

/// 把还没有的资源下下来。别的进程正在下就直接返回（返回 false），自己下完返回 true；单份失败记进进度，不报错。
pub async fn ensure_runtime_assets(data_root: &Path, project_root: Option<&Path>) -> Result<bool> {
    if !downloads_enabled() {
        return Ok(true);
    }
    ensure_specs(data_root, project_root, &manifest::assets_for_this_machine(), &download::registry_order()).await
}

async fn ensure_specs(
    data_root: &Path,
    project_root: Option<&Path>,
    specs: &[AssetSpec],
    registries: &[manifest::Registry],
) -> Result<bool> {
    let pending: Vec<&AssetSpec> = specs
        .iter()
        .filter(|spec| !store::bundled_elsewhere(spec, project_root) && store::installed_dir(data_root, spec).is_none())
        .collect();
    if pending.is_empty() {
        return Ok(true);
    }
    let Some(_lock) = store::try_lock(data_root)? else {
        return Ok(false);
    };
    let client = reqwest::Client::builder().connect_timeout(Duration::from_secs(15)).build()?;
    for spec in pending {
        // 拿锁之前别的进程可能刚下好
        if store::installed_dir(data_root, spec).is_some() {
            continue;
        }
        download::report(data_root, spec.id, "downloading", 0, spec.total_bytes(), "", "");
        match download::install(data_root, spec, &client, registries).await {
            Ok(dir) => {
                tracing::info!("runtime asset {} {} ready at {}", spec.id, spec.version, dir.display());
                let _ = store::write_progress(data_root, spec.id, None);
            }
            Err(error) => {
                tracing::warn!("runtime asset {} download failed: {error:#}", spec.id);
                download::report(data_root, spec.id, "failed", 0, spec.total_bytes(), "", &format!("{error:#}"));
            }
        }
    }
    Ok(true)
}

/// 渲染前等资源的上限：50MB 在慢的网上也够下完；再慢就先用后备字体排，不让任务一直等。
pub const RENDER_WAIT: Duration = Duration::from_secs(300);

/// 渲染前用：资源都有了就马上返回；没有就下（别的进程在下就等它），最多等 `timeout`。
/// 返回时还缺的，调用方照常往下走（Python 用后备字体；缺 Typst 时只走默认排版）。
pub async fn wait_for_runtime_assets(data_root: &Path, project_root: Option<&Path>, timeout: Duration) {
    if !downloads_enabled() {
        return;
    }
    wait_for_specs(data_root, project_root, &manifest::assets_for_this_machine(), &download::registry_order(), timeout).await
}

async fn wait_for_specs(
    data_root: &Path,
    project_root: Option<&Path>,
    specs: &[AssetSpec],
    registries: &[manifest::Registry],
    timeout: Duration,
) {
    let started = Instant::now();
    let mut tried = false;
    loop {
        let views = status_of(data_root, project_root, specs);
        let downloading = views.iter().any(|view| view.state == "downloading");
        let wanting = views.iter().any(needs_download);
        if !downloading && (!wanting || tried) {
            return;
        }
        if started.elapsed() >= timeout {
            tracing::warn!("runtime assets not ready after {:?}; rendering with what is there", timeout);
            return;
        }
        if wanting && !downloading && !tried {
            tried = true;
            let remaining = timeout.saturating_sub(started.elapsed());
            match tokio::time::timeout(remaining, ensure_specs(data_root, project_root, specs, registries)).await {
                Ok(Ok(true)) => continue,
                Ok(Ok(false)) => {}
                Ok(Err(error)) => {
                    tracing::warn!("runtime assets ensure failed: {error:#}");
                    return;
                }
                Err(_) => return,
            }
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

/// 后端启动时在后台把缺的资源下好（首次启动）。
pub fn spawn_runtime_assets_prefetch(data_root: PathBuf, project_root: Option<PathBuf>) {
    if !downloads_enabled() {
        return;
    }
    tokio::spawn(async move {
        if let Err(error) = ensure_runtime_assets(&data_root, project_root.as_deref()).await {
            tracing::warn!("runtime assets prefetch failed: {error:#}");
        }
    });
}

#[cfg(test)]
mod tests;
