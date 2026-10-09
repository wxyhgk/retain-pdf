use super::deepseek::is_model_rejection;
use super::ocr::{classify_paddle_probe_error, classify_probe_error};
use super::url_policy::validate_provider_base_url;
use crate::ocr_provider::paddle::PaddleProviderError;

#[test]
fn validate_provider_base_url_allows_public_https_host() {
    assert!(validate_provider_base_url("https://api.deepseek.com/v1", false).is_ok());
}

#[test]
fn validate_provider_base_url_rejects_non_http_scheme() {
    let err = validate_provider_base_url("ftp://example.com", false).unwrap_err();
    assert!(err.to_string().contains("scheme"));
}

#[test]
fn validate_provider_base_url_rejects_localhost_hostname() {
    let err = validate_provider_base_url("http://localhost:11434", false).unwrap_err();
    assert!(err.to_string().contains("not allowed"));
}

#[test]
fn validate_provider_base_url_rejects_loopback_ip() {
    let err = validate_provider_base_url("http://127.0.0.1:8080", false).unwrap_err();
    assert!(err.to_string().contains("not allowed"));
}

#[test]
fn validate_provider_base_url_rejects_link_local_metadata_ip() {
    let err = validate_provider_base_url("http://169.254.169.254/latest", false).unwrap_err();
    assert!(err.to_string().contains("not allowed"));
}

#[test]
fn validate_provider_base_url_rejects_private_network_ranges() {
    assert!(validate_provider_base_url("http://10.0.0.5", false).is_err());
    assert!(validate_provider_base_url("http://172.16.0.5", false).is_err());
    assert!(validate_provider_base_url("http://192.168.1.5", false).is_err());
}

#[test]
fn validate_provider_base_url_rejects_ipv6_loopback_and_unique_local() {
    assert!(validate_provider_base_url("http://[::1]", false).is_err());
    assert!(validate_provider_base_url("http://[fc00::1]", false).is_err());
    assert!(validate_provider_base_url("http://[fe80::1]", false).is_err());
}

#[test]
fn validate_provider_base_url_rejects_embedded_credentials() {
    let err = validate_provider_base_url("https://user:pass@example.com", false).unwrap_err();
    assert!(err.to_string().contains("credentials"));
}

#[test]
fn validate_provider_base_url_allow_private_urls_escape_hatch() {
    assert!(validate_provider_base_url("http://127.0.0.1:11434", true).is_ok());
    assert!(validate_provider_base_url("http://localhost:11434", true).is_ok());
}

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
        "POST https://mineru.net/api/v4/file-urls/batch failed: operation timed out".to_string(),
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

// --- 翻译接口探针的模型拒绝分类 -------------------------------------------
// 探针改走 /chat/completions 后，4xx 既可能是 Key 问题也可能是模型问题，
// 两者给用户的下一步动作完全不同，分类错了就把人指向错误的输入框。

#[test]
fn is_model_rejection_detects_openai_style_model_not_found() {
    assert!(is_model_rejection(
        reqwest::StatusCode::BAD_REQUEST,
        Some("The model `gpt-nonexistent` does not exist"),
    ));
}

#[test]
fn is_model_rejection_detects_chinese_model_error() {
    assert!(is_model_rejection(
        reqwest::StatusCode::BAD_REQUEST,
        Some("模型不存在或无权限"),
    ));
}

#[test]
fn is_model_rejection_treats_bare_404_as_model_unavailable() {
    // 兼容层缺少 /chat/completions 时正文常常不可解析，等价于该模型不可用。
    assert!(is_model_rejection(reqwest::StatusCode::NOT_FOUND, None));
}

#[test]
fn is_model_rejection_ignores_unrelated_bad_request() {
    assert!(!is_model_rejection(
        reqwest::StatusCode::BAD_REQUEST,
        Some("invalid temperature value"),
    ));
}

#[test]
fn is_model_rejection_ignores_rate_limit_and_server_errors() {
    assert!(!is_model_rejection(
        reqwest::StatusCode::TOO_MANY_REQUESTS,
        Some("model rate limit exceeded"),
    ));
    assert!(!is_model_rejection(
        reqwest::StatusCode::INTERNAL_SERVER_ERROR,
        Some("model backend crashed"),
    ));
}

#[test]
fn is_model_rejection_ignores_unauthorized_even_when_body_mentions_model() {
    assert!(!is_model_rejection(
        reqwest::StatusCode::UNAUTHORIZED,
        Some("no access to model"),
    ));
}

/// Anthropic 协议的探针走 `/messages` + x-api-key,不带 Bearer。
#[tokio::test]
async fn anthropic_probe_uses_the_messages_api() {
    use super::deepseek::validate_deepseek_token_view;
    use super::types::DeepSeekTokenValidationRequest;
    use crate::config::DeepSeekRuntimeConfig;
    use axum::http::HeaderMap;
    use axum::routing::post;
    use std::sync::{Arc, Mutex};

    let seen: Arc<Mutex<Vec<(Option<String>, Option<String>, Option<String>, serde_json::Value)>>> =
        Arc::default();
    let recorder = seen.clone();
    let router = axum::Router::new().route(
        "/v1/messages",
        post(move |headers: HeaderMap, axum::Json(body): axum::Json<serde_json::Value>| {
            let recorder = recorder.clone();
            async move {
                let header = |name: &str| headers.get(name).and_then(|v| v.to_str().ok()).map(str::to_string);
                recorder.lock().unwrap().push((
                    header("x-api-key"),
                    header("anthropic-version"),
                    header("authorization"),
                    body,
                ));
                axum::Json(serde_json::json!({"content": [{"type": "text", "text": "p"}]}))
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });

    let view = validate_deepseek_token_view(
        DeepSeekTokenValidationRequest {
            api_key: "sk-ant".into(),
            base_url: format!("http://{addr}/v1"),
            model: "claude-sonnet-5".into(),
            api_protocol: "anthropic".into(),
        },
        DeepSeekRuntimeConfig {
            default_base_url: "https://api.deepseek.com/v1".into(),
            balance_url: String::new(),
            probe_timeout_secs: 5,
            allow_private_urls: true,
        },
    )
    .await
    .unwrap();

    assert!(view.ok, "{}", view.summary);
    let seen = seen.lock().unwrap();
    let (key, version, authorization, body) = &seen[0];
    assert_eq!(key.as_deref(), Some("sk-ant"));
    assert_eq!(version.as_deref(), Some("2023-06-01"));
    assert_eq!(authorization, &None);
    assert_eq!(body["model"], "claude-sonnet-5");
    assert_eq!(body["max_tokens"], 1);
}
