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

/// OCR 服务商:id 与它的 token 在 credentials.toml 里的键。
pub const OCR_PROVIDERS: &[(&str, &str)] = &[("paddle", "paddle_token"), ("mineru", "mineru_token")];

pub const DEFAULT_OCR_PROVIDER: &str = "paddle";
