use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

use crate::models::defaults::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct OcrInput {
    #[serde(default = "default_ocr_provider")]
    pub provider: String,
    #[serde(default)]
    pub credential_ref: String,
    #[serde(default)]
    pub mineru_token: String,
    #[serde(default = "default_model_version")]
    pub model_version: String,
    #[serde(default)]
    pub paddle_token: String,
    #[serde(default)]
    pub paddle_api_url: String,
    #[serde(default = "default_paddle_model")]
    pub paddle_model: String,
    #[serde(default)]
    pub is_ocr: bool,
    #[serde(default)]
    pub disable_formula: bool,
    #[serde(default)]
    pub disable_table: bool,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default)]
    pub page_ranges: String,
    #[serde(default)]
    pub data_id: String,
    #[serde(default)]
    pub no_cache: bool,
    #[serde(default = "default_cache_tolerance")]
    pub cache_tolerance: i64,
    #[serde(default)]
    pub extra_formats: String,
    #[serde(default = "default_poll_interval")]
    pub poll_interval: i64,
    #[serde(default = "default_poll_timeout")]
    pub poll_timeout: i64,
    #[serde(default)]
    pub options: BTreeMap<String, Value>,
}

impl Default for OcrInput {
    fn default() -> Self {
        Self {
            provider: default_ocr_provider(),
            credential_ref: String::new(),
            mineru_token: String::new(),
            model_version: default_model_version(),
            paddle_token: String::new(),
            paddle_api_url: String::new(),
            paddle_model: default_paddle_model(),
            is_ocr: false,
            disable_formula: false,
            disable_table: false,
            language: default_language(),
            page_ranges: String::new(),
            data_id: String::new(),
            no_cache: false,
            cache_tolerance: default_cache_tolerance(),
            extra_formats: String::new(),
            poll_interval: default_poll_interval(),
            poll_timeout: default_poll_timeout(),
            options: BTreeMap::new(),
        }
    }
}

impl OcrInput {
    /// 交上传的文件时能不能按片并行提交（只对清单里 `streams_pages = chunked_upload` 的服务商有意义）：
    /// 走官方 HTTP（`ocr.options.transport` 不是 `official_cli`），也没填自建服务地址 `paddle_api_url`。
    /// 自建服务和官方命令行由 Rust 整份提交。
    pub fn chunk_eligible(&self) -> bool {
        let official_cli = self
            .options
            .get("transport")
            .and_then(Value::as_str)
            .is_some_and(|transport| transport.trim().eq_ignore_ascii_case("official_cli"));
        !official_cli && self.paddle_api_url.trim().is_empty()
    }
}
