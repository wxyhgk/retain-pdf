use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{minimal_pdf_bytes, read_json, test_state};
use crate::app::build_app;
use crate::db::DocumentVersionRecord;
use crate::models::domain::{now_iso, DocumentOperationStatus, UploadRecord};
use crate::services::document_operations::{
    canonical_program_sha256, DocumentOperationControl, RestrictedPageProgramExecutor,
};

fn digest(character: char) -> String {
    std::iter::repeat_n(character, 64).collect()
}

fn seed_document(state: &crate::AppState) -> String {
    let document_id = digest('a');
    let upload = UploadRecord {
        upload_id: "agent-upload".to_string(),
        filename: "agent-source.pdf".to_string(),
        stored_path: "uploads/agent-source.pdf".to_string(),
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
    document_id
}

fn create_payload(document_id: &str, idempotency_key: &str) -> Value {
    json!({
        "schema": "document_operation_create_v1",
        "idempotency_key": idempotency_key,
        "conversation_id": "",
        "request_message_id": "message-agent-a",
        "document_id": document_id,
        "intent_summary": "Build a candidate without executing model code",
        "program_sha256": digest('c')
    })
}

async fn post_json(app: axum::Router, uri: &str, payload: Value) -> axum::response::Response {
    app.oneshot(
        Request::builder()
            .method("POST")
            .uri(uri)
            .header("X-API-Key", "test-key")
            .header("content-type", "application/json")
            .body(Body::from(payload.to_string()))
            .expect("build agent operation request"),
    )
    .await
    .expect("agent operation response")
}

async fn get_json(app: axum::Router, uri: &str) -> axum::response::Response {
    app.oneshot(
        Request::builder()
            .uri(uri)
            .header("X-API-Key", "test-key")
            .body(Body::empty())
            .expect("build agent operation request"),
    )
    .await
    .expect("agent operation response")
}

fn real_executor_state(test_name: &str) -> crate::AppState {
    let state = test_state(test_name);
    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|path| path.parent())
        .expect("repository root")
        .to_path_buf();
    let mut config = (*state.config).clone();
    config.scripts_dir = repo_root.join("backend").join("pipeline");
    let python_candidates = [
        repo_root.join("backend/.venv/bin/python"),
        repo_root.join("backend/.venv/bin/python3"),
        repo_root.join("backend/.venv/Scripts/python.exe"),
        repo_root.join(".venv/bin/python"),
        repo_root.join(".venv/bin/python3"),
        repo_root.join(".venv/Scripts/python.exe"),
    ];
    config.python_bin = python_candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .map(|candidate| candidate.to_string_lossy().to_string())
        .unwrap_or_else(|| {
            if cfg!(windows) {
                "python".to_string()
            } else {
                "python3".to_string()
            }
        });
    crate::AppState {
        config: Arc::new(config),
        ..state
    }
}

fn seed_real_pdf(state: &crate::AppState) -> String {
    let bytes = minimal_pdf_bytes(320, 480);
    let document_id = Sha256::digest(&bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let stored_path = state.config.uploads_dir.join("agent-real-source.pdf");
    fs::write(&stored_path, &bytes).expect("write source PDF");
    let upload = UploadRecord {
        upload_id: "agent-real-upload".to_string(),
        filename: "agent-real-source.pdf".to_string(),
        stored_path: stored_path.to_string_lossy().to_string(),
        bytes: bytes.len() as u64,
        page_count: 1,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: document_id.clone(),
    };
    state.db.save_upload(&upload).expect("seed real upload");
    state
        .db
        .upsert_document_from_upload(&upload)
        .expect("seed real document");
    document_id
}

#[tokio::test]
async fn create_is_idempotent_and_rejects_key_reuse_with_changed_payload() {
    let state = test_state("agent-operation-create-idempotent");
    let document_id = seed_document(&state);
    let app = build_app(state.clone());
    let payload = create_payload(&document_id, "create-key-a");

    let first = post_json(
        app.clone(),
        "/api/v1/internal/agent/operations",
        payload.clone(),
    )
    .await;
    let first_status = first.status();
    let first_body = read_json(first).await;
    assert_eq!(first_status, StatusCode::OK, "{first_body}");
    let operation_id = first_body["data"]["operation_id"]
        .as_str()
        .expect("operation id")
        .to_string();
    assert_eq!(first_body["data"]["status"], "draft");
    assert_eq!(first_body["data"]["idempotent_replay"], false);

    let repeated = post_json(app.clone(), "/api/v1/internal/agent/operations", payload).await;
    assert_eq!(repeated.status(), StatusCode::OK);
    let repeated_body = read_json(repeated).await;
    assert_eq!(repeated_body["data"]["operation_id"], operation_id);
    assert_eq!(repeated_body["data"]["idempotent_replay"], true);
    assert_eq!(repeated_body["data"]["events"].as_array().unwrap().len(), 1);

    let mut changed = create_payload(&document_id, "create-key-a");
    changed["program_sha256"] = Value::String(digest('d'));
    let conflict = post_json(app, "/api/v1/internal/agent/operations", changed).await;
    assert_eq!(conflict.status(), StatusCode::CONFLICT);
    let conflict_body = read_json(conflict).await;
    assert!(conflict_body["message"]
        .as_str()
        .is_some_and(|message| message.contains("different create payload")));
}

#[tokio::test]
async fn create_rejects_executable_or_hash_mismatched_page_programs() {
    let state = real_executor_state("agent-operation-reject-invalid-program");
    let document_id = seed_real_pdf(&state);
    let app = build_app(state);

    let executable = json!({
        "schema": "retainpdf_page_program_v1",
        "steps": [{"op": "python", "code": "import os"}]
    });
    let rejected = post_json(
        app.clone(),
        "/api/v1/internal/agent/operations",
        json!({
            "schema": "document_operation_create_v1",
            "idempotency_key": "reject-executable-program",
            "conversation_id": "",
            "request_message_id": "message-reject-executable-program",
            "document_id": document_id,
            "intent_summary": "attempt executable input",
            "program_sha256": digest('f'),
            "program": executable
        }),
    )
    .await;
    let rejected_status = rejected.status();
    let rejected_body = read_json(rejected).await;
    assert_eq!(rejected_status, StatusCode::BAD_REQUEST, "{rejected_body}");
    assert!(rejected_body["message"]
        .as_str()
        .is_some_and(|message| message.contains("invalid document operation program")));

    let valid = json!({
        "schema": "retainpdf_page_program_v1",
        "steps": [{"op": "select_pages", "pages": [1]}]
    });
    let actual_sha = canonical_program_sha256(&valid).expect("canonical program hash");
    assert_ne!(actual_sha, digest('f'));
    let mismatched = post_json(
        app,
        "/api/v1/internal/agent/operations",
        json!({
            "schema": "document_operation_create_v1",
            "idempotency_key": "reject-program-hash-mismatch",
            "conversation_id": "",
            "request_message_id": "message-reject-program-hash-mismatch",
            "document_id": document_id,
            "intent_summary": "attempt hash mismatch",
            "program_sha256": digest('f'),
            "program": valid
        }),
    )
    .await;
    let mismatched_status = mismatched.status();
    let mismatched_body = read_json(mismatched).await;
    assert_eq!(
        mismatched_status,
        StatusCode::BAD_REQUEST,
        "{mismatched_body}"
    );
    assert!(mismatched_body["message"]
        .as_str()
        .is_some_and(|message| message.contains("program_sha256 does not match")));
}

#[tokio::test]
async fn run_requires_confirmation_and_repeat_does_not_redispatch() {
    let state = test_state("agent-operation-run-confirmation");
    let document_id = seed_document(&state);
    let app = build_app(state);
    let created = post_json(
        app.clone(),
        "/api/v1/internal/agent/operations",
        create_payload(&document_id, "create-key-run"),
    )
    .await;
    let created_body = read_json(created).await;
    let operation_id = created_body["data"]["operation_id"]
        .as_str()
        .expect("operation id");
    let run_uri = format!("/api/v1/internal/agent/operations/{operation_id}/run");

    let unconfirmed = post_json(
        app.clone(),
        &run_uri,
        json!({
            "schema": "document_operation_run_v1",
            "idempotency_key": "run-key-a",
            "confirmed": false
        }),
    )
    .await;
    assert_eq!(unconfirmed.status(), StatusCode::CONFLICT);

    let confirmed_payload = json!({
        "schema": "document_operation_run_v1",
        "idempotency_key": "run-key-a",
        "confirmed": true
    });
    let confirmed = post_json(app.clone(), &run_uri, confirmed_payload.clone()).await;
    let confirmed_status = confirmed.status();
    let confirmed_body = read_json(confirmed).await;
    assert_eq!(confirmed_status, StatusCode::OK, "{confirmed_body}");
    assert_eq!(confirmed_body["data"]["status"], "running");
    assert_eq!(
        confirmed_body["data"]["manifest"]["executor_profile"],
        "control_plane_preview_v1"
    );
    assert!(
        confirmed_body["data"]["state"]["dispatch_receipt"]["run_id"]
            .as_str()
            .is_some_and(|value| value.starts_with("preview-dispatch-"))
    );

    let repeated = post_json(app, &run_uri, confirmed_payload).await;
    assert_eq!(repeated.status(), StatusCode::OK);
    let repeated_body = read_json(repeated).await;
    assert_eq!(repeated_body["data"]["status"], "running");
    assert_eq!(repeated_body["data"]["idempotent_replay"], true);
    let event_names = repeated_body["data"]["events"]
        .as_array()
        .expect("events")
        .iter()
        .map(|event| event["event"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(
        event_names,
        vec![
            "created",
            "confirmation_received",
            "dispatch_intent",
            "dispatch_receipt"
        ]
    );
}

#[tokio::test]
async fn failed_retry_creates_one_new_attempt_and_lost_response_replays_it() {
    let state = test_state("agent-operation-failed-retry-idempotent");
    let document_id = seed_document(&state);
    let app = build_app(state.clone());
    let created = post_json(
        app.clone(),
        "/api/v1/internal/agent/operations",
        create_payload(&document_id, "create-key-failed-retry"),
    )
    .await;
    let created_body = read_json(created).await;
    let operation_id = created_body["data"]["operation_id"]
        .as_str()
        .expect("operation id")
        .to_string();
    let run_uri = format!("/api/v1/internal/agent/operations/{operation_id}/run");
    let initial_run = post_json(
        app.clone(),
        &run_uri,
        json!({
            "schema": "document_operation_run_v1",
            "idempotency_key": "run-key-before-failure",
            "confirmed": true
        }),
    )
    .await;
    assert_eq!(initial_run.status(), StatusCode::OK);

    let first = state
        .db
        .get_document_operation_attempt(&operation_id, 1)
        .expect("load first attempt")
        .expect("first attempt exists");
    let mut failed = first.state;
    failed.status = DocumentOperationStatus::Failed;
    failed.error_code = Some("executor_failed".to_string());
    failed.detail = Some("simulated terminal failure".to_string());
    failed.terminal_receipt_at = Some(now_iso());
    failed.updated_at = now_iso();
    state
        .db
        .transition_document_operation(&failed, "executor_failed", r#"{"simulated":true}"#)
        .expect("fail first attempt");

    let retry_payload = json!({
        "schema": "document_operation_run_v1",
        "idempotency_key": "retry-key-after-failure",
        "confirmed": true,
        "retry": true
    });
    let retried = post_json(app.clone(), &run_uri, retry_payload.clone()).await;
    let retried_status = retried.status();
    let retried_body = read_json(retried).await;
    assert_eq!(retried_status, StatusCode::OK, "{retried_body}");
    assert_eq!(retried_body["data"]["current_attempt"], 2);
    assert_eq!(retried_body["data"]["status"], "running");
    assert_ne!(
        retried_body["data"]["manifest"]["dispatch_id"],
        created_body["data"]["manifest"]["dispatch_id"]
    );
    assert_eq!(
        retried_body["data"]["manifest"]["program_sha256"],
        created_body["data"]["manifest"]["program_sha256"]
    );

    let second = state
        .db
        .get_document_operation_attempt(&operation_id, 2)
        .expect("load second attempt")
        .expect("second attempt exists");
    let mut second_failed = second.state;
    second_failed.status = DocumentOperationStatus::Failed;
    second_failed.error_code = Some("executor_failed_again".to_string());
    second_failed.terminal_receipt_at = Some(now_iso());
    second_failed.updated_at = now_iso();
    state
        .db
        .transition_document_operation(&second_failed, "executor_failed", "{}")
        .expect("fail second attempt");

    // Simulate a dropped response: the client repeats the exact confirmed
    // retry after the attempt has already reached a terminal state.
    let replayed = post_json(app.clone(), &run_uri, retry_payload).await;
    let replayed_status = replayed.status();
    let replayed_body = read_json(replayed).await;
    assert_eq!(replayed_status, StatusCode::OK, "{replayed_body}");
    assert_eq!(replayed_body["data"]["current_attempt"], 2);
    assert_eq!(replayed_body["data"]["status"], "failed");
    assert_eq!(replayed_body["data"]["idempotent_replay"], true);

    let next_retry = post_json(
        app,
        &run_uri,
        json!({
            "schema": "document_operation_run_v1",
            "idempotency_key": "retry-key-third-attempt",
            "confirmed": true,
            "retry": true
        }),
    )
    .await;
    let next_retry_status = next_retry.status();
    let next_retry_body = read_json(next_retry).await;
    assert_eq!(next_retry_status, StatusCode::OK, "{next_retry_body}");
    assert_eq!(next_retry_body["data"]["current_attempt"], 3);
    assert_eq!(
        state
            .db
            .get_document_operation_attempt(&operation_id, 1)
            .expect("load preserved first attempt")
            .expect("preserved first attempt")
            .state
            .status,
        DocumentOperationStatus::Failed
    );
}

#[tokio::test]
async fn ambiguous_retry_requires_duplicate_risk_acceptance_and_audits_it() {
    let state = test_state("agent-operation-ambiguous-retry-risk");
    let document_id = seed_document(&state);
    let app = build_app(state.clone());
    let created = post_json(
        app.clone(),
        "/api/v1/internal/agent/operations",
        create_payload(&document_id, "create-key-ambiguous-retry"),
    )
    .await;
    let created_body = read_json(created).await;
    let operation_id = created_body["data"]["operation_id"]
        .as_str()
        .expect("operation id")
        .to_string();
    let run_uri = format!("/api/v1/internal/agent/operations/{operation_id}/run");
    let run = post_json(
        app.clone(),
        &run_uri,
        json!({
            "schema": "document_operation_run_v1",
            "idempotency_key": "run-key-before-ambiguous",
            "confirmed": true
        }),
    )
    .await;
    assert_eq!(run.status(), StatusCode::OK);
    let first = state
        .db
        .get_document_operation_attempt(&operation_id, 1)
        .expect("load first attempt")
        .expect("first attempt exists");
    let mut ambiguous = first.state;
    ambiguous.status = DocumentOperationStatus::Ambiguous;
    ambiguous.error_code = Some("executor_state_unknown".to_string());
    ambiguous.detail = Some("dispatch outcome is unknown".to_string());
    ambiguous.updated_at = now_iso();
    state
        .db
        .transition_document_operation(&ambiguous, "executor_state_unknown", "{}")
        .expect("mark attempt ambiguous");

    let blocked = post_json(
        app.clone(),
        &run_uri,
        json!({
            "schema": "document_operation_run_v1",
            "idempotency_key": "retry-key-ambiguous",
            "confirmed": true,
            "retry": true
        }),
    )
    .await;
    let blocked_status = blocked.status();
    let blocked_body = read_json(blocked).await;
    assert_eq!(blocked_status, StatusCode::CONFLICT, "{blocked_body}");
    assert!(blocked_body["message"]
        .as_str()
        .is_some_and(|message| message.contains("accept_duplicate_risk")));

    let accepted = post_json(
        app,
        &run_uri,
        json!({
            "schema": "document_operation_run_v1",
            "idempotency_key": "retry-key-ambiguous",
            "confirmed": true,
            "retry": true,
            "accept_duplicate_risk": true
        }),
    )
    .await;
    let accepted_status = accepted.status();
    let accepted_body = read_json(accepted).await;
    assert_eq!(accepted_status, StatusCode::OK, "{accepted_body}");
    assert_eq!(accepted_body["data"]["current_attempt"], 2);
    let retry_event = accepted_body["data"]["events"]
        .as_array()
        .expect("events")
        .iter()
        .find(|event| event["event"] == "retry_attempt_created")
        .expect("retry event");
    assert_eq!(retry_event["payload"]["previous_status"], "ambiguous");
    assert_eq!(retry_event["payload"]["accepted_duplicate_risk"], true);
}

#[tokio::test]
async fn cancellation_is_idempotent_and_keeps_audit_events() {
    let state = test_state("agent-operation-cancel");
    let document_id = seed_document(&state);
    let app = build_app(state);
    let created = post_json(
        app.clone(),
        "/api/v1/internal/agent/operations",
        create_payload(&document_id, "create-key-cancel"),
    )
    .await;
    let created_body = read_json(created).await;
    let operation_id = created_body["data"]["operation_id"]
        .as_str()
        .expect("operation id");
    let cancel_uri = format!("/api/v1/internal/agent/operations/{operation_id}/cancel");
    let payload = json!({
        "schema": "document_operation_cancel_v1",
        "idempotency_key": "cancel-key-a",
        "reason": "user changed their mind"
    });

    let first = post_json(app.clone(), &cancel_uri, payload.clone()).await;
    assert_eq!(first.status(), StatusCode::OK);
    let first_body = read_json(first).await;
    assert_eq!(first_body["data"]["status"], "cancelled");
    assert_eq!(
        first_body["data"]["state"]["detail"],
        "user changed their mind"
    );

    let repeated = post_json(app, &cancel_uri, payload).await;
    assert_eq!(repeated.status(), StatusCode::OK);
    let repeated_body = read_json(repeated).await;
    assert_eq!(repeated_body["data"]["events"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn result_ready_candidate_commits_through_compare_and_swap_route() {
    let state = test_state("agent-operation-commit");
    let document_id = seed_document(&state);
    let app = build_app(state.clone());
    let created = post_json(
        app.clone(),
        "/api/v1/internal/agent/operations",
        create_payload(&document_id, "create-key-commit"),
    )
    .await;
    let created_body = read_json(created).await;
    let operation_id = created_body["data"]["operation_id"]
        .as_str()
        .expect("operation id")
        .to_string();
    let run_uri = format!("/api/v1/internal/agent/operations/{operation_id}/run");
    let run = post_json(
        app.clone(),
        &run_uri,
        json!({
            "schema": "document_operation_run_v1",
            "idempotency_key": "run-key-commit",
            "confirmed": true
        }),
    )
    .await;
    let run_status = run.status();
    let run_body = read_json(run).await;
    assert_eq!(run_status, StatusCode::OK, "{run_body}");

    let operation = state
        .db
        .get_document_operation(&operation_id)
        .expect("load operation")
        .expect("operation exists");
    let attempt = state
        .db
        .get_document_operation_attempt(&operation_id, operation.current_attempt)
        .expect("load attempt")
        .expect("attempt exists");
    let candidate_sha = digest('e');
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
                version_id: "version-agent-commit".to_string(),
                document_id,
                base_version_id: None,
                operation_id: operation_id.clone(),
                source_job_id: "source-agent".to_string(),
                artifact_key: "operations/candidate.pdf".to_string(),
                content_sha256: candidate_sha,
                status: "candidate".to_string(),
                created_at: now_iso(),
                committed_at: None,
            },
            &result_ready,
        )
        .expect("publish candidate");

    let commit_uri = format!("/api/v1/internal/agent/operations/{operation_id}/commit");
    let payload = json!({
        "schema": "document_operation_commit_v1",
        "idempotency_key": "commit-key-a"
    });
    let committed = post_json(app.clone(), &commit_uri, payload.clone()).await;
    assert_eq!(committed.status(), StatusCode::OK);
    let committed_body = read_json(committed).await;
    assert_eq!(committed_body["data"]["status"], "committed");
    assert_eq!(
        committed_body["data"]["candidate_version"]["status"],
        "committed"
    );

    let repeated = post_json(app, &commit_uri, payload).await;
    assert_eq!(repeated.status(), StatusCode::OK);
    let repeated_body = read_json(repeated).await;
    assert_eq!(repeated_body["data"]["idempotent_replay"], true);
}

#[tokio::test]
async fn restricted_page_program_produces_validates_and_commits_a_real_pdf() {
    let state = real_executor_state("agent-operation-real-executor");
    let document_id = seed_real_pdf(&state);
    let app = build_app(state.clone());
    let program = json!({
        "schema": "retainpdf_page_program_v1",
        "steps": [
            {"op": "select_pages", "pages": [1, 1]},
            {"op": "rotate_pages", "pages": [2], "degrees": 90}
        ]
    });
    let program_sha = canonical_program_sha256(&program).expect("canonical program hash");
    let created = post_json(
        app.clone(),
        "/api/v1/internal/agent/operations",
        json!({
            "schema": "document_operation_create_v1",
            "idempotency_key": "create-real-page-program",
            "conversation_id": "",
            "request_message_id": "message-real-page-program",
            "document_id": document_id,
            "intent_summary": "Duplicate the first page and rotate the copy",
            "program_sha256": program_sha,
            "program": program
        }),
    )
    .await;
    let created_status = created.status();
    let created_body = read_json(created).await;
    assert_eq!(created_status, StatusCode::OK, "{created_body}");
    assert_eq!(
        created_body["data"]["manifest"]["executor_profile"],
        "restricted_page_program_v1"
    );
    let operation_id = created_body["data"]["operation_id"]
        .as_str()
        .expect("operation id")
        .to_string();
    let run_uri = format!("/api/v1/internal/agent/operations/{operation_id}/run");
    let run = post_json(
        app.clone(),
        &run_uri,
        json!({
            "schema": "document_operation_run_v1",
            "idempotency_key": "run-real-page-program",
            "confirmed": true
        }),
    )
    .await;
    let run_status = run.status();
    let run_body = read_json(run).await;
    assert_eq!(run_status, StatusCode::OK, "{run_body}");

    // The worker and terminal result are filesystem-durable. Rebuild the API
    // state before polling to prove that completion does not depend on the
    // request task or the original in-memory AppState.
    drop(app);
    let restarted = crate::app::build_state(state.config.clone()).expect("restart API state");
    let app = build_app(restarted);
    let get_uri = format!("/api/v1/internal/agent/operations/{operation_id}");
    let mut ready = Value::Null;
    for _ in 0..50 {
        let response = get_json(app.clone(), &get_uri).await;
        assert_eq!(response.status(), StatusCode::OK);
        ready = read_json(response).await;
        if ready["data"]["status"] == "result_ready" {
            break;
        }
        if ready["data"]["status"] == "failed" {
            panic!("real executor failed: {ready}");
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    assert_eq!(ready["data"]["status"], "result_ready", "{ready}");
    let artifact_key = ready["data"]["candidate_version"]["artifact_key"]
        .as_str()
        .expect("candidate artifact");
    let candidate_path = state.config.data_root.join(artifact_key);
    let candidate = lopdf::Document::load(&candidate_path).expect("load real candidate PDF");
    assert_eq!(candidate.get_pages().len(), 2);
    let visual_report: Value = serde_json::from_slice(
        &fs::read(
            candidate_path
                .parent()
                .unwrap()
                .join("visual-validation.json"),
        )
        .expect("read visual validation"),
    )
    .expect("parse visual validation");
    assert_eq!(visual_report["schema"], "retainpdf_visual_validation_v1");
    assert_eq!(visual_report["valid"], true);
    assert_eq!(visual_report["rendered_page_count"], 2);
    assert_eq!(visual_report["mismatch_count"], 0);
    assert_eq!(
        visual_report["expected_pixels_sha256"],
        visual_report["candidate_pixels_sha256"]
    );
    let rust_validation: Value = serde_json::from_slice(
        &fs::read(candidate_path.parent().unwrap().join("validation.json"))
            .expect("read Rust validation"),
    )
    .expect("parse Rust validation");
    assert_eq!(
        rust_validation["schema"],
        "document_operation_validation_v2"
    );
    assert_eq!(rust_validation["visual_renderer"], "pymupdf");
    let second_page = candidate
        .get_object(*candidate.get_pages().get(&2).expect("second page"))
        .expect("page object")
        .as_dict()
        .expect("page dict");
    assert_eq!(
        second_page
            .get(b"Rotate")
            .expect("rotation")
            .as_i64()
            .expect("integer rotation"),
        90
    );

    let commit_uri = format!("/api/v1/internal/agent/operations/{operation_id}/commit");
    let committed = post_json(
        app.clone(),
        &commit_uri,
        json!({
            "schema": "document_operation_commit_v1",
            "idempotency_key": "commit-real-page-program"
        }),
    )
    .await;
    let committed_status = committed.status();
    let committed_body = read_json(committed).await;
    assert_eq!(committed_status, StatusCode::OK, "{committed_body}");
    assert_eq!(committed_body["data"]["status"], "committed");
    assert_eq!(
        state
            .db
            .get_active_document_version_id(&document_id)
            .expect("active version"),
        committed_body["data"]["candidate_version"]["version_id"]
            .as_str()
            .map(str::to_string)
    );
    let active_upload = state
        .db
        .find_upload_for_document(&document_id)
        .expect("find committed source")
        .expect("committed source exists");
    assert_eq!(PathBuf::from(active_upload.stored_path), candidate_path);
    assert_eq!(active_upload.page_count, 2);
    let document_response =
        get_json(app.clone(), &format!("/api/v1/documents/{document_id}")).await;
    assert_eq!(document_response.status(), StatusCode::OK);
    let document_body = read_json(document_response).await;
    assert_eq!(
        document_body["data"]["active_version_id"],
        committed_body["data"]["candidate_version"]["version_id"],
        "Reader must be able to distinguish the committed document source from the immutable job artifact"
    );

    let next_program = json!({
        "schema": "retainpdf_page_program_v1",
        "steps": [{"op": "select_pages", "pages": [2]}]
    });
    let next_program_sha =
        canonical_program_sha256(&next_program).expect("canonical next program hash");
    let next = post_json(
        app,
        "/api/v1/internal/agent/operations",
        json!({
            "schema": "document_operation_create_v1",
            "idempotency_key": "create-from-committed-version",
            "conversation_id": "",
            "request_message_id": "message-from-committed-version",
            "document_id": document_id,
            "intent_summary": "Use the committed candidate as the next immutable base",
            "program_sha256": next_program_sha,
            "program": next_program
        }),
    )
    .await;
    let next_status = next.status();
    let next_body = read_json(next).await;
    assert_eq!(next_status, StatusCode::OK, "{next_body}");
    assert_eq!(
        next_body["data"]["base_version_id"],
        committed_body["data"]["candidate_version"]["version_id"]
    );
    assert_eq!(
        next_body["data"]["manifest"]["source_pdf_sha256"],
        committed_body["data"]["candidate_version"]["content_sha256"]
    );
}

#[tokio::test]
async fn restricted_program_retry_reuses_immutable_inputs_and_survives_api_restart() {
    let state = real_executor_state("agent-operation-real-retry-restart");
    let document_id = seed_real_pdf(&state);
    let app = build_app(state.clone());
    let program = json!({
        "schema": "retainpdf_page_program_v1",
        "steps": [{"op": "rotate_pages", "pages": [1], "degrees": 180}]
    });
    let program_sha = canonical_program_sha256(&program).expect("canonical program hash");
    let created = post_json(
        app.clone(),
        "/api/v1/internal/agent/operations",
        json!({
            "schema": "document_operation_create_v1",
            "idempotency_key": "create-real-retry-restart",
            "conversation_id": "",
            "request_message_id": "message-real-retry-restart",
            "document_id": document_id,
            "intent_summary": "Retry the same immutable rotation program",
            "program_sha256": program_sha,
            "program": program
        }),
    )
    .await;
    let created_status = created.status();
    let created_body = read_json(created).await;
    assert_eq!(created_status, StatusCode::OK, "{created_body}");
    let operation_id = created_body["data"]["operation_id"]
        .as_str()
        .expect("operation id")
        .to_string();
    let first = state
        .db
        .get_document_operation_attempt(&operation_id, 1)
        .expect("load first attempt")
        .expect("first attempt exists");
    let mut queued = first.state;
    queued.status = DocumentOperationStatus::AwaitingConfirmation;
    queued.updated_at = now_iso();
    state
        .db
        .transition_document_operation(&queued, "confirmation_received", "{}")
        .expect("confirm first attempt");
    queued.status = DocumentOperationStatus::Queued;
    queued.dispatch_intent_at = Some(now_iso());
    queued.updated_at = now_iso();
    state
        .db
        .transition_document_operation(&queued, "dispatch_intent", "{}")
        .expect("queue first attempt");
    queued.status = DocumentOperationStatus::Failed;
    queued.error_code = Some("simulated_pre_worker_failure".to_string());
    queued.detail = Some("worker was never started".to_string());
    queued.updated_at = now_iso();
    state
        .db
        .transition_document_operation(&queued, "executor_failed", "{}")
        .expect("fail first attempt");

    let run_uri = format!("/api/v1/internal/agent/operations/{operation_id}/run");
    let retried = post_json(
        app.clone(),
        &run_uri,
        json!({
            "schema": "document_operation_run_v1",
            "idempotency_key": "retry-real-after-failure",
            "confirmed": true,
            "retry": true
        }),
    )
    .await;
    let retried_status = retried.status();
    let retried_body = read_json(retried).await;
    assert_eq!(retried_status, StatusCode::OK, "{retried_body}");
    assert_eq!(retried_body["data"]["current_attempt"], 2);
    assert_eq!(
        retried_body["data"]["manifest"]["source_pdf_sha256"],
        created_body["data"]["manifest"]["source_pdf_sha256"]
    );
    assert_eq!(
        retried_body["data"]["manifest"]["program_sha256"],
        created_body["data"]["manifest"]["program_sha256"]
    );
    let attempts_root = state
        .config
        .data_root
        .join("operations")
        .join(&operation_id)
        .join("attempts");
    let first_source = attempts_root.join("0001/source/source.pdf");
    let second_source = attempts_root.join("0002/source/source.pdf");
    let first_program = attempts_root.join("0001/program/program.json");
    let second_program = attempts_root.join("0002/program/program.json");
    assert_eq!(
        fs::read(&first_source).unwrap(),
        fs::read(&second_source).unwrap()
    );
    assert_eq!(
        fs::read(&first_program).unwrap(),
        fs::read(&second_program).unwrap()
    );

    // Lose the polling connection and rebuild API state while attempt 2 is
    // owned by the durable executor.
    drop(app);
    let restarted = crate::app::build_state(state.config.clone()).expect("restart API state");
    let app = build_app(restarted);
    let get_uri = format!("/api/v1/internal/agent/operations/{operation_id}");
    let mut ready = Value::Null;
    for _ in 0..50 {
        let response = get_json(app.clone(), &get_uri).await;
        assert_eq!(response.status(), StatusCode::OK);
        ready = read_json(response).await;
        if ready["data"]["status"] == "result_ready" {
            break;
        }
        if ready["data"]["status"] == "failed" {
            panic!("retried real executor failed: {ready}");
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    assert_eq!(ready["data"]["status"], "result_ready", "{ready}");
    assert_eq!(ready["data"]["current_attempt"], 2);
    assert_eq!(
        state
            .db
            .get_document_operation_attempt(&operation_id, 1)
            .expect("load preserved first attempt")
            .expect("preserved first attempt")
            .state
            .status,
        DocumentOperationStatus::Failed
    );
}

#[tokio::test]
async fn tampered_visual_validation_fails_closed_before_candidate_publication() {
    let state = real_executor_state("agent-operation-tampered-visual-validation");
    let document_id = seed_real_pdf(&state);
    let app = build_app(state.clone());
    let program = json!({
        "schema": "retainpdf_page_program_v1",
        "steps": [{"op": "select_pages", "pages": [1]}]
    });
    let program_sha = canonical_program_sha256(&program).expect("canonical program hash");
    let created = post_json(
        app.clone(),
        "/api/v1/internal/agent/operations",
        json!({
            "schema": "document_operation_create_v1",
            "idempotency_key": "create-tampered-visual-validation",
            "conversation_id": "",
            "request_message_id": "message-tampered-visual-validation",
            "document_id": document_id,
            "intent_summary": "prove visual validation identity is immutable",
            "program_sha256": program_sha,
            "program": program
        }),
    )
    .await;
    let created_status = created.status();
    let created_body = read_json(created).await;
    assert_eq!(created_status, StatusCode::OK, "{created_body}");
    let operation_id = created_body["data"]["operation_id"]
        .as_str()
        .expect("operation id")
        .to_string();
    // Dispatch through the same control plane without invoking the route's
    // eager refresh, so the test can mutate the durable artifact in the exact
    // worker-complete / Rust-validation-not-yet-started crash window.
    let executor = RestrictedPageProgramExecutor::new(
        &state.config.data_root,
        &state.config.pipeline_command,
    );
    let control = DocumentOperationControl::new(&state.db, &executor);
    control.confirm(&operation_id).expect("confirm operation");
    control.dispatch(&operation_id).expect("dispatch operation");

    let outputs = state
        .config
        .data_root
        .join("operations")
        .join(&operation_id)
        .join("attempts")
        .join("0001")
        .join("outputs");
    let terminal_path = outputs.join("executor-result.json");
    let visual_path = outputs.join("visual-validation.json");
    for _ in 0..50 {
        if terminal_path.is_file() && visual_path.is_file() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    assert!(terminal_path.is_file(), "executor terminal result missing");
    let mut tampered = fs::read(&visual_path).expect("read visual validation");
    tampered.push(b'\n');
    fs::write(&visual_path, tampered).expect("tamper visual validation identity");

    let response = get_json(
        app,
        &format!("/api/v1/internal/agent/operations/{operation_id}"),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    let body = read_json(response).await;
    assert_eq!(body["data"]["status"], "failed", "{body}");
    assert_eq!(
        body["data"]["state"]["error_code"],
        "candidate_validation_failed"
    );
    assert!(body["data"]["candidate_version"].is_null());
}
