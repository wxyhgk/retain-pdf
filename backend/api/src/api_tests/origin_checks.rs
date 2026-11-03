//! 单机模式的来源和主机校验：CORS 只回给本机页面、同主机的页面和配置的来源；
//! 后端监听回环地址时，`Host` 不是本机名字、IP 字面量或配置的主机名就拒（防 DNS rebinding）。
//!
//! 方案见 `docs/ops/planning/api-reorg/20261022-单机来源和主机校验.md`。

use std::sync::Arc;

use axum::body::Body;
use axum::http::{header, Method, Request, StatusCode};
use axum::response::Response;
use tower::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::{build_app, build_simple_app, build_state, AppState};
use crate::config::AppConfig;
use crate::test_support::config::TestDirs;

const EVIL: &str = "https://evil.example";

fn state_with(name: &str, tweak: impl FnOnce(&mut AppConfig)) -> AppState {
    let dirs = TestDirs::create(&format!("rust-api-origin-{name}-{}", fastrand::u64(..)));
    let mut config = dirs.config();
    tweak(&mut config);
    build_state(Arc::new(config)).expect("build state")
}

fn preflight(origin: &str, host: Option<&str>) -> Request<Body> {
    let mut builder = Request::builder()
        .method(Method::OPTIONS)
        .uri("/api/v1/jobs")
        .header(header::ORIGIN, origin)
        .header(header::ACCESS_CONTROL_REQUEST_METHOD, "GET")
        .header(header::ACCESS_CONTROL_REQUEST_HEADERS, "x-api-key, content-type, range");
    if let Some(host) = host {
        builder = builder.header(header::HOST, host);
    }
    builder.body(Body::empty()).unwrap()
}

fn get_with(uri: &str, origin: Option<&str>, host: Option<&str>) -> Request<Body> {
    let mut builder = Request::builder().uri(uri).header("x-api-key", "test-key");
    if let Some(origin) = origin {
        builder = builder.header(header::ORIGIN, origin);
    }
    if let Some(host) = host {
        builder = builder.header(header::HOST, host);
    }
    builder.body(Body::empty()).unwrap()
}

async fn call(state: &AppState, request: Request<Body>) -> Response {
    build_app(state.clone()).oneshot(request).await.unwrap()
}

fn allow_origin(response: &Response) -> Option<String> {
    response
        .headers()
        .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
        .map(|value| value.to_str().unwrap().to_string())
}

/// 前端跨源要读 `Content-Disposition`、`Content-Range`、`ETag` 这些响应头。
fn assert_exposes_download_headers(response: &Response) {
    let exposed = response
        .headers()
        .get(header::ACCESS_CONTROL_EXPOSE_HEADERS)
        .expect("Access-Control-Expose-Headers")
        .to_str()
        .unwrap()
        .to_ascii_lowercase();
    assert!(
        exposed == "*" || ["content-disposition", "content-range", "etag"].iter().all(|name| exposed.contains(name)),
        "{exposed}",
    );
}

// ---------------------------------------------------------------- CORS

#[tokio::test]
async fn a_foreign_origin_gets_no_cors_headers_in_single_mode() {
    let state = test_state("origin-evil");
    let response = call(&state, preflight(EVIL, Some("127.0.0.1:41000"))).await;
    assert_eq!(allow_origin(&response), None, "预检不能放行恶意来源");

    let response = call(&state, get_with("/api/v1/jobs", Some(EVIL), Some("127.0.0.1:41000"))).await;
    // 不主动拒：同源代理（serve_same_origin.py）会把页面的 Origin 原样转发过来。
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(allow_origin(&response), None, "普通请求不能回 CORS 头");
}

#[tokio::test]
async fn loopback_pages_on_any_port_get_cors_headers() {
    let state = test_state("origin-loopback");
    for origin in [
        "http://127.0.0.1:40001",
        "http://localhost:40001",
        "https://localhost",
        "http://[::1]:5173",
    ] {
        let response = call(&state, preflight(origin, Some("127.0.0.1:41000"))).await;
        assert_eq!(allow_origin(&response).as_deref(), Some(origin), "{origin}");
        let allowed_headers = response
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_HEADERS)
            .expect("allow headers")
            .to_str()
            .unwrap()
            .to_ascii_lowercase();
        for name in ["x-api-key", "content-type", "range"] {
            assert!(allowed_headers.contains(name), "{allowed_headers}");
        }
        // 单机前端不带 credentials。
        assert!(response.headers().get(header::ACCESS_CONTROL_ALLOW_CREDENTIALS).is_none());

        let response = call(&state, get_with("/api/v1/jobs", Some(origin), Some("127.0.0.1:41000"))).await;
        assert_eq!(allow_origin(&response).as_deref(), Some(origin), "{origin}");
        assert_exposes_download_headers(&response);
    }
}

#[tokio::test]
async fn a_page_on_the_same_host_but_another_port_gets_cors_headers() {
    // 局域网 / 公网 IP 访问开发栈：页面 40001、API 41000。
    let state = test_state("origin-same-host");
    let origin = "http://192.168.1.5:40001";
    let response = call(&state, preflight(origin, Some("192.168.1.5:41000"))).await;
    assert_eq!(allow_origin(&response).as_deref(), Some(origin));
    let response = call(&state, get_with("/api/v1/jobs", Some(origin), Some("192.168.1.5:41000"))).await;
    assert_eq!(allow_origin(&response).as_deref(), Some(origin));
    assert_exposes_download_headers(&response);

    // 反向代理把原来的主机放在 X-Forwarded-Host（浏览器跨源时设不了它）。
    let mut request = preflight("https://pdf.example.com", Some("127.0.0.1:41000"));
    request.headers_mut().insert("x-forwarded-host", "pdf.example.com".parse().unwrap());
    let response = call(&state, request).await;
    assert_eq!(allow_origin(&response).as_deref(), Some("https://pdf.example.com"));

    // 主机不同就不算：只是端口不同才放行。
    let response = call(&state, preflight("http://192.168.1.6:40001", Some("192.168.1.5:41000"))).await;
    assert_eq!(allow_origin(&response), None);
}

#[tokio::test]
async fn a_file_page_origin_null_is_not_allowed() {
    // 桌面壳退回 file:// 时 Origin 是 null，前端那边改成改写 Origin，这里不放行。
    let state = test_state("origin-null");
    let response = call(&state, preflight("null", Some("127.0.0.1:41000"))).await;
    assert_eq!(allow_origin(&response), None);
}

// ---------------------------------------------------------------- Host

#[tokio::test]
async fn a_foreign_host_is_rejected_when_listening_on_loopback() {
    // DNS rebinding：evil.example 解析到 127.0.0.1，页面和 API 同源，CORS 管不着，只能看 Host。
    let state = test_state("host-evil");
    for uri in ["/api/v1/jobs", "/health"] {
        let response = call(&state, get_with(uri, None, Some("evil.example:41000"))).await;
        assert_eq!(response.status(), StatusCode::FORBIDDEN, "{uri}");
        let body = read_json(response).await;
        assert_eq!(body["error"]["code"], "FORBIDDEN", "{body}");
    }
    let response = build_simple_app(state.clone())
        .oneshot(get_with("/ready", None, Some("evil.example")))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn loopback_names_and_ip_literals_pass_the_host_check() {
    let state = test_state("host-ok");
    for host in [
        "127.0.0.1:41000",
        "localhost",
        "localhost:41000",
        "LOCALHOST:41000",
        "[::1]:41000",
        "192.168.1.5:41000",
        "10.0.0.2",
    ] {
        let response = call(&state, get_with("/api/v1/jobs", None, Some(host))).await;
        assert_eq!(response.status(), StatusCode::OK, "{host}");
    }
    // 命令行客户端、单测不带 Host 也照旧。
    let response = call(&state, get_with("/api/v1/jobs", None, None)).await;
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn non_loopback_listening_without_a_host_list_skips_the_host_check() {
    // 已有的域名部署（Docker 里监听 0.0.0.0）升级后不能打不开。
    let state = state_with("host-open", |config| config.bind_host = "0.0.0.0".to_string());
    let response = call(&state, get_with("/api/v1/jobs", None, Some("pdf.example.com"))).await;
    assert_eq!(response.status(), StatusCode::OK);
}

// ---------------------------------------------------------------- 配置的名单

#[tokio::test]
async fn configured_origins_get_cors_headers() {
    // RUST_API_ALLOWED_ORIGINS：页面和 API 不同主机时（例如页面挂在别的域名）要配。
    let state = state_with("origin-configured", |config| {
        config.origin_policy =
            crate::config::OriginPolicyConfig::from_lists("https://pdf.example.com/", "");
    });
    let response = call(&state, preflight("https://pdf.example.com", Some("127.0.0.1:41000"))).await;
    assert_eq!(allow_origin(&response).as_deref(), Some("https://pdf.example.com"));
    let response = call(
        &state,
        get_with("/api/v1/jobs", Some("https://pdf.example.com"), Some("127.0.0.1:41000")),
    )
    .await;
    assert_eq!(allow_origin(&response).as_deref(), Some("https://pdf.example.com"));
    assert_exposes_download_headers(&response);
    // 名单之外的照旧不回。
    let response = call(&state, preflight("https://other.example.com", Some("127.0.0.1:41000"))).await;
    assert_eq!(allow_origin(&response), None);

}

#[tokio::test]
async fn configured_hosts_pass_and_turn_the_check_on_for_non_loopback_listening() {
    // 回环监听 + 本机反向代理把域名放在 Host 里：要配 RUST_API_ALLOWED_HOSTS。
    let state = state_with("host-configured", |config| {
        config.origin_policy = crate::config::OriginPolicyConfig::from_lists("", "pdf.example.com");
    });
    for (host, status) in [
        ("pdf.example.com", StatusCode::OK),
        ("PDF.example.com:443", StatusCode::OK),
        ("127.0.0.1:41000", StatusCode::OK),
        ("evil.example", StatusCode::FORBIDDEN),
    ] {
        let response = call(&state, get_with("/api/v1/jobs", None, Some(host))).await;
        assert_eq!(response.status(), status, "{host}");
    }

    // 监听 0.0.0.0 时配了名单就查。
    let state = state_with("host-configured-open", |config| {
        config.bind_host = "0.0.0.0".to_string();
        config.origin_policy = crate::config::OriginPolicyConfig::from_lists("", "pdf.example.com");
    });
    for (host, status) in [
        ("pdf.example.com", StatusCode::OK),
        ("192.168.1.5:41000", StatusCode::OK),
        ("evil.example", StatusCode::FORBIDDEN),
    ] {
        let response = call(&state, get_with("/api/v1/jobs", None, Some(host))).await;
        assert_eq!(response.status(), status, "{host}");
    }
}

#[tokio::test]
async fn multi_mode_keeps_its_own_cors_and_skips_the_host_check() {
    let state = state_with("origin-multi", |config| {
        config.accounts = crate::config::AccountsConfig {
            mode: crate::config::DeploymentMode::Multi,
            session_cookie_secure: false,
            allowed_origins: vec!["https://app.example.com".into()],
            bootstrap_admin: Some(("root".into(), "root-password-123".into())),
            ..crate::config::AccountsConfig::default()
        };
    });
    let response = call(&state, preflight("http://127.0.0.1:40001", Some("127.0.0.1:41000"))).await;
    assert_eq!(allow_origin(&response), None, "多用户模式只认 RETAIN_ALLOWED_ORIGINS");
    let response = call(&state, get_with("/health", None, Some("app.example.com"))).await;
    assert_eq!(response.status(), StatusCode::OK);
}
