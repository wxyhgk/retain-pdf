//! 上游 4xx 响应体里的业务码：429 / 400 / 403 里哪些其实是余额、额度、预算用完（重试没用，整份停下），
//! 哪些才是真限流（照旧按 Retry-After 重试一次）。2026-11-23 起还认模型不可用（含任何 404）、地区不支持
//! （都整份停下）和内容审核没过（只这一块保留原文，不停任务）。
//!
//! 规则和 Python 请求层的 `backend/translation/retainpdf_translation/llm/shared/upstream_error_codes.py` 一致，
//! 改一边要改另一边（各家的码、区分规则写在那个文件开头）。这里只交回表里的静态码，响应体原文不记、不交回。

use serde_json::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Kind {
    /// 余额、额度、预算、套餐到期：`quota_exhausted`。
    Quota,
    /// Key 的套餐不能用这个模型（智谱 1311、1315）：`authentication_failed`。
    Access,
    /// 模型不存在、没开通，或接口地址写错（任何 404）：`model_unavailable`。
    Model,
    /// 所在地区不支持（OpenAI 403 unsupported_country_region_territory）：`region_unsupported`。
    Region,
    /// 内容审核没过（智谱 1301、千问 DataInspectionFailed 等）：`content_rejected`，不停任务。
    Content,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct Rejection {
    pub kind: Kind,
    /// 表里的码（只认 message 时是认出的那段说法），不是响应体原文。
    pub code: &'static str,
}

impl Rejection {
    pub(super) fn error_code(self) -> &'static str {
        match self.kind {
            Kind::Quota => "quota_exhausted",
            Kind::Access => "authentication_failed",
            Kind::Model => "model_unavailable",
            Kind::Region => "region_unsupported",
            Kind::Content => "content_rejected",
        }
    }
}

const OPENAI_QUOTA_CODES: &[&str] = &[
    "insufficient_quota",
    "credit_balance_exhausted",
    "organization_spend_limit_exceeded",
    "project_spend_limit_exceeded",
    "organization_usage_limit_exceeded",
    "billing_hard_limit_reached",
];
const ANTHROPIC_QUOTA_CODES: &[&str] = &["enforced_spend_limit_reached"];
const ANTHROPIC_QUOTA_MESSAGES: &[(&str, &str)] = &[
    ("credit balance is too low", "credit_balance_too_low"),
    ("reached your specified", "spend_limit_reached"),
];
const ZHIPU_QUOTA_CODES: &[&str] = &[
    "1113", "1308", "1309", "1310", "1313", "1314", "1316", "1317", "1318", "1319", "1320", "1321",
];
const ZHIPU_ACCESS_CODES: &[&str] = &["1311", "1315"];
const QWEN_QUOTA_CODES: &[&str] = &[
    "CommodityNotPurchased",
    "PrepaidBillOverdue",
    "PostpaidBillOverdue",
    "BudgetLimitExceeded",
    "Arrearage",
    "AllocationQuota.FreeTierOnly",
];
const QWEN_QUOTA_MESSAGES: &[(&str, &str)] = &[
    (
        "hour allocated quota exceeded",
        "hour allocated quota exceeded",
    ),
    (
        "week allocated quota exceeded",
        "week allocated quota exceeded",
    ),
    (
        "month allocated quota exceeded",
        "month allocated quota exceeded",
    ),
    (
        "usage allocated quota exceeded",
        "usage allocated quota exceeded",
    ),
];
const OPENCODE_QUOTA_MESSAGES: &[(&str, &str)] =
    &[("policy budget exceeded", "policy_budget_exceeded")];
const FREE_TIER_MARKERS: &[&str] = &[
    "free tier",
    "free quota",
    "free allocated",
    "free trial",
    "quota exhausted",
    "免费额度",
];
const MODEL_CODES: &[&str] = &[
    "model_not_found",
    "not_found_error",
    "ModelNotFound",
    "model_not_supported",
    "WorkSpaceNotFound",
    "Endpoint.AccessDenied",
];
const ZHIPU_MODEL_CODES: &[&str] = &["1211"];
/// 千问笼统的参数错：只有 message 说模型没开通、不存在时才算模型不可用。
const QWEN_MODEL_PARAM_CODE: &str = "invalid_parameter_error";
const MODEL_MISSING_MARKERS: &[&str] = &[
    "not activated",
    "has not been activated",
    "not been opened",
    "未开通",
    "model not exist",
    "model does not exist",
    "model not found",
    "does not exist or you do not have access",
];
const REGION_CODES: &[&str] = &["unsupported_country_region_territory"];
const REGION_MARKERS: &[&str] = &[
    "country, region, or territory not supported",
    "unsupported_country_region_territory",
    "unsupported region",
    "not available in your region",
];
const CONTENT_CODES: &[&str] = &[
    "DataInspectionFailed",
    "data_inspection_failed",
    "FaqRuleBlocked",
    "invalid_prompt",
    "bio_policy",
    "misalignment_policy_violation",
];
const ZHIPU_CONTENT_CODES: &[&str] = &["1301"];

#[derive(Clone, Copy, PartialEq, Eq)]
enum Provider {
    OpenAi,
    Anthropic,
    Zhipu,
    Qwen,
    OpenCode,
    Other,
}

fn provider_of(host: &str) -> Provider {
    let host = host.to_ascii_lowercase();
    if host == "api.openai.com" {
        Provider::OpenAi
    } else if host == "api.anthropic.com" {
        Provider::Anthropic
    } else if host.ends_with("bigmodel.cn") || host == "z.ai" || host.ends_with(".z.ai") {
        Provider::Zhipu
    } else if host.contains("dashscope")
        && (host.ends_with("aliyuncs.com") || host.ends_with("aliyun.com"))
    {
        Provider::Qwen
    } else if host == "opencode.ai" || host.ends_with(".opencode.ai") {
        Provider::OpenCode
    } else {
        Provider::Other
    }
}

fn scalar(value: &Value) -> Option<String> {
    match value {
        Value::String(text) if !text.trim().is_empty() => Some(text.trim().to_owned()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

/// (错误码候选, message, Anthropic 的 details.error_code)。认 `{"error": {...}}` 和顶层 `code`/`message`。
fn error_fields(body: &Value) -> (Vec<String>, String, String) {
    let mut codes = Vec::new();
    let mut message = String::new();
    let mut detail = String::new();
    let mut containers = Vec::new();
    if body["error"].is_object() {
        containers.push(&body["error"]);
    }
    if body.is_object() {
        containers.push(body);
    }
    for container in containers {
        for key in ["code", "type"] {
            if let Some(code) = scalar(&container[key]) {
                codes.push(code);
            }
        }
        if message.is_empty() {
            if let Some(text) = container["message"].as_str() {
                message = text.to_owned();
            }
        }
        if detail.is_empty() {
            if let Some(code) = scalar(&container["details"]["error_code"]) {
                detail = code;
            }
        }
    }
    if message.is_empty() {
        if let Some(text) = body["error"].as_str() {
            message = text.to_owned();
        }
    }
    (codes, message, detail)
}

fn find(table: &'static [&'static str], code: &str) -> Option<&'static str> {
    table.iter().copied().find(|entry| *entry == code)
}

fn marker(table: &'static [(&'static str, &'static str)], text: &str) -> Option<&'static str> {
    table
        .iter()
        .find(|(marker, _)| text.contains(marker))
        .map(|(_, code)| *code)
}

/// 一次上游 4xx 响应是不是「余额、额度用完」或「套餐不能用这个模型」；认不出交回 None（照旧按状态码处理）。
pub(super) fn classify(
    status: u16,
    body: &[u8],
    has_retry_after: bool,
    host: &str,
) -> Option<Rejection> {
    if !(400..500).contains(&status) {
        return None;
    }
    let provider = provider_of(host);
    let text = String::from_utf8_lossy(body);
    let parsed: Value = serde_json::from_slice(body).unwrap_or(Value::Null);
    let (codes, message, detail) = error_fields(&parsed);
    let lowered = format!("{message}\n{text}").to_lowercase();
    let quota = |code| {
        Some(Rejection {
            kind: Kind::Quota,
            code,
        })
    };
    let reject = |kind, code| Some(Rejection { kind, code });

    // 内容审核、地区、模型不可用：各家独有的码，先认（和额度类的码不重叠）
    if provider == Provider::Zhipu {
        for code in &codes {
            if let Some(code) = find(ZHIPU_CONTENT_CODES, code) {
                return reject(Kind::Content, code);
            }
            if let Some(code) = find(ZHIPU_MODEL_CODES, code) {
                return reject(Kind::Model, code);
            }
        }
    }
    for code in &codes {
        if let Some(code) = find(CONTENT_CODES, code) {
            return reject(Kind::Content, code);
        }
    }
    if status == 403 {
        for code in &codes {
            if let Some(code) = find(REGION_CODES, code) {
                return reject(Kind::Region, code);
            }
        }
        if REGION_MARKERS.iter().any(|m| lowered.contains(m)) {
            return reject(Kind::Region, "unsupported_region");
        }
    }
    for code in &codes {
        if let Some(code) = find(MODEL_CODES, code) {
            return reject(Kind::Model, code);
        }
        if code == QWEN_MODEL_PARAM_CODE
            && MODEL_MISSING_MARKERS.iter().any(|m| lowered.contains(m))
        {
            return reject(Kind::Model, QWEN_MODEL_PARAM_CODE);
        }
    }

    if let Some(code) = find(ANTHROPIC_QUOTA_CODES, &detail) {
        return quota(code);
    }
    if detail == "ramp_limit_exceeded" {
        return None;
    }
    if provider == Provider::Zhipu {
        for code in &codes {
            if let Some(code) = find(ZHIPU_ACCESS_CODES, code) {
                return Some(Rejection {
                    kind: Kind::Access,
                    code,
                });
            }
            if let Some(code) = find(ZHIPU_QUOTA_CODES, code) {
                return quota(code);
            }
        }
    }
    for code in &codes {
        if let Some(code) = find(QWEN_QUOTA_CODES, code) {
            return quota(code);
        }
    }
    if let Some(code) = marker(QWEN_QUOTA_MESSAGES, &lowered) {
        return quota(code);
    }
    for code in &codes {
        if code == "Throttling.AllocationQuota"
            || (provider == Provider::Qwen && code == "insufficient_quota")
        {
            // 百炼的 insufficient_quota 是 TPM 限流（Throttling.AllocationQuota），只有说免费额度用完的才是额度
            if FREE_TIER_MARKERS.iter().any(|m| lowered.contains(m)) {
                return quota(if code == "insufficient_quota" {
                    "insufficient_quota"
                } else {
                    "Throttling.AllocationQuota"
                });
            }
            return None;
        }
        let Some(code) = find(OPENAI_QUOTA_CODES, code) else {
            continue;
        };
        return quota(code);
    }
    if let Some(code) = marker(OPENCODE_QUOTA_MESSAGES, &lowered) {
        return quota(code);
    }
    if status == 400 {
        if let Some(code) = marker(ANTHROPIC_QUOTA_MESSAGES, &lowered) {
            return quota(code);
        }
    }
    if status == 429 && provider == Provider::Anthropic && !has_retry_after {
        // 文档：限流的 429 带 retry-after，消费封顶的不带
        return quota("429_without_retry_after");
    }
    if status == 404 {
        // 对话接口回 404：模型名写错 / 没开通，或者接口地址写错。哪种都是配置错，每个请求都会一样被拒
        return reject(Kind::Model, "http_404");
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kind(
        status: u16,
        body: &str,
        retry_after: bool,
        host: &str,
    ) -> Option<(Kind, &'static str)> {
        classify(status, body.as_bytes(), retry_after, host).map(|r| (r.kind, r.code))
    }

    #[test]
    fn quota_codes_stop_rate_limits_do_not() {
        let q = |code| Some((Kind::Quota, code));
        for code in OPENAI_QUOTA_CODES {
            let body = format!(
                r#"{{"error":{{"code":"{code}","type":"insufficient_quota","message":"x"}}}}"#
            );
            assert_eq!(kind(429, &body, true, "api.openai.com"), q(*code));
        }
        assert_eq!(
            kind(
                429,
                r#"{"error":{"code":"rate_limit_exceeded","type":"requests"}}"#,
                true,
                "api.openai.com"
            ),
            None
        );
        assert_eq!(
            kind(
                429,
                r#"{"error":{"message":"Rate limit reached","type":"requests","code":null}}"#,
                true,
                "api.openai.com"
            ),
            None
        );
        // Anthropic
        let spend = r#"{"type":"error","error":{"type":"rate_limit_error","message":"x","details":{"error_code":"enforced_spend_limit_reached"}}}"#;
        assert_eq!(
            kind(429, spend, false, "api.anthropic.com"),
            q("enforced_spend_limit_reached")
        );
        let limited = r#"{"type":"error","error":{"type":"rate_limit_error","message":"Number of requests has exceeded your rate limit"}}"#;
        assert_eq!(kind(429, limited, true, "api.anthropic.com"), None);
        assert_eq!(
            kind(429, limited, false, "api.anthropic.com"),
            q("429_without_retry_after")
        );
        assert_eq!(
            kind(429, limited, false, "relay.example.com"),
            None,
            "只认官方地址的 retry-after 规则"
        );
        let ramp = r#"{"type":"error","error":{"type":"rate_limit_error","message":"x","details":{"error_code":"ramp_limit_exceeded"}}}"#;
        assert_eq!(kind(429, ramp, false, "api.anthropic.com"), None);
        let credit = r#"{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}"#;
        assert_eq!(
            kind(400, credit, false, "api.anthropic.com"),
            q("credit_balance_too_low")
        );
        // 智谱
        assert_eq!(
            kind(
                429,
                r#"{"error":{"code":"1113","message":"余额不足"}}"#,
                false,
                "open.bigmodel.cn"
            ),
            q("1113")
        );
        assert_eq!(
            kind(
                429,
                r#"{"code":1310,"message":"weekly limit"}"#,
                false,
                "api.z.ai"
            ),
            q("1310")
        );
        assert_eq!(
            kind(
                429,
                r#"{"error":{"code":"1311","message":"x"}}"#,
                false,
                "open.bigmodel.cn"
            ),
            Some((Kind::Access, "1311"))
        );
        assert_eq!(
            kind(
                429,
                r#"{"error":{"code":"1302","message":"并发"}}"#,
                false,
                "open.bigmodel.cn"
            ),
            None
        );
        // 千问
        assert_eq!(
            kind(
                429,
                r#"{"error":{"code":"BudgetLimitExceeded","message":"x"}}"#,
                false,
                "dashscope.aliyuncs.com"
            ),
            q("BudgetLimitExceeded")
        );
        assert_eq!(
            kind(
                403,
                r#"{"error":{"code":"Arrearage","type":"Arrearage","message":"Access denied"}}"#,
                false,
                "dashscope.aliyuncs.com"
            ),
            q("Arrearage")
        );
        assert_eq!(
            kind(
                429,
                r#"{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}"#,
                false,
                "dashscope.aliyuncs.com"
            ),
            None
        );
        // OpenCode
        assert_eq!(
            kind(
                429,
                r#"{"error":{"message":"Upstream request failed: Policy budget exceeded"}}"#,
                false,
                "opencode.ai"
            ),
            q("policy_budget_exceeded")
        );
        // 5xx、没码的 429 不管
        assert_eq!(
            kind(
                503,
                r#"{"error":{"code":"insufficient_quota"}}"#,
                false,
                "api.openai.com"
            ),
            None
        );
        assert_eq!(kind(429, "do not log me", true, "127.0.0.1"), None);
    }

    /// 2026-11-23：模型不可用、地区不支持、内容审核没过、千问时段额度（规则和 Python 请求层一致）。
    #[test]
    fn model_region_content_and_qwen_window_quota() {
        let k = |kind, code| Some((kind, code));
        // 模型不可用：各家的码，以及任何 404（接口地址写错也是）
        assert_eq!(
            kind(404, r#"{"error":{"code":"model_not_found","message":"The model `x` does not exist"}}"#, false, "api.openai.com"),
            k(Kind::Model, "model_not_found")
        );
        assert_eq!(
            kind(404, r#"{"type":"error","error":{"type":"not_found_error","message":"model: x"}}"#, false, "api.anthropic.com"),
            k(Kind::Model, "not_found_error")
        );
        for code in ["ModelNotFound", "model_not_supported", "WorkSpaceNotFound"] {
            let body = format!(r#"{{"error":{{"code":"{code}","message":"x"}}}}"#);
            assert_eq!(kind(404, &body, false, "dashscope.aliyuncs.com"), k(Kind::Model, code));
        }
        assert_eq!(
            kind(404, r#"{"error":{"code":"NotFound","message":"x"}}"#, false, "dashscope.aliyuncs.com"),
            k(Kind::Model, "http_404")
        );
        assert_eq!(kind(404, "<html>Not Found</html>", false, "relay.example.com"), k(Kind::Model, "http_404"));
        assert_eq!(
            kind(403, r#"{"error":{"code":"Endpoint.AccessDenied","message":"x"}}"#, false, "dashscope.aliyuncs.com"),
            k(Kind::Model, "Endpoint.AccessDenied")
        );
        assert_eq!(
            kind(400, r#"{"error":{"code":"invalid_parameter_error","message":"Model not exist."}}"#, false, "dashscope.aliyuncs.com"),
            k(Kind::Model, "invalid_parameter_error")
        );
        assert_eq!(
            kind(400, r#"{"error":{"code":"invalid_parameter_error","message":"temperature must be <= 2"}}"#, false, "dashscope.aliyuncs.com"),
            None,
            "千问笼统的参数错不算"
        );
        assert_eq!(
            kind(400, r#"{"error":{"code":"1211","message":"模型不存在"}}"#, false, "open.bigmodel.cn"),
            k(Kind::Model, "1211")
        );
        // 地区
        assert_eq!(
            kind(403, r#"{"error":{"code":"unsupported_country_region_territory","type":"request_forbidden","message":"Country, region, or territory not supported"}}"#, false, "api.openai.com"),
            k(Kind::Region, "unsupported_country_region_territory")
        );
        assert_eq!(
            kind(403, r#"{"error":{"message":"Country, region, or territory not supported"}}"#, false, "api.openai.com"),
            k(Kind::Region, "unsupported_region")
        );
        // 内容审核
        assert_eq!(
            kind(400, r#"{"error":{"code":"1301","message":"敏感内容"}}"#, false, "open.bigmodel.cn"),
            k(Kind::Content, "1301")
        );
        for code in ["DataInspectionFailed", "data_inspection_failed", "FaqRuleBlocked"] {
            let body = format!(r#"{{"error":{{"code":"{code}","message":"x"}}}}"#);
            assert_eq!(kind(400, &body, false, "dashscope.aliyuncs.com"), k(Kind::Content, code));
        }
        assert_eq!(
            kind(400, r#"{"error":{"code":"invalid_prompt","message":"flagged"}}"#, false, "api.openai.com"),
            k(Kind::Content, "invalid_prompt")
        );
        // 千问时段额度、Throttling.AllocationQuota 的免费额度
        assert_eq!(
            kind(429, r#"{"error":{"message":"usage allocated quota exceeded"}}"#, false, "dashscope.aliyuncs.com"),
            k(Kind::Quota, "usage allocated quota exceeded")
        );
        assert_eq!(
            kind(429, r#"{"error":{"message":"hour allocated quota exceeded"}}"#, false, "dashscope.aliyuncs.com"),
            k(Kind::Quota, "hour allocated quota exceeded")
        );
        assert_eq!(
            kind(429, r#"{"code":"Throttling.AllocationQuota","message":"Free allocated quota exceeded."}"#, false, "dashscope.aliyuncs.com"),
            k(Kind::Quota, "Throttling.AllocationQuota")
        );
        assert_eq!(
            kind(429, r#"{"code":"Throttling.AllocationQuota","message":"Allocated quota exceeded, please increase your quota limit."}"#, false, "dashscope.aliyuncs.com"),
            None,
            "TPM 限流照旧退避"
        );
        // error_code 对照
        let model = classify(404, b"{}", false, "api.openai.com").unwrap();
        assert_eq!(model.error_code(), "model_unavailable");
        let content = classify(400, br#"{"error":{"code":"1301"}}"#, false, "open.bigmodel.cn").unwrap();
        assert_eq!(content.error_code(), "content_rejected");
        let region = classify(403, br#"{"error":{"code":"unsupported_country_region_territory"}}"#, false, "api.openai.com").unwrap();
        assert_eq!(region.error_code(), "region_unsupported");
    }
}
