use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;

use serde_json::Value;

const OCR_PROVIDER_CONFIG_ENV: &str = "RETAIN_OCR_PROVIDER_CONFIG";
const OCR_PROVIDER_CONFIG_COMPAT_ENV: &str = "RUST_API_OCR_PROVIDER_CONFIG";
const PADDLE_DEFAULT_MODEL_ENV: &str = "RETAIN_PADDLE_DEFAULT_MODEL";
const PADDLE_DEFAULT_MODEL_COMPAT_ENV: &str = "RUST_API_PADDLE_DEFAULT_MODEL";
const PADDLE_DEFAULT_MODEL_FALLBACK: &str = "PaddleOCR-VL-1.6";

/// OCR 服务商清单 `backend/config/ocr_providers.json`，编译时嵌进来。
///
/// 清单是 OCR 服务商的唯一来源：运行时读不到文件（或文件坏了）就用这份，不再另写一份手抄的定义
/// （以前 Rust、Python 各有一份「找不到文件时用」的定义，接 GLM-OCR 时三处都要改）。
/// 部署要加命令型服务商，照旧用 `RETAIN_OCR_PROVIDER_CONFIG` 指向自己的文件。
const BUNDLED_OCR_PROVIDER_CONFIG: &str = include_str!("../../../../config/ocr_providers.json");

fn bundled_ocr_provider_config() -> &'static Value {
    static BUNDLED: OnceLock<Value> = OnceLock::new();
    BUNDLED.get_or_init(|| {
        serde_json::from_str(BUNDLED_OCR_PROVIDER_CONFIG)
            .expect("backend/config/ocr_providers.json 必须是合法 JSON（测试 bundled_manifest_* 钉着）")
    })
}

pub fn ocr_provider_config_path() -> PathBuf {
    config_path().expect("retainpdf-core must resolve a backend provider config path")
}

pub fn paddle_default_model() -> String {
    env_override(PADDLE_DEFAULT_MODEL_ENV)
        .or_else(|| env_override(PADDLE_DEFAULT_MODEL_COMPAT_ENV))
        .or_else(|| {
            paddle_config()
                .get("default_model")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToString::to_string)
        })
        .unwrap_or_else(|| PADDLE_DEFAULT_MODEL_FALLBACK.to_string())
}

pub fn normalize_paddle_model_name(model: &str) -> String {
    let trimmed = model.trim();
    if trimmed.is_empty() {
        return paddle_default_model();
    }
    let lowered = trimmed.to_ascii_lowercase();
    paddle_config()
        .get("model_aliases")
        .and_then(Value::as_object)
        .and_then(|aliases| aliases.get(&lowered))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| trimmed.to_string())
}

pub fn ocr_provider_definitions() -> serde_json::Map<String, Value> {
    ocr_provider_config()
        .get("providers")
        .and_then(Value::as_object)
        .cloned()
        .filter(|providers| !providers.is_empty())
        .unwrap_or_else(bundled_provider_definitions)
}

fn bundled_provider_definitions() -> serde_json::Map<String, Value> {
    bundled_ocr_provider_config()
        .get("providers")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}

pub fn ocr_provider_definition(provider: &str) -> Option<Value> {
    let provider_key = provider.trim().to_ascii_lowercase();
    if provider_key.is_empty() {
        return None;
    }
    ocr_provider_definitions().get(&provider_key).cloned()
}

pub fn configured_provider_kind(provider: &str) -> Option<String> {
    ocr_provider_definition(provider).and_then(|definition| {
        definition
            .get("kind")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
    })
}

pub fn is_configured_command_provider(provider: &str) -> bool {
    configured_provider_kind(provider)
        .map(|kind| matches!(kind.as_str(), "local_command" | "remote_command"))
        .unwrap_or(false)
}

pub fn configured_provider_credential_env(provider: &str) -> Option<String> {
    ocr_provider_definition(provider).and_then(|definition| {
        definition
            .get("credential")
            .and_then(Value::as_object)
            .and_then(|credential| credential.get("env"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
    })
}

/// 一家 OCR 服务商建任务时对上传文件的上限（清单里的 `limits`，环境变量覆盖）。0 = 不限。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OcrUploadLimits {
    pub max_pages: u32,
    pub max_file_bytes: u64,
    /// `true`：文件正好等于上限也收（「不超过」）；`false`：必须小于上限（MinerU 接口的说法）。
    pub max_file_bytes_inclusive: bool,
}

/// 清单里一家服务商的 `limits`；没写返回 `None`（不限）。环境变量名写在清单里，设了就用它。
pub fn upload_limits_from_definition(definition: &Value) -> Option<OcrUploadLimits> {
    let limits = definition.get("limits")?.as_object()?;
    let pages = limits.get("max_pages");
    let bytes = limits.get("max_file_bytes");
    let read = |spec: Option<&Value>| -> u64 {
        let Some(spec) = spec else { return 0 };
        let default = spec.get("default").and_then(Value::as_u64).unwrap_or(0);
        match spec.get("env").and_then(Value::as_str).map(str::trim).filter(|name| !name.is_empty()) {
            Some(env_name) => super::env_vars::env_u64(env_name, default),
            None => default,
        }
    };
    Some(OcrUploadLimits {
        max_pages: u32::try_from(read(pages)).unwrap_or(u32::MAX),
        max_file_bytes: read(bytes),
        max_file_bytes_inclusive: bytes
            .and_then(|spec| spec.get("inclusive"))
            .and_then(Value::as_bool)
            .unwrap_or(true),
    })
}

/// 服务商会不会一片片公布已经做完的页（能和翻译并行）。清单里的 `streams_pages`。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StreamsPages {
    Always,
    Never,
    /// 只有交上传的文件、走官方 HTTP 按片并行提交时才会（Paddle：自建服务、官方 CLI、网址提交都由 Rust 整份交）。
    ChunkedUpload,
}

impl StreamsPages {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Always => "always",
            Self::Never => "never",
            Self::ChunkedUpload => "chunked_upload",
        }
    }
}

/// 没登记或写了不认识的值都当 `Never`（保守：不和翻译并行）。
pub fn configured_streams_pages(provider: &str) -> StreamsPages {
    streams_pages_from_definition(&ocr_provider_definition(provider).unwrap_or(Value::Null))
}

pub fn streams_pages_from_definition(definition: &Value) -> StreamsPages {
    match definition.get("streams_pages").and_then(Value::as_str).map(str::trim) {
        Some("always") => StreamsPages::Always,
        Some("chunked_upload") => StreamsPages::ChunkedUpload,
        _ => StreamsPages::Never,
    }
}

/// 这家 OCR 自己没有 key 时，可以借哪个翻译主机的 key（清单里 `credential.shared_with_translation_host`）。
/// 例如 GLM-OCR 和智谱翻译模型共用一个 key：翻译接的是 `open.bigmodel.cn` 才借，别家的 key 不往它发。
pub fn configured_shared_translation_key_host(provider: &str) -> Option<String> {
    ocr_provider_definition(provider).and_then(|definition| shared_translation_key_host_from_definition(&definition))
}

pub fn shared_translation_key_host_from_definition(definition: &Value) -> Option<String> {
    definition
        .get("credential")
        .and_then(|credential| credential.get("shared_with_translation_host"))
        .and_then(Value::as_str)
        .map(|host| host.trim().to_ascii_lowercase())
        .filter(|host| !host.is_empty())
}

fn paddle_config() -> Value {
    let payload = ocr_provider_config();
    let mut legacy = payload.get("paddle").cloned().unwrap_or(Value::Null);
    if !legacy.is_object() {
        legacy = Value::Object(serde_json::Map::new());
    }
    let Some(model_option) = payload
        .get("providers")
        .and_then(Value::as_object)
        .and_then(|providers| providers.get("paddle"))
        .and_then(|paddle| paddle.get("options"))
        .and_then(Value::as_object)
        .and_then(|options| options.get("paddle_model"))
        .and_then(Value::as_object)
    else {
        return legacy;
    };
    if let Some(object) = legacy.as_object_mut() {
        if !object.contains_key("default_model") {
            if let Some(default_model) = model_option.get("default").and_then(Value::as_str) {
                object.insert(
                    "default_model".to_string(),
                    Value::String(default_model.to_string()),
                );
            }
        }
        if !object.contains_key("model_aliases") {
            if let Some(aliases) = model_option.get("aliases").cloned() {
                object.insert("model_aliases".to_string(), aliases);
            }
        }
    }
    legacy
}

fn ocr_provider_config() -> Value {
    config_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_else(|| bundled_ocr_provider_config().clone())
}

fn config_path() -> Option<PathBuf> {
    env_override(OCR_PROVIDER_CONFIG_ENV)
        .or_else(|| env_override(OCR_PROVIDER_CONFIG_COMPAT_ENV))
        .map(PathBuf::from)
        .map(absolutize_path)
        .or_else(|| {
            // The backend workspace owns the registry at <services-root>/config.
            // Search ancestors so both an isolated services checkout and the
            // product monorepo resolve the canonical registry.
            let core_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            for root in core_root.ancestors() {
                for candidate in [
                    root.join("config").join("ocr_providers.json"),
                    root.join("backend")
                        .join("config")
                        .join("ocr_providers.json"),
                    root.join("packages")
                        .join("config")
                        .join("ocr_providers.json"),
                ] {
                    if candidate.exists() {
                        return Some(candidate);
                    }
                }
            }
            core_root
                .ancestors()
                .nth(2)
                .map(|root| root.join("config").join("ocr_providers.json"))
        })
}

fn absolutize_path(path: PathBuf) -> PathBuf {
    if path.is_absolute() {
        return path;
    }
    env::current_dir()
        .map(|cwd| cwd.join(&path))
        .unwrap_or(path)
}

fn env_override(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paddle_default_model_reads_shared_config() {
        assert_eq!(paddle_default_model(), "PaddleOCR-VL-1.6");
        let core_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let backend_root = core_root
            .ancestors()
            .nth(2)
            .expect("retainpdf-core must live below the backend root");
        let expected = backend_root.join("config").join("ocr_providers.json");
        let actual = config_path().expect("backend provider config path");
        assert_eq!(actual, expected);
        assert!(actual.is_file());
    }

    /// 嵌进来的清单就是唯一来源：每个服务商都有合法的 kind、显示名和排序。
    #[test]
    fn bundled_manifest_declares_every_provider_completely() {
        let providers = bundled_provider_definitions();
        for key in ["mineru", "paddle", "glm_ocr", "local"] {
            assert!(providers.contains_key(key), "清单里没有 {key}");
        }
        for (key, definition) in &providers {
            let kind = definition.get("kind").and_then(Value::as_str).unwrap_or("");
            assert!(
                matches!(kind, "remote" | "remote_command" | "local_command"),
                "{key} 的 kind 不认识：{kind:?}"
            );
            assert!(
                definition.get("display_name").and_then(Value::as_str).is_some_and(|name| !name.trim().is_empty()),
                "{key} 没有 display_name"
            );
            assert!(
                definition.get("rank").and_then(Value::as_u64).is_some(),
                "{key} 没有 rank（接口和命令行按它排序）"
            );
        }
    }

    /// 读不到配置文件时用嵌进来的那份，和仓库里的文件逐字一样（不再有手抄的备用定义）。
    #[test]
    fn bundled_manifest_is_the_repository_file() {
        let on_disk = fs::read_to_string(config_path().expect("repo config path")).expect("read manifest");
        assert_eq!(on_disk, BUNDLED_OCR_PROVIDER_CONFIG);
        assert_eq!(&ocr_provider_config(), bundled_ocr_provider_config());
    }

    /// 能力写在清单里，代码按能力判断，不再认服务商名字（插件化 P1b）。
    #[test]
    fn capabilities_come_from_the_manifest() {
        assert_eq!(configured_streams_pages("glm_ocr"), StreamsPages::Always);
        assert_eq!(configured_streams_pages("paddle"), StreamsPages::ChunkedUpload);
        assert_eq!(configured_streams_pages("mineru"), StreamsPages::Never);
        assert_eq!(configured_streams_pages("no-such-provider"), StreamsPages::Never);
        assert_eq!(
            configured_shared_translation_key_host("GLM_OCR").as_deref(),
            Some("open.bigmodel.cn")
        );
        assert_eq!(configured_shared_translation_key_host("mineru"), None);
    }

    #[test]
    fn upload_limits_read_defaults_and_keep_mineru_strict_bound() {
        let definitions = bundled_provider_definitions();
        let mineru = upload_limits_from_definition(&definitions["mineru"]).expect("mineru limits");
        assert_eq!(mineru.max_pages, 600);
        assert_eq!(mineru.max_file_bytes, 200 * 1024 * 1024);
        assert!(!mineru.max_file_bytes_inclusive, "MinerU 接口要求小于 200MB");
        let paddle = upload_limits_from_definition(&definitions["paddle"]).expect("paddle limits");
        assert_eq!((paddle.max_pages, paddle.max_file_bytes), (999, 100 * 1024 * 1024));
        assert!(paddle.max_file_bytes_inclusive);
        assert_eq!(upload_limits_from_definition(&definitions["glm_ocr"]), None, "没写 limits 就不限");
    }

    #[test]
    fn normalize_paddle_model_name_uses_shared_aliases() {
        assert_eq!(normalize_paddle_model_name(""), "PaddleOCR-VL-1.6");
        assert_eq!(
            normalize_paddle_model_name("paddleocr-vl"),
            "PaddleOCR-VL-1.6"
        );
        assert_eq!(
            normalize_paddle_model_name("paddleocr-vl-1.5"),
            "PaddleOCR-VL-1.5"
        );
    }
}
