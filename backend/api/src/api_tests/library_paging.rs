//! 书库列表的分页规矩和不认识的字段（2026-10-22）：`GET /documents`、`/search`、
//! `/documents/:id/metadata-suggestions`、`/documents/:id/jobs` 回显 `limit`、给 `has_more`，
//! `limit` 越界 400；书和合集的请求体、查询参数不认识的字段 400。

use std::fs;

use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use super::jobs_common::{minimal_pdf_bytes, test_state};
use crate::app::build_app;
use crate::db::documents::sha256_hex;
use crate::models::api::FtsBlockRow;
use crate::models::domain::{now_iso, CreateJobInput, JobSnapshot, JobStatusKind, UploadRecord};

pub(super) fn seed_document(state: &crate::AppState, content: &[u8]) -> String {
    let hash = sha256_hex(content);
    let upload_id = format!("up-{hash:.8}");
    let absolute = state.config.data_root.join(format!("uploads/{upload_id}/paper.pdf"));
    fs::create_dir_all(absolute.parent().unwrap()).unwrap();
    fs::write(&absolute, minimal_pdf_bytes(200, 280)).unwrap();
    let upload = UploadRecord {
        upload_id,
        filename: "paper.pdf".to_string(),
        stored_path: absolute.to_string_lossy().to_string(),
        bytes: 10,
        page_count: 3,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: hash.clone(),
    };
    state.db.save_upload(&upload).unwrap();
    state.db.upsert_document_from_upload(&upload).unwrap();
    hash
}

fn seed_job_for_document(state: &crate::AppState, document_id: &str, job_id: &str, updated_at: &str) {
    let mut job = JobSnapshot::new(job_id.to_string(), CreateJobInput::default(), vec!["python".to_string()]);
    job.status = JobStatusKind::Succeeded;
    job.sync_runtime_state();
    state.db.save_job(&job).unwrap();
    let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).unwrap();
    conn.execute(
        "UPDATE jobs SET document_id = ?1, updated_at = ?2 WHERE job_id = ?3",
        rusqlite::params![document_id, updated_at, job_id],
    )
    .unwrap();
}

pub(super) async fn send(state: &crate::AppState, method: &str, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let mut request = Request::builder().method(method).uri(uri).header("X-API-Key", "test-key");
    let body = match body {
        Some(body) => {
            request = request.header("content-type", "application/json");
            Body::from(body.to_string())
        }
        None => Body::empty(),
    };
    let response = build_app(state.clone()).oneshot(request.body(body).unwrap()).await.unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let payload = serde_json::from_slice(&bytes)
        .unwrap_or_else(|_| panic!("{method} {uri}: body is not the JSON envelope: {}", String::from_utf8_lossy(&bytes)));
    (status, payload)
}

async fn get(state: &crate::AppState, uri: &str) -> (StatusCode, Value) {
    send(state, "GET", uri, None).await
}

/// 统一的 400 信封：`code` 40000、`error.code` BAD_REQUEST，`message` 包含 `needle`。
fn assert_bad_request(status: StatusCode, payload: &Value, needle: &str, what: &str) {
    assert_eq!(status, StatusCode::BAD_REQUEST, "{what}: {payload}");
    assert_eq!(payload["code"], 40000, "{what}: {payload}");
    assert_eq!(payload["error"]["code"], "BAD_REQUEST", "{what}: {payload}");
    let message = payload["message"].as_str().unwrap_or("");
    assert!(message.contains(needle), "{what}: message {message:?} should contain {needle:?}");
}

fn ids(payload: &Value, list: &str, key: &str) -> Vec<String> {
    payload["data"][list]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item[key].as_str().unwrap().to_string())
        .collect()
}

#[tokio::test]
async fn documents_list_echoes_limit_offset_and_has_more_with_a_stable_order() {
    let state = test_state("library-paging-documents");
    let mut seeded: Vec<String> = [b"paging-a".as_slice(), b"paging-b", b"paging-c", b"paging-d", b"paging-e"]
        .iter()
        .map(|c| seed_document(&state, c))
        .collect();
    // 同一秒入库（批量上传）：只按 added_at 排，跨页会重复或漏；第二键 document_id DESC。
    let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).unwrap();
    conn.execute("UPDATE item_files SET added_at = '2026-10-22T00:00:00Z'", []).unwrap();
    seeded.sort_by(|a, b| b.cmp(a));

    let (status, first) = get(&state, "/api/v1/documents?limit=2").await;
    assert_eq!(status, StatusCode::OK, "{first}");
    assert_eq!(first["data"]["limit"], 2);
    assert_eq!(first["data"]["offset"], 0);
    assert_eq!(first["data"]["total"], 5);
    assert_eq!(first["data"]["has_more"], true);

    let (_, second) = get(&state, "/api/v1/documents?limit=2&offset=2").await;
    assert_eq!(second["data"]["offset"], 2);
    assert_eq!(second["data"]["has_more"], true);

    let (_, last) = get(&state, "/api/v1/documents?limit=2&offset=4").await;
    assert_eq!(last["data"]["documents"].as_array().unwrap().len(), 1);
    assert_eq!(last["data"]["has_more"], false);

    let mut paged = ids(&first, "documents", "document_id");
    paged.extend(ids(&second, "documents", "document_id"));
    paged.extend(ids(&last, "documents", "document_id"));
    assert_eq!(paged, seeded, "pages must cover every document once, newest first then document_id DESC");

    // 没传 limit 就回显默认值；offset 超过总数是空页、has_more false。
    let (_, defaults) = get(&state, "/api/v1/documents").await;
    assert_eq!(defaults["data"]["limit"], 50);
    assert_eq!(defaults["data"]["has_more"], false);
    let (_, beyond) = get(&state, "/api/v1/documents?limit=2&offset=9").await;
    assert_eq!(beyond["data"]["documents"].as_array().unwrap().len(), 0);
    assert_eq!(beyond["data"]["has_more"], false);

    // 上限本身可以（前端合集页发 500）。
    let (status, _) = get(&state, "/api/v1/documents?limit=500").await;
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn documents_list_rejects_out_of_range_limit_and_unknown_params() {
    let state = test_state("library-paging-documents-400");
    seed_document(&state, b"paging-400");
    for uri in ["/api/v1/documents?limit=0", "/api/v1/documents?limit=501"] {
        let (status, payload) = get(&state, uri).await;
        assert_bad_request(status, &payload, "limit must be 1..=500", uri);
    }
    // 标签 2026-09-26 删了，`tag` 不再被悄悄忽略；查询串的拒绝也是统一信封，带字段名。
    let (status, payload) = get(&state, "/api/v1/documents?tag=chem").await;
    assert_bad_request(status, &payload, "unknown field `tag`", "tag");
    assert!(payload["message"].as_str().unwrap().ends_with("in the query string"), "{payload}");
}

#[tokio::test]
async fn documents_list_by_job_id_echoes_paging_fields() {
    let state = test_state("library-paging-documents-job-id");
    let document_id = seed_document(&state, b"paging-job-id");
    seed_job_for_document(&state, &document_id, "job-paging-lookup", "2026-10-22T00:00:00Z");

    let (status, hit) = get(&state, "/api/v1/documents?job_id=job-paging-lookup").await;
    assert_eq!(status, StatusCode::OK, "{hit}");
    assert_eq!(hit["data"]["documents"][0]["document_id"], document_id);
    assert_eq!(hit["data"]["total"], 1);
    assert_eq!(hit["data"]["limit"], 50);
    assert_eq!(hit["data"]["offset"], 0);
    assert_eq!(hit["data"]["has_more"], false);

    // 带 job_id 时其余参数不起作用（offset 不翻页、reading_status 不过滤），但 limit 照样校验。
    let (_, ignored) =
        get(&state, "/api/v1/documents?job_id=job-paging-lookup&limit=1&offset=5&reading_status=finished").await;
    assert_eq!(ignored["data"]["documents"][0]["document_id"], document_id);
    assert_eq!(ignored["data"]["limit"], 1);
    assert_eq!(ignored["data"]["offset"], 5);
    assert_eq!(ignored["data"]["has_more"], false);

    let (_, miss) = get(&state, "/api/v1/documents?job_id=missing-job").await;
    assert_eq!(miss["data"]["total"], 0);
    assert_eq!(miss["data"]["has_more"], false);

    let (status, payload) = get(&state, "/api/v1/documents?job_id=job-paging-lookup&limit=0").await;
    assert_bad_request(status, &payload, "limit must be 1..=500", "job_id with limit=0");
}

#[tokio::test]
async fn search_echoes_limit_and_has_more() {
    let state = test_state("library-paging-search");
    let document_id = seed_document(&state, b"paging-search");
    let rows: Vec<FtsBlockRow> = (0..3)
        .map(|page| FtsBlockRow {
            page_idx: page,
            block_id: format!("p00{page}-b0001"),
            source_text: format!("halogen lithium exchange page {page}"),
            translated_text: "卤素锂交换".to_string(),
        })
        .collect();
    state.db.replace_document_fts(&document_id, "job-search", &rows).unwrap();

    let (status, page) = get(&state, "/api/v1/search?q=halogen&limit=2").await;
    assert_eq!(status, StatusCode::OK, "{page}");
    assert_eq!(page["data"]["hits"].as_array().unwrap().len(), 2);
    assert_eq!(page["data"]["limit"], 2);
    assert_eq!(page["data"]["has_more"], true);

    let (_, all) = get(&state, "/api/v1/search?q=halogen&limit=3").await;
    assert_eq!(all["data"]["hits"].as_array().unwrap().len(), 3);
    assert_eq!(all["data"]["has_more"], false);

    let (_, defaults) = get(&state, "/api/v1/search?q=halogen").await;
    assert_eq!(defaults["data"]["limit"], 20);
    assert_eq!(defaults["data"]["has_more"], false);

    for uri in ["/api/v1/search?q=halogen&limit=0", "/api/v1/search?q=halogen&limit=101"] {
        let (status, payload) = get(&state, uri).await;
        assert_bad_request(status, &payload, "limit must be 1..=100", uri);
    }
    let (status, payload) = get(&state, "/api/v1/search?q=halogen&offset=1").await;
    assert_bad_request(status, &payload, "unknown field `offset`", "search offset");
}

#[tokio::test]
async fn metadata_suggestions_list_echoes_limit_and_has_more() {
    let state = test_state("library-paging-suggestions");
    let document_id = seed_document(&state, b"paging-suggestions");
    for n in 0..3 {
        state
            .db
            .insert_document_metadata_suggestion(
                &format!("dms-paging-{n}"),
                &document_id,
                None,
                &format!("sha-{n}"),
                r#"["title"]"#,
                "[]",
                "A Title",
                "test",
                false,
            )
            .unwrap();
    }
    let base = format!("/api/v1/documents/{document_id}/metadata-suggestions");

    let (status, page) = get(&state, &format!("{base}?limit=2")).await;
    assert_eq!(status, StatusCode::OK, "{page}");
    assert_eq!(page["data"]["suggestions"].as_array().unwrap().len(), 2);
    assert_eq!(page["data"]["limit"], 2);
    assert_eq!(page["data"]["has_more"], true);

    let (_, defaults) = get(&state, &base).await;
    assert_eq!(defaults["data"]["suggestions"].as_array().unwrap().len(), 3);
    assert_eq!(defaults["data"]["limit"], 20);
    assert_eq!(defaults["data"]["has_more"], false);

    for query in ["?limit=0", "?limit=101"] {
        let (status, payload) = get(&state, &format!("{base}{query}")).await;
        assert_bad_request(status, &payload, "limit must be 1..=100", query);
    }
    let (status, payload) = get(&state, &format!("{base}?offset=1")).await;
    assert_bad_request(status, &payload, "unknown field `offset`", "suggestions offset");
}

#[tokio::test]
async fn document_jobs_has_more_comes_from_the_extra_row_not_the_count() {
    let state = test_state("library-paging-document-jobs");
    let document_id = seed_document(&state, b"paging-document-jobs");
    seed_job_for_document(&state, &document_id, "job-doc-new", "2026-10-22T03:00:00Z");
    seed_job_for_document(&state, &document_id, "job-doc-mid", "2026-10-22T02:00:00Z");
    seed_job_for_document(&state, &document_id, "job-doc-bad", "2026-10-22T01:00:00Z");
    // 最旧的一条读不出来：列表跳过它，COUNT 照样算它。
    let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).unwrap();
    conn.execute("UPDATE jobs SET request_json = '{\"invalid\":true}' WHERE job_id = 'job-doc-bad'", [])
        .unwrap();
    let base = format!("/api/v1/documents/{document_id}/jobs");

    let (status, page) = get(&state, &format!("{base}?limit=2")).await;
    assert_eq!(status, StatusCode::OK, "{page}");
    assert_eq!(ids(&page, "items", "job_id"), vec!["job-doc-new", "job-doc-mid"]);
    assert_eq!(page["data"]["total"], 3, "total is still COUNT(*)");
    assert_eq!(page["data"]["has_more"], false, "the only row after this page is unreadable");

    let (_, first) = get(&state, &format!("{base}?limit=1")).await;
    assert_eq!(first["data"]["has_more"], true);

    let (status, payload) = get(&state, &format!("{base}?limit=0")).await;
    assert_bad_request(status, &payload, "limit must be 1..=500", "document jobs limit=0");
    let (status, payload) = get(&state, &format!("{base}?status=failed")).await;
    assert_bad_request(status, &payload, "unknown field `status`", "document jobs status");
}

#[tokio::test]
async fn library_request_bodies_and_delete_query_reject_unknown_fields() {
    let state = test_state("library-paging-unknown-bodies");
    let document_id = seed_document(&state, b"paging-unknown-bodies");
    state.db.create_collection("col-paging", "化学", None).unwrap();

    let cases = [
        ("PATCH", format!("/api/v1/documents/{document_id}"), json!({"title": "x", "tags": ["a"]}), "tags"),
        ("POST", "/api/v1/collections".to_string(), json!({"name": "物理", "color": "red"}), "color"),
        // 上级从来不能改：传了以前 200 但不生效，现在 400。
        ("PATCH", "/api/v1/collections/col-paging".to_string(), json!({"parent_id": "col-x"}), "parent_id"),
        (
            "POST",
            "/api/v1/collections/col-paging/documents".to_string(),
            json!({"document_ids": [document_id], "position": 1}),
            "position",
        ),
    ];
    for (method, uri, body, field) in cases {
        let (status, payload) = send(&state, method, &uri, Some(body)).await;
        assert_bad_request(status, &payload, &format!("unknown field `{field}`"), &format!("{method} {uri}"));
    }

    // 前端实际发的照旧能用。
    let (status, payload) =
        send(&state, "PATCH", "/api/v1/collections/col-paging", Some(json!({"name": "有机化学"}))).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let (status, payload) =
        send(&state, "PATCH", &format!("/api/v1/documents/{document_id}"), Some(json!({"title": "新书名"}))).await;
    assert_eq!(status, StatusCode::OK, "{payload}");

    // 删书拼错 force 以前当成不强删，现在 400，书还在。
    let (status, payload) = send(&state, "DELETE", &format!("/api/v1/documents/{document_id}?forse=true"), None).await;
    assert_bad_request(status, &payload, "unknown field `forse`", "delete document typo");
    assert!(state.db.get_document(&document_id).is_ok());
}
