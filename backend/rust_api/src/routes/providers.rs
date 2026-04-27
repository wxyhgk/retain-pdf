use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::AppError;
use crate::models::{now_iso, ApiResponse};
use crate::ocr_provider::mineru::{
    extract_provider_error_code, extract_provider_message, extract_provider_trace_id,
    map_provider_error_code, MineruClient,
};
use crate::ocr_provider::paddle::{PaddleClient, PaddleProviderError};
use crate::ocr_provider::OcrErrorCategory;

#[derive(Debug, Deserialize)]
pub struct MineruTokenValidationRequest {
    pub mineru_token: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub model_version: String,
}

#[derive(Debug, Serialize)]
pub struct MineruTokenValidationView {
    pub ok: bool,
    pub status: &'static str,
    pub summary: String,
    pub retryable: bool,
    pub provider_code: Option<String>,
    pub provider_message: Option<String>,
    pub operator_hint: Option<String>,
    pub trace_id: Option<String>,
    pub base_url: String,
    pub checked_at: String,
}

#[derive(Debug, Deserialize)]
pub struct PaddleTokenValidationRequest {
    pub paddle_token: String,
    #[serde(default)]
    pub base_url: String,
}

#[derive(Debug, Deserialize)]
pub struct DeepSeekTokenValidationRequest {
    pub api_key: String,
    #[serde(default)]
    pub base_url: String,
}

pub async fn validate_mineru_token(
    Json(payload): Json<MineruTokenValidationRequest>,
) -> Result<Json<ApiResponse<MineruTokenValidationView>>, AppError> {
    let token = payload.mineru_token.trim();
    if token.is_empty() {
        return Err(AppError::bad_request("mineru_token is required"));
    }

    let base_url = payload.base_url.trim().to_string();
    let model_version = payload.model_version.trim().to_string();
    let client = MineruClient::new(base_url.clone(), token.to_string());
    let checked_at = now_iso();

    let view = match client
        .apply_upload_url(
            "retain-pdf-token-check.pdf",
            if model_version.is_empty() {
                "vlm"
            } else {
                model_version.as_str()
            },
            "",
            "retain-pdf-token-check",
        )
        .await
    {
        Ok(result) => MineruTokenValidationView {
            ok: true,
            status: "valid",
            summary: "MinerU Token 可用".to_string(),
            retryable: false,
            provider_code: Some("0".to_string()),
            provider_message: Some("ok".to_string()),
            operator_hint: None,
            trace_id: result.trace_id,
            base_url: client.base_url.clone(),
            checked_at,
        },
        Err(err) => classify_probe_error(err.to_string(), client.base_url.clone(), checked_at),
    };

    Ok(Json(ApiResponse::ok(view)))
}

pub async fn validate_paddle_token(
    Json(payload): Json<PaddleTokenValidationRequest>,
) -> Result<Json<ApiResponse<MineruTokenValidationView>>, AppError> {
    let token = payload.paddle_token.trim();
    if token.is_empty() {
        return Err(AppError::bad_request("paddle_token is required"));
    }

    let base_url = payload.base_url.trim().to_string();
    let client = PaddleClient::new(base_url.clone(), token.to_string());
    let checked_at = now_iso();

    let view = match client.probe_token().await {
        Ok(result) => MineruTokenValidationView {
            ok: true,
            status: "valid",
            summary: "Paddle Access Token 可用".to_string(),
            retryable: false,
            provider_code: Some("0".to_string()),
            provider_message: Some("ok".to_string()),
            operator_hint: Some(
                "鉴权已通过；当前使用随机任务 ID 进行只鉴权探测，不会触发真实 OCR 任务".to_string(),
            ),
            trace_id: result.trace_id,
            base_url: client.base_url.clone(),
            checked_at,
        },
        Err(err) => classify_paddle_probe_error(err, client.base_url.clone(), checked_at),
    };

    Ok(Json(ApiResponse::ok(view)))
}

pub async fn validate_deepseek_token(
    Json(payload): Json<DeepSeekTokenValidationRequest>,
) -> Result<Json<ApiResponse<MineruTokenValidationView>>, AppError> {
    let api_key = payload.api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::bad_request("api_key is required"));
    }

    let base_url = normalize_deepseek_base_url(&payload.base_url);
    let checked_at = now_iso();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|err| AppError::internal(format!("build deepseek probe client failed: {err}")))?;
    let models_url = format!("{}/models", base_url.trim_end_matches('/'));

    let response = client.get(&models_url).bearer_auth(api_key).send().await;
    let view = match response {
        Ok(resp) => classify_deepseek_probe_response(resp, base_url.clone(), checked_at).await,
        Err(err) => classify_deepseek_probe_transport_error(err, base_url.clone(), checked_at),
    };

    Ok(Json(ApiResponse::ok(view)))
}

fn normalize_deepseek_base_url(raw: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        "https://api.deepseek.com/v1".to_string()
    } else {
        trimmed.to_string()
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
            summary: "DeepSeek API Key 可用".to_string(),
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
        "DeepSeek API Key 无效".to_string()
    } else if status == "network_error" {
        "DeepSeek 连通性校验失败".to_string()
    } else {
        format!("DeepSeek 接口返回 {}", status_code.as_u16())
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
        ("network_error", "DeepSeek 连通性校验失败")
    } else {
        ("provider_error", "DeepSeek API Key 校验失败")
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

fn classify_probe_error(
    error_text: String,
    base_url: String,
    checked_at: String,
) -> MineruTokenValidationView {
    let provider_code = extract_provider_error_code(&error_text);
    let provider_message = extract_provider_message(&error_text);
    let trace_id = extract_provider_trace_id(&error_text);

    if let Some(code) = provider_code.as_deref() {
        let mapped = map_provider_error_code(
            code,
            provider_message.clone().unwrap_or_default(),
            trace_id.as_deref(),
        );
        return MineruTokenValidationView {
            ok: false,
            status: match mapped.category {
                OcrErrorCategory::Unauthorized => "unauthorized",
                OcrErrorCategory::CredentialExpired => "expired",
                _ => "provider_error",
            },
            summary: match mapped.category {
                OcrErrorCategory::Unauthorized => "MinerU Token 无效".to_string(),
                OcrErrorCategory::CredentialExpired => "MinerU Token 已过期".to_string(),
                _ => "MinerU Token 校验失败".to_string(),
            },
            retryable: !matches!(
                mapped.category,
                OcrErrorCategory::Unauthorized | OcrErrorCategory::CredentialExpired
            ),
            provider_code: mapped.provider_code,
            provider_message: mapped.provider_message,
            operator_hint: mapped.operator_hint,
            trace_id: mapped.trace_id,
            base_url,
            checked_at,
        };
    }

    let lowered = error_text.to_lowercase();
    let (status, summary, retryable) = if lowered.contains("timed out")
        || lowered.contains("timeout")
        || lowered.contains("failed to resolve")
        || lowered.contains("dns")
        || lowered.contains("connection")
    {
        ("network_error", "MinerU 连通性校验失败", true)
    } else {
        ("provider_error", "MinerU Token 校验失败", true)
    };

    MineruTokenValidationView {
        ok: false,
        status,
        summary: summary.to_string(),
        retryable,
        provider_code,
        provider_message: provider_message.or(Some(error_text)),
        operator_hint: None,
        trace_id,
        base_url,
        checked_at,
    }
}

fn classify_paddle_probe_error(
    err: anyhow::Error,
    base_url: String,
    checked_at: String,
) -> MineruTokenValidationView {
    if let Some(provider_err) = err.downcast_ref::<PaddleProviderError>() {
        let info = provider_err.info();
        let valid_404 = matches!(info.http_status, Some(404))
            || matches!(info.provider_code.as_deref(), Some("404"));
        if valid_404 {
            return MineruTokenValidationView {
                ok: true,
                status: "valid",
                summary: "Paddle Access Token 可用".to_string(),
                retryable: false,
                provider_code: info.provider_code.clone().or(Some("404".to_string())),
                provider_message: info
                    .provider_message
                    .clone()
                    .or(Some("probe task not found".to_string())),
                operator_hint: Some("鉴权已通过；随机探测任务不存在属于预期结果".to_string()),
                trace_id: info.trace_id.clone(),
                base_url,
                checked_at,
            };
        }

        let status = match info.category {
            OcrErrorCategory::Unauthorized | OcrErrorCategory::PermissionDenied => "unauthorized",
            OcrErrorCategory::RemoteReadTimeout | OcrErrorCategory::ServiceUnavailable => {
                "network_error"
            }
            _ => "provider_error",
        };
        let summary = match info.category {
            OcrErrorCategory::Unauthorized | OcrErrorCategory::PermissionDenied => {
                "Paddle Access Token 无效".to_string()
            }
            OcrErrorCategory::RemoteReadTimeout | OcrErrorCategory::ServiceUnavailable => {
                "Paddle 连通性校验失败".to_string()
            }
            _ => "Paddle Access Token 校验失败".to_string(),
        };
        return MineruTokenValidationView {
            ok: false,
            status,
            summary,
            retryable: !matches!(
                info.category,
                OcrErrorCategory::Unauthorized | OcrErrorCategory::PermissionDenied
            ),
            provider_code: info.provider_code.clone(),
            provider_message: info
                .provider_message
                .clone()
                .or_else(|| Some(provider_err.to_string())),
            operator_hint: info.operator_hint.clone(),
            trace_id: info.trace_id.clone(),
            base_url,
            checked_at,
        };
    }

    let error_text = err.to_string();
    let lowered = error_text.to_lowercase();
    let (status, summary, retryable) = if lowered.contains("timed out")
        || lowered.contains("timeout")
        || lowered.contains("failed to resolve")
        || lowered.contains("dns")
        || lowered.contains("connection")
    {
        ("network_error", "Paddle 连通性校验失败", true)
    } else {
        ("provider_error", "Paddle Access Token 校验失败", true)
    };

    MineruTokenValidationView {
        ok: false,
        status,
        summary: summary.to_string(),
        retryable,
        provider_code: None,
        provider_message: Some(error_text),
        operator_hint: None,
        trace_id: None,
        base_url,
        checked_at,
    }
}

#[cfg(test)]
mod tests {
    use super::{classify_paddle_probe_error, classify_probe_error};
    use crate::ocr_provider::paddle::PaddleProviderError;

    #[test]
    fn classify_probe_error_maps_invalid_token() {
        let view = classify_probe_error(
            r#"MinerU API error code=A0202: invalid token trace_id=trace-1"#.to_string(),
            "https://mineru.net".to_string(),
            "2026-04-06T00:00:00Z".to_string(),
        );
        assert!(!view.ok);
        assert_eq!(view.status, "unauthorized");
        assert_eq!(view.provider_code.as_deref(), Some("A0202"));
    }

    #[test]
    fn classify_probe_error_maps_expired_token() {
        let view = classify_probe_error(
            r#"MinerU API error code=A0211: token expired trace_id=trace-2"#.to_string(),
            "https://mineru.net".to_string(),
            "2026-04-06T00:00:00Z".to_string(),
        );
        assert!(!view.ok);
        assert_eq!(view.status, "expired");
        assert_eq!(view.provider_code.as_deref(), Some("A0211"));
    }

    #[test]
    fn classify_probe_error_maps_network_failure() {
        let view = classify_probe_error(
            "POST https://mineru.net/api/v4/file-urls/batch failed: operation timed out"
                .to_string(),
            "https://mineru.net".to_string(),
            "2026-04-06T00:00:00Z".to_string(),
        );
        assert!(!view.ok);
        assert_eq!(view.status, "network_error");
        assert!(view.retryable);
    }

    #[test]
    fn classify_paddle_probe_error_maps_unauthorized() {
        let err = anyhow::Error::new(PaddleProviderError::http_status(
            "probe",
            reqwest::StatusCode::UNAUTHORIZED,
            r#"{"errorCode":401,"errorMsg":"unauthorized"}"#,
            Some("trace-1"),
            None,
        ));
        let view = classify_paddle_probe_error(
            err,
            "https://paddleocr.aistudio-app.com".to_string(),
            "2026-04-26T00:00:00Z".to_string(),
        );
        assert!(!view.ok);
        assert_eq!(view.status, "unauthorized");
    }

    #[test]
    fn classify_paddle_probe_error_maps_not_found_as_valid() {
        let err = anyhow::Error::new(PaddleProviderError::http_status(
            "probe",
            reqwest::StatusCode::NOT_FOUND,
            r#"{"errorCode":404,"errorMsg":"not found"}"#,
            Some("trace-2"),
            None,
        ));
        let view = classify_paddle_probe_error(
            err,
            "https://paddleocr.aistudio-app.com".to_string(),
            "2026-04-26T00:00:00Z".to_string(),
        );
        assert!(view.ok);
        assert_eq!(view.status, "valid");
    }
}
