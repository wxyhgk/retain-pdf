//! 同步接口的应用门面(路由只经这里)。

use std::sync::Arc;

use crate::error::AppError;
use crate::models::api::{SyncSettingsInput, SyncStatusView, SyncTestView};

use super::SyncService;

pub struct SyncApiDeps {
    pub(crate) service: Arc<SyncService>,
}

impl SyncApiDeps {
    pub fn new(service: Arc<SyncService>) -> Self {
        Self { service }
    }
}

pub fn sync_status_view(deps: &SyncApiDeps) -> Result<SyncStatusView, AppError> {
    Ok(deps.service.status()?)
}

pub fn update_sync_settings_view(
    deps: &SyncApiDeps,
    input: &SyncSettingsInput,
) -> Result<SyncStatusView, AppError> {
    deps.service
        .update(input)?
        .map_err(|reason| AppError::bad_request(reason.0))?;
    Ok(deps.service.status()?)
}

/// 立即跑一轮并等它跑完。
pub async fn run_sync_now_view(deps: &SyncApiDeps) -> Result<SyncStatusView, AppError> {
    if deps.service.run_once().await?.is_none() {
        return Err(AppError::conflict("同步没有开启"));
    }
    Ok(deps.service.status()?)
}

/// 用填的设置测一次能不能读写(不保存)。
pub async fn test_sync_target_view(
    deps: &SyncApiDeps,
    input: &SyncSettingsInput,
) -> Result<SyncTestView, AppError> {
    Ok(deps.service.test(input).await?)
}
