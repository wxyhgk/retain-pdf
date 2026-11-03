use std::collections::HashSet;
use std::path::{Path, PathBuf};

use anyhow::Result;

mod accounts;
mod auth;
mod cleanup;
mod db;
pub mod env_vars;
mod job_runner;
mod jobs_service;
pub mod limits;
mod origin_policy;
mod paths;
mod provider;
pub mod provider_config;
mod server;
mod upload;

pub use accounts::{AccountsConfig, DeploymentMode, PlatformModels, LOCAL_USERNAME, LOCAL_USER_ID};
use auth::AuthRuntimeConfig;
pub use auth::api_key_matches;
pub use cleanup::CleanupConfig;
pub use db::DbConfig;
pub use job_runner::{JobRunnerConfig, DEFAULT_WORKER_MAX_RUNTIME_SECS, JOB_WORKER_THREAD_STACK_BYTES};
pub use jobs_service::{JobsRuntimeMode, JobsServiceConfig};
pub use origin_policy::{bind_host_is_loopback, OriginPolicyConfig};
use paths::{create_runtime_dirs, RuntimePathsConfig};
pub use provider::{
    DeepSeekRuntimeConfig, MineruRuntimeConfig, PaddleRuntimeConfig, ProviderLimitsConfig,
    ProviderRuntimeConfig,
};
use server::ServerRuntimeConfig;
pub use upload::{
    effective_upload_max_bytes, UploadProcessingConfig, UploadRuntimeConfig,
    DEFAULT_UPLOAD_MAX_BYTES,
};

// RUST_API_PYTHON_ENTRYPOINT_MODE 已退役。兼容旧版桌面注入的值，
// 只告警、不切换入口；主阶段固定使用 Python 模块，辅助任务使用 console。
fn warn_ignored_python_entrypoint_mode_env() {
    let configured = env_vars::env_optional_string("RUST_API_PYTHON_ENTRYPOINT_MODE");
    if configured
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
    {
        eprintln!(
            "warning: RUST_API_PYTHON_ENTRYPOINT_MODE is deprecated and ignored; \
             stage workers use Python module entrypoints"
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
    /// 收到停机信号以后最多等还没结束的请求（进度流这类长连接）多少秒，到点就断开（`RUST_API_SHUTDOWN_GRACE_SECS`）。
    pub shutdown_grace_secs: u64,
    pub upload_max_bytes: u64,
    pub upload_max_pages: u32,
    /// 数据目录所在磁盘至少留多少空间（字节）才接新上传、新任务；0 是不查（`RUST_API_MIN_FREE_DISK_MB`）。
    pub min_free_disk_bytes: u64,
    pub upload_processing: UploadProcessingConfig,
    pub api_keys: HashSet<String>,
    pub max_running_jobs: usize,
    pub provider_limits: ProviderLimitsConfig,
    pub provider_runtime: ProviderRuntimeConfig,
    pub job_runner: JobRunnerConfig,
    pub jobs_service: JobsServiceConfig,
    pub cleanup: CleanupConfig,
    pub db: DbConfig,
    pub accounts: AccountsConfig,
    /// 单机模式放行哪些网页来源、哪些 `Host`（`RUST_API_ALLOWED_ORIGINS`、`RUST_API_ALLOWED_HOSTS`）。
    pub origin_policy: OriginPolicyConfig,
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
    pub worker_output_drain_secs: u64,
    pub worker_max_runtime_secs: u64,
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
}

impl AppConfig {
    /// 后端是不是只监听回环地址（决定要不要默认校验 `Host`）。
    pub fn listens_on_loopback(&self) -> bool {
        bind_host_is_loopback(&self.bind_host)
    }

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
            worker_output_drain_secs: self.job_runner.worker_output_drain_secs,
            worker_max_runtime_secs: self.job_runner.worker_max_runtime_secs,
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

    /// 读环境变量组装配置。设了但解析不了的变量（`RUST_API_PORT=abc`、`RUST_API_UPLOAD_MAX_BYTES=200MB`、
    /// 拼错的开关）一个个列出来，返回错误、不启动——不再悄悄换成默认值。
    pub fn from_env() -> Result<Self> {
        reject_invalid_env(env_vars::collect_invalid_env(Self::from_env_unchecked))
    }

    fn from_env_unchecked() -> Result<Self> {
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
        reject_invalid_env(env_vars::collect_invalid_env(|| {
            Self::from_desktop_unchecked(resource_root, data_root, python_bin, port, simple_port, api_key)
        }))
    }

    fn from_desktop_unchecked(
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
        } = parts;

        auth.validate_bind_host(&server.bind_host)?;
        if let Some(warning) = auth.placeholder_key_warning(&server.bind_host) {
            eprintln!("{warning}");
        }
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
            shutdown_grace_secs: server.shutdown_grace_secs,
            simple_port: auth.simple_port,
            upload_max_bytes: upload.upload_max_bytes,
            upload_max_pages: upload.upload_max_pages,
            min_free_disk_bytes: upload.min_free_disk_bytes,
            // Processing overrides also apply to desktop; snapshot once at startup.
            upload_processing: UploadProcessingConfig::from_env(),
            api_keys: auth.api_keys,
            max_running_jobs: auth.max_running_jobs,
            provider_limits,
            provider_runtime,
            job_runner,
            jobs_service,
            cleanup: CleanupConfig::from_env(),
            db: DbConfig::from_env(),
            accounts: AccountsConfig::from_env()?,
            origin_policy: OriginPolicyConfig::from_env(),
        })
    }
}

/// 有解析不了的环境变量就报错，先于配置本身的错误：后者常常就是前者引起的。
fn reject_invalid_env(
    (config, invalid): (Result<AppConfig>, Vec<env_vars::InvalidEnvVar>),
) -> Result<AppConfig> {
    if invalid.is_empty() {
        return config;
    }
    let lines = invalid
        .iter()
        .map(|item| format!("  {item}"))
        .collect::<Vec<_>>()
        .join("\n");
    anyhow::bail!("这些环境变量的值解析不了，没有启动：\n{lines}\n改对或者删掉再启动。")
}

#[cfg(test)]
mod invalid_env_tests {
    use super::*;

    fn desktop_config(root: &Path) -> Result<AppConfig> {
        AppConfig::from_desktop(
            root.join("resources"),
            root.join("data"),
            "python3".into(),
            0,
            1,
            "invalid-env-test-key".into(),
        )
    }

    #[test]
    fn startup_refuses_values_it_cannot_parse() {
        let _g = env_vars::env_test_lock();
        let root = std::env::temp_dir().join(format!("retainpdf-invalid-env-{}", std::process::id()));
        std::env::set_var("RUST_API_SHUTDOWN_GRACE_SECS", "3s");
        std::env::set_var("RUST_API_JOBS_MODE", "remtoe");
        let refused = desktop_config(&root);
        std::env::remove_var("RUST_API_SHUTDOWN_GRACE_SECS");
        std::env::remove_var("RUST_API_JOBS_MODE");
        let message = format!("{:#}", refused.err().expect("bad values must stop startup"));
        assert!(message.contains("RUST_API_SHUTDOWN_GRACE_SECS=\"3s\""), "{message}");
        assert!(message.contains("RUST_API_JOBS_MODE=\"remtoe\""), "{message}");

        let config = desktop_config(&root).expect("without the bad values it starts");
        assert_eq!(config.shutdown_grace_secs, server::DEFAULT_SHUTDOWN_GRACE_SECS);
        let _ = std::fs::remove_dir_all(&root);
    }
}

