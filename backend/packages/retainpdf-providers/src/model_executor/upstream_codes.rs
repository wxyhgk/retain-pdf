//! 上游 4xx 响应体里的业务码：429 / 400 / 403 里哪些其实是余额、额度、预算用完（重试没用，整份停下），
//! 哪些才是真限流（照旧按 Retry-After 重试一次）。
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
];
const OPENCODE_QUOTA_MESSAGES: &[(&str, &str)] =
    &[("policy budget exceeded", "policy_budget_exceeded")];
const FREE_TIER_MARKERS: &[&str] = &["free tier", "free quota", "free allocated", "免费额度"];

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
        let Some(code) = find(OPENAI_QUOTA_CODES, code) else {
            continue;
        };
        if provider == Provider::Qwen && code == "insufficient_quota" {
            // 百炼的 insufficient_quota 是 TPM 限流（Throttling.AllocationQuota），只有说免费额度用完的才是额度
            if FREE_TIER_MARKERS.iter().any(|m| lowered.contains(m)) {
                return quota(code);
            }
            return None;
        }
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
}
