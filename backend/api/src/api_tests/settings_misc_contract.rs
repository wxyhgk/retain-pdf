//! 登录状态 `auth-session.v1`、上传 `uploads.v1` 的生产者锁（2026-11-24）：打真实接口，拿 serde 实际写出来的 JSON，
//! 对着 backend-root/contracts 里的定义核对类型和键集合（多一个键、少一个键都红）。

use axum::body::Body;
use axum::http::{header, Method, Request, StatusCode};
use tower::util::ServiceExt;

use super::accounts::{login, multi_state, send, ADMIN_PASSWORD};
use super::credentials_contract::{assert_exact, ok_data};
use super::job_view_contract::contract;
use super::jobs_common::{minimal_pdf_bytes, read_json, test_state};
use crate::app::build_app;

fn assert_session(value: &serde_json::Value, contract: &serde_json::Value, path: &str) {
    assert_exact(value, contract, "SessionView", path);
    if !value["user"].is_null() {
        assert_exact(&value["user"], contract, "AccountUserView", &format!("{path}.user"));
    }
}

#[tokio::test]
async fn session_views_match_published_schema() {
    let contract = contract("auth-session.v1.schema.json");

    // 单机：固定的本机用户。
    let single = ok_data(&test_state("auth-session-contract-single"), "GET", "/api/v1/auth/session", None).await;
    assert_session(&single, &contract, "single");
    assert!(single["user"].is_object(), "{single}");

    // 多用户：没登录 user 为 null；登录以后有 user。
    let state = multi_state("auth-session-contract-multi");
    let anonymous = read_json(send(&state, Method::GET, "/api/v1/auth/session", None, None).await).await;
    assert_session(&anonymous["data"], &contract, "multi(anonymous)");
    assert!(anonymous["data"]["user"].is_null(), "{anonymous}");
    let cookie = login(&state, "root", ADMIN_PASSWORD).await;
    let signed = read_json(send(&state, Method::GET, "/api/v1/auth/session", Some(&cookie), None).await).await;
    assert_session(&signed["data"], &contract, "multi(signed)");
    assert_eq!(signed["data"]["authenticated"], true, "{signed}");
}

#[tokio::test]
async fn upload_view_matches_published_schema() {
    const BOUNDARY: &str = "retainpdf-uploads-contract";
    let contract = contract("uploads.v1.schema.json");
    let state = test_state("uploads-contract");
    let mut body = Vec::new();
    body.extend_from_slice(
        format!(
            "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"contract.pdf\"\r\nContent-Type: application/pdf\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(&minimal_pdf_bytes(595, 842));
    body.extend_from_slice(
        format!("\r\n--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"developer_mode\"\r\n\r\n1\r\n--{BOUNDARY}--\r\n")
            .as_bytes(),
    );
    let request = Request::builder()
        .method("POST")
        .uri("/api/v1/uploads")
        .header("X-API-Key", "test-key")
        .header(header::CONTENT_TYPE, format!("multipart/form-data; boundary={BOUNDARY}"))
        .body(Body::from(body))
        .unwrap();
    let response = build_app(state).oneshot(request).await.unwrap();
    let status = response.status();
    let payload = read_json(response).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    assert_exact(&payload["data"], &contract, "UploadView", "upload");
}
