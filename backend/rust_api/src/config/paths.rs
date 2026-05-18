use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

use super::env_vars::env_path;

#[derive(Clone, Debug)]
pub struct RuntimePathsConfig {
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
    pub auth_config_path: PathBuf,
}

impl RuntimePathsConfig {
    pub fn from_env() -> Result<Self> {
        let default_rust_api_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let rust_api_root = env_path("RUST_API_ROOT").unwrap_or(default_rust_api_root);
        let default_project_root = infer_project_root(&rust_api_root)?;
        let project_root = env_path("RUST_API_PROJECT_ROOT").unwrap_or(default_project_root);
        let scripts_dir =
            env_path("RUST_API_SCRIPTS_DIR").unwrap_or_else(|| default_scripts_dir(&project_root));
        Self::from_roots(project_root, rust_api_root, scripts_dir)
    }

    pub fn from_desktop(resource_root: PathBuf, data_root: PathBuf) -> Self {
        let scripts_dir = resource_root.join("scripts");
        Self::from_roots_unchecked(
            resource_root,
            data_root.join("rust_api"),
            data_root,
            scripts_dir,
        )
    }

    fn from_roots(
        project_root: PathBuf,
        rust_api_root: PathBuf,
        scripts_dir: PathBuf,
    ) -> Result<Self> {
        let data_root = resolve_data_root(&project_root);
        Ok(Self::from_roots_unchecked(
            project_root,
            rust_api_root,
            data_root,
            scripts_dir,
        ))
    }

    fn from_roots_unchecked(
        project_root: PathBuf,
        rust_api_root: PathBuf,
        data_root: PathBuf,
        scripts_dir: PathBuf,
    ) -> Self {
        let uploads_dir = data_root.join("uploads");
        let downloads_dir = data_root.join("downloads");
        let jobs_db_path = data_root.join("db").join("jobs.db");
        let output_root = data_root.join("jobs");
        let auth_config_path = rust_api_root.join("auth.local.json");

        Self {
            project_root,
            rust_api_root,
            data_root,
            scripts_dir: scripts_dir.clone(),
            run_provider_case_script: resolve_entrypoint_script(
                &scripts_dir,
                "run_provider_case.py",
            ),
            run_provider_ocr_script: resolve_entrypoint_script(&scripts_dir, "run_provider_ocr.py"),
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
            auth_config_path,
        }
    }
}

pub fn create_runtime_dirs(paths: &RuntimePathsConfig) -> Result<()> {
    std::fs::create_dir_all(&paths.data_root)?;
    std::fs::create_dir_all(&paths.uploads_dir)?;
    std::fs::create_dir_all(&paths.downloads_dir)?;
    std::fs::create_dir_all(&paths.output_root)?;
    if let Some(parent) = paths.jobs_db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    Ok(())
}

fn resolve_entrypoint_script(scripts_dir: &Path, script_name: &str) -> PathBuf {
    let entrypoints_dir = scripts_dir.join("entrypoints");
    entrypoints_dir.join(script_name)
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

fn default_scripts_dir(project_root: &Path) -> PathBuf {
    let backend_scripts = project_root.join("backend").join("scripts");
    if backend_scripts.exists() {
        backend_scripts
    } else {
        project_root.join("scripts")
    }
}

fn resolve_data_root(project_root: &Path) -> PathBuf {
    env_path("RUST_API_DATA_ROOT")
        .or_else(|| env_path("RUST_API_DATA_DIR"))
        .unwrap_or_else(|| project_root.join("data"))
}
