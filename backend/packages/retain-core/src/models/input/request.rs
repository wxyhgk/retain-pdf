use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::{
    JobSourceInput, OcrInput, RenderInput, RuntimeInput, TranslationInput, WorkflowKind,
};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(deny_unknown_fields)]
pub struct CreateJobInput {
    #[serde(default)]
    pub workflow: WorkflowKind,
    #[serde(default)]
    pub source: JobSourceInput,
    #[serde(default)]
    pub ocr: OcrInput,
    #[serde(default)]
    pub translation: TranslationInput,
    #[serde(default)]
    pub render: RenderInput,
    #[serde(default)]
    pub runtime: RuntimeInput,
}

impl CreateJobInput {
    pub fn from_api_value(value: Value) -> serde_json::Result<Self> {
        serde_json::from_value(value)
    }
}
