use serde_json::json;

use super::*;
use UpstreamLimitKind::*;

fn kind(status: u16, body: serde_json::Value, retry_after: bool, host: &str) -> Option<(UpstreamLimitKind, Option<String>)> {
    classify_upstream_limit(status, &body.to_string(), retry_after, host).map(|limit| (limit.kind, limit.code))
}

fn some(kind: UpstreamLimitKind, code: &str) -> Option<(UpstreamLimitKind, Option<String>)> {
    Some((kind, Some(code.to_string())))
}

#[test]
fn business_codes_are_read_from_each_provider_shape() {
    let code = |body: serde_json::Value| upstream_error_code(&body.to_string());
    // OpenAI
    assert_eq!(code(json!({"error": {"message": "You exceeded your current quota", "type": "insufficient_quota", "param": null, "code": "insufficient_quota"}})).as_deref(), Some("insufficient_quota"));
    assert_eq!(code(json!({"error": {"message": "quota", "type": "insufficient_quota", "code": null}})).as_deref(), Some("insufficient_quota"), "只给 type 时用 type");
    // Anthropic：details.error_code 比 type 优先
    assert_eq!(code(json!({"type": "error", "error": {"type": "rate_limit_error", "message": "x", "details": {"error_code": "enforced_spend_limit_reached"}}})).as_deref(), Some("enforced_spend_limit_reached"));
    assert_eq!(code(json!({"type": "error", "error": {"type": "authentication_error", "message": "invalid x-api-key"}})).as_deref(), Some("authentication_error"));
    // 智谱：字符串数字；Z.ai 的顶层数字也认
    assert_eq!(code(json!({"error": {"code": "1113", "message": "余额不足或无可用资源包,请充值。"}})).as_deref(), Some("1113"));
    assert_eq!(code(json!({"code": 1113, "message": "Insufficient balance"})).as_deref(), Some("1113"));
    // 百炼：兼容模式 error.code、原生顶层 code
    assert_eq!(code(json!({"error": {"message": "Access denied, please make sure your account is in good standing.", "type": "Arrearage", "code": "Arrearage"}})).as_deref(), Some("Arrearage"));
    assert_eq!(code(json!({"code": "Throttling.RateQuota", "message": "Requests rate limit exceeded", "request_id": "r"})).as_deref(), Some("Throttling.RateQuota"));
    // OpenCode：只有消息
    assert_eq!(upstream_error_code("Upstream request failed: Policy budget exceeded").as_deref(), Some("Policy budget exceeded"));
    // 没有码
    assert_eq!(code(json!({"error": {"message": "Rate limit reached for requests"}})), None);
    assert_eq!(upstream_error_code(""), None);
    assert_eq!(upstream_error_code("<html>502 Bad Gateway</html>"), None);
}

#[test]
fn openai_429_quota_codes_are_not_rate_limits() {
    let host = "api.openai.com";
    for code in [
        "insufficient_quota",
        "billing_hard_limit_reached",
        "organization_spend_limit_exceeded",
        "project_spend_limit_exceeded",
        "organization_usage_limit_exceeded",
    ] {
        let body = json!({"error": {"message": "m", "type": "insufficient_quota", "code": code}});
        assert_eq!(kind(429, body, false, host), some(Quota, code), "{code}");
    }
    let credit = json!({"error": {"message": "m", "type": "insufficient_quota", "code": "credit_balance_exhausted"}});
    assert_eq!(kind(429, credit, false, host), some(Billing, "credit_balance_exhausted"));
    let plain = json!({"error": {"message": "Rate limit reached for gpt-x on requests per min (RPM)", "type": "requests", "code": "rate_limit_exceeded"}});
    assert_eq!(kind(429, plain, true, host), some(RateLimited, "rate_limit_exceeded"));
    let slow = json!({"error": {"message": "slow down", "type": "rate_limit_error", "code": "slow_down"}});
    assert_eq!(kind(429, slow, false, host), some(RateLimited, "slow_down"));
}

#[test]
fn anthropic_429_tells_spend_cap_from_rate_limit() {
    let host = "api.anthropic.com";
    let capped = json!({"type": "error", "error": {"type": "rate_limit_error", "message": "m", "details": {"error_code": "enforced_spend_limit_reached"}}});
    assert_eq!(kind(429, capped, false, host), some(Quota, "enforced_spend_limit_reached"));
    let ramp = json!({"type": "error", "error": {"type": "rate_limit_error", "message": "m", "details": {"error_code": "ramp_limit_exceeded"}}});
    assert_eq!(kind(429, ramp, true, host), some(RateLimited, "ramp_limit_exceeded"));
    let limited = json!({"type": "error", "error": {"type": "rate_limit_error", "message": "Number of requests has exceeded your rate limit"}});
    assert_eq!(kind(429, limited.clone(), true, host), some(RateLimited, "rate_limit_error"), "有 retry-after 是限流");
    assert_eq!(kind(429, limited.clone(), false, host), some(Quota, "rate_limit_error"), "官方地址没有 retry-after 按封顶");
    assert_eq!(kind(429, limited, false, "relay.example.com"), some(RateLimited, "rate_limit_error"), "第三方的 Anthropic 兼容地址不套这条");
    let billing = json!({"type": "error", "error": {"type": "billing_error", "message": "m"}});
    assert_eq!(kind(402, billing, false, host), some(Billing, "billing_error"));
    let credit = json!({"type": "error", "error": {"type": "invalid_request_error", "message": "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}});
    assert_eq!(kind(400, credit, false, host), some(Billing, "Your credit balance is too low"));
    let self_cap = json!({"type": "error", "error": {"type": "invalid_request_error", "message": "You have reached your specified API usage limits. You will regain access on 2026-12-01 at 00:00 UTC."}});
    assert_eq!(kind(400, self_cap, false, host), some(Quota, "You have reached your specified"));
}

#[test]
fn zhipu_business_codes_decide_the_429() {
    let host = "open.bigmodel.cn";
    let body = |code: &str| json!({"error": {"code": code, "message": "m"}});
    assert_eq!(kind(429, body("1113"), false, host), some(Billing, "1113"));
    for code in ["1309", "1314"] {
        assert_eq!(kind(429, body(code), false, host), some(Billing, code), "{code}");
    }
    for code in ["1308", "1310", "1313", "1316", "1317", "1318", "1319", "1320", "1321"] {
        assert_eq!(kind(429, body(code), false, host), some(Quota, code), "{code}");
    }
    for code in ["1311", "1315"] {
        assert_eq!(kind(429, body(code), false, host), some(PlanRestricted, code), "{code}");
    }
    assert_eq!(kind(429, body("1302"), false, host), some(RateLimited, "1302"));
    assert_eq!(kind(429, body("1305"), false, host), some(Overloaded, "1305"));
    // Z.ai 顶层数字码
    assert_eq!(kind(429, json!({"code": 1113, "message": "Insufficient balance"}), false, "api.z.ai"), some(Billing, "1113"));
    // 401 的鉴权码不归这里
    assert_eq!(kind(401, body("1000"), false, host), None);
}

#[test]
fn dashscope_codes_and_the_ambiguous_insufficient_quota() {
    let host = "dashscope.aliyuncs.com";
    let compat = |code: &str| json!({"error": {"message": "m", "type": code, "code": code}});
    for code in ["CommodityNotPurchased", "PrepaidBillOverdue", "PostpaidBillOverdue"] {
        assert_eq!(kind(429, compat(code), false, host), some(Billing, code), "{code}");
    }
    assert_eq!(kind(429, compat("BudgetLimitExceeded"), false, host), some(Quota, "BudgetLimitExceeded"));
    // Arrearage 是 400 或 403，不是 429，照样认
    assert_eq!(kind(400, compat("Arrearage"), false, host), some(Billing, "Arrearage"));
    assert_eq!(kind(403, compat("Arrearage"), false, host), some(Billing, "Arrearage"));
    assert_eq!(kind(403, compat("AllocationQuota.FreeTierOnly"), false, host), some(Quota, "AllocationQuota.FreeTierOnly"));
    assert_eq!(kind(429, json!({"code": "Throttling.RateQuota", "message": "m"}), false, host), some(RateLimited, "Throttling.RateQuota"));
    assert_eq!(kind(429, json!({"code": "Throttling.ServiceOverloaded", "message": "m"}), false, host), some(Overloaded, "Throttling.ServiceOverloaded"));
    // 百炼的 insufficient_quota 是 TPM 限流；消息说免费额度用完才是额度问题
    let tpm = json!({"error": {"message": "You exceeded your current quota, please check your plan and billing details.", "type": "insufficient_quota", "code": "insufficient_quota"}});
    assert_eq!(kind(429, tpm.clone(), false, host), some(RateLimited, "insufficient_quota"));
    assert_eq!(kind(429, tpm, false, "api.openai.com"), some(Quota, "insufficient_quota"), "同一个码在 OpenAI 是额度用完");
    let free = json!({"error": {"message": "The free tier of the model has been exhausted.", "type": "insufficient_quota", "code": "insufficient_quota"}});
    assert_eq!(kind(429, free, false, host), some(Quota, "insufficient_quota"));
    // Coding Plan 只有消息
    let week = json!({"error": {"message": "week allocated quota exceeded", "type": "x"}});
    assert_eq!(kind(429, week, false, "coding.dashscope.aliyuncs.com"), some(Quota, "week allocated quota exceeded"));
}

#[test]
fn opencode_messages_decide_the_429() {
    let host = "opencode.ai";
    assert_eq!(
        classify_upstream_limit(429, "Upstream request failed: Policy budget exceeded", false, host).map(|l| (l.kind, l.code)),
        some(Quota, "Policy budget exceeded")
    );
    // 包在 Anthropic 风格外壳里，外壳的 type 是笼统的限流：以消息为准
    let wrapped = json!({"type": "error", "error": {"type": "rate_limit_error", "message": "Upstream request failed: Policy budget exceeded"}});
    assert_eq!(kind(429, wrapped, false, host), some(Quota, "Policy budget exceeded"));
    let funds = json!({"error": {"message": "Upstream request failed: Insufficient account funds"}});
    assert_eq!(kind(402, funds, false, host), some(Billing, "Insufficient account funds"));
}

#[test]
fn bare_statuses_and_unrelated_errors() {
    // 光秃秃的 429：照旧当限流
    assert_eq!(kind(429, json!({"error": {"message": "Too many requests"}}), false, "api.deepseek.com"), Some((RateLimited, None)));
    assert_eq!(classify_upstream_limit(429, "", false, "api.deepseek.com").map(|l| (l.kind, l.code)), Some((RateLimited, None)));
    // 没带码的 402：欠费
    let bare_402 = classify_upstream_limit(402, r#"{"error":{"message":"Insufficient Balance"}}"#, false, "api.deepseek.com").unwrap();
    assert_eq!((bare_402.kind, bare_402.code.as_deref()), (Billing, None));
    assert!(!bare_402.reason_zh.is_empty());
    // 别的错误不归这里
    assert_eq!(kind(401, json!({"error": {"message": "bad key", "code": "invalid_api_key"}}), false, "api.openai.com"), None);
    assert_eq!(kind(404, json!({"error": {"message": "m", "code": "model_not_found"}}), false, "api.openai.com"), None);
    assert_eq!(kind(503, json!({"error": {"code": "Throttling.ServiceOverloaded"}}), false, "dashscope.aliyuncs.com"), None, "不是 429 的过载照旧按 5xx");
    assert_eq!(classify_upstream_limit(500, "", false, "x"), None);
}

#[test]
fn every_blocking_code_has_a_reason() {
    for (code, kind, reason) in CODES.iter().chain(PHRASES.iter()) {
        assert_eq!(kind.blocks_use(), !reason.is_empty(), "{code}");
    }
}

/// 这里的码表和错误码目录（`error-codes/llm/*.json`）是同一批官方数据：每个码在目录里都找得到，
/// 归类也对得上（「不能用」的对目录的欠费、额度、没有权限；限流、繁忙对限流、繁忙）。故意不一样的列在下面。
#[test]
fn codes_agree_with_the_error_code_catalogue() {
    use crate::error_codes::{provider_error_catalogue, ProviderErrorCategoryId as Cat, ProviderErrorCodesQuery, ProviderKind};
    let catalogue =
        provider_error_catalogue(&ProviderErrorCodesQuery { kind: Some(ProviderKind::Llm), ..Default::default() }).unwrap();
    // 目录归限流、这里按不能用：1313 公平使用限频要人工申诉，短时间重试没用（目录也标 retryable=false）
    let deliberate = ["1313"];
    for (code, kind, _) in CODES {
        let entries: Vec<_> = catalogue
            .vendors
            .iter()
            .flat_map(|vendor| vendor.entries.iter())
            .filter(|entry| entry.matches_code(code))
            .collect();
        assert!(!entries.is_empty(), "{code} 不在错误码目录里");
        if deliberate.contains(code) {
            continue;
        }
        let agrees = entries.iter().any(|entry| match kind {
            Billing | Quota => matches!(entry.category, Cat::Billing | Cat::Quota),
            PlanRestricted => entry.category == Cat::Permission,
            RateLimited => entry.category == Cat::RateLimit,
            Overloaded => entry.category == Cat::Overloaded,
        });
        assert!(agrees, "{code}：这里是 {kind:?}，目录是 {:?}", entries.iter().map(|e| e.category).collect::<Vec<_>>());
    }
}
