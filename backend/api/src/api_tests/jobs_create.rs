use axum::body::{to_bytes, Body};
use axum::http::{header, Request, StatusCode};
use retain_data::credentials::resolve_credential;
use serde_json::Value;
use tower::util::ServiceExt;

use super::jobs_common::test_state;
use crate::app::build_simple_app;

use crate::test_support::pdf::build_test_pdf_bytes;

#[tokio::test]
async fn translate_bundle_route_returns_async_job_submission_json() {
    let state = test_state("translate-bundle-async");
    let db = state.db.clone();
    let data_root = state.config.data_root.clone();
    let boundary = "retainpdf-test-boundary";
    let pdf_bytes = build_test_pdf_bytes();
    let mut body = Vec::new();
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"workflow\"\r\n\r\nbook\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"api_key\"\r\n\r\nsk-test\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\ndeepseek-v4-flash\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"base_url\"\r\n\r\nhttps://api.deepseek.com/v1\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"mineru_token\"\r\n\r\nmineru-token\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"input.pdf\"\r\nContent-Type: application/pdf\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(&pdf_bytes);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());

    let response = build_simple_app(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/translate/bundle")
                .header("X-API-Key", "test-key")
                .header(
                    header::CONTENT_TYPE,
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(body))
                .expect("request"),
        )
        .await
        .expect("response");

    assert_eq!(response.status(), StatusCode::OK);
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    assert!(content_type.starts_with("application/json"));
    let payload: Value = serde_json::from_slice(
        &to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body"),
    )
    .expect("json");
    assert_eq!(payload["data"]["status"], "queued");
    assert_eq!(payload["data"]["workflow"], "book");
    let job_id = payload["data"]["job_id"].as_str().unwrap_or("");
    assert!(job_id.len() > 8);

    let persisted = db.get_job(job_id).expect("load persisted bundle job");
    assert!(persisted.request_payload.ocr.mineru_token.is_empty());
    assert!(persisted.request_payload.translation.api_key.is_empty());
    let persisted_json = serde_json::to_string(&persisted).expect("serialize persisted job");
    assert!(!persisted_json.contains("mineru-token"));
    assert!(!persisted_json.contains("sk-test"));
    let ocr_credential = resolve_credential(
        &data_root,
        &persisted.request_payload.ocr.credential_ref,
        "ocr_provider_token",
    )
    .expect("resolve imported OCR credential");
    assert_eq!(ocr_credential.secret, "mineru-token");
    let translation_credential = resolve_credential(
        &data_root,
        &persisted.request_payload.translation.credential_ref,
        "translation_api_key",
    )
    .expect("resolve imported translation credential");
    assert_eq!(translation_credential.secret, "sk-test");
}
