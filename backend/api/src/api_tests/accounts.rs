//! 多用户模式的登录、会话、管理员建号，以及单机模式不受影响。

use std::sync::Arc;

use axum::body::Body;
use axum::http::{header, Method, Request, StatusCode};
use axum::response::Response;
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::{build_app, build_state};
use crate::config::{AccountsConfig, AppConfig, DeploymentMode};
use crate::test_support::config::TestDirs;

const ADMIN_PASSWORD: &str = "bootstrap-pass";

fn multi_state(name: &str) -> crate::AppState {
    let dirs = TestDirs::create(&format!("rust-api-accounts-{name}-{}", fastrand::u64(..)));
    let config = AppConfig {
        accounts: AccountsConfig {
            mode: DeploymentMode::Multi,
            session_cookie_secure: false,
            allowed_origins: vec!["https://app.example.com".into()],
            bootstrap_admin: Some(("root".into(), ADMIN_PASSWORD.into())),
            ..AccountsConfig::default()
        },
        ..dirs.config()
    };
    build_state(Arc::new(config)).expect("build state")
}

async fn send(
    state: &crate::AppState,
    method: Method,
    uri: &str,
    cookie: Option<&str>,
    body: Option<Value>,
) -> Response {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some(cookie) = cookie {
        builder = builder.header(header::COOKIE, format!("retain_session={cookie}"));
    }
    let body = match body {
        Some(value) => {
            builder = builder.header(header::CONTENT_TYPE, "application/json");
            Body::from(value.to_string())
        }
        None => Body::empty(),
    };
    build_app(state.clone()).oneshot(builder.body(body).unwrap()).await.unwrap()
}

fn session_cookie(response: &Response) -> String {
    let raw = response.headers().get(header::SET_COOKIE).expect("set-cookie").to_str().unwrap();
    assert!(raw.contains("HttpOnly") && raw.contains("SameSite=Lax"), "{raw}");
    raw.split(';').next().unwrap().trim_start_matches("retain_session=").to_string()
}

async fn login(state: &crate::AppState, username: &str, password: &str) -> String {
    let response = send(
        state,
        Method::POST,
        "/api/v1/auth/login",
        None,
        Some(json!({ "username": username, "password": password })),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    session_cookie(&response)
}

#[tokio::test]
async fn single_mode_reports_the_local_user_and_keeps_api_keys() {
    let state = test_state("accounts-single");
    let response = send(&state, Method::GET, "/api/v1/auth/session", None, None).await;
    let body = read_json(response).await;
    assert_eq!(body["data"]["mode"], "single");
    assert_eq!(body["data"]["authenticated"], true);
    assert_eq!(body["data"]["user"]["user_id"], "local");
    let response = send(&state, Method::POST, "/api/v1/auth/login", None, Some(json!({"username":"a","password":"b"}))).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn login_session_logout_round_trip() {
    let state = multi_state("round-trip");
    let anonymous = read_json(send(&state, Method::GET, "/api/v1/auth/session", None, None).await).await;
    assert_eq!(anonymous["data"], json!({ "mode": "multi", "authenticated": false, "user": null }));

    let response = send(&state, Method::GET, "/api/v1/jobs", None, None).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let cookie = login(&state, "root", ADMIN_PASSWORD).await;
    let me = read_json(send(&state, Method::GET, "/api/v1/auth/session", Some(&cookie), None).await).await;
    assert_eq!(me["data"]["user"]["username"], "root");
    assert_eq!(me["data"]["user"]["role"], "admin");
    assert_eq!(send(&state, Method::GET, "/api/v1/jobs", Some(&cookie), None).await.status(), StatusCode::OK);

    let response = send(&state, Method::POST, "/api/v1/auth/logout", Some(&cookie), None).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert!(response.headers()[header::SET_COOKIE].to_str().unwrap().contains("Max-Age=0"));
    assert_eq!(send(&state, Method::GET, "/api/v1/jobs", Some(&cookie), None).await.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn wrong_password_uses_a_stable_error_code() {
    let state = multi_state("wrong");
    let response = send(&state, Method::POST, "/api/v1/auth/login", None, Some(json!({"username":"root","password":"nope-nope"}))).await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_json(response).await;
    assert_eq!(body["code"], "INVALID_CREDENTIALS");
    assert_eq!(body["error"]["code"], "INVALID_CREDENTIALS");
    let unknown = send(&state, Method::POST, "/api/v1/auth/login", None, Some(json!({"username":"ghost","password":"nope-nope"}))).await;
    assert_eq!(read_json(unknown).await["code"], "INVALID_CREDENTIALS", "不泄露账号是否存在");
}

#[tokio::test]
async fn admin_creates_a_user_who_must_change_the_initial_password() {
    let state = multi_state("admin-create");
    let admin = login(&state, "root", ADMIN_PASSWORD).await;
    let response = send(&state, Method::POST, "/api/v1/admin/users", Some(&admin), Some(json!({ "username": "Reader.One" }))).await;
    assert_eq!(response.status(), StatusCode::CREATED);
    assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
    let created = read_json(response).await;
    let initial = created["data"]["initial_password"].as_str().unwrap().to_string();
    let user_id = created["data"]["user"]["user_id"].as_str().unwrap().to_string();
    assert_eq!(created["data"]["user"]["role"], "user");
    assert_eq!(created["data"]["user"]["must_change_password"], true);

    let dup = send(&state, Method::POST, "/api/v1/admin/users", Some(&admin), Some(json!({ "username": "reader.one" }))).await;
    assert_eq!(dup.status(), StatusCode::CONFLICT);
    assert_eq!(read_json(dup).await["code"], "USERNAME_TAKEN");

    let user = login(&state, "reader.one", &initial).await;
    let forbidden = send(&state, Method::GET, "/api/v1/admin/users", Some(&user), None).await;
    assert_eq!(forbidden.status(), StatusCode::FORBIDDEN);

    let changed = send(
        &state,
        Method::POST,
        "/api/v1/auth/password",
        Some(&user),
        Some(json!({ "current_password": initial, "new_password": "my-own-password" })),
    )
    .await;
    assert_eq!(changed.status(), StatusCode::OK);
    assert_eq!(read_json(changed).await["data"]["user"]["must_change_password"], false);

    let disabled = send(&state, Method::POST, &format!("/api/v1/admin/users/{user_id}/disable"), Some(&admin), None).await;
    assert_eq!(read_json(disabled).await["data"]["user"]["status"], "disabled");
    assert_eq!(send(&state, Method::GET, "/api/v1/jobs", Some(&user), None).await.status(), StatusCode::UNAUTHORIZED);
    let blocked = send(&state, Method::POST, "/api/v1/auth/login", None, Some(json!({"username":"reader.one","password":"my-own-password"}))).await;
    assert_eq!(blocked.status(), StatusCode::FORBIDDEN);
    assert_eq!(read_json(blocked).await["code"], "ACCOUNT_DISABLED");

    let list = read_json(send(&state, Method::GET, "/api/v1/admin/users", Some(&admin), None).await).await;
    assert_eq!(list["data"]["users"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn cookie_writes_from_foreign_origins_are_rejected() {
    let state = multi_state("origin");
    let cookie = login(&state, "root", ADMIN_PASSWORD).await;
    let request = |origin: &str| {
        Request::builder()
            .method(Method::POST)
            .uri("/api/v1/auth/logout")
            .header(header::COOKIE, format!("retain_session={cookie}"))
            .header(header::ORIGIN, origin)
            .body(Body::empty())
            .unwrap()
    };
    let evil = build_app(state.clone()).oneshot(request("https://evil.example")).await.unwrap();
    assert_eq!(evil.status(), StatusCode::FORBIDDEN);
    let ours = build_app(state.clone()).oneshot(request("https://app.example.com")).await.unwrap();
    assert_eq!(ours.status(), StatusCode::OK);
}

#[tokio::test]
async fn api_key_still_works_for_internal_services_in_multi_mode() {
    let state = multi_state("service-key");
    let response = build_app(state.clone())
        .oneshot(Request::builder().uri("/api/v1/jobs").header("x-api-key", "test-key").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn multi_mode_cors_allows_only_listed_origins_with_credentials() {
    let state = multi_state("cors");
    let preflight = |origin: &str| {
        Request::builder()
            .method(Method::OPTIONS)
            .uri("/api/v1/jobs")
            .header(header::ORIGIN, origin)
            .header(header::ACCESS_CONTROL_REQUEST_METHOD, "GET")
            .body(Body::empty())
            .unwrap()
    };
    let ours = build_app(state.clone()).oneshot(preflight("https://app.example.com")).await.unwrap();
    assert_eq!(ours.headers()[header::ACCESS_CONTROL_ALLOW_ORIGIN], "https://app.example.com");
    assert_eq!(ours.headers()[header::ACCESS_CONTROL_ALLOW_CREDENTIALS], "true");
    let evil = build_app(state.clone()).oneshot(preflight("https://evil.example")).await.unwrap();
    assert!(evil.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN).is_none());
}

#[tokio::test]
async fn multi_mode_has_no_assistant_terminal() {
    let state = multi_state("terminal");
    let cookie = login(&state, "root", ADMIN_PASSWORD).await;
    let response = send(&state, Method::GET, "/api/v1/ai/terminal", Some(&cookie), None).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn wrong_current_password_is_400_not_401_so_the_session_survives() {
    let state = multi_state("wrong-current");
    let cookie = login(&state, "root", ADMIN_PASSWORD).await;
    let response = send(
        &state,
        Method::POST,
        "/api/v1/auth/password",
        Some(&cookie),
        Some(json!({ "current_password": "not-it-at-all", "new_password": "whatever-new" })),
    )
    .await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(read_json(response).await["code"], "WRONG_PASSWORD");
    assert_eq!(send(&state, Method::GET, "/api/v1/jobs", Some(&cookie), None).await.status(), StatusCode::OK);
}
