use crate::models::domain::JobArtifacts;
use crate::models::request::OcrInput;
use serde_json::Value;
use std::collections::BTreeMap;

use super::provider_config;
use super::{
    mineru, paddle, OcrProviderArtifactLayout, OcrProviderCapabilities, OcrProviderCredentialSpec,
    OcrProviderDiagnostics, OcrProviderKind, OcrProviderOptionSpec, OcrProviderPublicDefinition,
};

const MINERU_RESULT_FILE_NAME: &str = "mineru_result.json";
const MINERU_BUNDLE_FILE_NAME: &str = "mineru_bundle.zip";
const MINERU_UNPACK_DIR_NAME: &str = "unpacked";
const MINERU_LAYOUT_JSON_FILE_NAME: &str = "layout.json";
const OCR_CREDENTIAL_KIND: &str = "ocr_provider_token";
const OCR_CREDENTIAL_REFERENCE_FIELD: &str = "credential_ref";

#[derive(Debug, Clone)]
pub struct OcrProviderDefinition {
    pub kind: OcrProviderKind,
    pub key: &'static str,
    pub display_name: &'static str,
    pub token_field_name: &'static str,
    pub token_env_name: &'static str,
    pub capabilities: OcrProviderCapabilities,
    pub artifact_layout: OcrProviderArtifactLayout,
}

pub fn provider_definition(kind: &OcrProviderKind) -> Option<OcrProviderDefinition> {
    match kind {
        OcrProviderKind::Mineru => Some(OcrProviderDefinition {
            kind: OcrProviderKind::Mineru,
            key: "mineru",
            display_name: "MinerU",
            token_field_name: "mineru_token",
            token_env_name: "RETAIN_MINERU_API_TOKEN",
            capabilities: mineru::capabilities(),
            artifact_layout: OcrProviderArtifactLayout::new(
                MINERU_RESULT_FILE_NAME,
                MINERU_BUNDLE_FILE_NAME,
                MINERU_UNPACK_DIR_NAME,
                format!("{MINERU_UNPACK_DIR_NAME}/{MINERU_LAYOUT_JSON_FILE_NAME}"),
            ),
        }),
        OcrProviderKind::Paddle => Some(OcrProviderDefinition {
            kind: OcrProviderKind::Paddle,
            key: "paddle",
            display_name: "Paddle",
            token_field_name: "paddle_token",
            token_env_name: "RETAIN_PADDLE_API_TOKEN",
            capabilities: paddle::capabilities(),
            artifact_layout: OcrProviderArtifactLayout::new(
                "paddle_result.json",
                "paddle_bundle.zip",
                "paddle_raw",
                "paddle_result.json",
            ),
        }),
        OcrProviderKind::Local => Some(OcrProviderDefinition {
            kind: OcrProviderKind::Local,
            key: "local",
            display_name: "Local OCR",
            token_field_name: "",
            token_env_name: "",
            capabilities: OcrProviderCapabilities {
                supports_remote_url_submit: false,
                supports_local_file_upload: true,
                supports_polling: false,
                supports_download_bundle: false,
                supports_extra_formats: false,
                supports_formula_toggle: false,
                supports_table_toggle: false,
            },
            artifact_layout: OcrProviderArtifactLayout::new(
                "result.json",
                "bundle.zip",
                "local_raw",
                "result.json",
            ),
        }),
        OcrProviderKind::Unknown => None,
    }
}

pub fn provider_public_definitions() -> Vec<OcrProviderPublicDefinition> {
    let mut definitions: Vec<OcrProviderPublicDefinition> =
        provider_config::ocr_provider_definitions()
            .into_iter()
            .map(|(key, value)| provider_public_definition_from_config(key, value))
            .collect();
    definitions.sort_by(|left, right| {
        provider_sort_rank(&left.key)
            .cmp(&provider_sort_rank(&right.key))
            .then_with(|| left.key.cmp(&right.key))
    });
    definitions
}

fn provider_sort_rank(key: &str) -> u8 {
    match key {
        "mineru" => 0,
        "paddle" => 1,
        "local" => 2,
        _ => 3,
    }
}

fn provider_public_definition_from_config(
    key: String,
    value: Value,
) -> OcrProviderPublicDefinition {
    let provider_kind = value
        .get("kind")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .unwrap_or("remote")
        .to_string();
    let display_name = value
        .get("display_name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .unwrap_or(key.as_str())
        .to_string();
    let known_kind = kind_for_public_key(&key, &provider_kind);
    OcrProviderPublicDefinition {
        key: key.clone(),
        display_name,
        provider_kind: provider_kind.clone(),
        credential: parse_credential_spec(value.get("credential")),
        options: parse_option_specs(value.get("options")),
        capabilities: provider_capabilities_for_public(&known_kind, &provider_kind),
        artifact_layout: provider_artifact_layout_for_public(&known_kind, &key, &provider_kind),
    }
}

fn kind_for_public_key(key: &str, provider_kind: &str) -> OcrProviderKind {
    match key {
        "mineru" => OcrProviderKind::Mineru,
        "paddle" => OcrProviderKind::Paddle,
        "local" => OcrProviderKind::Local,
        _ if matches!(provider_kind, "local_command" | "remote_command") => OcrProviderKind::Local,
        _ => OcrProviderKind::Unknown,
    }
}

fn provider_capabilities_for_public(
    known_kind: &OcrProviderKind,
    provider_kind: &str,
) -> OcrProviderCapabilities {
    provider_capabilities(known_kind).unwrap_or_else(|| OcrProviderCapabilities {
        supports_remote_url_submit: provider_kind != "local_command",
        supports_local_file_upload: true,
        supports_polling: !matches!(provider_kind, "local_command" | "remote_command"),
        supports_download_bundle: !matches!(provider_kind, "local_command" | "remote_command"),
        supports_extra_formats: false,
        supports_formula_toggle: false,
        supports_table_toggle: false,
    })
}

fn provider_artifact_layout_for_public(
    known_kind: &OcrProviderKind,
    key: &str,
    provider_kind: &str,
) -> OcrProviderArtifactLayout {
    provider_artifact_layout(known_kind).unwrap_or_else(|| {
        let raw_dir = if matches!(provider_kind, "local_command" | "remote_command") {
            format!("{key}_raw")
        } else {
            "provider_raw".to_string()
        };
        OcrProviderArtifactLayout::new("result.json", "bundle.zip", raw_dir, "result.json")
    })
}

fn parse_credential_spec(value: Option<&Value>) -> Option<OcrProviderCredentialSpec> {
    let object = value?.as_object()?;
    let field = object
        .get("field")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|item| !item.is_empty())?
        .to_string();
    let env = object
        .get("env")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or("")
        .to_string();
    let required_for = object
        .get("required_for")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default();
    Some(OcrProviderCredentialSpec {
        credential_kind: OCR_CREDENTIAL_KIND.to_string(),
        reference_field: OCR_CREDENTIAL_REFERENCE_FIELD.to_string(),
        legacy_inline_field: field.clone(),
        field,
        env,
        required_for,
    })
}

fn parse_option_specs(value: Option<&Value>) -> BTreeMap<String, OcrProviderOptionSpec> {
    let Some(object) = value.and_then(Value::as_object) else {
        return BTreeMap::new();
    };
    object
        .iter()
        .filter_map(|(key, value)| parse_option_spec(value).map(|spec| (key.clone(), spec)))
        .collect()
}

fn parse_option_spec(value: &Value) -> Option<OcrProviderOptionSpec> {
    let object = value.as_object()?;
    let option_type = object
        .get("type")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .unwrap_or("string")
        .to_string();
    let default = object.get("default").cloned().unwrap_or(Value::Null);
    let env = object
        .get("env")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(ToString::to_string);
    let aliases = object
        .get("aliases")
        .and_then(Value::as_object)
        .map(|items| {
            items
                .iter()
                .filter_map(|(key, value)| {
                    value
                        .as_str()
                        .map(str::trim)
                        .filter(|item| !item.is_empty())
                        .map(|target| (key.clone(), target.to_string()))
                })
                .collect()
        })
        .unwrap_or_default();
    let choices = object
        .get("choices")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default();
    Some(OcrProviderOptionSpec {
        option_type,
        default,
        env,
        aliases,
        choices,
        required: object
            .get("required")
            .and_then(Value::as_bool)
            .unwrap_or(false),
    })
}

pub fn provider_capabilities(kind: &OcrProviderKind) -> Option<OcrProviderCapabilities> {
    provider_definition(kind).map(|definition| definition.capabilities)
}

pub fn provider_artifact_layout(kind: &OcrProviderKind) -> Option<OcrProviderArtifactLayout> {
    provider_definition(kind).map(|definition| definition.artifact_layout)
}

pub fn provider_display_name(kind: &OcrProviderKind) -> Option<&'static str> {
    provider_definition(kind).map(|definition| definition.display_name)
}

pub fn provider_token_field_name(kind: &OcrProviderKind) -> Option<&'static str> {
    provider_definition(kind).map(|definition| definition.token_field_name)
}

pub fn provider_token_env_name(kind: &OcrProviderKind) -> Option<&'static str> {
    provider_definition(kind).map(|definition| definition.token_env_name)
}

pub fn provider_token<'a>(kind: &OcrProviderKind, input: &'a OcrInput) -> &'a str {
    match kind {
        OcrProviderKind::Mineru => input.mineru_token.trim(),
        OcrProviderKind::Paddle => input.paddle_token.trim(),
        OcrProviderKind::Local => "",
        OcrProviderKind::Unknown => "",
    }
}

pub fn provider_model_version<'a>(kind: &OcrProviderKind, input: &'a OcrInput) -> &'a str {
    match kind {
        OcrProviderKind::Mineru => input.model_version.trim(),
        OcrProviderKind::Paddle => input.paddle_model.trim(),
        OcrProviderKind::Local => "local",
        OcrProviderKind::Unknown => "",
    }
}

pub fn supported_provider_keys() -> Vec<String> {
    provider_public_definitions()
        .into_iter()
        .map(|definition| definition.key)
        .collect()
}

pub fn is_supported_provider(kind: &OcrProviderKind) -> bool {
    provider_definition(kind).is_some()
}

pub fn ensure_provider_diagnostics(
    artifacts: &mut JobArtifacts,
    provider_kind: OcrProviderKind,
) -> &mut OcrProviderDiagnostics {
    let Some(definition) = provider_definition(&provider_kind) else {
        return artifacts
            .ocr_provider_diagnostics
            .get_or_insert_with(|| OcrProviderDiagnostics::new(provider_kind));
    };

    if artifacts.ocr_provider_diagnostics.is_none() {
        let mut diagnostics = OcrProviderDiagnostics::new(definition.kind.clone());
        diagnostics.capabilities = Some(definition.capabilities);
        artifacts.ocr_provider_diagnostics = Some(diagnostics);
    } else if artifacts
        .ocr_provider_diagnostics
        .as_ref()
        .map(|diag| diag.capabilities.is_none() || diag.provider != definition.kind)
        .unwrap_or(true)
    {
        let diagnostics = artifacts.ocr_provider_diagnostics.as_mut().unwrap();
        diagnostics.provider = definition.kind;
        diagnostics.capabilities = Some(definition.capabilities);
    }
    artifacts.ocr_provider_diagnostics.as_mut().unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_definition_exposes_supported_provider_keys() {
        assert_eq!(
            provider_definition(&OcrProviderKind::Mineru)
                .as_ref()
                .map(|item| item.key),
            Some("mineru")
        );
        assert_eq!(
            provider_definition(&OcrProviderKind::Paddle)
                .as_ref()
                .map(|item| item.key),
            Some("paddle")
        );
        assert_eq!(
            provider_definition(&OcrProviderKind::Local)
                .as_ref()
                .map(|item| item.key),
            Some("local")
        );
        assert!(provider_definition(&OcrProviderKind::Unknown).is_none());
    }

    #[test]
    fn provider_definition_exposes_provider_metadata() {
        let mineru = provider_definition(&OcrProviderKind::Mineru).expect("mineru definition");
        assert_eq!(mineru.display_name, "MinerU");
        assert_eq!(mineru.token_field_name, "mineru_token");
        assert_eq!(mineru.token_env_name, "RETAIN_MINERU_API_TOKEN");
        assert_eq!(
            mineru.artifact_layout.provider_result_json,
            "mineru_result.json"
        );
        assert_eq!(mineru.artifact_layout.layout_json, "unpacked/layout.json");
    }

    #[test]
    fn supported_provider_keys_lists_all_supported_backends() {
        assert_eq!(supported_provider_keys(), vec!["mineru", "paddle", "local"]);
    }

    #[test]
    fn provider_public_definitions_expose_credentials_and_options() {
        let definitions = provider_public_definitions();
        let paddle = definitions
            .iter()
            .find(|definition| definition.key == "paddle")
            .expect("paddle public definition");
        assert_eq!(paddle.display_name, "PaddleOCR");
        let credential = paddle.credential.as_ref().expect("paddle credential");
        assert_eq!(credential.credential_kind, "ocr_provider_token");
        assert_eq!(credential.reference_field, "credential_ref");
        assert_eq!(credential.legacy_inline_field, "paddle_token");
        assert_eq!(credential.field, "paddle_token");
        assert_eq!(credential.env, "RETAIN_PADDLE_API_TOKEN");
        assert_eq!(
            paddle
                .options
                .get("paddle_model")
                .map(|option| option.option_type.as_str()),
            Some("string")
        );
        assert!(paddle
            .options
            .get("paddle_model")
            .map(|option| option.aliases.contains_key("paddleocr-vl"))
            .unwrap_or(false));
        let transport = paddle.options.get("transport").expect("transport option");
        assert_eq!(transport.default, serde_json::json!("official_http"));
        assert_eq!(transport.choices, vec!["official_http", "official_cli"]);
    }

    #[test]
    fn configured_provider_credential_keeps_declared_field_as_legacy_hint() {
        let definition = provider_public_definition_from_config(
            "acme".to_string(),
            serde_json::json!({
                "display_name": "Acme OCR",
                "kind": "remote_command",
                "credential": {
                    "field": "acme_token",
                    "env": "ACME_OCR_TOKEN",
                    "required_for": ["local_upload"]
                }
            }),
        );

        let credential = definition.credential.expect("configured credential");
        assert_eq!(credential.credential_kind, "ocr_provider_token");
        assert_eq!(credential.reference_field, "credential_ref");
        assert_eq!(credential.legacy_inline_field, "acme_token");
        assert_eq!(credential.field, "acme_token");
        assert_eq!(credential.env, "ACME_OCR_TOKEN");
        assert_eq!(credential.required_for, vec!["local_upload"]);
    }

    #[test]
    fn ensure_provider_diagnostics_initializes_capabilities() {
        let mut artifacts = JobArtifacts::default();
        let diagnostics = ensure_provider_diagnostics(&mut artifacts, OcrProviderKind::Paddle);
        assert_eq!(diagnostics.provider, OcrProviderKind::Paddle);
        assert!(diagnostics.capabilities.is_some());
    }
}
