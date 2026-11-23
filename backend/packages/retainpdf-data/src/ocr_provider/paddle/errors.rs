use std::error::Error;
use std::fmt;

use reqwest::StatusCode;
use serde::Deserialize;

use crate::ocr_provider::types::{OcrErrorCategory, OcrProviderErrorInfo};

#[derive(Debug, Clone)]
pub struct PaddleProviderError {
    stage: &'static str,
    detail: String,
    info: OcrProviderErrorInfo,
    /// 请求没有离开本机：连接没建起来或请求没构造出来。
    not_sent: bool,
}

impl PaddleProviderError {
    pub fn request_failed(
        stage: &'static str,
        err: &reqwest::Error,
        trace_id: Option<&str>,
    ) -> Self {
        if let Some(status) = err.status() {
            return Self::http_status(
                stage,
                status,
                &err.to_string(),
                trace_id,
                Some("Paddle HTTP 请求返回错误状态"),
            );
        }
        let category = if err.is_timeout() {
            OcrErrorCategory::RemoteReadTimeout
        } else {
            OcrErrorCategory::ServiceUnavailable
        };
        let not_sent = err.is_builder() || (err.is_connect() && !err.is_timeout());
        let mut error = Self::new(
            stage,
            category,
            err.to_string(),
            trace_id,
            None,
            None,
            Some("请检查 Paddle 服务可达性、网络连通性和超时配置"),
        );
        error.not_sent = not_sent;
        error
    }

    pub fn http_status(
        stage: &'static str,
        status: StatusCode,
        body_excerpt: &str,
        trace_id: Option<&str>,
        detail: Option<&str>,
    ) -> Self {
        let parsed_error = parse_paddle_error_body(body_excerpt);
        let provider_code = parsed_error
            .as_ref()
            .and_then(|error| error.code.map(|code| code.to_string()));
        let provider_message = parsed_error
            .as_ref()
            .and_then(|error| error.message())
            .or_else(|| sanitize_body_excerpt(body_excerpt));
        let resolved_trace_id = trace_id
            .map(str::to_string)
            .or_else(|| parsed_error.as_ref().and_then(|error| error.trace_id()));
        let category = provider_code
            .as_deref()
            .and_then(category_for_provider_code)
            .unwrap_or_else(|| match status {
                StatusCode::UNAUTHORIZED => OcrErrorCategory::Unauthorized,
                StatusCode::FORBIDDEN => OcrErrorCategory::PermissionDenied,
                StatusCode::REQUEST_TIMEOUT | StatusCode::GATEWAY_TIMEOUT => {
                    OcrErrorCategory::RemoteReadTimeout
                }
                StatusCode::BAD_REQUEST
                | StatusCode::UNPROCESSABLE_ENTITY
                | StatusCode::METHOD_NOT_ALLOWED => OcrErrorCategory::InvalidRequest,
                StatusCode::TOO_MANY_REQUESTS => OcrErrorCategory::QueueFull,
                StatusCode::SERVICE_UNAVAILABLE | StatusCode::BAD_GATEWAY => {
                    OcrErrorCategory::ServiceUnavailable
                }
                _ if status.is_server_error() => OcrErrorCategory::ServiceUnavailable,
                _ => OcrErrorCategory::HttpStatus,
            });
        let message = format!(
            "HTTP {}{}",
            status.as_u16(),
            sanitize_body_excerpt(body_excerpt)
                .map(|text| format!(": {text}"))
                .unwrap_or_default()
        );
        Self::new(
            stage,
            category,
            detail.unwrap_or("Paddle HTTP 请求失败").to_string(),
            resolved_trace_id.as_deref(),
            provider_code,
            provider_message.or(Some(message)),
            Some("请检查 Paddle API 地址、Token 和服务状态"),
        )
        .with_http_status(status.as_u16())
    }

    pub fn provider_error(
        stage: &'static str,
        provider_code: i64,
        provider_message: &str,
        trace_id: Option<&str>,
    ) -> Self {
        let category =
            category_for_provider_code(&provider_code.to_string()).unwrap_or(match provider_code {
                401 | 403 => OcrErrorCategory::Unauthorized,
                404 => OcrErrorCategory::TaskNotFound,
                408 => OcrErrorCategory::RemoteReadTimeout,
                409 => OcrErrorCategory::OperationNotAllowed,
                429 => OcrErrorCategory::QueueFull,
                code if code >= 500 => OcrErrorCategory::ServiceUnavailable,
                _ => OcrErrorCategory::ProviderFailed,
            });
        Self::new(
            stage,
            category,
            format!("Paddle 返回 errorCode={provider_code}"),
            trace_id,
            Some(provider_code.to_string()),
            Some(provider_message.trim().to_string()),
            Some("请结合 Paddle provider_message 和 trace_id 排查"),
        )
    }

    pub fn invalid_response(
        stage: &'static str,
        detail: impl Into<String>,
        trace_id: Option<&str>,
    ) -> Self {
        Self::new(
            stage,
            OcrErrorCategory::InvalidProviderResponse,
            detail.into(),
            trace_id,
            None,
            None,
            Some("请检查 Paddle 返回结构是否完整，重点确认 data/jobId/resultUrl.jsonUrl"),
        )
    }

    /// 轮询到 state=failed（官方：GET 返回 code=11003、HTTP 200，原因在 data.errorMsg）：Paddle 解析这份文件失败。
    /// 归 `ParseFailed`（以前是 `ProviderFailed`，任务失败落 unknown），任务失败落 `ocr_provider_failed`，summary 带 errorMsg。
    pub fn provider_failed(provider_message: &str, trace_id: Option<&str>) -> Self {
        Self::new(
            "poll",
            OcrErrorCategory::ParseFailed,
            "Paddle 任务执行失败".to_string(),
            trace_id,
            None,
            Some(provider_message.trim().to_string()),
            Some("PaddleOCR 解析这份文件失败，可以重试一次；仍失败请换用其他 OCR"),
        )
    }

    /// 查询返回包里直接带着 11003（HTTP 200）：同 [`Self::provider_failed`]，另记下业务码。
    pub fn task_failed_with_code(
        provider_code: i64,
        provider_message: &str,
        trace_id: Option<&str>,
    ) -> Self {
        let mut error = Self::provider_failed(provider_message, trace_id);
        error.info.provider_code = Some(provider_code.to_string());
        error
    }

    pub fn result_download_failed(
        detail: impl Into<String>,
        trace_id: Option<&str>,
        http_status: Option<u16>,
    ) -> Self {
        Self::new(
            "download",
            OcrErrorCategory::ResultDownloadFailed,
            detail.into(),
            trace_id,
            None,
            None,
            Some("请检查 Paddle jsonUrl 是否可访问，或稍后重试"),
        )
        .with_http_status_opt(http_status)
    }

    pub fn result_unpack_failed(detail: impl Into<String>, trace_id: Option<&str>) -> Self {
        Self::new(
            "download",
            OcrErrorCategory::ResultUnpackFailed,
            detail.into(),
            trace_id,
            None,
            None,
            Some("请检查 Paddle JSONL 返回内容是否完整且每行均为合法 JSON"),
        )
    }

    pub fn poll_timeout(job_id: &str) -> Self {
        Self::new(
            "poll",
            OcrErrorCategory::PollTimeout,
            format!("Timed out waiting for Paddle task {job_id}"),
            None,
            None,
            None,
            Some("请检查 Paddle 任务是否长时间卡住，或适当增大轮询超时时间"),
        )
    }

    pub fn info(&self) -> &OcrProviderErrorInfo {
        &self.info
    }

    /// 请求确定没有离开本机（连接没建起来、请求没构造出来）。
    pub fn request_not_sent(&self) -> bool {
        self.not_sent
    }

    /// 提交确定没有建出任务：请求没发出去、服务商明确拒绝（4xx、鉴权 / 参数 / 额度 / 排队已满），
    /// 或者提交收到 HTTP 500（官方：服务端系统内部错误，没有收下任务）。
    pub fn submit_definitely_rejected(&self) -> bool {
        self.not_sent
            || self.info.is_definite_refusal()
            || (self.stage == "submit" && self.info.http_status == Some(500))
    }

    /// 提交被服务端明确拒收、等一会儿再交可能就好：排队已满（10010）、请求太快（429 / 12002）、
    /// 服务端内部错误（HTTP 500）。都没有建出任务，退避后重交不会重复计费。
    pub fn submit_retryable(&self) -> bool {
        self.stage == "submit"
            && (matches!(self.info.category, OcrErrorCategory::QueueFull)
                || self.info.http_status == Some(500))
    }

    /// 轮询被限流（HTTP 429 / 12002）：退避后再查。查询是幂等的。
    pub fn poll_rate_limited(&self) -> bool {
        self.stage == "poll"
            && (self.info.http_status == Some(429)
                || self.info.provider_code.as_deref() == Some("12002"))
    }

    pub fn stage_detail(&self) -> String {
        let prefix = match self.stage {
            "submit" => "Paddle 提交失败",
            "poll" => "Paddle 轮询失败",
            "download" => "Paddle 结果下载失败",
            _ => "Paddle provider 失败",
        };
        let message = self
            .info
            .provider_message
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(self.detail.as_str());
        let trace_suffix = self
            .info
            .trace_id
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .map(|value| format!(" trace_id={value}"))
            .unwrap_or_default();
        format!("{prefix}: {message}{trace_suffix}")
    }

    fn new(
        stage: &'static str,
        category: OcrErrorCategory,
        detail: String,
        trace_id: Option<&str>,
        provider_code: Option<String>,
        provider_message: Option<String>,
        operator_hint: Option<&str>,
    ) -> Self {
        Self {
            stage,
            detail,
            info: OcrProviderErrorInfo {
                category,
                provider_code,
                provider_message,
                operator_hint: operator_hint.map(str::to_string),
                trace_id: trace_id
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string),
                http_status: None,
            },
            not_sent: false,
        }
    }

    fn with_http_status(mut self, http_status: u16) -> Self {
        self.info.http_status = Some(http_status);
        self
    }

    fn with_http_status_opt(mut self, http_status: Option<u16>) -> Self {
        self.info.http_status = http_status;
        self
    }
}

impl fmt::Display for PaddleProviderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.detail)
    }
}

impl Error for PaddleProviderError {}

fn sanitize_body_excerpt(text: &str) -> Option<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    let single_line = trimmed.replace('\n', " ");
    let excerpt: String = single_line.chars().take(180).collect();
    Some(excerpt)
}

/// 官方异步接口：任务解析失败（HTTP 200，原因在 data.errorMsg，data.state=failed）。
pub const PADDLE_TASK_FAILED_CODE: i64 = 11003;

fn category_for_provider_code(code: &str) -> Option<OcrErrorCategory> {
    match code.trim() {
        // 官方异步接口的业务码（2026-11-23 按错误码目录补齐）：
        // 10001 空文件、10003 太大、10004 格式不支持、10005 无法解析、10006 页数超限 —— 换文件；
        // 10002、10007–10009 请求参数不对；11001 任务不存在、11002 任务过期、11003 解析失败；12002 请求太快。
        "10001" => Some(OcrErrorCategory::EmptyFile),
        "10003" => Some(OcrErrorCategory::FileTooLarge),
        "10004" => Some(OcrErrorCategory::UnsupportedFileFormat),
        "10005" => Some(OcrErrorCategory::FileReadFailed),
        "10006" => Some(OcrErrorCategory::TooManyPages),
        "10002" | "10007" | "10008" | "10009" => Some(OcrErrorCategory::InvalidRequest),
        "11001" => Some(OcrErrorCategory::TaskNotFound),
        "11002" => Some(OcrErrorCategory::TaskExpired),
        "11003" => Some(OcrErrorCategory::ParseFailed),
        "10010" | "429" | "12002" => Some(OcrErrorCategory::QueueFull),
        // 当日解析页数额度用完（官方异步接口，HTTP 403）。不能按 403 归成没权限：用户会以为 Token 不对。
        "12001" => Some(OcrErrorCategory::QuotaExceeded),
        "401" | "403" => Some(OcrErrorCategory::Unauthorized),
        "404" => Some(OcrErrorCategory::TaskNotFound),
        "408" => Some(OcrErrorCategory::RemoteReadTimeout),
        "409" => Some(OcrErrorCategory::OperationNotAllowed),
        _ => None,
    }
}

#[derive(Debug, Deserialize)]
struct PaddleErrorBody {
    #[serde(default, alias = "errorCode")]
    code: Option<i64>,
    #[serde(default, alias = "errorMsg", alias = "message")]
    msg: Option<String>,
    #[serde(default, rename = "traceId", alias = "logId")]
    trace_id: Option<String>,
}

impl PaddleErrorBody {
    fn message(&self) -> Option<String> {
        self.msg
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    }

    fn trace_id(&self) -> Option<String> {
        self.trace_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    }
}

fn parse_paddle_error_body(text: &str) -> Option<PaddleErrorBody> {
    serde_json::from_str::<PaddleErrorBody>(text.trim()).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn http_status_maps_unauthorized() {
        let err = PaddleProviderError::http_status(
            "submit",
            StatusCode::UNAUTHORIZED,
            r#"{"message":"bad token"}"#,
            Some("trace-1"),
            None,
        );

        assert_eq!(err.info().category, OcrErrorCategory::Unauthorized);
        assert_eq!(err.info().http_status, Some(401));
        assert_eq!(err.info().trace_id.as_deref(), Some("trace-1"));
    }

    #[test]
    fn provider_error_preserves_code_and_message() {
        let err = PaddleProviderError::provider_error("poll", 429, "busy", Some("trace-2"));

        assert_eq!(err.info().category, OcrErrorCategory::QueueFull);
        assert_eq!(err.info().provider_code.as_deref(), Some("429"));
        assert_eq!(err.info().provider_message.as_deref(), Some("busy"));
    }

    #[test]
    fn http_status_extracts_paddle_queue_full_body() {
        let err = PaddleProviderError::http_status(
            "submit",
            StatusCode::BAD_REQUEST,
            r#"{"traceId":"trace-queue","code":10010,"msg":"任务提交队列已满，请稍后重试"}"#,
            None,
            None,
        );

        assert_eq!(err.info().category, OcrErrorCategory::QueueFull);
        assert_eq!(err.info().http_status, Some(400));
        assert_eq!(err.info().provider_code.as_deref(), Some("10010"));
        assert_eq!(
            err.info().provider_message.as_deref(),
            Some("任务提交队列已满，请稍后重试")
        );
        assert_eq!(err.info().trace_id.as_deref(), Some("trace-queue"));
        assert!(err.stage_detail().contains("任务提交队列已满"));
    }

    /// 官方文档：403 + {"code":12001,"msg":…} 是当日额度用完，不是 Token 不对。
    /// 字段名是 code/msg/traceId，旧写法 errorCode/errorMsg/logId 也认。
    #[test]
    fn http_403_with_daily_quota_code_is_quota_not_permission() {
        for body in [
            r#"{"traceId":"trace-q","code":12001,"msg":"今日解析页数额度已用完"}"#,
            r#"{"logId":"trace-q","errorCode":12001,"errorMsg":"今日解析页数额度已用完"}"#,
        ] {
            let err = PaddleProviderError::http_status("submit", StatusCode::FORBIDDEN, body, None, None);
            assert_eq!(err.info().category, OcrErrorCategory::QuotaExceeded, "{body}");
            assert_eq!(err.info().http_status, Some(403));
            assert_eq!(err.info().provider_code.as_deref(), Some("12001"));
            assert_eq!(err.info().trace_id.as_deref(), Some("trace-q"));
            assert!(err.stage_detail().contains("今日解析页数额度已用完"));
        }
        // HTTP 200 包里的业务码走 provider_error，也一样
        let err = PaddleProviderError::provider_error("submit", 12001, "额度已用完", None);
        assert_eq!(err.info().category, OcrErrorCategory::QuotaExceeded);
        // 不带业务码的 403 照旧是没权限
        let err = PaddleProviderError::http_status("submit", StatusCode::FORBIDDEN, "forbidden", None, None);
        assert_eq!(err.info().category, OcrErrorCategory::PermissionDenied);
    }

    /// 官方异步接口的业务码各归各类（2026-11-23）：换文件的、参数不对的、过期、解析失败、排队已满。
    #[test]
    fn async_business_codes_map_to_their_categories() {
        for (code, category) in [
            (10001, OcrErrorCategory::EmptyFile),
            (10002, OcrErrorCategory::InvalidRequest),
            (10003, OcrErrorCategory::FileTooLarge),
            (10004, OcrErrorCategory::UnsupportedFileFormat),
            (10005, OcrErrorCategory::FileReadFailed),
            (10006, OcrErrorCategory::TooManyPages),
            (10007, OcrErrorCategory::InvalidRequest),
            (10008, OcrErrorCategory::InvalidRequest),
            (10009, OcrErrorCategory::InvalidRequest),
            (10010, OcrErrorCategory::QueueFull),
            (11001, OcrErrorCategory::TaskNotFound),
            (11002, OcrErrorCategory::TaskExpired),
            (11003, OcrErrorCategory::ParseFailed),
            (12002, OcrErrorCategory::QueueFull),
        ] {
            let body = format!(r#"{{"traceId":"t","code":{code},"msg":"说明 {code}"}}"#);
            let err = PaddleProviderError::http_status("submit", StatusCode::BAD_REQUEST, &body, None, None);
            assert_eq!(err.info().category, category, "{code}");
            assert_eq!(err.info().provider_code.as_deref(), Some(code.to_string().as_str()));
            assert_eq!(err.info().provider_message.as_deref(), Some(format!("说明 {code}").as_str()));
            let err = PaddleProviderError::provider_error("poll", code, "说明", None);
            assert_eq!(err.info().category, category, "{code} via envelope");
        }
    }

    /// 只有提交阶段的排队已满、限流、HTTP 500 才在提交处重交；500 也算服务商没收下任务。
    #[test]
    fn submit_retry_and_refusal_rules() {
        let queue_full = PaddleProviderError::provider_error("submit", 10010, "任务提交队列已满", None);
        assert!(queue_full.submit_retryable());
        assert!(queue_full.submit_definitely_rejected());
        let server = PaddleProviderError::http_status("submit", StatusCode::INTERNAL_SERVER_ERROR, "{}", None, None);
        assert!(server.submit_retryable());
        assert!(server.submit_definitely_rejected());
        let file = PaddleProviderError::provider_error("submit", 10003, "too large", None);
        assert!(!file.submit_retryable());
        assert!(file.submit_definitely_rejected());
        let gateway = PaddleProviderError::http_status("submit", StatusCode::BAD_GATEWAY, "", None, None);
        assert!(!gateway.submit_retryable(), "502 可能是网关断了，服务商有没有收下说不清");
        assert!(!gateway.submit_definitely_rejected());
        let poll_server = PaddleProviderError::http_status("poll", StatusCode::INTERNAL_SERVER_ERROR, "", None, None);
        assert!(!poll_server.submit_retryable());
        let limited = PaddleProviderError::http_status(
            "poll",
            StatusCode::TOO_MANY_REQUESTS,
            r#"{"code":12002,"msg":"请求频率过高"}"#,
            None,
            None,
        );
        assert!(limited.poll_rate_limited());
        assert!(!queue_full.poll_rate_limited());
    }

    #[test]
    fn failed_task_is_a_parse_failure_with_the_providers_reason() {
        let err = PaddleProviderError::provider_failed(" 页面解析出错 ", Some("trace-f"));
        assert_eq!(err.info().category, OcrErrorCategory::ParseFailed);
        assert_eq!(err.info().provider_code, None, "state=failed 本身不带业务码，不编一个");
        assert_eq!(err.info().provider_message.as_deref(), Some("页面解析出错"));
        assert!(err.stage_detail().contains("页面解析出错"));
        let err = PaddleProviderError::task_failed_with_code(PADDLE_TASK_FAILED_CODE, "页面解析出错", None);
        assert_eq!(err.info().category, OcrErrorCategory::ParseFailed);
        assert_eq!(err.info().provider_code.as_deref(), Some("11003"));
    }

    #[test]
    fn poll_timeout_uses_poll_timeout_category() {
        let err = PaddleProviderError::poll_timeout("job-1");

        assert_eq!(err.info().category, OcrErrorCategory::PollTimeout);
        assert!(err.to_string().contains("job-1"));
    }
}
