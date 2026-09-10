//! HTTP application facade for the retainpdf-ai reverse proxy.

use axum::body::Body;
use axum::http::{header::HeaderName, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use futures_util::StreamExt;
use serde_json::Value;

use super::AiGateway;
use crate::error::AppError;

fn forwarded_api_key(headers: &HeaderMap) -> &str {
    headers
        .get("X-API-Key")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
}

fn response_metadata(upstream: &reqwest::Response) -> (StatusCode, String) {
    let status =
        StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let content_type = upstream
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/json")
        .to_string();
    (status, content_type)
}

pub async fn ask(
    gateway: &AiGateway,
    headers: &HeaderMap,
    payload: Value,
) -> Result<Response, AppError> {
    let upstream = gateway.ask(forwarded_api_key(headers), &payload).await?;
    let (status, content_type) = response_metadata(&upstream);
    let idle = gateway.idle_timeout();
    // Body idle is separate from header wait: non-streaming answers may spend
    // their entire model deadline computing before sending response headers.
    let stream =
        futures_util::stream::unfold(Some(upstream.bytes_stream()), move |state| async move {
            let mut upstream = state?;
            match tokio::time::timeout(idle, upstream.next()).await {
                Ok(Some(Ok(bytes))) => Some((Ok(bytes), Some(upstream))),
                Ok(None) => None,
                Ok(Some(Err(error))) => Some((Err(std::io::Error::other(error)), None)),
                Err(_) => Some((
                    Err(std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "AI service response body stalled",
                    )),
                    None,
                )),
            }
        });
    let body = Body::from_stream(stream);
    Ok(streamed_ask_response(status, content_type, body))
}

fn streamed_ask_response(status: StatusCode, content_type: String, body: Body) -> Response {
    (
        status,
        [
            (axum::http::header::CONTENT_TYPE, content_type),
            (axum::http::header::CACHE_CONTROL, "no-cache".to_string()),
            (
                HeaderName::from_static("x-accel-buffering"),
                "no".to_string(),
            ),
        ],
        body,
    )
        .into_response()
}

async fn buffered_runtime_config_response(
    upstream: reqwest::Response,
) -> Result<Response, AppError> {
    let (status, content_type) = response_metadata(&upstream);
    let body = upstream
        .bytes()
        .await
        .map_err(|error| AppError::bad_gateway(format!("AI service response failed: {error}")))?;
    Ok((
        status,
        [
            (axum::http::header::CONTENT_TYPE, content_type),
            (axum::http::header::CACHE_CONTROL, "no-store".to_string()),
        ],
        Body::from(body),
    )
        .into_response())
}

pub async fn get_runtime_config(
    gateway: &AiGateway,
    headers: &HeaderMap,
) -> Result<Response, AppError> {
    let upstream = gateway
        .get_runtime_config(forwarded_api_key(headers))
        .await?;
    buffered_runtime_config_response(upstream).await
}

pub async fn update_runtime_config(
    gateway: &AiGateway,
    headers: &HeaderMap,
    payload: Value,
) -> Result<Response, AppError> {
    let upstream = gateway
        .update_runtime_config(forwarded_api_key(headers), &payload)
        .await?;
    buffered_runtime_config_response(upstream).await
}

#[cfg(test)]
mod tests {
    use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};

    use super::*;

    #[test]
    fn streamed_ask_response_disables_reverse_proxy_buffering() {
        let response = streamed_ask_response(
            StatusCode::OK,
            "text/event-stream".to_string(),
            Body::empty(),
        );

        assert_eq!(
            response.headers().get(CONTENT_TYPE).unwrap(),
            "text/event-stream"
        );
        assert_eq!(response.headers().get(CACHE_CONTROL).unwrap(), "no-cache");
        assert_eq!(response.headers().get("x-accel-buffering").unwrap(), "no");
    }
}
