use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(deny_unknown_fields)]
pub struct JobSourceInput {
    #[serde(default)]
    pub upload_id: String,
    #[serde(default)]
    pub source_url: String,
    #[serde(default)]
    pub artifact_job_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ResolvedSourceSpec {
    pub upload_id: String,
    pub source_url: String,
    pub artifact_job_id: String,
}
