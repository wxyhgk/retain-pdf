use serde_json::Value;

use crate::config::DeepSeekRuntimeConfig;
use crate::error::AppError;
use crate::models::domain::now_iso;

use super::types::{
    DeepSeekBalanceInfoView, DeepSeekBalanceView, DeepSeekTokenValidationRequest,
    MineruTokenValidationView,
};
use super::url_policy::validate_provider_base_url;

pub(crate) async fn validate_deepseek_token_view(
    payload: DeepSeekTokenValidationRequest,
    runtime: DeepSeekRuntimeConfig,
) -> Result<MineruTokenValidationView, AppError> {
    let api_key = payload.api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::bad_request("api_key is required"));
    }

    let base_url = normalize_deepseek_base_url(&payload.base_url, &runtime);
    validate_provider_base_url(&base_url, runtime.allow_private_urls)?;
    let checked_at = now_iso();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(runtime.probe_timeout_secs))
        .build()
        .map_err(|err| AppError::internal(format!("build deepseek probe client failed: {err}")))?;
    let models_url = format!("{}/models", base_url.trim_end_matches('/'));

    let response = client.get(&models_url).bearer_auth(api_key).send().await;
    let view = match response {
        Ok(resp) => classify_deepseek_probe_response(resp, base_url.clone(), checked_at).await,
        Err(err) => classify_deepseek_probe_transport_error(err, base_url.clone(), checked_at),
    };

    Ok(view)
}

pub(crate) async fn query_deepseek_balance_view(
    payload: DeepSeekTokenValidationRequest,
    runtime: DeepSeekRuntimeConfig,
) -> Result<DeepSeekBalanceView, AppError> {
    let api_key = payload.api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::bad_request("api_key is required"));
    }

    let base_url = normalize_deepseek_base_url(&payload.base_url, &runtime);
    validate_provider_base_url(&base_url, runtime.allow_private_urls)?;
    let checked_at = now_iso();
    let Some(balance_url) = deepseek_balance_url(&base_url, &runtime) else {
        return Ok(DeepSeekBalanceView {
            ok: false,
            status: "unsupported_provider",
            summary: "余额查询仅支持 DeepSeek 官方 API".to_string(),
            retryable: false,
            is_available: false,
            balance_infos: vec![],
            provider_code: None,
            provider_message: Some(format!("base_url={base_url}")),
            trace_id: None,
            base_url,
            checked_at,
        });
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(runtime.probe_timeout_secs))
        .build()
        .map_err(|err| {
            AppError::internal(format!("build deepseek balance client failed: {err}"))
        })?;
    let response = client.get(balance_url).bearer_auth(api_key).send().await;
    let view = match response {
        Ok(resp) => classify_deepseek_balance_response(resp, base_url.clone(), checked_at).await,
        Err(err) => classify_deepseek_balance_transport_error(err, base_url.clone(), checked_at),
    };

    Ok(view)
}

fn normalize_deepseek_base_url(raw: &str, runtime: &DeepSeekRuntimeConfig) -> String {
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
) -> MineruTokenValidationView {
    let status_code = response.status();
    let trace_id = response
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let body_text = response.text().await.unwrap_or_default();

    if status_code.is_success() {
        return MineruTokenValidationView {
            ok: true,
            status: "valid",
            summary: "翻译 API Key 可用".to_string(),
            retryable: false,
            provider_code: Some(status_code.as_u16().to_string()),
            provider_message: summarize_deepseek_models_payload(&body_text),
            operator_hint: None,
            trace_id,
            base_url,
            checked_at,
        };
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

    MineruTokenValidationView {
        ok: false,
        status,
        summary,
        retryable: status != "unauthorized",
        provider_code: Some(status_code.as_u16().to_string()),
        provider_message: summarize_deepseek_error_payload(&body_text),
        operator_hint: None,
        trace_id,
        base_url,
        checked_at,
    }
}

fn classify_deepseek_probe_transport_error(
    err: reqwest::Error,
    base_url: String,
    checked_at: String,
) -> MineruTokenValidationView {
    let error_text = err.to_string();
    let lowered = error_text.to_lowercase();
    let (status, summary) = if lowered.contains("timed out")
        || lowered.contains("timeout")
        || lowered.contains("failed to resolve")
        || lowered.contains("dns")
        || lowered.contains("connection")
        || lowered.contains("connect")
    {
        ("network_error", "翻译 API 连通性校验失败")
    } else {
        ("provider_error", "翻译 API Key 校验失败")
    };

    MineruTokenValidationView {
        ok: false,
        status,
        summary: summary.to_string(),
        retryable: true,
        provider_code: None,
        provider_message: Some(error_text),
        operator_hint: None,
        trace_id: None,
        base_url,
        checked_at,
    }
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
            provider_code: Some(status_code.as_u16().to_string()),
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
        provider_code: Some(status_code.as_u16().to_string()),
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
