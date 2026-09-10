use std::path::Path;

use crate::db::Db;
use crate::models::domain::JobSnapshot;

// Public live-stage projection stays here; event loading, child-event merging,
// and snapshot selection are split out to keep the progress contract auditable.
mod canonical_events;
mod combined_events;
mod pipeline_events;
mod records;
mod snapshot;

pub(crate) use combined_events::list_combined_job_events;

#[derive(Debug, Clone)]
pub struct LiveStageSnapshot {
    pub display_stage: Option<String>,
    pub stage: Option<String>,
    pub substage: Option<String>,
    pub lane: Option<String>,
    pub stage_detail: Option<String>,
    pub progress_current: Option<i64>,
    pub progress_total: Option<i64>,
    pub progress_unit: Option<String>,
    pub background_stages: Vec<LiveStageSnapshot>,
}

pub(crate) fn load_live_stage_snapshot(
    db: &Db,
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<LiveStageSnapshot> {
    let items = list_combined_job_events(db, data_root, job).ok()?;
    snapshot::select_live_stage_snapshot(&items, &job.status)
}
