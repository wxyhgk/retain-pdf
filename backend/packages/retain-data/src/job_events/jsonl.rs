use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;

use anyhow::Result;

use crate::models::api::JobEventRecord;
use crate::models::domain::JobSnapshot;
use crate::storage_paths::resolve_data_path;

const EVENTS_FILE_NAME: &str = "events.jsonl";

pub(super) fn append_event_jsonl(
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
    event: &JobEventRecord,
) -> Result<()> {
    let logs_dir = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.job_root.as_ref())
        .and_then(|job_root| resolve_data_path(data_root, job_root).ok())
        .map(|root| root.join("logs"))
        .unwrap_or_else(|| output_root.join(&job.job_id).join("logs"));
    std::fs::create_dir_all(&logs_dir)?;
    let path = logs_dir.join(EVENTS_FILE_NAME);
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    serde_json::to_writer(&mut file, event)?;
    file.write_all(b"\n")?;
    Ok(())
}
