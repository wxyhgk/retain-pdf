//! 用翻译接口的配置问一次模型，可以带图片（2026-11-22）。
//!
//! 给前端、调试和以后的表格排版 agent 用：浏览器不能直接调服务商（跨域、Key 不能发出去），后端代发一次。
//! Key 是请求里带的，用完不存、不回显；和校验 Key、拉模型列表同一套地址检查、不跟随重定向，超时放长到
//! `ASK_TIMEOUT_SECS`（看图要时间）。三种协议各自的写法：
//! - OpenAI Chat：`POST {base_url}/chat/completions`，图片是 `image_url` + data URL；新模型不认 `max_tokens` 时
//!   换 `max_completion_tokens` 再发一次（和校验 Key 同样的退法）。
//! - OpenAI Responses：`POST {base_url}/responses`，`input_text` / `input_image`，`store: false`。
//! - Anthropic：`POST {…/v1}/messages`，`image` 块（base64）。
//!
//! 服务商那边的失败（Key 不对、模型不认图片、超时……）都是 200，看 `ok` / `status`；请求本身不对（没 Key、没模型、
//! 图片太多太大、不是 base64、类型不认）是 400。

use std::time::{Duration, Instant};

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use retainpdf_api_base::error::AppError;
use retainpdf_core::config::DeepSeekRuntimeConfig;
use retainpdf_core::models::domain::now_iso;

use super::deepseek::{
    anthropic_auth, anthropic_messages_url, blocked_status, normalize_deepseek_base_url, responses_url, upstream_verdict,
    ANTHROPIC_DEFAULT_BASE_URL,
};
use super::models::provider_message;
use super::policy::ProbePolicy;
use super::url_policy::validate_probe_base_url;

/// 最多带几张图。
pub const ASK_MAX_IMAGES: usize = 4;
/// 每张图解码后最大字节数。
pub const ASK_MAX_IMAGE_BYTES: usize = 4 * 1024 * 1024;
/// 提示词最长字符数。
pub const ASK_MAX_PROMPT_CHARS: usize = 100_000;
/// 不给 `max_tokens` 时的默认值和上限。
pub const ASK_DEFAULT_MAX_TOKENS: u32 = 1024;
pub const ASK_MAX_TOKENS: u32 = 8192;
/// 看图回答比校验慢得多：超时放长到这么多秒。
const ASK_TIMEOUT_SECS: u64 = 180;
/// 回答正文最多读这么多字节。
const MAX_BODY_BYTES: usize = 8 * 1024 * 1024;
const IMAGE_MEDIA_TYPES: [&str; 4] = ["image/png", "image/jpeg", "image/webp", "image/gif"];

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AskImage {
    /// `image/png`、`image/jpeg`、`image/webp` 或 `image/gif`。
    pub media_type: String,
    /// 图片内容，标准 base64（不带 `data:` 前缀）。
    pub data: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TranslationModelAskRequest {
    pub api_key: String,
    #[serde(default)]
    pub base_url: String,
    /// `openai`（默认）、`openai_responses` 或 `anthropic`。
    #[serde(default)]
    pub api_protocol: String,
    pub model: String,
    #[serde(default)]
    pub system: String,
    pub prompt: String,
    #[serde(default)]
    pub images: Vec<AskImage>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct AskUsageView {
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct TranslationModelAskView {
    pub ok: bool,
    /// `ok`、`unauthorized`、`rejected`（请求被服务商拒绝，比如模型不认图片、模型名不对）、`rate_limited`、
    /// `insufficient_balance`（欠费、余额不足）、`quota_exceeded`（用量或花费上限）、
    /// `provider_error`、`unreachable`、`empty`（服务商回了但没有文字）、`invalid_input`。
    pub status: &'static str,
    pub summary: String,
    pub base_url: String,
    pub model: String,
    pub protocol: &'static str,
    /// 模型的回答；失败时是空串。
    pub text: String,
    pub usage: Option<AskUsageView>,
    pub images: usize,
    pub elapsed_ms: u64,
    /// 服务商回的 HTTP 状态码；没收到回复（连不上、超时）时为 null。2026-11-23 起。
    pub http_status: Option<u16>,
    /// 服务商自己的业务码（智谱 `1113`、OpenAI `insufficient_quota`……），正文里没有时为 null。
    /// 2026-11-23 以前这里放的是 HTTP 状态码，改看 `http_status`。
    pub provider_code: Option<String>,
    pub provider_message: Option<String>,
    pub asked_at: String,
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum Protocol {
    OpenAi,
    Responses,
    Anthropic,
}

impl Protocol {
    fn parse(raw: &str) -> Self {
        match raw.trim().to_ascii_lowercase().as_str() {
            "anthropic" => Self::Anthropic,
            "openai_responses" => Self::Responses,
            _ => Self::OpenAi,
        }
    }

    fn name(self) -> &'static str {
        match self {
            Self::OpenAi => "openai",
            Self::Responses => "openai_responses",
            Self::Anthropic => "anthropic",
        }
    }
}

/// 检查过的图片：类型和 base64 正文（原样转给服务商）。
struct CheckedImage {
    media_type: String,
    data: String,
}

fn check_images(images: &[AskImage]) -> Result<Vec<CheckedImage>, AppError> {
    if images.len() > ASK_MAX_IMAGES {
        return Err(AppError::bad_request(format!("too many images: {} (at most {ASK_MAX_IMAGES})", images.len())));
    }
    images
        .iter()
        .enumerate()
        .map(|(index, image)| {
            let media_type = image.media_type.trim().to_ascii_lowercase();
            if !IMAGE_MEDIA_TYPES.contains(&media_type.as_str()) {
                return Err(AppError::bad_request(format!(
                    "images[{index}].media_type must be one of {}",
                    IMAGE_MEDIA_TYPES.join(", ")
                )));
            }
            let data: String = image.data.chars().filter(|c| !c.is_ascii_whitespace()).collect();
            let decoded = base64::engine::general_purpose::STANDARD
                .decode(data.as_bytes())
                .map_err(|_| AppError::bad_request(format!("images[{index}].data is not standard base64")))?;
            if decoded.is_empty() {
                return Err(AppError::bad_request(format!("images[{index}].data is empty")));
            }
            if decoded.len() > ASK_MAX_IMAGE_BYTES {
                return Err(AppError::bad_request(format!(
                    "images[{index}] is {} bytes (at most {ASK_MAX_IMAGE_BYTES})",
                    decoded.len()
                )));
            }
            Ok(CheckedImage { media_type, data })
        })
        .collect()
}

fn openai_body(model: &str, system: &str, prompt: &str, images: &[CheckedImage], token_field: &str, max_tokens: u32) -> Value {
    let mut content = vec![json!({"type": "text", "text": prompt})];
    content.extend(images.iter().map(|image| {
        json!({"type": "image_url", "image_url": {"url": format!("data:{};base64,{}", image.media_type, image.data)}})
    }));
    let mut messages = Vec::new();
    if !system.is_empty() {
        messages.push(json!({"role": "system", "content": system}));
    }
    messages.push(json!({"role": "user", "content": content}));
    let mut body = json!({"model": model, "messages": messages});
    body[token_field] = json!(max_tokens);
    body
}

fn responses_body(model: &str, system: &str, prompt: &str, images: &[CheckedImage], max_tokens: u32) -> Value {
    let mut content = vec![json!({"type": "input_text", "text": prompt})];
    content.extend(images.iter().map(|image| {
        json!({"type": "input_image", "image_url": format!("data:{};base64,{}", image.media_type, image.data)})
    }));
    let mut body = json!({
        "model": model,
        "input": [{"role": "user", "content": content}],
        // Responses 的 max_output_tokens 最小 16
        "max_output_tokens": max_tokens.max(16),
        "store": false,
    });
    if !system.is_empty() {
        body["instructions"] = json!(system);
    }
    body
}

fn anthropic_body(model: &str, system: &str, prompt: &str, images: &[CheckedImage], max_tokens: u32) -> Value {
    let mut content = vec![json!({"type": "text", "text": prompt})];
    content.extend(images.iter().map(|image| {
        json!({"type": "image", "source": {"type": "base64", "media_type": image.media_type, "data": image.data}})
    }));
    let mut body = json!({"model": model, "max_tokens": max_tokens, "messages": [{"role": "user", "content": content}]});
    if !system.is_empty() {
        body["system"] = json!(system);
    }
    body
}

/// 回答里的文字。OpenAI 的 content 可能是字符串，也可能是片段列表。
fn answer_text(protocol: Protocol, body: &Value) -> String {
    let joined = |items: Option<&Vec<Value>>, kind: &str| -> String {
        items
            .into_iter()
            .flatten()
            .filter(|part| part.get("type").and_then(Value::as_str) == Some(kind))
            .filter_map(|part| part.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("")
    };
    match protocol {
        Protocol::OpenAi => {
            let content = &body["choices"][0]["message"]["content"];
            content.as_str().map(str::to_string).unwrap_or_else(|| joined(content.as_array(), "text"))
        }
        Protocol::Responses => {
            if let Some(text) = body.get("output_text").and_then(Value::as_str) {
                return text.to_string();
            }
            body["output"]
                .as_array()
                .into_iter()
                .flatten()
                .filter(|item| item.get("type").and_then(Value::as_str) == Some("message"))
                .map(|item| joined(item["content"].as_array(), "output_text"))
                .collect::<Vec<_>>()
                .join("")
        }
        Protocol::Anthropic => joined(body["content"].as_array(), "text"),
    }
}

fn answer_usage(protocol: Protocol, body: &Value) -> Option<AskUsageView> {
    let usage = body.get("usage").filter(|usage| usage.is_object())?;
    let (input, output) = match protocol {
        Protocol::OpenAi => ("prompt_tokens", "completion_tokens"),
        Protocol::Responses | Protocol::Anthropic => ("input_tokens", "output_tokens"),
    };
    Some(AskUsageView { input_tokens: usage[input].as_u64(), output_tokens: usage[output].as_u64() })
}

struct Reply {
    status: u16,
    /// 响应头里有没有 `retry-after`（分 Anthropic 的限流和消费封顶用）。
    retry_after: bool,
    body: String,
}

/// 服务商回 400 说不认 `max_tokens`（OpenAI 新模型要 `max_completion_tokens`）。
fn rejects_max_tokens(reply: &Reply) -> bool {
    reply.status == 400 && reply.body.contains("max_tokens") && reply.body.contains("max_completion_tokens")
}

pub async fn ask_translation_model_view(
    payload: TranslationModelAskRequest,
    runtime: DeepSeekRuntimeConfig,
    policy: ProbePolicy,
) -> Result<TranslationModelAskView, AppError> {
    let api_key = payload.api_key.trim().to_string();
    if api_key.is_empty() {
        return Err(AppError::bad_request("api_key is required"));
    }
    let model = payload.model.trim().to_string();
    if model.is_empty() {
        return Err(AppError::bad_request("model is required"));
    }
    let prompt = payload.prompt.trim().to_string();
    if prompt.is_empty() {
        return Err(AppError::bad_request("prompt is required"));
    }
    if prompt.chars().count() > ASK_MAX_PROMPT_CHARS {
        return Err(AppError::bad_request(format!("prompt is longer than {ASK_MAX_PROMPT_CHARS} characters")));
    }
    let images = check_images(&payload.images)?;
    let max_tokens = payload.max_tokens.unwrap_or(ASK_DEFAULT_MAX_TOKENS).clamp(1, ASK_MAX_TOKENS);
    let protocol = Protocol::parse(&payload.api_protocol);
    let base_url = if protocol == Protocol::Anthropic && payload.base_url.trim().is_empty() {
        ANTHROPIC_DEFAULT_BASE_URL.to_string()
    } else {
        normalize_deepseek_base_url(&payload.base_url, &runtime)
    };
    validate_probe_base_url(&base_url, policy.private_targets)?;
    let asked_at = now_iso();
    let started = Instant::now();
    let mut view = TranslationModelAskView {
        ok: false,
        status: "invalid_input",
        summary: String::new(),
        base_url: base_url.clone(),
        model: model.clone(),
        protocol: protocol.name(),
        text: String::new(),
        usage: None,
        images: images.len(),
        elapsed_ms: 0,
        http_status: None,
        provider_code: None,
        provider_message: None,
        asked_at: asked_at.clone(),
    };
    if reqwest::header::HeaderValue::from_str(&api_key).is_err() {
        view.summary = "API Key 里有换行、全角空格等不能用的字符，请重新复制粘贴".to_string();
        return Ok(view);
    }
    let session_id = format!("provider-ask-{}-{:016x}", asked_at, fastrand::u64(..));
    let client = policy
        .http_client_builder()
        .timeout(Duration::from_secs(ASK_TIMEOUT_SECS))
        .default_headers(crate::model_provider_headers::opencode_headers(&base_url, &session_id))
        .build()
        .map_err(|err| AppError::internal(format!("build model ask client failed: {err}")))?;
    let system = payload.system.trim().to_string();

    let send = |body: Value| {
        let request = match protocol {
            Protocol::Anthropic => anthropic_auth(client.post(anthropic_messages_url(&base_url)), &api_key),
            Protocol::Responses => client.post(responses_url(&base_url)).bearer_auth(&api_key),
            Protocol::OpenAi => client
                .post(format!("{}/chat/completions", base_url.trim_end_matches('/')))
                .bearer_auth(&api_key),
        };
        async move {
            let response = request.json(&body).send().await?;
            let status = response.status().as_u16();
            let retry_after = response.headers().contains_key(reqwest::header::RETRY_AFTER);
            let bytes = response.bytes().await?;
            let body = String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_BODY_BYTES)]).into_owned();
            Ok::<Reply, reqwest::Error>(Reply { status, retry_after, body })
        }
    };
    let first = match protocol {
        Protocol::OpenAi => openai_body(&model, &system, &prompt, &images, "max_tokens", max_tokens),
        Protocol::Responses => responses_body(&model, &system, &prompt, &images, max_tokens),
        Protocol::Anthropic => anthropic_body(&model, &system, &prompt, &images, max_tokens),
    };
    let mut reply = send(first).await;
    if protocol == Protocol::OpenAi {
        if let Ok(rejected) = &reply {
            if rejects_max_tokens(rejected) {
                reply = send(openai_body(&model, &system, &prompt, &images, "max_completion_tokens", max_tokens)).await;
            }
        }
    }
    view.elapsed_ms = started.elapsed().as_millis() as u64;
    let reply = match reply {
        Ok(reply) => reply,
        Err(err) => {
            view.status = "unreachable";
            view.summary = if err.is_timeout() {
                format!("等了 {ASK_TIMEOUT_SECS} 秒模型还没回答，请稍后重试")
            } else if err.is_connect() {
                "连不上翻译 API，请检查接口地址和服务器网络".to_string()
            } else {
                "和翻译 API 的连接中途失败，请稍后重试".to_string()
            };
            return Ok(view);
        }
    };
    view.http_status = Some(reply.status);
    if !(200..300).contains(&reply.status) {
        view.provider_message = provider_message(&reply.body, &api_key);
        if (300..400).contains(&reply.status) {
            view.status = "provider_error";
            view.summary = "接口地址被重定向了；请填重定向以后的地址（为了不把 Key 带到别处，不跟随重定向）".to_string();
            return Ok(view);
        }
        let (provider_code, limit) = upstream_verdict(reply.status, &reply.body, reply.retry_after, &base_url);
        view.provider_code = provider_code;
        // 429 不一定是限流：欠费、额度用完、套餐不含这个模型也走 429，按业务码分开（见 crate::upstream_limits）。
        if let Some(limit) = limit {
            (view.status, view.summary) = if limit.kind.blocks_use() {
                (blocked_status(limit.kind), format!("服务商拒绝了：{}（重试没用）", limit.reason_zh))
            } else if limit.kind == crate::upstream_limits::UpstreamLimitKind::Overloaded {
                ("rate_limited", "服务商当前繁忙，请稍后重试".to_string())
            } else {
                ("rate_limited", "服务商限流，请稍后重试".to_string())
            };
            return Ok(view);
        }
        (view.status, view.summary) = match reply.status {
            401 | 403 => ("unauthorized", "API Key 不对，或者没有调用这个模型的权限".to_string()),
            400..=499 => (
                "rejected",
                if images.is_empty() {
                    "服务商拒绝了这个请求，看 provider_message（常见：模型名不对）".to_string()
                } else {
                    "服务商拒绝了这个请求，看 provider_message（常见：这个模型不支持看图、图片太大，或模型名不对）".to_string()
                },
            ),
            _ => ("provider_error", "服务商返回了错误，请稍后重试".to_string()),
        };
        return Ok(view);
    }
    let Ok(body) = serde_json::from_str::<Value>(&reply.body) else {
        view.status = "provider_error";
        view.summary = "服务商返回的不是 JSON".to_string();
        view.provider_message = provider_message(&reply.body, &api_key);
        return Ok(view);
    };
    view.usage = answer_usage(protocol, &body);
    view.text = answer_text(protocol, &body);
    if view.text.trim().is_empty() {
        view.status = "empty";
        view.summary = "服务商回了，但没有文字（可能全用在思考上了，调大 max_tokens 再试）".to_string();
        return Ok(view);
    }
    view.ok = true;
    view.status = "ok";
    view.summary = "模型已回答".to_string();
    Ok(view)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG_B64: &str = "iVBORw0KGgpmYWtl";

    fn image(media_type: &str, data: &str) -> AskImage {
        AskImage { media_type: media_type.to_string(), data: data.to_string() }
    }

    #[test]
    fn images_are_checked() {
        assert_eq!(check_images(&[image("image/PNG", PNG_B64)]).unwrap()[0].media_type, "image/png");
        assert!(check_images(&[image("image/tiff", PNG_B64)]).is_err());
        assert!(check_images(&[image("image/png", "not base64!")]).is_err());
        assert!(check_images(&[image("image/png", "")]).is_err());
        let many: Vec<AskImage> = (0..=ASK_MAX_IMAGES).map(|_| image("image/png", PNG_B64)).collect();
        assert!(check_images(&many).is_err());
        let big = base64::engine::general_purpose::STANDARD.encode(vec![0u8; ASK_MAX_IMAGE_BYTES + 1]);
        assert!(check_images(&[image("image/png", &big)]).is_err());
    }

    #[test]
    fn each_protocol_puts_images_its_own_way() {
        let images = check_images(&[image("image/png", PNG_B64)]).unwrap();
        let chat = openai_body("m", "sys", "看图", &images, "max_tokens", 100);
        assert_eq!(chat["messages"][0]["content"], "sys");
        assert_eq!(chat["messages"][1]["content"][1]["image_url"]["url"], format!("data:image/png;base64,{PNG_B64}"));
        assert_eq!(chat["max_tokens"], 100);
        let responses = responses_body("m", "sys", "看图", &images, 1);
        assert_eq!(responses["instructions"], "sys");
        assert_eq!(responses["input"][0]["content"][1]["type"], "input_image");
        assert_eq!(responses["max_output_tokens"], 16);
        assert_eq!(responses["store"], false);
        let anthropic = anthropic_body("m", "", "看图", &images, 100);
        assert!(anthropic.get("system").is_none());
        assert_eq!(
            anthropic["messages"][0]["content"][1],
            json!({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": PNG_B64}})
        );
    }

    #[test]
    fn answers_and_usage_are_read_per_protocol() {
        let chat = json!({"choices": [{"message": {"content": "一样"}}], "usage": {"prompt_tokens": 900, "completion_tokens": 3}});
        assert_eq!(answer_text(Protocol::OpenAi, &chat), "一样");
        assert_eq!(answer_usage(Protocol::OpenAi, &chat), Some(AskUsageView { input_tokens: Some(900), output_tokens: Some(3) }));
        let parts = json!({"choices": [{"message": {"content": [{"type": "text", "text": "a"}, {"type": "text", "text": "b"}]}}]});
        assert_eq!(answer_text(Protocol::OpenAi, &parts), "ab");
        let responses = json!({"output": [{"type": "reasoning"}, {"type": "message", "content": [{"type": "output_text", "text": "好"}]}], "usage": {"input_tokens": 5, "output_tokens": 1}});
        assert_eq!(answer_text(Protocol::Responses, &responses), "好");
        let anthropic = json!({"content": [{"type": "thinking", "thinking": "…"}, {"type": "text", "text": "不一样"}], "usage": {"input_tokens": 7, "output_tokens": 2}});
        assert_eq!(answer_text(Protocol::Anthropic, &anthropic), "不一样");
        assert_eq!(answer_usage(Protocol::Anthropic, &anthropic).unwrap().input_tokens, Some(7));
    }

    #[test]
    fn max_tokens_rejection_is_recognised() {
        let reply = Reply { status: 400, retry_after: false, body: r#"{"error":{"message":"Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead."}}"#.to_string() };
        assert!(rejects_max_tokens(&reply));
        assert!(!rejects_max_tokens(&Reply { status: 400, retry_after: false, body: "model not found".to_string() }));
    }
}
