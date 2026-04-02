use std::path::Path;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use reqwest::{multipart, Client};
use serde_json::{json, Value};

use crate::ocr_provider::paddle::models::{
    PaddleJsonlLine, PaddlePollData, PaddlePollEnvelope, PaddleSubmitEnvelope,
};
use crate::ocr_provider::types::OcrProviderCapabilities;

const DEFAULT_BASE_URL: &str = "https://paddleocr.aistudio-app.com";
const REQUEST_TIMEOUT_SECS: u64 = 120;
const DOWNLOAD_TIMEOUT_SECS: u64 = 300;

#[derive(Debug, Clone)]
pub struct PaddleClient {
    pub base_url: String,
    pub token: String,
    http: Client,
}

#[derive(Debug, Clone)]
pub struct PaddleTrace<T> {
    pub data: T,
    pub trace_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PaddleResultPayload {
    pub payload: Value,
}

impl PaddleClient {
    pub fn new(base_url: impl Into<String>, token: impl Into<String>) -> Self {
        let base_url = {
            let raw = base_url.into();
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                DEFAULT_BASE_URL.to_string()
            } else {
                trimmed.trim_end_matches('/').to_string()
            }
        };
        let http = Client::builder()
            .connect_timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .expect("reqwest client");
        Self {
            base_url,
            token: token.into(),
            http,
        }
    }

    pub async fn submit_local_file(
        &self,
        file_path: &Path,
        model: &str,
        optional_payload: &Value,
    ) -> Result<PaddleTrace<String>> {
        let file_name = file_path
            .file_name()
            .and_then(|item| item.to_str())
            .ok_or_else(|| anyhow!("invalid upload filename"))?
            .to_string();
        let file_bytes = tokio::fs::read(file_path)
            .await
            .with_context(|| format!("failed to read upload file {}", file_path.display()))?;
        let file_part = multipart::Part::bytes(file_bytes).file_name(file_name);
        let form = multipart::Form::new()
            .text("model", model.to_string())
            .text("optionalPayload", serde_json::to_string(optional_payload)?)
            .part("file", file_part);
        let response = self
            .http
            .post(format!("{}/api/v2/ocr/jobs", self.base_url))
            .header(AUTHORIZATION, self.auth_header())
            .multipart(form)
            .send()
            .await
            .context("Paddle submit local file request failed")?;
        let envelope = parse_json_response::<PaddleSubmitEnvelope>(response).await?;
        let data = envelope
            .data
            .ok_or_else(|| anyhow!("Paddle submit missing data"))?;
        if data.job_id.trim().is_empty() {
            return Err(anyhow!("Paddle submit returned empty jobId"));
        }
        Ok(PaddleTrace {
            data: data.job_id,
            trace_id: normalize_trace_id(&envelope.log_id),
        })
    }

    pub async fn submit_remote_url(
        &self,
        source_url: &str,
        model: &str,
        optional_payload: &Value,
    ) -> Result<PaddleTrace<String>> {
        let payload = json!({
            "fileUrl": source_url,
            "model": model,
            "optionalPayload": optional_payload,
        });
        let response = self
            .http
            .post(format!("{}/api/v2/ocr/jobs", self.base_url))
            .header(AUTHORIZATION, self.auth_header())
            .header(CONTENT_TYPE, "application/json")
            .json(&payload)
            .send()
            .await
            .context("Paddle submit remote url request failed")?;
        let envelope = parse_json_response::<PaddleSubmitEnvelope>(response).await?;
        let data = envelope
            .data
            .ok_or_else(|| anyhow!("Paddle submit missing data"))?;
        if data.job_id.trim().is_empty() {
            return Err(anyhow!("Paddle submit returned empty jobId"));
        }
        Ok(PaddleTrace {
            data: data.job_id,
            trace_id: normalize_trace_id(&envelope.log_id),
        })
    }

    pub async fn query_job(&self, job_id: &str) -> Result<PaddleTrace<PaddlePollData>> {
        let response = self
            .http
            .get(format!("{}/api/v2/ocr/jobs/{}", self.base_url, job_id))
            .header(AUTHORIZATION, self.auth_header())
            .send()
            .await
            .with_context(|| format!("Paddle query job failed: {job_id}"))?;
        let envelope = parse_json_response::<PaddlePollEnvelope>(response).await?;
        Ok(PaddleTrace {
            data: envelope.data.unwrap_or_default(),
            trace_id: normalize_trace_id(&envelope.log_id),
        })
    }

    pub async fn download_jsonl_result(&self, jsonl_url: &str) -> Result<PaddleResultPayload> {
        let text = self
            .http
            .get(jsonl_url)
            .timeout(Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
            .send()
            .await
            .context("Paddle download jsonl request failed")?
            .error_for_status()
            .context("Paddle download jsonl returned error status")?
            .text()
            .await
            .context("failed to read Paddle jsonl response body")?;
        let payload = combine_jsonl_payload(&text)?;
        Ok(PaddleResultPayload { payload })
    }

    fn auth_header(&self) -> String {
        format!("bearer {}", self.token.trim())
    }
}

pub fn capabilities() -> OcrProviderCapabilities {
    OcrProviderCapabilities {
        supports_remote_url_submit: true,
        supports_local_file_upload: true,
        supports_polling: true,
        supports_download_bundle: false,
        supports_extra_formats: false,
        supports_formula_toggle: false,
        supports_table_toggle: false,
    }
}

fn normalize_trace_id(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

async fn parse_json_response<T: serde::de::DeserializeOwned>(
    response: reqwest::Response,
) -> Result<T> {
    let response = response.error_for_status()?;
    let bytes = response.bytes().await?;
    let envelope = serde_json::from_slice::<T>(&bytes).with_context(|| {
        format!(
            "failed to parse Paddle JSON: {}",
            String::from_utf8_lossy(&bytes)
        )
    })?;
    Ok(envelope)
}

fn combine_jsonl_payload(text: &str) -> Result<Value> {
    let mut layout_results = Vec::new();
    let mut data_info = Value::Object(Default::default());
    let mut line_count = 0usize;
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        line_count += 1;
        let parsed: PaddleJsonlLine = serde_json::from_str(trimmed)
            .with_context(|| format!("failed to parse Paddle JSONL line: {trimmed}"))?;
        let Some(result) = parsed.result else {
            continue;
        };
        if let Some(items) = result
            .get("layoutParsingResults")
            .and_then(|v| v.as_array())
        {
            layout_results.extend(items.iter().cloned());
        }
        if result.get("dataInfo").is_some()
            && data_info.as_object().map(|m| m.is_empty()).unwrap_or(true)
        {
            data_info = result.get("dataInfo").cloned().unwrap_or_else(|| json!({}));
        }
    }
    Ok(json!({
        "layoutParsingResults": layout_results,
        "dataInfo": data_info,
        "_meta": {
            "source": "paddle_jsonl",
            "lineCount": line_count,
        }
    }))
}
