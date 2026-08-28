use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::models::domain::JobSnapshot;

pub(crate) mod pdf;
pub(crate) mod preview;
pub(crate) mod side_by_side;

#[derive(Clone, Copy)]
pub(crate) struct DerivedArtifactDeps<'a> {
    pub(crate) scripts_dir: &'a Path,
    pub(crate) python_bin: &'a str,
}

impl<'a> DerivedArtifactDeps<'a> {
    pub(crate) fn new(scripts_dir: &'a Path, python_bin: &'a str) -> Self {
        Self {
            scripts_dir,
            python_bin,
        }
    }
}

pub(crate) fn job_artifacts_dir(data_root: &Path, job: &JobSnapshot) -> Result<PathBuf, AppError> {
    let output_dir = data_root.join("jobs").join(&job.job_id).join("artifacts");
    std::fs::create_dir_all(&output_dir)?;
    Ok(output_dir)
}

/// Thư mục bộ nhớ cache cấp tài liệu（Không có job Bìa Thời gian/Hình thu nhỏ vẫn có sẵn）。
pub(crate) fn document_artifacts_dir(
    data_root: &Path,
    document_id: &str,
) -> Result<PathBuf, AppError> {
    let output_dir = data_root.join("documents").join(document_id);
    std::fs::create_dir_all(&output_dir)?;
    Ok(output_dir)
}

pub(crate) fn cached_output_is_fresh(
    output_path: &Path,
    inputs: &[&Path],
) -> Result<bool, AppError> {
    if !output_path.exists() || !output_path.is_file() {
        return Ok(false);
    }
    let output_modified = std::fs::metadata(output_path)?.modified().ok();
    Ok(inputs.iter().all(|input| {
        let input_modified = std::fs::metadata(input)
            .and_then(|meta| meta.modified())
            .ok();
        output_modified >= input_modified
    }))
}
