use std::future::Future;
use std::path::Path;
use std::result::Result as StdResult;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use reqwest::{multipart, Client, Response};
use serde_json::{json, Value};

use crate::config::PaddleRuntimeConfig;
use crate::ocr_provider::paddle::errors::{PaddleProviderError, PADDLE_TASK_FAILED_CODE};
use crate::ocr_provider::paddle::models::{
    PaddleJsonlLine, PaddlePollData, PaddlePollEnvelope, PaddleSubmitEnvelope,
};
use crate::ocr_provider::types::OcrProviderCapabilities;

#[derive(Debug, Clone)]
pub struct PaddleClient {
    pub base_url: String,
    pub token: String,
    http: Client,
    runtime: PaddleRuntimeConfig,
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

/// 已经收到响应头、正文还没读的结果下载。
#[derive(Debug)]
pub struct PaddleJsonlDownload {
    response: Response,
}

impl PaddleJsonlDownload {
    /// 服务端声明的正文大小；没给 Content-Length 时为 None。
    pub fn content_length(&self) -> Option<u64> {
        self.response.content_length()
    }

    pub async fn into_payload(self) -> Result<PaddleResultPayload> {
        let text = self.response.text().await.map_err(|err| {
            anyhow::Error::new(PaddleProviderError::request_failed("download", &err, None))
        })?;
        let payload = combine_jsonl_payload(&text)?;
        Ok(PaddleResultPayload { payload })
    }
}

impl PaddleClient {
    pub fn new(base_url: impl Into<String>, token: impl Into<String>) -> Self {
        Self::with_runtime(base_url, token, PaddleRuntimeConfig::from_env())
    }

    pub fn with_runtime(
        base_url: impl Into<String>,
        token: impl Into<String>,
        runtime: PaddleRuntimeConfig,
    ) -> Self {
        let http = build_http_client(&runtime);
        Self::with_http_client(base_url, token, runtime, http)
    }

    /// 用调用方建好的 HTTP 客户端。给密钥校验用：校验有自己的超时、不跟随重定向、不重试
    /// （重试次数看 `runtime.request_retry_attempts`），正式跑任务的客户端（[`Self::with_runtime`]）不受影响。
    pub fn with_http_client(
        base_url: impl Into<String>,
        token: impl Into<String>,
        runtime: PaddleRuntimeConfig,
        http: Client,
    ) -> Self {
        let base_url = {
            let raw = base_url.into();
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                runtime.default_base_url.trim_end_matches('/').to_string()
            } else {
                trimmed.trim_end_matches('/').to_string()
            }
        };
        Self {
            base_url,
            token: token.into(),
            http,
            runtime,
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
        // 上传用单独的、按文件大小放宽的超时，而不是客户端默认的 request_timeout：
        // 慢上行下 5 MB 就要 80 多秒，120s 会把稍大的文件全部判死。
        let upload_timeout = self
            .runtime
            .upload_timeout_for_bytes(file_bytes.len() as u64);
        self.retry_rejected_submit(|| {
            self.submit_local_file_once(
                &file_name,
                file_bytes.clone(),
                model,
                &optional_payload_json,
                upload_timeout,
            )
        })
        .await
    }

    /// 发一次本地文件提交。仍然 send_once 不重试传输错误 —— 提交不是幂等的，响应丢了时重传可能在 Paddle 那边建出两个任务；
    /// 只有服务商明确拒收（[`PaddleProviderError::submit_retryable`]）才由 [`Self::retry_rejected_submit`] 重交。
    async fn submit_local_file_once(
        &self,
        file_name: &str,
        file_bytes: Vec<u8>,
        model: &str,
        optional_payload_json: &str,
        upload_timeout: Duration,
    ) -> Result<PaddleTrace<String>> {
        let url = format!("{}/api/v2/ocr/jobs", self.base_url);
        let file_part = multipart::Part::bytes(file_bytes).file_name(file_name.to_string());
        let form = multipart::Form::new()
            .text("model", model.to_string())
            .text("optionalPayload", optional_payload_json.to_string())
            .part("file", file_part);
        let response = self
            .send_once(
                "submit",
                self.http
                    .post(&url)
                    .header(AUTHORIZATION, self.auth_header())
                    .timeout(upload_timeout)
                    .multipart(form)
                    .send(),
            )
            .await?;
        submitted_job_id(parse_json_response::<PaddleSubmitEnvelope>("submit", response).await?)
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
        self.retry_rejected_submit(|| self.submit_remote_url_once(&payload))
            .await
    }

    async fn submit_remote_url_once(&self, payload: &Value) -> Result<PaddleTrace<String>> {
        let url = format!("{}/api/v2/ocr/jobs", self.base_url);
        let response = self
            .send_once(
                "submit",
                self.http
                    .post(&url)
                    .header(AUTHORIZATION, self.auth_header())
                    .header(CONTENT_TYPE, "application/json")
                    .json(payload)
                    .send(),
            )
            .await?;
        submitted_job_id(parse_json_response::<PaddleSubmitEnvelope>("submit", response).await?)
    }

    /// 服务商明确拒收的提交（排队已满 10010、请求太快 429/12002、HTTP 500）退避后重交，
    /// 次数同 `request_retry_attempts`，第 n 次重交前等 `request_retry_base_delay_millis × 20 × n`（默认 10s、20s）。
    /// 这几种都没有建出任务，重交不会重复计费；用完还被拒就把最后一次的错误原样交出去。
    async fn retry_rejected_submit<F, Fut>(&self, mut submit: F) -> Result<PaddleTrace<String>>
    where
        F: FnMut() -> Fut,
        Fut: Future<Output = Result<PaddleTrace<String>>>,
    {
        let attempts = self.runtime.request_retry_attempts.max(1);
        let mut attempt = 1;
        loop {
            match submit().await {
                Err(err)
                    if attempt < attempts
                        && err
                            .downcast_ref::<PaddleProviderError>()
                            .is_some_and(PaddleProviderError::submit_retryable) =>
                {
                    tracing::warn!("Paddle submit rejected, retry {attempt}/{attempts}: {err:#}");
                    tokio::time::sleep(self.rejection_retry_delay(attempt)).await;
                    attempt += 1;
                }
                other => return other,
            }
        }
    }

    fn rejection_retry_delay(&self, attempt: usize) -> Duration {
        Duration::from_millis(
            self.runtime
                .request_retry_base_delay_millis
                .saturating_mul(20)
                .saturating_mul(attempt as u64),
        )
    }

    /// 查询任务状态。被限流（HTTP 429 / 12002）时退避后再查（查询是幂等的），次数、等待同提交的重交。
    pub async fn query_job(&self, job_id: &str) -> Result<PaddleTrace<PaddlePollData>> {
        let attempts = self.runtime.request_retry_attempts.max(1);
        let mut attempt = 1;
        loop {
            match self.query_job_once(job_id).await {
                Err(err)
                    if attempt < attempts
                        && err
                            .downcast_ref::<PaddleProviderError>()
                            .is_some_and(PaddleProviderError::poll_rate_limited) =>
                {
                    tracing::warn!("Paddle poll rate limited, retry {attempt}/{attempts}: {err:#}");
                    tokio::time::sleep(self.rejection_retry_delay(attempt)).await;
                    attempt += 1;
                }
                other => return other,
            }
        }
    }

    async fn query_job_once(&self, job_id: &str) -> Result<PaddleTrace<PaddlePollData>> {
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
        let trace_id = normalize_trace_id(&envelope.log_id);
        if envelope.error_code == PADDLE_TASK_FAILED_CODE {
            // 官方：任务失败时 GET 返回 HTTP 200、code=11003，原因在 data.errorMsg。
            let reason = envelope
                .data
                .as_ref()
                .map(|data| data.error_msg.trim())
                .filter(|reason| !reason.is_empty())
                .unwrap_or(envelope.error_msg.trim())
                .to_string();
            return Err(anyhow::Error::new(PaddleProviderError::task_failed_with_code(
                envelope.error_code,
                &reason,
                trace_id.as_deref(),
            )));
        }
        if envelope.error_code != 0 {
            return Err(anyhow::Error::new(PaddleProviderError::provider_error(
                "poll",
                envelope.error_code,
                &envelope.error_msg,
                trace_id.as_deref(),
            )));
        }
        Ok(PaddleTrace {
            data: envelope.data.unwrap_or_default(),
            trace_id,
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
        self.open_jsonl_result(jsonl_url).await?.into_payload().await
    }

    /// 拿到结果 JSONL 的响应头就返回，正文留给 [`PaddleJsonlDownload::into_payload`]
    /// 再读。拆两步是为了让调用方在下载正文（样本 1.8 MB 要 12s）之前就能
    /// 拿到 Content-Length，先把「正在下载 x MB」写给前端。
    pub async fn open_jsonl_result(&self, jsonl_url: &str) -> Result<PaddleJsonlDownload> {
        let response = self
            .send_with_retry("download", || {
                self.http
                    .get(jsonl_url)
                    .timeout(Duration::from_secs(self.runtime.download_timeout_secs))
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
            })?;
        Ok(PaddleJsonlDownload { response })
    }

    /// 带超时、不走系统代理的同一个 HTTP 客户端，给 ocr_flow 下载 markdown 插图用。
    /// 之前插图用的是 `Client::new()`：没有超时，一张图卡住整个任务就无限挂起。
    pub fn http_client(&self) -> &Client {
        &self.http
    }

    fn auth_header(&self) -> String {
        format!("bearer {}", self.token.trim())
    }

    async fn send_once<Fut>(&self, stage: &'static str, action: Fut) -> Result<Response>
    where
        Fut: Future<Output = StdResult<Response, reqwest::Error>>,
    {
        action.await.map_err(|err| {
            anyhow::Error::new(PaddleProviderError::request_failed(stage, &err, None))
        })
    }

    async fn send_with_retry<F, Fut>(&self, stage: &'static str, mut action: F) -> Result<Response>
    where
        F: FnMut() -> Fut,
        Fut: Future<Output = StdResult<Response, reqwest::Error>>,
    {
        let mut last_error: Option<reqwest::Error> = None;
        for attempt in 1..=self.runtime.request_retry_attempts {
            match action().await {
                Ok(response) => return Ok(response),
                Err(err) => {
                    let retryable = is_retryable_transport_error(&err);
                    last_error = Some(err);
                    if !retryable || attempt >= self.runtime.request_retry_attempts {
                        break;
                    }
                    let delay = Duration::from_millis(
                        self.runtime.request_retry_base_delay_millis * attempt as u64,
                    );
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

/// 提交返回包 → 任务号：业务码不是 0 时报 [`PaddleProviderError::provider_error`]，没有 jobId 时报返回结构不对。
fn submitted_job_id(envelope: PaddleSubmitEnvelope) -> Result<PaddleTrace<String>> {
    let trace_id = normalize_trace_id(&envelope.log_id);
    if envelope.error_code != 0 {
        return Err(anyhow::Error::new(PaddleProviderError::provider_error(
            "submit",
            envelope.error_code,
            &envelope.error_msg,
            trace_id.as_deref(),
        )));
    }
    let data = envelope.data.ok_or_else(|| {
        anyhow::Error::new(PaddleProviderError::invalid_response(
            "submit",
            "Paddle submit missing data",
            trace_id.as_deref(),
        ))
    })?;
    if data.job_id.trim().is_empty() {
        return Err(anyhow::Error::new(PaddleProviderError::invalid_response(
            "submit",
            "Paddle submit returned empty jobId",
            trace_id.as_deref(),
        )));
    }
    Ok(PaddleTrace {
        data: data.job_id,
        trace_id,
    })
}

fn build_http_client(runtime: &PaddleRuntimeConfig) -> Client {
    Client::builder()
        .connect_timeout(Duration::from_secs(runtime.request_timeout_secs))
        .timeout(Duration::from_secs(runtime.request_timeout_secs))
        .no_proxy()
        .build()
        .expect("reqwest client")
}

fn is_retryable_transport_error(err: &reqwest::Error) -> bool {
    err.is_connect()
        || err.is_timeout()
        || err.is_body()
        // Hyper reports a connection closed before any response headers as a
        // request error (for example IncompleteMessage), not a connect/body
        // error. This path is only used by idempotent poll/probe/download
        // calls; non-idempotent submit continues to use send_once.
        || (err.is_request() && err.status().is_none())
}

pub fn normalize_model_name(model: &str) -> String {
    crate::ocr_provider::normalize_paddle_model_name(model)
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
        assert_eq!(normalize_model_name(""), "PaddleOCR-VL-1.6");
        assert_eq!(normalize_model_name("paddle-ocr-vl"), "PaddleOCR-VL-1.6");
        assert_eq!(
            normalize_model_name("paddle-ocr-vl-1.5"),
            "PaddleOCR-VL-1.5"
        );
        assert_eq!(normalize_model_name("paddleocr-vl-1.5"), "PaddleOCR-VL-1.5");
        assert_eq!(
            normalize_model_name("paddle-ocr-vl-1.6"),
            "PaddleOCR-VL-1.6"
        );
    }
}
