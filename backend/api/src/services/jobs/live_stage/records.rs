use std::path::Path;

use crate::models::api::JobEventRecord;
use crate::models::domain::JobSnapshot;
use crate::storage_paths::resolve_events_jsonl;

use super::canonical_events::canonicalize_job_event;
use super::pipeline_events::load_pipeline_events_jsonl;

pub(crate) fn load_pipeline_event_records(
    job: &JobSnapshot,
    data_root: &Path,
    base_seq: i64,
    durable_state_authority: bool,
) -> Vec<JobEventRecord> {
    let Some(path) = resolve_events_jsonl(job, data_root) else {
        return Vec::new();
    };
    load_pipeline_events_jsonl(&job.job_id, &path, base_seq)
        .into_iter()
        .filter(|item| !durable_state_authority || !is_durable_stage_observation_projection(item))
        .map(|mut item| {
            canonicalize_job_event(&mut item, "pipeline_jsonl");
            item
        })
        .collect()
}

fn is_durable_stage_observation_projection(item: &JobEventRecord) -> bool {
    let schema = item
        .payload
        .as_ref()
        .and_then(|payload| payload.get("raw_schema"))
        .and_then(|value| value.as_str());
    schema == Some("pipeline_stage_observation_v1")
        && matches!(item.event.as_str(), "stage_transition" | "stage_progress")
}
