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
                    "/api/v1/jobs/{JOB_ID}/translations/{ITEM_ID}/replay"
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

async fn post_replay(state: &crate::AppState, job_id: &str, item_id: &str) -> (StatusCode, serde_json::Value) {
    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{job_id}/translations/{item_id}/replay"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("replay request"),
        )
        .await
        .expect("replay response");
    let status = response.status();
    (status, read_json(response).await)
}

#[tokio::test]
async fn translation_replay_rejects_a_bad_item_id_with_400() {
    let state = test_state("debug-replay-bad-id");
    seed_translation_debug_job(&state);

    let (status, payload) = post_replay(&state, JOB_ID, "bad%20id").await;

    assert_eq!(status, StatusCode::BAD_REQUEST, "{payload}");
}

#[tokio::test]
async fn translation_replay_of_an_unknown_item_is_404() {
    let state = test_state("debug-replay-unknown-item");
    seed_translation_debug_job(&state);

    let (status, payload) = post_replay(&state, JOB_ID, "p009-b009").await;

    assert_eq!(status, StatusCode::NOT_FOUND, "{payload}");
}

#[tokio::test]
async fn translation_replay_of_a_merged_job_is_409_read_only() {
    let state = test_state("debug-replay-merged");

    let merged_id = format!("merged-{}-{}", "a".repeat(64), "0123456789abcdef");
    let (status, payload) = post_replay(&state, &merged_id, ITEM_ID).await;

    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "read_only_job");
}

#[tokio::test]
async fn translation_replay_accepts_the_reader_block_id() {
    let state = test_state("debug-replay-reader-id");
    seed_translation_debug_job(&state);

    let (status, payload) = post_replay(&state, JOB_ID, "p001-b0001").await;

    assert_eq!(status, StatusCode::OK, "{payload}");
    assert_eq!(payload["data"]["item_id"], ITEM_ID, "返回条目里实际存的写法");
}
