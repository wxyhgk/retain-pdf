use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PaddleSubmitEnvelope {
    #[serde(default, rename = "logId")]
    pub log_id: String,
    #[serde(default, rename = "errorCode")]
    pub error_code: i64,
    #[serde(default, rename = "errorMsg")]
    pub error_msg: String,
    pub data: Option<PaddleSubmitData>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PaddleSubmitData {
    #[serde(default, rename = "jobId")]
    pub job_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PaddlePollEnvelope {
    #[serde(default, rename = "logId")]
    pub log_id: String,
    #[serde(default, rename = "errorCode")]
    pub error_code: i64,
    #[serde(default, rename = "errorMsg")]
    pub error_msg: String,
    pub data: Option<PaddlePollData>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PaddlePollData {
    #[serde(default, rename = "jobId")]
    pub job_id: String,
    #[serde(default)]
    pub state: String,
    #[serde(default, rename = "errorMsg")]
    pub error_msg: String,
    #[serde(rename = "extractProgress")]
    pub extract_progress: Option<PaddleExtractProgress>,
    #[serde(rename = "resultUrl")]
    pub result_url: Option<PaddleResultUrl>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PaddleExtractProgress {
    #[serde(rename = "totalPages")]
    pub total_pages: Option<i64>,
    #[serde(rename = "extractedPages")]
    pub extracted_pages: Option<i64>,
    #[serde(default, rename = "startTime")]
    pub start_time: String,
    #[serde(default, rename = "endTime")]
    pub end_time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PaddleResultUrl {
    #[serde(default, rename = "jsonUrl")]
    pub json_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PaddleJsonlLine {
    pub result: Option<Value>,
}
