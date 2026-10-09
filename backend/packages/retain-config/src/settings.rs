//! 生效的设置:环境变量 > 文件 > 内置默认,并记下每一项从哪来(`config show` 给人看)。

use std::collections::BTreeMap;
use std::path::PathBuf;

use anyhow::{bail, Result};
use serde::Serialize;
use toml_edit::{DocumentMut, Item};

use crate::home::{expand_home, ConfigHome};
use crate::keys::{describe_key, parse_value, Store};
use crate::providers::{model_provider, DEFAULT_MODEL_PROVIDER, DEFAULT_OCR_PROVIDER, OCR_PROVIDERS};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Source {
    Default,
    File,
    Env,
}

/// 一个大模型连接(翻译、审校、AI 助手各一个)。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ModelConnection {
    pub provider: String,
    pub base_url: String,
    pub model: String,
    pub workers: u64,
    #[serde(skip_serializing)]
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Settings {
    pub translation: ModelConnection,
    pub translation_batch_size: Option<u64>,
    /// 没配审校服务商时为 None。
    pub reviewer: Option<ModelConnection>,
    pub ocr_provider: String,
    #[serde(skip_serializing)]
    pub ocr_token: Option<String>,
    pub assistant: ModelConnection,
    pub assistant_max_tool_rounds: Option<u64>,
    /// None:用调用方的默认位置(桌面版的数据目录)。
    pub data_dir: Option<PathBuf>,
    pub max_running_jobs: Option<u64>,
    pub sync_interval_secs: Option<u64>,
    pub backup_interval_hours: Option<u64>,
    /// 生效值从哪来:键 -> 来源。键见 [`Settings::EFFECTIVE_KEYS`]。
    pub sources: BTreeMap<String, Source>,
}

/// 生效值的环境变量。
pub const ENV_OVERRIDES: &[(&str, &str)] = &[
    ("translation.provider", "RETAINPDF_TRANSLATION_PROVIDER"),
    ("translation.model", "RETAINPDF_TRANSLATION_MODEL"),
    ("translation.base_url", "RETAINPDF_TRANSLATION_BASE_URL"),
    ("translation.workers", "RETAINPDF_TRANSLATION_WORKERS"),
    ("translation.api_key", "RETAINPDF_TRANSLATION_API_KEY"),
    ("ocr.provider", "RETAINPDF_OCR_PROVIDER"),
    ("ocr.token", "RETAINPDF_OCR_TOKEN"),
    ("assistant.model", "RETAINPDF_ASSISTANT_MODEL"),
    ("assistant.api_key", "RETAINPDF_ASSISTANT_API_KEY"),
    ("backend.data_dir", "RETAINPDF_DATA_DIR"),
    ("backend.max_running_jobs", "RETAINPDF_MAX_RUNNING_JOBS"),
];

fn env_name(key: &str) -> Option<&'static str> {
    ENV_OVERRIDES.iter().find(|(k, _)| *k == key).map(|(_, name)| *name)
}

struct Resolver<'a> {
    config: &'a DocumentMut,
    credentials: &'a DocumentMut,
    env: &'a dyn Fn(&str) -> Option<String>,
    sources: BTreeMap<String, Source>,
}

fn lookup<'d>(document: &'d DocumentMut, path: &str) -> Option<&'d toml_edit::Value> {
    let mut item: &Item = document.as_item();
    for part in path.split('.') {
        item = item.get(part)?;
    }
    item.as_value()
}

fn as_text(value: &toml_edit::Value) -> Option<String> {
    match value {
        toml_edit::Value::String(s) => Some(s.value().trim().to_string()).filter(|s| !s.is_empty()),
        toml_edit::Value::Integer(i) => Some(i.value().to_string()),
        _ => None,
    }
}

impl Resolver<'_> {
    /// 环境变量(`effective` 的)> 文件(`path` 处)> None。
    fn pick(&mut self, effective: &str, path: &str) -> Result<Option<String>> {
        if let Some(name) = env_name(effective) {
            if let Some(raw) = (self.env)(name).filter(|v| !v.trim().is_empty()) {
                // 环境变量也按文件里同一项的规则检查。
                if let Some(key) = describe_key(path) {
                    if let Err(error) = parse_value(&key, &raw) {
                        bail!("环境变量 {name}:{error}");
                    }
                }
                self.sources.insert(effective.to_string(), Source::Env);
                return Ok(Some(raw.trim().to_string()));
            }
        }
        let store = describe_key(path).map_or(Store::Config, |k| k.store);
        let document = if store == Store::Credentials { self.credentials } else { self.config };
        if let Some(text) = lookup(document, path).and_then(as_text) {
            self.sources.insert(effective.to_string(), Source::File);
            return Ok(Some(text));
        }
        Ok(None)
    }

    fn or_default(&mut self, effective: &str, value: Option<String>, default: &str) -> String {
        value.unwrap_or_else(|| {
            self.sources.insert(effective.to_string(), Source::Default);
            default.to_string()
        })
    }

    fn number(&mut self, effective: &str, path: &str) -> Result<Option<u64>> {
        Ok(self.pick(effective, path)?.and_then(|v| v.parse().ok()))
    }

    /// 一个服务商的连接。`prefix` 是生效键的前缀(translation / assistant / translation.reviewer)。
    fn connection(&mut self, prefix: &str, provider: &str, model_override: Option<String>) -> Result<ModelConnection> {
        let builtin = model_provider(provider).expect("provider checked");
        let base = format!("providers.{provider}");
        let model = match model_override {
            Some(model) => Some(model),
            None => self.pick(&format!("{prefix}.model"), &format!("{base}.model"))?,
        };
        let model = self.or_default(&format!("{prefix}.model"), model, builtin.default_model);
        let base_url = self.pick(&format!("{prefix}.base_url"), &format!("{base}.base_url"))?;
        let base_url = self.or_default(&format!("{prefix}.base_url"), base_url, builtin.base_url);
        let workers = self.number(&format!("{prefix}.workers"), &format!("{base}.workers"))?;
        let workers = workers.unwrap_or_else(|| {
            self.sources.insert(format!("{prefix}.workers"), Source::Default);
            builtin.default_workers
        });
        let api_key = self.pick(&format!("{prefix}.api_key"), &format!("{base}.api_key"))?;
        Ok(ModelConnection { provider: provider.to_string(), base_url, model, workers, api_key })
    }
}

impl Settings {
    /// 合并出生效的设置。`env` 查环境变量(测试里换成假的)。
    pub fn resolve(
        config: &DocumentMut,
        credentials: &DocumentMut,
        env: &dyn Fn(&str) -> Option<String>,
    ) -> Result<Self> {
        let mut r = Resolver { config, credentials, env, sources: BTreeMap::new() };
        let provider = r.pick("translation.provider", "translation.provider")?;
        let provider = r.or_default("translation.provider", provider, DEFAULT_MODEL_PROVIDER).to_ascii_lowercase();
        if model_provider(&provider).is_none() {
            bail!("translation.provider 不认识:{provider}");
        }
        let translation = r.connection("translation", &provider, None)?;
        let translation_batch_size = r.number("translation.batch_size", "translation.batch_size")?;

        let reviewer = match r.pick("translation.reviewer.provider", "translation.reviewer.provider")? {
            Some(reviewer_provider) => {
                let model = r.pick("translation.reviewer.model", "translation.reviewer.model")?;
                Some(r.connection("translation.reviewer", &reviewer_provider.to_ascii_lowercase(), model)?)
            }
            None => None,
        };

        let ocr_provider = r.pick("ocr.provider", "ocr.provider")?;
        let ocr_provider = r.or_default("ocr.provider", ocr_provider, DEFAULT_OCR_PROVIDER).to_ascii_lowercase();
        let Some((_, token_key)) = OCR_PROVIDERS.iter().find(|(id, _)| *id == ocr_provider) else {
            bail!("ocr.provider 不认识:{ocr_provider}");
        };
        let ocr_token = r.pick("ocr.token", &format!("ocr.{token_key}"))?;

        // AI 助手:没单独配服务商就和翻译一样。
        let assistant_provider = match r.pick("assistant.provider", "assistant.provider")? {
            Some(p) => p.to_ascii_lowercase(),
            None => {
                r.sources.insert("assistant.provider".into(), Source::Default);
                provider.clone()
            }
        };
        let assistant_model = r.pick("assistant.model", "assistant.model")?;
        let assistant = r.connection("assistant", &assistant_provider, assistant_model)?;
        let assistant_max_tool_rounds = r.number("assistant.max_tool_rounds", "assistant.max_tool_rounds")?;

        let data_dir = r.pick("backend.data_dir", "backend.data_dir")?.map(|raw| expand_home(&raw));
        let max_running_jobs = r.number("backend.max_running_jobs", "backend.max_running_jobs")?;
        let sync_interval_secs = r.number("backend.sync_interval_secs", "backend.sync_interval_secs")?;
        let backup_interval_hours = r.number("backend.backup_interval_hours", "backend.backup_interval_hours")?;
        Ok(Self {
            translation,
            translation_batch_size,
            reviewer,
            ocr_provider,
            ocr_token,
            assistant,
            assistant_max_tool_rounds,
            data_dir,
            max_running_jobs,
            sync_interval_secs,
            backup_interval_hours,
            sources: r.sources,
        })
    }

    pub fn source(&self, effective: &str) -> Source {
        self.sources.get(effective).copied().unwrap_or(Source::Default)
    }
}

impl ConfigHome {
    /// 当前生效的设置(读两个文件 + 进程的环境变量)。
    pub fn settings(&self) -> Result<Settings> {
        let config = self.read_document(Store::Config)?;
        let credentials = self.read_document(Store::Credentials)?;
        Settings::resolve(&config, &credentials, &|name| std::env::var(name).ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc(text: &str) -> DocumentMut {
        text.parse().unwrap()
    }

    #[test]
    fn defaults_then_file_then_environment() {
        let empty = doc("");
        let none = |_: &str| None;
        let defaults = Settings::resolve(&empty, &empty, &none).unwrap();
        assert_eq!(defaults.translation.provider, "deepseek");
        assert_eq!(defaults.translation.base_url, "https://api.deepseek.com/v1");
        assert_eq!(defaults.translation.workers, 50);
        assert_eq!(defaults.translation.api_key, None);
        assert_eq!(defaults.ocr_provider, "paddle");
        assert_eq!(defaults.assistant.provider, "deepseek", "assistant follows translation");
        assert_eq!(defaults.source("translation.model"), Source::Default);

        let config = doc(
            "[translation]\nprovider = \"custom\"\n[providers.custom]\nbase_url = \"https://llm.example.com/v1\"\nmodel = \"m1\"\nworkers = 8\n[ocr]\nprovider = \"mineru\"\n[assistant]\nprovider = \"qwen\"\n[backend]\ndata_dir = \"~/RetainPDF\"\n",
        );
        let credentials = doc("[providers.custom]\napi_key = \"sk-file\"\n[providers.qwen]\napi_key = \"sk-qwen\"\n[ocr]\nmineru_token = \"tok\"\n");
        let from_file = Settings::resolve(&config, &credentials, &none).unwrap();
        assert_eq!(
            (from_file.translation.model.as_str(), from_file.translation.workers, from_file.translation.api_key.as_deref()),
            ("m1", 8, Some("sk-file"))
        );
        assert_eq!(from_file.ocr_token.as_deref(), Some("tok"));
        assert_eq!(from_file.assistant.api_key.as_deref(), Some("sk-qwen"));
        assert_eq!(from_file.assistant.model, "qwen3.8-flash");
        assert!(from_file.data_dir.as_ref().unwrap().ends_with("RetainPDF"));
        assert_eq!(from_file.source("translation.api_key"), Source::File);

        let env = |name: &str| match name {
            "RETAINPDF_TRANSLATION_WORKERS" => Some("3".to_string()),
            "RETAINPDF_TRANSLATION_API_KEY" => Some("sk-env".to_string()),
            _ => None,
        };
        let from_env = Settings::resolve(&config, &credentials, &env).unwrap();
        assert_eq!((from_env.translation.workers, from_env.translation.api_key.as_deref()), (3, Some("sk-env")));
        assert_eq!(from_env.source("translation.workers"), Source::Env);

        let bad_env = |name: &str| (name == "RETAINPDF_TRANSLATION_WORKERS").then(|| "lots".to_string());
        let error = Settings::resolve(&config, &credentials, &bad_env).unwrap_err().to_string();
        assert!(error.contains("RETAINPDF_TRANSLATION_WORKERS"), "{error}");
    }

    #[test]
    fn secrets_are_never_serialized() {
        let credentials = doc("[providers.deepseek]\napi_key = \"sk-secret-value\"\n[ocr]\npaddle_token = \"tok-secret\"\n");
        let settings = Settings::resolve(&doc(""), &credentials, &|_| None).unwrap();
        let json = serde_json::to_string(&settings).unwrap();
        assert!(!json.contains("secret"), "{json}");
    }
}
