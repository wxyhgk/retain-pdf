use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;

use super::common::{seed_translation_debug_job, ITEM_ID, JOB_ID};

#[tokio::test]
async fn translation_replay_route_redacts_secrets() {
    let state = test_state("debug-replay-redaction");
    seed_translation_debug_job(&state);

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/jobs/{JOB_ID}/translation/items/{ITEM_ID}/replay"
                ))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("replay request"),
        )
        .await
        .expect("replay response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["payload"]["api_key"], "");
    assert_eq!(payload["data"]["payload"]["message"], "replay [REDACTED]");
}
