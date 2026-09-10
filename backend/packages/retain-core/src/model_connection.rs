//! Secret-free connection snapshot shared by the API, jobsd and durable jobs.
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Provider {
    Qwen,
    Deepseek,
    OpenaiCompatible,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Thinking {
    #[default]
    Auto,
    Off,
    On,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ModelConnection {
    pub id: String,
    pub revision: u64,
    pub provider: Provider,
    pub base_url: String,
    pub model: String,
    pub credential_ref: String,
    pub concurrency: usize,
    #[serde(default)]
    pub thinking: Thinking,
    #[serde(default)]
    pub stream: Option<bool>,
    #[serde(default)]
    pub allow_private_endpoint: bool,
    #[serde(default)]
    pub deadlines: Deadlines,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Deadlines {
    pub queue_ms: u64,
    pub connect_ms: u64,
    pub idle_ms: u64,
    pub total_ms: u64,
}
impl Default for Deadlines {
    fn default() -> Self {
        Self {
            queue_ms: 30_000,
            connect_ms: 10_000,
            idle_ms: 60_000,
            total_ms: 180_000,
        }
    }
}
