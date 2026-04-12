use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::models::{now_iso, ApiResponse};
use crate::ocr_provider::mineru::{
    extract_provider_error_code, extract_provider_message, extract_provider_trace_id,
    map_provider_error_code, MineruClient,
};
use crate::ocr_provider::OcrErrorCategory;
use crate::AppState;

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

pub async fn validate_mineru_token(
    State(_state): State<AppState>,
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

#[cfg(test)]
mod tests {
    use super::classify_probe_error;

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
}
