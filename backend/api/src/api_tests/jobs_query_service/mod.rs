use std::{fs, sync::Arc};

use crate::api_tests::jobs_common::test_state;
use crate::error::AppError;
use crate::models::domain::JobSnapshot;
use crate::services::jobs::JobQueries;
use crate::models::api::ListTranslationItemsQuery;
use crate::models::domain::{CreateJobInput, JobArtifacts};
use crate::storage_paths::LEGACY_JOB_UNSUPPORTED_MESSAGE;

fn query_results(queries: &JobQueries<'_>, job_id: &str) -> [Result<(), AppError>; 7] {
    let query: ListTranslationItemsQuery =
        serde_json::from_value(serde_json::json!({})).expect("translation query");
    [
        queries.job_diagnostics_view(job_id).map(|_| ()),
        queries.resume_plan_view(job_id).map(|_| ()),
        queries.reader_regions_view(job_id).map(|_| ()),
        queries.reader_metadata_view(job_id).map(|_| ()),
        queries.translation_diagnostics_view(job_id).map(|_| ()),
        queries.translation_items_view(job_id, &query).map(|_| ()),
        queries.translation_item_view(job_id, "item").map(|_| ()),
    ]
}

#[test]
fn diagnostic_reader_and_debug_queries_need_no_execution_resources() {
    let state = test_state("narrow-query-resources");
    let owners = (
        Arc::strong_count(&state.job_runtime),
        Arc::strong_count(&state.uploads),
        Arc::strong_count(&state.job_slots),
    );
    let queries = JobQueries::new(&state.db, &state.config.data_root);
    for result in query_results(&queries, "missing-job") {
        assert!(matches!(result, Err(AppError::NotFound(_))));
    }
    assert_eq!(
        (
            Arc::strong_count(&state.job_runtime),
            Arc::strong_count(&state.uploads),
            Arc::strong_count(&state.job_slots),
        ),
        owners,
    );
}

#[test]
fn diagnostic_reader_and_debug_queries_reject_legacy_layout_before_reading_artifacts() {
    let state = test_state("narrow-query-legacy-layout");
    let job_root = state.config.output_root.join("legacy-job");
    fs::create_dir_all(job_root.join("originPDF")).expect("legacy layout");
    let mut job = JobSnapshot::new("legacy-job".into(), CreateJobInput::default(), vec![]);
    job.artifacts = Some(JobArtifacts {
        job_root: Some(job_root.to_string_lossy().into_owned()),
        ..Default::default()
    });
    state.db.save_job(&job).expect("save legacy job");
    let queries = JobQueries::new(&state.db, &state.config.data_root);
    for result in query_results(&queries, &job.job_id) {
        let Err(AppError::Reasoned { status, message, reason, .. }) = result else {
            panic!("legacy query must reject unsupported storage");
        };
        assert_eq!(status, axum::http::StatusCode::CONFLICT);
        assert_eq!(reason, "legacy_job_unsupported");
        assert_eq!(message, LEGACY_JOB_UNSUPPORTED_MESSAGE);
    }
}

// 任务列表的筛选和分页。
mod list_selection;
