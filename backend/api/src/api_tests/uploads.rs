use super::jobs_common::test_state;
use crate::app::build_app;

#[tokio::test]
async fn upload_domain_errors_preserve_http_envelopes() {
    use crate::services::uploads::UploadError;
    use axum::response::IntoResponse;
    let cases = [
        (
            UploadError::BadRequest("invalid pdf after repair".into()),
            400,
            "BAD_REQUEST",
            "invalid pdf after repair",
        ),
        (
            UploadError::PayloadTooLarge("PDF exceeds processing buffer budget"),
            413,
            "PAYLOAD_TOO_LARGE",
            "PDF exceeds processing buffer budget",
        ),
        (
            UploadError::Busy,
            503,
            "SERVICE_UNAVAILABLE",
            "PDF processing capacity is busy; please retry",
        ),
        (
            UploadError::QueueTimeout,
            503,
            "SERVICE_UNAVAILABLE",
            "PDF processing queue wait timed out",
        ),
        (
            UploadError::RepairUnavailable,
            503,
            "SERVICE_UNAVAILABLE",
            "PDF repair tool unavailable",
        ),
        (
            UploadError::RepairTimeout,
            503,
            "SERVICE_UNAVAILABLE",
            "PDF repair timed out",
        ),
        (
            UploadError::Internal("Failed to publish uploaded PDF"),
            500,
            "INTERNAL",
            "Failed to publish uploaded PDF",
        ),
        (
            UploadError::Io(std::io::Error::other("synthetic IO failure")),
            500,
            "INTERNAL",
            "synthetic IO failure",
        ),
    ];
    for (error, status, code, message) in cases {
        let response = crate::error::AppError::from(error).into_response();
        assert_eq!(response.status().as_u16(), status);
        assert_eq!(
            response_json(response).await,
            serde_json::json!({
                "code": u32::from(status) * 100, "message": message,
                "error": {"code": code, "http_status": status, "details": {}}
            })
        );
    }
}

#[tokio::test]
async fn all_upload_consumers_use_the_injected_processing_budget() {
    let mut state = test_state("upload-shared-budget");
    let mut processing = crate::config::UploadProcessingConfig::default();
    processing.buffer_mib = 1;
    state.uploads = Arc::new(crate::services::uploads::UploadService::new(
        state.db.clone(),
        crate::services::uploads::UploadServiceConfig {
            uploads_dir: state.config.uploads_dir.clone(),
            python_bin: "/never-start-python".into(),
            upload_max_bytes: 0,
            upload_max_pages: 0,
            processing,
        },
    ));
    let uploads_dir = state.config.uploads_dir.clone();
    let output_root = state.config.output_root.clone();
    let db = state.db.clone();
    let main = build_app(state.clone());
    let simple = crate::app::build_simple_app(state);
    for (app, uri) in [
        (main.clone(), "/api/v1/uploads"),
        (main, "/api/v1/ocr/jobs"),
        (simple, "/api/v1/translate/bundle"),
    ] {
        let mut body = Vec::new();
        for (name, value) in [
            ("workflow", "book"),
            ("api_key", "synthetic-key"),
            ("model", "synthetic-model"),
            ("base_url", "https://example.invalid/v1"),
            ("mineru_token", "synthetic-token"),
        ] {
            body.extend_from_slice(format!("--{UPLOAD_BOUNDARY}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n").as_bytes());
        }
        body.extend_from_slice(format!("--{UPLOAD_BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"input.pdf\"\r\nContent-Type: application/pdf\r\n\r\n").as_bytes());
        let mut pdf = crate::test_support::pdf::build_test_pdf_bytes();
        pdf.resize(1024 * 1024 + 1, b' ');
        body.extend_from_slice(&pdf);
        body.extend_from_slice(format!("\r\n--{UPLOAD_BOUNDARY}--\r\n").as_bytes());
        let request = Request::builder()
            .method("POST")
            .uri(uri)
            .header("X-API-Key", "test-key")
            .header(
                header::CONTENT_TYPE,
                format!("multipart/form-data; boundary={UPLOAD_BOUNDARY}"),
            )
            .body(Body::from(body))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE, "{uri}");
        assert_eq!(
            response_json(response).await["message"],
            "PDF exceeds processing buffer budget",
            "{uri}"
        );
        assert_eq!(std::fs::read_dir(&uploads_dir).unwrap().count(), 0);
        assert_eq!(std::fs::read_dir(&output_root).unwrap().count(), 0);
        assert!(db.list_jobs(10, 0, None, None).unwrap().is_empty());
    }
}
use axum::body::{to_bytes, Body};
use axum::http::{header, Request, StatusCode};
use serde_json::Value;
use std::sync::Arc;
use tower::util::ServiceExt;

#[tokio::test]
async fn upload_route_preserves_success_view_and_document_deduplication() {
    let state = test_state("upload-route-success");
    let db = state.db.clone();
    let app = build_app(state);
    let pdf = crate::test_support::pdf::build_test_pdf_bytes();
    let mut ids = Vec::new();
    for filename in ["first.pdf", "second.pdf"] {
        let mut body = format!("--{UPLOAD_BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: application/pdf\r\n\r\n").into_bytes();
        body.extend_from_slice(&pdf);
        body.extend_from_slice(format!("\r\n--{UPLOAD_BOUNDARY}--\r\n").as_bytes());
        let request = Request::builder()
            .method("POST")
            .uri("/api/v1/uploads")
            .header("X-API-Key", "test-key")
            .header(
                header::CONTENT_TYPE,
                format!("multipart/form-data; boundary={UPLOAD_BOUNDARY}"),
            )
            .body(Body::from(body))
            .unwrap();
        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let payload = response_json(response).await;
        let view = &payload["data"];
        assert_eq!(view["filename"], filename);
        assert_eq!(view["bytes"], pdf.len());
        assert_eq!(view["page_count"], 1);
        let mut keys = view
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>();
        keys.sort_unstable();
        assert_eq!(
            keys,
            [
                "bytes",
                "filename",
                "page_count",
                "upload_id",
                "uploaded_at"
            ]
        );
        ids.push(view["upload_id"].as_str().unwrap().to_owned());
    }
    assert_ne!(ids[0], ids[1]);
    let first = db.get_upload(&ids[0]).unwrap();
    let second = db.get_upload(&ids[1]).unwrap();
    assert_eq!(first.content_hash, second.content_hash);
    assert_eq!(
        db.get_document(&first.content_hash)
            .unwrap()
            .source_filename,
        "second.pdf"
    );
    assert!(std::path::Path::new(&first.stored_path).exists());
    assert!(std::path::Path::new(&second.stored_path).exists());
}

#[tokio::test]
async fn upload_route_repair_unavailable_preserves_safe_error_and_cleanup() {
    let mut state = test_state("upload-route-repair-unavailable");
    let uploads_dir = state.config.uploads_dir.clone();
    state.uploads = Arc::new(crate::services::uploads::UploadService::new(
        state.db.clone(),
        crate::services::uploads::UploadServiceConfig {
            uploads_dir: uploads_dir.clone(),
            python_bin: "/synthetic-private-missing-python".into(),
            upload_max_bytes: 0,
            upload_max_pages: 0,
            processing: Default::default(),
        },
    ));
    let body = format!(
        "{}--{UPLOAD_BOUNDARY}--\r\n",
        upload_file_field("broken.pdf", "broken")
    );
    let response = build_app(state)
        .oneshot(upload_request(body))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    let payload = response_json(response).await;
    assert_eq!(payload["code"], 50300);
    assert_eq!(payload["message"], "PDF repair tool unavailable");
    assert_eq!(payload["error"]["code"], "SERVICE_UNAVAILABLE");
    assert_eq!(payload["error"]["http_status"], 503);
    assert_eq!(payload["error"]["details"], serde_json::json!({}));
    assert!(!payload.to_string().contains("synthetic-private"));
    assert_eq!(std::fs::read_dir(uploads_dir).unwrap().count(), 0);
}

const UPLOAD_BOUNDARY: &str = "retainpdf-upload-route-test";

fn upload_file_field(filename: &str, value: &str) -> String {
    format!(
        "--{UPLOAD_BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: application/pdf\r\n\r\n{value}\r\n"
    )
}

fn upload_request(body: String) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri("/api/v1/uploads")
        .header("X-API-Key", "test-key")
        .header(
            header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={UPLOAD_BOUNDARY}"),
        )
        .body(Body::from(body))
        .unwrap()
}

async fn response_json(response: axum::response::Response) -> Value {
    serde_json::from_slice(
        &to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read response body"),
    )
    .expect("parse response JSON")
}

#[tokio::test]
async fn upload_route_enforces_configured_stream_limit_without_content_length() {
    let mut state = test_state("upload-route-stream-limit");
    let mut config = (*state.config).clone();
    config.upload_max_bytes = 4;
    let uploads_dir = config.uploads_dir.clone();
    state.config = Arc::new(config);
    let body = format!(
        "{}--{UPLOAD_BOUNDARY}--\r\n",
        upload_file_field("input.pdf", "12345")
    );

    let response = build_app(state)
        .oneshot(upload_request(body))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    let payload = response_json(response).await;
    assert_eq!(payload["code"], 41300);
    assert_eq!(payload["message"], "request body is too large");
    assert_eq!(payload["error"]["code"], "PAYLOAD_TOO_LARGE");
    let entries = std::fs::read_dir(uploads_dir)
        .expect("read uploads directory")
        .collect::<Result<Vec<_>, _>>()
        .expect("collect uploads directory");
    assert!(entries.is_empty(), "oversize route upload created files");
}

#[tokio::test]
async fn upload_route_rejects_duplicate_file_before_reading_second_body() {
    let mut state = test_state("upload-route-duplicate-file");
    let mut config = (*state.config).clone();
    config.upload_max_bytes = 4;
    state.config = Arc::new(config);
    let body = format!(
        "{}{}--{UPLOAD_BOUNDARY}--\r\n",
        upload_file_field("first.pdf", "1234"),
        upload_file_field("second.pdf", "12345")
    );

    let response = build_app(state)
        .oneshot(upload_request(body))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let payload = response_json(response).await;
    assert_eq!(payload["code"], 40000);
    assert_eq!(payload["message"], "duplicate multipart field: file");
    assert_eq!(payload["error"]["code"], "BAD_REQUEST");
}
