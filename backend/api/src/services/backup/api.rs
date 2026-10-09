//! 备份接口的应用门面(路由只经这里)。

use std::sync::Arc;

use crate::error::AppError;
use crate::models::api::{BackupItemView, BackupRestoreView, BackupStatusView};

use super::{BackupRefusal, BackupService};

pub struct BackupApiDeps {
    pub(crate) service: Arc<BackupService>,
}

impl BackupApiDeps {
    pub fn new(service: Arc<BackupService>) -> Self {
        Self { service }
    }
}

fn refused(refusal: BackupRefusal) -> AppError {
    match refusal {
        BackupRefusal::NotFound(reason) => AppError::not_found(reason),
        BackupRefusal::Invalid(reason) => AppError::bad_request(reason),
        BackupRefusal::Busy(reason) => AppError::conflict(reason),
    }
}

pub fn backup_status_view(deps: &BackupApiDeps) -> Result<BackupStatusView, AppError> {
    Ok(deps.service.status()?)
}

/// 立即备份一份,等它存完。
pub async fn create_backup_view(deps: &BackupApiDeps) -> Result<BackupItemView, AppError> {
    Ok(deps.service.create_manual().await?)
}

pub async fn restore_backup_view(deps: &BackupApiDeps, id: &str) -> Result<BackupRestoreView, AppError> {
    deps.service.restore(id).await?.map_err(refused)
}

pub async fn delete_backup_view(deps: &BackupApiDeps, id: &str) -> Result<BackupStatusView, AppError> {
    deps.service.delete(id).await?.map_err(refused)?;
    Ok(deps.service.status()?)
}
