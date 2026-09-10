use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

use super::env_vars::env_path;

// console-mode 唯一入口：worker 脚本路径已删除，仅保留 replay 调试脚本所需的 scripts_dir。

#[derive(Clone, Debug)]
pub struct RuntimePathsConfig {
    pub project_root: PathBuf,
    pub rust_api_root: PathBuf,
    pub data_root: PathBuf,
    /// 保留给 debug/replay_translation_item.py（独立 script-mode，保持不动）。
    pub scripts_dir: PathBuf,
    pub uploads_dir: PathBuf,
    pub downloads_dir: PathBuf,
    pub jobs_db_path: PathBuf,
    pub output_root: PathBuf,
    pub auth_config_path: PathBuf,
}

impl RuntimePathsConfig {
    pub fn from_env() -> Result<Self> {
        // retain-core lives in backend/packages; API-local configuration stays in backend/api.
        let core_manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let default_rust_api_root = core_manifest_dir
            .ancestors()
            .nth(2)
            .map(|backend| backend.join("api"))
            .unwrap_or(core_manifest_dir);
        let rust_api_root = env_path("RUST_API_ROOT").unwrap_or(default_rust_api_root);
        let default_project_root = infer_project_root(&rust_api_root)?;
        let project_root = env_path("RUST_API_PROJECT_ROOT").unwrap_or(default_project_root);
        let scripts_dir =
            env_path("RUST_API_SCRIPTS_DIR").unwrap_or_else(|| default_scripts_dir(&project_root));
        Self::from_roots(project_root, rust_api_root, scripts_dir)
    }

    pub fn from_desktop(resource_root: PathBuf, data_root: PathBuf) -> Self {
        let scripts_dir = resource_root.join("pipeline");
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
        // Relative env paths (e.g. RUST_API_DATA_ROOT=../../data) must be
        // absolutized against the process cwd. Otherwise uploads_dir becomes
        // "../../data/uploads/..." and DB storage rejects parent-relative paths.
        let project_root = absolutize_path(&project_root);
        let rust_api_root = absolutize_path(&rust_api_root);
        let scripts_dir = absolutize_path(&scripts_dir);
        let data_root = absolutize_path(&resolve_data_root(&project_root));
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
            scripts_dir,
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

fn infer_project_root(rust_api_root: &Path) -> Result<PathBuf> {
    let parent = rust_api_root
        .parent()
        .context("rust_api must live under the repository root or backend/")?;
    if matches!(
        parent.file_name().and_then(|v| v.to_str()),
        Some("backend" | "services")
    ) {
        return parent
            .parent()
            .context("backend must live directly under repository root")
            .map(Path::to_path_buf);
    }
    // apps/services 扁平结构：rust_api 位于 backend/api，取其祖父目录即 repo root
    if parent.file_name().and_then(|v| v.to_str()) == Some("api") {
        if let Some(services) = parent.parent() {
            if services.file_name().and_then(|v| v.to_str()) == Some("services") {
                return services
                    .parent()
                    .context("services must live directly under repository root")
                    .map(Path::to_path_buf);
            }
        }
    }
    Ok(parent.to_path_buf())
}

fn default_scripts_dir(project_root: &Path) -> PathBuf {
    // Product monorepo layout.
    let services_pipeline = project_root.join("backend").join("pipeline");
    if services_pipeline.exists() {
        return services_pipeline;
    }
    project_root.join("pipeline")
}

fn resolve_data_root(project_root: &Path) -> PathBuf {
    env_path("RUST_API_DATA_ROOT")
        .or_else(|| env_path("RUST_API_DATA_DIR"))
        .unwrap_or_else(|| project_root.join("data"))
}

/// Resolve a possibly-relative path to an absolute path.
///
/// Prefer `canonicalize` when the path already exists so `..` segments collapse.
/// Fall back to `cwd.join(path)` without requiring the target to exist yet
/// (e.g. a brand-new data root on first boot).
fn absolutize_path(path: &Path) -> PathBuf {
    if let Ok(canonical) = path.canonicalize() {
        return canonical;
    }
    if path.is_absolute() {
        return path.to_path_buf();
    }
    match std::env::current_dir() {
        Ok(cwd) => {
            let joined = cwd.join(path);
            joined.canonicalize().unwrap_or(joined)
        }
        Err(_) => path.to_path_buf(),
    }
}

#[cfg(test)]
mod layout_tests {
    use super::*;

    #[test]
    fn auth_path_uses_selected_api_root_even_when_only_legacy_file_exists() {
        let root = std::env::temp_dir().join(format!("retain-auth-path-{}", fastrand::u64(..)));
        std::fs::create_dir_all(root.join("services/api")).unwrap();
        std::fs::write(root.join("services/api/auth.local.json"), "{}").unwrap();
        for api in [root.join("backend/api"), root.join("custom-api")] {
            let config = RuntimePathsConfig::from_roots_unchecked(
                root.clone(), api.clone(), root.join("data"), root.join("backend/pipeline"),
            );
            assert_eq!(config.auth_config_path, api.join("auth.local.json"));
        }
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn source_layout_resolves_repository_not_backend() {
        let root = Path::new("/workspace/RetainPDF");
        assert_eq!(infer_project_root(&root.join("backend/api")).unwrap(), root);
        assert_eq!(
            infer_project_root(&root.join("services/api")).unwrap(),
            root
        );
    }

    #[test]
    fn desktop_layout_retains_packaged_pipeline_and_user_data() {
        let config = RuntimePathsConfig::from_desktop(
            PathBuf::from("/bundle/resources"),
            PathBuf::from("/user/data"),
        );
        assert_eq!(
            config.scripts_dir,
            PathBuf::from("/bundle/resources/pipeline")
        );
        assert_eq!(config.jobs_db_path, PathBuf::from("/user/data/db/jobs.db"));
        assert_eq!(
            config.auth_config_path,
            PathBuf::from("/user/data/rust_api/auth.local.json")
        );
    }
}
