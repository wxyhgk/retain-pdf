use std::path::{Component, Path, PathBuf};

use crate::error::AppError;
use crate::models::domain::JobSnapshot;

use super::QueryJobsDeps;

pub(super) fn safe_markdown_image_path(path: &str) -> Result<PathBuf, AppError> {
    let raw = Path::new(path);
    if raw.is_absolute() {
        return Err(AppError::bad_request(
            "absolute markdown image path is not allowed",
        ));
    }
    let mut clean = PathBuf::new();
    for component in raw.components() {
        match component {
            Component::Normal(part) => clean.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(AppError::bad_request(
                    "parent-relative markdown image path is not allowed",
                ));
            }
        }
    }
    if clean.as_os_str().is_empty() {
        return Err(AppError::bad_request("markdown image path is empty"));
    }
    Ok(clean)
}

pub(super) fn job_artifacts_dir(
    deps: &QueryJobsDeps<'_>,
    job: &JobSnapshot,
) -> Result<PathBuf, AppError> {
    let output_dir = deps
        .data_root
        .join("jobs")
        .join(&job.job_id)
        .join("artifacts");
    std::fs::create_dir_all(&output_dir)?;
    Ok(output_dir)
}
