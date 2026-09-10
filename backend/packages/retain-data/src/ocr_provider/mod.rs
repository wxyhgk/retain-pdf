mod catalog;
pub mod mineru;
pub mod paddle;
pub(crate) use crate::config::provider_config;
pub mod types;

use crate::models::request::OcrInput;
use anyhow::{bail, Result};

pub const PADDLE_OFFICIAL_HTTP_TRANSPORT: &str = "official_http";
pub const PADDLE_OFFICIAL_CLI_TRANSPORT: &str = "official_cli";

#[allow(unused_imports)]
pub use catalog::{
    ensure_provider_diagnostics, is_supported_provider, provider_artifact_layout,
    provider_capabilities, provider_definition, provider_display_name, provider_model_version,
    provider_public_definitions, provider_token, provider_token_env_name,
    provider_token_field_name, supported_provider_keys,
};
pub use provider_config::{
    configured_provider_credential_env, normalize_paddle_model_name, paddle_default_model,
};
pub use types::{
    OcrArtifactSet, OcrErrorCategory, OcrProviderArtifactLayout, OcrProviderCapabilities,
    OcrProviderCredentialSpec, OcrProviderDiagnostics, OcrProviderErrorInfo, OcrProviderKind,
    OcrProviderOptionSpec, OcrProviderPublicDefinition, OcrTaskHandle, OcrTaskState, OcrTaskStatus,
};

pub fn parse_provider_kind(value: &str) -> OcrProviderKind {
    match value.trim().to_ascii_lowercase().as_str() {
        "mineru" => OcrProviderKind::Mineru,
        "paddle" => OcrProviderKind::Paddle,
        "local" => OcrProviderKind::Local,
        _ => OcrProviderKind::Unknown,
    }
}

pub fn require_supported_provider(value: &str) -> Result<OcrProviderKind> {
    let kind = parse_provider_kind(value);
    if is_supported_provider(&kind) {
        return Ok(kind);
    }
    if provider_config::is_configured_command_provider(value) {
        return Ok(OcrProviderKind::Local);
    }
    if !is_supported_provider(&kind) {
        bail!("unsupported OCR provider: {}", value.trim());
    }
    Ok(kind)
}

pub fn is_configured_command_provider(value: &str) -> bool {
    provider_config::is_configured_command_provider(value)
}

pub fn paddle_transport(input: &OcrInput) -> Option<&str> {
    if !matches!(
        parse_provider_kind(&input.provider),
        OcrProviderKind::Paddle
    ) {
        return None;
    }
    input
        .options
        .get("transport")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

pub fn uses_paddle_official_cli(input: &OcrInput) -> bool {
    paddle_transport(input)
        .map(|transport| transport.eq_ignore_ascii_case(PADDLE_OFFICIAL_CLI_TRANSPORT))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn paddle_cli_transport_is_explicit_and_provider_scoped() {
        let mut input = OcrInput::default();
        input.provider = "paddle".to_string();
        assert!(!uses_paddle_official_cli(&input));

        input.options.insert(
            "transport".to_string(),
            Value::String(" official_cli ".to_string()),
        );
        assert!(uses_paddle_official_cli(&input));

        input.provider = "mineru".to_string();
        assert!(!uses_paddle_official_cli(&input));
    }
}
