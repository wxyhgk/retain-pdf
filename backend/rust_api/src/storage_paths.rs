use std::path::{Component, Path, PathBuf};

use anyhow::{bail, Context, Result};

pub fn data_path_is_absolute(raw: &str) -> bool {
    Path::new(raw).is_absolute()
}

pub fn normalize_relative_data_path(path: &Path) -> Result<String> {
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::Normal(part) => parts.push(part.to_string_lossy().to_string()),
            Component::ParentDir => {
                bail!("parent-relative paths are not allowed: {}", path.display())
            }
            Component::RootDir | Component::Prefix(_) => {
                bail!("absolute paths are not allowed: {}", path.display())
            }
        }
    }
    if parts.is_empty() {
        bail!("path is empty");
    }
    Ok(parts.join("/"))
}

pub fn to_relative_data_path(data_root: &Path, path: &Path) -> Result<String> {
    if path.is_absolute() {
        let relative = path
            .strip_prefix(data_root)
            .with_context(|| format!("path is outside DATA_ROOT: {}", path.display()))?;
        return normalize_relative_data_path(relative);
    }
    normalize_relative_data_path(path)
}

pub fn resolve_data_path(data_root: &Path, raw: &str) -> Result<PathBuf> {
    let path = PathBuf::from(raw);
    if path.is_absolute() {
        return Ok(path);
    }
    Ok(data_root.join(normalize_relative_data_path(&path)?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_rejects_parent_relative_paths() {
        assert!(normalize_relative_data_path(Path::new("../escape.pdf")).is_err());
    }

    #[test]
    fn to_relative_strips_data_root_prefix() {
        let data_root = Path::new("/tmp/data-root");
        let path = data_root.join("jobs/job-1/rendered/out.pdf");
        assert_eq!(
            to_relative_data_path(data_root, &path).expect("relative path"),
            "jobs/job-1/rendered/out.pdf"
        );
    }

    #[test]
    fn resolve_data_path_expands_relative_paths_under_data_root() {
        let data_root = Path::new("/tmp/data-root");
        let resolved =
            resolve_data_path(data_root, "jobs/job-1/rendered/out.pdf").expect("resolved");
        assert_eq!(resolved, data_root.join("jobs/job-1/rendered/out.pdf"));
    }
}
