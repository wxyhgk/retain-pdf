use std::fs;

use axum::body::{to_bytes, Body};
use axum::http::{header, Request, StatusCode};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{minimal_pdf_bytes, read_json, test_state};
use crate::app::build_app;
use crate::models::domain::{now_iso, UploadRecord};

async fn post(app: axum::Router, uri: &str, payload: Value) -> axum::response::Response {
    app.oneshot(
        Request::builder()
            .method("POST")
            .uri(uri)
            .header("X-API-Key", "test-key")
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(payload.to_string()))
            .expect("request"),
    )
    .await
    .expect("response")
}

async fn get(app: axum::Router, uri: &str) -> axum::response::Response {
    app.oneshot(
        Request::builder()
            .uri(uri)
            .header("X-API-Key", "test-key")
            .body(Body::empty())
            .expect("request"),
    )
    .await
    .expect("response")
}

fn seed_scope(state: &crate::AppState) -> (String, String, String) {
    let document_id = "a".repeat(64);
    let source_path = state.config.uploads_dir.join("calculation-source.pdf");
    let source = minimal_pdf_bytes(200, 300);
    fs::write(&source_path, &source).expect("source PDF");
    let upload = UploadRecord {
        upload_id: "calculation-upload".to_string(),
        filename: "calculation-source.pdf".to_string(),
        stored_path: source_path.to_string_lossy().to_string(),
        bytes: source.len() as u64,
        page_count: 1,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: document_id.clone(),
    };
    state.db.save_upload(&upload).expect("upload");
    state
        .db
        .upsert_document_from_upload(&upload)
        .expect("document");
    let conversation_id = "conversation-calculation".to_string();
    let message_id = "message-calculation".to_string();
    state
        .db
        .create_conversation(&conversation_id, "", Some(&document_id))
        .expect("conversation");
    state
        .db
        .append_message(
            &conversation_id,
            &message_id,
            "user",
            "make a chart",
            "",
            "",
            "",
            "",
            true,
        )
        .expect("message");
    (document_id, conversation_id, message_id)
}

#[tokio::test]
async fn durable_calculation_can_be_completed_listed_and_downloaded() {
    let state = test_state("agent-calculation-lifecycle");
    let (document_id, conversation_id, message_id) = seed_scope(&state);
    let app = build_app(state);
    let calculation_id = "calc-lifecycle";
    let created = post(
        app.clone(),
        "/api/v1/internal/agent/calculations",
        json!({
            "schema": "agent_calculation_create_v1",
            "calculation_id": calculation_id,
            "conversation_id": conversation_id,
            "request_message_id": message_id,
            "document_id": document_id,
            "tool_name": "generate_chart",
            "tool_call_id": "tool-chart",
            "input_refs": {"document_id": document_id, "block_ids": ["p001-b0001"]},
            "input_sha256": "b".repeat(64)
        }),
    )
    .await;
    assert_eq!(created.status(), StatusCode::OK);
    let created = read_json(created).await;
    assert_eq!(created["data"]["status"], "running");
    assert!(created["data"].get("input_sha256").is_none());

    // Model transports may regenerate a tool-call ID after reconnecting. The
    // durable identity is the request, fixed tool and input hash, not that
    // ephemeral model identifier.
    let replayed_create = post(
        app.clone(),
        "/api/v1/internal/agent/calculations",
        json!({
            "schema": "agent_calculation_create_v1",
            "calculation_id": calculation_id,
            "conversation_id": conversation_id,
            "request_message_id": message_id,
            "document_id": document_id,
            "tool_name": "generate_chart",
            "tool_call_id": "tool-chart-after-reconnect",
            "input_refs": {"document_id": document_id, "block_ids": ["p001-b0001"]},
            "input_sha256": "b".repeat(64)
        }),
    )
    .await;
    assert_eq!(replayed_create.status(), StatusCode::OK);

    let svg = br#"<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>"#;
    let sha256 = Sha256::digest(svg)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let completed = post(
        app.clone(),
        &format!("/api/v1/internal/agent/calculations/{calculation_id}/complete"),
        json!({
            "schema": "agent_calculation_complete_v1",
            "result": {
                "schema": "retainpdf.calculation-artifact.v1",
                "chart": {"type": "bar", "point_count": 2}
            },
            "artifacts": [{
                "artifact_id": "chart-a",
                "kind": "svg_chart",
                "mime_type": "image/svg+xml",
                "sha256": sha256,
                "content_base64": STANDARD.encode(svg)
            }]
        }),
    )
    .await;
    let completed_status = completed.status();
    let completed = read_json(completed).await;
    assert_eq!(completed_status, StatusCode::OK, "{completed}");
    assert_eq!(completed["data"]["status"], "completed");
    assert_eq!(completed["data"]["result"]["chart"]["point_count"], 2);
    let artifact_url = completed["data"]["artifacts"][0]["url"]
        .as_str()
        .expect("artifact URL")
        .to_string();

    let listed = get(
        app.clone(),
        &format!("/api/v1/ai/conversations/{conversation_id}/calculations?limit=1&offset=0"),
    )
    .await;
    assert_eq!(listed.status(), StatusCode::OK);
    let listed = read_json(listed).await;
    assert_eq!(listed["data"]["total"], 1);
    assert_eq!(listed["data"]["limit"], 1);
    assert_eq!(listed["data"]["has_more"], false);
    assert_eq!(
        listed["data"]["calculations"][0]["calculation_id"],
        calculation_id
    );

    let artifact = get(app.clone(), &artifact_url).await;
    assert_eq!(artifact.status(), StatusCode::OK);
    assert_eq!(artifact.headers()[header::CONTENT_TYPE], "image/svg+xml");
    let body = to_bytes(artifact.into_body(), usize::MAX)
        .await
        .expect("artifact body");
    assert_eq!(body.as_ref(), svg);

    // A lost completion response can be replayed without deleting the durable file.
    let replay = post(
        app.clone(),
        &format!("/api/v1/internal/agent/calculations/{calculation_id}/complete"),
        json!({
            "schema": "agent_calculation_complete_v1",
            "result": {"schema": "retainpdf.calculation-artifact.v1"},
            "artifacts": []
        }),
    )
    .await;
    assert_eq!(replay.status(), StatusCode::OK);
    assert_eq!(get(app, &artifact_url).await.status(), StatusCode::OK);
}

#[tokio::test]
async fn calculation_scope_and_svg_safety_are_enforced() {
    let state = test_state("agent-calculation-safety");
    let (document_id, conversation_id, message_id) = seed_scope(&state);
    let app = build_app(state);
    let mismatched = post(
        app.clone(),
        "/api/v1/internal/agent/calculations",
        json!({
            "schema": "agent_calculation_create_v1",
            "calculation_id": "calc-mismatch",
            "conversation_id": conversation_id,
            "request_message_id": message_id,
            "document_id": document_id,
            "tool_name": "analyze_table",
            "tool_call_id": "tool-table",
            "input_refs": {"document_id": "other-document"},
            "input_sha256": "c".repeat(64)
        }),
    )
    .await;
    assert_eq!(mismatched.status(), StatusCode::CONFLICT);

    let created = post(
        app.clone(),
        "/api/v1/internal/agent/calculations",
        json!({
            "schema": "agent_calculation_create_v1",
            "calculation_id": "calc-unsafe-svg",
            "conversation_id": conversation_id,
            "request_message_id": message_id,
            "document_id": document_id,
            "tool_name": "generate_chart",
            "tool_call_id": "tool-chart",
            "input_refs": {"document_id": document_id},
            "input_sha256": "d".repeat(64)
        }),
    )
    .await;
    assert_eq!(created.status(), StatusCode::OK);
    let unsafe_svg = b"<svg><script>alert(1)</script></svg>";
    let sha256 = Sha256::digest(unsafe_svg)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let rejected = post(
        app,
        "/api/v1/internal/agent/calculations/calc-unsafe-svg/complete",
        json!({
            "schema": "agent_calculation_complete_v1",
            "result": {"schema": "retainpdf.calculation-artifact.v1"},
            "artifacts": [{
                "artifact_id": "chart-b",
                "kind": "svg_chart",
                "mime_type": "image/svg+xml",
                "sha256": sha256,
                "content_base64": STANDARD.encode(unsafe_svg)
            }]
        }),
    )
    .await;
    assert_eq!(rejected.status(), StatusCode::BAD_REQUEST);
}
