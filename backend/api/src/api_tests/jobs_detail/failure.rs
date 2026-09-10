use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{CreateJobInput, JobSnapshot, JobStatusKind};

#[tokio::test]
async fn job_detail_route_prefers_formal_failure_fields() {
    let state = test_state("detail-formal-failure");
    let mut job = JobSnapshot::new(
        "job-route-formal-failure".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.failure = Some(crate::models::JobFailureInfo {
        stage: "failed".to_string(),
        category: "legacy_provider_failed".to_string(),
        code: Some("LEGACY-001".to_string()),
        failed_stage: Some("translation_prepare".to_string()),
        failure_code: Some("auth_failed".to_string()),
        failure_category: Some("auth".to_string()),
        provider_stage: Some("mineru_processing".to_string()),
        provider_code: Some("A0211".to_string()),
        summary: "鉴权失败".to_string(),
        root_cause: Some("token expired".to_string()),
        retryable: false,
        upstream_host: Some("mineru.example.test".to_string()),
        provider: Some("mineru".to_string()),
        suggestion: Some("检查 provider token".to_string()),
        last_log_line: Some("token expired during mineru_processing".to_string()),
        raw_excerpt: Some("token expired".to_string()),
        raw_error_excerpt: Some("legacy raw excerpt".to_string()),
        raw_diagnostic: None,
        ai_diagnostic: None,
    });
    state.db.save_job(&job).expect("save job");

    let app = build_app(state.clone());
    let detail_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{}", job.job_id))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("detail request"),
        )
        .await
        .expect("detail response");
    assert_eq!(detail_response.status(), StatusCode::OK);
    let detail_json = read_json(detail_response).await;

    assert_eq!(
        detail_json["data"]["failure"]["failed_stage"],
        "translation_prepare"
    );
    assert_eq!(
        detail_json["data"]["failure"]["failure_code"],
        "auth_failed"
    );
    assert_eq!(detail_json["data"]["failure"]["failure_category"], "auth");
    assert_eq!(
        detail_json["data"]["failure"]["provider_stage"],
        "mineru_processing"
    );
    assert_eq!(detail_json["data"]["failure"]["provider_code"], "A0211");
    assert_eq!(
        detail_json["data"]["failure"]["raw_excerpt"],
        "token expired"
    );
    assert_eq!(
        detail_json["data"]["failure_diagnostic"]["failed_stage"],
        "translation_prepare"
    );
    assert_eq!(
        detail_json["data"]["failure_diagnostic"]["error_kind"],
        "auth_failed"
    );
}
