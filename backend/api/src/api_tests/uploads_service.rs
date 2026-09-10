use crate::db::Db;
use crate::error::AppError;
use crate::services::uploads::{UploadService, UploadServiceConfig, UploadedPdfInput};
use crate::test_support::pdf::build_test_pdf_bytes;
use lopdf::{Document, Object};
use std::path::PathBuf;
use std::sync::Arc;

struct UploadTestConfig {
    data_root: PathBuf,
    uploads_dir: PathBuf,
    python_bin: String,
}
struct UploadTestState {
    db: Arc<Db>,
    config: UploadTestConfig,
}
impl Drop for UploadTestState {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.config.data_root);
    }
}
fn test_state(name: &str) -> UploadTestState {
    let data_root =
        std::env::temp_dir().join(format!("retain-upload-{name}-{}", fastrand::u64(..)));
    let uploads_dir = data_root.join("uploads");
    std::fs::create_dir_all(&uploads_dir).unwrap();
    UploadTestState {
        db: Arc::new(Db::new(data_root.join("db/jobs.db"), data_root.clone())),
        config: UploadTestConfig {
            data_root,
            uploads_dir,
            python_bin: "python".into(),
        },
    }
}

// Preserve the migrated cases' explicit per-call limits without constructing AppState.
async fn store_pdf_upload(
    db: &Db,
    uploads_dir: &std::path::Path,
    upload_max_bytes: u64,
    upload_max_pages: u32,
    python_bin: &str,
    input: UploadedPdfInput,
) -> Result<crate::models::domain::UploadRecord, AppError> {
    UploadService::new(
        Arc::new(db.clone()),
        UploadServiceConfig {
            uploads_dir: uploads_dir.to_path_buf(),
            python_bin: python_bin.into(),
            upload_max_bytes,
            upload_max_pages,
            processing: Default::default(),
        },
    )
    .store(input)
    .await
    .map_err(Into::into)
}

fn build_pdf_with_bad_xref_bytes() -> Vec<u8> {
    let mut bytes = build_test_pdf_bytes();
    let marker = b"startxref\n";
    let startxref_pos = bytes
        .windows(marker.len())
        .rposition(|window| window == marker)
        .expect("startxref marker");
    let value_start = startxref_pos + marker.len();
    let value_end = value_start
        + bytes[value_start..]
            .iter()
            .position(|byte| *byte == b'\n')
            .expect("startxref newline");
    let original_startxref = std::str::from_utf8(&bytes[value_start..value_end])
        .expect("utf8 startxref")
        .trim()
        .parse::<usize>()
        .expect("parse startxref");
    let replacement = format!(
        "{:0width$}",
        original_startxref.saturating_sub(4),
        width = value_end - value_start
    );
    bytes.splice(value_start..value_end, replacement.bytes());
    if bytes.ends_with(b"%%EOF\n") {
        bytes.truncate(bytes.len() - 2);
    }
    bytes
}

#[tokio::test]
async fn store_pdf_upload_rejects_non_pdf_filename() {
    let state = test_state("store-upload-non-pdf");
    let err = store_pdf_upload(
        state.db.as_ref(),
        &state.config.uploads_dir,
        0,
        0,
        &state.config.python_bin,
        UploadedPdfInput {
            filename: "notes.txt".to_string(),
            bytes: b"not a pdf".to_vec(),
            developer_mode: false,
        },
    )
    .await
    .expect_err("non-pdf filename should fail");
    match err {
        AppError::BadRequest(message) => {
            assert_eq!(message, "uploaded file must be a PDF")
        }
        other => panic!("unexpected error: {other:?}"),
    }
}

#[tokio::test]
async fn store_pdf_upload_rejects_oversize_before_creating_upload_directory() {
    let state = test_state("store-upload-oversize-before-write");
    let upload_bytes = build_test_pdf_bytes();
    let err = store_pdf_upload(
        state.db.as_ref(),
        &state.config.uploads_dir,
        8,
        0,
        &state.config.python_bin,
        UploadedPdfInput {
            filename: "oversize.pdf".to_string(),
            bytes: upload_bytes,
            developer_mode: false,
        },
    )
    .await
    .expect_err("oversize upload must fail before writing");
    match err {
        AppError::PayloadTooLarge(message) => {
            assert_eq!(message, "request body is too large")
        }
        other => panic!("unexpected error: {other:?}"),
    }

    let entries = std::fs::read_dir(&state.config.uploads_dir)
        .expect("read uploads directory")
        .collect::<Result<Vec<_>, _>>()
        .expect("list uploads directory");
    assert!(
        entries.is_empty(),
        "oversize upload created filesystem artifacts"
    );
}

#[tokio::test]
async fn store_pdf_upload_rejects_path_traversal_filename() {
    let state = test_state("store-upload-path-traversal");
    let upload = store_pdf_upload(
        state.db.as_ref(),
        &state.config.uploads_dir,
        0,
        0,
        &state.config.python_bin,
        UploadedPdfInput {
            filename: "../../../../tmp/evil.pdf".to_string(),
            bytes: build_test_pdf_bytes(),
            developer_mode: false,
        },
    )
    .await
    .expect("path traversal filename should still be stored safely");

    // The traversal segments must never make it onto disk: the file should
    // land inside the upload's own directory, named after the final
    // component only.
    assert!(upload.stored_path.ends_with("evil.pdf"));
    assert!(upload.stored_path.contains(&upload.upload_id));
    assert!(!upload.stored_path.contains(".."));
}

#[tokio::test]
async fn store_pdf_upload_rejects_absolute_path_filename() {
    let state = test_state("store-upload-absolute-path");
    let upload = store_pdf_upload(
        state.db.as_ref(),
        &state.config.uploads_dir,
        0,
        0,
        &state.config.python_bin,
        UploadedPdfInput {
            filename: "/etc/evil.pdf".to_string(),
            bytes: build_test_pdf_bytes(),
            developer_mode: false,
        },
    )
    .await
    .expect("absolute-path filename should still be stored safely");

    assert!(upload.stored_path.ends_with("evil.pdf"));
    assert!(upload.stored_path.contains(&upload.upload_id));
    assert_ne!(upload.stored_path, "/etc/evil.pdf");
}

#[tokio::test]
async fn store_pdf_upload_rejects_nul_byte_in_filename() {
    let state = test_state("store-upload-nul-byte");
    let err = store_pdf_upload(
        state.db.as_ref(),
        &state.config.uploads_dir,
        0,
        0,
        &state.config.python_bin,
        UploadedPdfInput {
            filename: "evil.pdf\0.pdf".to_string(),
            bytes: build_test_pdf_bytes(),
            developer_mode: false,
        },
    )
    .await
    .expect_err("a filename containing a NUL byte should be rejected");
    match err {
        AppError::BadRequest(_) => {}
        other => panic!("unexpected error: {other:?}"),
    }
}

#[tokio::test]
async fn store_pdf_upload_rejects_backslash_traversal_filename() {
    let state = test_state("store-upload-backslash-traversal");
    let err = store_pdf_upload(
        state.db.as_ref(),
        &state.config.uploads_dir,
        0,
        0,
        &state.config.python_bin,
        UploadedPdfInput {
            filename: "..\\..\\evil.pdf".to_string(),
            bytes: build_test_pdf_bytes(),
            developer_mode: false,
        },
    )
    .await
    .expect_err("a filename using backslash traversal should be rejected");
    match err {
        AppError::BadRequest(_) => {}
        other => panic!("unexpected error: {other:?}"),
    }
}

#[tokio::test]
async fn store_pdf_upload_repairs_bad_xref_pdf() {
    let state = test_state("store-upload-repair-bad-xref");
    let upload = store_pdf_upload(
        state.db.as_ref(),
        &state.config.uploads_dir,
        0,
        0,
        &state.config.python_bin,
        UploadedPdfInput {
            filename: "bad-xref.pdf".to_string(),
            bytes: build_pdf_with_bad_xref_bytes(),
            developer_mode: false,
        },
    )
    .await
    .expect("bad xref pdf should be repaired");

    assert_eq!(upload.page_count, 1);
    let repaired_doc = Document::load(&upload.stored_path).expect("repaired pdf is valid");
    assert_eq!(repaired_doc.get_pages().len(), 1);
}

#[tokio::test]
async fn store_pdf_upload_reclaims_files_on_invalid_pdf_and_database_failure() {
    let state = test_state("upload-failure-cleanup");
    let error = store_pdf_upload(
        state.db.as_ref(),
        &state.config.uploads_dir,
        0,
        0,
        "/synthetic-missing-python",
        UploadedPdfInput {
            filename: "broken.pdf".into(),
            bytes: b"not a pdf".to_vec(),
            developer_mode: false,
        },
    )
    .await
    .unwrap_err();
    assert!(matches!(error, AppError::ServiceUnavailable(_)));
    assert!(!error.to_string().contains("synthetic-missing"));
    assert_eq!(
        std::fs::read_dir(&state.config.uploads_dir)
            .unwrap()
            .count(),
        0
    );

    let invalid_db = Db::new(
        state.config.uploads_dir.clone(),
        state.config.data_root.clone(),
    );
    let error = store_pdf_upload(
        &invalid_db,
        &state.config.uploads_dir,
        0,
        0,
        &state.config.python_bin,
        UploadedPdfInput {
            filename: "valid.pdf".into(),
            bytes: build_test_pdf_bytes(),
            developer_mode: false,
        },
    )
    .await
    .unwrap_err();
    assert!(matches!(error, AppError::Internal(_)));
    assert_eq!(
        std::fs::read_dir(&state.config.uploads_dir)
            .unwrap()
            .count(),
        0
    );
}

#[tokio::test]
async fn store_pdf_upload_reclaims_files_when_page_limit_is_exceeded() {
    let state = test_state("upload-page-limit-cleanup");
    let mut doc = Document::load_mem(&build_test_pdf_bytes()).unwrap();
    let first = *doc.get_pages().values().next().unwrap();
    let parent = doc
        .get_object(first)
        .unwrap()
        .as_dict()
        .unwrap()
        .get(b"Parent")
        .unwrap()
        .as_reference()
        .unwrap();
    let second = doc.add_object(doc.get_object(first).unwrap().clone());
    let pages = doc.get_object_mut(parent).unwrap().as_dict_mut().unwrap();
    pages.set(
        "Kids",
        vec![Object::Reference(first), Object::Reference(second)],
    );
    pages.set("Count", 2);
    let mut bytes = Vec::new();
    doc.save_to(&mut bytes).unwrap();
    let error = store_pdf_upload(
        state.db.as_ref(),
        &state.config.uploads_dir,
        0,
        1,
        &state.config.python_bin,
        UploadedPdfInput {
            filename: "two.pdf".into(),
            bytes,
            developer_mode: false,
        },
    )
    .await
    .unwrap_err();
    assert!(matches!(error, AppError::BadRequest(_)));
    assert_eq!(
        std::fs::read_dir(&state.config.uploads_dir)
            .unwrap()
            .count(),
        0
    );
}
