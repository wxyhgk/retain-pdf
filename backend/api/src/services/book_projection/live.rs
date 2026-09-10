use std::path::Path;

use crate::db::Db;
use crate::models::api::JobProgressView;
use crate::models::domain::JobSnapshot;
use crate::services::jobs::live_stage::load_live_stage_snapshot;
use crate::services::jobs::stage_view::build_job_stage_view;

pub(super) struct BookLiveProjection {
    pub stage: Option<String>,
    pub stage_detail: Option<String>,
    pub progress: JobProgressView,
}

pub(super) fn build_live_projection(
    db: &Db,
    job: &JobSnapshot,
    data_root: &Path,
) -> BookLiveProjection {
    let live_stage = load_live_stage_snapshot(db, job, data_root);
    let stage = build_job_stage_view(job, live_stage.as_ref());
    BookLiveProjection {
        stage: stage.stage,
        stage_detail: stage.stage_detail,
        progress: stage.progress,
    }
}
