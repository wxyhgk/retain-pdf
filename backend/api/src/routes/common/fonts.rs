use crate::app::AppState;
use crate::error::AppError;
use crate::services::platform::FontApiDeps;

/// 字体扫描（`fc-list`、每个文件一次 `fc-query`）是同步起子进程，
/// 放进阻塞线程，不占异步工作线程。返回和错误原样不变。
pub async fn run_fonts_blocking<T: Send + 'static>(
    state: &AppState,
    work: impl for<'a> FnOnce(&FontApiDeps<'a>) -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    let config = state.config.clone();
    tokio::task::spawn_blocking(move || work(&FontApiDeps::new(&config.project_root, &config.data_root)))
        .await
        .map_err(|_| AppError::internal("font task failed"))?
}
