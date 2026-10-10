use std::path::PathBuf;

use super::*;
use crate::models::domain::{
    JobArtifacts, JobStatusKind, OcrProviderDiagnostics, OcrProviderKind, UploadRecord,
    WorkflowKind,
};
use crate::models::request::CreateJobInput;

struct TestDb {
    db: Db,
    root: PathBuf,
}

impl TestDb {
    fn new() -> Self {
        let root =
            std::env::temp_dir().join(format!("retain-library-selection-{}", fastrand::u64(..)));
        let db = Db::new(root.join("jobs.db"), root.clone());
        db.init().unwrap();
        Self { db, root }
    }

    fn conn(&self) -> rusqlite::Connection {
        rusqlite::Connection::open(self.root.join("jobs.db")).unwrap()
    }

    fn seed(&self, id: &str, workflow: WorkflowKind, provider: OcrProviderKind) {
        let mut job = JobSnapshot::new(
            id.into(),
            CreateJobInput {
                workflow,
                ..Default::default()
            },
            vec![],
        );
        job.updated_at = "2026-01-01T00:00:00Z".into();
        job.artifacts = Some(JobArtifacts {
            ocr_provider_diagnostics: Some(OcrProviderDiagnostics::new(provider)),
            ..Default::default()
        });
        self.db.save_job(&job).unwrap();
    }
}

impl Drop for TestDb {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn query(value: serde_json::Value) -> ListJobsQuery {
    serde_json::from_value(value).unwrap()
}

fn ids(jobs: &[JobSnapshot]) -> Vec<&str> {
    jobs.iter().map(|job| job.job_id.as_str()).collect()
}

#[test]
fn library_projection_uses_library_media_urls() {
    let data_root = PathBuf::from("/tmp/retainpdf-data");
    let mut job = JobSnapshot::new(
        "job-library-projection".into(),
        CreateJobInput::default(),
        vec![],
    );
    job.artifacts = Some(JobArtifacts {
        source_pdf: Some("jobs/job-library-projection/source/input.pdf".into()),
        ..JobArtifacts::default()
    });
    assert_eq!(
        library_image_url(&job, None, &data_root, "https://api.example", "cover").as_deref(),
        Some("https://api.example/api/v1/library/books/job-library-projection/cover"),
        "查不到书的编号：退回按任务的地址"
    );
    assert_eq!(
        library_image_url(&job, Some("doc-sha"), &data_root, "https://api.example", "thumbnail").as_deref(),
        Some("https://api.example/api/v1/documents/doc-sha/thumbnail"),
        "有书的编号：和文档列表同一个地址"
    );
}

#[test]
fn library_excludes_ocr_and_filters_provider_before_offset() {
    let test = TestDb::new();
    test.seed("5-ocr", WorkflowKind::Ocr, OcrProviderKind::Paddle);
    test.seed(
        "4-other-provider",
        WorkflowKind::Book,
        OcrProviderKind::Mineru,
    );
    test.seed("3-first", WorkflowKind::Translate, OcrProviderKind::Paddle);
    test.seed("2-second", WorkflowKind::Book, OcrProviderKind::Paddle);
    test.seed("1-third", WorkflowKind::Render, OcrProviderKind::Paddle);
    let query =
        query(serde_json::json!({"workflow":"ocr", "provider":"PaDdLe", "offset":1, "limit":1}));
    let jobs = list_books_filtered(&test.db, &query).unwrap();
    assert_eq!(ids(&jobs), ["2-second"]);
    let view =
        build_library_book_list_view(&test.db, &test.root, &query, "http://localhost").unwrap();
    assert_eq!(view.items.len(), 1);
    assert_eq!(view.items[0].job_id, "2-second");
}

#[test]
fn library_search_preserves_six_fields_ascii_case_and_literal_substrings() {
    let mut job = JobSnapshot::new("JobID".into(), CreateJobInput::default(), vec![]);
    job.stage = Some("OCR".into());
    job.stage_detail = Some("DETAIL".into());
    job.error = Some("50%_ERROR".into());
    job.request_payload.source.source_url = "https://example/ÜBER.PDF?token=VALUE#page=1".into();
    assert_eq!(
        library_search_text(&job, Some("  Upload.PDF  ")),
        "jobid ocr detail 50%_error https://example/Über.pdf?token=value#page=1 upload.pdf"
    );
    assert!(library_search_text(&job, None).ends_with(" Über.pdf"));
    assert!(library_search_text(&job, Some(" \t ")).ends_with(" Über.pdf"));
    assert!(!library_search_text(&job, None).contains("über.pdf"));
}

#[test]
fn library_search_uses_joined_upload_filename_and_match_before_pagination() {
    let test = TestDb::new();
    for id in ["4-no-match", "3-hit", "2-hit", "1-hit"] {
        test.seed(id, WorkflowKind::Book, OcrProviderKind::Local);
    }
    test.db
        .save_upload(&UploadRecord {
            upload_id: "upload-a".into(),
            filename: "  Rare 50%_Paper.pdf  ".into(),
            stored_path: "uploads/a.pdf".into(),
            bytes: 4,
            page_count: 1,
            uploaded_at: "2026-01-01".into(),
            developer_mode: false,
            content_hash: String::new(),
        })
        .unwrap();
    test.conn()
        .execute(
            "UPDATE jobs SET upload_id = 'upload-a' WHERE job_id LIKE '%-hit'",
            [],
        )
        .unwrap();
    let jobs = list_books_filtered(
        &test.db,
        &query(serde_json::json!({"q":"  RARE 50%_PAPER  ", "offset":1, "limit":1})),
    )
    .unwrap();
    assert_eq!(ids(&jobs), ["2-hit"]);
    let not_sql_wildcards =
        list_books_filtered(&test.db, &query(serde_json::json!({"q":"rare%paper"}))).unwrap();
    assert!(not_sql_wildcards.is_empty());
}

#[test]
fn library_search_and_id_mode_reach_the_ten_thousand_and_first_job() {
    let test = TestDb::new();
    let request = serde_json::to_string(
        &JobSnapshot::new("seed".into(), CreateJobInput::default(), vec![]).request_payload,
    )
    .unwrap();
    test.conn().execute(
        "WITH RECURSIVE n(value) AS (SELECT 1 UNION ALL SELECT value + 1 FROM n WHERE value < 10001) \
         INSERT INTO jobs (job_id, workflow, status_json, created_at, updated_at, command_json, request_json, log_tail_json) \
         SELECT printf('job-%05d', value), '\"book\"', '\"queued\"', '2026-01-01', '2026-01-01', '[]', ?1, '[]' FROM n",
        [request],
    ).unwrap();
    let jobs = list_books_filtered(
        &test.db,
        &query(serde_json::json!({"q":"job-00001", "limit":1})),
    )
    .unwrap();
    assert_eq!(ids(&jobs), ["job-00001"]);
    let jobs = list_books_filtered(&test.db, &query(serde_json::json!({"job_ids":" job-00001, job-00002, job-00001,missing ", "limit":1, "offset":u32::MAX}))).unwrap();
    assert_eq!(ids(&jobs), ["job-00002", "job-00001"]);
    let selected = list_books_filtered(&test.db, &query(serde_json::json!({"job_ids":"job-00001,job-00002", "q":"job-00001", "status":JobStatusKind::Queued}))).unwrap();
    assert_eq!(ids(&selected), ["job-00001"]);
    for (limit, expected) in [(0, 1), (500, 500), (501, 500), (u32::MAX, 500)] {
        assert_eq!(
            list_books_filtered(&test.db, &query(serde_json::json!({"limit":limit})))
                .unwrap()
                .len(),
            expected
        );
    }
}

#[test]
fn library_metadata_keeps_upload_artifact_and_summary_fallback_order() {
    let test = TestDb::new();
    let report_path = test.root.join("normalization.json");
    std::fs::write(
        &report_path,
        r#"{"validation":{"page_count":15},"defaults":{"pages_seen":17}}"#,
    )
    .unwrap();
    let mut job = JobSnapshot::new("metadata-job".into(), CreateJobInput::default(), vec![]);
    job.request_payload.source.source_url = "https://example/source.pdf?token=secret".into();
    job.artifacts = Some(JobArtifacts {
        pages_processed: Some(7),
        normalization_report_json: Some("normalization.json".into()),
        ..Default::default()
    });
    let upload = UploadRecord {
        upload_id: "upload-a".into(),
        filename: "  Uploaded.pdf  ".into(),
        stored_path: "uploads/a.pdf".into(),
        bytes: 4,
        page_count: 0,
        uploaded_at: "2026-01-01".into(),
        developer_mode: false,
        content_hash: String::new(),
    };
    let mut summaries = SummaryCache::default();
    let title = derive_display_name(Some(&upload), &job, &Default::default());
    let summary = build_book_summary(Some(&upload), &mut summaries, &job, &test.root, &title);
    assert_eq!(summary.title, "Uploaded.pdf");
    assert_eq!(summary.source_file_name.as_deref(), Some("Uploaded.pdf"));
    assert_eq!(summary.page_count, Some(0));
    assert_eq!(summary.file_size_bytes, Some(4));
    assert_eq!(summaries.read_attempts(), 0);

    assert_eq!(
        page_count_for_library(None, &mut summaries, &job, &test.root),
        Some(7)
    );
    assert_eq!(summaries.read_attempts(), 0);
    job.artifacts.as_mut().unwrap().pages_processed = None;
    assert_eq!(
        page_count_for_library(None, &mut summaries, &job, &test.root),
        Some(15)
    );
    assert_eq!(source_file_name(None, &job).as_deref(), Some("source.pdf"));

    std::fs::write(&report_path, r#"{"defaults":{"pages_seen":23}}"#).unwrap();
    job.job_id = "another-job-sharing-report".into();
    assert_eq!(
        page_count_for_library(None, &mut summaries, &job, &test.root),
        Some(15)
    );
    assert_eq!(summaries.read_attempts(), 1);
    let mut next_request = SummaryCache::default();
    assert_eq!(
        page_count_for_library(None, &mut next_request, &job, &test.root),
        Some(23)
    );
    assert_eq!(next_request.read_attempts(), 1);
}
