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
        "glm_ocr" => 2,
        "local" => 3,
        _ => 4,
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
        .filter_map(|(key, value)| parse_option_spec(key, value).map(|spec| (key.clone(), spec)))
        .collect()
}

fn parse_option_spec(key: &str, value: &Value) -> Option<OcrProviderOptionSpec> {
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
    let client_settable = option_is_client_settable(key, object, env.is_some());
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
        client_settable,
    })
}

/// 不管哪个提供方、配置怎么写，都只能服务器定的选项：本地 / 命令型 OCR 要执行的命令，
/// 和原始结果交给哪个转换器（`document_schema` 的 adapter 名）。
pub const SERVER_OWNED_OCR_OPTION_KEYS: [&str; 2] = ["command", "raw_provider"];

/// 一个选项客户端能不能在建任务请求里带（审计 A2，2026-10-22）：
/// 1. `command`、`raw_provider` 永远不能；
/// 2. 配置里写了 `client_settable` 的照它（只能用来放开没列在第 1 条里的）；
/// 3. 配置里带 `env` 的不能——带 `env` 说明这是运维用环境变量定的东西；
/// 4. 其余能。
fn option_is_client_settable(
    key: &str,
    object: &serde_json::Map<String, Value>,
    has_env: bool,
) -> bool {
    if SERVER_OWNED_OCR_OPTION_KEYS.contains(&key) {
        return false;
    }
    if let Some(explicit) = object.get("client_settable").and_then(Value::as_bool) {
        return explicit;
    }
    !has_env
}

/// 给 `GET /providers/ocr` 的提供方清单：只能服务器定的选项照样列出（客户端能看到有这么个
/// 选项、`client_settable: false`），但不给默认值（`default: null`）——运维在配置文件里写的
/// 命令通常带本机路径，不该给所有登录用户。流水线要的真实默认值用 [`provider_public_definitions`]。
pub fn provider_client_definitions() -> Vec<OcrProviderPublicDefinition> {
    provider_public_definitions()
        .into_iter()
        .map(|mut definition| {
            for spec in definition.options.values_mut() {
                if !spec.client_settable {
                    spec.default = Value::Null;
                }
            }
            definition
        })
        .collect()
}

/// 这个提供方的这个选项是不是只能服务器定。配置里没登记的选项（例如 Paddle CLI 的
/// `cli_timeout`）除 [`SERVER_OWNED_OCR_OPTION_KEYS`] 外都算客户端可填。
pub fn is_server_owned_ocr_option(provider: &str, key: &str) -> bool {
    if SERVER_OWNED_OCR_OPTION_KEYS.contains(&key) {
        return true;
    }
    let provider_key = provider.trim().to_ascii_lowercase();
    provider_config::ocr_provider_definitions()
        .get(&provider_key)
        .and_then(|definition| definition.get("options"))
        .and_then(Value::as_object)
        .and_then(|options| options.get(key))
        .and_then(Value::as_object)
        .is_some_and(|object| {
            let has_env = object
                .get("env")
                .and_then(Value::as_str)
                .is_some_and(|env| !env.trim().is_empty());
            !option_is_client_settable(key, object, has_env)
        })
}

/// 请求的 `ocr.options` 里只能服务器定的那些键（按键名排序）。
pub fn server_owned_ocr_options(input: &OcrInput) -> Vec<String> {
    input
        .options
        .keys()
        .filter(|key| is_server_owned_ocr_option(&input.provider, key))
        .cloned()
        .collect()
}

/// 去掉 `ocr.options` 里只能服务器定的键，返回去掉了哪些。重跑、阶段重试复制源任务的请求时用：
/// 以前的任务请求里可能存着它们（2026-10-22 之前建任务不拦），复制过来不能因此 400，也不该再带下去。
pub fn strip_server_owned_ocr_options(input: &mut OcrInput) -> Vec<String> {
    let keys = server_owned_ocr_options(input);
    for key in &keys {
        input.options.remove(key);
    }
    keys
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
        assert_eq!(
            supported_provider_keys(),
            vec!["mineru", "paddle", "glm_ocr", "local"]
        );
    }

    /// GLM-OCR 走命令型 provider（Python worker 里调接口、裁图、归一化），只收上传的本地文件，key 走 `RETAIN_GLM_OCR_API_TOKEN`。
    #[test]
    fn glm_ocr_is_a_remote_command_provider_for_uploaded_files() {
        let glm = provider_public_definitions()
            .into_iter()
            .find(|definition| definition.key == "glm_ocr")
            .expect("glm_ocr definition");
        assert_eq!(glm.display_name, "GLM-OCR");
        assert_eq!(glm.provider_kind, "remote_command");
        let credential = glm.credential.expect("glm_ocr credential spec");
        assert_eq!(credential.field, "credential");
        assert_eq!(credential.env, "RETAIN_GLM_OCR_API_TOKEN");
        assert!(!glm.capabilities.supports_remote_url_submit);
        assert!(glm.capabilities.supports_local_file_upload);
        assert!(crate::ocr_provider::is_configured_command_provider("glm_ocr"));
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

    /// 配置里每个提供方的每个选项都分了类（客户端可填 / 只能服务器定）。往 ocr_providers.json
    /// 加选项时这里会红：想清楚它该归哪边，再改这张表和方案文件
    /// `docs/ops/planning/api-reorg/20261022-OCR提供方选项分客户端和服务器.md` 的表。
    #[test]
    fn every_configured_option_is_classified() {
        let actual: Vec<(String, String, bool)> = provider_public_definitions()
            .into_iter()
            .flat_map(|definition| {
                let key = definition.key.clone();
                definition
                    .options
                    .into_iter()
                    .map(move |(option, spec)| (key.clone(), option, spec.client_settable))
            })
            .collect();
        let expected: Vec<(String, String, bool)> = [
            ("mineru", "disable_formula", true),
            ("mineru", "disable_table", true),
            ("mineru", "language", true),
            ("mineru", "model_version", true),
            ("paddle", "paddle_api_url", true),
            ("paddle", "paddle_model", true),
            ("paddle", "transport", true),
            ("local", "command", false),
            ("local", "raw_provider", false),
        ]
        .into_iter()
        .map(|(provider, option, settable)| (provider.to_string(), option.to_string(), settable))
        .collect();
        assert_eq!(actual, expected);
        for (provider, option, settable) in &expected {
            assert_eq!(is_server_owned_ocr_option(provider, option), !settable, "{provider}.{option}");
        }
        // 没登记的选项（Paddle CLI 的超时、开关）客户端可填；command / raw_provider 对哪个提供方都不行。
        assert!(!is_server_owned_ocr_option("paddle", "cli_timeout"));
        assert!(is_server_owned_ocr_option("paddle", "command"));
        assert!(is_server_owned_ocr_option("mineru", "raw_provider"));
        assert!(is_server_owned_ocr_option("no-such-provider", "command"));
    }

    #[test]
    fn env_backed_options_are_server_owned_unless_config_opts_in() {
        let definition = provider_public_definition_from_config(
            "acme".to_string(),
            serde_json::json!({
                "kind": "remote_command",
                "options": {
                    "endpoint": {"type": "string", "env": "ACME_ENDPOINT", "default": "http://10.0.0.5"},
                    "timeout": {"type": "number", "env": "ACME_TIMEOUT", "client_settable": true, "default": 30},
                    "command": {"type": "string", "client_settable": true, "default": "/opt/acme/run"},
                    "lang": {"type": "string", "default": "en"}
                }
            }),
        );
        let settable = |key: &str| definition.options[key].client_settable;
        assert!(!settable("endpoint"), "带 env 的默认只能服务器定");
        assert!(settable("timeout"), "配置可以明说放开");
        assert!(!settable("command"), "command 配置里放开也不算");
        assert!(settable("lang"));
    }

    #[test]
    fn client_definitions_hide_defaults_of_server_owned_options() {
        let definitions = provider_client_definitions();
        let local = definitions
            .iter()
            .find(|definition| definition.key == "local")
            .expect("local");
        for key in ["command", "raw_provider"] {
            let spec = &local.options[key];
            assert!(!spec.client_settable, "{key}");
            assert!(spec.default.is_null(), "{key}: {:?}", spec.default);
        }
        let paddle = definitions
            .iter()
            .find(|definition| definition.key == "paddle")
            .expect("paddle");
        assert_eq!(paddle.options["transport"].default, serde_json::json!("official_http"));
        // 流水线用的那份照旧带真实默认值。
        let internal = provider_public_definitions();
        let local = internal.iter().find(|definition| definition.key == "local").unwrap();
        assert_eq!(local.options["raw_provider"].default, serde_json::json!("generic_flat_ocr"));
    }

    #[test]
    fn strip_removes_only_server_owned_options() {
        let mut input = OcrInput::default();
        input.provider = "local".to_string();
        for (key, value) in [("command", "x"), ("raw_provider", "y"), ("credential", "z")] {
            input.options.insert(key.to_string(), serde_json::json!(value));
        }
        assert_eq!(server_owned_ocr_options(&input), vec!["command", "raw_provider"]);
        assert_eq!(strip_server_owned_ocr_options(&mut input), vec!["command", "raw_provider"]);
        assert_eq!(input.options.keys().collect::<Vec<_>>(), vec!["credential"]);
    }

    #[test]
    fn ensure_provider_diagnostics_initializes_capabilities() {
        let mut artifacts = JobArtifacts::default();
        let diagnostics = ensure_provider_diagnostics(&mut artifacts, OcrProviderKind::Paddle);
        assert_eq!(diagnostics.provider, OcrProviderKind::Paddle);
        assert!(diagnostics.capabilities.is_some());
    }
}
