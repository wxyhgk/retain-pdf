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
