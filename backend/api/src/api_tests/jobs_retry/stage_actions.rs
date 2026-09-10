use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::json;
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{JobArtifacts, JobStatusKind};

use super::common::{seed_translation_result_files, source_job_with_artifacts};

#[tokio::test]
async fn stage_actions_route_reports_retryable_stages() {
    let state = test_state("stage-actions");
    let mut source_job = source_job_with_artifacts(
        "job-stage-actions",
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

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/jobs/job-stage-actions/stage-actions")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("stage actions request"),
        )
        .await
        .expect("stage actions response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["job_id"], "job-stage-actions");
    let stages = payload["data"]["stages"].as_array().expect("stages");
    let translation = stages
        .iter()
        .find(|item| item["stage"] == "translation")
        .expect("translation action");
    assert_eq!(translation["can_retry"], true);
    assert_eq!(translation["will_rerun"], json!(["translation", "render"]));
    assert_eq!(
        translation["action"]["url"],
        "http://127.0.0.1:41000/api/v1/jobs/job-stage-actions/retry-stage"
    );
    let render = stages
        .iter()
        .find(|item| item["stage"] == "render")
        .expect("render action");
    assert_eq!(render["can_retry"], true);
    assert_eq!(render["will_rerun"], json!(["render"]));
}
