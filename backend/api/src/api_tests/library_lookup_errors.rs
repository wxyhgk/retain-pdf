//! 书库按编号读书、读合集出错时的状态码（书库接口审计第一节 3、第二节「书不存在时用量给 200」）：
//! 没有这条记录是 404；有记录但读不出来（行解码失败、库被锁……）是 500，不能说成「书不存在」。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::db::documents::sha256_hex;
use crate::models::domain::now_iso;

async fn call(state: &crate::AppState, method: &str, uri: &str, body: Option<serde_json::Value>) -> axum::response::Response {
    let mut request = Request::builder().method(method).uri(uri).header("X-API-Key", "test-key");
    let body = match body {
        Some(body) => {
            request = request.header("content-type", "application/json");
            Body::from(body.to_string())
        }
        None => Body::empty(),
    };
    build_app(state.clone()).oneshot(request.body(body).unwrap()).await.unwrap()
}

/// 插一本读不出来的书：`page_count` 存成文本，解码成整数失败。
fn insert_malformed_document(state: &crate::AppState, document_id: &str) {
    let conn = rusqlite::Connection::open(&state.config.jobs_db_path).unwrap();
    conn.execute(
        "INSERT INTO documents (document_id, title, source_filename, page_count, added_at, updated_at) \
         VALUES (?1, 'bad', 'bad.pdf', 'not-a-number', ?2, ?2)",
        rusqlite::params![document_id, now_iso()],
    )
    .unwrap();
}

/// 插一个读不出来的合集：`sort_order` 存成文本。
fn insert_malformed_collection(state: &crate::AppState, collection_id: &str) {
    let conn = rusqlite::Connection::open(&state.config.jobs_db_path).unwrap();
    conn.execute(
        "INSERT INTO collections (collection_id, name, sort_order, created_at) VALUES (?1, 'bad', 'x', ?2)",
        rusqlite::params![collection_id, now_iso()],
    )
    .unwrap();
}

async fn assert_server_error(response: axum::response::Response, what: &str) {
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR, "{what}");
    let body = read_json(response).await.to_string();
    assert!(!body.contains("not found"), "{what}: {body}");
}

#[tokio::test]
async fn an_unreadable_document_row_is_a_server_error_not_a_missing_book() {
    let state = test_state("library-lookup-unreadable-document");
    let bad = sha256_hex(b"unreadable book");
    insert_malformed_document(&state, &bad);
    let created = read_json(call(&state, "POST", "/api/v1/collections", Some(serde_json::json!({ "name": "c" }))).await).await;
    let collection_id = created["data"]["collection_id"].as_str().unwrap().to_string();

    let cases: Vec<(&str, String, Option<serde_json::Value>)> = vec![
        ("GET", format!("/api/v1/documents/{bad}"), None),
        ("PATCH", format!("/api/v1/documents/{bad}"), Some(serde_json::json!({ "reading_status": "done" }))),
        ("DELETE", format!("/api/v1/documents/{bad}"), None),
        ("DELETE", format!("/api/v1/documents/{bad}?force=true"), None),
        ("GET", format!("/api/v1/documents/{bad}/files"), None),
        ("GET", format!("/api/v1/documents/{bad}/files/source.pdf"), None),
        ("GET", format!("/api/v1/documents/{bad}/reading"), None),
        ("GET", format!("/api/v1/documents/{bad}/translation-coverage"), None),
        ("GET", format!("/api/v1/documents/{bad}/metadata-suggestions"), None),
        ("POST", format!("/api/v1/documents/{bad}/metadata-suggestions"), Some(serde_json::json!({}))),
        ("GET", format!("/api/v1/documents/{bad}/usage"), None),
        ("GET", format!("/api/v1/documents?job_id=merged-{bad}-0123456789abcdef"), None),
        (
            "POST",
            format!("/api/v1/collections/{collection_id}/documents"),
            Some(serde_json::json!({ "document_ids": [bad] })),
        ),
    ];
    for (method, uri, body) in cases {
        assert_server_error(call(&state, method, &uri, body).await, &format!("{method} {uri}")).await;
    }
    // 书还在库里：读错不能顺手把它删了。
    let conn = rusqlite::Connection::open(&state.config.jobs_db_path).unwrap();
    let left: i64 = conn
        .query_row("SELECT COUNT(*) FROM documents WHERE document_id = ?1", [&bad], |row| row.get(0))
        .unwrap();
    assert_eq!(left, 1);
}

#[tokio::test]
async fn a_missing_book_is_still_a_plain_404() {
    let state = test_state("library-lookup-missing-document");
    let missing = sha256_hex(b"no such book");
    for (method, uri, body) in [
        ("GET", format!("/api/v1/documents/{missing}"), None),
        ("PATCH", format!("/api/v1/documents/{missing}"), Some(serde_json::json!({ "reading_status": "done" }))),
        // 改书名：书不在时标题状态表的外键不能先报错，变成 500。
        ("PATCH", format!("/api/v1/documents/{missing}"), Some(serde_json::json!({ "title": "新书名" }))),
        ("DELETE", format!("/api/v1/documents/{missing}"), None),
        ("DELETE", format!("/api/v1/documents/{missing}?force=true"), None),
        ("GET", format!("/api/v1/documents/{missing}/files/source.pdf"), None),
        ("GET", format!("/api/v1/documents/{missing}/usage"), None),
        ("GET", format!("/api/v1/documents/{missing}/files"), None),
        ("GET", format!("/api/v1/documents/{missing}/reading"), None),
        ("GET", format!("/api/v1/documents/{missing}/translation-coverage"), None),
        ("GET", format!("/api/v1/documents/{missing}/metadata-suggestions"), None),
    ] {
        let response = call(&state, method, &uri, body).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "{method} {uri}");
        let payload = read_json(response).await;
        assert_eq!(payload["error"]["details"], serde_json::json!({}), "{method} {uri}: {payload}");
    }
    // 合并结果的虚拟 id 指向一本不存在的书：列表照旧是空的，不报错。
    let response = call(&state, "GET", &format!("/api/v1/documents?job_id=merged-{missing}-0123456789abcdef"), None).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(read_json(response).await["data"]["total"], 0);
}

/// 书不存在时用量是普通 404（以前是 200 + 全零汇总），和任务的用量接口一致。
#[tokio::test]
async fn usage_of_a_missing_book_is_a_plain_404() {
    let state = test_state("library-lookup-usage-missing");
    let response = call(&state, "GET", "/api/v1/documents/doc-nope/usage", None).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let payload = read_json(response).await;
    assert_eq!(payload["error"]["details"], serde_json::json!({}), "{payload}");
    assert!(payload["message"].as_str().unwrap().contains("document not found"), "{payload}");
}

#[tokio::test]
async fn an_unreadable_collection_row_is_a_server_error_not_a_missing_collection() {
    let state = test_state("library-lookup-unreadable-collection");
    insert_malformed_collection(&state, "col-bad");

    let patch = Some(serde_json::json!({ "name": "renamed" }));
    assert_server_error(call(&state, "PATCH", "/api/v1/collections/col-bad", patch.clone()).await, "PATCH col-bad").await;
    let missing = call(&state, "PATCH", "/api/v1/collections/col-nope", patch).await;
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);
}
