use std::path::PathBuf;

use crate::app::AppState;
use crate::services::platform::RuntimeAssetsApiDeps;

/// 按需下载资源的接口要的两个目录（项目根、数据目录），拷出来好放进阻塞线程。
pub struct RuntimeAssetsRouteDeps {
    project_root: PathBuf,
    data_root: PathBuf,
}

impl RuntimeAssetsRouteDeps {
    pub fn api(&self) -> RuntimeAssetsApiDeps<'_> {
        RuntimeAssetsApiDeps::new(&self.project_root, &self.data_root)
    }
}

pub fn build_runtime_assets_route_deps(state: &AppState) -> RuntimeAssetsRouteDeps {
    RuntimeAssetsRouteDeps {
        project_root: state.config.project_root.clone(),
        data_root: state.config.data_root.clone(),
    }
}
