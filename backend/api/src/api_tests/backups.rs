//! 备份接口:立即备份、列表、恢复(有任务在跑时不恢复)、删除。

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use serde_json::Value;
use tower::util::ServiceExt;

use super::jobs_common::{read_json, test_state};
use crate::app::build_app;

async fn call(state: &crate::AppState, method: &str, uri: &str) -> (StatusCode, Value) {
    let request = Request::builder()
        .method(method)
        .uri(uri)
        .header("X-API-Key", "test-key")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::empty())
        .expect("request");
    let response = build_app(state.clone()).oneshot(request).await.expect("response");
    let status = response.status();
    (status, read_json(response).await)
}

fn sql(state: &crate::AppState, statement: &str) {
    let conn = rusqlite::Connection::open(state.db.path()).expect("open db");
    conn.execute_batch(statement).expect("sql");
}

fn title(state: &crate::AppState) -> Option<String> {
    let conn = rusqlite::Connection::open(state.db.path()).expect("open db");
    conn.query_row("SELECT title FROM documents WHERE document_id = 'd1'", [], |row| row.get(0)).ok()
}

#[tokio::test]
async fn back_up_now_then_restore_brings_the_library_back_and_keeps_a_safety_copy() {
    let state = test_state("backup-restore");
    state.db.init().expect("init");
    let (status, body) = call(&state, "GET", "/api/v1/backups").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"]["items"].as_array().map(Vec::len), Some(0));
    assert_eq!(body["data"]["auto_interval_hours"], 24);

    sql(&state, "INSERT INTO documents(document_id, title, source_filename, added_at, updated_at) VALUES('d1', 'Before', 'a.pdf', 't', 't');");
    let (status, made) = call(&state, "POST", "/api/v1/backups").await;
    assert_eq!(status, StatusCode::OK, "{made}");
    assert_eq!(made["data"]["kind"], "manual");
    let id = made["data"]["id"].as_str().expect("id").to_string();
    sql(&state, "UPDATE documents SET title = 'After' WHERE document_id = 'd1';");

    // 有任务在跑:不恢复,说明在等什么。
    sql(&state, "INSERT INTO jobs(job_id, workflow, status_json, created_at, updated_at, command_json, request_json, log_tail_json)
                 VALUES('j1', '\"book\"', '\"running\"', 't', 't', '[]', '{}', '[]');");
    let (status, body) = call(&state, "POST", &format!("/api/v1/backups/{id}/restore")).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(body["message"].as_str().unwrap_or("").contains("任务"), "{body}");
    assert_eq!(title(&state).as_deref(), Some("After"));
    sql(&state, "UPDATE jobs SET status_json = '\"succeeded\"' WHERE job_id = 'j1';");

    let (status, body) = call(&state, "POST", &format!("/api/v1/backups/{id}/restore")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(title(&state).as_deref(), Some("Before"));
    assert_eq!(body["data"]["restored"], id.as_str());
    let safety = body["data"]["safety_backup"].as_str().expect("safety").to_string();
    assert!(safety.starts_with("before-restore-"), "{safety}");
    assert_eq!(body["data"]["status"]["items"].as_array().map(Vec::len), Some(2));

    // 恢复错了:用恢复前那份退回。
    let (status, _) = call(&state, "POST", &format!("/api/v1/backups/{safety}/restore")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(title(&state).as_deref(), Some("After"));

    let (status, _) = call(&state, "POST", "/api/v1/backups/manual-20200101T000000000Z-v1/restore").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, body) = call(&state, "DELETE", &format!("/api/v1/backups/{id}")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(body["data"]["items"].as_array().expect("items").iter().all(|b| b["id"] != id.as_str()));
    let (status, _) = call(&state, "DELETE", &format!("/api/v1/backups/{id}")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}
