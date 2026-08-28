use std::fs;

use axum::body::to_bytes;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use super::jobs_common::{minimal_pdf_bytes, test_state};
use crate::app::build_app;
use crate::db::documents::sha256_hex;
use crate::models::domain::{now_iso, UploadRecord};
use crate::models::api::FtsBlockRow;

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
        filename: "Tổng quan phổ học.pdf".to_string(),
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
                        "tags": ["Hóa học", "Phổ học"]
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

    // Đã từ chối trạng thái bất hợp pháp
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
async fn favorites_crud_and_job_reference_guard() {
    let state = test_state("library-favorites");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"doc favorites");
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
                        "translated_quote_text": "Tốc độ phản ứng tăng theo nhiệt độ"
                    })
                    .to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("create response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    // Không được cung cấp rõ ràng cho job_id khi neo vào active_job_id
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
                translated_text:         "Nghiên cứu tính chọn lọc của phản ứng trao đổi halogen-liti".to_string(),
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
    // Chỉ vào một cảng chết:Nhân viên chăm sóc khách hàng cần báo cáo rõ ràng 502,thay vì treo cổ hoặc 500
    std::env::set_var("RUST_API_AI_SERVICE_BASE", "http://127.0.0.1:9");
    let state = test_state("ai-proxy-down");
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
    std::env::remove_var("RUST_API_AI_SERVICE_BASE");
    assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
}

#[tokio::test]
async fn document_lookup_by_historical_job_id() {
    let state = test_state("library-job-lookup");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"doc job lookup");
    // Sử học job:Có thể quy cho tài liệu nhưng không active run
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

    // Chỉ với job_id Tạo bộ sưu tập:Neo vào Lịch sử run Chặn không gian cho,Tài liệu được phân tích cú pháp bởi phụ trợ
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
                .body(Body::from(serde_json::json!({"note": "改后的笔记"}).to_string()))
                .expect("request"),
        )
        .await
        .expect("patch");
    assert_eq!(response.status(), StatusCode::OK);
    let favorites = state.db.list_favorites(Some(&document_id)).expect("list");
    // favorite_id Không thay đổi,note Cập nhật nguyên tử
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
    // Địa chỉ nội dung:Cùng một byte, cùng một lần tải lên hai lần asset_id
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
    assert_eq!(
        response.headers().get("content-type").unwrap(),
        "image/png"
    );
    assert!(response
        .headers()
        .get("cache-control")
        .unwrap()
        .to_str()
        .unwrap()
        .contains("immutable"));

    // Bảng lật yêu thích:kind=figure + asset_id + rect_json
    let document_id = seed_document(&state, b"doc with figure");
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
    assert!(payload["data"]["rect_json"].as_str().unwrap().contains("300"));

    // Chưa tải lên asset_id Bị từ chối
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

    for (role, content) in [("user",             "Tính chọn lọc của phản ứng trao đổi brom-liti do yếu tố nào quyết định?"), ("assistant",             "Do hiệu ứng liên hợp quyết định [1].")] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/ai/conversations/{conversation_id}/messages"))
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
    // Tiêu đề được tự động đặt trước câu hỏi đầu tiên;Báo chí tin nhắn seq Trực giao;Ảnh chụp nhanh tham chiếu được lưu như là
    assert!(payload["data"]["title"].as_str().unwrap().contains(        "Trao đổi brom-liti"));
    assert_eq!(payload["data"]["message_count"], 2);
    assert_eq!(payload["data"]["messages"][0]["role"], "user");
    assert_eq!(payload["data"]["messages"][1]["seq"], 2);
    assert!(payload["data"]["messages"][1]["citations_json"]
        .as_str()
        .unwrap()
        .contains("ref"));
    // head Rơi xuống dòng cuối cùng;assistant của parent vì user
    assert_eq!(
        payload["data"]["head_id"].as_str().unwrap(),
        payload["data"]["messages"][1]["message_id"].as_str().unwrap()
    );
    let user_id = payload["data"]["messages"][0]["message_id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(
        payload["data"]["messages"][1]["parent_id"].as_str().unwrap(),
        user_id
    );

    // Ngành:cùng parent Treo thêm một cái nữa assistant,cũng PATCH head Chuyển trở lại mục đầu tiên
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/ai/conversations/{conversation_id}/messages"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "role": "assistant",
                        "content":         "Câu trả lời nhánh B",
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
    // head Không thể trỏ đến user Nếu chúng tôi cho phép bất kỳ tin nhắn nào——Chúng tôi cho phép bất kỳ message_id Trong cuộc trò chuyện
    assert_eq!(response.status(), StatusCode::OK);

    // phi pháp role Bị từ chối
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/ai/conversations/{conversation_id}/messages"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::json!({"role": "tool", "content": "x"}).to_string()))
                .expect("request"),
        )
        .await
        .expect("bad role");
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // Xóa tin nhắn xóa theo tầng
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

    // Tạo
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/collections")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({                        "name": "Hóa học"}).to_string(),
                ))
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

    // Tên trống bị từ chối
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

    // Danh sách hiển thị các thư mục bạn vừa tạo
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
    assert_eq!(payload["data"]["collections"][0]["collection_id"], collection_id);

    // đổi tên
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/v1/collections/{collection_id}"))
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({                        "name": "Hóa học hữu cơ"}).to_string(),
                ))
                .expect("request"),
        )
        .await
        .expect("patch response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = json_response(response).await;
    assert_eq!(payload["data"]["name"], "有机化学");

    // Thêm tài liệu,document_count Cập nhật đồng bộ hóa
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

    // Tài liệu không tồn tại bị từ chối
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

    // GET /api/v1/documents?collection_id= có thể lọc tài liệu này
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

    // Xóa tài liệu
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

    // Báo cáo xóa trùng lặp 404
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

    // Tự xóa thư mục
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

    // Không vượt qua job_ids Hành vi không thay đổi khi:Ba job đang ở
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

// P0-2:Xóa cá nhân job xong,Treo cổ active_job_id bị reconcile(Số ngón tay còn lại job Hoặc NULL)
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
    // active chỉ hướng job-b(finished_at trễ hơn)
    state
        .db
        .set_document_active_job(&document_id, "job-b", None)
        .expect("set active");

    // xóa job-b —— reconcile Nó phải là active Tập trung vào phần còn lại job-a
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
    let doc = state.db.get_document(&document_id).expect("doc still exists");
    assert_eq!(doc.active_job_id.as_deref(), Some("job-a"));

    // Xóa lại job-a —— Không còn book job,active Hạ cấp xuống NULL(Bộ sưu tập sạch,Không phải Zombie)
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
    let doc = state.db.get_document(&document_id).expect("doc still exists");
    assert_eq!(doc.active_job_id, None);
}

// P0-1:DELETE /documents/:id Xóa mục hàng tài liệu + jobs + uploads + Tập tin;Tài liệu tham khảo yêu thích → 409
#[tokio::test]
async fn delete_document_removes_everything_and_guards_favorites() {
    use crate::models::{CreateJobInput, JobSnapshot, JobStatusKind};

    let state = test_state("library-delete-document");
    let app = build_app(state.clone());
    let document_id = seed_document(&state, b"doc delete");
    let mut job = JobSnapshot::new(
        "job-x".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
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

    // Treo một bộ sưu tập trước → Việc xóa tài liệu nên 409
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

    // Có thể xóa sau khi xóa mục yêu thích
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

    // Tài liệu, job và upload đã biến mất.
    assert!(state.db.get_document(&document_id).is_err());
    assert!(state.db.get_job("job-x").is_err());
    assert!(state
        .db
        .uploads_for_document(&document_id)
        .expect("uploads query")
        .is_empty());

    // Xóa tài liệu không tồn tại → 404
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

// Quản lý trẻ mồ côi:root-cause(retention Đã bảo vệ)+ Lọc danh sách + Khởi chạy Dọn dẹp
#[tokio::test]
async fn ingest_only_document_survives_and_orphans_are_hidden() {
    let state = test_state("library-orphan");
    let app = build_app(state.clone());

    // Một bài viết 'Chỉ xem': Tài liệu có upload, không có job (Pháp lý, phải hiển thị).
    let ingest_only = seed_document(&state, b"ingest only doc");
    // Một tài liệu mồ côi:Được xây dựng trực tiếp documents đi,Không xây dựng bất cứ thứ gì upload(Thiếu tệp nguồn)
    {
        let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).expect("open db");
        conn.execute(
            "INSERT INTO documents (document_id, title, source_filename, page_count, bytes, added_at, updated_at)
             VALUES ('orphandoc0000', 'Zombie', 'zombie.pdf', 10, 1, '2026-01-01', '2026-01-01')",
            [],
        )
        .expect("insert orphan");
    }

    // Danh sách:Chỉ áp dụng cho các tài liệu gửi đến trong,Trẻ mồ côi được lọc ra
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
    assert!(ids.contains(&ingest_only.as_str()), "ingest-only doc must stay");
    assert!(!ids.contains(&"orphandoc0000"), "orphan doc must be hidden");
}

#[tokio::test]
async fn retention_preserves_document_backed_uploads() {
    use crate::models::domain::UploadRecord;

    let state = test_state("library-retention-guard");
    // Một người dùng cũ: Không có job trích dẫn, nhưng là tài liệu hỗ trợ upload (chỉ áp dụng cho các kịch bản gửi đến).
    let hash = crate::db::documents::sha256_hex(b"retained ingest doc");
    let upload = UploadRecord {
        upload_id: "up-old-ingest".to_string(),
        filename: "keep.pdf".to_string(),
        stored_path: "uploads/up-old-ingest/keep.pdf".to_string(),
        bytes: 3,
        page_count: 1,
            uploaded_at: "2020-01-01T00:00:00Z".to_string(), // Sớm hơn bất kỳ thời hạn lưu trữ nào
        developer_mode: false,
        content_hash: hash.clone(),
    };
    state.db.save_upload(&upload).expect("save upload");
    state.db.upsert_document_from_upload(&upload).expect("upsert doc");

    // Một lỗi thời、Không có job、cũngKhông có document Hỗ trợ upload(Tải lên Phế liệu Thực,Nên GC)
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
    // Nội dung tải lên bị bỏ qua đã bị xóa,document-backed Được bảo vệ
    assert!(removed_ids.contains(&"up-old-junk"));
    assert!(!removed_ids.contains(&"up-old-ingest"));
    assert!(state.db.get_upload("up-old-ingest").is_ok());
}
