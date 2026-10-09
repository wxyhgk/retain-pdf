use crate::app::AppState;
use crate::services::backup::api::BackupApiDeps;

pub fn build_backup_route_deps(state: &AppState) -> BackupApiDeps {
    BackupApiDeps::new(state.backup.clone())
}
