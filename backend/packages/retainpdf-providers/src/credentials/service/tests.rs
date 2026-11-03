use std::sync::mpsc;
use std::time::Duration;

use serde_json::{json, Value};

use retainpdf_core::models::domain::JobSnapshot;
use retainpdf_core::models::request::CreateJobInput;

use super::*;

fn test_root(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "retainpdf-credential-{name}-{}-{:016x}",
        std::process::id(),
        fastrand::u64(..)
    ))
}

#[test]
fn managed_import_deduplicates_only_managed_credentials() {
    let data_root = test_root("managed-dedup");
    let secret = "ocr-managed-dedup-secret";
    let manual = create_credential(
        &data_root,
        CreateCredentialInput {
            kind: "ocr_provider_token".to_string(),
            provider: "paddle".to_string(),
            label: "User managed".to_string(),
            secret: secret.to_string(),
            expected_revision: Some(0),
        },
    )
    .expect("create manual credential");

    let imported = get_or_create_managed_credential(
        &data_root,
        "OCR_PROVIDER_TOKEN",
        " Paddle ",
        "Imported legacy OCR credential",
        secret,
    )
    .expect("import managed credential");
    assert_ne!(
        imported.credential.credential_ref, manual.credential.credential_ref,
        "a user-created credential must never be adopted by automatic lifecycle management"
    );
    assert_eq!(imported.credential.provider, "paddle");
    assert_eq!(imported.revision, 2);

    let reused = get_or_create_managed_credential(
        &data_root,
        "ocr_provider_token",
        "PADDLE",
        "A newer display label must not defeat secret deduplication",
        secret,
    )
    .expect("reuse managed credential");
    assert_eq!(
        reused.credential.credential_ref,
        imported.credential.credential_ref
    );
    assert_eq!(reused.revision, 2, "reuse must not rewrite the vault");

    let different_secret = get_or_create_managed_credential(
        &data_root,
        "ocr_provider_token",
        "paddle",
        "Imported legacy OCR credential",
        "ocr-managed-dedup-secret-2",
    )
    .expect("import different secret");
    assert_ne!(
        different_secret.credential.credential_ref,
        imported.credential.credential_ref
    );
    assert_eq!(different_secret.revision, 3);

    let listed = list_credentials(&data_root).expect("list credentials");
    let response = serde_json::to_string(&listed).expect("serialize metadata response");
    assert!(!response.contains(secret));
    assert!(!response.contains("managed_by"));
    assert_eq!(listed.credentials.len(), 3);

    let stored: Value = serde_json::from_slice(
        &fs::read(vault_path(&data_root)).expect("read persisted vault"),
    )
    .expect("decode persisted vault");
    assert!(stored["credentials"][&manual.credential.credential_ref]
        .get("managed_by")
        .is_none());
    assert_eq!(
        stored["credentials"][&imported.credential.credential_ref]["managed_by"],
        MANAGED_BY_LEGACY_JOB_IMPORT
    );
    let _ = fs::remove_dir_all(data_root);
}

#[test]
fn old_vault_without_managed_marker_remains_readable_and_is_not_reused() {
    let data_root = test_root("legacy-vault-compatibility");
    let directory = data_root.join("secrets");
    fs::create_dir_all(&directory).expect("create secret directory");
    let path = directory.join("credentials.json");
    fs::write(
        &path,
        json!({
            "schema": VAULT_SCHEMA,
            "revision": 7,
            "credentials": {
                "cred_legacy": {
                    "kind": "translation_api_key",
                    "provider": "deepseek",
                    "label": "Legacy record",
                    "secret": "legacy-secret",
                    "created_at": "before-managed-metadata",
                    "updated_at": "before-managed-metadata"
                }
            }
        })
        .to_string(),
    )
    .expect("write legacy vault");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .expect("secure legacy vault");
    }

    let listed = list_credentials(&data_root).expect("read legacy vault");
    assert_eq!(listed.revision, 7);
    assert_eq!(listed.credentials.len(), 1);
    let imported = get_or_create_managed_credential(
        &data_root,
        "translation_api_key",
        "deepseek",
        "Imported legacy translation credential",
        "legacy-secret",
    )
    .expect("create separately managed credential");
    assert_ne!(imported.credential.credential_ref, "cred_legacy");
    assert_eq!(imported.revision, 8);
    let _ = fs::remove_dir_all(data_root);
}

#[test]
fn managed_import_obeys_vault_capacity_but_can_reuse_when_full() {
    let data_root = test_root("managed-vault-capacity");
    let mut first: Option<(String, String)> = None;
    let mut full_at = None;
    for index in 0..64 {
        let prefix = format!("managed-capacity-{index:02}-");
        let secret = format!("{prefix}{}", "x".repeat(MAX_SECRET_BYTES - prefix.len()));
        match get_or_create_managed_credential(
            &data_root,
            "translation_api_key",
            "deepseek",
            "Imported legacy translation credential",
            &secret,
        ) {
            Ok(created) => {
                if first.is_none() {
                    first = Some((created.credential.credential_ref, secret));
                }
            }
            Err(AppError::BadRequest(message)) => {
                assert_eq!(message, "credential vault is full");
                full_at = Some(index);
                break;
            }
            Err(other) => panic!("unexpected capacity error: {other:?}"),
        }
    }
    assert!(full_at.is_some(), "the bounded vault must reject growth");

    let before_reuse = list_credentials(&data_root).expect("vault remains readable after full");
    let (first_ref, first_secret) = first.expect("at least one credential fits");
    let reused = get_or_create_managed_credential(
        &data_root,
        "translation_api_key",
        "DEEPSEEK",
        "Ignored replacement label",
        &first_secret,
    )
    .expect("deduplication does not need to grow a full vault");
    assert_eq!(reused.credential.credential_ref, first_ref);
    assert_eq!(reused.revision, before_reuse.revision);
    assert_eq!(
        list_credentials(&data_root)
            .expect("list after reuse")
            .credentials
            .len(),
        before_reuse.credentials.len()
    );
    let _ = fs::remove_dir_all(data_root);
}

#[test]
fn managed_gc_requires_managed_ownership_and_zero_references() {
    let data_root = test_root("managed-gc");
    let db = Db::new(data_root.join("db/jobs.db"), data_root.clone());
    db.init().expect("initialize jobs db");
    let imported = get_or_create_managed_credential(
        &data_root,
        "translation_api_key",
        "deepseek",
        "Imported legacy translation credential",
        "gc-managed-secret",
    )
    .expect("import managed credential");
    let managed_ref = imported.credential.credential_ref;
    let manual = create_credential(
        &data_root,
        CreateCredentialInput {
            kind: "translation_api_key".to_string(),
            provider: "deepseek".to_string(),
            label: "Manual credential".to_string(),
            secret: "gc-manual-secret".to_string(),
            expected_revision: Some(1),
        },
    )
    .expect("create manual credential");

    let mut input = CreateJobInput::default();
    input.translation.credential_ref = managed_ref.clone();
    db.save_job(&JobSnapshot::new(
        "job-managed-gc-reference".to_string(),
        input,
        vec!["python3".to_string()],
    ))
    .expect("persist managed reference");
    assert!(
        !delete_unreferenced_managed_credential(&db, &data_root, &managed_ref)
            .expect("retain referenced credential")
    );

    db.delete_job("job-managed-gc-reference")
        .expect("remove referencing job");
    assert!(
        delete_unreferenced_managed_credential(&db, &data_root, &managed_ref)
            .expect("delete unreferenced managed credential")
    );
    assert!(
        !delete_unreferenced_managed_credential(&db, &data_root, &managed_ref)
            .expect("missing credential is a no-op")
    );
    assert!(!delete_unreferenced_managed_credential(
        &db,
        &data_root,
        &manual.credential.credential_ref
    )
    .expect("manual credential is retained"));
    assert!(get_credential_metadata(&data_root, &manual.credential.credential_ref).is_ok());
    let _ = fs::remove_dir_all(data_root);
}

#[test]
fn explicit_update_transfers_managed_credential_to_user_ownership() {
    let data_root = test_root("managed-update-ownership");
    let db = Db::new(data_root.join("db/jobs.db"), data_root.clone());
    db.init().expect("initialize jobs db");
    let imported = get_or_create_managed_credential(
        &data_root,
        "ocr_provider_token",
        "paddle",
        "Imported legacy OCR credential",
        "managed-update-secret",
    )
    .expect("import managed credential");
    update_credential(
        &data_root,
        &imported.credential.credential_ref,
        UpdateCredentialInput {
            kind: None,
            provider: None,
            label: Some("Keep this credential".to_string()),
            secret: None,
            expected_revision: Some(1),
            expected_credential_revision: None,
        },
    )
    .expect("update imported credential");
    assert!(!delete_unreferenced_managed_credential(
        &db,
        &data_root,
        &imported.credential.credential_ref
    )
    .expect("updated credential is user-owned"));
    let _ = fs::remove_dir_all(data_root);
}

#[test]
fn record_revision_allows_unrelated_vault_changes_and_rejects_stale_target_updates() {
    let data_root = test_root("record-revision");
    let first = create_credential(
        &data_root,
        CreateCredentialInput {
            kind: "translation_api_key".to_string(),
            provider: "deepseek".to_string(),
            label: "Translation".to_string(),
            secret: "translation-secret".to_string(),
            expected_revision: Some(0),
        },
    )
    .expect("create target credential");
    assert_eq!(first.credential.revision, 1);

    get_or_create_managed_credential(
        &data_root,
        "ocr_provider_token",
        "paddle",
        "Imported OCR credential",
        "ocr-secret",
    )
    .expect("create unrelated credential");

    let updated = update_credential(
        &data_root,
        &first.credential.credential_ref,
        UpdateCredentialInput {
            kind: None,
            provider: None,
            label: Some("Translation updated".to_string()),
            secret: None,
            // Deliberately stale after the unrelated OCR import. A
            // per-record fence makes this update safe.
            expected_revision: Some(first.revision),
            expected_credential_revision: Some(first.credential.revision),
        },
    )
    .expect("update target after unrelated vault change");
    assert_eq!(updated.credential.revision, 2);

    let conflict = update_credential(
        &data_root,
        &first.credential.credential_ref,
        UpdateCredentialInput {
            kind: None,
            provider: None,
            label: Some("Stale overwrite".to_string()),
            secret: None,
            expected_revision: Some(updated.revision),
            expected_credential_revision: Some(first.credential.revision),
        },
    )
    .expect_err("stale target revision must be rejected");
    match conflict {
        AppError::CredentialReference { code, status, .. } => {
            assert_eq!(code, "CREDENTIAL_REVISION_CONFLICT");
            assert_eq!(status, StatusCode::CONFLICT);
        }
        other => panic!("unexpected error: {other}"),
    }
    let _ = fs::remove_dir_all(data_root);
}

#[test]
fn credential_reference_count_includes_translation_and_ocr_without_double_counting() {
    let data_root = std::env::temp_dir().join(format!(
        "retainpdf-credential-count-{}-{:016x}",
        std::process::id(),
        fastrand::u64(..)
    ));
    let db = Db::new(data_root.join("db/jobs.db"), data_root.clone());
    db.init().expect("initialize jobs db");

    let mut translation_input = CreateJobInput::default();
    translation_input.translation.credential_ref = "cred_shared".to_string();
    db.save_job(&JobSnapshot::new(
        "job-translation-reference".to_string(),
        translation_input,
        vec!["python3".to_string()],
    ))
    .expect("persist translation reference");

    let mut ocr_input = CreateJobInput::default();
    ocr_input.ocr.credential_ref = "cred_shared".to_string();
    db.save_job(&JobSnapshot::new(
        "job-ocr-reference".to_string(),
        ocr_input,
        vec!["python3".to_string()],
    ))
    .expect("persist OCR reference");

    let mut both_input = CreateJobInput::default();
    both_input.translation.credential_ref = "cred_shared".to_string();
    both_input.ocr.credential_ref = "cred_shared".to_string();
    db.save_job(&JobSnapshot::new(
        "job-both-references".to_string(),
        both_input,
        vec!["python3".to_string()],
    ))
    .expect("persist both references");

    assert_eq!(
        db.count_jobs_referencing_credential("cred_shared")
            .expect("count references"),
        3
    );
    let _ = std::fs::remove_dir_all(data_root);
}

#[test]
fn concurrent_job_persistence_fences_credential_deletion() {
    let data_root = std::env::temp_dir().join(format!(
        "retainpdf-credential-lifecycle-{}-{:016x}",
        std::process::id(),
        fastrand::u64(..)
    ));
    let db = Db::new(data_root.join("db/jobs.db"), data_root.clone());
    db.init().expect("initialize jobs db");
    let created = create_credential(
        &data_root,
        CreateCredentialInput {
            kind: "translation_api_key".to_string(),
            provider: "deepseek".to_string(),
            label: "lifecycle test".to_string(),
            secret: "sk-lifecycle-test".to_string(),
            expected_revision: Some(0),
        },
    )
    .expect("create credential");
    let credential_ref = created.credential.credential_ref;

    let usage_guard =
        acquire_credential_usage_lock(&data_root).expect("acquire credential usage lock");
    let deletion_db = db.clone();
    let deletion_root = data_root.clone();
    let deletion_ref = credential_ref.clone();
    let (started_tx, started_rx) = mpsc::channel();
    let (done_tx, done_rx) = mpsc::channel();
    let deletion = std::thread::spawn(move || {
        started_tx.send(()).expect("signal deletion start");
        let result =
            delete_credential(&deletion_db, &deletion_root, &deletion_ref, Some(1), false);
        done_tx.send(result).expect("return deletion result");
    });
    started_rx.recv().expect("deletion thread started");
    assert!(
        done_rx.recv_timeout(Duration::from_millis(50)).is_err(),
        "deletion must wait while task creation holds the usage lock"
    );

    let mut input = CreateJobInput::default();
    input.translation.credential_ref = credential_ref;
    db.save_job(&JobSnapshot::new(
        "job-created-during-delete".to_string(),
        input,
        vec!["python3".to_string()],
    ))
    .expect("persist job before releasing usage lock");
    drop(usage_guard);

    let result = done_rx
        .recv_timeout(Duration::from_secs(2))
        .expect("deletion finishes after usage lock release");
    match result {
        Err(AppError::CredentialReference { code, status, .. }) => {
            assert_eq!(code, "CREDENTIAL_IN_USE");
            assert_eq!(status, StatusCode::CONFLICT);
        }
        other => panic!("unexpected deletion result: {other:?}"),
    }
    deletion.join().expect("join deletion thread");
}
