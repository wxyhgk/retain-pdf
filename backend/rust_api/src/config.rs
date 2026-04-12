use std::collections::HashSet;
use std::env;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use serde::Deserialize;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub project_root: PathBuf,
    pub rust_api_root: PathBuf,
    pub data_root: PathBuf,
    pub scripts_dir: PathBuf,
    pub run_mineru_case_script: PathBuf,
    pub run_ocr_job_script: PathBuf,
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
}

#[derive(Debug, Deserialize)]
struct LocalAuthConfig {
    #[serde(default)]
    api_keys: Vec<String>,
    max_running_jobs: Option<usize>,
    simple_port: Option<u16>,
}

impl AppConfig {
    pub fn from_env() -> Result<Self> {
        let default_rust_api_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let rust_api_root = env::var("RUST_API_ROOT")
            .map(PathBuf::from)
            .unwrap_or(default_rust_api_root);
        let default_project_root = infer_project_root(&rust_api_root)?;
        let project_root = env::var("RUST_API_PROJECT_ROOT")
            .map(PathBuf::from)
            .unwrap_or(default_project_root);
        let scripts_dir = env::var("RUST_API_SCRIPTS_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                let backend_scripts = project_root.join("backend").join("scripts");
                if backend_scripts.exists() {
                    backend_scripts
                } else {
                    project_root.join("scripts")
                }
            });
        let data_root = resolve_data_root(&project_root);
        let run_mineru_case_script = scripts_dir.join("entrypoints").join("run_mineru_case.py");
        let run_ocr_job_script = scripts_dir.join("entrypoints").join("run_ocr_job.py");
        let run_normalize_ocr_script = scripts_dir.join("entrypoints").join("run_normalize_ocr.py");
        let run_translate_from_ocr_script = scripts_dir
            .join("entrypoints")
            .join("run_translate_from_ocr.py");
        let run_translate_only_script = scripts_dir
            .join("entrypoints")
            .join("run_translate_only.py");
        let run_render_only_script = scripts_dir.join("entrypoints").join("run_render_only.py");
        let run_failure_ai_diagnosis_script = scripts_dir
            .join("entrypoints")
            .join("diagnose_failure_with_ai.py");
        let uploads_dir = data_root.join("uploads");
        let downloads_dir = data_root.join("downloads");
        let jobs_db_path = data_root.join("db").join("jobs.db");
        let output_root = data_root.join("jobs");
        let auth_config_path = rust_api_root.join("auth.local.json");

        create_runtime_dirs(
            &data_root,
            &uploads_dir,
            &downloads_dir,
            &jobs_db_path,
            &output_root,
        )?;

        let local_auth = load_local_auth_config(&auth_config_path)?;
        let api_keys = resolve_api_keys(local_auth.as_ref())?;
        let max_running_jobs = resolve_max_running_jobs(local_auth.as_ref());

        Ok(Self {
            project_root,
            rust_api_root,
            data_root,
            scripts_dir,
            run_mineru_case_script,
            run_ocr_job_script,
            run_normalize_ocr_script,
            run_translate_from_ocr_script,
            run_translate_only_script,
            run_render_only_script,
            run_failure_ai_diagnosis_script,
            uploads_dir,
            downloads_dir,
            jobs_db_path,
            output_root,
            python_bin: env::var("PYTHON_BIN").unwrap_or_else(|_| "python".to_string()),
            bind_host: env::var("RUST_API_BIND_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("RUST_API_PORT")
                .ok()
                .and_then(|v| v.parse::<u16>().ok())
                .unwrap_or(41000),
            simple_port: resolve_simple_port(local_auth.as_ref()),
            upload_max_bytes: env::var("RUST_API_UPLOAD_MAX_BYTES")
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(0),
            upload_max_pages: env::var("RUST_API_UPLOAD_MAX_PAGES")
                .ok()
                .and_then(|v| v.parse::<u32>().ok())
                .unwrap_or(0),
            api_keys,
            max_running_jobs,
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
        let rust_api_root = data_root.join("rust_api");
        let uploads_dir = data_root.join("uploads");
        let downloads_dir = data_root.join("downloads");
        let output_root = data_root.join("jobs");
        let jobs_db_path = data_root.join("db").join("jobs.db");
        let scripts_dir = resource_root.join("scripts");

        create_runtime_dirs(
            &data_root,
            &uploads_dir,
            &downloads_dir,
            &jobs_db_path,
            &output_root,
        )?;

        Ok(Self {
            project_root: resource_root.clone(),
            rust_api_root,
            data_root,
            scripts_dir: scripts_dir.clone(),
            run_mineru_case_script: scripts_dir.join("entrypoints").join("run_mineru_case.py"),
            run_ocr_job_script: scripts_dir.join("entrypoints").join("run_ocr_job.py"),
            run_normalize_ocr_script: scripts_dir.join("entrypoints").join("run_normalize_ocr.py"),
            run_translate_from_ocr_script: scripts_dir
                .join("entrypoints")
                .join("run_translate_from_ocr.py"),
            run_translate_only_script: scripts_dir
                .join("entrypoints")
                .join("run_translate_only.py"),
            run_render_only_script: scripts_dir.join("entrypoints").join("run_render_only.py"),
            run_failure_ai_diagnosis_script: scripts_dir
                .join("entrypoints")
                .join("diagnose_failure_with_ai.py"),
            uploads_dir,
            downloads_dir,
            jobs_db_path,
            output_root,
            python_bin,
            bind_host: "127.0.0.1".to_string(),
            port,
            simple_port,
            upload_max_bytes: 0,
            upload_max_pages: 0,
            api_keys: [api_key].into_iter().collect(),
            max_running_jobs: 4,
        })
    }
}

fn infer_project_root(rust_api_root: &Path) -> Result<PathBuf> {
    let parent = rust_api_root
        .parent()
        .context("rust_api must live under the repository root or backend/")?;
    if parent.file_name().and_then(|v| v.to_str()) == Some("backend") {
        return parent
            .parent()
            .context("backend must live directly under repository root")
            .map(Path::to_path_buf);
    }
    Ok(parent.to_path_buf())
}

fn resolve_data_root(project_root: &Path) -> PathBuf {
    env::var("RUST_API_DATA_ROOT")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            env::var("RUST_API_DATA_DIR")
                .ok()
                .filter(|value| !value.trim().is_empty())
                .map(PathBuf::from)
        })
        .unwrap_or_else(|| project_root.join("data"))
}

fn create_runtime_dirs(
    data_root: &Path,
    uploads_dir: &Path,
    downloads_dir: &Path,
    jobs_db_path: &Path,
    output_root: &Path,
) -> Result<()> {
    std::fs::create_dir_all(data_root)?;
    std::fs::create_dir_all(uploads_dir)?;
    std::fs::create_dir_all(downloads_dir)?;
    std::fs::create_dir_all(output_root)?;
    if let Some(parent) = jobs_db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    Ok(())
}

fn load_local_auth_config(path: &PathBuf) -> Result<Option<LocalAuthConfig>> {
    if !path.exists() {
        return Ok(None);
    }
    let text = std::fs::read_to_string(path)
        .with_context(|| format!("failed to read {}", path.display()))?;
    let config: LocalAuthConfig = serde_json::from_str(&text)
        .with_context(|| format!("failed to parse {}", path.display()))?;
    Ok(Some(config))
}

fn resolve_api_keys(local_auth: Option<&LocalAuthConfig>) -> Result<HashSet<String>> {
    if let Some(local_auth) = local_auth {
        let keys: HashSet<String> = local_auth
            .api_keys
            .iter()
            .map(String::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .collect();
        if !keys.is_empty() {
            return Ok(keys);
        }
    }

    let raw = env::var("RUST_API_KEYS").context(
        "auth.local.json or RUST_API_KEYS is required and must contain at least one API key",
    )?;
    let keys: HashSet<String> = raw
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect();
    if keys.is_empty() {
        bail!("auth.local.json or RUST_API_KEYS is required and must contain at least one API key");
    }
    Ok(keys)
}

fn resolve_max_running_jobs(local_auth: Option<&LocalAuthConfig>) -> usize {
    if let Some(value) = local_auth
        .and_then(|cfg| cfg.max_running_jobs)
        .filter(|value| *value > 0)
    {
        return value;
    }
    env::var("RUST_API_MAX_RUNNING_JOBS")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(4)
}

fn resolve_simple_port(local_auth: Option<&LocalAuthConfig>) -> u16 {
    if let Some(value) = local_auth.and_then(|cfg| cfg.simple_port) {
        return value;
    }
    env::var("RUST_API_SIMPLE_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(42000)
}
