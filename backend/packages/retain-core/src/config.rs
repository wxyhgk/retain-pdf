use std::collections::HashSet;
use std::path::{Path, PathBuf};

use anyhow::Result;

mod ai_proxy;
mod ai_service;
mod asset;
mod auth;
mod cleanup;
mod db;
pub mod env_vars;
mod job_runner;
mod jobs_service;
pub mod limits;
mod paths;
mod provider;
pub mod provider_config;
mod rag;
mod reader_llm;
mod server;
mod upload;

pub use ai_proxy::AiProxyConfig;
pub use ai_service::AiServiceConfig;
pub use asset::AssetConfig;
use auth::AuthRuntimeConfig;
pub use cleanup::CleanupConfig;
pub use db::DbConfig;
pub use job_runner::JobRunnerConfig;
pub use jobs_service::{JobsRuntimeMode, JobsServiceConfig};
use paths::{create_runtime_dirs, RuntimePathsConfig};
pub use provider::{
    DeepSeekRuntimeConfig, MineruRuntimeConfig, PaddleRuntimeConfig, ProviderLimitsConfig,
    ProviderRuntimeConfig,
};
pub use rag::RagConfig;
pub use reader_llm::ReaderLlmConfig;
use server::ServerRuntimeConfig;
pub use upload::{
    effective_upload_max_bytes, UploadProcessingConfig, UploadRuntimeConfig,
    DEFAULT_UPLOAD_MAX_BYTES,
};

// console-mode 唯一入口：RUST_API_PYTHON_ENTRYPOINT_MODE 已退役。
// 两阶段退役的第一阶段：读到非空值只 warn 忽略（兼容已部署桌面旧版硬编码
// script），强制走 console，不再 parse/bail。
fn warn_ignored_python_entrypoint_mode_env() {
    let configured = env_vars::env_optional_string("RUST_API_PYTHON_ENTRYPOINT_MODE");
    if configured
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
    {
        eprintln!(
            "warning: RUST_API_PYTHON_ENTRYPOINT_MODE is deprecated and ignored; \
             console mode (retainpdf-pipeline) is always used"
        );
    }
}

pub fn pipeline_command_is_available(command: &str) -> bool {
    let command = command.trim();
    if command.is_empty() {
        return false;
    }
    let command_path = Path::new(command);
    if command_path.components().count() > 1 {
        return is_executable_file(command_path);
    }
    std::env::var_os("PATH")
        .map(|path| {
            std::env::split_paths(&path).any(|directory| {
                let candidate = directory.join(command);
                if is_executable_file(&candidate) {
                    return true;
                }
                #[cfg(windows)]
                {
                    return ["exe", "cmd", "bat"].iter().any(|extension| {
                        is_executable_file(&directory.join(format!("{command}.{extension}")))
                    });
                }
                #[cfg(not(windows))]
                false
            })
        })
        .unwrap_or(false)
}

fn is_executable_file(path: &Path) -> bool {
    let Ok(metadata) = path.metadata() else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    true
}

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub project_root: PathBuf,
    pub rust_api_root: PathBuf,
    pub data_root: PathBuf,
    /// 保留给 debug/replay_translation_item.py（独立 script-mode，保持不动）。
    pub scripts_dir: PathBuf,
    pub uploads_dir: PathBuf,
    pub downloads_dir: PathBuf,
    pub jobs_db_path: PathBuf,
    pub output_root: PathBuf,
    pub python_bin: String,
    pub pipeline_command: String,
    pub bind_host: String,
    pub port: u16,
    pub simple_port: u16,
    pub upload_max_bytes: u64,
    pub upload_max_pages: u32,
    pub upload_processing: UploadProcessingConfig,
    pub api_keys: HashSet<String>,
    pub max_running_jobs: usize,
    pub provider_limits: ProviderLimitsConfig,
    pub provider_runtime: ProviderRuntimeConfig,
    pub job_runner: JobRunnerConfig,
    pub ai_service: AiServiceConfig,
    pub jobs_service: JobsServiceConfig,
    pub asset: AssetConfig,
    pub cleanup: CleanupConfig,
    pub db: DbConfig,
    pub ai_proxy: AiProxyConfig,
    pub reader_llm: ReaderLlmConfig,
    pub rag: RagConfig,
}

#[derive(Clone, Copy, Debug)]
pub struct WorkerCommandRuntimeConfig<'a> {
    pub python_bin: &'a str,
}

#[derive(Clone, Copy, Debug)]
pub struct WorkerProcessRuntimeConfig<'a> {
    pub project_root: &'a Path,
    pub data_root: &'a Path,
    pub output_root: &'a Path,
    pub ocr_provider_config_path: &'a Path,
    pub worker_terminate_grace_secs: u64,
    pub worker_terminate_poll_ms: u64,
}

#[derive(Clone, Copy, Debug)]
pub struct JobSnapshotRuntimeConfig<'a> {
    pub data_root: &'a Path,
    pub output_root: &'a Path,
    pub worker_command: WorkerCommandRuntimeConfig<'a>,
    pub provider_limits: &'a ProviderLimitsConfig,
}

#[derive(Clone, Copy, Debug)]
pub struct FailureAiDiagnosisRuntimeConfig<'a> {
    pub pipeline_command: &'a str,
    pub project_root: &'a Path,
    pub data_root: &'a Path,
    pub output_root: &'a Path,
    pub timeout_secs: u64,
}

struct AppConfigParts {
    paths: RuntimePathsConfig,
    auth: AuthRuntimeConfig,
    server: ServerRuntimeConfig,
    upload: UploadRuntimeConfig,
    provider_limits: ProviderLimitsConfig,
    provider_runtime: ProviderRuntimeConfig,
    job_runner: JobRunnerConfig,
    asset: AssetConfig,
}

impl AppConfig {
    pub fn worker_command_runtime(&self) -> WorkerCommandRuntimeConfig<'_> {
        WorkerCommandRuntimeConfig {
            python_bin: &self.python_bin,
        }
    }

    pub fn worker_process_runtime(&self) -> WorkerProcessRuntimeConfig<'_> {
        WorkerProcessRuntimeConfig {
            project_root: &self.project_root,
            data_root: &self.data_root,
            output_root: &self.output_root,
            ocr_provider_config_path: &self.provider_runtime.ocr_provider_config_path,
            worker_terminate_grace_secs: self.job_runner.worker_terminate_grace_secs,
            worker_terminate_poll_ms: self.job_runner.worker_terminate_poll_ms,
        }
    }

    pub fn job_snapshot_runtime(&self) -> JobSnapshotRuntimeConfig<'_> {
        JobSnapshotRuntimeConfig {
            data_root: &self.data_root,
            output_root: &self.output_root,
            worker_command: self.worker_command_runtime(),
            provider_limits: &self.provider_limits,
        }
    }

    pub fn failure_ai_diagnosis_runtime(&self) -> FailureAiDiagnosisRuntimeConfig<'_> {
        FailureAiDiagnosisRuntimeConfig {
            pipeline_command: &self.pipeline_command,
            project_root: &self.project_root,
            data_root: &self.data_root,
            output_root: &self.output_root,
            timeout_secs: self.job_runner.failure_ai_diagnosis_timeout_secs,
        }
    }

    pub fn from_env() -> Result<Self> {
        let paths = RuntimePathsConfig::from_env()?;
        create_runtime_dirs(&paths)?;
        let auth = AuthRuntimeConfig::from_env_or_file(&paths.auth_config_path)?;

        Self::try_from_parts(AppConfigParts {
            paths,
            auth,
            server: ServerRuntimeConfig::from_env(),
            upload: UploadRuntimeConfig::from_env(),
            provider_limits: ProviderLimitsConfig::from_env(),
            provider_runtime: ProviderRuntimeConfig::from_env(),
            job_runner: JobRunnerConfig::from_env(),
            asset: AssetConfig::from_env(),
        })
    }

    pub fn from_desktop(
        resource_root: PathBuf,
        data_root: PathBuf,
        python_bin: String,
        port: u16,
        simple_port: u16,
        api_key: String,
    ) -> Result<Self> {
        let paths = RuntimePathsConfig::from_desktop(resource_root, data_root);
        create_runtime_dirs(&paths)?;
        let auth = AuthRuntimeConfig::from_desktop(simple_port, api_key, 4);

        Self::try_from_parts(AppConfigParts {
            paths,
            auth,
            server: ServerRuntimeConfig::from_desktop(python_bin, port),
            upload: UploadRuntimeConfig::desktop_defaults(),
            provider_limits: ProviderLimitsConfig::from_env(),
            provider_runtime: ProviderRuntimeConfig::from_env(),
            job_runner: JobRunnerConfig::from_env(),
            asset: AssetConfig::from_env(),
        })
    }

    fn try_from_parts(parts: AppConfigParts) -> Result<Self> {
        let AppConfigParts {
            paths,
            auth,
            server,
            upload,
            provider_limits,
            provider_runtime,
            job_runner,
            asset,
        } = parts;

        let ai_service = AiServiceConfig::from_env(&paths.project_root, &server.python_bin);
        let jobs_service = JobsServiceConfig::from_env();
        let pipeline_command = env_vars::env_optional_string("RUST_API_PIPELINE_COMMAND")
            .unwrap_or_else(|| "retainpdf-pipeline".to_string());
        warn_ignored_python_entrypoint_mode_env();
        Ok(Self {
            project_root: paths.project_root,
            rust_api_root: paths.rust_api_root,
            data_root: paths.data_root,
            scripts_dir: paths.scripts_dir,
            uploads_dir: paths.uploads_dir,
            downloads_dir: paths.downloads_dir,
            jobs_db_path: paths.jobs_db_path,
            output_root: paths.output_root,
            python_bin: server.python_bin,
            pipeline_command,
            bind_host: server.bind_host,
            port: server.port,
            simple_port: auth.simple_port,
            upload_max_bytes: upload.upload_max_bytes,
            upload_max_pages: upload.upload_max_pages,
            // Processing overrides also apply to desktop; snapshot once at startup.
            upload_processing: UploadProcessingConfig::from_env(),
            api_keys: auth.api_keys,
            max_running_jobs: auth.max_running_jobs,
            provider_limits,
            provider_runtime,
            job_runner,
            ai_service,
            jobs_service,
            asset,
            cleanup: CleanupConfig::from_env(),
            db: DbConfig::from_env(),
            ai_proxy: AiProxyConfig::from_env(),
            reader_llm: ReaderLlmConfig::from_env(),
            rag: RagConfig::from_env(),
        })
    }
}
