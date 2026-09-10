use std::collections::BTreeSet;
use std::fs;

use axum::body::{to_bytes, Body};
use axum::http::{header, Request, StatusCode};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{minimal_pdf_bytes, read_json, test_state};
use crate::app::build_app;
use crate::db::DocumentVersionRecord;
use crate::models::domain::{now_iso, DocumentOperationStatus, UploadRecord};
use crate::services::public_document_operations_api::{
    PublicDocumentOperationActionInput, PublicDocumentOperationListQuery,
};

fn public_operation_contract() -> Value {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../contracts/public-document-operation.v1.schema.json");
    serde_json::from_str(&std::fs::read_to_string(path).expect("read public operation contract"))
        .expect("parse public operation contract")
}

fn object_keys(value: &Value) -> BTreeSet<String> {
    value
        .as_object()
        .expect("JSON object")
        .keys()
        .cloned()
        .collect()
}

fn definition_keys(contract: &Value, definition: &str) -> BTreeSet<String> {
    contract["definitions"][definition]["properties"]
        .as_object()
        .expect("contract properties")
        .keys()
        .cloned()
        .collect()
}

fn digest(character: char) -> String {
    std::iter::repeat_n(character, 64).collect()
}

fn sha256(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn seed_document_and_conversation(state: &crate::AppState, suffix: &str) -> (String, String) {
    let document_id = digest(suffix.chars().next().unwrap_or('a'));
    let source_path = state
        .config
        .uploads_dir
        .join(format!("source-{suffix}.pdf"));
    let source = minimal_pdf_bytes(200, 300);
    fs::write(&source_path, &source).expect("write source PDF");
    let upload = UploadRecord {
        upload_id: format!("public-operation-upload-{suffix}"),
        filename: format!("source-{suffix}.pdf"),
        stored_path: source_path.to_string_lossy().to_string(),
        bytes: source.len() as u64,
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
    let conversation_id = format!("conversation-public-operation-{suffix}");
    state
        .db
        .create_conversation(&conversation_id, "", Some(&document_id))
        .expect("seed conversation");
    state
        .db
        .append_message(
            &conversation_id,
            "request-public-operation",
            "user",
            "Edit this PDF",
            "",
            "",
            "",
            "",
            true,
        )
        .expect("seed request message");
    (document_id, conversation_id)
}

async fn post_json(app: axum::Router, uri: &str, payload: Value) -> axum::response::Response {
    app.oneshot(
        Request::builder()
            .method("POST")
            .uri(uri)
            .header("X-API-Key", "test-key")
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(payload.to_string()))
            .expect("build request"),
    )
    .await
    .expect("operation response")
}

async fn get(app: axum::Router, uri: &str) -> axum::response::Response {
    app.oneshot(
        Request::builder()
            .uri(uri)
            .header("X-API-Key", "test-key")
            .body(Body::empty())
            .expect("build request"),
    )
    .await
    .expect("operation response")
}

async fn create_operation(
    app: axum::Router,
    document_id: &str,
    conversation_id: &str,
    key: &str,
) -> String {
    let response = post_json(
        app,
        "/api/v1/internal/agent/operations",
        json!({
            "schema": "document_operation_create_v1",
            "idempotency_key": key,
            "conversation_id": conversation_id,
            "request_message_id": "request-public-operation",
            "document_id": document_id,
            "intent_summary": "Create a safe candidate PDF",
            "program_sha256": digest('c')
        }),
    )
    .await;
    let status = response.status();
    let body = read_json(response).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["data"]["operation_id"]
        .as_str()
        .expect("operation id")
        .to_string()
}

fn action(status: &str, attempt: u32, key: &str) -> Value {
    json!({
        "schema": "document_operation_action_v1",
        "idempotency_key": key,
        "expected_status": status,
        "expected_attempt": attempt,
        "expected_program_sha256": digest('c')
    })
}

#[tokio::test]
async fn public_list_and_get_return_only_safe_recovery_projection() {
    let state = test_state("public-document-operation-list");
    let (document_id, conversation_id) = seed_document_and_conversation(&state, "a");
    let app = build_app(state);
    let operation_id = create_operation(
        app.clone(),
        &document_id,
        &conversation_id,
        "create-public-list",
    )
    .await;

    let response = get(
        app.clone(),
        &format!("/api/v1/ai/conversations/{conversation_id}/operations"),
    )
    .await;
    let status = response.status();
    let body = read_json(response).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"]["total"], 1);
    assert_eq!(body["data"]["limit"], 50);
    assert_eq!(body["data"]["offset"], 0);
    assert_eq!(body["data"]["has_more"], false);
    let contract = public_operation_contract();
    assert_eq!(
        object_keys(&body["data"]),
        definition_keys(&contract, "PublicDocumentOperationListView")
    );
    let operation = &body["data"]["operations"][0];
    assert_eq!(
        object_keys(operation),
        definition_keys(&contract, "PublicDocumentOperationView")
    );
    assert_eq!(
        object_keys(&operation["events"][0]),
        definition_keys(&contract, "PublicDocumentOperationEventView")
    );
    assert_eq!(operation["operation_id"], operation_id);
    assert_eq!(operation["conversation_id"], conversation_id);
    assert_eq!(operation["status"], "draft");
    assert_eq!(operation["current_attempt"], 1);
    assert_eq!(operation["program_sha256"], digest('c'));
    assert_eq!(operation["latest_event_seq"], 1);
    assert_eq!(operation["candidate_available"], false);
    assert_eq!(operation["plan_steps"], json!([]));
    assert_eq!(operation["affected_pages"], json!([]));
    assert_eq!(operation["allowed_actions"], json!(["run", "cancel"]));
    assert!(operation.get("manifest").is_none());
    assert!(operation.get("state").is_none());
    assert!(operation.get("artifact_key").is_none());
    assert!(operation["events"][0].get("payload").is_none());

    let detail = get(
        app.clone(),
        &format!("/api/v1/ai/operations/{operation_id}"),
    )
    .await;
    assert_eq!(detail.status(), StatusCode::OK);

    let missing = get(
        app,
        "/api/v1/ai/conversations/conversation-does-not-exist/operations",
    )
    .await;
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);
}

#[test]
fn public_action_serde_matches_contract_required_unknown_and_status_rules() {
    let contract = public_operation_contract();
    let schema = &contract["definitions"]["PublicDocumentOperationActionInput"];
    let base = action("draft", 1, "contract-action");

    serde_json::from_value::<PublicDocumentOperationActionInput>(base.clone())
        .expect("contract action must deserialize");
    for field in schema["required"].as_array().expect("required fields") {
        let field = field.as_str().expect("required field name");
        let mut missing = base.clone();
        missing
            .as_object_mut()
            .expect("action object")
            .remove(field);
        assert!(
            serde_json::from_value::<PublicDocumentOperationActionInput>(missing).is_err(),
            "Rust DTO unexpectedly accepted missing required field {field}"
        );
    }

    let mut unknown = base.clone();
    unknown["future_field"] = json!(true);
    assert!(serde_json::from_value::<PublicDocumentOperationActionInput>(unknown).is_err());

    for status in contract["definitions"]["DocumentOperationStatus"]["enum"]
        .as_array()
        .expect("status enum")
    {
        let mut payload = base.clone();
        payload["expected_status"] = status.clone();
        serde_json::from_value::<PublicDocumentOperationActionInput>(payload)
            .expect("contract status must deserialize");
    }
    let mut invalid_status = base;
    invalid_status["expected_status"] = json!("unknown");
    assert!(serde_json::from_value::<PublicDocumentOperationActionInput>(invalid_status).is_err());
}

#[test]
fn public_list_query_serde_matches_contract_optional_and_unknown_rules() {
    let contract = public_operation_contract();
    let schema = &contract["definitions"]["PublicDocumentOperationListQuery"];
    assert!(schema.get("required").is_none());
    assert_eq!(
        definition_keys(&contract, "PublicDocumentOperationListQuery"),
        BTreeSet::from(["limit".to_string(), "offset".to_string()])
    );

    let omitted = serde_json::from_value::<PublicDocumentOperationListQuery>(json!({}))
        .expect("all query fields are optional");
    assert_eq!(omitted.limit, None);
    assert_eq!(omitted.offset, 0);
    let explicit = serde_json::from_value::<PublicDocumentOperationListQuery>(json!({
        "limit": 25,
        "offset": 10
    }))
    .expect("contract query must deserialize");
    assert_eq!(explicit.limit, Some(25));
    assert_eq!(explicit.offset, 10);
    assert!(
        serde_json::from_value::<PublicDocumentOperationListQuery>(json!({
            "future_field": true
        }))
        .is_err()
    );
}

#[tokio::test]
async fn public_operation_list_supports_stable_offset_pagination() {
    let state = test_state("public-document-operation-pagination");
    let (document_id, conversation_id) = seed_document_and_conversation(&state, "c");
    let app = build_app(state);
    let mut created = Vec::new();
    for key in ["create-page-a", "create-page-b", "create-page-c"] {
        created.push(create_operation(app.clone(), &document_id, &conversation_id, key).await);
    }

    let base_uri = format!("/api/v1/ai/conversations/{conversation_id}/operations");
    let all = read_json(get(app.clone(), &format!("{base_uri}?limit=100")).await).await;
    let all_ids = all["data"]["operations"]
        .as_array()
        .expect("all operations")
        .iter()
        .map(|operation| {
            operation["operation_id"]
                .as_str()
                .expect("operation id")
                .to_string()
        })
        .collect::<Vec<_>>();
    assert_eq!(all["data"]["total"], 3);
    assert_eq!(all_ids.len(), 3);
    assert!(created
        .iter()
        .all(|operation_id| all_ids.contains(operation_id)));

    // Existing clients that only send limit continue to start at offset zero.
    let legacy = read_json(get(app.clone(), &format!("{base_uri}?limit=2")).await).await;
    assert_eq!(legacy["data"]["limit"], 2);
    assert_eq!(legacy["data"]["offset"], 0);
    assert_eq!(legacy["data"]["total"], 3);
    assert_eq!(legacy["data"]["has_more"], true);

    let middle_uri = format!("{base_uri}?limit=1&offset=1");
    let middle = read_json(get(app.clone(), &middle_uri).await).await;
    assert_eq!(middle["data"]["limit"], 1);
    assert_eq!(middle["data"]["offset"], 1);
    assert_eq!(middle["data"]["total"], 3);
    assert_eq!(middle["data"]["has_more"], true);
    assert_eq!(middle["data"]["operations"][0]["operation_id"], all_ids[1]);
    let repeated = read_json(get(app.clone(), &middle_uri).await).await;
    assert_eq!(repeated["data"]["operations"], middle["data"]["operations"]);

    let tail = read_json(get(app, &format!("{base_uri}?limit=1&offset=2")).await).await;
    assert_eq!(tail["data"]["operations"][0]["operation_id"], all_ids[2]);
    assert_eq!(tail["data"]["has_more"], false);
}

#[tokio::test]
async fn public_failure_is_diagnostic_but_never_exposes_worker_detail() {
    let state = test_state("public-document-operation-failure");
    let (document_id, conversation_id) = seed_document_and_conversation(&state, "f");
    let app = build_app(state.clone());
    let operation_id = create_operation(
        app.clone(),
        &document_id,
        &conversation_id,
        "create-public-failure",
    )
    .await;
    let run = post_json(
        app.clone(),
        &format!("/api/v1/ai/operations/{operation_id}/run"),
        action("draft", 1, "run-public-failure"),
    )
    .await;
    assert_eq!(run.status(), StatusCode::OK);
    let attempt = state
        .db
        .get_document_operation_attempt(&operation_id, 1)
        .expect("load attempt")
        .expect("attempt exists");
    let mut failed = attempt.state;
    failed.status = DocumentOperationStatus::Failed;
    failed.error_code = Some("page_program_failed".to_string());
    failed.detail =
        Some("candidate mismatch at /private/data/secret.pdf?token=must-not-leak".to_string());
    failed.terminal_receipt_at = Some(now_iso());
    failed.updated_at = now_iso();
    state
        .db
        .transition_document_operation(&failed, "executor_failed", "{}")
        .expect("persist failure");

    let response = get(app, &format!("/api/v1/ai/operations/{operation_id}")).await;
    assert_eq!(response.status(), StatusCode::OK);
    let body = read_json(response).await;
    assert_eq!(body["data"]["status"], "failed");
    assert_eq!(body["data"]["failure"]["code"], "page_program_failed");
    assert_eq!(body["data"]["failure"]["retryable"], true);
    assert!(body["data"]["failure"]["message"]
        .as_str()
        .is_some_and(|message| message.contains("视觉一致性")));
    let serialized = body.to_string();
    assert!(!serialized.contains("must-not-leak"));
    assert!(!serialized.contains("/private/data"));
    assert!(body["data"].get("state").is_none());
}

#[tokio::test]
async fn public_projection_exposes_only_validated_page_plan_steps() {
    let state = test_state("public-document-operation-plan");
    let (document_id, conversation_id) = seed_document_and_conversation(&state, "p");
    let app = build_app(state);
    let program = json!({
        "schema": "retainpdf_page_program_v1",
        "steps": [
            {"op": "select_pages", "pages": [3, 1, 3]},
            {"op": "rotate_pages", "pages": [3], "degrees": 90}
        ]
    });
    let program_bytes = serde_json::to_vec(&program).expect("serialize program");
    let response = post_json(
        app.clone(),
        "/api/v1/internal/agent/operations",
        json!({
            "schema": "document_operation_create_v1",
            "idempotency_key": "create-public-plan",
            "conversation_id": conversation_id,
            "request_message_id": "request-public-operation",
            "document_id": document_id,
            "intent_summary": "Reorder and rotate selected pages",
            "program_sha256": sha256(&program_bytes),
            "program": program
        }),
    )
    .await;
    let status = response.status();
    let created = read_json(response).await;
    assert_eq!(status, StatusCode::OK, "{created}");
    let operation_id = created["data"]["operation_id"]
        .as_str()
        .expect("operation id");

    let detail = read_json(get(app, &format!("/api/v1/ai/operations/{operation_id}")).await).await;
    assert_eq!(
        detail["data"]["plan_steps"],
        json!([
            {"op": "select_pages", "pages": [3, 1, 3]},
            {"op": "rotate_pages", "pages": [3], "degrees": 90}
        ])
    );
    assert_eq!(detail["data"]["affected_pages"], json!([1, 3]));
    assert!(detail["data"].get("program").is_none());
}

#[tokio::test]
async fn public_actions_enforce_preconditions_and_replay_without_redispatch() {
    let state = test_state("public-document-operation-actions");
    let (document_id, conversation_id) = seed_document_and_conversation(&state, "b");
    let app = build_app(state.clone());
    let operation_id = create_operation(
        app.clone(),
        &document_id,
        &conversation_id,
        "create-public-actions",
    )
    .await;
    let run_uri = format!("/api/v1/ai/operations/{operation_id}/run");

    let stale = post_json(app.clone(), &run_uri, action("running", 1, "run-stale")).await;
    assert_eq!(stale.status(), StatusCode::CONFLICT);

    let run_payload = action("draft", 1, "run-public");
    let run = post_json(app.clone(), &run_uri, run_payload.clone()).await;
    let run_status = run.status();
    let run_body = read_json(run).await;
    assert_eq!(run_status, StatusCode::OK, "{run_body}");
    assert_eq!(run_body["data"]["status"], "running");
    assert_eq!(run_body["data"]["latest_event_seq"], 4);

    let replay = post_json(app.clone(), &run_uri, run_payload).await;
    let replay_status = replay.status();
    let replay_body = read_json(replay).await;
    assert_eq!(replay_status, StatusCode::OK, "{replay_body}");
    assert_eq!(replay_body["data"]["latest_event_seq"], 4);

    let attempt = state
        .db
        .get_document_operation_attempt(&operation_id, 1)
        .expect("load attempt")
        .expect("attempt exists");
    let mut failed = attempt.state;
    failed.status = DocumentOperationStatus::Failed;
    failed.terminal_receipt_at = Some(now_iso());
    failed.error_code = Some("test_failure".to_string());
    failed.updated_at = now_iso();
    state
        .db
        .transition_document_operation(&failed, "test_failure", "{}")
        .expect("mark failed");

    let retry_uri = format!("/api/v1/ai/operations/{operation_id}/retry");
    let retry_payload = action("failed", 1, "retry-public");
    let retry = post_json(app.clone(), &retry_uri, retry_payload.clone()).await;
    let retry_status = retry.status();
    let retry_body = read_json(retry).await;
    assert_eq!(retry_status, StatusCode::OK, "{retry_body}");
    assert_eq!(retry_body["data"]["status"], "running");
    assert_eq!(retry_body["data"]["current_attempt"], 2);

    let retry_replay = post_json(app, &retry_uri, retry_payload).await;
    let retry_replay_status = retry_replay.status();
    let retry_replay_body = read_json(retry_replay).await;
    assert_eq!(retry_replay_status, StatusCode::OK, "{retry_replay_body}");
    assert_eq!(retry_replay_body["data"]["current_attempt"], 2);
}

#[tokio::test]
async fn candidate_download_is_inline_contained_and_hash_verified() {
    let state = test_state("public-document-operation-candidate");
    let (document_id, conversation_id) = seed_document_and_conversation(&state, "d");
    let app = build_app(state.clone());
    let operation_id = create_operation(
        app.clone(),
        &document_id,
        &conversation_id,
        "create-public-candidate",
    )
    .await;
    let run = post_json(
        app.clone(),
        &format!("/api/v1/ai/operations/{operation_id}/run"),
        action("draft", 1, "run-public-candidate"),
    )
    .await;
    assert_eq!(run.status(), StatusCode::OK);

    let candidate_bytes = minimal_pdf_bytes(240, 360);
    let candidate_sha = sha256(&candidate_bytes);
    let relative_path = format!("operations/{operation_id}/attempts/0001/outputs/candidate.pdf");
    let candidate_path = state.config.data_root.join(&relative_path);
    fs::create_dir_all(candidate_path.parent().expect("candidate parent"))
        .expect("create candidate parent");
    fs::write(&candidate_path, &candidate_bytes).expect("write candidate");

    let attempt = state
        .db
        .get_document_operation_attempt(&operation_id, 1)
        .expect("load attempt")
        .expect("attempt exists");
    let mut validating = attempt.state;
    validating.status = DocumentOperationStatus::Validating;
    validating.terminal_receipt_at = Some(now_iso());
    validating.candidate_pdf_sha256 = Some(candidate_sha.clone());
    validating.updated_at = now_iso();
    state
        .db
        .transition_document_operation(&validating, "preview_completed", "{}")
        .expect("transition to validating");
    let mut result_ready = validating;
    result_ready.status = DocumentOperationStatus::ResultReady;
    result_ready.updated_at = now_iso();
    state
        .db
        .publish_document_candidate(
            &DocumentVersionRecord {
                version_id: "version-public-candidate".to_string(),
                document_id: document_id.clone(),
                base_version_id: None,
                operation_id: operation_id.clone(),
                source_job_id: "source-public-candidate".to_string(),
                artifact_key: relative_path,
                content_sha256: candidate_sha,
                status: "candidate".to_string(),
                created_at: now_iso(),
                committed_at: None,
            },
            &result_ready,
        )
        .expect("publish candidate");

    let versions_uri = format!(
        "/api/v1/documents/{}/agent-versions?limit=1&offset=0",
        document_id
    );
    let versions = read_json(get(app.clone(), &versions_uri).await).await;
    assert_eq!(versions["data"]["total"], 1);
    assert_eq!(versions["data"]["limit"], 1);
    assert_eq!(versions["data"]["offset"], 0);
    assert_eq!(versions["data"]["has_more"], false);
    assert!(versions["data"]["active_version_id"].is_null());
    assert_eq!(versions["data"]["versions"][0]["status"], "candidate");
    assert_eq!(versions["data"]["versions"][0]["is_active"], false);
    assert_eq!(
        versions["data"]["versions"][0]["download_path"],
        format!("/api/v1/ai/operations/{operation_id}/candidate.pdf")
    );
    assert!(versions["data"]["versions"][0]["download_url"]
        .as_str()
        .is_some_and(|url| url.ends_with(&format!(
            "/api/v1/ai/operations/{operation_id}/candidate.pdf"
        ))));
    assert!(versions["data"]["versions"][0]
        .get("artifact_key")
        .is_none());

    let candidate_uri = format!("/api/v1/ai/operations/{operation_id}/candidate.pdf");
    let response = get(app.clone(), &candidate_uri).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get(header::CONTENT_TYPE),
        Some(&header::HeaderValue::from_static("application/pdf"))
    );
    assert!(response
        .headers()
        .get(header::CONTENT_DISPOSITION)
        .is_none());
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read candidate");
    assert_eq!(body.as_ref(), candidate_bytes);

    let commit_uri = format!("/api/v1/ai/operations/{operation_id}/commit");
    let commit_payload = action("result_ready", 1, "commit-public-candidate");
    let committed = post_json(app.clone(), &commit_uri, commit_payload.clone()).await;
    let committed_status = committed.status();
    let committed_body = read_json(committed).await;
    assert_eq!(committed_status, StatusCode::OK, "{committed_body}");
    assert_eq!(committed_body["data"]["status"], "committed");
    let versions = read_json(get(app.clone(), &versions_uri).await).await;
    assert_eq!(
        versions["data"]["active_version_id"],
        "version-public-candidate"
    );
    assert_eq!(versions["data"]["versions"][0]["status"], "committed");
    assert_eq!(versions["data"]["versions"][0]["is_active"], true);
    let replay = post_json(app.clone(), &commit_uri, commit_payload).await;
    assert_eq!(replay.status(), StatusCode::OK);

    fs::write(&candidate_path, b"tampered").expect("tamper candidate");
    let rejected = get(app, &candidate_uri).await;
    assert_eq!(rejected.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn public_cancel_requires_version_preconditions_and_is_idempotent() {
    let state = test_state("public-document-operation-cancel");
    let (document_id, conversation_id) = seed_document_and_conversation(&state, "e");
    let app = build_app(state);
    let operation_id = create_operation(
        app.clone(),
        &document_id,
        &conversation_id,
        "create-public-cancel",
    )
    .await;
    let uri = format!("/api/v1/ai/operations/{operation_id}/cancel");
    let mut payload = action("draft", 1, "cancel-public");
    payload["reason"] = json!("User rejected the plan");
    let cancelled = post_json(app.clone(), &uri, payload.clone()).await;
    let cancelled_status = cancelled.status();
    let cancelled_body = read_json(cancelled).await;
    assert_eq!(cancelled_status, StatusCode::OK, "{cancelled_body}");
    assert_eq!(cancelled_body["data"]["status"], "cancelled");
    assert!(cancelled_body["data"]["allowed_actions"]
        .as_array()
        .expect("allowed actions")
        .is_empty());
    let replay = post_json(app, &uri, payload).await;
    assert_eq!(replay.status(), StatusCode::OK);
}
