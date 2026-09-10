use crate::error::AppError;
use crate::models::api::ReaderAiChatRequest;

#[derive(Debug, Clone)]
pub(super) struct ReaderAiConfig {
    pub model: String,
    pub api_key: String,
    pub base_url: String,
}

impl ReaderAiConfig {
    pub(super) fn from_request(request: Option<&ReaderAiChatRequest>) -> Result<Self, AppError> {
        let request_api_key = request_value(request.and_then(|item| item.api_key.as_deref()));
        let provider = if request_api_key.is_some() {
            request_value(request.and_then(|item| item.provider.as_deref()))
                .or_else(|| env_value("RETAINPDF_AI_PROVIDER"))
                .unwrap_or_else(|| "deepseek".to_string())
        } else {
            reject_server_key_override(request)?;
            env_value("RETAINPDF_AI_PROVIDER").unwrap_or_else(|| "deepseek".to_string())
        };
        let resolved = resolve_provider_defaults(&provider)?;
        let model = if request_api_key.is_some() {
            request_value(request.and_then(|item| item.model.as_deref()))
                .or_else(|| env_value("RETAINPDF_AI_MODEL"))
                .unwrap_or_else(|| resolved.default_model)
        } else {
            env_value("RETAINPDF_AI_MODEL").unwrap_or_else(|| resolved.default_model)
        };
        let api_key = request_api_key
            .or_else(|| env_value("RETAINPDF_AI_API_KEY"))
            .or_else(|| env_value(resolved.api_key_env))
            .ok_or_else(|| {
                AppError::internal(format!(
                    "RETAINPDF_AI_API_KEY or {} is required",
                    resolved.api_key_env
                ))
            })?;
        let base_url = if request.and_then(|item| item.api_key.as_deref()).is_some() {
            request_value(request.and_then(|item| item.base_url.as_deref()))
                .or_else(|| env_value("RETAINPDF_AI_BASE_URL"))
                .unwrap_or_else(|| resolved.default_base_url)
        } else {
            env_value("RETAINPDF_AI_BASE_URL").unwrap_or_else(|| resolved.default_base_url)
        };
        validate_base_url(&base_url)?;
        Ok(Self {
            model,
            api_key,
            base_url: base_url.trim_end_matches('/').to_string(),
        })
    }
}

fn request_value(value: Option<&str>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn reject_server_key_override(request: Option<&ReaderAiChatRequest>) -> Result<(), AppError> {
    let Some(request) = request else {
        return Ok(());
    };
    if request_value(request.base_url.as_deref()).is_some()
        || request_value(request.provider.as_deref()).is_some()
    {
        return Err(AppError::bad_request(
            "reader AI provider/base_url overrides require request api_key",
        ));
    }
    Ok(())
}

fn validate_base_url(base_url: &str) -> Result<(), AppError> {
    let parsed = reqwest::Url::parse(base_url)
        .map_err(|_| AppError::bad_request("reader AI base_url must be a valid URL"))?;
    let scheme = parsed.scheme();
    let host = parsed.host_str().unwrap_or("");
    if scheme == "https" {
        return Ok(());
    }
    if scheme == "http" && matches!(host, "localhost" | "127.0.0.1" | "::1") {
        return Ok(());
    }
    Err(AppError::bad_request(
        "reader AI base_url must use https, or http for localhost only",
    ))
}

struct ProviderDefaults {
    default_model: String,
    default_base_url: String,
    api_key_env: &'static str,
}

fn resolve_provider_defaults(provider: &str) -> Result<ProviderDefaults, AppError> {
    match provider {
        "deepseek" => Ok(ProviderDefaults {
            default_model: "deepseek-chat".to_string(),
            default_base_url: "https://api.deepseek.com/v1".to_string(),
            api_key_env: "DEEPSEEK_API_KEY",
        }),
        "openai" => Ok(ProviderDefaults {
            default_model: "gpt-4.1-mini".to_string(),
            default_base_url: "https://api.openai.com/v1".to_string(),
            api_key_env: "OPENAI_API_KEY",
        }),
        other => Err(AppError::bad_request(format!(
            "unsupported reader AI provider: {other}"
        ))),
    }
}

fn env_value(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deepseek_is_default_reader_ai_provider_shape() {
        let defaults = resolve_provider_defaults("deepseek").expect("deepseek defaults");
        assert_eq!(defaults.default_model, "deepseek-chat");
        assert_eq!(defaults.default_base_url, "https://api.deepseek.com/v1");
        assert_eq!(defaults.api_key_env, "DEEPSEEK_API_KEY");
    }

    #[test]
    fn openai_compatible_provider_is_still_supported() {
        let defaults = resolve_provider_defaults("openai").expect("openai defaults");
        assert_eq!(defaults.default_model, "gpt-4.1-mini");
        assert_eq!(defaults.default_base_url, "https://api.openai.com/v1");
        assert_eq!(defaults.api_key_env, "OPENAI_API_KEY");
    }

    #[test]
    fn request_values_can_provide_reader_ai_credentials() {
        let request = ReaderAiChatRequest {
            message: "hello".to_string(),
            scope: "document".to_string(),
            provider: Some("deepseek".to_string()),
            model: Some("deepseek-chat".to_string()),
            api_key: Some("sk-reader".to_string()),
            base_url: Some("https://reader.example/v1/".to_string()),
            context: None,
            history: vec![],
        };

        let config = ReaderAiConfig::from_request(Some(&request)).expect("request config");

        assert_eq!(config.model, "deepseek-chat");
        assert_eq!(config.api_key, "sk-reader");
        assert_eq!(config.base_url, "https://reader.example/v1");
    }

    #[test]
    fn request_base_url_requires_request_api_key() {
        let request = ReaderAiChatRequest {
            message: "hello".to_string(),
            scope: "document".to_string(),
            provider: None,
            model: None,
            api_key: None,
            base_url: Some("https://reader.example/v1".to_string()),
            context: None,
            history: vec![],
        };

        let err = ReaderAiConfig::from_request(Some(&request)).expect_err("base_url rejected");

        assert!(matches!(err, AppError::BadRequest(_)));
    }

    #[test]
    fn rejects_non_local_http_reader_ai_base_url() {
        let request = ReaderAiChatRequest {
            message: "hello".to_string(),
            scope: "document".to_string(),
            provider: Some("deepseek".to_string()),
            model: Some("deepseek-chat".to_string()),
            api_key: Some("sk-reader".to_string()),
            base_url: Some("http://example.com/v1".to_string()),
            context: None,
            history: vec![],
        };

        let err = ReaderAiConfig::from_request(Some(&request)).expect_err("http rejected");

        assert!(matches!(err, AppError::BadRequest(_)));
    }
}
