use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct JobFailureInfo {
    pub stage: String,
    pub category: String,
    pub code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failed_stage: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failure_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failure_category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_stage: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_code: Option<String>,
    pub summary: String,
    pub root_cause: Option<String>,
    pub retryable: bool,
    pub upstream_host: Option<String>,
    pub provider: Option<String>,
    pub suggestion: Option<String>,
    pub last_log_line: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub raw_excerpt: Option<String>,
    pub raw_error_excerpt: Option<String>,
    pub raw_diagnostic: Option<JobRawDiagnostic>,
    pub ai_diagnostic: Option<JobAiDiagnostic>,
}

impl JobFailureInfo {
    pub fn with_formal_fields(mut self) -> Self {
        if self
            .failed_stage
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .is_empty()
            && !self.stage.trim().is_empty()
        {
            self.failed_stage = Some(self.stage.clone());
        }
        if self
            .failure_code
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .is_empty()
            && !self.category.trim().is_empty()
        {
            self.failure_code = Some(self.category.clone());
        }
        if self
            .provider_code
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .is_empty()
            && self.code.as_deref().map(str::trim).unwrap_or("") != ""
        {
            self.provider_code = self.code.clone();
        }
        if self
            .raw_excerpt
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .is_empty()
            && self
                .raw_error_excerpt
                .as_deref()
                .map(str::trim)
                .unwrap_or("")
                != ""
        {
            self.raw_excerpt = self.raw_error_excerpt.clone();
        }
        if self
            .failure_category
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .is_empty()
        {
            let failed_stage = self
                .failed_stage
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or(self.stage.as_str());
            let failure_code = self
                .failure_code
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or(self.category.as_str());
            self.failure_category = infer_failure_category(failure_code, failed_stage);
        }
        self
    }

    pub fn failed_stage_value(&self) -> &str {
        self.failed_stage
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(self.stage.as_str())
    }

    pub fn failure_code_value(&self) -> &str {
        self.failure_code
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(self.category.as_str())
    }

    pub fn from_json_value(value: &Value) -> Option<Self> {
        serde_json::from_value::<Self>(value.clone())
            .ok()
            .map(Self::with_formal_fields)
    }

    pub fn merge_missing_from(mut self, fallback: &Self) -> Self {
        if self.stage.trim().is_empty() {
            self.stage = fallback.stage.clone();
        }
        if self.category.trim().is_empty() {
            self.category = fallback.category.clone();
        }
        if self.summary.trim().is_empty() {
            self.summary = fallback.summary.clone();
        }
        if self.code.is_none() {
            self.code = fallback.code.clone();
        }
        if self.failed_stage.is_none() {
            self.failed_stage = fallback.failed_stage.clone();
        }
        if self.failure_code.is_none() {
            self.failure_code = fallback.failure_code.clone();
        }
        if self.failure_category.is_none() {
            self.failure_category = fallback.failure_category.clone();
        }
        if self.provider_stage.is_none() {
            self.provider_stage = fallback.provider_stage.clone();
        }
        if self.provider_code.is_none() {
            self.provider_code = fallback.provider_code.clone();
        }
        if self.root_cause.is_none() {
            self.root_cause = fallback.root_cause.clone();
        }
        if self.upstream_host.is_none() {
            self.upstream_host = fallback.upstream_host.clone();
        }
        if self.provider.is_none() {
            self.provider = fallback.provider.clone();
        }
        if self.suggestion.is_none() {
            self.suggestion = fallback.suggestion.clone();
        }
        if self.last_log_line.is_none() {
            self.last_log_line = fallback.last_log_line.clone();
        }
        if self.raw_excerpt.is_none() {
            self.raw_excerpt = fallback.raw_excerpt.clone();
        }
        if self.raw_error_excerpt.is_none() {
            self.raw_error_excerpt = fallback.raw_error_excerpt.clone();
        }
        if self.raw_diagnostic.is_none() {
            self.raw_diagnostic = fallback.raw_diagnostic.clone();
        }
        if self.ai_diagnostic.is_none() {
            self.ai_diagnostic = fallback.ai_diagnostic.clone();
        }
        if !self.retryable && fallback.retryable {
            self.retryable = true;
        }
        self.with_formal_fields()
    }

    pub fn write_formal_fields_into_payload(&self, payload: Option<&Value>) -> Value {
        let mut object = match payload {
            Some(Value::Object(map)) => map.clone(),
            _ => Map::new(),
        };
        object.insert(
            "failed_stage".to_string(),
            Value::String(self.failed_stage_value().to_string()),
        );
        object.insert(
            "failure_code".to_string(),
            Value::String(self.failure_code_value().to_string()),
        );
        if let Some(value) = self
            .failure_category
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            object.insert("failure_category".to_string(), Value::String(value.clone()));
        }
        if let Some(value) = self
            .provider_stage
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            object.insert("provider_stage".to_string(), Value::String(value.clone()));
        }
        if let Some(value) = self
            .provider_code
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            object.insert("provider_code".to_string(), Value::String(value.clone()));
        }
        if let Some(value) = self
            .provider
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            object.insert("provider".to_string(), Value::String(value.clone()));
        }
        if !self.summary.trim().is_empty() {
            object.insert("summary".to_string(), Value::String(self.summary.clone()));
        }
        if let Some(value) = self
            .root_cause
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            object.insert("root_cause".to_string(), Value::String(value.clone()));
        }
        object.insert("retryable".to_string(), Value::Bool(self.retryable));
        if let Some(value) = self
            .raw_excerpt
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            object.insert("raw_excerpt".to_string(), Value::String(value.clone()));
        }
        Value::Object(object)
    }
}

fn infer_failure_category(failure_code: &str, failed_stage: &str) -> Option<String> {
    let code = failure_code.trim().to_ascii_lowercase();
    if code.is_empty() {
        return None;
    }

    let category = match code.as_str() {
        "auth_failed" => "auth",
        "dns_resolution_failed" => "network",
        "ocr_request_ambiguous" => "provider",
        "upstream_timeout" => "timeout",
        "rate_limited" => "provider",
        "source_pdf_missing" => "input",
        "placeholder_unstable" => "translation",
        "render_failed" | "typst_dependency_download_failed" => "render",
        "document_schema_validation_failed" => "normalization",
        _ if code.contains("auth") => "auth",
        _ if code.contains("timeout") => "timeout",
        _ if code.contains("dns") || code.contains("network") => "network",
        _ if code.contains("render") || code.contains("typst") => "render",
        _ if code.contains("translat") || code.contains("placeholder") => "translation",
        _ if code.contains("normaliz") || code.contains("schema") => "normalization",
        _ if code.contains("input") || code.contains("missing") => "input",
        _ if code.contains("provider") || code.contains("rate") => "provider",
        _ => match failed_stage.trim().to_ascii_lowercase().as_str() {
            "render" | "rendering" | "render_prepare" => "render",
            "translation" | "translating" | "translation_prepare" => "translation",
            "normalization" | "normalizing" => "normalization",
            "ocr" | "ocr_submitting" | "ocr_processing" => "provider",
            _ => "internal",
        },
    };

    Some(category.to_string())
}

#[cfg(test)]
mod tests {
    use super::JobFailureInfo;
    use serde_json::json;

    #[test]
    fn with_formal_fields_backfills_legacy_failure_fields() {
        let failure = JobFailureInfo {
            stage: "ocr_processing".to_string(),
            category: "auth_failed".to_string(),
            code: Some("A0211".to_string()),
            failed_stage: None,
            failure_code: None,
            failure_category: None,
            provider_stage: None,
            provider_code: None,
            summary: "鉴权失败".to_string(),
            root_cause: None,
            retryable: false,
            upstream_host: None,
            provider: Some("mineru".to_string()),
            suggestion: None,
            last_log_line: None,
            raw_excerpt: None,
            raw_error_excerpt: Some("token expired".to_string()),
            raw_diagnostic: None,
            ai_diagnostic: None,
        }
        .with_formal_fields();

        assert_eq!(failure.failed_stage.as_deref(), Some("ocr_processing"));
        assert_eq!(failure.failure_code.as_deref(), Some("auth_failed"));
        assert_eq!(failure.failure_category.as_deref(), Some("auth"));
        assert_eq!(failure.provider_code.as_deref(), Some("A0211"));
        assert_eq!(failure.raw_excerpt.as_deref(), Some("token expired"));
    }

    #[test]
    fn write_formal_fields_into_payload_preserves_existing_keys() {
        let failure = JobFailureInfo {
            stage: "translation".to_string(),
            category: "upstream_timeout".to_string(),
            code: Some("timeout_504".to_string()),
            failed_stage: Some("translation_prepare".to_string()),
            failure_code: Some("upstream_timeout".to_string()),
            failure_category: Some("timeout".to_string()),
            provider_stage: Some("llm_request".to_string()),
            provider_code: Some("timeout_504".to_string()),
            summary: "请求超时".to_string(),
            root_cause: None,
            retryable: true,
            upstream_host: None,
            provider: Some("deepseek".to_string()),
            suggestion: None,
            last_log_line: None,
            raw_excerpt: None,
            raw_error_excerpt: None,
            raw_diagnostic: None,
            ai_diagnostic: None,
        };

        let payload = failure.write_formal_fields_into_payload(Some(&json!({
            "status": "failed",
            "existing": "keep"
        })));

        assert_eq!(payload["status"], "failed");
        assert_eq!(payload["existing"], "keep");
        assert_eq!(payload["failed_stage"], "translation_prepare");
        assert_eq!(payload["failure_code"], "upstream_timeout");
        assert_eq!(payload["failure_category"], "timeout");
        assert_eq!(payload["provider_stage"], "llm_request");
        assert_eq!(payload["provider_code"], "timeout_504");
        assert_eq!(payload["provider"], "deepseek");
        assert_eq!(payload["summary"], "请求超时");
        assert_eq!(payload["retryable"], true);
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct JobRawDiagnostic {
    pub structured_error_type: Option<String>,
    pub raw_exception_type: Option<String>,
    pub raw_exception_message: Option<String>,
    pub traceback: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct JobAiDiagnostic {
    pub summary: String,
    pub root_cause: Option<String>,
    pub suggestion: Option<String>,
    pub confidence: Option<String>,
    pub observed_signals: Vec<String>,
}
