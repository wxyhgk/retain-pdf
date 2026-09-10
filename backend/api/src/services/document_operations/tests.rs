use retain_core::models::domain::{
    now_iso, DocumentOperationLimits, DocumentOperationStatus, DocumentOperationWorkspaceManifest,
    DocumentOperationWorkspaceState, UploadRecord, DOCUMENT_OPERATION_MANIFEST_SCHEMA,
    DOCUMENT_OPERATION_SCHEMA_VERSION, DOCUMENT_OPERATION_STATE_SCHEMA,
};
use retain_data::db::Db;

use super::{
    DeterministicExecutor, DocumentOperationControl, DocumentOperationExecutor, ExecutorObservation,
};

fn digest(character: char) -> String {
    std::iter::repeat_n(character, 64).collect()
}

fn test_db(name: &str) -> Db {
    let root = std::env::temp_dir().join(format!(
        "retain-operation-control-{name}-{}-{}",
        std::process::id(),
        fastrand::u64(..)
    ));
    let db = Db::new(root.join("retain.db"), root.clone());
    db.init().expect("init database");
    let upload = UploadRecord {
        upload_id: "upload-a".to_string(),
        filename: "source.pdf".to_string(),
        stored_path: root
            .join("uploads/source.pdf")
            .to_string_lossy()
            .to_string(),
        bytes: 100,
        page_count: 1,
        uploaded_at: "2026-08-23T00:00:00Z".to_string(),
        developer_mode: false,
        content_hash: "document-a".to_string(),
    };
    db.save_upload(&upload).expect("save upload");
    db.upsert_document_from_upload(&upload)
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

fn create_confirmed(db: &Db, manifest: &DocumentOperationWorkspaceManifest) {
    let mut state = draft(manifest);
    db.create_document_operation(manifest, &state, None)
        .expect("create operation");
    state.status = DocumentOperationStatus::AwaitingConfirmation;
    state.updated_at = now_iso();
    db.transition_document_operation(&state, "confirmation_received", "{}")
        .expect("confirm operation");
}

#[test]
fn deterministic_executor_start_is_idempotent_for_dispatch_id() {
    let db = test_db("idempotent");
    let executor = DeterministicExecutor::default();
    let manifest = manifest("op-idempotent", "dispatch-idempotent");
    create_confirmed(&db, &manifest);

    DocumentOperationControl::new(&db, &executor)
        .dispatch(&manifest.operation_id)
        .expect("dispatch operation");
    let first = executor.start(&manifest).expect("repeat start");
    let second = executor.start(&manifest).expect("repeat start again");
    assert_eq!(first, second);
    assert_eq!(executor.created_runs(), 1);
    assert_eq!(executor.start_calls(), 3);

    let operation = db
        .get_document_operation(&manifest.operation_id)
        .expect("load operation")
        .expect("operation exists");
    assert_eq!(operation.status, DocumentOperationStatus::Running);
}

#[test]
fn reconcile_queries_executor_before_deciding_ambiguous() {
    let db = test_db("reconcile");
    let executor = DeterministicExecutor::default();
    let accepted = manifest("op-accepted", "dispatch-accepted");
    let completed = manifest("op-completed", "dispatch-completed");
    let missing = manifest("op-missing", "dispatch-missing");
    for item in [&accepted, &completed, &missing] {
        create_confirmed(&db, item);
        DocumentOperationControl::new(&db, &executor)
            .persist_dispatch_intent(&item.operation_id)
            .expect("persist dispatch intent");
    }

    executor.start(&accepted).expect("accept dispatch");
    executor
        .start(&completed)
        .expect("accept completed dispatch");
    executor.complete(&completed.dispatch_id, &digest('e'));

    let reconciled = DocumentOperationControl::new(&db, &executor)
        .reconcile_unreceipted()
        .expect("reconcile operations");
    assert_eq!(reconciled.len(), 3);
    assert_eq!(
        db.get_document_operation(&accepted.operation_id)
            .expect("load accepted")
            .expect("accepted exists")
            .status,
        DocumentOperationStatus::Running
    );
    let completed_operation = db
        .get_document_operation(&completed.operation_id)
        .expect("load completed")
        .expect("completed exists");
    assert_eq!(
        completed_operation.status,
        DocumentOperationStatus::Validating
    );
    let completed_attempt = db
        .get_document_operation_attempt(&completed.operation_id, 1)
        .expect("load completed attempt")
        .expect("completed attempt exists");
    assert_eq!(
        completed_attempt.state.candidate_pdf_sha256.as_deref(),
        Some(digest('e').as_str())
    );
    assert_eq!(
        db.get_document_operation(&missing.operation_id)
            .expect("load missing")
            .expect("missing exists")
            .status,
        DocumentOperationStatus::Ambiguous
    );
}

#[test]
fn p0_executor_explicitly_reports_that_it_does_not_run_model_code() {
    let executor = DeterministicExecutor::default();
    let report = executor.probe("deterministic_test_v1");
    assert!(report.available);
    assert!(!report.executes_model_code);
    assert_eq!(report.profile_digest.len(), 64);
}

#[test]
fn deterministic_executor_cancellation_is_idempotently_observable() {
    let executor = DeterministicExecutor::default();
    let manifest = manifest("op-cancel", "dispatch-cancel");
    let receipt = executor.start(&manifest).expect("start deterministic run");
    executor
        .cancel(&receipt.run_id, "test cancellation")
        .expect("cancel deterministic run");
    assert!(matches!(
        executor
            .inspect(&manifest.dispatch_id)
            .expect("inspect cancelled run"),
        ExecutorObservation::Cancelled { .. }
    ));
    executor
        .cancel(&receipt.run_id, "repeat cancellation")
        .expect("repeat cancellation");
}
