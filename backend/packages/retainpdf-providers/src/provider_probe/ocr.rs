use retainpdf_core::config::{MineruRuntimeConfig, PaddleRuntimeConfig};
use retainpdf_api_base::error::AppError;
use retainpdf_core::models::domain::now_iso;
use retainpdf_data::ocr_provider::mineru::client::MineruUploadOptions;
use retainpdf_data::ocr_provider::mineru::response_error::MineruResponseError;
use retainpdf_data::ocr_provider::mineru::{
    extract_provider_error_code, extract_provider_message, extract_provider_trace_id,
    map_provider_error_code, MineruClient,
};
use retainpdf_data::ocr_provider::paddle::{PaddleClient, PaddleProviderError};
use retainpdf_data::ocr_provider::OcrErrorCategory;

use super::policy::ProbePolicy;
use super::types::{
    MineruTokenValidationRequest, PaddleTokenValidationRequest, ProviderProbeView,
};
use super::url_policy::validate_probe_base_url;

pub async fn validate_mineru_token_view(
    payload: MineruTokenValidationRequest,
    runtime: MineruRuntimeConfig,
    policy: ProbePolicy,
) -> Result<ProviderProbeView, AppError> {
    let token = payload.mineru_token.trim();
    if token.is_empty() {
        return Err(AppError::bad_request("mineru_token is required"));
    }

    let base_url = payload.base_url.trim().to_string();
    let model_version = payload.model_version.trim().to_string();
    let http = policy
        .http_client_builder()
        .build()
        .map_err(|err| AppError::internal(format!("build mineru probe client failed: {err}")))?;
    let client = MineruClient::with_http_client(base_url, token.to_string(), runtime, http);
    validate_probe_base_url(&client.base_url, policy.private_targets)?;
    let checked_at = now_iso();

    let view = match client
        .apply_upload_url(
            "retain-pdf-token-check.pdf",
            &MineruUploadOptions {
                model_version: if model_version.is_empty() {
                    "vlm"
                } else {
                    &model_version
                },
                data_id: "retain-pdf-token-check",
                ..Default::default()
            },
        )
        .await
    {
        Ok(result) => ProviderProbeView {
            ok: true,
            status: "valid",
            summary: "MinerU Token 可用".to_string(),
            retryable: false,
            http_status: None,
            provider_code: Some("0".to_string()),
            provider_message: Some("ok".to_string()),
            operator_hint: None,
            trace_id: result.trace_id,
            base_url: client.base_url.clone(),
            checked_at,
        },
        Err(err) => classify_mineru_probe_error(&err, client.base_url.clone(), checked_at),
    };

    Ok(view.bounded())
}

pub async fn validate_paddle_token_view(
    payload: PaddleTokenValidationRequest,
    mut runtime: PaddleRuntimeConfig,
    policy: ProbePolicy,
) -> Result<ProviderProbeView, AppError> {
    let token = payload.paddle_token.trim();
    if token.is_empty() {
        return Err(AppError::bad_request("paddle_token is required"));
    }

    let base_url = payload.base_url.trim().to_string();
    // 校验是用户在等的前台操作：只试一次，不像正式任务那样超时、断连都重试 3 次。
    runtime.request_retry_attempts = 1;
    let http = policy
        .http_client_builder()
        .no_proxy()
        .build()
        .map_err(|err| AppError::internal(format!("build paddle probe client failed: {err}")))?;
    let client = PaddleClient::with_http_client(base_url, token.to_string(), runtime, http);
    validate_probe_base_url(&client.base_url, policy.private_targets)?;
    let checked_at = now_iso();

    let view = match client.probe_token().await {
        Ok(result) => ProviderProbeView {
            ok: true,
            status: "valid",
            summary: "Paddle Access Token 可用".to_string(),
            retryable: false,
            http_status: None,
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

    Ok(view.bounded())
}

/// 服务商回了 3xx：校验不跟随重定向（免得把 Key 带到别的地址），直接算校验没通过。
pub(super) fn redirected_view(
    provider: &str,
    http_status: u16,
    location: Option<String>,
    base_url: String,
    checked_at: String,
) -> ProviderProbeView {
    ProviderProbeView {
        ok: false,
        status: "redirected",
        summary: format!("{provider} 返回了重定向（HTTP {http_status}），请检查接口地址"),
        retryable: false,
        http_status: Some(http_status),
        provider_code: None,
        provider_message: location.map(|target| format!("Location: {target}")),
        operator_hint: Some(
            "校验不跟随重定向，免得把 Key 带到别的地址。常见原因：http 和 https 写反了、地址多了或少了一段路径。"
                .to_string(),
        ),
        trace_id: None,
        base_url,
        checked_at,
    }
}

fn is_redirect(http_status: Option<u16>) -> bool {
    matches!(http_status, Some(300..=399))
}

/// MinerU 探针的错误：先在错误链里找服务商的回复（`MineruResponseError`）和传输错误（`reqwest::Error`），
/// 都找不到才退回按完整错误链（`{:#}`）的文字判断。以前用 `to_string()` 只拿到最外层的
/// 「MinerU apply upload url failed」，Token 无效、过期、超时全落成 provider_error。
pub(super) fn classify_mineru_probe_error(
    err: &anyhow::Error,
    base_url: String,
    checked_at: String,
) -> ProviderProbeView {
    if let Some(response_err) = err.downcast_ref::<MineruResponseError>() {
        let info = &response_err.info;
        if is_redirect(info.http_status) {
            return redirected_view(
                "MinerU",
                info.http_status.unwrap_or_default(),
                None,
                base_url,
                checked_at,
            );
        }
        let (status, summary, retryable) = match info.category {
            OcrErrorCategory::Unauthorized | OcrErrorCategory::PermissionDenied => {
                ("unauthorized", "MinerU Token 无效".to_string(), false)
            }
            OcrErrorCategory::CredentialExpired => {
                ("expired", "MinerU Token 已过期".to_string(), false)
            }
            _ if info.provider_code.is_some() => {
                ("provider_error", "MinerU Token 校验失败".to_string(), true)
            }
            _ => (
                "provider_error",
                format!(
                    "MinerU 返回 HTTP {}，校验没有通过",
                    info.http_status.unwrap_or_default()
                ),
                true,
            ),
        };
        return ProviderProbeView {
            ok: false,
            status,
            summary,
            retryable,
            // 2026-11-23 起业务码和 HTTP 状态码分开放：没有业务码时不再拿 HTTP 状态码顶上。
            http_status: info.http_status,
            provider_code: info.provider_code.clone(),
            provider_message: info.provider_message.clone(),
            operator_hint: info.operator_hint.clone(),
            trace_id: info.trace_id.clone(),
            base_url,
            checked_at,
        };
    }

    if let Some(transport) = err.chain().find_map(|cause| cause.downcast_ref::<reqwest::Error>()) {
        if transport.is_timeout() || transport.is_connect() || transport.is_request() {
            let summary = if transport.is_timeout() {
                "连接 MinerU 超时，请检查网络后重试"
            } else {
                "连接 MinerU 失败，请检查网络后重试"
            };
            let error_text = format!("{err:#}");
            return ProviderProbeView {
                ok: false,
                status: "network_error",
                summary: summary.to_string(),
                retryable: true,
                http_status: None,
                provider_code: None,
                provider_message: Some(error_text.clone()),
                operator_hint: Some(format!("没有收到 MinerU 的回复，和 Token 无关。底层错误：{error_text}")),
                trace_id: None,
                base_url,
                checked_at,
            };
        }
    }

    classify_probe_error(format!("{err:#}"), base_url, checked_at)
}

pub(super) fn classify_probe_error(
    error_text: String,
    base_url: String,
    checked_at: String,
) -> ProviderProbeView {
    let provider_code = extract_provider_error_code(&error_text);
    let provider_message = extract_provider_message(&error_text);
    let trace_id = extract_provider_trace_id(&error_text);

    if let Some(code) = provider_code.as_deref() {
        let mapped = map_provider_error_code(
            code,
            provider_message.clone().unwrap_or_default(),
            trace_id.as_deref(),
        );
        return ProviderProbeView {
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
            http_status: None,
            provider_code: mapped.provider_code,
            provider_message: mapped.provider_message,
            operator_hint: mapped.operator_hint,
            trace_id: mapped.trace_id,
            base_url,
            checked_at,
        };
    }

    let lowered = error_text.to_lowercase();
    // 服务商回了 401 / 403 却没带错误码（MineruResponseError 显示为「MinerU HTTP 401…」）：就是 Token 不对。
    let (status, summary, retryable) = if lowered.starts_with("mineru http 401")
        || lowered.starts_with("mineru http 403")
    {
        ("unauthorized", "MinerU Token 无效", false)
    } else if lowered.contains("timed out")
        || lowered.contains("timeout")
        || lowered.contains("failed to resolve")
        || lowered.contains("dns")
        || lowered.contains("connection")
    {
        ("network_error", "连接 MinerU 失败，请检查网络后重试", true)
    } else {
        // 没认出服务商的错误码：说不清是不是 Token 的问题，别把锅扣给 Token。
        ("provider_error", "没能完成 MinerU 校验，请稍后重试", true)
    };

    ProviderProbeView {
        ok: false,
        status,
        summary: summary.to_string(),
        retryable,
        http_status: None,
        provider_code,
        provider_message: provider_message.or(Some(error_text.clone())),
        operator_hint: Some(format!("没有拿到能判断 Token 好坏的回复。底层错误：{error_text}")),
        trace_id,
        base_url,
        checked_at,
    }
}

pub(super) fn classify_paddle_probe_error(
    err: anyhow::Error,
    base_url: String,
    checked_at: String,
) -> ProviderProbeView {
    if let Some(provider_err) = err.downcast_ref::<PaddleProviderError>() {
        let info = provider_err.info();
        if is_redirect(info.http_status) {
            return redirected_view(
                "Paddle",
                info.http_status.unwrap_or_default(),
                None,
                base_url,
                checked_at,
            );
        }
        let valid_404 = matches!(info.http_status, Some(404))
            || matches!(info.provider_code.as_deref(), Some("404"));
        if valid_404 {
            return ProviderProbeView {
                ok: true,
                status: "valid",
                summary: "Paddle Access Token 可用".to_string(),
                retryable: false,
                http_status: info.http_status,
                provider_code: info.provider_code.clone(),
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
            // 服务商回了错误，但不是鉴权问题：别说成 Token 有问题。
            _ => "Paddle 返回错误，校验没有通过".to_string(),
        };
        return ProviderProbeView {
            ok: false,
            status,
            summary,
            retryable: !matches!(
                info.category,
                OcrErrorCategory::Unauthorized | OcrErrorCategory::PermissionDenied
            ),
            http_status: info.http_status,
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
        ("network_error", "连接 Paddle 失败，请检查网络后重试", true)
    } else {
        ("provider_error", "没能完成 Paddle 校验，请稍后重试", true)
    };

    ProviderProbeView {
        ok: false,
        status,
        summary: summary.to_string(),
        retryable,
        http_status: None,
        provider_code: None,
        provider_message: Some(error_text.clone()),
        operator_hint: Some(format!("没有拿到能判断 Token 好坏的回复。底层错误：{error_text}")),
        trace_id: None,
        base_url,
        checked_at,
    }
}
