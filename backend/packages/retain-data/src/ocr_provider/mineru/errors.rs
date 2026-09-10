use once_cell::sync::Lazy;
use regex::Regex;

use crate::ocr_provider::mineru::models::parse_envelope_fragment;
use crate::ocr_provider::types::{OcrErrorCategory, OcrProviderErrorInfo};

static PROVIDER_CODE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"A\d{4}|-\d{3,5}").unwrap());

fn make_error(
    category: OcrErrorCategory,
    provider_code: Option<&str>,
    provider_message: impl Into<String>,
    operator_hint: Option<&str>,
    trace_id: Option<&str>,
) -> OcrProviderErrorInfo {
    OcrProviderErrorInfo {
        category,
        provider_code: provider_code.map(str::to_string),
        provider_message: Some(provider_message.into()),
        operator_hint: operator_hint.map(str::to_string),
        trace_id: trace_id.map(str::to_string),
        http_status: None,
    }
}

pub fn extract_provider_error_code(text: &str) -> Option<String> {
    if let Some(envelope) = parse_envelope_fragment(text) {
        match envelope.code {
            serde_json::Value::String(value) => {
                let trimmed = value.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
            serde_json::Value::Number(value) => return Some(value.to_string()),
            _ => {}
        }
    }
    PROVIDER_CODE_RE.find(text).map(|m| m.as_str().to_string())
}

pub fn extract_provider_trace_id(text: &str) -> Option<String> {
    let envelope = parse_envelope_fragment(text)?;
    let trace = envelope.trace_id.trim();
    if trace.is_empty() {
        return None;
    }
    Some(trace.to_string())
}

pub fn extract_provider_message(text: &str) -> Option<String> {
    if let Some(envelope) = parse_envelope_fragment(text) {
        let msg = envelope.msg.trim();
        if !msg.is_empty() {
            return Some(msg.to_string());
        }
    }
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_string())
}

pub fn map_provider_error_code(
    provider_code: &str,
    provider_message: impl Into<String>,
    trace_id: Option<&str>,
) -> OcrProviderErrorInfo {
    let message = provider_message.into();
    match provider_code.trim() {
        "A0202" => make_error(
            OcrErrorCategory::Unauthorized,
            Some("A0202"),
            message,
            Some("检查 Token 是否正确，请检查是否有Bearer前缀 或者更换新 Token"),
            trace_id,
        ),
        "A0211" => make_error(
            OcrErrorCategory::CredentialExpired,
            Some("A0211"),
            message,
            Some("更换新 Token"),
            trace_id,
        ),
        "-500" => make_error(
            OcrErrorCategory::InvalidRequest,
            Some("-500"),
            message,
            Some("请确保参数类型及Content-Type正确"),
            trace_id,
        ),
        "-10001" => make_error(
            OcrErrorCategory::ServiceUnavailable,
            Some("-10001"),
            message,
            Some("请稍后再试"),
            trace_id,
        ),
        "-10002" => make_error(
            OcrErrorCategory::InvalidRequest,
            Some("-10002"),
            message,
            Some("检查请求参数格式"),
            trace_id,
        ),
        "-60001" => make_error(
            OcrErrorCategory::UploadLinkRequestFailed,
            Some("-60001"),
            message,
            Some("请稍后再试"),
            trace_id,
        ),
        "-60002" => make_error(
            OcrErrorCategory::UnsupportedFileFormat,
            Some("-60002"),
            message,
            Some("检测文件类型失败，请求的文件名及链接中带有正确的后缀名，且文件为 pdf,doc,docx,ppt,pptx,png,jp(e)g 中的一种"),
            trace_id,
        ),
        "-60003" => make_error(
            OcrErrorCategory::FileReadFailed,
            Some("-60003"),
            message,
            Some("请检查文件是否损坏并重新上传"),
            trace_id,
        ),
        "-60004" => make_error(
            OcrErrorCategory::EmptyFile,
            Some("-60004"),
            message,
            Some("请上传有效文件"),
            trace_id,
        ),
        "-60005" => make_error(
            OcrErrorCategory::FileTooLarge,
            Some("-60005"),
            message,
            Some("检查文件大小，最大支持 200MB"),
            trace_id,
        ),
        "-60006" => make_error(
            OcrErrorCategory::TooManyPages,
            Some("-60006"),
            message,
            Some("请拆分文件后重试"),
            trace_id,
        ),
        "-60007" => make_error(
            OcrErrorCategory::ServiceUnavailable,
            Some("-60007"),
            message,
            Some("请稍后重试或联系技术支持"),
            trace_id,
        ),
        "-60008" => make_error(
            OcrErrorCategory::RemoteReadTimeout,
            Some("-60008"),
            message,
            Some("检查 URL 可访问"),
            trace_id,
        ),
        "-60009" => make_error(
            OcrErrorCategory::QueueFull,
            Some("-60009"),
            message,
            Some("请稍后再试"),
            trace_id,
        ),
        "-60010" => make_error(
            OcrErrorCategory::ParseFailed,
            Some("-60010"),
            message,
            Some("请稍后再试"),
            trace_id,
        ),
        "-60011" => make_error(
            OcrErrorCategory::UploadedFileMissing,
            Some("-60011"),
            message,
            Some("请确保文件已上传"),
            trace_id,
        ),
        "-60012" => make_error(
            OcrErrorCategory::TaskNotFound,
            Some("-60012"),
            message,
            Some("请确保task_id有效且未删除"),
            trace_id,
        ),
        "-60013" => make_error(
            OcrErrorCategory::PermissionDenied,
            Some("-60013"),
            message,
            Some("只能访问自己提交的任务"),
            trace_id,
        ),
        "-60014" => make_error(
            OcrErrorCategory::OperationNotAllowed,
            Some("-60014"),
            message,
            Some("运行中的任务暂不支持删除"),
            trace_id,
        ),
        "-60015" => make_error(
            OcrErrorCategory::ConversionFailed,
            Some("-60015"),
            message,
            Some("可以手动转为pdf再上传"),
            trace_id,
        ),
        "-60016" => make_error(
            OcrErrorCategory::ConversionFailed,
            Some("-60016"),
            message,
            Some("文件转换为指定格式失败，可以尝试其他格式导出或重试"),
            trace_id,
        ),
        "-60017" => make_error(
            OcrErrorCategory::RetryLimitReached,
            Some("-60017"),
            message,
            Some("等后续模型升级后重试"),
            trace_id,
        ),
        "-60018" => make_error(
            OcrErrorCategory::QuotaExceeded,
            Some("-60018"),
            message,
            Some("明日再来"),
            trace_id,
        ),
        "-60019" => make_error(
            OcrErrorCategory::HtmlQuotaExceeded,
            Some("-60019"),
            message,
            Some("明日再来"),
            trace_id,
        ),
        "-60020" => make_error(
            OcrErrorCategory::FileSplitFailed,
            Some("-60020"),
            message,
            Some("请稍后重试"),
            trace_id,
        ),
        "-60021" => make_error(
            OcrErrorCategory::PageCountReadFailed,
            Some("-60021"),
            message,
            Some("请稍后重试"),
            trace_id,
        ),
        "-60022" => make_error(
            OcrErrorCategory::WebReadFailed,
            Some("-60022"),
            message,
            Some("可能因网络问题或者限频导致读取失败，请稍后重试"),
            trace_id,
        ),
        other => make_error(
            OcrErrorCategory::Unknown,
            Some(other),
            message,
            None,
            trace_id,
        ),
    }
}

pub fn classify_runtime_failure(message: &str, trace_id: Option<&str>) -> OcrProviderErrorInfo {
    let provider_message = extract_provider_message(message).unwrap_or_else(|| message.to_string());
    let resolved_trace_id = trace_id
        .map(str::to_string)
        .or_else(|| extract_provider_trace_id(message))
        .unwrap_or_default();
    let trace_ref = if resolved_trace_id.is_empty() {
        None
    } else {
        Some(resolved_trace_id.as_str())
    };

    if let Some(code) = extract_provider_error_code(message) {
        return map_provider_error_code(&code, provider_message, trace_ref);
    }
    let lowered = message.to_ascii_lowercase();
    if lowered.contains("timed out") || lowered.contains("timeout") {
        return make_error(
            OcrErrorCategory::PollTimeout,
            None,
            provider_message,
            Some("请检查 MinerU 任务是否长时间卡住，或适当增大轮询超时时间"),
            trace_ref,
        );
    }
    if lowered.contains("upload") {
        return make_error(
            OcrErrorCategory::UploadFailed,
            None,
            provider_message,
            Some("请检查上传链接是否有效，或重新申请上传 URL 后再试"),
            trace_ref,
        );
    }
    if lowered.contains("full_zip_url") || lowered.contains("missing field") {
        return make_error(
            OcrErrorCategory::InvalidProviderResponse,
            None,
            provider_message,
            Some("请检查 provider 返回结构是否完整，重点确认 full_zip_url 等关键字段"),
            trace_ref,
        );
    }
    make_error(
        OcrErrorCategory::ProviderFailed,
        None,
        provider_message,
        Some("请结合 provider 原始 message、trace_id 和任务状态继续排查"),
        trace_ref,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ocr_provider::types::OcrErrorCategory;

    #[test]
    fn maps_readme_codes_60004_to_60022() {
        let cases = [
            ("-60004", OcrErrorCategory::EmptyFile, "请上传有效文件"),
            (
                "-60005",
                OcrErrorCategory::FileTooLarge,
                "检查文件大小，最大支持 200MB",
            ),
            ("-60006", OcrErrorCategory::TooManyPages, "请拆分文件后重试"),
            (
                "-60007",
                OcrErrorCategory::ServiceUnavailable,
                "请稍后重试或联系技术支持",
            ),
            (
                "-60008",
                OcrErrorCategory::RemoteReadTimeout,
                "检查 URL 可访问",
            ),
            ("-60009", OcrErrorCategory::QueueFull, "请稍后再试"),
            ("-60010", OcrErrorCategory::ParseFailed, "请稍后再试"),
            (
                "-60011",
                OcrErrorCategory::UploadedFileMissing,
                "请确保文件已上传",
            ),
            (
                "-60012",
                OcrErrorCategory::TaskNotFound,
                "请确保task_id有效且未删除",
            ),
            (
                "-60013",
                OcrErrorCategory::PermissionDenied,
                "只能访问自己提交的任务",
            ),
            (
                "-60014",
                OcrErrorCategory::OperationNotAllowed,
                "运行中的任务暂不支持删除",
            ),
            (
                "-60015",
                OcrErrorCategory::ConversionFailed,
                "可以手动转为pdf再上传",
            ),
            (
                "-60016",
                OcrErrorCategory::ConversionFailed,
                "文件转换为指定格式失败，可以尝试其他格式导出或重试",
            ),
            (
                "-60017",
                OcrErrorCategory::RetryLimitReached,
                "等后续模型升级后重试",
            ),
            ("-60018", OcrErrorCategory::QuotaExceeded, "明日再来"),
            ("-60019", OcrErrorCategory::HtmlQuotaExceeded, "明日再来"),
            ("-60020", OcrErrorCategory::FileSplitFailed, "请稍后重试"),
            (
                "-60021",
                OcrErrorCategory::PageCountReadFailed,
                "请稍后重试",
            ),
            (
                "-60022",
                OcrErrorCategory::WebReadFailed,
                "可能因网络问题或者限频导致读取失败，请稍后重试",
            ),
        ];
        for (code, category, hint) in cases {
            let mapped = map_provider_error_code(code, "provider says no", Some("trace-1"));
            assert_eq!(mapped.provider_code.as_deref(), Some(code));
            assert_eq!(mapped.category, category, "code={code}");
            assert_eq!(mapped.operator_hint.as_deref(), Some(hint), "code={code}");
            assert_eq!(mapped.trace_id.as_deref(), Some("trace-1"));
            assert_eq!(mapped.provider_message.as_deref(), Some("provider says no"));
        }
    }

    #[test]
    fn extracts_and_maps_code_from_runtime_message() {
        let mapped =
            classify_runtime_failure("MinerU API error -60011: missing upload object", None);
        assert_eq!(mapped.category, OcrErrorCategory::UploadedFileMissing);
        assert_eq!(mapped.provider_code.as_deref(), Some("-60011"));
    }

    #[test]
    fn extracts_trace_and_message_from_embedded_json() {
        let text = r#"requests failed: {"code":-60011,"msg":"获取有效文件失败","trace_id":"trace-xyz","data":null}"#;
        let mapped = classify_runtime_failure(text, None);
        assert_eq!(mapped.provider_code.as_deref(), Some("-60011"));
        assert_eq!(mapped.provider_message.as_deref(), Some("获取有效文件失败"));
        assert_eq!(mapped.trace_id.as_deref(), Some("trace-xyz"));
        assert_eq!(mapped.operator_hint.as_deref(), Some("请确保文件已上传"));
    }
}
