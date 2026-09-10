use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;

async fn request_json(
    app: axum::Router,
    method: Method,
    uri: &str,
    payload: Option<Value>,
) -> axum::response::Response {
    let mut request = Request::builder()
        .method(method)
        .uri(uri)
        .header("X-API-Key", "test-key");
    let body = if let Some(payload) = payload {
        request = request.header("content-type", "application/json");
        Body::from(payload.to_string())
    } else {
        Body::empty()
    };
    app.oneshot(request.body(body).expect("runtime session request"))
        .await
        .expect("runtime session response")
}

#[tokio::test]
async fn runtime_cursor_survives_router_rebuild_and_uses_revision_cas() {
    let state = test_state("agent-runtime-session-cas");
    let conversation_id = "conv-runtime-cas";
    state
        .db
        .create_conversation(conversation_id, "runtime", None)
        .expect("create conversation");
    let uri = format!("/api/v1/internal/agent/runtime-sessions/{conversation_id}");
    let app = build_app(state.clone());

    let initial = request_json(app.clone(), Method::GET, &uri, None).await;
    assert_eq!(initial.status(), StatusCode::OK);
    let initial_body = read_json(initial).await;
    assert_eq!(initial_body["data"]["revision"], 0);
    assert_eq!(initial_body["data"]["session_cursor"], "");

    let first = request_json(
        app,
        Method::PUT,
        &uri,
        Some(json!({
            "schema": "agent_runtime_session_put_v1",
            "runtime_id": "vercel-fx-acp-v1",
            "session_cursor": "fx-session-a",
            "expected_revision": 0
        })),
    )
    .await;
    assert_eq!(first.status(), StatusCode::OK);
    let first_body = read_json(first).await;
    assert_eq!(first_body["data"]["revision"], 1);

    // Rebuild the HTTP router around the same durable database, as happens
    // after an API process restart.
    let restarted = build_app(state);
    let loaded = request_json(restarted.clone(), Method::GET, &uri, None).await;
    assert_eq!(loaded.status(), StatusCode::OK);
    let loaded_body = read_json(loaded).await;
    assert_eq!(loaded_body["data"]["session_cursor"], "fx-session-a");
    assert_eq!(loaded_body["data"]["revision"], 1);

    let stale = request_json(
        restarted.clone(),
        Method::PUT,
        &uri,
        Some(json!({
            "schema": "agent_runtime_session_put_v1",
            "runtime_id": "vercel-fx-acp-v1",
            "session_cursor": "fx-session-stale",
            "expected_revision": 0
        })),
    )
    .await;
    assert_eq!(stale.status(), StatusCode::CONFLICT);

    let cleared = request_json(
        restarted,
        Method::DELETE,
        &uri,
        Some(json!({
            "schema": "agent_runtime_session_clear_v1",
            "expected_revision": 1
        })),
    )
    .await;
    assert_eq!(cleared.status(), StatusCode::OK);
    let cleared_body = read_json(cleared).await;
    assert_eq!(cleared_body["data"]["session_cursor"], "");
    assert_eq!(cleared_body["data"]["revision"], 2);
}

#[tokio::test]
async fn runtime_cursor_rejects_unknown_fields_and_missing_conversations() {
    let state = test_state("agent-runtime-session-validation");
    let app = build_app(state);
    let missing_uri = "/api/v1/internal/agent/runtime-sessions/conv-missing";
    let missing = request_json(app.clone(), Method::GET, missing_uri, None).await;
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);

    let invalid = request_json(
        app,
        Method::PUT,
        missing_uri,
        Some(json!({
            "schema": "agent_runtime_session_put_v1",
            "runtime_id": "vercel-fx-acp-v1",
            "session_cursor": "fx-session-a",
            "expected_revision": 0,
            "unexpected": true
        })),
    )
    .await;
    assert_eq!(invalid.status(), StatusCode::UNPROCESSABLE_ENTITY);
}
