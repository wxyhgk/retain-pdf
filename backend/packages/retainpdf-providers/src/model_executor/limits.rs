//! 回答不完整、单次请求太长（2026-11-23）。
//!
//! - 回答不完整：上游回了 200，`finish_reason` 却说没写完（输出到上限、被内容过滤、服务商中途停了）。以前记成
//!   `ambiguous`（「结果不明、重试可能重复计费」），可上游明明回了话、也计了费：现在记 `failed` +
//!   `error_code=output_incomplete`，回执的 `finish_reason` 写明原因，半截内容照旧不交回。
//! - 单次请求太长：400 / 413 + 超长的码或说法。以前 400 记 `provider_rejected_request`（整份暂停）、413 记
//!   `ambiguous`：现在记 `failed` + `error_code=request_too_long`，回执的 `upstream_code` 是认出的码。
//!
//! 规则和 Python 请求层的 `backend/translation/retainpdf_translation/llm/shared/output_limits.py` 一致，
//! 改一边要改另一边。只交回表里的静态码，响应体原文不记、不交回。

use serde_json::Value;

/// Chat Completions 的 `finish_reason` 里表示「没写完」的（OpenAI 和各家兼容接口）。
const INCOMPLETE_FINISH_REASONS: &[&str] = &[
    "length",
    "content_filter",
    "model_context_window_exceeded", // 智谱
    "sensitive",                     // 智谱：内容安全
    "network_error",                 // 智谱：推理异常
    "insufficient_system_resource",  // DeepSeek：资源不足中断
];

/// 结束原因说回答没写完：这次请求按 `output_incomplete` 失败。
pub(super) fn incomplete_finish(reason: &str) -> bool {
    INCOMPLETE_FINISH_REASONS.contains(&reason)
}

/// 响应体里的码 → 认出的码。
const REQUEST_TOO_LONG_CODES: &[(&str, &str)] = &[
    ("context_length_exceeded", "context_length_exceeded"), // OpenAI
    ("request_too_large", "request_too_large"),             // Anthropic 413
    ("1261", "1261"),                                       // 智谱：Prompt 超长
    (
        "InternalError.Algo.InvalidParameter",
        "InternalError.Algo.InvalidParameter",
    ), // 千问：多半是输入超长
];
/// message 里的说法（小写）→ 码。
const REQUEST_TOO_LONG_MESSAGES: &[(&str, &str)] = &[
    ("prompt is too long", "prompt_too_long"),
    ("exceed context limit", "prompt_too_long"),
    ("maximum context length", "context_length_exceeded"),
    ("context_length_exceeded", "context_length_exceeded"),
    ("range of input length", "input_length_out_of_range"),
    ("input is too long", "input_too_long"),
];

fn scalar(value: &Value) -> Option<String> {
    match value {
        Value::String(text) if !text.trim().is_empty() => Some(text.trim().to_owned()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

/// 400 / 413 是不是「单次请求太长」；是就交回认出的码（413 没码时是 `http_413`）。
pub(super) fn request_too_long(status: u16, body: &[u8]) -> Option<&'static str> {
    if status != 400 && status != 413 {
        return None;
    }
    let text = String::from_utf8_lossy(body);
    let parsed: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
    let mut codes = Vec::new();
    let mut message = String::new();
    for container in [&parsed["error"], &parsed] {
        if !container.is_object() {
            continue;
        }
        for key in ["code", "type"] {
            if let Some(code) = scalar(&container[key]) {
                codes.push(code);
            }
        }
        if message.is_empty() {
            if let Some(text) = container["message"].as_str() {
                message = text.to_owned();
            }
        }
    }
    for code in &codes {
        if let Some((_, known)) = REQUEST_TOO_LONG_CODES.iter().find(|(raw, _)| raw == code) {
            return Some(known);
        }
    }
    let lowered = format!("{message}\n{text}").to_lowercase();
    if let Some((_, code)) = REQUEST_TOO_LONG_MESSAGES
        .iter()
        .find(|(marker, _)| lowered.contains(marker))
    {
        return Some(code);
    }
    (status == 413).then_some("http_413")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_each_vendor_too_long_shape() {
        let anthropic = br#"{"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 210000 tokens > 200000 maximum"}}"#;
        assert_eq!(request_too_long(400, anthropic), Some("prompt_too_long"));
        let anthropic_413 = br#"{"type":"error","error":{"type":"request_too_large","message":"Request exceeds the maximum allowed number of bytes."}}"#;
        assert_eq!(
            request_too_long(413, anthropic_413),
            Some("request_too_large")
        );
        assert_eq!(request_too_long(413, b"<html>413</html>"), Some("http_413"));
        let openai = br#"{"error":{"message":"This model's maximum context length is 128000 tokens.","type":"invalid_request_error","code":"context_length_exceeded"}}"#;
        assert_eq!(
            request_too_long(400, openai),
            Some("context_length_exceeded")
        );
        let deepseek = br#"{"error":{"message":"This model's maximum context length is 65536 tokens. However, you requested 70000 tokens","type":"invalid_request_error"}}"#;
        assert_eq!(
            request_too_long(400, deepseek),
            Some("context_length_exceeded")
        );
        let zhipu = r#"{"error":{"code":"1261","message":"Prompt 超长"}}"#;
        assert_eq!(request_too_long(400, zhipu.as_bytes()), Some("1261"));
        let qwen = br#"{"error":{"code":"InternalError.Algo.InvalidParameter","message":"Range of input length should be [1, 30720]"}}"#;
        assert_eq!(
            request_too_long(400, qwen),
            Some("InternalError.Algo.InvalidParameter")
        );
    }

    #[test]
    fn other_rejections_are_not_too_long() {
        let bad = br#"{"error":{"message":"Invalid value for 'temperature'","type":"invalid_request_error"}}"#;
        assert_eq!(request_too_long(400, bad), None);
        assert_eq!(request_too_long(400, b""), None);
        let openai = br#"{"error":{"code":"context_length_exceeded"}}"#;
        assert_eq!(request_too_long(429, openai), None);
        assert!(incomplete_finish("length") && incomplete_finish("content_filter"));
        assert!(!incomplete_finish("stop") && !incomplete_finish("tool_calls"));
    }
}
