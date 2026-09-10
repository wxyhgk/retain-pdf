//! Loopback-only proxy contracts; no model or global environment mutation.
use crate::services::ai::AiGateway;
use axum::body::{to_bytes, Body, Bytes};
use axum::http::{Request, StatusCode};
use axum::response::Response;
use axum::routing::any;
use axum::Router;
use futures_util::StreamExt;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use std::time::Duration;
use tower::ServiceExt;

struct Upstream {
    base: String,
    task: tokio::task::JoinHandle<()>,
}
impl Drop for Upstream {
    fn drop(&mut self) {
        self.task.abort();
    }
}
impl Upstream {
    async fn start(router: Router) -> Self {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let task = tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
        Self { base, task }
    }
    fn app(&self) -> Router {
        self.app_with(|_| {})
    }
    fn app_with(&self, configure: impl FnOnce(&mut crate::config::AiProxyConfig)) -> Router {
        let mut state = super::jobs_common::test_state("ai-proxy-contract");
        let mut config = state.config.ai_proxy.clone();
        config.service_base = Some(self.base.clone());
        config.connect_timeout = Duration::from_secs(1);
        config.header_timeout = Duration::from_millis(200);
        config.idle_timeout = Duration::from_millis(300);
        config.runtime_config_timeout = Duration::from_millis(400);
        configure(&mut config);
        state.ai_gateway = Arc::new(AiGateway::new(&config, String::new(), || 0).unwrap());
        crate::app::build_app(state)
    }
}

#[tokio::test]
async fn ai_proxy_runtime_config_has_total_body_deadline() {
    let upstream = Upstream::start(Router::new().fallback(any(|| async {
        let stream = futures_util::stream::unfold((), |_| async {
            tokio::time::sleep(Duration::from_millis(20)).await;
            Some((Ok::<_, std::io::Error>(Bytes::from_static(b" ")), ()))
        });
        Response::new(Body::from_stream(stream))
    })))
    .await;
    let app = upstream.app_with(|config| {
        config.idle_timeout = Duration::from_secs(2);
        config.runtime_config_timeout = Duration::from_millis(150);
    });
    let response = tokio::time::timeout(
        Duration::from_secs(2),
        app.oneshot(request(
            "GET",
            "/api/v1/ai/runtime-config",
            Some("test-key"),
        )),
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
}

#[tokio::test]
async fn ai_proxy_http_disconnect_releases_upstream_stream() {
    struct Released(Arc<tokio::sync::Notify>);
    impl Drop for Released {
        fn drop(&mut self) {
            self.0.notify_one();
        }
    }
    let released = Arc::new(tokio::sync::Notify::new());
    let signal = released.clone();
    let upstream = Upstream::start(Router::new().fallback(any(move || {
        let guard = Released(signal.clone());
        async move {
            let stream = futures_util::stream::unfold((false, guard), |(sent, guard)| async move {
                if sent {
                    std::future::pending::<()>().await;
                }
                Some((
                    Ok::<_, std::io::Error>(Bytes::from_static(b"data: synthetic\n\n")),
                    (true, guard),
                ))
            });
            Response::new(Body::from_stream(stream))
        }
    })))
    .await;
    // Two real loopback HTTP hops; use a long idle limit so timeout cannot pass this test.
    let proxy =
        Upstream::start(upstream.app_with(|c| c.idle_timeout = Duration::from_secs(30))).await;
    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    let response = client
        .post(format!("{}/api/v1/ai/ask", proxy.base))
        .header("X-API-Key", "test-key")
        .json(&serde_json::json!({"question":"synthetic","stream":true}))
        .send()
        .await
        .unwrap();
    let mut body = response.bytes_stream();
    assert!(tokio::time::timeout(Duration::from_secs(2), body.next())
        .await
        .unwrap()
        .unwrap()
        .is_ok());
    drop(body);
    tokio::time::timeout(Duration::from_secs(2), released.notified())
        .await
        .expect("HTTP disconnect did not release upstream body");
}
fn request(method: &str, path: &str, key: Option<&str>) -> Request<Body> {
    let mut builder = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json");
    if let Some(key) = key {
        builder = builder.header("X-API-Key", key);
    }
    builder
        .body(Body::from(r#"{"question":"synthetic","stream":true}"#))
        .unwrap()
}

#[tokio::test]
async fn ai_proxy_forwards_all_routes_and_authenticates_before_upstream() {
    let calls = Arc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let upstream = Upstream::start(Router::new().fallback(any(move |request: Request<Body>| {
        let seen = seen.clone();
        async move {
            seen.fetch_add(1, Ordering::SeqCst);
            let method = request.method().to_string();
            let path = request.uri().path().to_string();
            assert_eq!(request.headers()["X-API-Key"], "test-key");
            let body = to_bytes(request.into_body(), 4096).await.unwrap();
            if method != "GET" {
                assert_eq!(
                    serde_json::from_slice::<serde_json::Value>(&body).unwrap()["question"],
                    "synthetic"
                );
            }
            (
                StatusCode::CONFLICT,
                axum::Json(serde_json::json!({"method":method,"path":path})),
            )
        }
    })))
    .await;
    for (method, path, target) in [
        ("POST", "/api/v1/ai/ask", "/v1/ask"),
        ("GET", "/api/v1/ai/runtime-config", "/v1/runtime-config"),
        ("PUT", "/api/v1/ai/runtime-config", "/v1/runtime-config"),
    ] {
        let app = upstream.app();
        let before = calls.load(Ordering::SeqCst);
        for key in [None, Some("wrong")] {
            let response = app
                .clone()
                .oneshot(request(method, path, key))
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        }
        assert_eq!(calls.load(Ordering::SeqCst), before);
        let response = app
            .oneshot(request(method, path, Some(" test-key ")))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CONFLICT);
        assert_eq!(
            response.headers()["cache-control"],
            if target == "/v1/ask" {
                "no-cache"
            } else {
                "no-store"
            }
        );
        let body = to_bytes(response.into_body(), 4096).await.unwrap();
        let value: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(value["path"], target);
        assert_eq!(value["method"], method);
    }
}

#[tokio::test]
async fn ai_proxy_bounds_response_header_wait() {
    let upstream = Upstream::start(
        Router::new().fallback(any(|| async { std::future::pending::<Response>().await })),
    )
    .await;
    let response = tokio::time::timeout(
        Duration::from_secs(2),
        upstream
            .app()
            .oneshot(request("POST", "/api/v1/ai/ask", Some("test-key"))),
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
    let value: serde_json::Value =
        serde_json::from_slice(&to_bytes(response.into_body(), 4096).await.unwrap()).unwrap();
    assert_eq!(value["message"], "AI service response headers timed out");
}

#[tokio::test]
async fn ai_proxy_does_not_apply_body_idle_budget_before_headers() {
    let upstream = Upstream::start(Router::new().fallback(any(|| async {
        tokio::time::sleep(Duration::from_millis(150)).await;
        axum::Json(serde_json::json!({"answer": "synthetic"}))
    })))
    .await;
    let response = upstream
        .app_with(|config| {
            config.header_timeout = Duration::from_secs(2);
            config.idle_timeout = Duration::from_millis(30);
        })
        .oneshot(request("POST", "/api/v1/ai/ask", Some("test-key")))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert!(to_bytes(response.into_body(), 4096).await.is_ok());
}

#[tokio::test]
async fn ai_proxy_streams_first_chunk_then_errors_on_idle_without_fabricating_done() {
    let upstream = Upstream::start(Router::new().fallback(any(|| async {
        let stream = futures_util::stream::once(async {
            Ok::<_, std::io::Error>(Bytes::from_static(
                b"data: {\"type\":\"answer_delta\",\"text\":\"x\"}\n\n",
            ))
        })
        .chain(futures_util::stream::pending());
        Response::builder()
            .header("content-type", "text/event-stream")
            .body(Body::from_stream(stream))
            .unwrap()
    })))
    .await;
    let response = upstream
        .app()
        .oneshot(request("POST", "/api/v1/ai/ask", Some("test-key")))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let mut body = response.into_body().into_data_stream();
    let first = tokio::time::timeout(Duration::from_secs(2), body.next())
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    assert!(std::str::from_utf8(&first)
        .unwrap()
        .contains("answer_delta"));
    assert!(!std::str::from_utf8(&first).unwrap().contains("done"));
    assert!(tokio::time::timeout(Duration::from_secs(2), body.next())
        .await
        .unwrap()
        .unwrap()
        .is_err());
}
