//! 整份导出、批量写入:给桌面版用(它通过 `retainpdf config export / import` 调用,解析 TOML
//! 只有这一份实现)。

use std::collections::BTreeMap;

use anyhow::{bail, Result};
use serde_json::{json, Map, Value};
use toml_edit::{DocumentMut, Item, Table};

use crate::home::ConfigHome;
use crate::keys::{describe_key, parse_value, Store};
use crate::providers::{model_provider, MODEL_PROVIDERS, OCR_PROVIDERS};
use crate::settings::Settings;

fn file_text(document: &DocumentMut, path: &str) -> Option<String> {
    let mut item: &Item = document.as_item();
    for part in path.split('.') {
        item = item.get(part)?;
    }
    match item.as_value()? {
        toml_edit::Value::String(s) => Some(s.value().to_string()).filter(|s| !s.trim().is_empty()),
        toml_edit::Value::Integer(i) => Some(i.value().to_string()),
        _ => None,
    }
}

/// 服务商的某个字段等于内置默认:写进文件没有意义,删掉(以后默认变了也跟着变)。
fn is_builtin_default(path: &str, value: &str) -> bool {
    let parts: Vec<&str> = path.split('.').collect();
    let ["providers", id, field] = parts.as_slice() else {
        return false;
    };
    let Some(provider) = model_provider(id) else {
        return false;
    };
    match *field {
        "model" => value == provider.default_model,
        "base_url" => value.trim_end_matches('/') == provider.base_url,
        "workers" => value.parse::<u64>().ok() == Some(provider.default_workers),
        "protocol" => value == provider.protocol,
        "thinking" => value == crate::providers::DEFAULT_THINKING,
        _ => false,
    }
}

fn set_in(document: &mut DocumentMut, path: &str, value: Option<toml_edit::Value>) -> Result<()> {
    let parts: Vec<&str> = path.split('.').collect();
    let mut table: &mut Table = document.as_table_mut();
    for part in &parts[..parts.len() - 1] {
        if value.is_none() && table.get(part).is_none() {
            return Ok(());
        }
        let entry = table.entry(part).or_insert_with(|| {
            let mut t = Table::new();
            t.set_implicit(true);
            Item::Table(t)
        });
        let Some(next) = entry.as_table_mut() else {
            bail!("配置文件里的 {part} 不是一个表,请手动检查");
        };
        table = next;
    }
    let last = parts[parts.len() - 1];
    match value {
        Some(value) => {
            table.insert(last, Item::Value(value));
        }
        None => {
            table.remove(last);
        }
    }
    Ok(())
}

impl ConfigHome {
    /// 批量改:`None` 表示删掉(回到默认)。先全部校验,有一项不对就一项都不写;每个文件
    /// 只写一次。服务商字段等于内置默认的也删掉。
    pub fn apply(&self, changes: &[(String, Option<String>)]) -> Result<()> {
        let mut parsed = Vec::new();
        for (path, value) in changes {
            let Some(key) = describe_key(path) else {
                bail!("没有这个配置项:{path}");
            };
            let value = match value.as_deref().map(str::trim) {
                Some(v) if !v.is_empty() && !is_builtin_default(path, v) => Some(parse_value(&key, v)?),
                _ => None,
            };
            parsed.push((key, value));
        }
        self.ensure_files()?;
        for store in [Store::Config, Store::Credentials] {
            let mine: Vec<_> = parsed.iter().filter(|(k, _)| k.store == store).collect();
            if mine.is_empty() {
                continue;
            }
            let mut document = self.read_document(store)?;
            for (key, value) in mine {
                set_in(&mut document, &key.path, value.clone())?;
            }
            self.write_document_pub(store, &document)?;
        }
        Ok(())
    }

    /// 整份设置:当前生效的(含环境变量),以及每个服务商各自的设置(文件里的,没写用
    /// 内置默认)。`with_secrets` 为 false 时密钥只报告有没有。
    pub fn export(&self, with_secrets: bool) -> Result<Value> {
        let config = self.read_document(Store::Config)?;
        let credentials = self.read_document(Store::Credentials)?;
        let settings = Settings::resolve(&config, &credentials, &|name| std::env::var(name).ok())?;
        let secret = |value: Option<String>| -> Value {
            match (with_secrets, value) {
                (true, Some(v)) => json!(v),
                (false, Some(_)) => json!(true),
                (_, None) => Value::Null,
            }
        };
        let mut providers = Map::new();
        for provider in MODEL_PROVIDERS {
            let base = format!("providers.{}", provider.id);
            providers.insert(
                provider.id.to_string(),
                json!({
                    "model": file_text(&config, &format!("{base}.model")).unwrap_or_else(|| provider.default_model.to_string()),
                    "base_url": file_text(&config, &format!("{base}.base_url")).unwrap_or_else(|| provider.base_url.to_string()),
                    "protocol": file_text(&config, &format!("{base}.protocol")).unwrap_or_else(|| provider.protocol.to_string()),
                    "thinking": file_text(&config, &format!("{base}.thinking")).unwrap_or_else(|| crate::providers::DEFAULT_THINKING.to_string()),
                    "workers": file_text(&config, &format!("{base}.workers")).and_then(|w| w.parse::<u64>().ok()).unwrap_or(provider.default_workers),
                    "api_key": secret(file_text(&credentials, &format!("{base}.api_key"))),
                }),
            );
        }
        let mut ocr_tokens = Map::new();
        for (id, token_key) in OCR_PROVIDERS {
            ocr_tokens.insert(id.to_string(), secret(file_text(&credentials, &format!("ocr.{token_key}"))));
        }
        let sources: BTreeMap<String, Value> =
            settings.sources.iter().map(|(k, v)| (k.clone(), serde_json::to_value(v).unwrap_or(Value::Null))).collect();
        Ok(json!({
            "schema": "retainpdf_config_export_v1",
            "dir": self.dir(),
            "translation": {
                "provider": settings.translation.provider,
                "model": settings.translation.model,
                "base_url": settings.translation.base_url,
                "protocol": settings.translation.protocol,
                "thinking": settings.translation.thinking,
                "workers": settings.translation.workers,
                "batch_size": settings.translation_batch_size,
                "api_key": secret(settings.translation.api_key.clone()),
            },
            "providers": providers,
            "ocr": { "provider": settings.ocr_provider, "tokens": ocr_tokens },
            "assistant": {
                "provider": settings.assistant.provider,
                "model": settings.assistant.model,
                "base_url": settings.assistant.base_url,
                "protocol": settings.assistant.protocol,
                "thinking": settings.assistant.thinking,
                "api_key": secret(settings.assistant.api_key.clone()),
                "max_tool_rounds": settings.assistant_max_tool_rounds,
            },
            "backend": {
                "data_dir": settings.data_dir,
                "max_running_jobs": settings.max_running_jobs,
                "sync_interval_secs": settings.sync_interval_secs,
                "backup_interval_hours": settings.backup_interval_hours,
            },
            "sources": sources,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_home() -> ConfigHome {
        ConfigHome::at(std::env::temp_dir().join(format!("retain-config-x-{:016x}", fastrand::u64(..))))
    }

    #[test]
    fn apply_writes_everything_or_nothing_and_drops_builtin_defaults() {
        let home = temp_home();
        home.apply(&[
            ("translation.provider".into(), Some("qwen".into())),
            ("providers.qwen.workers".into(), Some("30".into())),
            ("providers.qwen.model".into(), Some("qwen3.8-flash".into())), // 内置默认:不写
            ("providers.qwen.api_key".into(), Some("sk-qwen-123456789".into())),
            ("ocr.paddle_token".into(), Some("tok".into())),
        ])
        .unwrap();
        let config = std::fs::read_to_string(home.config_path()).unwrap();
        assert!(config.contains("workers = 30"));
        assert!(!config.contains("qwen3.8-flash"), "{config}");
        let exported = home.export(true).unwrap();
        assert_eq!(exported["translation"]["provider"], "qwen");
        assert_eq!(exported["providers"]["qwen"]["api_key"], "sk-qwen-123456789");
        assert_eq!(exported["providers"]["deepseek"]["workers"], 50);
        assert_eq!(exported["ocr"]["tokens"]["paddle"], "tok");
        let hidden = home.export(false).unwrap();
        assert_eq!(hidden["providers"]["qwen"]["api_key"], true);
        assert!(!hidden.to_string().contains("sk-qwen"));

        // 有一项不对:一项都不写。
        let before = std::fs::read_to_string(home.config_path()).unwrap();
        assert!(home
            .apply(&[("providers.qwen.workers".into(), Some("31".into())), ("providers.qwen.workers".into(), Some("999".into()))])
            .is_err());
        assert_eq!(std::fs::read_to_string(home.config_path()).unwrap(), before);

        // None / 空串:删掉。
        home.apply(&[("providers.qwen.workers".into(), None), ("ocr.paddle_token".into(), Some(String::new()))]).unwrap();
        let exported = home.export(true).unwrap();
        assert_eq!(exported["providers"]["qwen"]["workers"], 20);
        assert!(exported["ocr"]["tokens"]["paddle"].is_null());
        std::fs::remove_dir_all(home.dir()).unwrap();
    }
}
