//! 内置的服务商(与前端 `platform/config/providers.ts` 一致)。

/// 翻译(以及 AI 助手)用的大模型服务商。`protocol` 是默认的接口协议,可以在配置里改。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ModelProvider {
    pub id: &'static str,
    pub label: &'static str,
    /// 官方地址;`custom` 为空,要自己填。
    pub base_url: &'static str,
    pub default_model: &'static str,
    pub default_workers: u64,
    pub max_workers: u64,
    /// 默认接口协议:`openai`(/chat/completions)、`openai_responses`(/responses)或 `anthropic`(/messages)。
    pub protocol: &'static str,
}

pub const MODEL_PROVIDERS: &[ModelProvider] = &[
    ModelProvider {
        id: "deepseek",
        label: "DeepSeek",
        base_url: "https://api.deepseek.com/v1",
        default_model: "deepseek-flash",
        default_workers: 50,
        max_workers: 100,
        protocol: "openai",
    },
    ModelProvider {
        id: "qwen",
        label: "Qwen",
        base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        default_model: "qwen3.8-flash",
        default_workers: 20,
        max_workers: 50,
        protocol: "openai",
    },
    ModelProvider {
        id: "openai",
        label: "OpenAI",
        base_url: "https://api.openai.com/v1",
        default_model: "gpt-5.6-luna",
        default_workers: 50,
        max_workers: 100,
        protocol: "openai",
    },
    ModelProvider {
        id: "anthropic",
        label: "Anthropic",
        base_url: "https://api.anthropic.com/v1",
        default_model: "claude-sonnet-5",
        default_workers: 50,
        max_workers: 100,
        protocol: "anthropic",
    },
    ModelProvider {
        id: "zhipu",
        label: "智谱",
        base_url: "https://open.bigmodel.cn/api/paas/v4",
        default_model: "GLM-5.3-Flash",
        default_workers: 5,
        max_workers: 50,
        protocol: "openai",
    },
    ModelProvider {
        id: "opencode",
        label: "OpenCode Go",
        base_url: "https://opencode.ai/inference/go/v1",
        default_model: "deepseek-v4.1-flash",
        default_workers: 5,
        max_workers: 100,
        protocol: "openai",
    },
    ModelProvider {
        id: "custom",
        label: "自定义 API",
        base_url: "",
        default_model: "",
        default_workers: 5,
        max_workers: 100,
        protocol: "openai",
    },
];

pub const DEFAULT_MODEL_PROVIDER: &str = "deepseek";

/// 接口协议与思考深度的可选值(与任务契约的 `translation.api_protocol` / `translation.thinking` 一致)。
pub const API_PROTOCOLS: &[&str] = &["openai", "openai_responses", "anthropic"];
pub const THINKING_LEVELS: &[&str] = &["auto", "off", "low", "medium", "high", "max"];
pub const DEFAULT_THINKING: &str = "auto";

pub fn model_provider(id: &str) -> Option<&'static ModelProvider> {
    MODEL_PROVIDERS.iter().find(|p| p.id == id)
}

/// OCR 服务商：从后端的服务商清单 `backend/config/ocr_providers.json` 读（编译时嵌入），不再手写一份
/// （以前这里只有 paddle、mineru，接 GLM-OCR 时漏了）。只列要 token 的（清单里 `credential` 不是 null 的），
/// 本地命令型不列。token 在 credentials.toml 里的键是 `ocr.<id>_token`。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OcrProvider {
    pub id: String,
    pub label: String,
    pub token_key: String,
}

const OCR_PROVIDER_MANIFEST: &str = include_str!("../../../config/ocr_providers.json");

/// 按清单里的 `rank` 排（和 `GET /providers/ocr` 同一个顺序）。
pub fn ocr_providers() -> &'static [OcrProvider] {
    static PROVIDERS: std::sync::LazyLock<Vec<OcrProvider>> =
        std::sync::LazyLock::new(|| parse_ocr_providers(OCR_PROVIDER_MANIFEST));
    &PROVIDERS
}

pub fn ocr_provider(id: &str) -> Option<&'static OcrProvider> {
    ocr_providers().iter().find(|provider| provider.id == id)
}

fn parse_ocr_providers(manifest: &str) -> Vec<OcrProvider> {
    let manifest: serde_json::Value =
        serde_json::from_str(manifest).expect("backend/config/ocr_providers.json 必须是合法 JSON");
    let providers = manifest
        .get("providers")
        .and_then(serde_json::Value::as_object)
        .expect("ocr_providers.json 要有 providers");
    let mut ranked: Vec<(u64, OcrProvider)> = providers
        .iter()
        .filter(|(_, definition)| definition.get("credential").is_some_and(serde_json::Value::is_object))
        .map(|(id, definition)| {
            let rank = definition.get("rank").and_then(serde_json::Value::as_u64).unwrap_or(u64::MAX);
            let label = definition
                .get("display_name")
                .and_then(serde_json::Value::as_str)
                .unwrap_or(id)
                .to_string();
            (rank, OcrProvider { id: id.clone(), label, token_key: format!("{id}_token") })
        })
        .collect();
    ranked.sort_by(|(left_rank, left), (right_rank, right)| left_rank.cmp(right_rank).then_with(|| left.id.cmp(&right.id)));
    ranked.into_iter().map(|(_, provider)| provider).collect()
}

#[cfg(test)]
mod ocr_provider_tests {
    use super::*;

    /// 命令行认的 OCR 服务商就是清单里要 token 的那几家；token 键保持 `<id>_token`（老配置文件照样读得到）。
    #[test]
    fn ocr_providers_come_from_the_backend_manifest() {
        let ids: Vec<&str> = ocr_providers().iter().map(|provider| provider.id.as_str()).collect();
        assert_eq!(ids, ["mineru", "paddle", "glm_ocr"]);
        assert_eq!(ocr_provider("paddle").unwrap().token_key, "paddle_token");
        assert_eq!(ocr_provider("mineru").unwrap().token_key, "mineru_token");
        assert_eq!(ocr_provider("glm_ocr").unwrap().label, "GLM-OCR");
        assert!(ocr_provider("local").is_none(), "本地命令型不要 token，不列");
        assert!(ocr_provider(DEFAULT_OCR_PROVIDER).is_some(), "默认服务商必须在清单里");
    }
}

pub const DEFAULT_OCR_PROVIDER: &str = "paddle";
