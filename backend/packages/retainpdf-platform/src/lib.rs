//! 平台领域（从 retainpdf-api 拆出来的第二个领域包，2026-10-16）：多设备同步（`sync`）、
//! 数据库备份（`backup`）、字体（`fonts`）、按需下载的字体和 Typst（`runtime_assets`）、健康检查（`health_api`）、
//! 应用版本和提交号（`version`）。
//!
//! 这个文件就是门面：子模块私有，外面只能用下面导出的东西。retainpdf-api 里以
//! `crate::services::platform` 接上（`services/mod.rs`）。AI 服务、jobsd 的监督器在 retainpdf-api 的
//! `runtime` 里，健康检查要的状态由调用方读好了传进 `HealthApiDeps`。

mod backup;
mod detached;
mod fonts;
mod health_api;
mod runtime_assets;
mod sync;
mod version;

// 门面。
pub use backup::{AfterRestoreHook, BackupService};
pub use backup::views::{BackupItemView, BackupRestoreView, BackupStatusView, LastRestoreView};
pub use backup::api::{
    backup_status_view, create_backup_view, delete_backup_view, restore_backup_view, BackupApiDeps,
};
pub use fonts::api::{list_fonts, upload_font, FontApiDeps, FontInfo};
pub use runtime_assets::{
    runtime_assets_view, spawn_runtime_assets_prefetch, start_runtime_assets_download, RuntimeAssetView,
    RuntimeAssetsApiDeps, RuntimeAssetsView,
};
pub use health_api::{
    build_current_readiness_view, build_health_view, HealthApiDeps, HealthView, ReadinessView,
};
pub use version::{app_build, app_version, UNKNOWN_VERSION};
pub use sync::SyncService;
pub use sync::api::{
    run_sync_now_view, sync_status_view, test_sync_target_view, update_sync_settings_view,
    SyncApiDeps,
};
pub use health_api::build_readiness_view;
