use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::domain::{now_iso, UploadRecord};

fn digest(character: char) -> String {
    std::iter::repeat_n(character, 64).collect()
}

fn seed_scope(state: &crate::AppState, marker: char) -> (String, String, String) {
    let document_id = digest(marker);
    let conversation_id = format!("conv-capability-{marker}");
    let message_id = format!("msg-capability-{marker}");
    let upload = UploadRecord {
        upload_id: format!("upload-capability-{marker}"),
        filename: format!("source-{marker}.pdf"),
        stored_path: format!("uploads/source-{marker}.pdf"),
        bytes: 128,
        page_count: 1,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: document_id.clone(),
    };
    state.db.save_upload(&upload).expect("seed upload");
    state
        .db
        .upsert_document_from_upload(&upload)
        .expect("seed document");
    state
        .db
        .create_conversation(&conversation_id, "Agent capability", Some(&document_id))
        .expect("seed conversation");
    state
        .db
        .append_message(
            &conversation_id,
            &message_id,
            "user",
            "Edit this document",
            "[]",
            "[]",
            "",
            "",
            true,
        )
        .expect("seed request message");
    (document_id, conversation_id, message_id)
}

async fn request_json(
    app: axum::Router,
    method: &str,
    uri: &str,
    api_key: Option<&str>,
    capability: Option<&str>,
    payload: Option<Value>,
) -> axum::response::Response {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some(api_key) = api_key {
        builder = builder.header("X-API-Key", api_key);
    }
    if let Some(capability) = capability {
        builder = builder.header("X-RetainPDF-Agent-Capability", capability);
    }
    let body = if let Some(payload) = payload {
        builder = builder.header("content-type", "application/json");
        Body::from(payload.to_string())
    } else {
        Body::empty()
    };
    app.oneshot(builder.body(body).expect("build request"))
        .await
        .expect("capability response")
}

async fn issue(
    app: axum::Router,
    document_id: &str,
    conversation_id: &str,
    actions: &[&str],
) -> String {
    let response = request_json(
        app,
        "POST",
        "/api/v1/internal/agent/capabilities",
        Some("test-key"),
        None,
        Some(json!({
            "schema": "agent_capability_issue_v1",
            "conversation_id": conversation_id,
            "document_id": document_id,
            "actions": actions,
            "ttl_seconds": 120
        })),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    let body = read_json(response).await;
    body["data"]["capability"]
        .as_str()
        .expect("issued capability")
        .to_string()
}

fn create_payload(document_id: &str, conversation_id: &str, message_id: &str) -> Value {
    json!({
        "schema": "document_operation_create_v1",
        "idempotency_key": format!("create-{conversation_id}"),
        "conversation_id": conversation_id,
        "request_message_id": message_id,
        "document_id": document_id,
        "intent_summary": "Create a bounded candidate",
        "program_sha256": digest('f')
    })
}

#[tokio::test]
async fn issued_capability_can_use_only_its_explicit_backend_actions() {
    let state = test_state("agent-capability-actions");
    let (document_id, conversation_id, message_id) = seed_scope(&state, 'a');
    let app = build_app(state);
    let capability = issue(
        app.clone(),
        &document_id,
        &conversation_id,
        &["document.inspect", "operation.create", "operation.get"],
    )
    .await;

    let inspect = request_json(
        app.clone(),
        "GET",
        &format!("/api/v1/documents/{document_id}"),
        None,
        Some(&capability),
        None,
    )
    .await;
    assert_eq!(inspect.status(), StatusCode::OK);

    let create = request_json(
        app.clone(),
        "POST",
        "/api/v1/internal/agent/operations",
        None,
        Some(&capability),
        Some(create_payload(&document_id, &conversation_id, &message_id)),
    )
    .await;
    assert_eq!(create.status(), StatusCode::OK);

    let runtime_cursor = request_json(
        app.clone(),
        "GET",
        &format!("/api/v1/internal/agent/runtime-sessions/{conversation_id}"),
        None,
        Some(&capability),
        None,
    )
    .await;
    assert_eq!(runtime_cursor.status(), StatusCode::FORBIDDEN);

    let mint_again = request_json(
        app,
        "POST",
        "/api/v1/internal/agent/capabilities",
        None,
        Some(&capability),
        Some(json!({})),
    )
    .await;
    assert_eq!(mint_again.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn capability_cannot_cross_document_conversation_or_operation_scope() {
    let state = test_state("agent-capability-scope");
    let (document_a, conversation_a, message_a) = seed_scope(&state, 'a');
    let (document_b, conversation_b, message_b) = seed_scope(&state, 'b');
    let app = build_app(state);
    let capability_a = issue(
        app.clone(),
        &document_a,
        &conversation_a,
        &["operation.create", "operation.get"],
    )
    .await;

    let wrong_scope = request_json(
        app.clone(),
        "POST",
        "/api/v1/internal/agent/operations",
        None,
        Some(&capability_a),
        Some(create_payload(&document_b, &conversation_b, &message_b)),
    )
    .await;
    assert_eq!(wrong_scope.status(), StatusCode::FORBIDDEN);

    let created = request_json(
        app.clone(),
        "POST",
        "/api/v1/internal/agent/operations",
        None,
        Some(&capability_a),
        Some(create_payload(&document_a, &conversation_a, &message_a)),
    )
    .await;
    let created_body = read_json(created).await;
    let operation_id = created_body["data"]["operation_id"]
        .as_str()
        .expect("operation id");
    let capability_b = issue(
        app.clone(),
        &document_b,
        &conversation_b,
        &["operation.get"],
    )
    .await;
    let cross_operation = request_json(
        app,
        "GET",
        &format!("/api/v1/internal/agent/operations/{operation_id}"),
        None,
        Some(&capability_b),
        None,
    )
    .await;
    assert_eq!(cross_operation.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn tampered_capability_is_unauthorized_and_api_key_bootstrap_still_works() {
    let state = test_state("agent-capability-signature");
    let (document_id, conversation_id, _) = seed_scope(&state, 'c');
    let app = build_app(state);
    let capability = issue(
        app.clone(),
        &document_id,
        &conversation_id,
        &["document.inspect"],
    )
    .await;
    let mut tampered = capability.into_bytes();
    let last = tampered.last_mut().expect("capability byte");
    *last = if *last == b'a' { b'b' } else { b'a' };
    let tampered = String::from_utf8(tampered).expect("utf8 capability");
    let rejected = request_json(
        app.clone(),
        "GET",
        &format!("/api/v1/documents/{document_id}"),
        None,
        Some(&tampered),
        None,
    )
    .await;
    assert_eq!(rejected.status(), StatusCode::UNAUTHORIZED);

    let api_key_request = request_json(
        app,
        "GET",
        &format!("/api/v1/documents/{document_id}"),
        Some("test-key"),
        None,
        None,
    )
    .await;
    assert_eq!(api_key_request.status(), StatusCode::OK);
}
