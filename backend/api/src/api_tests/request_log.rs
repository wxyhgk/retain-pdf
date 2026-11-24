//! 请求日志不记查询串：助手终端握手可以把 key 放在 `?api_key=…` 里，开 `RUST_LOG=debug` 时不能写进日志。

use std::io::Write;
use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use super::jobs_common::test_state;
use crate::app::build_app;

#[derive(Clone, Default)]
struct Captured(Arc<Mutex<Vec<u8>>>);

impl Write for Captured {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.0.lock().unwrap().extend_from_slice(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

#[tokio::test]
async fn debug_request_logs_keep_the_path_but_not_the_query_string() {
    let captured = Captured::default();
    let writer = captured.clone();
    let subscriber = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .with_ansi(false)
        .with_writer(move || writer.clone())
        .finish();
    let _guard = tracing::subscriber::set_default(subscriber);

    // tracing 的级别和兴趣缓存是全进程共享的，别的测试线程同时在建、丢订阅者时，偶尔会让这边一次请求一条都抓不到；
    // 抓到为止，最多试 20 次。要守的是"抓到的日志里没有 key"。
    let app = build_app(test_state("request-log-query"));
    for _ in 0..20 {
        tracing::callsite::rebuild_interest_cache();
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/health?api_key=query-secret-0123456789")
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        if !captured.0.lock().unwrap().is_empty() {
            break;
        }
    }

    let logs = String::from_utf8(captured.0.lock().unwrap().clone()).unwrap();
    assert!(logs.contains("/health"), "request span should still name the path: {logs}");
    assert!(!logs.contains("query-secret"), "query string leaked into logs: {logs}");
}

/// 每个回应都带 `X-Request-ID`：客户端带了像样的就沿用，没带或不像样就生成一个。
#[tokio::test]
async fn every_response_carries_a_request_id_and_plain_client_ids_are_kept() {
    let app = build_app(test_state("request-id"));
    let request_id = |client: Option<&str>| {
        let app = app.clone();
        let client = client.map(str::to_owned);
        async move {
            let mut request = Request::builder().uri("/health");
            if let Some(client) = client {
                request = request.header("X-Request-ID", client);
            }
            let response = app.oneshot(request.body(Body::empty()).unwrap()).await.unwrap();
            assert_eq!(response.status(), StatusCode::OK);
            response
                .headers()
                .get("x-request-id")
                .expect("response carries a request id")
                .to_str()
                .unwrap()
                .to_owned()
        }
    };

    let generated = request_id(None).await;
    assert_eq!(generated.len(), 16, "{generated}");
    assert_ne!(generated, request_id(None).await, "每个请求一个新编号");
    assert_eq!(request_id(Some("nginx-0f1e2d3c")).await, "nginx-0f1e2d3c");
    let replaced = request_id(Some(&"x".repeat(200))).await;
    assert_eq!(replaced.len(), 16, "太长的不沿用：{replaced}");
    // 没登记的地址（兜底 404）、另一个端口上的应用也带。
    let response = app
        .clone()
        .oneshot(Request::builder().uri("/no-such-route").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert!(response.headers().contains_key("x-request-id"));
    let simple = crate::app::build_simple_app(test_state("request-id-simple"));
    let response = simple
        .oneshot(Request::builder().uri("/ready").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert!(response.headers().contains_key("x-request-id"));
}

/// `RUST_LOG_FORMAT=json`（main.rs 的 `init_tracing` 同样的设置）：访问日志一行一个 JSON 对象，
/// 带级别、target、路由模板，请求编号在 `request` span 里。
#[test]
fn access_log_lines_are_json_objects_with_the_request_span() {
    let captured = Captured::default();
    let writer = captured.clone();
    let subscriber = tracing_subscriber::fmt()
        .json()
        .with_current_span(true)
        .with_span_list(true)
        .with_max_level(tracing::Level::INFO)
        .with_writer(move || writer.clone())
        .finish();
    tracing::subscriber::with_default(subscriber, || {
        tracing::callsite::rebuild_interest_cache();
        let span = tracing::info_span!("request", method = "GET", path = "/api/v1/jobs/abc", request_id = "req-42");
        let _entered = span.enter();
        crate::app::log_access_for_tests("GET", Some("/api/v1/jobs/:job_id"), 404, std::time::Duration::from_millis(12));
    });

    let logs = String::from_utf8(captured.0.lock().unwrap().clone()).unwrap();
    let line: serde_json::Value = serde_json::from_str(logs.lines().next().expect("一行访问日志")).expect("JSON");
    assert_eq!(line["level"], "INFO");
    assert_eq!(line["target"], "retainpdf_api::access");
    assert_eq!(line["fields"]["route"], "/api/v1/jobs/:job_id");
    assert_eq!(line["fields"]["status"], 404);
    assert_eq!(line["fields"]["latency_ms"], 12);
    assert_eq!(line["span"]["request_id"], "req-42");
    assert!(line["timestamp"].is_string());
}
