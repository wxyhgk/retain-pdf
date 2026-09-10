use serde_json::{Map, Value};

use super::input::ResolvedJobSpec;

const REDACTED_SECRET: &str = "[REDACTED]";
const SENSITIVE_JSON_KEYS: &[&str] = &["api_key", "mineru_token", "paddle_token"];

// Keys under `ocr.options` that worker_process.rs treats as credentials for
// configured (option-sourced) OCR providers, exported as RETAIN_OCR_CREDENTIAL.
// See job_runner::worker_process::configured_provider_token.
const OCR_OPTION_SECRET_KEYS: &[&str] = &["credential", "token", "api_key"];

pub fn sensitive_values(spec: &ResolvedJobSpec) -> Vec<String> {
    let mut values: Vec<String> = [
        spec.translation.api_key.trim(),
        spec.ocr.mineru_token.trim(),
        spec.ocr.paddle_token.trim(),
    ]
    .into_iter()
    .filter(|value| !value.is_empty())
    .map(str::to_string)
    .collect();

    for key in OCR_OPTION_SECRET_KEYS {
        if let Some(text) = spec
            .ocr
            .options
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            values.push(text.to_string());
        }
    }

    values
}

pub fn redact_text(text: &str, secrets: &[String]) -> String {
    let mut redacted = text.to_string();
    for secret in secrets {
        if !secret.is_empty() {
            redacted = redacted.replace(secret, REDACTED_SECRET);
        }
    }
    redacted
}

pub fn redact_optional_text(value: Option<&str>, secrets: &[String]) -> Option<String> {
    value.map(|text| redact_text(text, secrets))
}

pub fn redact_json_value(value: &Value, secrets: &[String]) -> Value {
    match value {
        Value::Object(map) => Value::Object(redact_json_object(map, secrets)),
        Value::Array(items) => Value::Array(
            items
                .iter()
                .map(|item| redact_json_value(item, secrets))
                .collect(),
        ),
        Value::String(text) => Value::String(redact_text(text, secrets)),
        _ => value.clone(),
    }
}

fn redact_json_object(map: &Map<String, Value>, secrets: &[String]) -> Map<String, Value> {
    let mut redacted = Map::with_capacity(map.len());
    for (key, value) in map {
        let next = if SENSITIVE_JSON_KEYS.contains(&key.as_str()) {
            Value::String(String::new())
        } else {
            redact_json_value(value, secrets)
        };
        redacted.insert(key.clone(), next);
    }
    redacted
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CreateJobInput;

    #[test]
    fn sensitive_values_collects_ocr_option_sourced_credentials() {
        let mut input = CreateJobInput::default();
        input.ocr.options.insert(
            "credential".to_string(),
            Value::String("opt-cred-1".to_string()),
        );
        input.ocr.options.insert(
            "token".to_string(),
            Value::String("opt-token-2".to_string()),
        );
        input.ocr.options.insert(
            "api_key".to_string(),
            Value::String("  opt-api-key-3  ".to_string()),
        );
        // Non-string / empty values must not produce bogus secrets.
        input
            .ocr
            .options
            .insert("credential_extra".to_string(), Value::Bool(true));
        input
            .ocr
            .options
            .insert("token_empty".to_string(), Value::String(String::new()));

        let spec = ResolvedJobSpec::from_input(input);
        let secrets = sensitive_values(&spec);

        assert!(secrets.contains(&"opt-cred-1".to_string()));
        assert!(secrets.contains(&"opt-token-2".to_string()));
        // Values are trimmed before being treated as secrets.
        assert!(secrets.contains(&"opt-api-key-3".to_string()));

        let text = redact_text(
            "cred=opt-cred-1 token=opt-token-2 key=opt-api-key-3",
            &secrets,
        );
        assert!(!text.contains("opt-cred-1"));
        assert!(!text.contains("opt-token-2"));
        assert!(!text.contains("opt-api-key-3"));
        assert!(text.contains(REDACTED_SECRET));
    }

    #[test]
    fn sensitive_values_ignores_keys_outside_the_known_credential_set() {
        let mut input = CreateJobInput::default();
        input.ocr.options.insert(
            "unrelated".to_string(),
            Value::String("not-a-secret".to_string()),
        );

        let spec = ResolvedJobSpec::from_input(input);
        let secrets = sensitive_values(&spec);

        assert!(!secrets.contains(&"not-a-secret".to_string()));
    }
}
