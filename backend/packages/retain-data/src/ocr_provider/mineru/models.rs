#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct MineruApiEnvelope<T> {
    #[serde(default)]
    pub code: serde_json::Value,
    #[serde(default)]
    pub msg: String,
    #[serde(default)]
    pub trace_id: String,
    pub data: Option<T>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct MineruBatchFileUrl {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct MineruApplyUploadUrlsData {
    #[serde(default)]
    pub batch_id: String,
    #[serde(default)]
    pub file_urls: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct MineruExtractProgress {
    pub extracted_pages: Option<i64>,
    pub total_pages: Option<i64>,
    #[serde(default)]
    pub start_time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct MineruTaskData {
    #[serde(default)]
    pub task_id: String,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub err_msg: String,
    #[serde(default)]
    pub full_zip_url: String,
    pub extract_progress: Option<MineruExtractProgress>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct MineruBatchResultItem {
    #[serde(default)]
    pub file_name: String,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub err_msg: String,
    #[serde(default)]
    pub full_zip_url: String,
    pub extract_progress: Option<MineruExtractProgress>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct MineruBatchStatusData {
    #[serde(default)]
    pub extract_result: Vec<MineruBatchResultItem>,
}

pub fn parse_envelope_fragment(text: &str) -> Option<MineruApiEnvelope<Value>> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    if end <= start {
        return None;
    }
    serde_json::from_str::<MineruApiEnvelope<Value>>(&text[start..=end]).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_embedded_json_envelope_fragment() {
        let text = r#"prefix {"code":-60011,"msg":"获取有效文件失败","trace_id":"trace-123","data":null} suffix"#;
        let parsed = parse_envelope_fragment(text).expect("parsed");
        assert_eq!(parsed.msg, "获取有效文件失败");
        assert_eq!(parsed.trace_id, "trace-123");
        assert_eq!(parsed.code, Value::from(-60011));
    }
}
