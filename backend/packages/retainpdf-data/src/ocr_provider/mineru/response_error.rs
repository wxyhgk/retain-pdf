use std::fmt;

use serde_json::Value;

use super::errors::map_provider_error_code;
use super::models::MineruApiEnvelope;
use crate::ocr_provider::types::{OcrErrorCategory, OcrProviderErrorInfo};

/// Preserve wire facts across anyhow context layers; retry decisions must not
/// depend on translated messages, filenames, URLs, or trace IDs containing 503.
#[derive(Debug, Clone)]
pub struct MineruResponseError {
    pub info: OcrProviderErrorInfo,
    pub retry_after_secs: Option<u64>,
}

impl MineruResponseError {
    pub fn from_response(status: u16, text: &str, retry_after_secs: Option<u64>) -> Self {
        let envelope = serde_json::from_str::<MineruApiEnvelope<Value>>(text).ok();
        let code = envelope.as_ref().and_then(|e| match &e.code {
            Value::Number(n) if n.as_i64() != Some(0) => Some(n.to_string()),
            Value::String(s) if !s.trim().is_empty() && s.trim() != "0" => {
                Some(s.trim().to_string())
            }
            _ => None,
        });
        let trace = envelope
            .as_ref()
            .map(|e| e.trace_id.trim())
            .filter(|s| !s.is_empty());
        let message = envelope
            .as_ref()
            .map(|e| e.msg.trim())
            .filter(|s| !s.is_empty())
            .unwrap_or("MinerU returned an unsuccessful or invalid response");
        let mut info = if let Some(code) = code {
            map_provider_error_code(&code, message, trace)
        } else {
            OcrProviderErrorInfo {
                category: match status {
                    401 => OcrErrorCategory::Unauthorized,
                    403 => OcrErrorCategory::PermissionDenied,
                    200..=299 => OcrErrorCategory::InvalidProviderResponse,
                    _ => OcrErrorCategory::HttpStatus,
                },
                provider_message: Some(message.to_string()),
                trace_id: trace.map(str::to_owned),
                ..Default::default()
            }
        };
        info.http_status = Some(status);
        Self {
            info,
            retry_after_secs,
        }
    }

    pub fn retryable_query(&self) -> bool {
        if matches!(self.info.http_status, Some(401 | 403 | 404)) {
            return false;
        }
        if self.info.provider_code.is_some() {
            // 官方建议稍后重试的码：-10001、-60007 服务异常，-60009 排队已满，-60008、-60022 读取超时 / 失败，
            // 以及 -60001 生成上传链接失败、-60010 解析失败、-60016 导出失败、-60020 拆分失败、-60021 读页数失败（2026-11-23 补上）。
            return matches!(
                self.info.category,
                OcrErrorCategory::ServiceUnavailable
                    | OcrErrorCategory::QueueFull
                    | OcrErrorCategory::RemoteReadTimeout
                    | OcrErrorCategory::WebReadFailed
                    | OcrErrorCategory::UploadLinkRequestFailed
                    | OcrErrorCategory::ParseFailed
                    | OcrErrorCategory::ExportFailed
                    | OcrErrorCategory::FileSplitFailed
                    | OcrErrorCategory::PageCountReadFailed
            );
        }
        matches!(
            self.info.http_status,
            Some(408 | 429 | 500 | 502 | 503 | 504)
        )
    }
}

impl fmt::Display for MineruResponseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "MinerU HTTP {}",
            self.info.http_status.unwrap_or_default()
        )?;
        if let Some(code) = &self.info.provider_code {
            write!(f, " API error code={code}")?;
        }
        if let Some(message) = &self.info.provider_message {
            write!(f, ": {message}")?;
        }
        if let Some(trace) = &self.info.trace_id {
            write!(f, " trace_id={trace}")?;
        }
        Ok(())
    }
}

impl std::error::Error for MineruResponseError {}

pub fn parse_retry_after(value: Option<&str>) -> Option<u64> {
    let value = value?.trim();
    if let Ok(seconds) = value.parse() {
        return Some(seconds);
    }
    let timestamp = chrono::DateTime::parse_from_rfc2822(value).ok()?;
    let millis = (timestamp.with_timezone(&chrono::Utc) - chrono::Utc::now()).num_milliseconds();
    Some(millis.max(0).saturating_add(999) as u64 / 1000)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_policy_uses_codes_not_message_words() {
        for code in [
            "A0202", "A0211", "-500", "-10002", "-60002", "-60003", "-60004", "-60005", "-60006",
            "-60011", "-60012", "-60013", "-60014", "-60015", "-60017", "-60018", "-60019", "future",
        ] {
            let error = MineruResponseError::from_response(
                200,
                &serde_json::json!({"code":code,"msg":"503 timeout temporary","trace_id":"502"})
                    .to_string(),
                None,
            );
            assert!(!error.retryable_query(), "{code}");
        }
        for code in [
            -10001, -60001, -60007, -60008, -60009, -60010, -60016, -60020, -60021, -60022,
        ] {
            let error = MineruResponseError::from_response(
                200,
                &serde_json::json!({"code":code,"msg":"服务异常","trace_id":"trace-1"}).to_string(),
                None,
            );
            assert!(error.retryable_query(), "{code}");
            assert_eq!(error.info.trace_id.as_deref(), Some("trace-1"));
        }
    }

    #[test]
    fn http_facts_and_retry_after_survive_wrapping() {
        for status in [408, 429, 500, 502, 503, 504] {
            let wrapped = anyhow::Error::new(MineruResponseError::from_response(
                status,
                "upstream",
                Some(9),
            ))
            .context("MinerU query failed");
            let error = wrapped.downcast_ref::<MineruResponseError>().unwrap();
            assert!(error.retryable_query());
            assert_eq!(error.retry_after_secs, Some(9));
        }
        for status in [400, 401, 403, 404, 422] {
            assert!(
                !MineruResponseError::from_response(status, "503 timeout", None).retryable_query()
            );
        }
        let expired =
            MineruResponseError::from_response(503, r#"{"code":"A0211","msg":"expired"}"#, None);
        assert!(!expired.retryable_query());
    }

    #[test]
    fn retry_after_accepts_seconds_and_http_dates() {
        assert_eq!(parse_retry_after(Some(" 12 ")), Some(12));
        assert_eq!(parse_retry_after(Some("-1")), None);
        assert_eq!(parse_retry_after(Some("garbage")), None);
        assert_eq!(
            parse_retry_after(Some("Wed, 21 Oct 2015 07:28:00 GMT")),
            Some(0)
        );
        let future = (chrono::Utc::now() + chrono::Duration::seconds(60)).to_rfc2822();
        assert!(matches!(parse_retry_after(Some(&future)), Some(59..=60)));
    }
}
