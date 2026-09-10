use std::path::{Path, PathBuf};

use crate::db::Db;
use crate::error::AppError;
use crate::models::domain::{JobArtifactRecord, JobSnapshot};
use crate::storage_paths::{collect_job_artifact_entries, resolve_registered_artifact_path};

pub fn list_registry_for_job(
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<Vec<JobArtifactRecord>, AppError> {
    let mut items = db.list_job_artifact_entries(&job.job_id)?;
    let fallback_items = collect_job_artifact_entries(job, data_root)
        .map_err(|err| AppError::internal(err.to_string()))?;
    if items.is_empty() {
        return Ok(fallback_items);
    }
    for fallback in fallback_items {
        if !items
            .iter()
            .any(|item| item.artifact_key == fallback.artifact_key)
        {
            items.push(fallback);
        }
    }
    items.sort_by(|a, b| {
        a.artifact_group
            .cmp(&b.artifact_group)
            .then_with(|| a.artifact_key.cmp(&b.artifact_key))
    });
    Ok(items)
}

pub fn find_registry_artifact(
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
    artifact_key: &str,
) -> Result<Option<JobArtifactRecord>, AppError> {
    Ok(list_registry_for_job(db, data_root, job)?
        .into_iter()
        .find(|item| item.artifact_key == artifact_key))
}

pub fn resolve_registry_artifact(
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
    artifact_key: &str,
) -> Result<Option<(JobArtifactRecord, PathBuf)>, AppError> {
    let Some(item) = find_registry_artifact(db, data_root, job, artifact_key)? else {
        return Ok(None);
    };
    let path = resolve_registered_artifact_path(data_root, &item)
        .map_err(|err| AppError::internal(err.to_string()))?;
    Ok(Some((item, path)))
}
