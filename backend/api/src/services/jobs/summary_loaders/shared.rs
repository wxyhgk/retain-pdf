use std::path::Path;

use serde_json::Value;

use crate::error::AppError;
use crate::models::domain::JobSnapshot;
use crate::storage_paths::{resolve_data_path, resolve_translation_manifest};

pub(super) fn read_json_value(path: &Path) -> Result<Value, AppError> {
    let text = std::fs::read_to_string(path)?;
    serde_json::from_str(&text)
        .map_err(|err| AppError::internal(format!("parse json {}: {err}", path.display())))
}

pub(super) fn read_translation_manifest_or_pipeline_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> impl Iterator<Item = Value> {
    let manifest =
        resolve_translation_manifest(job, data_root).and_then(|path| read_json_value(&path).ok());
    let pipeline_summary = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.summary.as_ref())
        .and_then(|path| resolve_data_path(data_root, path).ok())
        .and_then(|path| read_json_value(&path).ok());
    [manifest, pipeline_summary].into_iter().flatten()
}
