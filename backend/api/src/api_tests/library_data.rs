use std::fs;
use std::sync::Arc;

use axum::body::to_bytes;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use super::jobs_common::{minimal_pdf_bytes, test_state};
use crate::app::build_app;
use crate::db::documents::sha256_hex;
use crate::models::api::FtsBlockRow;
use crate::models::domain::{
    now_iso, CreateJobInput, JobSnapshot, JobStatusKind, UploadRecord, WorkflowKind,
};

fn seed_document(state: &crate::AppState, content: &[u8]) -> String {
    let hash = sha256_hex(content);
    let upload_id = format!("up-{hash:.8}");
    let relative = format!("uploads/{upload_id}/paper.pdf");
    let absolute = state.config.data_root.join(&relative);
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).expect("upload dir");
    }
    // Prefer a tiny real PDF when content is not already PDF bytes so cover
    // rendering (PyMuPDF) and source download both work in integration tests.
    let file_bytes = if content.starts_with(b"%PDF") {
        content.to_vec()
    } else {
        minimal_pdf_bytes(200, 280)
    };
    fs::write(&absolute, &file_bytes).expect("write source pdf");
    let upload = UploadRecord {
        upload_id,
        filename: "光谱综述.pdf".to_string(),
        stored_path: absolute.to_string_lossy().to_string(),
        bytes: file_bytes.len() as u64,
        page_count: 12,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: hash.clone(),
    };
    state.db.save_upload(&upload).expect("save upload");
    state
        .db
        .upsert_document_from_upload(&upload)
        .expect("upsert document");
    hash
}

fn seed_succeeded_job_for_document(state: &crate::AppState, document_id: &str, job_id: &str) {
    let mut job = JobSnapshot::new(
        job_id.to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Succeeded;
    job.sync_runtime_state();
    state.db.save_job(&job).expect("save job");
    let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).expect("open db");
    conn.execute(
        "UPDATE jobs SET document_id = ?1 WHERE job_id = ?2",
        rusqlite::params![document_id, job_id],
    )
    .expect("link job to document");
}

fn seed_reusable_ocr_job(state: &crate::AppState, document_id: &str, job_id: &str) -> String {
    let upload = state
        .db
        .find_upload_for_document(document_id)
        .expect("find document upload")
        .expect("document upload exists");
    let root = state.config.output_root.join(job_id);
    let source_pdf = root.join("source/input.pdf");
    let normalized = root.join("ocr/normalized/document.v1.json");
    let layout = root.join("ocr/layout.json");
    fs::create_dir_all(source_pdf.parent().expect("source parent")).expect("source dir");
    fs::create_dir_all(normalized.parent().expect("normalized parent")).expect("normalized dir");
    fs::create_dir_all(layout.parent().expect("layout parent")).expect("layout dir");
    fs::write(&source_pdf, minimal_pdf_bytes(200, 280)).expect("source pdf");
    fs::write(
        &normalized,
        br#"{
            "schema":"document.v1",
            "pages":[{
                "page_index":0,
                "blocks":[{
                    "block_id":"p001-b0001",
                    "text":"Retaining Scientific PDF Layout",
                    "content":{"kind":"text","text":"Retaining Scientific PDF Layout"},
                    "layout_role":"title",
                    "semantic_role":"unknown",
                    "structure_role":"document_title",
                    "sub_type":"title"
                }]
            }]
        }"#,
    )
    .expect("normalized document");
    fs::write(&layout, br#"{"layoutParsingResults":[]}"#).expect("layout document");

    let mut input = CreateJobInput::default();
    input.workflow = WorkflowKind::Ocr;
    input.source.upload_id = upload.upload_id;
    input.runtime.job_id = job_id.to_string();
    input.ocr.provider = "paddle".to_string();
    let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["ocr".to_string()]);
    job.status = JobStatusKind::Succeeded;
    job.finished_at = Some(now_iso());
    if let Some(artifacts) = job.artifacts.as_mut() {
        artifacts.source_pdf = Some(source_pdf.to_string_lossy().to_string());
        artifacts.normalized_document_json = Some(normalized.to_string_lossy().to_string());
        artifacts.layout_json = Some(layout.to_string_lossy().to_string());
        artifacts.ocr_page_numbers = (1..=12).collect();
        artifacts.pages_processed = Some(12);
    }
    job.sync_runtime_state();
    state.db.save_job(&job).expect("save reusable OCR job");
    job_id.to_string()
}

async fn json_response(response: axum::response::Response) -> serde_json::Value {
    let bytes = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    serde_json::from_slice(&bytes).expect("parse json")
}

#[tokio::test]
async fn documents_list_and_patch_roundtrip() {
    let state = test_state("library-documents");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"doc one");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("list response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["total"], 1);
    assert_eq!(payload["data"]["documents"][0]["document_id"], document_id);
    assert_eq!(
        payload["data"]["documents"][0]["source_pdf_url"],
        format!("http://127.0.0.1:41000/api/v1/documents/{document_id}/source.pdf")
    );
    assert_eq!(
        payload["data"]["documents"][0]["cover_url"],
        format!("http://127.0.0.1:41000/api/v1/documents/{document_id}/cover")
    );
    assert_eq!(
        payload["data"]["documents"][0]["thumbnail_url"],
        format!("http://127.0.0.1:41000/api/v1/documents/{document_id}/thumbnail")
    );

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/v1/documents/{document_id}"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "reading_status": "reading",
                        "tags": ["化学", "光谱"]
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("patch response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["reading_status"], "reading");
    assert!(payload["data"]["source_pdf_url"]
        .as_str()
        .unwrap_or("")
        .contains("/source.pdf"));

    // 非法状态被拒绝
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/v1/documents/{document_id}"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({"reading_status": "nonsense"}).to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("bad patch response");
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn metadata_suggestion_is_durable_and_can_auto_apply_default_title() {
    let state = test_state("library-metadata-suggestion-apply");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"metadata suggestion apply");
    let job_id = seed_reusable_ocr_job(&state, &document_id, "ocr-metadata-title");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/documents/{document_id}/metadata-suggestions"
                ))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "job_id": job_id,
                        "fields": ["title"],
                        "apply_if_default": true
                    })
                    .to_string(),
                ))
                .expect("metadata suggestion request"),
        )
        .await
        .expect("metadata suggestion response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(
        payload["data"]["selected_title"],
        "Retaining Scientific PDF Layout"
    );
    assert_eq!(payload["data"]["source_job_id"], "ocr-metadata-title");
    assert_eq!(payload["data"]["generation_method"], "ocr_structure");
    assert_eq!(payload["data"]["applied"], true);
    assert_eq!(payload["data"]["can_apply"], true);
    assert_eq!(payload["data"]["title_candidates"][0]["confidence"], 0.99);

    let document = state.db.get_document(&document_id).expect("load document");
    assert_eq!(document.title, "Retaining Scientific PDF Layout");
    assert_eq!(document.title_source, "ocr");
    assert!(!document.title_locked);

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/api/v1/documents/{document_id}/metadata-suggestions"
                ))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("list metadata suggestions request"),
        )
        .await
        .expect("list metadata suggestions response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["suggestions"].as_array().unwrap().len(), 1);
    assert_eq!(payload["data"]["suggestions"][0]["status"], "applied");
}

#[tokio::test]
async fn metadata_suggestion_never_overwrites_user_title() {
    let state = test_state("library-metadata-suggestion-user-lock");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"metadata suggestion user lock");
    let job_id = seed_reusable_ocr_job(&state, &document_id, "ocr-user-lock-title");

    let patch = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/v1/documents/{document_id}"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"title":"用户确定的标题"}"#))
                .expect("patch title request"),
        )
        .await
        .expect("patch title response");
    assert_eq!(patch.status(), StatusCode::OK);
    let patch = json_response(patch).await;
    assert_eq!(patch["data"]["title_source"], "user");
    assert_eq!(patch["data"]["title_locked"], true);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/documents/{document_id}/metadata-suggestions"
                ))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "job_id": job_id,
                        "apply_if_default": true
                    })
                    .to_string(),
                ))
                .expect("metadata suggestion request"),
        )
        .await
        .expect("metadata suggestion response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["applied"], false);
    assert_eq!(payload["data"]["can_apply"], false);
    let suggestion_id = payload["data"]["suggestion_id"]
        .as_str()
        .expect("suggestion id")
        .to_string();

    let apply = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/documents/{document_id}/metadata-suggestions/{suggestion_id}/apply"
                ))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from("{}"))
                .expect("apply metadata suggestion request"),
        )
        .await
        .expect("apply metadata suggestion response");
    assert_eq!(apply.status(), StatusCode::CONFLICT);
    let apply = json_response(apply).await;
    assert_eq!(apply["code"], "DOCUMENT_TITLE_CHANGED");
    assert_eq!(
        state.db.get_document(&document_id).expect("document").title,
        "用户确定的标题"
    );
}

#[tokio::test]
async fn documents_list_total_is_stable_across_pages() {
    let state = test_state("library-documents-total-pagination");
    let app = build_app(state.clone());
    for content in [b"page-one".as_slice(), b"page-two", b"page-three"] {
        seed_document(&state, content);
    }

    let first = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents?limit=2&offset=0")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("first page request"),
        )
        .await
        .expect("first page response");
    assert_eq!(first.status(), StatusCode::OK);
    let first = json_response(first).await;
    assert_eq!(first["data"]["documents"].as_array().unwrap().len(), 2);
    assert_eq!(first["data"]["total"], 3);

    let second = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents?limit=2&offset=2")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("second page request"),
        )
        .await
        .expect("second page response");
    assert_eq!(second.status(), StatusCode::OK);
    let second = json_response(second).await;
    assert_eq!(second["data"]["documents"].as_array().unwrap().len(), 1);
    assert_eq!(second["data"]["total"], 3);
}

#[tokio::test]
async fn documents_list_total_uses_filters_upload_constraint_and_job_lookup() {
    let state = test_state("library-documents-total-filters");
    let app = build_app(state.clone());
    let chemistry_reading = seed_document(&state, b"chemistry-reading");
    let biology_reading = seed_document(&state, b"biology-reading");
    let chemistry_finished = seed_document(&state, b"chemistry-finished");

    state
        .db
        .update_document_fields(
            &chemistry_reading,
            None,
            Some("reading"),
            Some(&["chemistry".to_string()]),
        )
        .expect("mark chemistry reading");
    state
        .db
        .update_document_fields(
            &biology_reading,
            None,
            Some("reading"),
            Some(&["biology".to_string()]),
        )
        .expect("mark biology reading");
    state
        .db
        .update_document_fields(
            &chemistry_finished,
            None,
            Some("finished"),
            Some(&["chemistry".to_string()]),
        )
        .expect("mark chemistry finished");
    state
        .db
        .create_collection("col-chemistry-reading", "Chemistry reading", None)
        .expect("create collection");
    state
        .db
        .add_documents_to_collection(
            "col-chemistry-reading",
            std::slice::from_ref(&chemistry_reading),
        )
        .expect("add collection document");

    // This row matches the visible filters but has no upload and must remain
    // absent from both the current page and its total.
    let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).expect("open db");
    conn.execute(
        "INSERT INTO documents (document_id, title, source_filename, page_count, bytes, added_at, updated_at, reading_status) VALUES ('orphan-filtered', 'Orphan', 'orphan.pdf', 1, 1, '2026-01-01', '2026-01-01', 'reading')",
        [],
    )
    .expect("insert orphan document");
    conn.execute(
        "INSERT INTO document_tags (document_id, tag) VALUES ('orphan-filtered', 'chemistry')",
        [],
    )
    .expect("tag orphan document");

    let filtered = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents?reading_status=reading&tag=chemistry&collection_id=col-chemistry-reading&limit=1&offset=0")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("filtered request"),
        )
        .await
        .expect("filtered response");
    assert_eq!(filtered.status(), StatusCode::OK);
    let filtered = json_response(filtered).await;
    assert_eq!(filtered["data"]["total"], 1);
    assert_eq!(
        filtered["data"]["documents"][0]["document_id"],
        chemistry_reading
    );

    let mut linked_job = JobSnapshot::new(
        "job-document-total-lookup".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    linked_job.status = JobStatusKind::Succeeded;
    linked_job.sync_runtime_state();
    state.db.save_job(&linked_job).expect("save linked job");
    conn.execute(
        "UPDATE jobs SET document_id = ?1 WHERE job_id = ?2",
        rusqlite::params![chemistry_reading, linked_job.job_id],
    )
    .expect("link job to document");

    let hit = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents?job_id=job-document-total-lookup")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("job lookup request"),
        )
        .await
        .expect("job lookup response");
    assert_eq!(hit.status(), StatusCode::OK);
    assert_eq!(json_response(hit).await["data"]["total"], 1);

    let miss = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents?job_id=missing-job")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("missing job lookup request"),
        )
        .await
        .expect("missing job lookup response");
    assert_eq!(miss.status(), StatusCode::OK);
    assert_eq!(json_response(miss).await["data"]["total"], 0);
}

#[tokio::test]
async fn favorites_crud_and_job_reference_guard() {
    let state = test_state("library-favorites");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"doc favorites");
    seed_succeeded_job_for_document(&state, &document_id, "job-active");
    state
        .db
        .set_document_active_job(&document_id, "job-active", None)
        .expect("set active job");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/favorites")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "document_id": document_id,
                        "page_idx": 4,
                        "block_id": "p005-b0008",
                        "quote_text": "reaction rate increases",
                        "translated_quote_text": "反应速率随温度上升"
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("create response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    // 未显式给 job_id 时锚定到 active_job_id
    assert_eq!(payload["data"]["job_id"], "job-active");
    let favorite_id = payload["data"]["favorite_id"]
        .as_str()
        .expect("favorite id")
        .to_string();

    assert_eq!(
        state
            .db
            .favorites_referencing_job("job-active")
            .expect("count"),
        1
    );

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/v1/favorites/{favorite_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("delete response");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(state.db.list_favorites(None).expect("list").len(), 0);
}

#[tokio::test]
async fn search_returns_anchored_hits() {
    let state = test_state("library-search");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"doc search");
    state
        .db
        .replace_document_fts(
            &document_id,
            "job-1",
            &[FtsBlockRow {
                page_idx: 7,
                block_id: "p008-b0002".to_string(),
                source_text: "halogen lithium exchange selectivity".to_string(),
                translated_text: "卤素锂交换的选择性研究".to_string(),
            }],
        )
        .expect("seed fts");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/search?q=%E5%8D%A4%E7%B4%A0%E9%94%82%E4%BA%A4%E6%8D%A2")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("search response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    let hit = &payload["data"]["hits"][0];
    assert_eq!(hit["document_id"], document_id);
    assert_eq!(hit["job_id"], "job-1");
    assert_eq!(hit["page_idx"], 7);
    assert_eq!(hit["block_id"], "p008-b0002");
}

#[tokio::test]
async fn ai_proxy_returns_bad_gateway_when_upstream_is_down() {
    use crate::services::ai::AiGateway;

    // 场景 1(Phase 2 快速失败):监督器判定 unhealthy → 不发起上游连接,立即 503
    let mut state = test_state("ai-proxy-unhealthy");
    state.ai_gateway = std::sync::Arc::new(AiGateway::new(
        &state.config.ai_proxy, "http://127.0.0.1:9".into(), || 3,
    ).unwrap());
    let app = build_app(state);
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/ai/ask")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"question":"q"}"#))
                .expect("request"),
        )
        .await
        .expect("proxy response");
    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);

    // 场景 2(unsupervised 直连):指向必死端口,代理干净地报 502,不挂起不 500
    let mut state = test_state("ai-proxy-down");
    let mut config = state.config.ai_proxy.clone();
    config.service_base = Some("http://127.0.0.1:9".into());
    state.ai_gateway = std::sync::Arc::new(AiGateway::new(&config, String::new(), || 0).unwrap());
    let app = build_app(state);
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/ai/ask")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"question":"q"}"#))
                .expect("request"),
        )
        .await
        .expect("proxy response");
    assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
}

#[tokio::test]
async fn document_lookup_by_historical_job_id() {
    let state = test_state("library-job-lookup");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"doc job lookup");
    // 历史 job:归属该文档但不是 active run
    state
        .db
        .set_document_active_job(&document_id, "job-new", None)
        .expect("set active");
    {
        let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).expect("open db");
        conn.execute(
            "INSERT INTO jobs (job_id, workflow, status_json, created_at, updated_at, command_json, request_json, log_tail_json, document_id)
             VALUES ('job-old', '\"book\"', '\"succeeded\"', '2026-01-01', '2026-01-01', '[]', '{}', '[]', ?1)",
            rusqlite::params![document_id],
        )
        .expect("insert historical job");
    }

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents?job_id=job-old")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("lookup response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["documents"][0]["document_id"], document_id);

    // 只带 job_id 创建收藏:锚定到历史 run 的块空间,文档由后端解析
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/favorites")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "job_id": "job-old",
                        "page_idx": 2,
                        "block_id": "p003-b0001",
                        "quote_text": "historical quote"
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("create response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["document_id"], document_id);
    assert_eq!(payload["data"]["job_id"], "job-old");
}

#[tokio::test]
async fn favorite_note_patch_updates_in_place() {
    let state = test_state("library-fav-patch");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"doc patch note");
    seed_succeeded_job_for_document(&state, &document_id, "job-x");
    state
        .db
        .set_document_active_job(&document_id, "job-x", None)
        .expect("set active");
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/favorites")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "document_id": document_id,
                        "page_idx": 1,
                        "block_id": "p002-b0001",
                        "quote_text": "q"
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("create");
    let favorite_id = json_response(response).await["data"]["favorite_id"]
        .as_str()
        .expect("id")
        .to_string();

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/v1/favorites/{favorite_id}"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({"note": "改后的笔记"}).to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("patch");
    assert_eq!(response.status(), StatusCode::OK);
    let favorites = state.db.list_favorites(Some(&document_id)).expect("list");
    // favorite_id 不变,note 原子更新
    assert_eq!(favorites[0].favorite_id, favorite_id);
    assert_eq!(favorites[0].note, "改后的笔记");
}

#[tokio::test]
async fn asset_upload_dedupes_and_serves_immutable() {
    let state = test_state("library-assets");
    let app = build_app(state.clone());
    let png: &[u8] = b"\x89PNG\r\n\x1a\nfake-png-bytes-for-test";
    let boundary = "XBOUNDARY";
    let mut body_bytes: Vec<u8> = Vec::new();
    body_bytes.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"clip.png\"\r\nContent-Type: image/png\r\n\r\n"
        )
        .as_bytes(),
    );
    body_bytes.extend_from_slice(png);
    body_bytes.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    let body = body_bytes;
    let upload = |app: axum::Router| {
        let body = body.clone();
        async move {
            app.oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/assets")
                    .header("X-API-Key", "test-key")
                    .header(
                        "content-type",
                        format!("multipart/form-data; boundary={boundary}"),
                    )
                    .body(Body::from(body))
                    .expect("request"),
            )
            .await
            .expect("upload response")
        }
    };

    let first = json_response(upload(app.clone()).await).await;
    let second = json_response(upload(app.clone()).await).await;
    // 内容寻址:同字节两次上传同一 asset_id
    assert_eq!(first["data"]["asset_id"], second["data"]["asset_id"]);
    let asset_id = first["data"]["asset_id"].as_str().expect("asset id");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/assets/{asset_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("download response");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers().get("content-type").unwrap(), "image/png");
    assert!(response
        .headers()
        .get("cache-control")
        .unwrap()
        .to_str()
        .unwrap()
        .contains("immutable"));

    // 收藏挂图:kind=figure + asset_id + rect_json
    let document_id = seed_document(&state, b"doc with figure");
    seed_succeeded_job_for_document(&state, &document_id, "job-f");
    state
        .db
        .set_document_active_job(&document_id, "job-f", None)
        .expect("set active");
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/favorites")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "document_id": document_id,
                        "page_idx": 3,
                        "block_id": "p004-b0001",
                        "kind": "figure",
                        "quote_text": "figure clip",
                        "asset_id": asset_id,
                        "rect_json": "{\"x\":10,\"y\":20,\"w\":300,\"h\":200}"
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("favorite response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["asset_id"], asset_id);
    assert!(payload["data"]["rect_json"]
        .as_str()
        .unwrap()
        .contains("300"));

    // 未上传的 asset_id 被拒绝
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/favorites")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "document_id": document_id,
                        "page_idx": 1,
                        "block_id": "p002-b0001",
                        "quote_text": "q",
                        "asset_id": "deadbeef00"
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("bad favorite response");
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn asset_upload_enforces_configured_stream_limit_without_trusting_content_length() {
    let mut state = test_state("library-assets-stream-limit");
    Arc::make_mut(&mut state.config).asset.max_bytes = 4;
    let app = build_app(state);
    let boundary = "ASSET-LIMIT-BOUNDARY";
    let body = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"clip.png\"\r\nContent-Type: image/png\r\n\r\n12345\r\n--{boundary}--\r\n"
    );
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/assets")
                .header("X-API-Key", "test-key")
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .header("content-length", "1")
                .body(Body::from(body))
                .expect("request"),
        )
        .await
        .expect("upload response");

    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    let payload = json_response(response).await;
    assert_eq!(payload["code"], 41300);
    assert_eq!(payload["error"]["code"], "PAYLOAD_TOO_LARGE");
    assert_eq!(payload["message"], "request body is too large");
}

#[tokio::test]
async fn conversation_lifecycle_and_message_appending() {
    let state = test_state("library-conversations");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"doc conv");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/ai/conversations")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({"document_id": document_id}).to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("create conversation");
    assert_eq!(response.status(), StatusCode::OK);
    let conversation_id = json_response(response).await["data"]["conversation_id"]
        .as_str()
        .expect("id")
        .to_string();

    for (role, content) in [
        ("user", "溴锂交换的选择性由什么决定?"),
        ("assistant", "由共轭效应决定 [1]。"),
    ] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!(
                        "/api/v1/ai/conversations/{conversation_id}/messages"
                    ))
                    .header("X-API-Key", "test-key")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::json!({
                            "role": role, "content": content,
                            "citations_json": if role == "assistant" { "[{\"ref\":1}]" } else { "" }
                        })
                        .to_string(),
                    ))
                    .expect("request"),
            )
            .await
            .expect("append message");
        assert_eq!(response.status(), StatusCode::OK);
    }

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/ai/conversations/{conversation_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("detail");
    let payload = json_response(response).await;
    // 标题自动取首问前缀;消息按 seq 正序;引用快照原样保存
    assert!(payload["data"]["title"]
        .as_str()
        .unwrap()
        .contains("溴锂交换"));
    assert_eq!(payload["data"]["message_count"], 2);
    assert_eq!(payload["data"]["messages"][0]["role"], "user");
    assert_eq!(payload["data"]["messages"][1]["seq"], 2);
    assert!(payload["data"]["messages"][1]["citations_json"]
        .as_str()
        .unwrap()
        .contains("ref"));
    // head 落在最后一条;assistant 的 parent 为 user
    assert_eq!(
        payload["data"]["head_id"].as_str().unwrap(),
        payload["data"]["messages"][1]["message_id"]
            .as_str()
            .unwrap()
    );
    let user_id = payload["data"]["messages"][0]["message_id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(
        payload["data"]["messages"][1]["parent_id"]
            .as_str()
            .unwrap(),
        user_id
    );

    // 分支:同 parent 再挂一条 assistant,并 PATCH head 切回第一条
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/ai/conversations/{conversation_id}/messages"
                ))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "role": "assistant",
                        "content": "分支回答 B",
                        "parent_id": user_id,
                        "message_id": "msg-branch-b",
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("branch message");
    assert_eq!(response.status(), StatusCode::OK);
    let branch_payload = json_response(response).await;
    assert_eq!(branch_payload["data"]["message_id"], "msg-branch-b");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/v1/ai/conversations/{conversation_id}"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({ "head_id": user_id }).to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("patch head");
    // head 不能指向 user 若我们允许任何消息——我们允许任意 message_id 在会话内
    assert_eq!(response.status(), StatusCode::OK);

    // 非法 role 被拒
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/ai/conversations/{conversation_id}/messages"
                ))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({"role": "tool", "content": "x"}).to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("bad role");
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    state
        .db
        .create_conversation(
            "conv-pagination-second",
            "second conversation",
            Some(&document_id),
        )
        .expect("seed second document conversation");
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/api/v1/ai/conversations?document_id={document_id}&limit=1&offset=0"
                ))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("conversation list");
    assert_eq!(response.status(), StatusCode::OK);
    let list = json_response(response).await;
    assert_eq!(list["data"]["total"], 2);
    assert_eq!(list["data"]["limit"], 1);
    assert_eq!(list["data"]["offset"], 0);
    assert_eq!(list["data"]["has_more"], true);
    assert_eq!(list["data"]["conversations"].as_array().unwrap().len(), 1);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/api/v1/ai/conversations?document_id={document_id}&limit=1&offset=1"
                ))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("second conversation page");
    let second_page = json_response(response).await;
    assert_eq!(second_page["data"]["total"], 2);
    assert_eq!(second_page["data"]["offset"], 1);
    assert_eq!(second_page["data"]["has_more"], false);

    // 删除级联清消息
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/v1/ai/conversations/{conversation_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("delete");
    assert_eq!(response.status(), StatusCode::OK);
    assert!(state
        .db
        .list_messages(&conversation_id, 10)
        .expect("messages")
        .is_empty());
}

#[tokio::test]
async fn collections_crud_and_document_membership_roundtrip() {
    let state = test_state("library-collections");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"collections doc one");

    // 创建
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/collections")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::json!({"name": "化学"}).to_string()))
                .expect("request"),
        )
        .await
        .expect("create response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["name"], "化学");
    assert_eq!(payload["data"]["document_count"], 0);
    let collection_id = payload["data"]["collection_id"]
        .as_str()
        .expect("collection_id")
        .to_string();

    // 空名字被拒绝
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/collections")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::json!({"name": "  "}).to_string()))
                .expect("request"),
        )
        .await
        .expect("empty name response");
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // 列表能看到刚创建的文件夹
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/collections")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("list response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(
        payload["data"]["collections"][0]["collection_id"],
        collection_id
    );

    // 改名
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/v1/collections/{collection_id}"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({"name": "有机化学"}).to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("patch response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["name"], "有机化学");

    // 加入文档,document_count 同步更新
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/collections/{collection_id}/documents"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({"document_ids": [document_id]}).to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("add documents response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["document_count"], 1);

    // 不存在的文档被拒绝
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/collections/{collection_id}/documents"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({"document_ids": ["no-such-doc"]}).to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("add missing document response");
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    // GET /api/v1/documents?collection_id= 能过滤出这篇文档
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/documents?collection_id={collection_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("documents by collection response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["documents"][0]["document_id"], document_id);

    // 移除文档
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!(
                    "/api/v1/collections/{collection_id}/documents/{document_id}"
                ))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("remove document response");
    assert_eq!(response.status(), StatusCode::OK);

    // 重复移除报 404
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!(
                    "/api/v1/collections/{collection_id}/documents/{document_id}"
                ))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("remove again response");
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    // 删除文件夹本身
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/v1/collections/{collection_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("delete collection response");
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/collections")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("list after delete response");
    let payload = json_response(response).await;
    assert!(payload["data"]["collections"]
        .as_array()
        .expect("collections array")
        .is_empty());
}

#[tokio::test]
async fn library_books_job_ids_filter_returns_only_requested_jobs() {
    use crate::models::{CreateJobInput, JobSnapshot};

    let state = test_state("library-books-job-ids");
    for job_id in ["job-alpha", "job-beta", "job-gamma"] {
        let job = JobSnapshot::new(
            job_id.to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        state.db.save_job(&job).expect("save job");
    }
    let app = build_app(state.clone());

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/library/books?job_ids=job-alpha,job-gamma")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("filtered response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    let items = payload["data"]["items"].as_array().expect("items array");
    let ids: Vec<&str> = items
        .iter()
        .map(|item| item["job_id"].as_str().expect("job_id"))
        .collect();
    assert_eq!(ids.len(), 2);
    assert!(ids.contains(&"job-alpha"));
    assert!(ids.contains(&"job-gamma"));
    assert!(!ids.contains(&"job-beta"));

    // 不传 job_ids 时行为不变:三个 job 都在
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/library/books")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("unfiltered response");
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["items"].as_array().expect("items").len(), 3);
}

#[tokio::test]
async fn document_source_pdf_and_media_urls_work_without_job() {
    let state = test_state("library-document-source");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"%PDF-seed-doc-source");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/documents/{document_id}/source.pdf"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("source response");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get("content-type").unwrap(),
        "application/pdf"
    );
    let bytes = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    assert!(bytes.starts_with(b"%PDF"));

    // Cover needs a real PDF page (seed_document writes minimal_pdf_bytes when content is not PDF)
    let document_id = seed_document(&state, b"cover-doc-bytes");
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/documents/{document_id}/cover"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("cover response");
    // Cover rendering depends on local PyMuPDF; accept 200 or skip soft if python missing.
    if response.status() == StatusCode::OK {
        assert_eq!(
            response.headers().get("content-type").unwrap(),
            "image/jpeg"
        );
        let cached = state
            .config
            .data_root
            .join("documents")
            .join(&document_id)
            .join("cover.jpg");
        assert!(cached.exists(), "cover should be cached under documents/");
    } else {
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }
}

#[tokio::test]
async fn document_translate_reuses_upload_id() {
    let state = test_state("library-document-translate");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"translate-from-library");
    let upload = state
        .db
        .find_upload_for_document(&document_id)
        .expect("lookup")
        .expect("upload exists");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/documents/{document_id}/translate"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .header("host", "127.0.0.1:41000")
                .body(Body::from(
                    serde_json::json!({
                        "workflow": "book",
                        "ocr": {
                            "provider": "paddle",
                            "paddle_token": "paddle-test-token",
                            "paddle_api_url": "https://paddle.example.com"
                        },
                        "translation": {
                            "api_key": "sk-test",
                            "model": "deepseek-v4-flash",
                            "base_url": "https://api.deepseek.com/v1"
                        }
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("translate response");
    assert_eq!(response.status(), StatusCode::OK, "translate should queue");
    let payload = json_response(response).await;
    let job_id = payload["data"]["job_id"].as_str().expect("job_id");
    assert!(!job_id.is_empty());
    let job = state.db.get_job(job_id).expect("job saved");
    assert_eq!(job.upload_id.as_deref(), Some(upload.upload_id.as_str()));
    let linked_document = state
        .db
        .get_document_by_job_id(job_id)
        .expect("lookup linked document")
        .expect("translation job should be linked before worker completion");
    assert_eq!(linked_document.document_id, document_id);
    let document_jobs = state
        .db
        .list_jobs_for_document(&document_id, 100, 0)
        .expect("list document jobs");
    assert!(document_jobs.iter().any(|job| job.job_id == job_id));
}

#[tokio::test]
async fn document_translate_reuses_succeeded_ocr_artifacts_without_ocr_credentials() {
    let state = test_state("library-document-translate-reuse-ocr");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"translate-reuse-ocr");
    let source_job_id = seed_reusable_ocr_job(&state, &document_id, "ocr-reusable-source");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/documents/{document_id}/translate"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .header("host", "127.0.0.1:41000")
                .body(Body::from(
                    serde_json::json!({
                        "workflow": "translate",
                        "source": { "artifact_job_id": source_job_id },
                        "translation": {
                            "page_ranges": [],
                            "api_key": "sk-test",
                            "model": "deepseek-v4-flash",
                            "base_url": "https://api.deepseek.com/v1"
                        }
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("translate response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["workflow"], "translate");
    assert_eq!(payload["data"]["ocr_reused"], true);
    assert_eq!(
        payload["data"]["source_artifact_job_id"],
        "ocr-reusable-source"
    );
    assert_eq!(payload["data"]["stages"]["ocr"]["state"], "reused");
    assert_eq!(payload["data"]["stages"]["translation"]["state"], "queued");
    assert_eq!(payload["data"]["stages"]["render"]["state"], "pending");

    let job_id = payload["data"]["job_id"].as_str().expect("job id");
    let job = state.db.get_job(job_id).expect("saved translation job");
    assert_eq!(
        job.request_payload.source.artifact_job_id,
        "ocr-reusable-source"
    );
    assert!(job.request_payload.runtime.render_after_translation);
    assert!(job.request_payload.ocr.paddle_token.is_empty());

    let detail_path = payload["data"]["links"]["self_path"]
        .as_str()
        .expect("detail path");
    let detail_response = app
        .oneshot(
            Request::builder()
                .uri(detail_path)
                .header("X-API-Key", "test-key")
                .header("host", "127.0.0.1:41000")
                .body(Body::empty())
                .expect("detail request"),
        )
        .await
        .expect("detail response");
    assert_eq!(detail_response.status(), StatusCode::OK);
    let detail = json_response(detail_response).await;
    assert_eq!(detail["data"]["ocr_reused"], true);
    assert_eq!(
        detail["data"]["source_artifact_job_id"],
        "ocr-reusable-source"
    );
    assert_eq!(detail["data"]["stages"]["ocr"]["state"], "reused");
    assert_ne!(detail["data"]["stages"]["render"]["state"], "skipped");
}

#[tokio::test]
async fn document_translate_rejects_non_succeeded_ocr_with_structured_error() {
    let state = test_state("library-document-translate-reuse-not-succeeded");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"translate-reuse-not-succeeded");
    let source_job_id = seed_reusable_ocr_job(&state, &document_id, "ocr-running-source");
    let mut source_job = state.db.get_job(&source_job_id).expect("source job");
    source_job.status = JobStatusKind::Running;
    source_job.finished_at = None;
    source_job.sync_runtime_state();
    state.db.save_job(&source_job).expect("save running source");

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/documents/{document_id}/translate"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "workflow": "translate",
                        "source": { "artifact_job_id": source_job_id },
                        "translation": {
                            "api_key": "sk-test",
                            "model": "model",
                            "base_url": "https://api.example.com/v1"
                        }
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("translate response");
    assert_eq!(response.status(), StatusCode::CONFLICT);
    let payload = json_response(response).await;
    assert_eq!(payload["code"], "OCR_JOB_NOT_SUCCEEDED");
    assert_eq!(payload["reason"], "job_not_succeeded");
    assert_eq!(payload["can_fallback_to_ocr"], true);
}

#[tokio::test]
async fn document_translate_reuses_failed_parent_when_ocr_child_succeeded() {
    let state = test_state("library-document-translate-reuse-succeeded-ocr-child");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"translate-reuse-succeeded-ocr-child");
    let source_job_id = seed_reusable_ocr_job(&state, &document_id, "book-failed-after-ocr");
    let ocr_child_job_id = format!("{source_job_id}-ocr");

    let mut source_job = state.db.get_job(&source_job_id).expect("source job");
    source_job.status = JobStatusKind::Failed;
    source_job.finished_at = Some(now_iso());
    let source_artifacts = source_job.artifacts.as_mut().expect("source artifacts");
    source_artifacts.ocr_job_id = Some(ocr_child_job_id.clone());
    source_artifacts.ocr_status = None;
    source_job.sync_runtime_state();
    state.db.save_job(&source_job).expect("save failed parent");

    let mut ocr_child = JobSnapshot::new(
        ocr_child_job_id,
        CreateJobInput::default(),
        vec!["ocr".to_string()],
    );
    ocr_child.status = JobStatusKind::Succeeded;
    ocr_child.finished_at = Some(now_iso());
    ocr_child.sync_runtime_state();
    state.db.save_job(&ocr_child).expect("save OCR child");

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/documents/{document_id}/translate"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .header("host", "127.0.0.1:41000")
                .body(Body::from(
                    serde_json::json!({
                        "workflow": "translate",
                        "source": { "artifact_job_id": source_job_id },
                        "translation": {
                            "api_key": "sk-test",
                            "model": "deepseek-v4-flash",
                            "base_url": "https://api.deepseek.com/v1"
                        }
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("translate response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["ocr_reused"], true);
    assert_eq!(
        payload["data"]["source_artifact_job_id"],
        "book-failed-after-ocr"
    );
}

#[tokio::test]
async fn document_translate_rejects_ocr_from_another_document() {
    let state = test_state("library-document-translate-reuse-document-mismatch");
    let app = build_app(state.clone());
    let source_document_id = seed_document(&state, b"translate-reuse-source-document");
    let target_document_id = seed_document(&state, b"translate-reuse-target-document");
    let source_job_id = seed_reusable_ocr_job(&state, &source_document_id, "ocr-other-document");

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/documents/{target_document_id}/translate"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "workflow": "translate",
                        "source": { "artifact_job_id": source_job_id },
                        "translation": {
                            "api_key": "sk-test",
                            "model": "model",
                            "base_url": "https://api.example.com/v1"
                        }
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("translate response");
    assert_eq!(response.status(), StatusCode::CONFLICT);
    let payload = json_response(response).await;
    assert_eq!(payload["code"], "OCR_ARTIFACT_NOT_REUSABLE");
    assert_eq!(payload["reason"], "document_mismatch");
}

#[tokio::test]
async fn document_translate_rejects_missing_layout_without_exposing_path() {
    let state = test_state("library-document-translate-reuse-missing-layout");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"translate-reuse-missing-layout");
    let source_job_id = seed_reusable_ocr_job(&state, &document_id, "ocr-missing-layout");
    fs::remove_file(
        state
            .config
            .output_root
            .join("ocr-missing-layout/ocr/layout.json"),
    )
    .expect("remove layout");

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/documents/{document_id}/translate"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "workflow": "translate",
                        "source": { "artifact_job_id": source_job_id },
                        "translation": {
                            "api_key": "sk-test",
                            "model": "model",
                            "base_url": "https://api.example.com/v1"
                        }
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("translate response");
    assert_eq!(response.status(), StatusCode::CONFLICT);
    let payload = json_response(response).await;
    assert_eq!(payload["code"], "OCR_ARTIFACT_NOT_REUSABLE");
    assert_eq!(payload["reason"], "missing_layout_data");
    assert!(!payload.to_string().contains("ocr-missing-layout/ocr"));
}

#[tokio::test]
async fn document_translate_rejects_uncovered_translation_pages() {
    let state = test_state("library-document-translate-reuse-page-coverage");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"translate-reuse-page-coverage");
    let source_job_id = seed_reusable_ocr_job(&state, &document_id, "ocr-partial-pages");
    let mut source_job = state.db.get_job(&source_job_id).expect("source job");
    source_job
        .artifacts
        .as_mut()
        .expect("source artifacts")
        .ocr_page_numbers = vec![1, 2, 3];
    state
        .db
        .save_job(&source_job)
        .expect("save partial coverage");

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/documents/{document_id}/translate"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "workflow": "translate",
                        "source": { "artifact_job_id": source_job_id },
                        "translation": {
                            "page_ranges": [4],
                            "api_key": "sk-test",
                            "model": "model",
                            "base_url": "https://api.example.com/v1"
                        }
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("translate response");
    assert_eq!(response.status(), StatusCode::CONFLICT);
    let payload = json_response(response).await;
    assert_eq!(payload["code"], "OCR_PAGE_COVERAGE_MISMATCH");
    assert_eq!(payload["reason"], "page_coverage_mismatch");
}

#[tokio::test]
async fn document_ocr_reuses_upload_and_document_jobs_lists_ocr() {
    let state = test_state("library-document-ocr");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"ocr-from-library");
    let upload = state
        .db
        .find_upload_for_document(&document_id)
        .expect("lookup")
        .expect("upload exists");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/documents/{document_id}/ocr"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .header("host", "127.0.0.1:41000")
                .body(Body::from(
                    serde_json::json!({
                        "workflow": "book",
                        "ocr": {
                            "provider": "paddle",
                            "paddle_token": "paddle-test-token",
                            "paddle_api_url": "https://paddle.example.com",
                            "page_ranges": "2-4"
                        }
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("ocr response");
    assert_eq!(response.status(), StatusCode::OK, "ocr should queue");
    let payload = json_response(response).await;
    let job_id = payload["data"]["job_id"].as_str().expect("job_id");
    assert_eq!(payload["data"]["workflow"], "ocr");
    let job = state.db.get_job(job_id).expect("job saved");
    assert_eq!(job.upload_id.as_deref(), Some(upload.upload_id.as_str()));
    assert_eq!(job.request_payload.ocr.page_ranges, "2-4");

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/documents/{document_id}/jobs"))
                .header("X-API-Key", "test-key")
                .header("host", "127.0.0.1:41000")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("jobs response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    let items = payload["data"]["items"].as_array().expect("items");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["job_id"], job_id);
    assert_eq!(items[0]["workflow"], "ocr");
}

#[tokio::test]
async fn document_translate_rejects_ocr_only_workflow() {
    let state = test_state("library-document-translate-reject");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"reject-ocr-workflow");
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/documents/{document_id}/translate"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "workflow": "ocr",
                        "ocr": { "provider": "paddle", "paddle_token": "t" },
                        "translation": {
                            "api_key": "sk",
                            "model": "m",
                            "base_url": "https://api.example.com"
                        }
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("response");
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn document_jobs_return_authoritative_pagination_and_retry_metadata() {
    let state = test_state("library-document-jobs-pagination");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"document job pagination");
    for job_id in ["job-page-1", "job-page-2", "job-page-3"] {
        seed_succeeded_job_for_document(&state, &document_id, job_id);
    }
    let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).expect("open db");
    for (job_id, updated_at) in [
        ("job-page-1", "2026-09-01T01:00:00Z"),
        ("job-page-2", "2026-09-01T02:00:00Z"),
        ("job-page-3", "2026-09-01T03:00:00Z"),
    ] {
        conn.execute(
            "UPDATE jobs SET updated_at = ?1 WHERE job_id = ?2",
            rusqlite::params![updated_at, job_id],
        )
        .expect("set deterministic ordering");
    }
    conn.execute(
        "UPDATE jobs SET runtime_json = ?1 WHERE job_id = 'job-page-2'",
        rusqlite::params![serde_json::json!({
            "retry_count": 2,
            "last_retry_at": "2026-09-01T01:59:00Z",
            "stage_history": []
        })
        .to_string()],
    )
    .expect("set retry runtime");

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/api/v1/documents/{document_id}/jobs?limit=1&offset=1"
                ))
                .header("X-API-Key", "test-key")
                .header("host", "127.0.0.1:41000")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("jobs response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["total"], 3);
    assert_eq!(payload["data"]["limit"], 1);
    assert_eq!(payload["data"]["offset"], 1);
    assert_eq!(payload["data"]["has_more"], true);
    assert_eq!(payload["data"]["items"][0]["job_id"], "job-page-2");
    assert_eq!(payload["data"]["items"][0]["attempt"], 3);
    assert_eq!(payload["data"]["items"][0]["retry_count"], 2);
    assert_eq!(
        payload["data"]["items"][0]["last_retry_at"],
        "2026-09-01T01:59:00Z"
    );
}

// P0-2:删单个 job 后,悬空的 active_job_id 被 reconcile(重指剩余 job 或 NULL)
#[tokio::test]
async fn deleting_a_job_reconciles_document_active_job() {
    use crate::models::{CreateJobInput, JobSnapshot, JobStatusKind};

    let state = test_state("library-reconcile-active");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"doc reconcile");
    for (job_id, finished) in [("job-a", "2026-01-01"), ("job-b", "2026-02-01")] {
        let mut job = JobSnapshot::new(
            job_id.to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = JobStatusKind::Succeeded;
        job.sync_runtime_state();
        state.db.save_job(&job).expect("save job");
        let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).expect("open db");
        conn.execute(
            "UPDATE jobs SET document_id = ?1, finished_at = ?2 WHERE job_id = ?3",
            rusqlite::params![document_id, finished, job_id],
        )
        .expect("link job to document");
    }
    // active 指向 job-b(finished_at 更晚)
    state
        .db
        .set_document_active_job(&document_id, "job-b", None)
        .expect("set active");

    // 删 job-b —— reconcile 应把 active 重指到剩余的 job-a
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/v1/library/books/job-b")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("delete job-b");
    assert_eq!(response.status(), StatusCode::OK);
    let doc = state
        .db
        .get_document(&document_id)
        .expect("doc still exists");
    assert_eq!(doc.active_job_id.as_deref(), Some("job-a"));

    // 再删 job-a —— 没有剩余 book job,active 降级为 NULL(干净馆藏,非僵尸)
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/v1/library/books/job-a")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("delete job-a");
    assert_eq!(response.status(), StatusCode::OK);
    let doc = state
        .db
        .get_document(&document_id)
        .expect("doc still exists");
    assert_eq!(doc.active_job_id, None);
}

// P0-1:DELETE /documents/:id 删除文档行 + jobs + uploads + 文件;收藏引用 → 409
#[tokio::test]
async fn delete_document_removes_everything_and_guards_favorites() {
    use crate::models::{CreateJobInput, JobSnapshot, JobStatusKind};
    use crate::services::credentials::api::get_credential_metadata;
    use crate::services::credentials::get_or_create_managed_credential;

    let state = test_state("library-delete-document");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"doc delete");
    let managed_credential = get_or_create_managed_credential(
        &state.config.data_root,
        "translation_api_key",
        "openai_compatible",
        "Imported legacy translation credential",
        "delete-document-managed-secret",
    )
    .expect("create managed credential");
    let managed_credential_ref = managed_credential.credential.credential_ref;
    let mut input = CreateJobInput::default();
    input.translation.credential_ref = managed_credential_ref.clone();
    let mut job = JobSnapshot::new("job-x".to_string(), input, vec!["python".to_string()]);
    job.status = JobStatusKind::Succeeded;
    job.sync_runtime_state();
    state.db.save_job(&job).expect("save job");
    {
        let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).expect("open db");
        conn.execute(
            "UPDATE jobs SET document_id = ?1 WHERE job_id = 'job-x'",
            rusqlite::params![document_id],
        )
        .expect("link job");
    }
    state
        .db
        .set_document_active_job(&document_id, "job-x", None)
        .expect("set active");

    // 先挂一条收藏 → 删文档应 409
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/favorites")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "document_id": document_id,
                        "page_idx": 1,
                        "block_id": "p002-b0001",
                        "quote_text": "q"
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("create favorite");
    let favorite_id = json_response(response).await["data"]["favorite_id"]
        .as_str()
        .expect("fav id")
        .to_string();

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/v1/documents/{document_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("delete blocked");
    assert_eq!(response.status(), StatusCode::CONFLICT);
    assert!(get_credential_metadata(&state.config.data_root, &managed_credential_ref).is_ok());

    // 移除收藏后可删
    app.clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/v1/favorites/{favorite_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("remove favorite");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/v1/documents/{document_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("delete document");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["deleted"], true);
    assert!(payload["data"]["removed_jobs"]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "job-x"));

    // 文档行、job 行、upload 行都没了
    assert!(state.db.get_document(&document_id).is_err());
    assert!(state.db.get_job("job-x").is_err());
    assert!(get_credential_metadata(&state.config.data_root, &managed_credential_ref).is_err());
    assert!(state
        .db
        .uploads_for_document(&document_id)
        .expect("uploads query")
        .is_empty());

    // 删不存在的文档 → 404
    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/v1/documents/nonexistent")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("delete missing");
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// 孤儿治理:root-cause(retention 保护)+ 列表过滤 + 启动清理
#[tokio::test]
async fn ingest_only_document_survives_and_orphans_are_hidden() {
    let state = test_state("library-orphan");
    let app = build_app(state.clone());

    // 一篇"只入库"文档:有 upload、无 job(合法,必须保留可见)
    let ingest_only = seed_document(&state, b"ingest only doc");
    // 一个孤儿文档:直接建 documents 行,不建任何 upload(源文件已丢)
    {
        let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).expect("open db");
        conn.execute(
            "INSERT INTO documents (document_id, title, source_filename, page_count, bytes, added_at, updated_at)
             VALUES ('orphandoc0000', 'Zombie', 'zombie.pdf', 10, 1, '2026-01-01', '2026-01-01')",
            [],
        )
        .expect("insert orphan");
    }

    // 列表:只入库文档在,孤儿被过滤掉
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("list response");
    let payload = json_response(response).await;
    let ids: Vec<&str> = payload["data"]["documents"]
        .as_array()
        .unwrap()
        .iter()
        .map(|d| d["document_id"].as_str().unwrap())
        .collect();
    assert!(
        ids.contains(&ingest_only.as_str()),
        "ingest-only doc must stay"
    );
    assert!(!ids.contains(&"orphandoc0000"), "orphan doc must be hidden");
}

#[tokio::test]
async fn retention_preserves_document_backed_uploads() {
    use crate::models::domain::UploadRecord;

    let state = test_state("library-retention-guard");
    // 一个陈旧的、无 job 引用、但被 document 支撑的 upload(只入库场景)
    let hash = crate::db::documents::sha256_hex(b"retained ingest doc");
    let upload = UploadRecord {
        upload_id: "up-old-ingest".to_string(),
        filename: "keep.pdf".to_string(),
        stored_path: "uploads/up-old-ingest/keep.pdf".to_string(),
        bytes: 3,
        page_count: 1,
        uploaded_at: "2020-01-01T00:00:00Z".to_string(), // 远早于任何保留期
        developer_mode: false,
        content_hash: hash.clone(),
    };
    state.db.save_upload(&upload).expect("save upload");
    state
        .db
        .upsert_document_from_upload(&upload)
        .expect("upsert doc");

    // 一个陈旧、无 job、也无 document 支撑的 upload(真正的废上传,应被 GC)
    let junk = UploadRecord {
        upload_id: "up-old-junk".to_string(),
        filename: "junk.pdf".to_string(),
        stored_path: "uploads/up-old-junk/junk.pdf".to_string(),
        bytes: 3,
        page_count: 1,
        uploaded_at: "2020-01-01T00:00:00Z".to_string(),
        developer_mode: false,
        content_hash: String::new(),
    };
    state.db.save_upload(&junk).expect("save junk");

    let removed = state
        .db
        .cleanup_orphaned_uploads(48)
        .expect("cleanup orphaned uploads");
    let removed_ids: Vec<&str> = removed.iter().map(|u| u.upload_id.as_str()).collect();
    // 废上传被清,document-backed 的被保护
    assert!(removed_ids.contains(&"up-old-junk"));
    assert!(!removed_ids.contains(&"up-old-ingest"));
    assert!(state.db.get_upload("up-old-ingest").is_ok());
}
