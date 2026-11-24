use axum::body::{to_bytes, Body};
use axum::http::{header, Method, Request, StatusCode};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::error::AppError;
use crate::routes::common::ApiPath;

#[derive(Debug)]
struct ErrorResponseSnapshot {
    status: StatusCode,
    content_type: Option<String>,
    allow: Option<String>,
    body: String,
}

async fn error_response_snapshot(response: axum::response::Response) -> ErrorResponseSnapshot {
    let status = response.status();
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let allow = response
        .headers()
        .get(header::ALLOW)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let body = String::from_utf8(
        to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read rejection body")
            .to_vec(),
    )
    .expect("rejection body is UTF-8");
    ErrorResponseSnapshot {
        status,
        content_type,
        allow,
        body,
    }
}

fn assert_unified_generic_error(
    snapshot: &ErrorResponseSnapshot,
    expected_status: StatusCode,
    expected_legacy_code: i64,
    expected_stable_code: &str,
) {
    assert_unified_error_with_details(
        snapshot,
        expected_status,
        expected_legacy_code,
        expected_stable_code,
        json!({}),
    );
}

/// 请求体写错（第 13 条，2026-11-24）：400、顶层 `code` 40000、`BAD_REQUEST`，`error.details.reason` 区分情况。
fn assert_body_error(snapshot: &ErrorResponseSnapshot, reason: &str) {
    assert_unified_error_with_details(
        snapshot,
        StatusCode::BAD_REQUEST,
        40000,
        "BAD_REQUEST",
        json!({ "reason": reason }),
    );
}

fn assert_unified_error_with_details(
    snapshot: &ErrorResponseSnapshot,
    expected_status: StatusCode,
    expected_legacy_code: i64,
    expected_stable_code: &str,
    expected_details: Value,
) {
    assert_eq!(snapshot.status, expected_status, "{snapshot:?}");
    assert!(
        snapshot
            .content_type
            .as_deref()
            .is_some_and(|value| value.starts_with("application/json")),
        "{snapshot:?}"
    );
    let body: Value = serde_json::from_str(&snapshot.body)
        .unwrap_or_else(|error| panic!("non-JSON rejection body ({error}): {snapshot:?}"));
    assert_eq!(body["code"], expected_legacy_code, "{snapshot:?}");
    assert!(
        body["message"]
            .as_str()
            .is_some_and(|message| !message.trim().is_empty()),
        "{snapshot:?}"
    );
    assert!(body.get("data").is_none(), "{snapshot:?}");
    assert_eq!(body["error"]["code"], expected_stable_code, "{snapshot:?}");
    assert_eq!(
        body["error"]["http_status"],
        i64::from(expected_status.as_u16()),
        "{snapshot:?}"
    );
    assert_eq!(body["error"]["details"], expected_details, "{snapshot:?}");
}

fn assert_safe_unified_generic_error(
    snapshot: &ErrorResponseSnapshot,
    expected_status: StatusCode,
    expected_legacy_code: i64,
    expected_stable_code: &str,
    expected_message: &str,
) {
    assert_unified_generic_error(
        snapshot,
        expected_status,
        expected_legacy_code,
        expected_stable_code,
    );
    assert_safe_message(snapshot, expected_message);
}

fn assert_safe_message(snapshot: &ErrorResponseSnapshot, expected_message: &str) {
    let body: Value = serde_json::from_str(&snapshot.body).expect("parse unified error body");
    assert_eq!(body["message"], expected_message, "{snapshot:?}");
    let public_message = body["message"]
        .as_str()
        .expect("public error message")
        .to_ascii_lowercase();
    for internal_detail in [
        "failed to parse",
        "failed to deserialize",
        "invalid digit found",
        "invalid type:",
        "line 1 column",
        "serde",
        "rejection",
        "do-not-echo-this-value",
    ] {
        assert!(
            !public_message.contains(internal_detail),
            "public message leaked {internal_detail:?}: {snapshot:?}"
        );
    }
}

async fn typed_numeric_path(ApiPath(_value): ApiPath<u64>) {}

#[tokio::test]
async fn json_success_routes_use_api_response_envelope() {
    let response = build_app(test_state("http-contract-success"))
        .oneshot(
            Request::builder()
                .uri("/api/v1/jobs")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("list jobs request"),
        )
        .await
        .expect("list jobs response");

    assert_eq!(response.status(), StatusCode::OK);
    let body = read_json(response).await;
    assert_eq!(body["code"], 0);
    assert_eq!(body["message"], "ok");
    assert!(body.get("data").is_some());
}

#[tokio::test]
async fn missing_api_key_uses_json_error_envelope() {
    let response = build_app(test_state("http-contract-unauthorized"))
        .oneshot(
            Request::builder()
                .uri("/api/v1/jobs")
                .body(Body::empty())
                .expect("list jobs request"),
        )
        .await
        .expect("list jobs response");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_json(response).await;
    assert_eq!(body["code"], 40100);
    assert_eq!(body["message"], "missing or invalid X-API-Key");
    assert!(body.get("data").is_none());
    assert_eq!(body["error"]["code"], "UNAUTHORIZED");
    assert_eq!(body["error"]["http_status"], 401);
    assert_eq!(body["error"]["details"], json!({}));
}

#[tokio::test]
async fn missing_job_uses_json_not_found_envelope() {
    let response = build_app(test_state("http-contract-not-found"))
        .oneshot(
            Request::builder()
                .uri("/api/v1/jobs/missing-job")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("job detail request"),
        )
        .await
        .expect("job detail response");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = read_json(response).await;
    assert_eq!(body["code"], 40400);
    assert!(body["message"]
        .as_str()
        .expect("message")
        .contains("missing-job"));
    assert!(body.get("data").is_none());
    assert_eq!(body["error"]["code"], "NOT_FOUND");
    assert_eq!(body["error"]["http_status"], 404);
    assert_eq!(body["error"]["details"], json!({}));
}

#[tokio::test]
async fn invalid_job_payload_uses_json_bad_request_envelope() {
    let response = build_app(test_state("http-contract-bad-request"))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/jobs")
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(json!({"source": 3}).to_string()))
                .expect("create job request"),
        )
        .await
        .expect("create job response");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = read_json(response).await;
    assert_eq!(body["code"], 40000);
    assert_eq!(
        body["message"], "invalid job payload: request body does not match the expected schema",
        "不回 serde 原文（里面带着提交的值）"
    );
    assert!(body.get("data").is_none());
    assert_eq!(body["error"]["code"], "BAD_REQUEST");
    assert_eq!(body["error"]["http_status"], 400);
    assert_eq!(body["error"]["details"], json!({ "reason": "schema_mismatch" }));
}

#[tokio::test]
async fn ocr_artifact_error_preserves_legacy_fields_and_exposes_safe_details() {
    let response = AppError::ocr_artifact_reuse(
        StatusCode::CONFLICT,
        "OCR_ARTIFACT_NOT_REUSABLE",
        "existing OCR artifact cannot be reused",
        "missing_layout_data",
    )
    .into_response();

    assert_eq!(response.status(), StatusCode::CONFLICT);
    let body = read_json(response).await;
    assert_eq!(body["code"], "OCR_ARTIFACT_NOT_REUSABLE");
    assert_eq!(body["message"], "existing OCR artifact cannot be reused");
    assert_eq!(body["reason"], "missing_layout_data");
    assert_eq!(body["can_fallback_to_ocr"], true);
    assert!(body.get("data").is_none());

    assert_eq!(body["error"]["code"], "OCR_ARTIFACT_NOT_REUSABLE");
    assert_eq!(body["error"]["http_status"], 409);
    assert_eq!(
        body["error"]["details"],
        json!({
            "reason": "missing_layout_data",
            "can_fallback_to_ocr": true,
        })
    );
    let details = body["error"]["details"]
        .as_object()
        .expect("OCR error details object");
    assert_eq!(details.len(), 2);
    for forbidden in [
        "request_hash",
        "token",
        "raw_request",
        "existing_receipt",
        "upload_url",
    ] {
        assert!(details.get(forbidden).is_none(), "leaked {forbidden}");
    }
}

#[tokio::test]
async fn credential_error_preserves_legacy_fields_and_uses_unified_error_object() {
    let response = AppError::credential_reference(
        StatusCode::NOT_FOUND,
        "CREDENTIAL_REF_NOT_FOUND",
        "credential reference not found",
    )
    .into_response();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = read_json(response).await;
    assert_eq!(body["code"], "CREDENTIAL_REF_NOT_FOUND");
    assert_eq!(body["message"], "credential reference not found");
    assert!(body.get("data").is_none());
    assert_eq!(body["error"]["code"], "CREDENTIAL_REF_NOT_FOUND");
    assert_eq!(body["error"]["http_status"], 404);
    assert_eq!(body["error"]["details"], json!({}));
}

#[tokio::test]
async fn live_translation_error_preserves_legacy_fields_and_uses_unified_error_object() {
    let response = AppError::live_translation(
        StatusCode::CONFLICT,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE",
        "committed translation snapshot is unavailable",
    )
    .into_response();

    assert_eq!(response.status(), StatusCode::CONFLICT);
    let body = read_json(response).await;
    assert_eq!(body["code"], "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE");
    assert_eq!(
        body["message"],
        "committed translation snapshot is unavailable"
    );
    assert!(body.get("data").is_none());
    assert_eq!(
        body["error"]["code"],
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
    );
    assert_eq!(body["error"]["http_status"], 409);
    assert_eq!(body["error"]["details"], json!({}));
}

#[tokio::test]
async fn malformed_axum_json_rejection_uses_unified_error_envelope() {
    let response = build_app(test_state("http-contract-malformed-json"))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/credentials")
                .header("X-API-Key", "test-key")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from("{"))
                .expect("malformed credential request"),
        )
        .await
        .expect("malformed credential response");
    let snapshot = error_response_snapshot(response).await;

    assert_body_error(&snapshot, "invalid_json");
}

#[tokio::test]
async fn malformed_axum_query_rejection_uses_unified_error_envelope() {
    let response = build_app(test_state("http-contract-malformed-query"))
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/v1/credentials/cred_missing?expected_revision=not-a-number")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("malformed credential query request"),
        )
        .await
        .expect("malformed credential query response");
    let snapshot = error_response_snapshot(response).await;

    assert_unified_generic_error(&snapshot, StatusCode::BAD_REQUEST, 40000, "BAD_REQUEST");
}

#[tokio::test]
async fn unknown_route_uses_unified_not_found_envelope() {
    let response = build_app(test_state("http-contract-unknown-route"))
        .oneshot(
            Request::builder()
                .uri("/api/v1/definitely-missing")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("unknown route request"),
        )
        .await
        .expect("unknown route response");
    let snapshot = error_response_snapshot(response).await;

    assert_unified_generic_error(&snapshot, StatusCode::NOT_FOUND, 40400, "NOT_FOUND");
}

#[tokio::test]
async fn method_not_allowed_uses_unified_error_envelope() {
    let response = build_app(test_state("http-contract-method-not-allowed"))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/credentials/cred_missing")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("method not allowed request"),
        )
        .await
        .expect("method not allowed response");
    let snapshot = error_response_snapshot(response).await;

    assert_unified_generic_error(
        &snapshot,
        StatusCode::METHOD_NOT_ALLOWED,
        40500,
        "METHOD_NOT_ALLOWED",
    );
}

#[tokio::test]
/// 第 13 条（2026-11-24）：字段类型写错以前是 axum 默认的 422，现在和其余「请求写错了」一样是 400。
async fn json_data_mismatch_is_400_and_redacts_parser_details() {
    let response = build_app(test_state("http-contract-json-data-mismatch"))
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/credentials")
                .header("X-API-Key", "test-key")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "kind": {"unexpected": true},
                        "secret": "do-not-echo-this-value",
                    })
                    .to_string(),
                ))
                .expect("credential schema mismatch request"),
        )
        .await
        .expect("credential schema mismatch response");
    let snapshot = error_response_snapshot(response).await;

    assert_body_error(&snapshot, "schema_mismatch");
    assert_safe_message(&snapshot, "JSON request body does not match the expected schema");
}

#[tokio::test]
async fn missing_json_content_type_keeps_415_and_redacts_parser_details() {
    let response = build_app(test_state("http-contract-json-content-type"))
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/credentials")
                .header("X-API-Key", "test-key")
                .body(Body::from(
                    json!({
                        "kind": "translation_api_key",
                        "secret": "do-not-echo-this-value",
                    })
                    .to_string(),
                ))
                .expect("credential missing content type request"),
        )
        .await
        .expect("credential missing content type response");
    let snapshot = error_response_snapshot(response).await;

    assert_safe_unified_generic_error(
        &snapshot,
        StatusCode::UNSUPPORTED_MEDIA_TYPE,
        41500,
        "UNSUPPORTED_MEDIA_TYPE",
        "expected an application/json request body",
    );
}

#[tokio::test]
async fn default_json_body_limit_keeps_413_and_uses_safe_message() {
    let oversized_secret = "x".repeat(3 * 1024 * 1024);
    let response = build_app(test_state("http-contract-json-body-limit"))
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/credentials")
                .header("X-API-Key", "test-key")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "kind": "translation_api_key",
                        "secret": oversized_secret,
                    })
                    .to_string(),
                ))
                .expect("oversized credential request"),
        )
        .await
        .expect("oversized credential response");
    let snapshot = error_response_snapshot(response).await;

    assert_safe_unified_generic_error(
        &snapshot,
        StatusCode::PAYLOAD_TOO_LARGE,
        41300,
        "PAYLOAD_TOO_LARGE",
        "request body is too large",
    );
}

#[tokio::test]
async fn typed_path_deserialization_uses_safe_bad_request_envelope() {
    let response = Router::new()
        .route("/typed/:value", get(typed_numeric_path))
        .oneshot(
            Request::builder()
                .uri("/typed/not-a-number")
                .body(Body::empty())
                .expect("typed path request"),
        )
        .await
        .expect("typed path response");
    let snapshot = error_response_snapshot(response).await;

    assert_safe_unified_generic_error(
        &snapshot,
        StatusCode::BAD_REQUEST,
        40000,
        "BAD_REQUEST",
        "invalid path parameters",
    );
}

#[tokio::test]
async fn malformed_multipart_boundary_uses_safe_bad_request_envelope() {
    let response = build_app(test_state("http-contract-multipart-boundary"))
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/uploads")
                .header("X-API-Key", "test-key")
                .header(header::CONTENT_TYPE, "multipart/form-data")
                .body(Body::empty())
                .expect("malformed multipart request"),
        )
        .await
        .expect("malformed multipart response");
    let snapshot = error_response_snapshot(response).await;

    assert_safe_unified_generic_error(
        &snapshot,
        StatusCode::BAD_REQUEST,
        40000,
        "BAD_REQUEST",
        "invalid multipart request",
    );
}

#[tokio::test]
async fn wrong_method_with_valid_key_keeps_allow_header() {
    let response = build_app(test_state("http-contract-method-allow"))
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/credentials/cred_missing")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("wrong method request"),
        )
        .await
        .expect("wrong method response");
    let snapshot = error_response_snapshot(response).await;

    assert_safe_unified_generic_error(
        &snapshot,
        StatusCode::METHOD_NOT_ALLOWED,
        40500,
        "METHOD_NOT_ALLOWED",
        "method not allowed",
    );
    let allowed = snapshot
        .allow
        .as_deref()
        .expect("405 response Allow header");
    for method in ["GET", "HEAD", "PUT", "DELETE"] {
        assert!(
            allowed
                .split(',')
                .any(|candidate| candidate.trim() == method),
            "Allow header omitted {method}: {snapshot:?}"
        );
    }
}

#[tokio::test]
async fn wrong_method_without_key_is_still_unauthorized() {
    let response = build_app(test_state("http-contract-method-auth-priority"))
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/credentials/cred_missing")
                .body(Body::empty())
                .expect("unauthenticated wrong method request"),
        )
        .await
        .expect("unauthenticated wrong method response");
    let snapshot = error_response_snapshot(response).await;

    assert_safe_unified_generic_error(
        &snapshot,
        StatusCode::UNAUTHORIZED,
        40100,
        "UNAUTHORIZED",
        "missing or invalid X-API-Key",
    );
}

/// 文件出口、删任务、边翻边看的流：查询串里不认识的参数 400（只回参数名、不回值），认识的照常往下走
/// （这里任务、书都不存在，所以认识的参数走到 404）。前端读原文带的 `?version=`、下载 Markdown 带的
/// `?include_job_dir=true` 是认识的。2026-11-24 起。
#[tokio::test]
async fn unknown_query_parameters_on_files_delete_and_live_stream_are_rejected() {
    let app = build_app(test_state("http-contract-unknown-query"));
    let send = |method: &'static str, uri: &'static str| {
        let app = app.clone();
        async move {
            let response = app
                .oneshot(
                    Request::builder()
                        .method(method)
                        .uri(uri)
                        .header("X-API-Key", "test-key")
                        .body(Body::empty())
                        .expect("request"),
                )
                .await
                .expect("response");
            let status = response.status();
            (status, read_json(response).await)
        }
    };
    for (method, uri, field) in [
        ("GET", "/api/v1/jobs/missing-job/files/output/translated.pdf?download=1&secret=leak-me", "secret"),
        ("GET", "/api/v1/jobs/missing-job/files/pages/1.jpg?w=leak-me", "w"),
        ("GET", "/api/v1/jobs/missing-job/files/internal/translations?x=leak-me", "x"),
        ("GET", "/api/v1/documents/missing-doc/files/source.pdf?v=leak-me", "v"),
        ("GET", "/api/v1/documents/missing-doc/files/pages/1.jpg?w=leak-me", "w"),
        ("DELETE", "/api/v1/jobs/missing-job?forse=leak-me", "forse"),
        ("GET", "/api/v1/jobs/missing-job/progress/stream?after=leak-me", "after"),
    ] {
        let (status, body) = send(method, uri).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{method} {uri}: {body}");
        let message = body["message"].as_str().expect("message");
        assert!(message.starts_with(&format!("unknown field `{field}`")), "{method} {uri}: {message}");
        assert!(message.ends_with("in the query string"), "{message}");
        assert!(!message.contains("leak-me"), "不回值: {message}");
    }
    for (method, uri) in [
        ("GET", "/api/v1/jobs/missing-job/files/output/translated.docx?download=1&dpi=150&watermark=0"),
        ("GET", "/api/v1/jobs/missing-job/files/pages/1.jpg?width=320&dpi=72"),
        ("GET", "/api/v1/documents/missing-doc/files/source.pdf?version=rev-2"),
        ("GET", "/api/v1/documents/missing-doc/files/source.pdf?download=1"),
        ("GET", "/api/v1/jobs/missing-job/files/output/ocr.zip?include_job_dir=true"),
        ("DELETE", "/api/v1/jobs/missing-job?force=true"),
        ("GET", "/api/v1/jobs/missing-job/progress/stream?after_seq=3"),
    ] {
        let (status, body) = send(method, uri).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{method} {uri}: {body}");
    }
}
