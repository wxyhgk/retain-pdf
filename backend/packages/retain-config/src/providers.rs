//! 内置的服务商(与前端 `platform/config/providers.ts` 一致)。

/// 翻译(以及 AI 助手)用的大模型服务商。都走 OpenAI 兼容接口。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ModelProvider {
    pub id: &'static str,
    pub label: &'static str,
    /// 官方地址;`custom` 为空,要自己填。
    pub base_url: &'static str,
    pub default_model: &'static str,
    pub default_workers: u64,
    pub max_workers: u64,
}

pub const MODEL_PROVIDERS: &[ModelProvider] = &[
    ModelProvider {
        id: "deepseek",
        label: "DeepSeek",
        base_url: "https://api.deepseek.com/v1",
        default_model: "deepseek-flash",
        default_workers: 50,
        max_workers: 100,
    },
    ModelProvider {
        id: "qwen",
        label: "Qwen",
        base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        default_model: "qwen3.8-flash",
        default_workers: 20,
        max_workers: 50,
    },
    ModelProvider {
        id: "openai",
        label: "OpenAI",
        base_url: "https://api.openai.com/v1",
        default_model: "gpt-5.6-luna",
        default_workers: 50,
        max_workers: 100,
    },
    ModelProvider {
        id: "anthropic",
        label: "Anthropic",
        base_url: "https://api.anthropic.com/v1",
        default_model: "claude-sonnet-5",
        default_workers: 50,
        max_workers: 100,
    },
    ModelProvider {
        id: "zhipu",
        label: "智谱",
        base_url: "https://open.bigmodel.cn/api/paas/v4",
        default_model: "GLM-5.3-Flash",
        default_workers: 5,
        max_workers: 50,
    },
    ModelProvider {
        id: "custom",
        label: "自定义 API",
        base_url: "",
        default_model: "",
        default_workers: 5,
        max_workers: 100,
    },
];

pub const DEFAULT_MODEL_PROVIDER: &str = "deepseek";

pub fn model_provider(id: &str) -> Option<&'static ModelProvider> {
    MODEL_PROVIDERS.iter().find(|p| p.id == id)
}

/// OCR 服务商:id 与它的 token 在 credentials.toml 里的键。
pub const OCR_PROVIDERS: &[(&str, &str)] = &[("paddle", "paddle_token"), ("mineru", "mineru_token")];

pub const DEFAULT_OCR_PROVIDER: &str = "paddle";
