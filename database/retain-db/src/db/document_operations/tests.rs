use super::super::Db;
use super::*;
use crate::models::domain::{
    now_iso, DocumentOperationDispatchReceipt, DocumentOperationLimits,
    DOCUMENT_OPERATION_MANIFEST_SCHEMA, DOCUMENT_OPERATION_SCHEMA_VERSION,
    DOCUMENT_OPERATION_STATE_SCHEMA,
};

fn digest(character: char) -> String {
    std::iter::repeat_n(character, 64).collect()
}

fn test_db(name: &str) -> Db {
    let root = std::env::temp_dir().join(format!(
        "retain-document-operations-{name}-{}-{}",
        std::process::id(),
        fastrand::u64(..)
    ));
    let db = Db::new(root.join("retain.db"), root.clone());
    db.init().expect("init database");
    let conn = db.connect().expect("connect database");
    conn.execute(
        r#"
        INSERT INTO documents (
            document_id, title, source_filename, page_count, bytes,
            active_job_id, reading_status, added_at, updated_at
        ) VALUES ('document-a', 'Document', 'source.pdf', 1, 100,
                  'job-a', 'unread', '2026-08-23T00:00:00Z', '2026-08-23T00:00:00Z')
        "#,
        [],
    )
    .expect("seed document");
    db
}

fn manifest(operation_id: &str, dispatch_id: &str) -> DocumentOperationWorkspaceManifest {
    DocumentOperationWorkspaceManifest {
        schema: DOCUMENT_OPERATION_MANIFEST_SCHEMA.to_string(),
        schema_version: DOCUMENT_OPERATION_SCHEMA_VERSION,
        operation_id: operation_id.to_string(),
        attempt: 1,
        dispatch_id: dispatch_id.to_string(),
        document_id: "document-a".to_string(),
        base_job_id: "job-a".to_string(),
        conversation_id: String::new(),
        request_message_id: "message-a".to_string(),
        intent_summary: "Create a candidate".to_string(),
        source_pdf_sha256: digest('a'),
        normalized_document_sha256: Some(digest('b')),
        program_sha256: digest('c'),
        executor_profile: "deterministic_test_v1".to_string(),
        limits: DocumentOperationLimits {
            wall_time_seconds: 60,
            cpu_time_seconds: 45,
            memory_bytes: 512 * 1024 * 1024,
            scratch_bytes: 256 * 1024 * 1024,
            output_bytes: 128 * 1024 * 1024,
            process_count: 1,
            file_descriptor_count: 32,
            file_count: 16,
            stdout_bytes: 1024 * 1024,
            stderr_bytes: 1024 * 1024,
        },
        created_at: "2026-08-23T00:00:00Z".to_string(),
    }
}

fn draft(manifest: &DocumentOperationWorkspaceManifest) -> DocumentOperationWorkspaceState {
    DocumentOperationWorkspaceState {
        schema: DOCUMENT_OPERATION_STATE_SCHEMA.to_string(),
        schema_version: DOCUMENT_OPERATION_SCHEMA_VERSION,
        operation_id: manifest.operation_id.clone(),
        attempt: manifest.attempt,
        dispatch_id: manifest.dispatch_id.clone(),
        program_sha256: manifest.program_sha256.clone(),
        status: DocumentOperationStatus::Draft,
        dispatch_intent_at: None,
        dispatch_receipt: None,
        terminal_receipt_at: None,
        candidate_pdf_sha256: None,
        error_code: None,
        detail: None,
        updated_at: manifest.created_at.clone(),
    }
}

fn transition(
    db: &Db,
    state: &mut DocumentOperationWorkspaceState,
    status: DocumentOperationStatus,
    event: &str,
) {
    state.status = status;
    state.updated_at = now_iso();
    db.transition_document_operation(state, event, "{}")
        .expect("transition operation");
}

#[test]
fn unreceipted_dispatch_recovers_to_ambiguous_once() {
    let db = test_db("ambiguous");
    let manifest = manifest("op-ambiguous", "dispatch-ambiguous");
    let mut state = draft(&manifest);
    db.create_document_operation(&manifest, &state, None)
        .expect("create operation");
    transition(
        &db,
        &mut state,
        DocumentOperationStatus::AwaitingConfirmation,
        "confirmation_requested",
    );
    state.dispatch_intent_at = Some(now_iso());
    transition(
        &db,
        &mut state,
        DocumentOperationStatus::Queued,
        "dispatch_intent",
    );

    assert_eq!(
        db.recover_unreceipted_document_operations()
            .expect("recover operations"),
        vec!["op-ambiguous".to_string()]
    );
    assert!(db
        .recover_unreceipted_document_operations()
        .expect("second recovery")
        .is_empty());
    let operation = db
        .get_document_operation("op-ambiguous")
        .expect("load operation")
        .expect("operation exists");
    assert_eq!(operation.status, DocumentOperationStatus::Ambiguous);
    let events = db
        .list_document_operation_events("op-ambiguous")
        .expect("load events");
    assert_eq!(events.len(), 4);
    assert_eq!(
        events.last().expect("last event").event,
        "recovered_unreceipted_dispatch"
    );

    let mut retry_manifest = manifest.clone();
    retry_manifest.attempt = 2;
    retry_manifest.dispatch_id = "dispatch-retry".to_string();
    retry_manifest.created_at = now_iso();
    let retry_state = draft(&retry_manifest);
    assert!(db
        .create_next_document_operation_attempt(
            &retry_manifest,
            &retry_state,
            "retry-key-ambiguous",
            false,
        )
        .expect_err("ambiguous retry must require risk acceptance")
        .to_string()
        .contains("duplicate execution risk"));
    let mut changed_manifest = retry_manifest.clone();
    changed_manifest.source_pdf_sha256 = digest('f');
    let changed_state = draft(&changed_manifest);
    assert!(db
        .create_next_document_operation_attempt(
            &changed_manifest,
            &changed_state,
            "retry-key-changed",
            true,
        )
        .expect_err("retry must preserve immutable inputs")
        .to_string()
        .contains("immutable operation scope"));
    assert_eq!(
        db.create_next_document_operation_attempt(
            &retry_manifest,
            &retry_state,
            "retry-key-ambiguous",
            true,
        )
        .expect("create retry attempt"),
        CreateDocumentOperationAttemptResult::Created
    );
    assert_eq!(
        db.create_next_document_operation_attempt(
            &retry_manifest,
            &retry_state,
            "retry-key-ambiguous",
            true,
        )
        .expect("replay retry attempt"),
        CreateDocumentOperationAttemptResult::IdempotentReplay
    );
    assert_eq!(
        db.get_document_operation("op-ambiguous")
            .expect("load retried operation")
            .expect("retried operation exists")
            .current_attempt,
        2
    );
    assert_eq!(
        db.get_document_operation_attempt("op-ambiguous", 1)
            .expect("load first attempt")
            .expect("first attempt exists")
            .state
            .status,
        DocumentOperationStatus::Ambiguous
    );
    let events = db
        .list_document_operation_events("op-ambiguous")
        .expect("load retry events");
    let retry_payload: serde_json::Value =
        serde_json::from_str(&events.last().expect("retry event").payload_json)
            .expect("retry payload");
    assert_eq!(retry_payload["previous_attempt"], 1);
    assert_eq!(retry_payload["previous_status"], "ambiguous");
    assert_eq!(retry_payload["accepted_duplicate_risk"], true);
}

#[test]
fn retry_rejects_a_document_whose_active_base_changed() {
    let db = test_db("retry-stale-base");
    let manifest = manifest("op-retry-stale", "dispatch-retry-stale");
    let mut state = draft(&manifest);
    db.create_document_operation(&manifest, &state, None)
        .expect("create operation");
    transition(
        &db,
        &mut state,
        DocumentOperationStatus::AwaitingConfirmation,
        "confirmation_received",
    );
    state.dispatch_intent_at = Some(now_iso());
    transition(
        &db,
        &mut state,
        DocumentOperationStatus::Queued,
        "dispatch_intent",
    );
    transition(
        &db,
        &mut state,
        DocumentOperationStatus::Failed,
        "executor_failed",
    );
    db.connect()
        .expect("connect database")
        .execute(
            "UPDATE documents SET active_version_id = 'external-version' WHERE document_id = 'document-a'",
            [],
        )
        .expect("change active base");

    let mut retry_manifest = manifest.clone();
    retry_manifest.attempt = 2;
    retry_manifest.dispatch_id = "dispatch-retry-stale-next".to_string();
    retry_manifest.created_at = now_iso();
    let retry_state = draft(&retry_manifest);
    assert!(db
        .create_next_document_operation_attempt(
            &retry_manifest,
            &retry_state,
            "retry-key-stale-base",
            false,
        )
        .expect_err("stale base must reject retry")
        .to_string()
        .contains("base version is stale"));
    let operation = db
        .get_document_operation(&manifest.operation_id)
        .expect("load operation")
        .expect("operation exists");
    assert_eq!(operation.current_attempt, 1);
    assert_eq!(operation.status, DocumentOperationStatus::Failed);
}

#[test]
fn candidate_commit_uses_base_version_compare_and_swap() {
    let db = test_db("commit");
    let manifest = manifest("op-commit", "dispatch-commit");
    let mut state = draft(&manifest);
    db.create_document_operation(&manifest, &state, None)
        .expect("create operation");
    transition(
        &db,
        &mut state,
        DocumentOperationStatus::AwaitingConfirmation,
        "confirmation_requested",
    );
    state.dispatch_intent_at = Some(now_iso());
    transition(
        &db,
        &mut state,
        DocumentOperationStatus::Queued,
        "dispatch_intent",
    );
    state.dispatch_receipt = Some(DocumentOperationDispatchReceipt {
        dispatch_id: manifest.dispatch_id.clone(),
        run_id: "run-commit".to_string(),
        executor_profile_digest: digest('d'),
        accepted_at: now_iso(),
    });
    transition(
        &db,
        &mut state,
        DocumentOperationStatus::Running,
        "dispatch_receipt",
    );
    state.terminal_receipt_at = Some(now_iso());
    transition(
        &db,
        &mut state,
        DocumentOperationStatus::Validating,
        "execution_succeeded",
    );
    state.candidate_pdf_sha256 = Some(digest('e'));
    state.status = DocumentOperationStatus::ResultReady;
    state.updated_at = now_iso();
    db.publish_document_candidate(
        &DocumentVersionRecord {
            version_id: "version-a".to_string(),
            document_id: "document-a".to_string(),
            base_version_id: None,
            operation_id: manifest.operation_id.clone(),
            source_job_id: "job-result".to_string(),
            artifact_key: "candidate_pdf".to_string(),
            content_sha256: digest('e'),
            status: "candidate".to_string(),
            created_at: now_iso(),
            committed_at: None,
        },
        &state,
    )
    .expect("publish candidate");

    state.status = DocumentOperationStatus::Committed;
    state.updated_at = now_iso();
    let conn = db.connect().expect("connect database");
    conn.execute(
        "UPDATE documents SET active_version_id = 'external-version' WHERE document_id = 'document-a'",
        [],
    )
    .expect("simulate concurrent version commit");
    drop(conn);
    assert_eq!(
        db.commit_document_candidate(&state)
            .expect("detect stale candidate"),
        CommitDocumentCandidateResult::StaleBase
    );
    assert_eq!(
        db.get_document_operation("op-commit")
            .expect("load stale operation")
            .expect("stale operation exists")
            .status,
        DocumentOperationStatus::ResultReady
    );
    let conn = db.connect().expect("connect database");
    conn.execute(
        "UPDATE documents SET active_version_id = NULL WHERE document_id = 'document-a'",
        [],
    )
    .expect("restore expected base version");
    drop(conn);
    assert_eq!(
        db.commit_document_candidate(&state)
            .expect("commit candidate"),
        CommitDocumentCandidateResult::Committed
    );
    let conn = db.connect().expect("connect database");
    let active_version: Option<String> = conn
        .query_row(
            "SELECT active_version_id FROM documents WHERE document_id = 'document-a'",
            [],
            |row| row.get(0),
        )
        .expect("active version");
    assert_eq!(active_version.as_deref(), Some("version-a"));
}

#[test]
fn duplicate_dispatch_identity_is_rejected() {
    let db = test_db("duplicate-dispatch");
    let first = manifest("op-first", "dispatch-shared");
    db.create_document_operation(&first, &draft(&first), None)
        .expect("create first operation");
    let second = manifest("op-second", "dispatch-shared");
    assert!(db
        .create_document_operation(&second, &draft(&second), None)
        .is_err());
}

#[test]
fn conversation_operations_are_counted_and_stably_paginated() {
    let db = test_db("conversation-pagination");
    db.create_conversation("conversation-page", "", Some("document-a"))
        .expect("seed conversation");
    for operation_id in ["op-page-a", "op-page-c", "op-page-b"] {
        let mut operation = manifest(operation_id, &format!("dispatch-{operation_id}"));
        operation.conversation_id = "conversation-page".to_string();
        db.create_document_operation(&operation, &draft(&operation), None)
            .expect("create paginated operation");
    }

    assert_eq!(
        db.count_document_operations_for_conversation("conversation-page")
            .expect("count conversation operations"),
        3
    );
    let first_page = db
        .list_document_operations_for_conversation("conversation-page", 2, 0)
        .expect("list first page");
    assert_eq!(
        first_page
            .iter()
            .map(|operation| operation.operation_id.as_str())
            .collect::<Vec<_>>(),
        vec!["op-page-c", "op-page-b"]
    );
    let second_page = db
        .list_document_operations_for_conversation("conversation-page", 2, 2)
        .expect("list second page");
    assert_eq!(
        second_page
            .iter()
            .map(|operation| operation.operation_id.as_str())
            .collect::<Vec<_>>(),
        vec!["op-page-a"]
    );
}
