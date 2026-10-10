//! 测试用 `AppConfig` 与目录布局。
//!
//! 以前 api_tests、app/state、glossaries、jobs/creation 各手写一遍临时目录和
//! 二十多个配置字段，`AppConfig` 每加一个字段就得同步改四处。这里只留一份，
//! 各测试真正在意的差异（python_bin、api_keys、并发上限……）由调用方用 `..`
//! 显式覆盖，差异一眼可见。

use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

use crate::config::AppConfig;

/// 一棵与生产布局一致的临时目录树（data/jobs、data/uploads、data/downloads……）。
///
/// 故意不实现 `Drop`：很多测试只把 `AppState` 带走，目录得活过这个结构体。
/// 需要清理的测试自己包一层（见 app/state 的测试）。
pub(crate) struct TestDirs {
    pub(crate) root: PathBuf,
    pub(crate) data_root: PathBuf,
    pub(crate) output_root: PathBuf,
    pub(crate) uploads_dir: PathBuf,
    pub(crate) downloads_dir: PathBuf,
    pub(crate) jobs_db_path: PathBuf,
    pub(crate) rust_api_root: PathBuf,
    pub(crate) scripts_dir: PathBuf,
}

impl TestDirs {
    /// 在系统临时目录下建 `<name>`；调用方负责让 `name` 唯一（带随机数或 pid）。
    pub(crate) fn create(name: &str) -> Self {
        let root = std::env::temp_dir().join(name);
        let data_root = root.join("data");
        let dirs = Self {
            output_root: data_root.join("jobs"),
            uploads_dir: data_root.join("uploads"),
            downloads_dir: data_root.join("downloads"),
            jobs_db_path: data_root.join("db").join("jobs.db"),
            rust_api_root: root.join("rust_api"),
            scripts_dir: root.join("scripts"),
            data_root,
            root,
        };
        for dir in [
            &dirs.output_root,
            &dirs.uploads_dir,
            &dirs.downloads_dir,
            &dirs.rust_api_root,
            &dirs.scripts_dir,
        ] {
            fs::create_dir_all(dir).expect("create test dir");
        }
        fs::create_dir_all(dirs.jobs_db_path.parent().expect("db dir")).expect("create db dir");
        dirs
    }

    /// 指向这棵目录树的配置。默认值取自 HTTP 契约测试（带 `test-key`，单并发），
    /// 其余子配置一律 `Default`。
    pub(crate) fn config(&self) -> AppConfig {
        AppConfig {
            project_root: self.root.clone(),
            rust_api_root: self.rust_api_root.clone(),
            data_root: self.data_root.clone(),
            scripts_dir: self.scripts_dir.clone(),
            uploads_dir: self.uploads_dir.clone(),
            downloads_dir: self.downloads_dir.clone(),
            jobs_db_path: self.jobs_db_path.clone(),
            output_root: self.output_root.clone(),
            python_bin: "python3".to_string(),
            pipeline_command: "retainpdf-pipeline".to_string(),
            bind_host: "127.0.0.1".to_string(),
            port: 41000,
            simple_port: 42000,
            upload_max_bytes: 0,
            upload_max_pages: 0,
            upload_processing: Default::default(),
            api_keys: HashSet::from(["test-key".to_string()]),
            max_running_jobs: 1,
            provider_limits: crate::config::ProviderLimitsConfig::default(),
            provider_runtime: crate::config::ProviderRuntimeConfig::default(),
            job_runner: crate::config::JobRunnerConfig::default(),
            ai_service: crate::config::AiServiceConfig::default(),
            jobs_service: crate::config::JobsServiceConfig::default(),
            asset: crate::config::AssetConfig::default(),
            cleanup: crate::config::CleanupConfig::default(),
            db: crate::config::DbConfig::default(),
            ai_proxy: crate::config::AiProxyConfig::default(),
            reader_llm: crate::config::ReaderLlmConfig::default(),
            rag: crate::config::RagConfig::default(),
            accounts: Default::default(),
        }
    }
}
