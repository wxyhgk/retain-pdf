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

async fn rerun_with_body(state: &crate::AppState, job_id: &str, body: serde_json::Value) -> axum::response::Response {
    build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{job_id}/rerun"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .expect("rerun request"),
        )
        .await
        .expect("rerun response")
}

fn failed_book_source(state: &crate::AppState, job_id: &str) {
    let mut source_job = source_job_with_artifacts(
        job_id,
        JobArtifacts {
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            ..JobArtifacts::default()
        },
    );
    source_job.status = JobStatusKind::Failed;
    seed_ocr_checkpoint_files(state, &source_job);
    state.db.save_job(&source_job).expect("save source job");
}

/// 换了 key 之后续跑：请求体带新 key，新任务用新 key（导入凭据库、不留明文），不沿用原任务的旧凭据。
#[tokio::test]
async fn rerun_uses_a_replacement_key_from_the_request_body() {
    let state = test_state("rerun-new-key");
    failed_book_source(&state, "job-rerun-new-key-source");

    let response = rerun_with_body(
        &state,
        "job-rerun-new-key-source",
        serde_json::json!({"overrides": {"translation": {"api_key": "sk-rotated-rerun-key"}}}),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    let rerun_job = state.db.get_job(payload["data"]["job_id"].as_str().unwrap()).expect("rerun job");
    let translation = &rerun_job.request_payload.translation;
    assert!(translation.api_key.is_empty(), "明文 key 不能落库");
    let resolved = retain_data::credentials::resolve_credential(
        &state.config.data_root,
        &translation.credential_ref,
        "translation_api_key",
    )
    .expect("reference resolves");
    assert_eq!(resolved.secret, "sk-rotated-rerun-key");
}

/// 续跑的请求体只接受换 key，别的设置一律沿用原任务；空请求体照旧可用（见上面两条）。
#[tokio::test]
async fn rerun_rejects_overrides_other_than_model_keys() {
    let state = test_state("rerun-bad-overrides");
    failed_book_source(&state, "job-rerun-bad-overrides");

    for body in [
        serde_json::json!({"overrides": {"translation": {"model": "other"}}}),
        serde_json::json!({"overrides": {"render": {"engine": "typst"}}}),
        serde_json::json!({"overrides": {"translation": {"api_key": "sk-a", "credential_ref": "cred_b"}}}),
        serde_json::json!({"unknown": 1}),
    ] {
        let response = rerun_with_body(&state, "job-rerun-bad-overrides", body.clone()).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{body}");
    }
}
