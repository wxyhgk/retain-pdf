use serde_json::Value;

use retainpdf_core::config::DeepSeekRuntimeConfig;
use retainpdf_api_base::error::AppError;
use retainpdf_core::models::domain::now_iso;

use super::ocr::redirected_view;
use super::policy::ProbePolicy;
use super::types::{
    DeepSeekBalanceInfoView, DeepSeekBalanceView, DeepSeekTokenValidationRequest,
    ProviderProbeView,
};
use super::url_policy::validate_probe_base_url;
use crate::upstream_limits::{classify_upstream_limit, upstream_error_code, UpstreamLimit, UpstreamLimitKind};

/// 翻译接口探针。
///
/// 探针必须走**和翻译流水线完全相同的调用路径**，否则绿灯是假的：
/// `retainpdf_translation/llm/providers/deepseek/transport.py` 对所有服务商一律发
/// `POST {base_url}/chat/completions` + `Authorization: Bearer`。曾经这里
/// 打的是 `GET {base_url}/models`，两个后果：
///   1. 只验 Key 能否列模型，不验用户填的模型名真能调通 —— 模型名写错时
///      检测显示可用，真正翻译才失败；
///   2. Anthropic 的 OpenAI 兼容层只覆盖 `/chat/completions`，`/models`
///      仍要求 `x-api-key`，于是正确的 Key 被判成无效。
///
/// 改用 `max_tokens: 1` 的最小 chat 请求后，一次请求同时验证 base_url、
/// Key 与模型三者。代价是每次检测消耗个位数 token，这是拿到真实结论的
/// 必要成本。模型名为空时无法构造 chat 请求，才退回 `/models` 连通性探针。
pub async fn validate_deepseek_token_view(
    payload: DeepSeekTokenValidationRequest,
    runtime: DeepSeekRuntimeConfig,
    policy: ProbePolicy,
) -> Result<ProviderProbeView, AppError> {
    Ok(validate_deepseek_token_inner(payload, runtime, policy).await?.bounded())
}

async fn validate_deepseek_token_inner(
    payload: DeepSeekTokenValidationRequest,
    runtime: DeepSeekRuntimeConfig,
    policy: ProbePolicy,
) -> Result<ProviderProbeView, AppError> {
    let api_key = payload.api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::bad_request("api_key is required"));
    }

    let protocol = payload.api_protocol.trim().to_ascii_lowercase();
    let anthropic = protocol == "anthropic";
    let responses = protocol == "openai_responses";
    let base_url = if anthropic && payload.base_url.trim().is_empty() {
        ANTHROPIC_DEFAULT_BASE_URL.to_string()
    } else {
        normalize_deepseek_base_url(&payload.base_url, &runtime)
    };
    validate_probe_base_url(&base_url, policy.private_targets)?;
    let checked_at = now_iso();
    let session_id = format!("provider-probe-{}-{:016x}", checked_at, fastrand::u64(..));
    let client = policy
        .http_client_builder()
        .default_headers(crate::model_provider_headers::opencode_headers(
            &base_url,
            &session_id,
        ))
        .build()
        .map_err(|err| AppError::internal(format!("build deepseek probe client failed: {err}")))?;

    // Key 里混进换行、全角空格之类放不进请求头的字符时，请求根本发不出去；先拦下来，直说是 Key 的问题。
    if reqwest::header::HeaderValue::from_str(api_key).is_err() {
        return Ok(ProviderProbeView {
            ok: false,
            status: "invalid_input",
            summary: "API Key 里有换行、全角空格等不能用的字符，请重新复制粘贴".to_string(),
            retryable: false,
            http_status: None,
            provider_code: None,
            provider_message: None,
            operator_hint: None,
            trace_id: None,
            base_url,
            checked_at,
        });
    }

    let model = payload.model.trim();
    if model.is_empty() {
        let models_url = if anthropic {
            format!("{}/models", anthropic_v1_root(&base_url))
        } else {
            format!("{}/models", base_url.trim_end_matches('/'))
        };
        let request = client.get(&models_url);
        let request = if anthropic { anthropic_auth(request, api_key) } else { request.bearer_auth(api_key) };
        let response = request.send().await;
        let view = match response {
            Ok(resp) => classify_deepseek_probe_response(resp, base_url.clone(), checked_at).await,
            Err(err) => classify_deepseek_probe_transport_error(err, base_url.clone(), checked_at),
        };
        return Ok(view);
    }

    // Anthropic Messages API:`/messages` + x-api-key,max_tokens 必填;其余同 OpenAI 的最小请求。
    let request = if anthropic {
        let url = anthropic_messages_url(&base_url);
        let body = serde_json::json!({
            "model": model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 1,
        });
        anthropic_auth(client.post(&url), api_key).json(&body)
    } else if responses {
        // OpenAI Responses API:`/responses`;max_output_tokens 最小是 16,store=false 不在服务商留存。
        let url = responses_url(&base_url);
        let body = serde_json::json!({
            "model": model,
            "input": "ping",
            "max_output_tokens": 16,
            "store": false,
        });
        client.post(&url).bearer_auth(api_key).json(&body)
    } else {
        return Ok(probe_openai_chat(&client, api_key, model, base_url, checked_at).await);
    };
    let view = match request.send().await {
        Ok(resp) => classify_deepseek_chat_probe_response(ProbeReply::read(resp).await, model, base_url.clone(), checked_at),
        Err(err) => classify_deepseek_probe_transport_error(err, base_url.clone(), checked_at),
    };

    Ok(if responses { explain_missing_responses_endpoint(view) } else { view })
}

/// OpenAI 格式（`/chat/completions`）的最小请求。先发 `max_tokens: 1`（DeepSeek、通义、智谱和各家中转都认）；
/// OpenAI 的新模型（gpt-5.x、o 系列）不认 `max_tokens`，要 `max_completion_tokens`，回 400 时换这个字段再发一次
/// （issue #161：以前这里就报「模型不可用」，翻译其实能跑）。思考模型的 1 个 token 不够，换字段时给 16。
async fn probe_openai_chat(
    client: &reqwest::Client,
    api_key: &str,
    model: &str,
    base_url: String,
    checked_at: String,
) -> ProviderProbeView {
    let chat_url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let send = |limit_field: &str, limit: u32| {
        let mut body = serde_json::json!({
            "model": model,
            "messages": [{"role": "user", "content": "ping"}],
            "stream": false,
        });
        body[limit_field] = serde_json::json!(limit);
        client.post(&chat_url).bearer_auth(api_key).json(&body).send()
    };
    let mut reply = match send("max_tokens", 1).await {
        Ok(resp) => ProbeReply::read(resp).await,
        Err(err) => return classify_deepseek_probe_transport_error(err, base_url, checked_at),
    };
    if reply.status == reqwest::StatusCode::BAD_REQUEST
        && UpstreamError::parse(&reply.body).wants_max_completion_tokens()
    {
        reply = match send("max_completion_tokens", 16).await {
            Ok(resp) => ProbeReply::read(resp).await,
            Err(err) => return classify_deepseek_probe_transport_error(err, base_url, checked_at),
        };
    }
    classify_deepseek_chat_probe_response(reply, model, base_url, checked_at)
}

/// 读完的一次响应：分类只看这几样，读出来以后可以按内容决定要不要重发。
struct ProbeReply {
    status: reqwest::StatusCode,
    location: Option<String>,
    trace_id: Option<String>,
    /// 响应头里有没有 `retry-after`：Anthropic 的消费封顶 429 没有，普通限流有。
    retry_after: bool,
    body: String,
}

impl ProbeReply {
    async fn read(response: reqwest::Response) -> Self {
        let status = response.status();
        let location = redirect_location(&response);
        let trace_id = response
            .headers()
            .get("x-request-id")
            .and_then(|value| value.to_str().ok())
            .map(|value| value.to_string());
        let retry_after = response.headers().contains_key(reqwest::header::RETRY_AFTER);
        let body = response.text().await.unwrap_or_default();
        Self { status, location, trace_id, retry_after, body }
    }
}

/// 服务商错误正文里的 `error.message` / `error.code` / `error.param`（OpenAI 的格式，多数兼容服务照抄）。
#[derive(Default)]
pub(super) struct UpstreamError {
    pub(super) message: Option<String>,
    pub(super) code: Option<String>,
    pub(super) param: Option<String>,
}

impl UpstreamError {
    pub(super) fn parse(body_text: &str) -> Self {
        let parsed: Value = serde_json::from_str(body_text).unwrap_or(Value::Null);
        let error = parsed.get("error").unwrap_or(&Value::Null);
        let text = |value: Option<&Value>| value.and_then(Value::as_str).filter(|v| !v.is_empty()).map(str::to_string);
        Self {
            message: summarize_deepseek_error_payload(body_text),
            code: text(error.get("code")).or_else(|| text(parsed.get("code"))),
            param: text(error.get("param")),
        }
    }

    fn wants_max_completion_tokens(&self) -> bool {
        self.param.as_deref() == Some("max_tokens")
            || self.message.as_deref().is_some_and(|message| message.contains("max_completion_tokens"))
    }

    /// 服务商认了 Key 和模型、只是不收某个参数（`unsupported_parameter` / `unsupported_value`，或指明了
    /// 不是 `model` 的 `param`）。正文里常有 "not supported with this model"，以前因为带 model 被当成模型不可用。
    pub(super) fn rejected_parameter(&self) -> Option<String> {
        let code = self.code.as_deref().unwrap_or("");
        if code == "model_not_found" || self.param.as_deref() == Some("model") {
            return None;
        }
        let lowered = self.message.as_deref().unwrap_or("").to_lowercase();
        let parameter_error = matches!(code, "unsupported_parameter" | "unsupported_value" | "invalid_parameter")
            || self.param.is_some()
            || lowered.contains("unsupported parameter")
            || lowered.contains("unsupported value");
        parameter_error.then(|| self.param.clone().unwrap_or_default())
    }
}

/// 判定一次失败响应是否在拒绝**模型**（而非 Key 或网络）。
/// OpenAI 兼容服务对未知模型的返回很不统一：DeepSeek/OpenAI 用 400 +
/// `model_not_found`，部分中转站用 404，智谱用 400 + 中文文案。只在 4xx 且
/// 错误正文提到模型时才认定，避免把限流或鉴权错误误分类。
pub(super) fn is_model_rejection(
    status_code: reqwest::StatusCode,
    provider_message: Option<&str>,
) -> bool {
    if status_code != reqwest::StatusCode::BAD_REQUEST
        && status_code != reqwest::StatusCode::NOT_FOUND
        && status_code != reqwest::StatusCode::UNPROCESSABLE_ENTITY
    {
        return false;
    }
    let Some(message) = provider_message else {
        // 404 且无可解析正文：兼容层根本没有 /chat/completions，等价于模型不可用。
        return status_code == reqwest::StatusCode::NOT_FOUND;
    };
    let lowered = message.to_lowercase();
    lowered.contains("model")
        || lowered.contains("模型")
        || lowered.contains("does not exist")
        || lowered.contains("not found")
}

fn classify_deepseek_chat_probe_response(
    reply: ProbeReply,
    model: &str,
    base_url: String,
    checked_at: String,
) -> ProviderProbeView {
    let ProbeReply { status: status_code, location, trace_id, retry_after, body: body_text } = reply;
    if status_code.is_redirection() {
        return redirected_view("翻译 API", status_code.as_u16(), location, base_url, checked_at);
    }

    if status_code.is_success() {
        return ProviderProbeView {
            ok: true,
            status: "valid",
            summary: format!("翻译 API 与模型 {model} 可用"),
            retryable: false,
            http_status: Some(status_code.as_u16()),
            provider_code: None,
            provider_message: Some(format!("chat probe ok: {model}")),
            operator_hint: None,
            trace_id,
            base_url,
            checked_at,
        };
    }

    let (provider_code, limit) = upstream_verdict(status_code.as_u16(), &body_text, retry_after, &base_url);
    if let Some(limit) = limit {
        // 限流、过载说明 Key 与模型都已被服务商接受，只是此刻忙——判成失败会误导用户。
        // 欠费、额度用完、套餐不含这个模型也走 429（智谱 1113、OpenAI insufficient_quota……），这些重试没用，判不可用。
        if !limit.kind.blocks_use() {
            let (summary, hint) = if limit.kind == UpstreamLimitKind::Overloaded {
                (format!("翻译 API 与模型 {model} 可用（服务商当前繁忙）"), "服务商整体过载，和 Key 无关；翻译时会自动等一等再试。")
            } else {
                (format!("翻译 API 与模型 {model} 可用（当前被限流）"), "服务商正在限流，翻译时建议调低并发数。")
            };
            return ProviderProbeView {
                ok: true,
                status: "rate_limited",
                summary,
                retryable: false,
                http_status: Some(status_code.as_u16()),
                provider_code,
                provider_message: summarize_deepseek_error_payload(&body_text),
                operator_hint: Some(hint.to_string()),
                trace_id,
                base_url,
                checked_at,
            };
        }
        return blocked_view(&limit, status_code.as_u16(), provider_code, summarize_deepseek_error_payload(&body_text), trace_id, base_url, checked_at);
    }

    let upstream = UpstreamError::parse(&body_text);
    let unauthorized = status_code == reqwest::StatusCode::UNAUTHORIZED
        || status_code == reqwest::StatusCode::FORBIDDEN;
    let rejected_parameter = if unauthorized || !status_code.is_client_error() {
        None
    } else {
        upstream.rejected_parameter()
    };
    let parameter_rejected = rejected_parameter.is_some();
    let model_rejected = !unauthorized
        && !parameter_rejected
        && is_model_rejection(status_code, upstream.message.as_deref());
    // 上游的错误码（如 unsupported_parameter）一起带上，方便对照服务商文档。
    let provider_message = match (upstream.message, upstream.code) {
        (Some(message), Some(code)) if !message.contains(&code) => Some(format!("{message}（{code}）")),
        (message, _) => message,
    };

    let (status, summary, operator_hint) = if unauthorized {
        (
            "unauthorized",
            "翻译 API Key 无效".to_string(),
            Some("请确认 Key 与所选 API 服务是否匹配。".to_string()),
        )
    } else if let Some(param) = rejected_parameter {
        let what = if param.is_empty() { "检测请求的参数".to_string() } else { format!("参数 {param}") };
        (
            "provider_error",
            format!("Key 和模型 {model} 已被接受，但服务商不收{what}"),
            Some("是检测请求本身的参数问题，不代表翻译不能用；可以先试翻一小段确认。".to_string()),
        )
    } else if model_rejected {
        (
            "model_unavailable",
            format!("模型 {model} 不可用"),
            Some("Key 已通过鉴权，请确认模型名称在该服务商下存在且已开通。".to_string()),
        )
    } else if status_code.is_server_error() {
        ("network_error", "翻译 API 连通性校验失败".to_string(), None)
    } else {
        (
            "provider_error",
            format!("翻译 API 返回 {}", status_code.as_u16()),
            None,
        )
    };

    ProviderProbeView {
        ok: false,
        status,
        summary,
        // 只有网络/服务商瞬时错误值得重试；Key、模型、余额都要用户先改配置。
        retryable: status == "network_error" || (status == "provider_error" && !parameter_rejected),
        http_status: Some(status_code.as_u16()),
        provider_code,
        provider_message,
        operator_hint,
        trace_id,
        base_url,
        checked_at,
    }
}

pub(crate) async fn query_deepseek_balance_view(
    payload: DeepSeekTokenValidationRequest,
    runtime: DeepSeekRuntimeConfig,
    policy: ProbePolicy,
) -> Result<DeepSeekBalanceView, AppError> {
    let api_key = payload.api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::bad_request("api_key is required"));
    }

    let base_url = normalize_deepseek_base_url(&payload.base_url, &runtime);
    validate_probe_base_url(&base_url, policy.private_targets)?;
    let checked_at = now_iso();
    let Some(balance_url) = deepseek_balance_url(&base_url, &runtime) else {
        return Ok(DeepSeekBalanceView {
            ok: false,
            status: "unsupported_provider",
            summary: "余额查询仅支持 DeepSeek 官方 API".to_string(),
            retryable: false,
            is_available: false,
            balance_infos: vec![],
            http_status: None,
            provider_code: None,
            provider_message: Some(format!("base_url={base_url}")),
            trace_id: None,
            base_url,
            checked_at,
        });
    };

    let client = policy.http_client_builder().build().map_err(|err| {
        AppError::internal(format!("build deepseek balance client failed: {err}"))
    })?;
    let response = client.get(balance_url).bearer_auth(api_key).send().await;
    let view = match response {
        Ok(resp) => classify_deepseek_balance_response(resp, base_url.clone(), checked_at).await,
        Err(err) => classify_deepseek_balance_transport_error(err, base_url.clone(), checked_at),
    };

    Ok(view.bounded())
}

pub(super) const ANTHROPIC_DEFAULT_BASE_URL: &str = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION: &str = "2023-06-01";

/// 很多 OpenAI 兼容服务只实现了 `/chat/completions`：`/responses` 返回 404/405 且正文不提模型时，
/// 原样报「模型不可用」会把人引去查模型名，这里改说是接口不支持。
pub(super) fn explain_missing_responses_endpoint(
    mut view: ProviderProbeView,
) -> ProviderProbeView {
    let endpoint_missing = matches!(view.http_status, Some(404) | Some(405))
        && !view
            .provider_message
            .as_deref()
            .is_some_and(|message| {
                let lowered = message.to_lowercase();
                lowered.contains("model") || message.contains("模型")
            });
    if !view.ok && endpoint_missing {
        view.status = "provider_error";
        view.summary = "该服务商不支持 Responses 接口（/responses）".to_string();
        view.operator_hint =
            Some("请把接口协议改回「OpenAI 格式（/chat/completions）」。".to_string());
        view.retryable = false;
    }
    view
}

/// 地址填到 `/v1` 为止;误填了完整的 `/responses` 或 `/chat/completions` 也认(与 Python
/// `model_wire.responses_url` 一致)。
pub(super) fn responses_url(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    let root = trimmed
        .strip_suffix("/responses")
        .or_else(|| trimmed.strip_suffix("/chat/completions"))
        .unwrap_or(trimmed);
    format!("{root}/responses")
}

/// 地址填到 `/v1` 为止；也认官方 SDK 的写法（不带 `/v1`，如 `https://api.anthropic.com`）和误填的
/// 完整 `/v1/messages`。规则与翻译流水线的 `model_wire.anthropic_normalize_base_url` 一致——两边要是
/// 不一样，就会出现「检测通过、翻译 404」。
pub(super) fn anthropic_messages_url(base_url: &str) -> String {
    format!("{}/messages", anthropic_v1_root(base_url))
}

/// 规范到 `…/v1` 为止；`/messages`、`/models` 都接在它后面。
pub(super) fn anthropic_v1_root(base_url: &str) -> String {
    let mut base = base_url.trim().trim_end_matches('/');
    if let Some(stripped) = base.strip_suffix("/messages") {
        base = stripped;
    }
    if base.ends_with("/v1") {
        base.to_string()
    } else {
        format!("{base}/v1")
    }
}

pub(super) fn anthropic_auth(request: reqwest::RequestBuilder, api_key: &str) -> reqwest::RequestBuilder {
    request.header("x-api-key", api_key).header("anthropic-version", ANTHROPIC_VERSION)
}

pub(super) fn normalize_deepseek_base_url(raw: &str, runtime: &DeepSeekRuntimeConfig) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        runtime.default_base_url.trim_end_matches('/').to_string()
    } else {
        trimmed.to_string()
    }
}

fn deepseek_balance_url(base_url: &str, runtime: &DeepSeekRuntimeConfig) -> Option<String> {
    let trimmed = base_url.trim();
    if trimmed.is_empty() || trimmed.contains("api.deepseek.com") {
        Some(runtime.balance_url.clone())
    } else {
        None
    }
}

async fn classify_deepseek_probe_response(
    response: reqwest::Response,
    base_url: String,
    checked_at: String,
) -> ProviderProbeView {
    let status_code = response.status();
    if status_code.is_redirection() {
        return redirected_view(
            "翻译 API",
            status_code.as_u16(),
            redirect_location(&response),
            base_url,
            checked_at,
        );
    }
    let trace_id = response
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let retry_after = response.headers().contains_key(reqwest::header::RETRY_AFTER);
    let body_text = response.text().await.unwrap_or_default();

    if status_code.is_success() {
        return ProviderProbeView {
            ok: true,
            status: "valid",
            summary: "翻译 API Key 可用".to_string(),
            retryable: false,
            http_status: Some(status_code.as_u16()),
            provider_code: None,
            provider_message: summarize_deepseek_models_payload(&body_text),
            operator_hint: None,
            trace_id,
            base_url,
            checked_at,
        };
    }

    let (provider_code, limit) = upstream_verdict(status_code.as_u16(), &body_text, retry_after, &base_url);
    if let Some(limit) = limit.filter(|limit| limit.kind.blocks_use()) {
        return blocked_view(&limit, status_code.as_u16(), provider_code, summarize_deepseek_error_payload(&body_text), trace_id, base_url, checked_at);
    }
    let status = if status_code == reqwest::StatusCode::UNAUTHORIZED
        || status_code == reqwest::StatusCode::FORBIDDEN
    {
        "unauthorized"
    } else if status_code.is_server_error() {
        "network_error"
    } else {
        "provider_error"
    };
    let summary = if status == "unauthorized" {
        "翻译 API Key 无效".to_string()
    } else if status == "network_error" {
        "翻译 API 连通性校验失败".to_string()
    } else {
        format!("翻译 API 返回 {}", status_code.as_u16())
    };

    ProviderProbeView {
        ok: false,
        status,
        summary,
        retryable: status != "unauthorized",
        http_status: Some(status_code.as_u16()),
        provider_code,
        provider_message: summarize_deepseek_error_payload(&body_text),
        operator_hint: None,
        trace_id,
        base_url,
        checked_at,
    }
}

/// 走到这里说明服务商根本没回 HTTP 响应（连不上、超时、连接中途断开、TLS 握手失败……），和 Key
/// 无关。以前没匹配上几个关键词就兜底报「翻译 API Key 校验失败」，让人去查一个没问题的 Key。
/// 按 reqwest 自己的错误分类判断，不再猜字符串。
fn classify_deepseek_probe_transport_error(
    err: reqwest::Error,
    base_url: String,
    checked_at: String,
) -> ProviderProbeView {
    let error_text = err.to_string();
    if err.is_builder() {
        // 地址和 Key 都提前校验过，这里几乎走不到；说不清是哪个，就都提一下。
        return ProviderProbeView {
            ok: false,
            status: "invalid_input",
            summary: "请求没法发出，请检查接口地址和 API Key 里有没有多余的字符".to_string(),
            retryable: false,
            http_status: None,
            provider_code: None,
            provider_message: Some(error_text),
            operator_hint: None,
            trace_id: None,
            base_url,
            checked_at,
        };
    }
    let summary = if err.is_timeout() {
        "连接翻译 API 超时，请稍后重试"
    } else if err.is_connect() {
        "连不上翻译 API，请检查接口地址和服务器网络"
    } else {
        "和翻译 API 的连接中途失败，请稍后重试"
    };

    ProviderProbeView {
        ok: false,
        status: "network_error",
        summary: summary.to_string(),
        retryable: true,
        http_status: None,
        provider_code: None,
        provider_message: Some(error_text.clone()),
        operator_hint: Some(format!("没有收到服务商的回复，和 Key 无关。底层错误：{error_text}")),
        trace_id: None,
        base_url,
        checked_at,
    }
}

/// 失败响应里服务商自己的业务码，和「是不是限流 / 欠费 / 额度用完」的结论（见 `crate::upstream_limits`）。
/// 业务码优先用判断时认出的那个（OpenCode 把「Policy budget exceeded」包在外壳里时，外壳的 type 不算数）。
pub(super) fn upstream_verdict(
    http_status: u16,
    body: &str,
    retry_after: bool,
    base_url: &str,
) -> (Option<String>, Option<UpstreamLimit>) {
    let host = url::Url::parse(base_url).ok().and_then(|url| url.host_str().map(str::to_string)).unwrap_or_default();
    let limit = classify_upstream_limit(http_status, body, retry_after, &host);
    let code = limit.as_ref().and_then(|limit| limit.code.clone()).or_else(|| upstream_error_code(body));
    (code, limit)
}

/// 欠费、额度用完、套餐不含这个模型：处理好之前翻译一定失败，重试没用。
/// `status`：欠费 `insufficient_balance`、额度 `quota_exceeded`、套餐或 Key 类型不对 `unauthorized`（没有权限用）。
pub(super) fn blocked_status(kind: UpstreamLimitKind) -> &'static str {
    match kind {
        UpstreamLimitKind::Billing => "insufficient_balance",
        UpstreamLimitKind::PlanRestricted => "unauthorized",
        _ => "quota_exceeded",
    }
}

fn blocked_view(
    limit: &UpstreamLimit,
    http_status: u16,
    provider_code: Option<String>,
    provider_message: Option<String>,
    trace_id: Option<String>,
    base_url: String,
    checked_at: String,
) -> ProviderProbeView {
    ProviderProbeView {
        ok: false,
        status: blocked_status(limit.kind),
        summary: format!("翻译 API 不可用：{}", limit.reason_zh),
        retryable: false,
        http_status: Some(http_status),
        provider_code,
        provider_message,
        operator_hint: Some("这不是限流，过一会儿重试也没用；处理好之前翻译会失败。".to_string()),
        trace_id,
        base_url,
        checked_at,
    }
}

fn redirect_location(response: &reqwest::Response) -> Option<String> {
    response
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
}

fn summarize_deepseek_models_payload(body_text: &str) -> Option<String> {
    let parsed: Value = serde_json::from_str(body_text).ok()?;
    let data = parsed.get("data")?.as_array()?;
    let models = data
        .iter()
        .filter_map(|item| item.get("id").and_then(|value| value.as_str()))
        .take(3)
        .collect::<Vec<_>>();
    if models.is_empty() {
        Some("models probe ok".to_string())
    } else {
        Some(format!("models probe ok: {}", models.join(", ")))
    }
}

fn summarize_deepseek_error_payload(body_text: &str) -> Option<String> {
    let parsed: Value = serde_json::from_str(body_text).ok()?;
    if let Some(message) = parsed
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(|value| value.as_str())
    {
        return Some(message.to_string());
    }
    if let Some(message) = parsed.get("message").and_then(|value| value.as_str()) {
        return Some(message.to_string());
    }
    let trimmed = body_text.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

async fn classify_deepseek_balance_response(
    response: reqwest::Response,
    base_url: String,
    checked_at: String,
) -> DeepSeekBalanceView {
    let status_code = response.status();
    if status_code.is_redirection() {
        return DeepSeekBalanceView {
            ok: false,
            status: "redirected",
            summary: format!("DeepSeek 余额接口返回了重定向（HTTP {}）", status_code.as_u16()),
            retryable: false,
            is_available: false,
            balance_infos: vec![],
            http_status: Some(status_code.as_u16()),
            provider_code: None,
            provider_message: redirect_location(&response).map(|target| format!("Location: {target}")),
            trace_id: None,
            base_url,
            checked_at,
        };
    }
    let trace_id = response
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let body_text = response.text().await.unwrap_or_default();

    if status_code.is_success() {
        let parsed: Value = serde_json::from_str(&body_text).unwrap_or(Value::Null);
        let is_available = parsed
            .get("is_available")
            .and_then(|value| value.as_bool())
            .unwrap_or(false);
        let balance_infos = parsed
            .get("balance_infos")
            .and_then(|value| value.as_array())
            .map(|items| {
                items
                    .iter()
                    .map(deepseek_balance_info_from_value)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let summary = summarize_deepseek_balance(is_available, &balance_infos);
        return DeepSeekBalanceView {
            ok: is_available,
            status: if is_available {
                "available"
            } else {
                "insufficient_balance"
            },
            summary,
            retryable: false,
            is_available,
            balance_infos,
            http_status: Some(status_code.as_u16()),
            provider_code: None,
            provider_message: None,
            trace_id,
            base_url,
            checked_at,
        };
    }

    let status = if status_code == reqwest::StatusCode::UNAUTHORIZED
        || status_code == reqwest::StatusCode::FORBIDDEN
    {
        "unauthorized"
    } else if status_code == reqwest::StatusCode::PAYMENT_REQUIRED {
        "insufficient_balance"
    } else if status_code.is_server_error() {
        "network_error"
    } else {
        "provider_error"
    };
    let summary = match status {
        "unauthorized" => "DeepSeek API Key 无效".to_string(),
        "insufficient_balance" => "DeepSeek 余额不足".to_string(),
        "network_error" => "DeepSeek 余额查询失败".to_string(),
        _ => format!("DeepSeek 余额接口返回 {}", status_code.as_u16()),
    };

    DeepSeekBalanceView {
        ok: false,
        status,
        summary,
        retryable: status == "network_error",
        is_available: false,
        balance_infos: vec![],
        http_status: Some(status_code.as_u16()),
        provider_code: upstream_error_code(&body_text),
        provider_message: summarize_deepseek_error_payload(&body_text),
        trace_id,
        base_url,
        checked_at,
    }
}

fn classify_deepseek_balance_transport_error(
    err: reqwest::Error,
    base_url: String,
    checked_at: String,
) -> DeepSeekBalanceView {
    DeepSeekBalanceView {
        ok: false,
        status: "network_error",
        summary: "DeepSeek 余额查询失败".to_string(),
        retryable: true,
        is_available: false,
        balance_infos: vec![],
        http_status: None,
        provider_code: None,
        provider_message: Some(err.to_string()),
        trace_id: None,
        base_url,
        checked_at,
    }
}

fn deepseek_balance_info_from_value(value: &Value) -> DeepSeekBalanceInfoView {
    DeepSeekBalanceInfoView {
        currency: json_string_field(value, "currency"),
        total_balance: json_string_field(value, "total_balance"),
        granted_balance: json_string_field(value, "granted_balance"),
        topped_up_balance: json_string_field(value, "topped_up_balance"),
    }
}

fn json_string_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(|field| field.as_str())
        .unwrap_or("")
        .to_string()
}

fn summarize_deepseek_balance(
    is_available: bool,
    balance_infos: &[DeepSeekBalanceInfoView],
) -> String {
    if balance_infos.is_empty() {
        return if is_available {
            "DeepSeek 余额可用".to_string()
        } else {
            "DeepSeek 余额不足".to_string()
        };
    }
    let parts = balance_infos
        .iter()
        .filter(|item| !item.currency.is_empty())
        .map(|item| format!("{} {}", item.currency, item.total_balance))
        .collect::<Vec<_>>();
    if parts.is_empty() {
        return if is_available {
            "DeepSeek 余额可用".to_string()
        } else {
            "DeepSeek 余额不足".to_string()
        };
    }
    if is_available {
        format!("DeepSeek 余额可用：{}", parts.join("，"))
    } else {
        format!("DeepSeek 余额不足：{}", parts.join("，"))
    }
}
