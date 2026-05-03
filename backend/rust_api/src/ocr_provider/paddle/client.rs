use std::future::Future;
use std::path::Path;
use std::result::Result as StdResult;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use reqwest::{multipart, Client, Response};
use serde_json::{json, Value};

use crate::ocr_provider::paddle::errors::PaddleProviderError;
use crate::ocr_provider::paddle::models::{
    PaddleJsonlLine, PaddlePollData, PaddlePollEnvelope, PaddleSubmitEnvelope,
};
use crate::ocr_provider::types::OcrProviderCapabilities;

const DEFAULT_BASE_URL: &str = "https://paddleocr.aistudio-app.com";
const REQUEST_TIMEOUT_SECS: u64 = 120;
const DOWNLOAD_TIMEOUT_SECS: u64 = 300;
const REQUEST_RETRY_ATTEMPTS: usize = 3;
const REQUEST_RETRY_BASE_DELAY_MILLIS: u64 = 500;

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
        let http = build_http_client();
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
        let optional_payload_json = serde_json::to_string(optional_payload)?;
        let url = format!("{}/api/v2/ocr/jobs", self.base_url);
        let file_name_for_retry = file_name.clone();
        let file_bytes_for_retry = file_bytes.clone();
        let optional_payload_for_retry = optional_payload_json.clone();
        let model_for_retry = model.to_string();
        let response = self
            .send_with_retry("submit", move || {
                let file_part = multipart::Part::bytes(file_bytes_for_retry.clone())
                    .file_name(file_name_for_retry.clone());
                let form = multipart::Form::new()
                    .text("model", model_for_retry.clone())
                    .text("optionalPayload", optional_payload_for_retry.clone())
                    .part("file", file_part);
                self.http
                    .post(&url)
                    .header(AUTHORIZATION, self.auth_header())
                    .multipart(form)
                    .send()
            })
            .await?;
        let envelope = parse_json_response::<PaddleSubmitEnvelope>("submit", response).await?;
        if envelope.error_code != 0 {
            return Err(anyhow::Error::new(PaddleProviderError::provider_error(
                "submit",
                envelope.error_code,
                &envelope.error_msg,
                normalize_trace_id(&envelope.log_id).as_deref(),
            )));
        }
        let data = envelope.data.ok_or_else(|| {
            anyhow::Error::new(PaddleProviderError::invalid_response(
                "submit",
                "Paddle submit missing data",
                normalize_trace_id(&envelope.log_id).as_deref(),
            ))
        })?;
        if data.job_id.trim().is_empty() {
            return Err(anyhow::Error::new(PaddleProviderError::invalid_response(
                "submit",
                "Paddle submit returned empty jobId",
                normalize_trace_id(&envelope.log_id).as_deref(),
            )));
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
        let url = format!("{}/api/v2/ocr/jobs", self.base_url);
        let response = self
            .send_with_retry("submit", || {
                self.http
                    .post(&url)
                    .header(AUTHORIZATION, self.auth_header())
                    .header(CONTENT_TYPE, "application/json")
                    .json(&payload)
                    .send()
            })
            .await?;
        let envelope = parse_json_response::<PaddleSubmitEnvelope>("submit", response).await?;
        if envelope.error_code != 0 {
            return Err(anyhow::Error::new(PaddleProviderError::provider_error(
                "submit",
                envelope.error_code,
                &envelope.error_msg,
                normalize_trace_id(&envelope.log_id).as_deref(),
            )));
        }
        let data = envelope.data.ok_or_else(|| {
            anyhow::Error::new(PaddleProviderError::invalid_response(
                "submit",
                "Paddle submit missing data",
                normalize_trace_id(&envelope.log_id).as_deref(),
            ))
        })?;
        if data.job_id.trim().is_empty() {
            return Err(anyhow::Error::new(PaddleProviderError::invalid_response(
                "submit",
                "Paddle submit returned empty jobId",
                normalize_trace_id(&envelope.log_id).as_deref(),
            )));
        }
        Ok(PaddleTrace {
            data: data.job_id,
            trace_id: normalize_trace_id(&envelope.log_id),
        })
    }

    pub async fn query_job(&self, job_id: &str) -> Result<PaddleTrace<PaddlePollData>> {
        let url = format!("{}/api/v2/ocr/jobs/{}", self.base_url, job_id);
        let response = self
            .send_with_retry("poll", || {
                self.http
                    .get(&url)
                    .header(AUTHORIZATION, self.auth_header())
                    .send()
            })
            .await?;
        let envelope = parse_json_response::<PaddlePollEnvelope>("poll", response).await?;
        if envelope.error_code != 0 {
            return Err(anyhow::Error::new(PaddleProviderError::provider_error(
                "poll",
                envelope.error_code,
                &envelope.error_msg,
                normalize_trace_id(&envelope.log_id).as_deref(),
            )));
        }
        Ok(PaddleTrace {
            data: envelope.data.unwrap_or_default(),
            trace_id: normalize_trace_id(&envelope.log_id),
        })
    }

    pub async fn probe_token(&self) -> Result<PaddleTrace<()>> {
        let probe_job_id = format!("retain-pdf-token-probe-{}", fastrand::u64(..));
        let url = format!("{}/api/v2/ocr/jobs/{}", self.base_url, probe_job_id);
        let response = self
            .send_with_retry("probe", || {
                self.http
                    .get(&url)
                    .header(AUTHORIZATION, self.auth_header())
                    .send()
            })
            .await?;
        let status = response.status();
        let bytes = response.bytes().await.map_err(|err| {
            anyhow::Error::new(PaddleProviderError::request_failed("probe", &err, None))
        })?;
        let body_text = String::from_utf8_lossy(&bytes).to_string();
        let envelope = serde_json::from_slice::<PaddlePollEnvelope>(&bytes).ok();
        let trace_id = envelope
            .as_ref()
            .and_then(|parsed| normalize_trace_id(&parsed.log_id));

        if status == reqwest::StatusCode::NOT_FOUND {
            return Ok(PaddleTrace { data: (), trace_id });
        }

        if !status.is_success() {
            return Err(anyhow::Error::new(PaddleProviderError::http_status(
                "probe",
                status,
                &body_text,
                trace_id.as_deref(),
                None,
            )));
        }

        if let Some(parsed) = envelope {
            if parsed.error_code == 0 || parsed.error_code == 404 || parsed.error_code == 11001 {
                return Ok(PaddleTrace {
                    data: (),
                    trace_id: normalize_trace_id(&parsed.log_id),
                });
            }
            return Err(anyhow::Error::new(PaddleProviderError::provider_error(
                "probe",
                parsed.error_code,
                &parsed.error_msg,
                normalize_trace_id(&parsed.log_id).as_deref(),
            )));
        }

        Err(anyhow::Error::new(PaddleProviderError::invalid_response(
            "probe",
            format!("failed to parse Paddle probe JSON: {body_text}"),
            None,
        )))
    }

    pub async fn download_jsonl_result(&self, jsonl_url: &str) -> Result<PaddleResultPayload> {
        let text = self
            .send_with_retry("download", || {
                self.http
                    .get(jsonl_url)
                    .timeout(Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
                    .send()
            })
            .await?
            .error_for_status()
            .map_err(|err| {
                let status = err.status().map(|value| value.as_u16());
                anyhow::Error::new(PaddleProviderError::result_download_failed(
                    format!("Paddle download jsonl returned error status: {err}"),
                    None,
                    status,
                ))
            })?
            .text()
            .await
            .map_err(|err| {
                anyhow::Error::new(PaddleProviderError::request_failed("download", &err, None))
            })?;
        let payload = combine_jsonl_payload(&text)?;
        Ok(PaddleResultPayload { payload })
    }

    fn auth_header(&self) -> String {
        format!("bearer {}", self.token.trim())
    }

    async fn send_with_retry<F, Fut>(&self, stage: &'static str, mut action: F) -> Result<Response>
    where
        F: FnMut() -> Fut,
        Fut: Future<Output = StdResult<Response, reqwest::Error>>,
    {
        let mut last_error: Option<reqwest::Error> = None;
        for attempt in 1..=REQUEST_RETRY_ATTEMPTS {
            match action().await {
                Ok(response) => return Ok(response),
                Err(err) => {
                    let retryable = is_retryable_transport_error(&err);
                    last_error = Some(err);
                    if !retryable || attempt >= REQUEST_RETRY_ATTEMPTS {
                        break;
                    }
                    let delay =
                        Duration::from_millis(REQUEST_RETRY_BASE_DELAY_MILLIS * attempt as u64);
                    tokio::time::sleep(delay).await;
                }
            }
        }
        let err = last_error.expect("Paddle request retry loop should capture last error");
        Err(anyhow::Error::new(PaddleProviderError::request_failed(
            stage, &err, None,
        )))
    }
}

fn build_http_client() -> Client {
    Client::builder()
        .connect_timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .no_proxy()
        .build()
        .expect("reqwest client")
}

fn is_retryable_transport_error(err: &reqwest::Error) -> bool {
    err.is_connect() || err.is_timeout() || err.is_body()
}

pub fn normalize_model_name(model: &str) -> String {
    let trimmed = model.trim();
    if trimmed.is_empty() {
        return "PaddleOCR-VL-1.5".to_string();
    }
    match trimmed.to_ascii_lowercase().as_str() {
        "paddleocr-vl" | "paddle-ocr-vl" => "PaddleOCR-VL".to_string(),
        "paddleocr-vl-1.5" | "paddle-ocr-vl-1.5" => "PaddleOCR-VL-1.5".to_string(),
        _ => trimmed.to_string(),
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
    stage: &'static str,
    response: reqwest::Response,
) -> Result<T> {
    let status = response.status();
    let bytes = response.bytes().await.map_err(|err| {
        anyhow::Error::new(PaddleProviderError::request_failed(stage, &err, None))
    })?;
    if !status.is_success() {
        return Err(anyhow::Error::new(PaddleProviderError::http_status(
            stage,
            status,
            &String::from_utf8_lossy(&bytes),
            None,
            None,
        )));
    }
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
        let parsed: PaddleJsonlLine = serde_json::from_str(trimmed).map_err(|err| {
            anyhow::Error::new(PaddleProviderError::result_unpack_failed(
                format!("failed to parse Paddle JSONL line: {trimmed}; {err}"),
                None,
            ))
        })?;
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

#[cfg(test)]
mod tests {
    use super::combine_jsonl_payload;
    use super::normalize_model_name;

    #[test]
    fn combine_jsonl_payload_merges_layout_results_and_data_info() {
        let payload = r#"
{"result":{"layoutParsingResults":[{"page":1}],"dataInfo":{"pages":[{"width":100}]}}}
{"result":{"layoutParsingResults":[{"page":2}]}}
"#;

        let merged = combine_jsonl_payload(payload).expect("merged payload");

        assert_eq!(
            merged["layoutParsingResults"].as_array().map(|v| v.len()),
            Some(2)
        );
        assert_eq!(merged["dataInfo"]["pages"][0]["width"], 100);
        assert_eq!(merged["_meta"]["source"], "paddle_jsonl");
        assert_eq!(merged["_meta"]["lineCount"], 2);
    }

    #[test]
    fn combine_jsonl_payload_reports_unpack_error_for_bad_line() {
        let err = combine_jsonl_payload("not-json").expect_err("expected error");
        let provider = err
            .downcast_ref::<crate::ocr_provider::paddle::errors::PaddleProviderError>()
            .expect("paddle provider error");

        assert_eq!(
            provider.info().category,
            crate::ocr_provider::types::OcrErrorCategory::ResultUnpackFailed
        );
    }

    #[test]
    fn normalize_model_name_maps_known_aliases() {
        assert_eq!(normalize_model_name(""), "PaddleOCR-VL-1.5");
        assert_eq!(
            normalize_model_name("paddle-ocr-vl-1.5"),
            "PaddleOCR-VL-1.5"
        );
        assert_eq!(normalize_model_name("paddleocr-vl-1.5"), "PaddleOCR-VL-1.5");
        assert_eq!(normalize_model_name("paddle-ocr-vl"), "PaddleOCR-VL");
    }
}
