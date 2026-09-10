use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{JobArtifacts, JobStatusKind};

use super::common::{
    seed_ocr_checkpoint_files, seed_translation_result_files, source_job_with_artifacts,
};

#[tokio::test]
async fn rerun_route_prefers_render_when_translations_are_available() {
    let state = test_state("rerun-render");
    let mut source_job = source_job_with_artifacts(
        "job-rerun-render-source",
        JobArtifacts {
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            translations_dir: Some("jobs/source/translated".to_string()),
            ..JobArtifacts::default()
        },
    );
    source_job.status = JobStatusKind::Succeeded;
    seed_translation_result_files(&state, &source_job);
    state.db.save_job(&source_job).expect("save source job");

    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/jobs/job-rerun-render-source/rerun")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("rerun request"),
        )
        .await
        .expect("rerun response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["workflow"], "render");
    let rerun_job_id = payload["data"]["job_id"].as_str().expect("job id");
    assert_eq!(rerun_job_id, "job-rerun-render-source");
    let rerun_job = state.db.get_job(rerun_job_id).expect("rerun job");
    assert_eq!(rerun_job.workflow, crate::models::WorkflowKind::Render);
    assert_eq!(rerun_job.status, JobStatusKind::Queued);
    assert_eq!(
        rerun_job.request_payload.source.artifact_job_id,
        "job-rerun-render-source"
    );
    assert_eq!(
        rerun_job.request_payload.runtime.job_id,
        "job-rerun-render-source"
    );
}

#[tokio::test]
async fn rerun_route_uses_book_when_only_ocr_checkpoint_is_available() {
    let state = test_state("rerun-book");
    let mut source_job = source_job_with_artifacts(
        "job-rerun-book-source",
        JobArtifacts {
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            ..JobArtifacts::default()
        },
    );
    source_job.status = JobStatusKind::Failed;
    seed_ocr_checkpoint_files(&state, &source_job);
    state.db.save_job(&source_job).expect("save source job");

    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/jobs/job-rerun-book-source/rerun")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("rerun request"),
        )
        .await
        .expect("rerun response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["workflow"], "book");
    let rerun_job_id = payload["data"]["job_id"].as_str().expect("job id");
    let rerun_job = state.db.get_job(rerun_job_id).expect("rerun job");
    assert_eq!(rerun_job.workflow, crate::models::WorkflowKind::Book);
    assert_eq!(
        rerun_job.request_payload.source.artifact_job_id,
        "job-rerun-book-source"
    );
}
