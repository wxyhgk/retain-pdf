//! 翻译接口的「从服务商拉取模型」（2026-11-19）：浏览器不能直接调服务商（跨域、Key 不能发出去），后端代一次
//! `GET {base_url}/models`。Key 是请求里带的，用完不存、不回显。
//!
//! 和校验 Key 同一套规矩（`policy.rs`）：地址检查按部署模式、短超时、不跟随重定向；服务商的报错截断、抹掉 Key。
//! - OpenAI 格式：`GET {base_url}/models`，`Authorization: Bearer`；认 `{"data": [...]}`、裸数组和
//!   `{"models": [...]}`（Gemini 的 `name: "models/…"` 去掉前缀）。
//! - Anthropic：`GET {…/v1}/models`，`x-api-key` + `anthropic-version`，按 `has_more` / `last_id` 翻页。
//!
//! 每个模型标 `kind`：名字里看得出是向量、语音、画图、审核、重排、OCR 之类的记 `other`，其余 `chat`；
//! 前端默认只列 `chat`，「显示全部」再列别的。查得到价的顺带带上单价（和 `/usage/prices` 同一套规则）。

use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use retainpdf_api_base::error::AppError;
use retainpdf_core::config::DeepSeekRuntimeConfig;
use retainpdf_core::models::domain::now_iso;

use super::deepseek::{anthropic_auth, anthropic_v1_root, normalize_deepseek_base_url, upstream_verdict, ANTHROPIC_DEFAULT_BASE_URL};
use super::policy::{truncate_provider_message, ProbePolicy};
use super::url_policy::validate_probe_base_url;
use crate::pricing::{PriceBasis, PriceBook, PriceView};

/// 一次最多收这么多模型（中转站动辄几百个，再多就是返回有问题）。
const MAX_MODELS: usize = 2000;
/// 正文最多读这么多字节。
const MAX_BODY_BYTES: usize = 8 * 1024 * 1024;
/// Anthropic 翻页最多翻这么多页。
const MAX_PAGES: usize = 10;

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TranslationModelsRequest {
    pub api_key: String,
    #[serde(default)]
    pub base_url: String,
    /// `openai`（默认）、`openai_responses` 或 `anthropic`。
    #[serde(default)]
    pub api_protocol: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct TranslationModelView {
    pub id: String,
    /// Anthropic 给的展示名；别家没有。
    pub display_name: Option<String>,
    pub owned_by: Option<String>,
    /// 服务商给的创建时间（Unix 秒）；没给是 null。
    pub created: Option<i64>,
    /// `chat`：能拿来翻译的对话模型；`other`：名字看得出是向量、语音、画图、审核、重排、OCR 之类。
    pub kind: &'static str,
    pub price_provider: Option<String>,
    pub price_basis: Option<PriceBasis>,
    /// 每百万 token 的美元单价，和 `/usage/prices` 同一个形状；查不到是 null。
    pub price: Option<PriceView>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct TranslationModelListView {
    pub ok: bool,
    /// `ok`、`unsupported`（这个接口不支持列模型，请手动填）、`unauthorized`（Key 不对或没权限）、
    /// `invalid_input`、`unreachable`（连不上、超时）、`provider_error`（服务商别的报错）。
    pub status: &'static str,
    pub summary: String,
    /// 一律 `provider`：从服务商拉的。
    pub source: &'static str,
    pub base_url: String,
    pub fetched_at: String,
    /// 服务商回的 HTTP 状态码（出错时；没收到回复时为 null）。2026-11-23 起。
    pub http_status: Option<u16>,
    /// 服务商自己的业务码（智谱 `1113`、OpenAI `insufficient_quota`……），正文里没有时为 null。
    /// 2026-11-23 以前这里放的是 HTTP 状态码，改看 `http_status`。
    pub provider_code: Option<String>,
    /// 服务商的报错原文（截断、抹掉 Key）。
    pub provider_message: Option<String>,
    /// 按 id 排序、去重。
    pub models: Vec<TranslationModelView>,
    /// `models` 里 `kind = "chat"` 的个数。
    pub chat_models: usize,
}

impl TranslationModelListView {
    fn failed(status: &'static str, summary: &str, base_url: String, fetched_at: String) -> Self {
        Self {
            ok: false,
            status,
            summary: summary.to_string(),
            source: "provider",
            base_url,
            fetched_at,
            http_status: None,
            provider_code: None,
            provider_message: None,
            models: Vec::new(),
            chat_models: 0,
        }
    }
}

/// 名字里出现这些的不是拿来翻译的对话模型。
const NON_CHAT_MARKERS: [&str; 20] = [
    "embed", "tts", "whisper", "dall-e", "dalle", "moderation", "rerank", "transcri", "speech", "audio",
    "image", "realtime", "sora", "ocr", "-asr", "voice", "bge-", "text-search", "similarity", "video",
];

pub(super) fn model_kind(id: &str) -> &'static str {
    let lowered = id.to_ascii_lowercase();
    if NON_CHAT_MARKERS.iter().any(|marker| lowered.contains(marker)) {
        "other"
    } else {
        "chat"
    }
}

fn text(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(str::trim).filter(|v| !v.is_empty()).map(str::to_string)
}

/// 认得出的列表形状：`{"data": [...]}`、裸数组、`{"models": [...]}`。认不出返回 None。
pub(super) fn parse_model_list(body: &Value) -> Option<Vec<RawModel>> {
    let items = body
        .get("data")
        .and_then(Value::as_array)
        .or_else(|| body.as_array())
        .or_else(|| body.get("models").and_then(Value::as_array))?;
    Some(
        items
            .iter()
            .filter_map(|item| {
                let id = match item {
                    Value::String(id) => Some(id.trim().to_string()),
                    _ => text(item, "id").or_else(|| text(item, "name")),
                }?;
                let id = id.strip_prefix("models/").unwrap_or(&id).to_string();
                (!id.is_empty()).then(|| RawModel {
                    id,
                    display_name: text(item, "display_name").or_else(|| text(item, "displayName")),
                    owned_by: text(item, "owned_by"),
                    created: item.get("created").and_then(Value::as_i64),
                })
            })
            .collect(),
    )
}

/// 服务商返回的一项。
#[derive(Debug, Clone, PartialEq)]
pub(super) struct RawModel {
    pub id: String,
    pub display_name: Option<String>,
    pub owned_by: Option<String>,
    pub created: Option<i64>,
}

fn redact(message: &str, api_key: &str) -> String {
    if api_key.len() >= 4 {
        message.replace(api_key, "[REDACTED]")
    } else {
        message.to_string()
    }
}

/// 服务商错误正文里的说明：`error.message`、`error`（字符串）、`message`，都没有就是正文开头。
pub(super) fn provider_message(body: &str, api_key: &str) -> Option<String> {
    let parsed: Option<Value> = serde_json::from_str(body).ok();
    let message = parsed
        .as_ref()
        .and_then(|value| {
            value
                .get("error")
                .and_then(|error| error.get("message").and_then(Value::as_str).or_else(|| error.as_str()))
                .or_else(|| value.get("message").and_then(Value::as_str))
                .map(str::to_string)
        })
        .or_else(|| Some(body.trim().to_string()).filter(|text| !text.is_empty()));
    truncate_provider_message(message.map(|text| redact(&text, api_key)))
}

enum Fetched {
    Body(Value),
    Failed(TranslationModelListView),
}

async fn fetch_page(
    request: reqwest::RequestBuilder,
    api_key: &str,
    base_url: &str,
    fetched_at: &str,
) -> Fetched {
    let fail = |status, summary: &str| TranslationModelListView::failed(status, summary, base_url.to_string(), fetched_at.to_string());
    let response = match request.send().await {
        Ok(response) => response,
        Err(err) => {
            let summary = if err.is_timeout() {
                "连接翻译 API 超时，请稍后重试"
            } else if err.is_connect() {
                "连不上翻译 API，请检查接口地址和服务器网络"
            } else {
                "和翻译 API 的连接中途失败，请稍后重试"
            };
            return Fetched::Failed(fail("unreachable", summary));
        }
    };
    let status = response.status();
    let retry_after = response.headers().contains_key(reqwest::header::RETRY_AFTER);
    let bytes = match response.bytes().await {
        Ok(bytes) if bytes.len() <= MAX_BODY_BYTES => bytes,
        Ok(_) => return Fetched::Failed(fail("provider_error", "服务商返回的模型列表太大，没有读")),
        Err(_) => return Fetched::Failed(fail("unreachable", "读服务商的返回时连接断了，请稍后重试")),
    };
    let body = String::from_utf8_lossy(&bytes);
    let (provider_code, limit) = if status.is_success() || status.is_redirection() {
        (None, None)
    } else {
        upstream_verdict(status.as_u16(), &body, retry_after, base_url)
    };
    let with_detail = |mut view: TranslationModelListView| {
        view.http_status = Some(status.as_u16());
        view.provider_code = provider_code.clone();
        view.provider_message = provider_message(&body, api_key);
        view
    };
    if status.is_redirection() {
        return Fetched::Failed(with_detail(fail(
            "provider_error",
            "接口地址被重定向了；请填重定向以后的地址（为了不把 Key 带到别处，不跟随重定向）",
        )));
    }
    // 欠费、额度用完、套餐不含：状态照旧（401/403 是 unauthorized，别的是 provider_error），说明换成具体原因。
    if let Some(limit) = limit.as_ref().filter(|limit| limit.kind.blocks_use()) {
        let status_name = if matches!(status.as_u16(), 401 | 403) { "unauthorized" } else { "provider_error" };
        return Fetched::Failed(with_detail(fail(status_name, &format!("服务商说这个 Key 现在不能用：{}", limit.reason_zh))));
    }
    if matches!(status.as_u16(), 401 | 403) {
        return Fetched::Failed(with_detail(fail("unauthorized", "API Key 不对，或者没有列模型的权限")));
    }
    if matches!(status.as_u16(), 404 | 405 | 501) {
        return Fetched::Failed(with_detail(fail("unsupported", "这个接口不支持列出模型（/models），请手动填写模型名")));
    }
    if !status.is_success() {
        return Fetched::Failed(with_detail(fail("provider_error", "服务商返回了错误，没拿到模型列表")));
    }
    match serde_json::from_slice::<Value>(&bytes) {
        Ok(value) => Fetched::Body(value),
        Err(_) => Fetched::Failed(with_detail(fail(
            "unsupported",
            "这个接口返回的不是模型列表，可能不支持列出模型，请手动填写模型名",
        ))),
    }
}

pub async fn list_translation_models_view(
    payload: TranslationModelsRequest,
    runtime: DeepSeekRuntimeConfig,
    policy: ProbePolicy,
    data_root: Option<&Path>,
) -> Result<TranslationModelListView, AppError> {
    let api_key = payload.api_key.trim().to_string();
    if api_key.is_empty() {
        return Err(AppError::bad_request("api_key is required"));
    }
    let anthropic = payload.api_protocol.trim().eq_ignore_ascii_case("anthropic");
    let base_url = if anthropic && payload.base_url.trim().is_empty() {
        ANTHROPIC_DEFAULT_BASE_URL.to_string()
    } else {
        normalize_deepseek_base_url(&payload.base_url, &runtime)
    };
    validate_probe_base_url(&base_url, policy.private_targets)?;
    let fetched_at = now_iso();
    if reqwest::header::HeaderValue::from_str(&api_key).is_err() {
        return Ok(TranslationModelListView::failed(
            "invalid_input",
            "API Key 里有换行、全角空格等不能用的字符，请重新复制粘贴",
            base_url,
            fetched_at,
        ));
    }
    let session_id = format!("provider-models-{}-{:016x}", fetched_at, fastrand::u64(..));
    let client = policy
        .http_client_builder()
        .default_headers(crate::model_provider_headers::opencode_headers(&base_url, &session_id))
        .build()
        .map_err(|err| AppError::internal(format!("build model list client failed: {err}")))?;

    let mut raw: Vec<RawModel> = Vec::new();
    if anthropic {
        let url = format!("{}/models", anthropic_v1_root(&base_url));
        let mut after: Option<String> = None;
        for _ in 0..MAX_PAGES {
            let mut request = anthropic_auth(client.get(&url), &api_key).query(&[("limit", "1000")]);
            if let Some(after_id) = &after {
                request = request.query(&[("after_id", after_id.as_str())]);
            }
            let body = match fetch_page(request, &api_key, &base_url, &fetched_at).await {
                Fetched::Body(body) => body,
                Fetched::Failed(view) => return Ok(view),
            };
            let Some(items) = parse_model_list(&body) else {
                return Ok(TranslationModelListView::failed(
                    "unsupported",
                    "这个接口返回的不是模型列表，可能不支持列出模型，请手动填写模型名",
                    base_url,
                    fetched_at,
                ));
            };
            raw.extend(items.into_iter());
            let more = body.get("has_more").and_then(Value::as_bool).unwrap_or(false);
            after = text(&body, "last_id");
            if !more || after.is_none() || raw.len() >= MAX_MODELS {
                break;
            }
        }
    } else {
        let url = format!("{}/models", base_url.trim_end_matches('/'));
        let body = match fetch_page(client.get(&url).bearer_auth(&api_key), &api_key, &base_url, &fetched_at).await {
            Fetched::Body(body) => body,
            Fetched::Failed(view) => return Ok(view),
        };
        let Some(items) = parse_model_list(&body) else {
            return Ok(TranslationModelListView::failed(
                "unsupported",
                "这个接口返回的不是模型列表，可能不支持列出模型，请手动填写模型名",
                base_url,
                fetched_at,
            ));
        };
        raw.extend(items.into_iter());
    }

    Ok(build_view(raw, &base_url, fetched_at, data_root.map(PriceBook::load)))
}

fn build_view(raw: Vec<RawModel>, base_url: &str, fetched_at: String, prices: Option<PriceBook>) -> TranslationModelListView {
    let host = url::Url::parse(base_url).ok().and_then(|url| url.host_str().map(str::to_ascii_lowercase)).unwrap_or_default();
    let mut by_id: BTreeMap<String, RawModel> = BTreeMap::new();
    for model in raw.into_iter().take(MAX_MODELS) {
        by_id.entry(model.id.clone()).or_insert(model);
    }
    let models: Vec<TranslationModelView> = by_id
        .into_values()
        .map(|model| {
            let quote = prices.as_ref().and_then(|book| book.quote(&host, &model.id, &fetched_at));
            TranslationModelView {
                kind: model_kind(&model.id),
                price_provider: quote.as_ref().map(|(provider, _, _)| provider.clone()),
                price_basis: quote.as_ref().map(|(_, basis, _)| *basis),
                price: quote.as_ref().map(|(provider, _, price)| price.view(provider)),
                id: model.id,
                display_name: model.display_name,
                owned_by: model.owned_by,
                created: model.created,
            }
        })
        .collect();
    let chat_models = models.iter().filter(|model| model.kind == "chat").count();
    TranslationModelListView {
        ok: true,
        status: "ok",
        summary: if models.is_empty() {
            "服务商没有返回任何模型，请手动填写模型名".to_string()
        } else {
            format!("拉到 {} 个模型，其中 {chat_models} 个对话模型", models.len())
        },
        source: "provider",
        base_url: base_url.to_string(),
        fetched_at,
        http_status: None,
        provider_code: None,
        provider_message: None,
        models,
        chat_models,
    }
}

#[cfg(test)]
#[path = "models_tests.rs"]
mod tests;
