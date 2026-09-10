use crate::config::{MineruRuntimeConfig, PaddleRuntimeConfig};
use crate::error::AppError;
use crate::models::domain::now_iso;
use crate::ocr_provider::mineru::{
    extract_provider_error_code, extract_provider_message, extract_provider_trace_id,
    map_provider_error_code, MineruClient,
};
use crate::ocr_provider::paddle::{PaddleClient, PaddleProviderError};
use crate::ocr_provider::OcrErrorCategory;

use super::types::{
    MineruTokenValidationRequest, MineruTokenValidationView, PaddleTokenValidationRequest,
};
use super::url_policy::validate_provider_base_url;

pub(crate) async fn validate_mineru_token_view(
    payload: MineruTokenValidationRequest,
    runtime: MineruRuntimeConfig,
) -> Result<MineruTokenValidationView, AppError> {
    let token = payload.mineru_token.trim();
    if token.is_empty() {
        return Err(AppError::bad_request("mineru_token is required"));
    }

    let base_url = payload.base_url.trim().to_string();
    let model_version = payload.model_version.trim().to_string();
    let allow_private_urls = runtime.allow_private_urls;
    let client = MineruClient::with_runtime(base_url.clone(), token.to_string(), runtime);
    validate_provider_base_url(&client.base_url, allow_private_urls)?;
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

    Ok(view)
}

pub(crate) async fn validate_paddle_token_view(
    payload: PaddleTokenValidationRequest,
    runtime: PaddleRuntimeConfig,
) -> Result<MineruTokenValidationView, AppError> {
    let token = payload.paddle_token.trim();
    if token.is_empty() {
        return Err(AppError::bad_request("paddle_token is required"));
    }

    let base_url = payload.base_url.trim().to_string();
    let allow_private_urls = runtime.allow_private_urls;
    let client = PaddleClient::with_runtime(base_url.clone(), token.to_string(), runtime);
    validate_provider_base_url(&client.base_url, allow_private_urls)?;
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

    Ok(view)
}

pub(super) fn classify_probe_error(
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

pub(super) fn classify_paddle_probe_error(
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
