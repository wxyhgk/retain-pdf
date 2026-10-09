//! 配置项表:哪些项可以配、存在哪个文件、怎么校验、给人看的说明。
//!
//! 键是点分路径,和文件里的表对应:`translation.provider` 就是 config.toml 里
//! `[translation]` 下的 `provider`。服务商的设置按服务商分表:`providers.<服务商>.model`。
//! 密钥类的项(`providers.<服务商>.api_key`、`ocr.paddle_token` 等)存在 credentials.toml。

use anyhow::{bail, Result};
use toml_edit::Value;

use crate::providers::{model_provider, MODEL_PROVIDERS, OCR_PROVIDERS};

/// 存在哪个文件。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Store {
    Config,
    Credentials,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KeyKind {
    Text,
    /// http(s) 地址,不能带账号密码。
    Url,
    Int { min: i64, max: i64 },
    Choice(Vec<&'static str>),
    /// 本机路径(可以用 `~` 开头)。
    Path,
    /// 密钥:显示时只露末四位。
    Secret,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeyInfo {
    pub path: String,
    pub store: Store,
    pub kind: KeyKind,
    pub help: String,
}

fn info(path: &str, store: Store, kind: KeyKind, help: &str) -> KeyInfo {
    KeyInfo { path: path.to_string(), store, kind, help: help.to_string() }
}

fn provider_ids() -> Vec<&'static str> {
    MODEL_PROVIDERS.iter().map(|p| p.id).collect()
}

/// 一个键的说明;不认识的键为 None。
pub fn describe_key(path: &str) -> Option<KeyInfo> {
    let parts: Vec<&str> = path.split('.').collect();
    let ocr_ids: Vec<&'static str> = OCR_PROVIDERS.iter().map(|(id, _)| *id).collect();
    Some(match parts.as_slice() {
        ["translation", "provider"] => info(
            path,
            Store::Config,
            KeyKind::Choice(provider_ids()),
            "翻译用哪个服务商(它的模型、地址、并发在 [providers.<服务商>] 里)",
        ),
        ["translation", "batch_size"] => {
            info(path, Store::Config, KeyKind::Int { min: 1, max: 64 }, "每次请求翻译几个文字块")
        }
        ["translation", "reviewer", "provider"] => info(
            path,
            Store::Config,
            KeyKind::Choice(provider_ids()),
            "审校用哪个服务商(不填就不审校)",
        ),
        ["translation", "reviewer", "model"] => info(path, Store::Config, KeyKind::Text, "审校模型(不填用该服务商的默认模型)"),
        ["providers", id, field] if model_provider(id).is_some() => {
            let provider = model_provider(id).expect("checked");
            match *field {
                "model" => info(path, Store::Config, KeyKind::Text, &format!("{} 的模型", provider.label)),
                "base_url" => info(
                    path,
                    Store::Config,
                    KeyKind::Url,
                    if provider.base_url.is_empty() { "接口地址(OpenAI 兼容)" } else { "接口地址(不填用官方地址)" },
                ),
                "workers" => info(
                    path,
                    Store::Config,
                    KeyKind::Int { min: 1, max: provider.max_workers as i64 },
                    "同时发出的请求数(并发)",
                ),
                "api_key" => info(path, Store::Credentials, KeyKind::Secret, &format!("{} 的 API Key", provider.label)),
                _ => return None,
            }
        }
        ["ocr", "provider"] => info(path, Store::Config, KeyKind::Choice(ocr_ids), "OCR 用哪家(paddle / mineru)"),
        ["ocr", token] if OCR_PROVIDERS.iter().any(|(_, key)| key == token) => {
            info(path, Store::Credentials, KeyKind::Secret, "OCR 服务的 token")
        }
        ["assistant", "provider"] => info(
            path,
            Store::Config,
            KeyKind::Choice(provider_ids()),
            "阅读页 AI 助手用哪个服务商(不填和翻译一样;密钥用该服务商的)",
        ),
        ["assistant", "model"] => info(path, Store::Config, KeyKind::Text, "AI 助手的模型(不填用该服务商的默认模型)"),
        ["assistant", "max_tool_rounds"] => {
            info(path, Store::Config, KeyKind::Int { min: 1, max: 20 }, "AI 助手一次回答最多调用几轮工具")
        }
        ["backend", "data_dir"] => info(path, Store::Config, KeyKind::Path, "数据目录(不填用桌面版的默认位置)"),
        ["backend", "max_running_jobs"] => {
            info(path, Store::Config, KeyKind::Int { min: 1, max: 16 }, "同时运行的翻译任务数")
        }
        ["backend", "sync_interval_secs"] => {
            info(path, Store::Config, KeyKind::Int { min: 10, max: 86_400 }, "多设备同步的间隔(秒)")
        }
        ["backend", "backup_interval_hours"] => {
            info(path, Store::Config, KeyKind::Int { min: 0, max: 720 }, "数据库自动备份的间隔(小时,0 关闭)")
        }
        _ => return None,
    })
}

/// 全部配置项(列出给人看;服务商的项按内置服务商展开)。
pub fn known_keys() -> Vec<KeyInfo> {
    let mut paths: Vec<String> = [
        "translation.provider",
        "translation.batch_size",
        "translation.reviewer.provider",
        "translation.reviewer.model",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    for provider in MODEL_PROVIDERS {
        for field in ["model", "base_url", "workers", "api_key"] {
            paths.push(format!("providers.{}.{field}", provider.id));
        }
    }
    paths.push("ocr.provider".into());
    for (_, token) in OCR_PROVIDERS {
        paths.push(format!("ocr.{token}"));
    }
    for path in [
        "assistant.provider",
        "assistant.model",
        "assistant.max_tool_rounds",
        "backend.data_dir",
        "backend.max_running_jobs",
        "backend.sync_interval_secs",
        "backend.backup_interval_hours",
    ] {
        paths.push(path.into());
    }
    paths.iter().filter_map(|p| describe_key(p)).collect()
}

/// 检查一个输入值,转成要写进文件的值。
pub fn parse_value(key: &KeyInfo, raw: &str) -> Result<Value> {
    let text = raw.trim();
    Ok(match &key.kind {
        KeyKind::Text | KeyKind::Secret => {
            if text.is_empty() {
                bail!("{} 不能为空(要清除请用 unset)", key.path);
            }
            Value::from(text)
        }
        KeyKind::Url => {
            let ok = (text.starts_with("http://") || text.starts_with("https://"))
                && text.splitn(2, "://").nth(1).is_some_and(|rest| {
                    let host = rest.split('/').next().unwrap_or("");
                    !host.is_empty() && !host.contains('@')
                });
            if !ok {
                bail!("{} 要是 http:// 或 https:// 开头的地址,且不能带账号密码", key.path);
            }
            Value::from(text.trim_end_matches('/'))
        }
        KeyKind::Int { min, max } => {
            let Ok(number) = text.parse::<i64>() else {
                bail!("{} 要是整数", key.path);
            };
            if number < *min || number > *max {
                bail!("{} 要在 {min} 到 {max} 之间", key.path);
            }
            Value::from(number)
        }
        KeyKind::Choice(options) => {
            let lower = text.to_ascii_lowercase();
            if !options.contains(&lower.as_str()) {
                bail!("{} 只能是:{}", key.path, options.join(" / "));
            }
            Value::from(lower)
        }
        KeyKind::Path => {
            if text.is_empty() {
                bail!("{} 不能为空(要清除请用 unset)", key.path);
            }
            Value::from(text)
        }
    })
}

/// 密钥只露末四位。
pub fn mask(secret: &str) -> String {
    let chars: Vec<char> = secret.chars().collect();
    if chars.len() <= 8 {
        return "****".to_string();
    }
    let tail: String = chars[chars.len() - 4..].iter().collect();
    format!("****{tail}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_are_described_and_values_checked() {
        let workers = describe_key("providers.deepseek.workers").unwrap();
        assert_eq!(workers.kind, KeyKind::Int { min: 1, max: 100 });
        assert_eq!(parse_value(&workers, "64").unwrap().as_integer(), Some(64));
        assert!(parse_value(&workers, "0").is_err());
        assert!(parse_value(&workers, "many").is_err());
        assert_eq!(describe_key("providers.zhipu.workers").unwrap().kind, KeyKind::Int { min: 1, max: 50 });

        let key = describe_key("providers.deepseek.api_key").unwrap();
        assert_eq!(key.store, Store::Credentials);
        assert_eq!(describe_key("ocr.paddle_token").unwrap().store, Store::Credentials);

        let url = describe_key("providers.custom.base_url").unwrap();
        assert_eq!(parse_value(&url, "https://llm.example.com/v1/").unwrap().as_str(), Some("https://llm.example.com/v1"));
        assert!(parse_value(&url, "ftp://x").is_err());
        assert!(parse_value(&url, "https://user:pw@llm.example.com").is_err());

        let provider = describe_key("translation.provider").unwrap();
        assert_eq!(parse_value(&provider, "Qwen").unwrap().as_str(), Some("qwen"));
        assert!(parse_value(&provider, "bard").is_err());

        for unknown in ["translation.color", "providers.bard.model", "providers.deepseek.temperature", "ocr.secret"] {
            assert!(describe_key(unknown).is_none(), "{unknown}");
        }
        assert!(known_keys().iter().all(|k| describe_key(&k.path).is_some()));
    }

    #[test]
    fn secrets_show_only_their_last_four_characters() {
        assert_eq!(mask("sk-1234567890abcd"), "****abcd");
        assert_eq!(mask("short"), "****");
    }
}
