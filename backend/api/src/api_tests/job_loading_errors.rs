//! 按编号读任务出错时的状态码：没有这条记录是 404；有记录但读不出来（行解码失败……）是 500，
//! 不能说成「找不到」。一本书的任务列表遇到坏行跳过，不整个失败。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::db::documents::sha256_hex;
use crate::models::domain::{now_iso, UploadRecord};
use crate::models::{CreateJobInput, JobSnapshot};

async fn get(state: &crate::AppState, uri: &str) -> axum::response::Response {
    build_app(state.clone())
        .oneshot(Request::builder().uri(uri).header("X-API-Key", "test-key").body(Body::empty()).unwrap())
        .await
        .unwrap()
}

/// 插一条读不出来的任务行（request_json 对不上当前的类型）。
fn insert_malformed_job(state: &crate::AppState, job_id: &str, document_id: Option<&str>) {
    let conn = rusqlite::Connection::open(&state.config.jobs_db_path).unwrap();
    conn.execute(
        "INSERT INTO jobs (job_id, workflow, status, created_at, updated_at, command_json, request_json, \
         log_tail_json, document_id) VALUES (?1, 'book', 'succeeded', ?2, ?2, '[]', '{\"invalid\":true}', '[]', ?3)",
        rusqlite::params![job_id, now_iso(), document_id],
    )
    .unwrap();
}

#[tokio::test]
async fn an_unreadable_job_row_is_a_server_error_not_a_missing_job() {
    let state = test_state("job-loading-unreadable");
    insert_malformed_job(&state, "job-bad", None);

    let missing = get(&state, "/api/v1/jobs/job-nope").await;
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);
    for uri in ["/api/v1/jobs/job-bad", "/api/v1/jobs/job-bad/reports/quality", "/api/v1/jobs/job-bad/data/revisions"] {
        let response = get(&state, uri).await;
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR, "{uri}");
        let body = read_json(response).await.to_string();
        assert!(!body.contains("job not found"), "{uri}: {body}");
    }
}

#[tokio::test]
async fn a_book_job_list_skips_an_unreadable_row_instead_of_failing() {
    let state = test_state("job-loading-book-list");
    let bytes = b"%PDF-1.4 fake";
    let document_id = sha256_hex(bytes);
    let upload = UploadRecord {
        upload_id: "up-1".to_string(),
        filename: "book.pdf".to_string(),
        stored_path: state.config.data_root.join("uploads/up-1/book.pdf").to_string_lossy().into_owned(),
        bytes: bytes.len() as u64,
        page_count: 1,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: document_id.clone(),
    };
    state.db.save_upload(&upload).unwrap();
    state.db.upsert_document_from_upload(&upload).unwrap();
    state
        .db
        .save_job(&JobSnapshot::new("job-ok".to_string(), CreateJobInput::default(), vec![]))
        .unwrap();
    let conn = rusqlite::Connection::open(&state.config.jobs_db_path).unwrap();
    conn.execute("UPDATE jobs SET document_id = ?1 WHERE job_id = 'job-ok'", [&document_id]).unwrap();
    drop(conn);
    insert_malformed_job(&state, "job-bad", Some(&document_id));

    let response = get(&state, &format!("/api/v1/documents/{document_id}/jobs")).await;
    assert_eq!(response.status(), StatusCode::OK);
    let items = read_json(response).await["data"]["items"].clone();
    let ids: Vec<_> = items.as_array().unwrap().iter().map(|item| item["job_id"].as_str().unwrap().to_string()).collect();
    assert_eq!(ids, ["job-ok"]);

    assert_eq!(get(&state, "/api/v1/documents/doc-nope/jobs").await.status(), StatusCode::NOT_FOUND);
}
