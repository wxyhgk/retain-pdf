use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};

use crate::storage_paths::resolve_data_path;

pub(super) fn required_existing_file(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    source_label: &str,
    missing_raw_message: String,
    missing_path_message: &str,
) -> Result<PathBuf> {
    let path = required_path(data_root, raw, missing_raw_message)?;
    if !path.is_file() {
        return Err(anyhow!(
            "{artifact_key} {missing_path_message} for {source_label}: {}",
            path.display()
        ));
    }
    Ok(path)
}

pub(super) fn optional_existing_file(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    source_label: &str,
    missing_path_message: &str,
) -> Result<Option<PathBuf>> {
    let Some(raw) = raw else {
        return Ok(None);
    };
    let path = resolve_data_path(data_root, raw)?;
    if !path.is_file() {
        return Err(anyhow!(
            "{artifact_key} {missing_path_message} for {source_label}: {}",
            path.display()
        ));
    }
    Ok(Some(path))
}

pub(super) fn required_existing_dir(
    data_root: &Path,
    raw: Option<&str>,
    artifact_key: &str,
    source_label: &str,
    missing_raw_message: String,
    missing_path_message: &str,
) -> Result<PathBuf> {
    let path = required_path(data_root, raw, missing_raw_message)?;
    if !path.is_dir() {
        return Err(anyhow!(
            "{artifact_key} {missing_path_message} for {source_label}: {}",
            path.display()
        ));
    }
    Ok(path)
}

fn required_path(
    data_root: &Path,
    raw: Option<&str>,
    missing_raw_message: String,
) -> Result<PathBuf> {
    let raw = raw.ok_or_else(|| anyhow!(missing_raw_message))?;
    resolve_data_path(data_root, raw)
}
