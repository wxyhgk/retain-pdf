use std::fs::{self, File};
use std::io::{self, Write};
use std::path::Path;
use std::time::Duration;

use anyhow::{anyhow, bail, Context, Result};
use reqwest::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{json, Value};
use zip::ZipArchive;

use crate::ocr_provider::mineru::errors::{
    extract_provider_error_code, extract_provider_message, extract_provider_trace_id,
};
use crate::ocr_provider::mineru::models::{
    MineruApiEnvelope, MineruApplyUploadUrlsData, MineruBatchResultItem, MineruBatchStatusData,
    MineruTaskData,
};
use crate::ocr_provider::types::OcrProviderCapabilities;

const DEFAULT_BASE_URL: &str = "https://mineru.net";
const REQUEST_TIMEOUT_SECS: u64 = 120;
const UPLOAD_TIMEOUT_SECS: u64 = 300;
const DOWNLOAD_TIMEOUT_SECS: u64 = 300;

#[derive(Debug, Clone)]
pub struct MineruClient {
    pub base_url: String,
    pub token: String,
    http: Client,
}

#[derive(Debug, Clone)]
pub struct MineruTrace<T> {
    pub data: T,
    pub trace_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct MineruUploadTarget {
    pub batch_id: String,
    pub upload_url: String,
    pub trace_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct MineruCreatedTask {
    pub task_id: String,
    pub trace_id: Option<String>,
}

impl MineruClient {
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

    pub async fn apply_upload_url(
        &self,
        file_name: &str,
        model_version: &str,
        data_id: &str,
    ) -> Result<MineruUploadTarget> {
        let file_spec = if data_id.trim().is_empty() {
            json!({ "name": file_name })
        } else {
            json!({ "name": file_name, "data_id": data_id.trim() })
        };
        let payload = json!({
            "files": [file_spec],
            "model_version": model_version,
        });
        let envelope: MineruApiEnvelope<MineruApplyUploadUrlsData> = self
            .post_json("/api/v4/file-urls/batch", &payload)
            .await
            .context("MinerU apply upload url failed")?;
        let data = envelope
            .data
            .ok_or_else(|| anyhow!("MinerU apply upload url missing data"))?;
        let upload_url = data
            .file_urls
            .into_iter()
            .find(|item| !item.trim().is_empty())
            .ok_or_else(|| anyhow!("MinerU API did not return any upload URL"))?;
        Ok(MineruUploadTarget {
            batch_id: data.batch_id,
            upload_url,
            trace_id: normalize_trace_id(&envelope.trace_id),
        })
    }

    pub async fn upload_file(&self, upload_url: &str, file_path: &Path) -> Result<()> {
        let bytes = tokio::fs::read(file_path)
            .await
            .with_context(|| format!("failed to read upload file {}", file_path.display()))?;
        self.http
            .put(upload_url)
            .timeout(Duration::from_secs(UPLOAD_TIMEOUT_SECS))
            .body(bytes)
            .send()
            .await
            .context("MinerU file upload request failed")?
            .error_for_status()
            .context("MinerU file upload returned error status")?;
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn create_extract_task(
        &self,
        file_url: &str,
        model_version: &str,
        is_ocr: bool,
        enable_formula: bool,
        enable_table: bool,
        language: &str,
        page_ranges: &str,
        data_id: &str,
        no_cache: bool,
        cache_tolerance: i64,
        extra_formats: &[String],
    ) -> Result<MineruCreatedTask> {
        let mut payload = json!({
            "url": file_url,
            "model_version": model_version,
            "is_ocr": is_ocr,
            "enable_formula": enable_formula,
            "enable_table": enable_table,
            "language": language,
            "no_cache": no_cache,
            "cache_tolerance": cache_tolerance,
        });
        if !page_ranges.trim().is_empty() {
            payload["page_ranges"] = Value::String(page_ranges.trim().to_string());
        }
        if !data_id.trim().is_empty() {
            payload["data_id"] = Value::String(data_id.trim().to_string());
        }
        if !extra_formats.is_empty() {
            payload["extra_formats"] = Value::Array(
                extra_formats
                    .iter()
                    .map(|item| Value::String(item.clone()))
                    .collect(),
            );
        }
        let envelope: MineruApiEnvelope<MineruTaskData> = self
            .post_json("/api/v4/extract/task", &payload)
            .await
            .context("MinerU create extract task failed")?;
        let data = envelope
            .data
            .ok_or_else(|| anyhow!("MinerU create extract task missing data"))?;
        if data.task_id.trim().is_empty() {
            bail!("MinerU create extract task returned empty task_id");
        }
        Ok(MineruCreatedTask {
            task_id: data.task_id,
            trace_id: normalize_trace_id(&envelope.trace_id),
        })
    }

    pub async fn query_batch_status(
        &self,
        batch_id: &str,
    ) -> Result<MineruTrace<MineruBatchStatusData>> {
        let envelope: MineruApiEnvelope<MineruBatchStatusData> = self
            .get_json(&format!("/api/v4/extract-results/batch/{batch_id}"))
            .await
            .with_context(|| format!("MinerU query batch status failed: {batch_id}"))?;
        Ok(MineruTrace {
            data: envelope.data.unwrap_or_default(),
            trace_id: normalize_trace_id(&envelope.trace_id),
        })
    }

    pub async fn query_task(&self, task_id: &str) -> Result<MineruTrace<MineruTaskData>> {
        let envelope: MineruApiEnvelope<MineruTaskData> = self
            .get_json(&format!("/api/v4/extract/task/{task_id}"))
            .await
            .with_context(|| format!("MinerU query task failed: {task_id}"))?;
        Ok(MineruTrace {
            data: envelope.data.unwrap_or_default(),
            trace_id: normalize_trace_id(&envelope.trace_id),
        })
    }

    pub async fn download_bundle(&self, full_zip_url: &str, dest_path: &Path) -> Result<()> {
        let response = self
            .http
            .get(full_zip_url)
            .header(AUTHORIZATION, self.auth_header())
            .header(ACCEPT, "*/*")
            .timeout(Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
            .send()
            .await
            .context("MinerU download bundle request failed")?
            .error_for_status()
            .context("MinerU download bundle returned error status")?;
        let bytes = response
            .bytes()
            .await
            .context("failed to read MinerU bundle response bytes")?;
        if let Some(parent) = dest_path.parent() {
            fs::create_dir_all(parent)?;
        }
        tokio::fs::write(dest_path, &bytes)
            .await
            .with_context(|| format!("failed to write bundle to {}", dest_path.display()))?;
        Ok(())
    }

    pub fn unpack_zip(&self, zip_path: &Path, dest_dir: &Path) -> Result<()> {
        fs::create_dir_all(dest_dir)?;
        let file = File::open(zip_path)
            .with_context(|| format!("failed to open bundle {}", zip_path.display()))?;
        let mut archive =
            ZipArchive::new(file).with_context(|| format!("invalid zip {}", zip_path.display()))?;
        for idx in 0..archive.len() {
            let mut entry = archive.by_index(idx)?;
            let out_path = dest_dir.join(entry.name());
            if entry.is_dir() {
                fs::create_dir_all(&out_path)?;
                continue;
            }
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut writer = File::create(&out_path)?;
            io::copy(&mut entry, &mut writer)?;
            writer.flush()?;
        }
        Ok(())
    }

    async fn post_json<T: DeserializeOwned>(
        &self,
        path: &str,
        payload: &impl Serialize,
    ) -> Result<MineruApiEnvelope<T>> {
        let response = self
            .http
            .post(self.build_url(path))
            .header(CONTENT_TYPE, "application/json")
            .header(ACCEPT, "*/*")
            .header(AUTHORIZATION, self.auth_header())
            .json(payload)
            .send()
            .await
            .with_context(|| format!("POST {} failed", self.build_url(path)))?;
        self.parse_envelope_response(response).await
    }

    async fn get_json<T: DeserializeOwned>(&self, path: &str) -> Result<MineruApiEnvelope<T>> {
        let response = self
            .http
            .get(self.build_url(path))
            .header(ACCEPT, "*/*")
            .header(AUTHORIZATION, self.auth_header())
            .send()
            .await
            .with_context(|| format!("GET {} failed", self.build_url(path)))?;
        self.parse_envelope_response(response).await
    }

    async fn parse_envelope_response<T: DeserializeOwned>(
        &self,
        response: reqwest::Response,
    ) -> Result<MineruApiEnvelope<T>> {
        let status = response.status();
        let text = response
            .text()
            .await
            .context("failed to read MinerU response body")?;
        if !status.is_success() {
            bail!(
                "MinerU HTTP {}: {}",
                status.as_u16(),
                summarize_error_text(&text)
            );
        }
        let envelope: MineruApiEnvelope<T> = serde_json::from_str(&text).with_context(|| {
            format!(
                "invalid MinerU JSON response: {}",
                summarize_error_text(&text)
            )
        })?;
        ensure_envelope_ok(&envelope, &text)?;
        Ok(envelope)
    }

    fn build_url(&self, path: &str) -> String {
        if path.starts_with("http://") || path.starts_with("https://") {
            return path.to_string();
        }
        format!(
            "{}/{}",
            self.base_url.trim_end_matches('/'),
            path.trim_start_matches('/')
        )
    }

    fn auth_header(&self) -> String {
        format!("Bearer {}", self.token.trim())
    }
}

pub fn capabilities() -> OcrProviderCapabilities {
    OcrProviderCapabilities {
        supports_remote_url_submit: true,
        supports_local_file_upload: true,
        supports_polling: true,
        supports_download_bundle: true,
        supports_extra_formats: true,
        supports_formula_toggle: true,
        supports_table_toggle: true,
    }
}

pub fn parse_extra_formats(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

pub fn find_extract_result_in_batch<'a>(
    batch: &'a MineruBatchStatusData,
    file_name: &str,
) -> Option<&'a MineruBatchResultItem> {
    batch
        .extract_result
        .iter()
        .find(|item| item.file_name == file_name)
}

fn ensure_envelope_ok<T>(envelope: &MineruApiEnvelope<T>, raw_text: &str) -> Result<()> {
    match &envelope.code {
        Value::Number(value) if value.as_i64() == Some(0) => Ok(()),
        Value::String(value) if value.trim() == "0" => Ok(()),
        Value::Null => Ok(()),
        other => {
            let code = other.to_string();
            let message = extract_provider_message(raw_text)
                .or_else(|| (!envelope.msg.trim().is_empty()).then(|| envelope.msg.clone()))
                .unwrap_or_else(|| "unknown MinerU error".to_string());
            let trace_id = extract_provider_trace_id(raw_text)
                .or_else(|| normalize_trace_id(&envelope.trace_id));
            let provider_code = extract_provider_error_code(raw_text).unwrap_or(code);
            let trace_suffix = trace_id
                .as_deref()
                .map(|trace| format!(" trace_id={trace}"))
                .unwrap_or_default();
            bail!("MinerU API error code={provider_code}: {message}{trace_suffix}");
        }
    }
}

fn summarize_error_text(text: &str) -> String {
    text.trim().chars().take(300).collect()
}

fn normalize_trace_id(trace_id: &str) -> Option<String> {
    let trimmed = trace_id.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}
