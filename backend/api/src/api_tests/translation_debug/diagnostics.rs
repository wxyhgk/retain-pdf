use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;

use super::common::{seed_translation_debug_job, JOB_ID};

#[tokio::test]
async fn translation_diagnostics_route_redacts_secrets() {
    let state = test_state("debug-diagnostics-redaction");
    seed_translation_debug_job(&state);

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{JOB_ID}/translation/diagnostics"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("diagnostics request"),
        )
        .await
        .expect("diagnostics response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["summary"]["api_key"], "");
    assert_eq!(payload["data"]["summary"]["message"], "contains [REDACTED]");
}
