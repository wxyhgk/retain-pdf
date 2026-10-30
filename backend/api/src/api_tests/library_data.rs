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

pub(super) fn seed_document(state: &crate::AppState, content: &[u8]) -> String {
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

pub(super) fn seed_reusable_ocr_job(state: &crate::AppState, document_id: &str, job_id: &str) -> String {
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
async fn documents_list_get_and_patch_roundtrip() {
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
        format!("http://127.0.0.1:41000/api/v1/documents/{document_id}/files/source.pdf?download=1")
    );
    assert_eq!(
        payload["data"]["documents"][0]["cover_url"],
        format!("http://127.0.0.1:41000/api/v1/documents/{document_id}/files/cover.jpg")
    );
    assert_eq!(
        payload["data"]["documents"][0]["thumbnail_url"],
        format!("http://127.0.0.1:41000/api/v1/documents/{document_id}/files/thumbnail.jpg")
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
                        "reading_status": "reading"
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
        .contains("/files/source.pdf"));

    let patched_document = payload["data"].clone();
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/documents/{document_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("detail request"),
        )
        .await
        .expect("detail response");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_response(response).await["data"], patched_document);

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

#[test]
fn library_route_dependencies_do_not_capture_job_runtime() {
    let state = test_state("library-route-dependencies");
    let runtime_owners = Arc::strong_count(&state.job_runtime);
    let deps = crate::routes::common::build_library_route_deps(&state);

    assert!(std::ptr::eq(deps.library.db, state.db.as_ref()));
    assert_eq!(
        Arc::strong_count(&state.job_runtime),
        runtime_owners,
        "ordinary Library requests must not assemble the jobs launcher"
    );
}

#[tokio::test]
async fn documents_read_and_patch_preserve_auth_and_not_found_contracts() {
    let app = build_app(test_state("library-document-errors"));
    let collection = "/api/v1/documents";
    let missing = "/api/v1/documents/missing-document";
    for (method, path, key, expected) in [
        ("GET", collection, None, StatusCode::UNAUTHORIZED),
        ("GET", missing, None, StatusCode::UNAUTHORIZED),
        ("PATCH", missing, None, StatusCode::UNAUTHORIZED),
        ("GET", collection, Some("invalid"), StatusCode::UNAUTHORIZED),
        ("GET", missing, Some("invalid"), StatusCode::UNAUTHORIZED),
        ("PATCH", missing, Some("invalid"), StatusCode::UNAUTHORIZED),
        ("GET", missing, Some("test-key"), StatusCode::NOT_FOUND),
        ("PATCH", missing, Some("test-key"), StatusCode::NOT_FOUND),
    ] {
        let mut request = Request::builder()
            .method(method)
            .uri(path)
            .header("content-type", "application/json");
        if let Some(key) = key {
            request = request.header("X-API-Key", key);
        }
        let response = app
            .clone()
            .oneshot(request.body(Body::from("{}")).expect("request"))
            .await
            .expect("response");
        assert_eq!(response.status(), expected, "{method} {path}");
        let payload = json_response(response).await;
        assert_eq!(payload["error"]["http_status"], expected.as_u16());
        assert_eq!(payload["code"], u32::from(expected.as_u16()) * 100);
        assert!(payload.get("data").is_none());
    }
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
async fn documents_list_supports_text_search_over_title_and_filename() {
    // /documents 此前没有任何文本过滤，前端只能拉前 200 篇做客户端过滤并把
    // hasMore 钉成 false——超过 200 篇的库里搜索会静默漏结果。
    let state = test_state("library-documents-text-search");
    let app = build_app(state.clone());
    // 注意：seed_document 的 filename 固定为「光谱综述.pdf」，所以搜索词不能用
    // 「光谱」——那会经 source_filename 命中全部三篇。这里只用标题里的独有词。
    let spectra = seed_document(&state, b"text-search-spectra");
    let attention = seed_document(&state, b"text-search-attention");
    seed_document(&state, b"text-search-unrelated");
    state
        .db
        .update_document_fields(&spectra, Some("拉曼散射的计算方法"), None)
        .expect("title spectra");
    state
        .db
        .update_document_fields(&attention, Some("Attention Is All You Need"), None)
        .expect("title attention");
    state
        .db
        .update_document_fields(&attention, None, None)
        .expect("noop patch keeps title");

    let hit = app
        .clone()
        .oneshot(
            Request::builder()
                // q=拉曼（URL 编码）
                .uri("/api/v1/documents?q=%E6%8B%89%E6%9B%BC&limit=10&offset=0")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("search request"),
        )
        .await
        .expect("search response");
    assert_eq!(hit.status(), StatusCode::OK);
    let hit = json_response(hit).await;
    // total 必须是过滤后的计数，前端才敢据此分页——这正是客户端过滤给不了的。
    assert_eq!(hit["data"]["total"], 1);
    assert_eq!(hit["data"]["documents"][0]["document_id"], spectra);

    // 文件名列也参与搜索：三篇的 source_filename 都是「光谱综述.pdf」，
    // 搜「光谱」应当三篇全中——这条同时证明搜的是 title OR source_filename。
    let by_filename = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents?q=%E5%85%89%E8%B0%B1&limit=10&offset=0")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("filename request"),
        )
        .await
        .expect("filename response");
    let by_filename = json_response(by_filename).await;
    assert_eq!(by_filename["data"]["total"], 3);

    let case_insensitive = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents?q=ATTENTION&limit=10&offset=0")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("case-insensitive request"),
        )
        .await
        .expect("case-insensitive response");
    let case_insensitive = json_response(case_insensitive).await;
    assert_eq!(case_insensitive["data"]["total"], 1);
    assert_eq!(
        case_insensitive["data"]["documents"][0]["document_id"],
        attention
    );

    let miss = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents?q=zzz-no-such-title&limit=10&offset=0")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("miss request"),
        )
        .await
        .expect("miss response");
    let miss = json_response(miss).await;
    assert_eq!(miss["data"]["total"], 0);
    assert_eq!(
        miss["data"]["documents"].as_array().expect("array").len(),
        0
    );

    // 不带 q 时行为不变（回归保护：新参数不能影响既有列表）
    let unfiltered = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents?limit=10&offset=0")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("unfiltered request"),
        )
        .await
        .expect("unfiltered response");
    let unfiltered = json_response(unfiltered).await;
    assert_eq!(unfiltered["data"]["total"], 3);
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
        )
        .expect("mark chemistry reading");
    state
        .db
        .update_document_fields(
            &biology_reading,
            None,
            Some("reading"),
        )
        .expect("mark biology reading");
    state
        .db
        .update_document_fields(
            &chemistry_finished,
            None,
            Some("finished"),
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

    let filtered = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents?reading_status=reading&collection_id=col-chemistry-reading&limit=1&offset=0")
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
    state.ai_gateway = std::sync::Arc::new(
        AiGateway::new(&state.config.ai_proxy, "http://127.0.0.1:9".into(), || 3).unwrap(),
    );
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
async fn jobs_job_ids_filter_returns_only_requested_jobs() {
    // 原来钉的是书架 `GET /library/books?job_ids=`（2026-10-22 删了），前端改调的是任务列表。
    use crate::models::{CreateJobInput, JobSnapshot};

    let state = test_state("jobs-job-ids-filter");
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
                .uri("/api/v1/jobs?job_ids=job-alpha,job-gamma")
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
                .uri("/api/v1/jobs")
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
                .uri(format!("/api/v1/documents/{document_id}/files/source.pdf"))
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
                .uri(format!("/api/v1/documents/{document_id}/files/cover.jpg"))
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
                            "model": "deepseek-flash",
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
                            "model": "deepseek-flash",
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
    // Let the in-process workflow driver poll before fetching its new job.
    // Read-only blocking isolation must not hide an oversized workflow stack.
    tokio::task::yield_now().await;
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
                            "model": "deepseek-flash",
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
async fn document_translate_needs_ocr_settings_for_pages_outside_existing_ocr() {
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
    // 第 4 页不在已有 OCR（1-3）里：按「允许自动补 OCR」要重新识别它，但请求里没有 OCR
    // 凭据。要说清楚是哪几页、为什么，而且一个任务都不能建（不留半截提交）。
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let payload = json_response(response).await;
    let message = payload["message"].as_str().unwrap_or_default();
    assert!(message.contains("第 4 页") && message.contains("重新识别"), "{message}");
    let conn = rusqlite::Connection::open(&state.config.jobs_db_path).unwrap();
    let job_ids: Vec<String> = conn
        .prepare("SELECT job_id FROM jobs")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .map(|row| row.unwrap())
        .collect();
    assert_eq!(job_ids, vec!["ocr-partial-pages".to_string()], "失败的提交建出了任务");
}

async fn post_translate(app: &axum::Router, document_id: &str, body: serde_json::Value) -> (StatusCode, serde_json::Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/documents/{document_id}/translate"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .expect("request"),
        )
        .await
        .expect("translate response");
    let status = response.status();
    (status, json_response(response).await)
}

fn submitted_jobs(state: &crate::AppState, payload: &serde_json::Value) -> Vec<JobSnapshot> {
    let mut ids = vec![payload["data"]["job_id"].as_str().expect("job id").to_string()];
    ids.extend(
        payload["data"]["sibling_job_ids"]
            .as_array()
            .map(|ids| ids.iter().map(|id| id.as_str().unwrap().to_string()).collect::<Vec<_>>())
            .unwrap_or_default(),
    );
    ids.iter().map(|id| state.db.get_job(id).expect("submitted job")).collect()
}

#[tokio::test]
async fn mixed_pages_on_one_ocr_split_into_one_translation_per_contiguous_run() {
    let state = test_state("library-document-translate-mixed-runs");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"translate-mixed-runs");
    let source_job_id = seed_reusable_ocr_job(&state, &document_id, "ocr-whole-book");

    let (status, payload) = post_translate(&app, &document_id, serde_json::json!({
        "workflow": "translate",
        "source": { "artifact_job_id": source_job_id },
        "translation": { "page_ranges": [7, 1, 2], "api_key": "sk-test", "model": "m", "base_url": "https://api.example.com/v1" }
    })).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let jobs = submitted_jobs(&state, &payload);
    let mut runs: Vec<(String, Vec<u32>)> = jobs
        .iter()
        .map(|job| (job.request_payload.source.artifact_job_id.clone(), job.request_payload.translation.page_ranges.clone()))
        .collect();
    runs.sort();
    assert_eq!(
        runs,
        vec![("ocr-whole-book".to_string(), vec![1, 2]), ("ocr-whole-book".to_string(), vec![7])],
        "1、2、7 页应拆成两段、都复用同一份 OCR"
    );
    for job in &jobs {
        assert_eq!(state.db.document_id_for_job(&job.job_id).unwrap().as_deref(), Some(document_id.as_str()));
    }
}

#[tokio::test]
async fn pages_beyond_the_existing_ocr_get_a_fresh_ocr_job_for_just_that_run() {
    let state = test_state("library-document-translate-fresh-ocr");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"translate-fresh-ocr");
    let source_job_id = seed_reusable_ocr_job(&state, &document_id, "ocr-first-three");
    let mut source_job = state.db.get_job(&source_job_id).unwrap();
    source_job.artifacts.as_mut().unwrap().ocr_page_numbers = vec![1, 2, 3];
    state.db.save_job(&source_job).unwrap();

    let (status, payload) = post_translate(&app, &document_id, serde_json::json!({
        "workflow": "translate",
        "source": { "artifact_job_id": source_job_id },
        "ocr": { "provider": "mineru", "mineru_token": "test-mineru-token" },
        "translation": { "page_ranges": [1, 2, 3, 5, 6], "api_key": "sk-test", "model": "m", "base_url": "https://api.example.com/v1" }
    })).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let jobs = submitted_jobs(&state, &payload);
    assert_eq!(jobs.len(), 2);
    let reuse = jobs.iter().find(|job| !job.request_payload.source.artifact_job_id.is_empty()).expect("reuse job");
    assert_eq!(reuse.request_payload.source.artifact_job_id, "ocr-first-three");
    assert_eq!(reuse.request_payload.translation.page_ranges, vec![1, 2, 3]);
    let fresh = jobs.iter().find(|job| job.request_payload.source.artifact_job_id.is_empty()).expect("fresh job");
    assert_eq!(fresh.workflow, WorkflowKind::Book);
    assert_eq!(fresh.request_payload.ocr.page_ranges, "5-6", "只 OCR 超出的那一段");
    assert!(fresh.request_payload.translation.page_ranges.is_empty());
    assert_eq!(payload["data"]["job_id"], fresh.job_id, "补 OCR 的段排在前面");
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
                        "workflow": "ocr",
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

    // limit 越界是 400，不静默夹。
    for limit in ["0", "501"] {
        let response = build_app(state.clone())
            .oneshot(
                Request::builder()
                    .uri(format!("/api/v1/documents/{document_id}/jobs?limit={limit}"))
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("request"),
            )
            .await
            .expect("jobs response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "limit={limit}");
    }
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
                .uri("/api/v1/jobs/job-b")
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
                .uri("/api/v1/jobs/job-a")
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

/// 彻底删除文档必须是"要么全删,要么全不删",且 DB 提交在文件删除之前。
///
/// 原实现是一串各自开连接、各自自动提交的删除:逐个 job 先删文件再删行,
/// 然后逐个 upload 先删目录再删行,最后删文档行。中途任何一步失败都留下
/// 没有自动修复路径的半删状态——最典型的就是 job 行和 upload 行都删光了,
/// 文档行却还在,书架上剩一本点开即 404 的书。
///
/// 这里用 SQLite trigger 让最后一步(删 documents 行)必定失败,断言前面
/// 那些行一条都没少,产物文件也一个没删。改回逐步提交的写法会让下面每一条
/// 断言都红。
#[tokio::test]
async fn delete_document_rolls_back_rows_and_keeps_files_when_a_step_fails() {
    use crate::models::{CreateJobInput, JobSnapshot, JobStatusKind};

    let state = test_state("library-delete-document-atomic");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"atomic delete doc");

    let mut job = JobSnapshot::new(
        "job-atomic".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Succeeded;
    job.sync_runtime_state();
    state.db.save_job(&job).expect("save job");
    let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).expect("open db");
    conn.execute(
        "UPDATE jobs SET document_id = ?1 WHERE job_id = 'job-atomic'",
        rusqlite::params![document_id],
    )
    .expect("link job");

    // 产物目录:删除成功时它会被清掉,所以它还在就证明文件删除没有先于 DB 发生。
    let job_root = state.config.output_root.join("job-atomic");
    fs::create_dir_all(&job_root).expect("job root");
    fs::write(job_root.join("full.md"), b"artifact").expect("artifact");

    // 让删 documents 行必定失败(模拟 DB 忙、约束冲突、进程被杀等真实中断)。
    conn.execute_batch(
        "CREATE TRIGGER reject_document_delete BEFORE DELETE ON documents
         BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;",
    )
    .expect("install failing trigger");
    drop(conn);

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/v1/documents/{document_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("delete response");
    assert_ne!(
        response.status(),
        StatusCode::OK,
        "删除中途失败时不得报告成功"
    );

    // DB 侧必须原封不动
    assert!(
        state.db.get_document(&document_id).is_ok(),
        "文档行必须还在"
    );
    assert!(
        state.db.get_job("job-atomic").is_ok(),
        "job 行必须随文档行一起回滚,否则书架上剩一本点不开的书"
    );
    assert!(
        !state
            .db
            .uploads_for_document(&document_id)
            .expect("uploads query")
            .is_empty(),
        "upload 行必须随文档行一起回滚,否则源文件永远找不回来"
    );

    // 磁盘侧也必须原封不动:文件删除只能发生在事务提交成功之后
    assert!(
        job_root.join("full.md").exists(),
        "DB 没删成时不得已经把产物文件删了"
    );
}

/// 失败的结构化信息必须出现在**列表**里。
///
/// 起因：DB 里 17/17 的失败都有 failure_json（category / retryable / summary /
/// suggestion / provider 全都有），job 详情端点也带 `failure`，**但书籍详情页
/// 只吃 document jobs 列表、从不打详情端点**。于是用户看到的只有「失败」两个字，
/// 而「MinerU 解析失败 / 上游问题 / 可重试 / 建议」全被截在后端。
fn seed_failed_job_for_document(
    state: &crate::AppState,
    document_id: &str,
    job_id: &str,
    failure: serde_json::Value,
) {
    let mut job = JobSnapshot::new(
        job_id.to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.error = Some("MinerU batch task failed: parsing failed, please try again later".into());
    job.failure = serde_json::from_value(failure).expect("failure info");
    job.sync_runtime_state();
    state.db.save_job(&job).expect("save job");
    let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).expect("open db");
    conn.execute(
        "UPDATE jobs SET document_id = ?1 WHERE job_id = ?2",
        rusqlite::params![document_id, job_id],
    )
    .expect("link job to document");
}

#[tokio::test]
async fn document_jobs_list_carries_structured_failure() {
    let state = test_state("document-jobs-failure");
    let document_id = seed_document(&state, b"failing doc");
    // 字段取自真实数据：一条 MinerU 解析失败。
    seed_failed_job_for_document(
        &state,
        &document_id,
        "job-failed-1",
        serde_json::json!({
            "stage": "ocr",
            "category": "unknown",
            "failed_stage": "ocr",
            "failure_category": "provider",
            "summary": "任务失败，但暂未识别出明确根因",
            "root_cause": "MinerU batch task failed: parsing failed, please try again later",
            "retryable": true,
            "provider": "mineru",
            "suggestion": "查看 log_tail 和完整错误日志进一步排查",
            // **重字段必须真的在夹具里。** 原来一个都没放，于是下面那条「列表不驮
            // traceback」在任何实现下都绿 —— 往 JobFailureBriefView 里加一个带
            // skip_serializing_if 的 raw_excerpt 照样过。
            "last_log_line": "RuntimeError: parsing failed",
            "raw_excerpt": "Traceback (most recent call last):\n  File \"ocr.py\", line 1",
            "raw_error_excerpt": "parsing failed",
            "raw_diagnostic": { "traceback": "Traceback (most recent call last):\n  ..." }
        }),
    );

    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/documents/{document_id}/jobs"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");
    let payload = json_response(response).await;
    let item = &payload["data"]["items"][0];

    // 正对照：确实取到了那条任务，否则下面全是在断言 null。
    assert_eq!(item["job_id"], "job-failed-1");
    assert_eq!(item["status"], "failed");

    let failure = &item["failure"];
    assert!(!failure.is_null(), "列表项没有带 failure —— 用户只能看到「失败」两个字");
    // **分类取更准的那一套**：真实数据里 6 条 MinerU 失败的 category 都是
    // "unknown"，而 failure_category 是 "provider"。用错的那个等于没分类。
    assert_eq!(failure["category"], "provider", "用了旧的 category 字段（unknown）");
    assert_eq!(failure["stage"], "ocr");
    assert_eq!(failure["retryable"], true, "retryable 没传出来，一键重试就没有依据");
    assert_eq!(failure["provider"], "mineru");
    assert!(failure["suggestion"].as_str().is_some_and(|s| !s.is_empty()));
    assert!(failure["root_cause"].as_str().is_some_and(|s| s.contains("MinerU")));

    // **列表不驮 traceback**：每 2 秒轮询一次，raw_excerpt / traceback 这类大字段
    // 要留给详情端点按需取。
    // 列表那份简报是**精简版**，键集合钉死：加任何字段都要在这里显式放行。
    // 原来这里循环断言 traceback / raw_excerpt「不在」，而夹具从没放过它们 ——
    // 空转。顺带，"traceback" 从来不是顶层字段（它住在 raw_diagnostic 里）。
    let mut keys: Vec<&str> = failure
        .as_object()
        .expect("failure 不是对象")
        .keys()
        .map(String::as_str)
        .collect();
    keys.sort_unstable();
    assert_eq!(
        keys,
        [
            "category", "provider", "retryable", "root_cause", "stage", "suggestion", "summary",
        ],
        "列表里那份失败简报的字段集合变了 —— 2 秒一次的轮询不该驮新东西"
    );
}

#[tokio::test]
async fn document_jobs_list_omits_failure_for_healthy_jobs() {
    let state = test_state("document-jobs-no-failure");
    let document_id = seed_document(&state, b"ok doc");
    seed_succeeded_job_for_document(&state, &document_id, "job-ok-1");

    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/documents/{document_id}/jobs"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");
    let payload = json_response(response).await;
    let item = &payload["data"]["items"][0];
    assert_eq!(item["status"], "succeeded", "正对照：取到的是那条成功任务");
    assert!(
        item.get("failure").is_none(),
        "成功的任务也带了 failure 字段 —— 前端会据此画出失败卡片"
    );
}

fn dev_defaults() -> crate::services::jobs::DevDefaultsGuard {
    crate::services::jobs::DevDefaultsGuard::set(crate::services::jobs::DevTranslationDefaults {
        model: "glm-5.3-flash".into(),
        base_url: "https://open.bigmodel.cn/api/paas/v4".into(),
        api_key: "dev-env-key".into(),
        workers: Some(20),
    })
}

#[tokio::test(flavor = "current_thread")]
async fn document_translate_without_model_settings_uses_the_dev_stack_defaults() {
    // 开发栈从 .env.local 读出模型配置；直接调接口测试时请求里不写模型也能跑。
    let _defaults = dev_defaults();
    let state = test_state("library-document-translate-dev-defaults");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"translate-dev-defaults");
    let source_job_id = seed_reusable_ocr_job(&state, &document_id, "ocr-dev-defaults");
    let (status, payload) = post_translate(&app, &document_id, serde_json::json!({
        "workflow": "translate",
        "source": { "artifact_job_id": source_job_id },
        "translation": { "page_ranges": [1, 2] }
    })).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let job = state.db.get_job(payload["data"]["job_id"].as_str().unwrap()).unwrap();
    assert_eq!(job.request_payload.translation.model, "glm-5.3-flash");
    assert_eq!(job.request_payload.translation.base_url, "https://open.bigmodel.cn/api/paas/v4");
    assert_eq!(job.request_payload.translation.workers, 20);
    // 明文 key 不落库：创建任务时会换成托管凭据的引用（原有行为）。
    assert!(job.request_payload.translation.api_key.is_empty());
    assert!(!job.request_payload.translation.credential_ref.is_empty(), "key 没被补上");
}

#[tokio::test(flavor = "current_thread")]
async fn a_request_with_its_own_model_settings_ignores_the_dev_stack_defaults() {
    let _defaults = dev_defaults();
    let state = test_state("library-document-translate-dev-defaults-explicit");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"translate-dev-defaults-explicit");
    let source_job_id = seed_reusable_ocr_job(&state, &document_id, "ocr-dev-defaults-explicit");
    let (status, payload) = post_translate(&app, &document_id, serde_json::json!({
        "workflow": "translate",
        "source": { "artifact_job_id": source_job_id },
        "translation": { "page_ranges": [1], "api_key": "sk-caller", "model": "deepseek-flash", "base_url": "https://api.deepseek.com/v1", "workers": 3 }
    })).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let job = state.db.get_job(payload["data"]["job_id"].as_str().unwrap()).unwrap();
    assert_eq!(job.request_payload.translation.model, "deepseek-flash");
    assert_eq!(job.request_payload.translation.base_url, "https://api.deepseek.com/v1");
    assert_eq!(job.request_payload.translation.workers, 3);
}

#[tokio::test(flavor = "current_thread")]
async fn split_translation_pre_check_sees_the_dev_stack_defaults() {
    // 补 OCR 的段在建任务前预检翻译凭据 —— 默认值必须在那之前补上，否则请求里没写模型就被拒。
    let _defaults = dev_defaults();
    let state = test_state("library-document-translate-dev-defaults-split");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"translate-dev-defaults-split");
    let source_job_id = seed_reusable_ocr_job(&state, &document_id, "ocr-dev-defaults-split");
    let mut source_job = state.db.get_job(&source_job_id).unwrap();
    source_job.artifacts.as_mut().unwrap().ocr_page_numbers = vec![1, 2, 3];
    state.db.save_job(&source_job).unwrap();
    let (status, payload) = post_translate(&app, &document_id, serde_json::json!({
        "workflow": "translate",
        "source": { "artifact_job_id": source_job_id },
        "ocr": { "provider": "mineru", "mineru_token": "test-mineru-token" },
        "translation": { "page_ranges": [1, 2, 5] }
    })).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let jobs = submitted_jobs(&state, &payload);
    assert_eq!(jobs.len(), 2);
    assert!(jobs.iter().all(|job| job.request_payload.translation.model == "glm-5.3-flash"));
}

async fn get_json(app: &axum::Router, uri: &str) -> serde_json::Value {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(uri)
                .header("X-API-Key", "test-key")
                .header("host", "127.0.0.1:41000")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");
    assert_eq!(response.status(), StatusCode::OK, "{uri}");
    json_response(response).await
}

#[tokio::test]
async fn cards_and_job_lists_show_the_document_title_not_the_upload_file_name() {
    // 书籍详情显示文档标题（会被元数据建议自动改名、或用户手改）；书架卡片和任务列表原来
    // 显示的是上传文件名，两边对不上。书架列表 2026-10-22 删了，书卡现在用任务列表。
    let state = test_state("library-card-title-follows-document");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"card-title-follows-document");
    let upload = state.db.find_upload_for_document(&document_id).unwrap().unwrap();
    let mut job = JobSnapshot::new("job-titled".to_string(), CreateJobInput::default(), vec!["python".to_string()]);
    job.status = JobStatusKind::Succeeded;
    job.upload_id = Some(upload.upload_id.clone());
    job.sync_runtime_state();
    state.db.save_job(&job).unwrap();
    state.db.link_job_to_document("job-titled", &upload.upload_id).unwrap();
    state.db.update_document_fields(&document_id, Some("自动识别出的论文标题"), None).unwrap();

    let jobs = get_json(&app, "/api/v1/jobs").await;
    let listed = jobs["data"]["items"].as_array().unwrap().iter().find(|item| item["job_id"] == "job-titled").expect("job item");
    assert_eq!(listed["display_name"], "自动识别出的论文标题", "任务列表还是文件名");

    // 书架详情（`/library/books/:job_id`）2026-10-19 删了；任务详情的书摘要同样跟文档标题走。
    let detail = get_json(&app, "/api/v1/jobs/job-titled").await;
    assert_eq!(detail["data"]["book_summary"]["title"], "自动识别出的论文标题", "任务详情的书摘要还是文件名");
}

#[tokio::test]
async fn a_job_without_a_document_still_falls_back_to_the_upload_file_name() {
    let state = test_state("library-card-title-fallback");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"card-title-fallback");
    let upload = state.db.find_upload_for_document(&document_id).unwrap().unwrap();
    // 文档标题被清空（或这本书的文档记录不存在）：退回文件名，不能显示空白。
    state.db.update_document_fields(&document_id, Some(""), None).unwrap();
    let mut job = JobSnapshot::new("job-untitled".to_string(), CreateJobInput::default(), vec!["python".to_string()]);
    job.status = JobStatusKind::Succeeded;
    job.upload_id = Some(upload.upload_id.clone());
    job.sync_runtime_state();
    state.db.save_job(&job).unwrap();
    let jobs = get_json(&app, "/api/v1/jobs").await;
    let listed = jobs["data"]["items"].as_array().unwrap().iter().find(|item| item["job_id"] == "job-untitled").expect("job item");
    assert_eq!(listed["display_name"], "光谱综述.pdf");
}

/// 书库列表带 `has_translation`：有没有任何成功的、带译文（非纯 OCR）的任务。
///
/// 书卡原来只看当前任务（active_job）成没成功；早已翻译完的书一旦重新翻译失败或正在跑，
/// 书卡就降级成「读原文 / 失败」，而阅读器（resolve_reading_target）一直能打开旧译文。
/// 这个字段只查数据库（成功的非 OCR 任务是否存在），不解析 PDF —— 列表每本书都要算。
#[tokio::test]
async fn documents_list_exposes_has_translation_independent_of_the_active_job() {
    let state = test_state("library-documents-has-translation");
    let app = build_app(state.clone());

    let seed_job = |document_id: &str, job_id: &str, workflow: WorkflowKind, status: JobStatusKind| {
        let mut input = CreateJobInput::default();
        input.workflow = workflow;
        let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["python".to_string()]);
        job.status = status;
        job.sync_runtime_state();
        state.db.save_job(&job).expect("save job");
        let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).expect("open db");
        conn.execute(
            "UPDATE jobs SET document_id = ?1 WHERE job_id = ?2",
            rusqlite::params![document_id, job_id],
        )
        .expect("link job to document");
    };

    // 旧译文成功、最新一次重新翻译失败，当前任务指向失败的那个。
    let retranslated = seed_document(&state, b"has-translation-old-success");
    seed_job(&retranslated, "job-old-book", WorkflowKind::Book, JobStatusKind::Succeeded);
    seed_job(&retranslated, "job-new-book", WorkflowKind::Book, JobStatusKind::Failed);
    state
        .db
        .set_document_active_job(&retranslated, "job-new-book", None)
        .expect("point active job at the failed retry");

    // 只有成功的 OCR + 失败的翻译：没有译文。
    let ocr_only = seed_document(&state, b"has-translation-ocr-only");
    seed_job(&ocr_only, "job-ocr", WorkflowKind::Ocr, JobStatusKind::Succeeded);
    seed_job(&ocr_only, "job-failed-book", WorkflowKind::Book, JobStatusKind::Failed);

    // 只收藏、从没处理过。
    let library_only = seed_document(&state, b"has-translation-library-only");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/documents?limit=10&offset=0")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("list request"),
        )
        .await
        .expect("list response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    let flag = |document_id: &str| {
        payload["data"]["documents"]
            .as_array()
            .expect("documents array")
            .iter()
            .find(|doc| doc["document_id"] == document_id)
            .map(|doc| doc["has_translation"].clone())
            .expect("document listed")
    };
    assert_eq!(flag(&retranslated), serde_json::json!(true), "旧译文可读，当前任务失败不影响");
    assert_eq!(flag(&ocr_only), serde_json::json!(false), "纯 OCR 不算译文");
    assert_eq!(flag(&library_only), serde_json::json!(false));

    // 详情接口同一个字段、同一条规则。
    let detail = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/documents/{retranslated}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("detail request"),
        )
        .await
        .expect("detail response");
    let detail = json_response(detail).await;
    assert_eq!(detail["data"]["has_translation"], serde_json::json!(true));
    assert_eq!(detail["data"]["active_job_id"], "job-new-book");
}
