//! 转发：认这单的凭证、换上这一档配的模型和我们的 key、查 token 上限、读回答里的用量记账，
//! 回给客户端的只有状态码、内容类型和回答本身（上游的响应头不带；报错里像 key 的东西去掉）。

use axum::body::Bytes;
use axum::extract::State;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use chrono::Utc;
use serde_json::{json, Value};

use crate::secrets::redact;
use crate::store::{Order, Route};
use crate::AppState;

/// 转发到哪一类上游。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Upstream {
    AnthropicMessages,
    OpenAiChat,
    OpenAiResponses,
    GlmOcr,
}

impl Upstream {
    fn tier(self, order: &Order) -> &'static str {
        match self {
            Self::GlmOcr => "ocr",
            _ => order.mode.as_str(),
        }
    }

    fn protocol(self) -> &'static str {
        match self {
            Self::AnthropicMessages => "anthropic",
            Self::OpenAiChat | Self::OpenAiResponses => "openai",
            Self::GlmOcr => "glm_ocr",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::AnthropicMessages => "anthropic.messages",
            Self::OpenAiChat => "openai.chat",
            Self::OpenAiResponses => "openai.responses",
            Self::GlmOcr => "glm.layout_parsing",
        }
    }

    fn url(self, route: &Route) -> String {
        let base = route.base_url.trim_end_matches('/');
        match self {
            Self::AnthropicMessages => format!("{base}/messages"),
            Self::OpenAiChat => format!("{base}/chat/completions"),
            Self::OpenAiResponses => format!("{base}/responses"),
            Self::GlmOcr => base.to_string(),
        }
    }
}

/// 一次请求的用量。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Usage {
    pub input: i64,
    pub output: i64,
    pub cache_read: i64,
    pub cache_write: i64,
    pub ocr_pages: i64,
}

impl Usage {
    /// 算进这单 token 上限的：输入、输出、写缓存（读缓存很便宜，不算）。
    pub fn billable_tokens(&self) -> i64 {
        self.input + self.output + self.cache_write
    }
}

fn int(value: Option<&Value>) -> i64 {
    value.and_then(Value::as_i64).unwrap_or(0)
}

/// 从回答里读用量：JSON 整体，或者流式（SSE）的每个 `data:` 行，各字段取最大值。
pub fn usage_from_body(upstream: Upstream, body: &[u8]) -> Usage {
    let mut usage = Usage::default();
    let mut absorb = |value: &Value| {
        if upstream == Upstream::GlmOcr {
            if let Some(pages) = value.get("layout_details").and_then(Value::as_array) {
                usage.ocr_pages = usage.ocr_pages.max(pages.len() as i64);
            }
        }
        // Anthropic 流式的 usage 在 message_start 的 message 里
        let holder = value.get("message").filter(|message| message.get("usage").is_some()).unwrap_or(value);
        let holder = holder.get("response").filter(|response| response.get("usage").is_some()).unwrap_or(holder);
        let Some(found) = holder.get("usage") else { return };
        let cached = int(found.get("cache_read_input_tokens"))
            + int(found.get("prompt_tokens_details").and_then(|details| details.get("cached_tokens")))
            + int(found.get("input_tokens_details").and_then(|details| details.get("cached_tokens")));
        let prompt = int(found.get("prompt_tokens"));
        let input = int(found.get("input_tokens"));
        // OpenAI 的 prompt_tokens 含缓存命中，这里只算没命中的
        let fresh_input = if prompt > 0 { (prompt - cached).max(0) } else { input };
        usage.input = usage.input.max(fresh_input);
        usage.output = usage.output.max(int(found.get("output_tokens")).max(int(found.get("completion_tokens"))));
        usage.cache_read = usage.cache_read.max(cached);
        usage.cache_write = usage.cache_write.max(int(found.get("cache_creation_input_tokens")));
    };
    if let Ok(value) = serde_json::from_slice::<Value>(body) {
        absorb(&value);
        return usage;
    }
    for line in String::from_utf8_lossy(body).lines() {
        if let Some(data) = line.strip_prefix("data:") {
            if let Ok(value) = serde_json::from_str::<Value>(data.trim()) {
                absorb(&value);
            }
        }
    }
    usage
}

pub fn error(status: StatusCode, code: &str, message: &str) -> Response {
    (status, axum::Json(json!({ "error": { "type": code, "code": code, "message": message } }))).into_response()
}

fn order_token(headers: &HeaderMap) -> Option<String> {
    let from = |name: header::HeaderName| headers.get(name).and_then(|value| value.to_str().ok()).map(str::trim).map(str::to_string);
    from(header::HeaderName::from_static("x-api-key"))
        .filter(|value| !value.is_empty())
        .or_else(|| from(header::AUTHORIZATION).and_then(|value| value.strip_prefix("Bearer ").map(|token| token.trim().to_string())))
        .filter(|value| !value.is_empty())
}

pub async fn relay(State(state): State<AppState>, upstream: Upstream, headers: HeaderMap, body: Bytes) -> Response {
    match relay_inner(&state, upstream, &headers, body).await {
        Ok(response) => response,
        Err(error_response) => error_response,
    }
}

async fn relay_inner(state: &AppState, upstream: Upstream, headers: &HeaderMap, body: Bytes) -> Result<Response, Response> {
    let internal = |failure: anyhow::Error| {
        tracing::error!("relay store error: {failure:#}");
        error(StatusCode::INTERNAL_SERVER_ERROR, "relay_error", "relay internal error")
    };
    let token = order_token(headers).ok_or_else(|| error(StatusCode::UNAUTHORIZED, "authentication_error", "missing order token"))?;
    let order = state
        .store
        .order_by_token(&token)
        .map_err(internal)?
        .ok_or_else(|| error(StatusCode::UNAUTHORIZED, "authentication_error", "invalid order token"))?;
    if order.status != "open" || order.expires_at <= Utc::now() {
        return Err(error(StatusCode::UNAUTHORIZED, "order_closed", "this order is closed or expired"));
    }
    let tier = upstream.tier(&order);
    let route = state
        .store
        .route(tier)
        .map_err(internal)?
        .ok_or_else(|| error(StatusCode::SERVICE_UNAVAILABLE, "relay_not_configured", "this tier is not configured"))?;
    if route.protocol != upstream.protocol() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "wrong_protocol",
            &format!("this order's {tier} tier uses the {} protocol", route.protocol),
        ));
    }
    if upstream == Upstream::GlmOcr {
        if order.ocr_pages >= order.pages {
            return Err(error(StatusCode::TOO_MANY_REQUESTS, "order_page_limit_exceeded", "OCR pages reached this order's page count"));
        }
    } else if order.tokens_used >= order.token_budget {
        return Err(error(StatusCode::TOO_MANY_REQUESTS, "order_token_budget_exceeded", "this order used up its token budget"));
    }
    let mut payload: Value = serde_json::from_slice(&body)
        .map_err(|_| error(StatusCode::BAD_REQUEST, "invalid_request_error", "request body must be JSON"))?;
    let Some(object) = payload.as_object_mut() else {
        return Err(error(StatusCode::BAD_REQUEST, "invalid_request_error", "request body must be a JSON object"));
    };
    // 模型由这一档定，客户端选不了
    object.insert("model".to_string(), Value::String(route.model.clone()));
    let key = std::env::var(&route.key_env).ok().filter(|key| !key.trim().is_empty()).ok_or_else(|| {
        tracing::error!("relay key env {} is not set for tier {tier}", route.key_env);
        error(StatusCode::SERVICE_UNAVAILABLE, "relay_not_configured", "this tier is not configured")
    })?;

    let mut request = state.client.post(upstream.url(&route)).json(&payload);
    request = match upstream {
        Upstream::AnthropicMessages => {
            let version = headers.get("anthropic-version").cloned().unwrap_or_else(|| HeaderValue::from_static("2023-06-01"));
            let mut request = request.header("x-api-key", key.as_str()).header("anthropic-version", version);
            if let Some(beta) = headers.get("anthropic-beta") {
                request = request.header("anthropic-beta", beta.clone());
            }
            request
        }
        _ => request.bearer_auth(key.as_str()),
    };
    let response = request.send().await.map_err(|failure| {
        let message = redact(&failure.to_string(), std::slice::from_ref(&key));
        tracing::warn!("relay upstream request failed: {message}");
        error(StatusCode::BAD_GATEWAY, "upstream_unreachable", &message)
    })?;
    let status = response.status();
    let content_type = response.headers().get(header::CONTENT_TYPE).cloned();
    let bytes = response.bytes().await.map_err(|failure| {
        error(StatusCode::BAD_GATEWAY, "upstream_unreachable", &redact(&failure.to_string(), std::slice::from_ref(&key)))
    })?;
    let usage = if status.is_success() { usage_from_body(upstream, &bytes) } else { Usage::default() };
    state
        .store
        .record_usage(&order, upstream.label(), &route.model, status.as_u16(), &usage, Utc::now())
        .map_err(internal)?;
    let body = if status.is_success() {
        bytes.to_vec()
    } else {
        redact(&String::from_utf8_lossy(&bytes), std::slice::from_ref(&key)).into_bytes()
    };
    let mut reply = (StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY), body).into_response();
    if let Some(content_type) = content_type {
        reply.headers_mut().insert(header::CONTENT_TYPE, content_type);
    }
    Ok(reply)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usage_is_read_from_each_protocol() {
        let anthropic = br#"{"usage":{"input_tokens":1200,"output_tokens":300,"cache_read_input_tokens":4000,"cache_creation_input_tokens":50}}"#;
        assert_eq!(
            usage_from_body(Upstream::AnthropicMessages, anthropic),
            Usage { input: 1200, output: 300, cache_read: 4000, cache_write: 50, ocr_pages: 0 }
        );
        let chat = br#"{"usage":{"prompt_tokens":5000,"completion_tokens":700,"prompt_tokens_details":{"cached_tokens":3000}}}"#;
        assert_eq!(usage_from_body(Upstream::OpenAiChat, chat), Usage { input: 2000, output: 700, cache_read: 3000, cache_write: 0, ocr_pages: 0 });
        let responses = br#"{"usage":{"input_tokens":900,"output_tokens":100}}"#;
        assert_eq!(usage_from_body(Upstream::OpenAiResponses, responses).billable_tokens(), 1000);
        let ocr = br#"{"layout_details":[[],[],[]],"usage":{"prompt_tokens":10,"completion_tokens":20}}"#;
        assert_eq!(usage_from_body(Upstream::GlmOcr, ocr).ocr_pages, 3);
    }

    #[test]
    fn streamed_anthropic_usage_is_read_from_the_events() {
        let sse = b"event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"usage\":{\"input_tokens\":800,\"output_tokens\":1}}}\n\n\
event: message_delta\ndata: {\"type\":\"message_delta\",\"usage\":{\"output_tokens\":250}}\n\n";
        let usage = usage_from_body(Upstream::AnthropicMessages, sse);
        assert_eq!((usage.input, usage.output), (800, 250));
    }
}
