use std::path::PathBuf;

use super::*;

fn test_root(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "retain-translation-checkpoint-{name}-{}-{}",
        std::process::id(),
        crate::models::domain::now_iso().replace([':', '.'], "-")
    ))
}

fn write_checkpoint(source_translated_dir: &Path, status: &str, page_path: &str) {
    std::fs::create_dir_all(source_translated_dir).expect("create source translated dir");
    std::fs::write(
        source_translated_dir.join(TRANSLATION_CHECKPOINT_FILE_NAME),
        serde_json::to_vec_pretty(&serde_json::json!({
            "schema": "translation_checkpoint_v1",
            "schema_version": 1,
            "status": status,
            "phase": "translating",
            "attempt_id": "source-job",
            "fingerprint": "fingerprint-a",
            "pages": [{"page_index": 0, "path": page_path}],
        }))
        .expect("checkpoint json"),
    )
    .expect("write checkpoint");
}

#[test]
fn imports_checkpoint_copy_on_write() {
    let root = test_root("copy-on-write");
    let source_paths = build_job_paths(&root, "source-job").expect("source paths");
    let target_paths = build_job_paths(&root, "target-job").expect("target paths");
    let page_name = "page-001-deepseek.json";
    std::fs::write(source_paths.translated_dir.join(page_name), b"[]")
        .expect("write source page");
    std::fs::write(
        source_paths.translated_dir.join(DOMAIN_CONTEXT_FILE_NAME),
        br#"{"domain":"chemistry","translation_guidance":"keep terminology stable"}"#,
    )
    .expect("write domain context");
    std::fs::write(
        source_paths.translated_dir.join(CONTINUATION_REVIEW_MEMO_FILE_NAME),
        br#"{"schema":"continuation_review_memo_v1","pairs":[]}"#,
    )
    .expect("write continuation review memo");
    std::fs::write(
        source_paths
            .translated_dir
            .join(TRANSLATION_REQUEST_JOURNAL_FILE_NAME),
        br#"{"schema":"translation_request_journal_v1","schema_version":1,"event":"dispatch","request_token":"token-a","request_key":"key-a"}
"#,
    )
    .expect("write request journal");
    write_checkpoint(&source_paths.translated_dir, "in_progress", page_name);

    let imported = import_translation_checkpoint_candidate(
        &root,
        "source-job",
        &JobStatusKind::Failed,
        &target_paths.translated_dir,
    )
    .expect("import checkpoint");

    assert!(imported);
    assert!(target_paths.translated_dir.join(page_name).is_file());
    assert!(target_paths
        .translated_dir
        .join(DOMAIN_CONTEXT_FILE_NAME)
        .is_file());
    assert!(target_paths
        .translated_dir
        .join(CONTINUATION_REVIEW_MEMO_FILE_NAME)
        .is_file());
    assert!(target_paths
        .translated_dir
        .join(TRANSLATION_REQUEST_JOURNAL_FILE_NAME)
        .is_file());
    assert!(target_paths
        .translated_dir
        .join(TRANSLATION_CHECKPOINT_FILE_NAME)
        .is_file());
    assert!(!target_paths
        .translated_dir
        .join(TRANSLATION_MANIFEST_FILE_NAME)
        .exists());
    assert!(!import_translation_checkpoint_candidate(
        &root,
        "source-job",
        &JobStatusKind::Failed,
        &target_paths.translated_dir,
    )
    .expect("do not overwrite target checkpoint"));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn imports_committed_snapshot_instead_of_uncommitted_working_page() {
    let root = test_root("committed-snapshot");
    let source_paths = build_job_paths(&root, "source-job").expect("source paths");
    let target_paths = build_job_paths(&root, "target-job").expect("target paths");
    let page_name = "page-001-deepseek.json";
    let snapshot_relative = Path::new(".translation-checkpoints")
        .join("generation-2")
        .join(page_name);
    let source_snapshot = source_paths.translated_dir.join(&snapshot_relative);
    std::fs::create_dir_all(source_snapshot.parent().expect("snapshot parent"))
        .expect("snapshot dir");
    std::fs::write(&source_snapshot, b"committed").expect("snapshot");
    std::fs::write(
        source_paths.translated_dir.join(page_name),
        b"uncommitted continuation metadata",
    )
    .expect("working page");
    std::fs::write(
        source_paths
            .translated_dir
            .join(TRANSLATION_CHECKPOINT_FILE_NAME),
        serde_json::to_vec_pretty(&serde_json::json!({
            "schema": "translation_checkpoint_v1",
            "schema_version": 1,
            "status": "in_progress",
            "phase": "preparing",
            "attempt_id": "source-job",
            "fingerprint": "fingerprint-a",
            "pages": [{
                "page_index": 0,
                "path": page_name,
                "page_hash": crate::job_runner::stage_contract::sha256_hex(b"committed"),
                "snapshot_path": snapshot_relative.to_string_lossy(),
            }],
        }))
        .expect("checkpoint json"),
    )
    .expect("checkpoint");

    assert!(import_translation_checkpoint_candidate(
        &root,
        "source-job",
        &JobStatusKind::Failed,
        &target_paths.translated_dir,
    )
    .expect("import committed snapshot"));

    assert_eq!(
        std::fs::read(target_paths.translated_dir.join(page_name)).expect("target page"),
        b"committed"
    );
    assert_eq!(
        std::fs::read(target_paths.translated_dir.join(snapshot_relative))
            .expect("target snapshot"),
        b"committed"
    );
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn complete_checkpoint_can_seed_failed_attempt_but_running_source_is_ignored() {
    let root = test_root("source-status");
    let source_paths = build_job_paths(&root, "source-job").expect("source paths");
    let target_paths = build_job_paths(&root, "target-job").expect("target paths");
    std::fs::write(
        source_paths.translated_dir.join("page-001-deepseek.json"),
        b"[]",
    )
    .expect("write source page");
    write_checkpoint(
        &source_paths.translated_dir,
        "complete",
        "page-001-deepseek.json",
    );

    assert!(import_translation_checkpoint_candidate(
        &root,
        "source-job",
        &JobStatusKind::Failed,
        &target_paths.translated_dir,
    )
    .expect("completed translation can seed a failed attempt retry"));
    assert!(!import_translation_checkpoint_candidate(
        &root,
        "source-job",
        &JobStatusKind::Running,
        &target_paths.translated_dir,
    )
    .expect("ignore running source"));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn imports_request_journal_without_checkpoint() {
    let root = test_root("journal-only");
    let source_paths = build_job_paths(&root, "source-job").expect("source paths");
    let target_paths = build_job_paths(&root, "target-job").expect("target paths");
    std::fs::write(
        source_paths
            .translated_dir
            .join(TRANSLATION_REQUEST_JOURNAL_FILE_NAME),
        br#"{"schema":"translation_request_journal_v1","schema_version":1,"event":"dispatch","request_token":"token-a","request_key":"key-a"}
"#,
    )
    .expect("write request journal");

    assert!(!import_translation_checkpoint_candidate(
        &root,
        "source-job",
        &JobStatusKind::Failed,
        &target_paths.translated_dir,
    )
    .expect("journal-only import has no checkpoint"));
    assert!(target_paths
        .translated_dir
        .join(TRANSLATION_REQUEST_JOURNAL_FILE_NAME)
        .is_file());

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn rejects_checkpoint_page_path_escape() {
    let root = test_root("path-escape");
    let source_paths = build_job_paths(&root, "source-job").expect("source paths");
    let target_paths = build_job_paths(&root, "target-job").expect("target paths");
    write_checkpoint(
        &source_paths.translated_dir,
        "in_progress",
        "../escape.json",
    );

    let error = import_translation_checkpoint_candidate(
        &root,
        "source-job",
        &JobStatusKind::Canceled,
        &target_paths.translated_dir,
    )
    .expect_err("reject path escape");
    assert!(error
        .to_string()
        .contains("unsafe translation checkpoint page path"));

    let _ = std::fs::remove_dir_all(root);
}
