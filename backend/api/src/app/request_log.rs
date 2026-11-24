//! 请求编号和请求日志。
//!
//! - 每个请求一个编号，放在请求头和回应头的 `X-Request-ID` 里。客户端（或前面的 nginx）带了像样的编号就沿用，
//!   没带或不像样（太长、有别的字符）就生成一个，这样客户端、nginx、后端的日志能对上。
//! - 每个请求一个 `request` span（info 级），记方法、路径和编号，不记查询串：助手终端握手可以把 key 放在查询参数里
//!   （`?api_key=…`）。请求里打的日志都带着这个 span，报错时一眼看出是哪个请求。
//! - 访问日志的目标是 `retainpdf_api::access`：每个请求结束记一条 debug（默认看不到，`RUST_LOG` 里加
//!   `retainpdf_api::access=debug` 才有），慢请求（拿到回应头超过 1 秒）记 info。5xx 照旧由 `tower_http` 记 error。
//! - `RUST_API_ACCESS_LOG=1`（2026-11-24）：每个请求按 info 记一行 `access`，带方法、路由模板（不是具体地址，
//!   没匹配上的是 `-`）、状态码、耗时、是不是长连接、请求编号。在 `route_usage::record` 里记，那里才拿得到路由模板。
//!   默认关：桌面版前端的轮询会把日志刷满。

use std::sync::OnceLock;
use std::time::Duration;

use axum::body::Body;
use axum::extract::Request;
use axum::http::{HeaderMap, HeaderName, HeaderValue, Response};
use axum::middleware::Next;
use tower_http::classify::{ServerErrorsAsFailures, SharedClassifier};
use tower_http::trace::{DefaultOnRequest, TraceLayer};

pub(crate) const REQUEST_ID_HEADER: HeaderName = HeaderName::from_static("x-request-id");

/// 客户端带来的编号最长多长；再长就当没带，自己生成一个。
const MAX_CLIENT_REQUEST_ID_LEN: usize = 64;

/// 拿到回应头超过这么久算慢请求，记 info。
const SLOW_REQUEST: Duration = Duration::from_secs(1);

type RequestSpan = fn(&axum::http::Request<Body>) -> tracing::Span;
type ResponseLog = fn(&Response<Body>, Duration, &tracing::Span);

pub(crate) fn trace_layer(
) -> TraceLayer<SharedClassifier<ServerErrorsAsFailures>, RequestSpan, DefaultOnRequest, ResponseLog> {
    TraceLayer::new_for_http()
        .make_span_with(request_span as RequestSpan)
        .on_response(log_response as ResponseLog)
}

fn request_span(request: &axum::http::Request<Body>) -> tracing::Span {
    let request_id = request
        .headers()
        .get(&REQUEST_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    tracing::info_span!(
        "request",
        method = %request.method(),
        path = %request.uri().path(),
        request_id = %request_id,
    )
}

fn log_response(response: &Response<Body>, latency: Duration, _span: &tracing::Span) {
    let status = response.status().as_u16();
    let latency_ms = latency.as_millis() as u64;
    if latency >= SLOW_REQUEST {
        tracing::info!(target: "retainpdf_api::access", status, latency_ms, "slow request");
    } else {
        tracing::debug!(target: "retainpdf_api::access", status, latency_ms, "request finished");
    }
}

/// `RUST_API_ACCESS_LOG` 开没开（第一次用到时读一次；取值不对在 stderr 报一次、当关）。
pub(crate) fn access_log_enabled() -> bool {
    static ENABLED: OnceLock<bool> = OnceLock::new();
    *ENABLED.get_or_init(|| retainpdf_core::config::env_vars::env_bool("RUST_API_ACCESS_LOG", false))
}

/// 请求头里的编号（`assign_request_id` 已经放好）。
pub(crate) fn request_id_of(headers: &HeaderMap) -> Option<String> {
    headers
        .get(&REQUEST_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned)
}

/// 访问日志的一行（`RUST_API_ACCESS_LOG=1` 时每个请求一行）。
pub(crate) fn log_access(
    method: &str,
    route: Option<&str>,
    status: u16,
    latency: Duration,
    streaming: bool,
    request_id: Option<&str>,
) {
    tracing::info!(
        target: "retainpdf_api::access",
        method,
        route = route.unwrap_or("-"),
        status,
        latency_ms = latency.as_millis() as u64,
        streaming,
        request_id = request_id.unwrap_or_default(),
        "access"
    );
}

/// 给请求定编号（沿用客户端的或生成一个），写进请求头给后面的 span 用，回应头里带回去。
/// 要在 `trace_layer` 外面（后加），span 建出来的时候编号已经在请求头里了。
pub(crate) async fn assign_request_id(mut request: Request, next: Next) -> axum::response::Response {
    let id = request
        .headers()
        .get(&REQUEST_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .filter(|value| is_acceptable_request_id(value))
        .map(str::to_owned)
        .unwrap_or_else(new_request_id);
    let value = HeaderValue::from_str(&id).expect("request ids are visible ASCII");
    request.headers_mut().insert(REQUEST_ID_HEADER, value.clone());
    let mut response = next.run(request).await;
    response.headers_mut().insert(REQUEST_ID_HEADER, value);
    response
}

fn is_acceptable_request_id(value: &str) -> bool {
    (1..=MAX_CLIENT_REQUEST_ID_LEN).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'))
}

fn new_request_id() -> String {
    format!("{:016x}", fastrand::u64(..))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_request_ids_are_kept_only_when_short_and_plain() {
        for kept in ["abc", "0f1e2d3c4b5a6978", "req-1_2.3:4", &"a".repeat(64)] {
            assert!(is_acceptable_request_id(kept), "{kept}");
        }
        for replaced in ["", " ", "a b", "x\ny", "键", &"a".repeat(65), "a/b", "a=b"] {
            assert!(!is_acceptable_request_id(replaced), "{replaced:?}");
        }
        let generated = new_request_id();
        assert_eq!(generated.len(), 16);
        assert!(is_acceptable_request_id(&generated));
    }
}
