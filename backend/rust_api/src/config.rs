use std::collections::HashSet;
use std::path::{Path, PathBuf};

use anyhow::Result;

mod auth;
mod env_vars;
mod job_runner;
mod paths;
mod provider;
mod server;
mod upload;

use auth::AuthRuntimeConfig;
pub use job_runner::JobRunnerConfig;
use paths::{create_runtime_dirs, RuntimePathsConfig};
pub use provider::{
    DeepSeekRuntimeConfig, MineruRuntimeConfig, PaddleRuntimeConfig, ProviderLimitsConfig,
    ProviderRuntimeConfig,
};
use server::ServerRuntimeConfig;
use upload::UploadRuntimeConfig;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub project_root: PathBuf,
    pub rust_api_root: PathBuf,
    pub data_root: PathBuf,
    pub scripts_dir: PathBuf,
    pub run_provider_case_script: PathBuf,
    pub run_provider_ocr_script: PathBuf,
    pub run_normalize_ocr_script: PathBuf,
    pub run_translate_from_ocr_script: PathBuf,
    pub run_translate_only_script: PathBuf,
    pub run_render_only_script: PathBuf,
    pub run_failure_ai_diagnosis_script: PathBuf,
    pub uploads_dir: PathBuf,
    pub downloads_dir: PathBuf,
    pub jobs_db_path: PathBuf,
    pub output_root: PathBuf,
    pub python_bin: String,
    pub bind_host: String,
    pub port: u16,
    pub simple_port: u16,
    pub upload_max_bytes: u64,
    pub upload_max_pages: u32,
    pub api_keys: HashSet<String>,
    pub max_running_jobs: usize,
    pub provider_limits: ProviderLimitsConfig,
    pub provider_runtime: ProviderRuntimeConfig,
    pub job_runner: JobRunnerConfig,
}

#[derive(Clone, Copy, Debug)]
pub struct WorkerCommandRuntimeConfig<'a> {
    pub python_bin: &'a str,
    pub run_provider_case_script: &'a Path,
    pub run_provider_ocr_script: &'a Path,
    pub run_normalize_ocr_script: &'a Path,
    pub run_translate_only_script: &'a Path,
    pub run_render_only_script: &'a Path,
}

#[derive(Clone, Copy, Debug)]
pub struct WorkerProcessRuntimeConfig<'a> {
    pub project_root: &'a Path,
    pub data_root: &'a Path,
    pub output_root: &'a Path,
    pub worker_terminate_grace_secs: u64,
    pub worker_terminate_poll_ms: u64,
}

#[derive(Clone, Copy, Debug)]
pub struct JobSnapshotRuntimeConfig<'a> {
    pub output_root: &'a Path,
    pub worker_command: WorkerCommandRuntimeConfig<'a>,
    pub provider_limits: &'a ProviderLimitsConfig,
}

#[derive(Clone, Copy, Debug)]
pub struct FailureAiDiagnosisRuntimeConfig<'a> {
    pub python_bin: &'a str,
    pub script_path: &'a Path,
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
    pub fn worker_command_runtime(&self) -> WorkerCommandRuntimeConfig<'_> {
        WorkerCommandRuntimeConfig {
            python_bin: &self.python_bin,
            run_provider_case_script: &self.run_provider_case_script,
            run_provider_ocr_script: &self.run_provider_ocr_script,
            run_normalize_ocr_script: &self.run_normalize_ocr_script,
            run_translate_only_script: &self.run_translate_only_script,
            run_render_only_script: &self.run_render_only_script,
        }
    }

    pub fn worker_process_runtime(&self) -> WorkerProcessRuntimeConfig<'_> {
        WorkerProcessRuntimeConfig {
            project_root: &self.project_root,
            data_root: &self.data_root,
            output_root: &self.output_root,
            worker_terminate_grace_secs: self.job_runner.worker_terminate_grace_secs,
            worker_terminate_poll_ms: self.job_runner.worker_terminate_poll_ms,
        }
    }

    pub fn job_snapshot_runtime(&self) -> JobSnapshotRuntimeConfig<'_> {
        JobSnapshotRuntimeConfig {
            output_root: &self.output_root,
            worker_command: self.worker_command_runtime(),
            provider_limits: &self.provider_limits,
        }
    }

    pub fn failure_ai_diagnosis_runtime(&self) -> FailureAiDiagnosisRuntimeConfig<'_> {
        FailureAiDiagnosisRuntimeConfig {
            python_bin: &self.python_bin,
            script_path: &self.run_failure_ai_diagnosis_script,
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
            upload: UploadRuntimeConfig::unlimited(),
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

        Ok(Self {
            project_root: paths.project_root,
            rust_api_root: paths.rust_api_root,
            data_root: paths.data_root,
            scripts_dir: paths.scripts_dir,
            run_provider_case_script: paths.run_provider_case_script,
            run_provider_ocr_script: paths.run_provider_ocr_script,
            run_normalize_ocr_script: paths.run_normalize_ocr_script,
            run_translate_from_ocr_script: paths.run_translate_from_ocr_script,
            run_translate_only_script: paths.run_translate_only_script,
            run_render_only_script: paths.run_render_only_script,
            run_failure_ai_diagnosis_script: paths.run_failure_ai_diagnosis_script,
            uploads_dir: paths.uploads_dir,
            downloads_dir: paths.downloads_dir,
            jobs_db_path: paths.jobs_db_path,
            output_root: paths.output_root,
            python_bin: server.python_bin,
            bind_host: server.bind_host,
            port: server.port,
            simple_port: auth.simple_port,
            upload_max_bytes: upload.upload_max_bytes,
            upload_max_pages: upload.upload_max_pages,
            api_keys: auth.api_keys,
            max_running_jobs: auth.max_running_jobs,
            provider_limits,
            provider_runtime,
            job_runner,
        })
    }
}
