//! 翻译模型服务商的报错：读出服务商自己的业务码，分清「限流」和「欠费 / 额度用完 / 套餐不含」（2026-11-23）。
//!
//! 起因：HTTP 429 在好几家都是一锅烩——OpenAI 的 `insufficient_quota`、智谱的 1113（欠费）、百炼的
//! `Arrearage` / `BudgetLimitExceeded`、Anthropic 的 `enforced_spend_limit_reached`、OpenCode 的
//! 「Policy budget exceeded」都走 429，和真正的限流长得一样。只看状态码，检测接口会把欠费说成「可用（当前被限流）」。
//! 这里只看正文和响应头，不发请求；校验 Key、拉模型列表、问模型三个接口共用，Rust 里别处要分 429 也用这里。
//!
//! 码表来源：各家官方错误码文档（2026-11-23 抓取，整理见 `docs/ops/planning/error-codes/`）。
//! 认不出的 429 照旧当限流；认不出的非 429 不归这里管（返回 `None`，调用方按状态码走原来的分类）。

use serde_json::Value;

/// 服务商报错归哪一类。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UpstreamLimitKind {
    /// 请求太快、并发太多：Key 和模型都被接受了，等一会儿就好。
    RateLimited,
    /// 服务商整体忙（平台过载），和账户无关。
    Overloaded,
    /// 欠费、余额不足、没订购、套餐到期：要充值或续费。
    Billing,
    /// 用量或花费上限（时间窗额度、自设预算、月度封顶）：要等重置或调高上限。
    Quota,
    /// 套餐不包含这个模型、Key 类型不对：要换模型、换 Key 或升级套餐。
    PlanRestricted,
}

impl UpstreamLimitKind {
    /// 这一类在处理好之前请求一定还会失败，重试没用。
    pub fn blocks_use(self) -> bool {
        matches!(self, Self::Billing | Self::Quota | Self::PlanRestricted)
    }
}

/// 认出来的结论。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UpstreamLimit {
    pub kind: UpstreamLimitKind,
    /// 据以判断的码：正文里的业务码，或者消息里的固定说法（OpenCode、百炼 Coding Plan 只有消息）；
    /// 光凭状态码判断（没带码的 429、402）时为 `None`。
    pub code: Option<String>,
    /// 给用户看的原因和下一步（中文）。
    pub reason_zh: &'static str,
}

/// 业务码表：`(码, 类别, 原因)`。码区分大小写，和服务商正文里的写法一致。
const CODES: &[(&str, UpstreamLimitKind, &str)] = {
    use UpstreamLimitKind::*;
    &[
        // OpenAI：error.code，或 error.type = insufficient_quota
        ("credit_balance_exhausted", Billing, "OpenAI 预付余额已用完，请到 OpenAI 控制台充值后再用"),
        ("insufficient_quota", Quota, "OpenAI 额度不足（余额用完或到了用量上限），请到 OpenAI 控制台充值或检查套餐和上限"),
        ("billing_hard_limit_reached", Quota, "已到 OpenAI 的计费硬上限，请到控制台调高上限或充值"),
        ("organization_spend_limit_exceeded", Quota, "已到 OpenAI 组织自设的月度消费上限，请到控制台调高上限"),
        ("project_spend_limit_exceeded", Quota, "已到 OpenAI 项目自设的月度消费上限，请到控制台调高上限"),
        ("organization_usage_limit_exceeded", Quota, "已到 OpenAI 给组织核定的月度用量上限，请等下月恢复或申请提额"),
        ("rate_limit_exceeded", RateLimited, ""),
        ("slow_down", RateLimited, ""),
        // Anthropic：error.details.error_code，或 error.type
        ("enforced_spend_limit_reached", Quota, "已到 Anthropic 用量档位的月度消费封顶，请到 Claude Console 申请升档，或等下月恢复"),
        ("billing_error", Billing, "Anthropic 账单或付款信息有问题，请到 Claude Console 检查付款方式"),
        ("ramp_limit_exceeded", RateLimited, ""),
        ("rate_limit_error", RateLimited, ""),
        ("overloaded_error", Overloaded, ""),
        // 智谱（BigModel / Z.ai）：error.code（字符串数字），或顶层 code
        ("1113", Billing, "智谱账户欠费或余额不足（也没有可用资源包），请充值后再用"),
        ("1302", RateLimited, ""),
        ("1305", Overloaded, ""),
        ("1308", Quota, "已到智谱套餐这个时间窗的用量上限，请等重置时间（见报错原文）"),
        ("1309", Billing, "智谱 GLM Coding Plan 套餐已到期，请续订"),
        ("1310", Quota, "已到智谱每周或每月的用量上限，请等重置时间（见报错原文）"),
        ("1311", PlanRestricted, "当前智谱套餐不包含这个模型，请换模型或升级套餐"),
        ("1313", Quota, "智谱按公平使用策略限制了这个账号的请求频率，需要联系智谱解除"),
        ("1314", Billing, "智谱企业套餐已失效，请续费"),
        ("1315", PlanRestricted, "这个智谱 Key 只能用于企业编程套餐，请换一个标准 API Key"),
        ("1316", Quota, "已到智谱 5 小时用量上限，且主账号余额不足、不能超额按量付费，请充值或等重置"),
        ("1317", Quota, "已到智谱 7 天用量上限，且主账号余额不足、不能超额按量付费，请充值或等重置"),
        ("1318", Quota, "已到智谱 5 小时用量上限，且子账号月消费已到上限，请调高上限或等重置"),
        ("1319", Quota, "已到智谱 7 天用量上限，且子账号月消费已到上限，请调高上限或等重置"),
        ("1320", Quota, "已到智谱 5 小时用量上限，且企业月消费已到上限，请调高上限或等重置"),
        ("1321", Quota, "已到智谱 7 天用量上限，且企业月消费已到上限，请调高上限或等重置"),
        // 阿里云百炼（DashScope / 千问）：兼容模式 error.code，原生协议顶层 code
        ("Arrearage", Billing, "阿里云账号欠费，请到阿里云「费用与成本」充值后再用"),
        ("CommodityNotPurchased", Billing, "百炼业务空间还没订购，请先在百炼控制台开通"),
        ("PrepaidBillOverdue", Billing, "百炼预付费账单已到期，请续费"),
        ("PostpaidBillOverdue", Billing, "百炼后付费的模型推理商品已失效，请到百炼控制台检查"),
        ("BudgetLimitExceeded", Quota, "百炼预算已用完，请在预算管理里提高预算或关掉「达预算即停」"),
        ("AllocationQuota.FreeTierOnly", Quota, "百炼免费额度已用完（开了「免费额度用完即停」或账号未认证），请关掉该开关或完成认证并充值"),
        ("Throttling", RateLimited, ""),
        ("Throttling.RateQuota", RateLimited, ""),
        ("limit_requests", RateLimited, ""),
        ("Throttling.BurstRate", RateLimited, ""),
        ("limit_burst_rate", RateLimited, ""),
        ("Throttling.Concurrency", RateLimited, ""),
        ("Throttling.AllocationQuota", RateLimited, ""),
        ("Throttling.ServiceOverloaded", Overloaded, ""),
        ("Throttling.ResourceExhausted", Overloaded, ""),
    ]
};

/// 只有消息、没有码的说法（小写比较，包含即算）：`(说法, 类别, 原因)`。比码先看——OpenCode 把这些包在
/// Anthropic 风格的外壳里转发时，外壳的 `error.type` 可能只是笼统的类型。
const PHRASES: &[(&str, UpstreamLimitKind, &str)] = {
    use UpstreamLimitKind::*;
    &[
        ("Policy budget exceeded", Quota, "OpenCode 工作区预算已用完，请让管理员提高预算，或等预算重置"),
        ("Insufficient account funds", Billing, "OpenCode 余额已用完，请充值后再用"),
        ("hour allocated quota exceeded", Quota, "百炼 Coding Plan 每 5 小时的额度已用完，请等重置"),
        ("week allocated quota exceeded", Quota, "百炼 Coding Plan 每周额度已用完，周一 0 点（北京时间）重置"),
        ("month allocated quota exceeded", Quota, "百炼 Coding Plan 每月额度已用完，订阅日 0 点（北京时间）重置"),
        ("usage allocated quota exceeded", RateLimited, ""),
        ("concurrency allocated quota exceeded", RateLimited, ""),
        // Anthropic 的余额用完、自设上限走 400 invalid_request_error，只能看消息
        ("Your credit balance is too low", Billing, "Anthropic 预付额度已用完，请到 Claude Console 的 Billing 页面购买额度"),
        ("You have reached your specified", Quota, "已到自己设置的 Anthropic 消费上限，请到 Claude Console 调高上限，或等报错里写的恢复时间"),
    ]
};

const BARE_402_REASON: &str = "服务商说余额不足（HTTP 402），请充值后再用";
const ANTHROPIC_CAP_REASON: &str =
    "Anthropic 回了不带 retry-after 的 429：多半是到了用量档位的月度消费封顶，请到 Claude Console 检查额度和档位";

/// 码最多留这么多个字符（防止服务商把一整段话塞进 code）。
const CODE_MAX_CHARS: usize = 100;

fn non_empty_text(value: Option<&Value>) -> Option<String> {
    let text = match value? {
        Value::String(text) => text.trim().to_string(),
        Value::Number(number) => number.to_string(),
        _ => return None,
    };
    (!text.is_empty()).then(|| text.chars().take(CODE_MAX_CHARS).collect())
}

/// 正文里的报错说明（`error.message`、`error` 是字符串、顶层 `message`），都没有就是整段正文。
fn error_message(parsed: Option<&Value>, body: &str) -> String {
    parsed
        .and_then(|value| {
            let error = value.get("error");
            error
                .and_then(|error| error.get("message").and_then(Value::as_str).or_else(|| error.as_str()))
                .or_else(|| value.get("message").and_then(Value::as_str))
                .map(str::to_string)
        })
        .unwrap_or_else(|| body.to_string())
}

/// 正文里服务商自己的码，按这个顺序找：Anthropic 的 `error.details.error_code`、`error.code`（OpenAI、智谱、
/// 百炼兼容模式）、顶层 `code`（百炼原生协议、Z.ai 的另一种写法；数字也认）、`error.type`（Anthropic，
/// OpenAI 计费类只给 type 时）。都没有时，消息里有 OpenCode、百炼 Coding Plan 的固定说法就用那句话。
/// 返回的是服务商原样的码，不是 HTTP 状态码。
pub fn upstream_error_code(body: &str) -> Option<String> {
    let parsed: Option<Value> = serde_json::from_str(body).ok();
    let from_json = parsed.as_ref().and_then(|value| {
        let error = value.get("error").filter(|error| error.is_object());
        error
            .and_then(|error| non_empty_text(error.get("details").and_then(|details| details.get("error_code"))))
            .or_else(|| error.and_then(|error| non_empty_text(error.get("code"))))
            .or_else(|| non_empty_text(value.get("code")))
            .or_else(|| error.and_then(|error| non_empty_text(error.get("type"))))
    });
    from_json.or_else(|| matched_phrase(&error_message(parsed.as_ref(), body)).map(|(phrase, _, _)| phrase.to_string()))
}

fn matched_phrase(message: &str) -> Option<(&'static str, UpstreamLimitKind, &'static str)> {
    let lowered = message.to_lowercase();
    PHRASES.iter().copied().find(|(phrase, _, _)| lowered.contains(&phrase.to_lowercase()))
}

fn lookup(code: &str) -> Option<(UpstreamLimitKind, &'static str)> {
    CODES.iter().find(|(known, _, _)| *known == code).map(|(_, kind, reason)| (*kind, *reason))
}

fn is_dashscope(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    host.contains("dashscope") || host.ends_with("aliyuncs.com")
}

fn is_anthropic_official(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    host == "anthropic.com" || host.ends_with(".anthropic.com")
}

/// 把一次失败响应归类。
///
/// - `http_status`：服务商回的状态码；
/// - `body`：正文原文；
/// - `has_retry_after`：响应头里有没有 `retry-after`（Anthropic 的消费封顶 429 一定没有）；
/// - `host`：请求的主机名，用来处理两家同名不同义的码（百炼兼容模式的 `insufficient_quota` 是 TPM 限流，
///   OpenAI 的是额度用完）和只对 Anthropic 官方地址才成立的规则。
///
/// 429 一定有结论（认不出就是限流）；402 认不出码时算欠费；别的状态码只在认出欠费、额度、套餐类的码或说法时
/// 返回（例如百炼 `Arrearage` 是 400 / 403、Anthropic 余额不足是 400），其余返回 `None`，调用方照原来的分类走。
pub fn classify_upstream_limit(http_status: u16, body: &str, has_retry_after: bool, host: &str) -> Option<UpstreamLimit> {
    let verdict = classify_by_body(body, host).or_else(|| match http_status {
        402 => Some(UpstreamLimit { kind: UpstreamLimitKind::Billing, code: None, reason_zh: BARE_402_REASON }),
        _ => None,
    });
    match (http_status, verdict) {
        // Anthropic 官方：429 rate_limit_error 没有 details.error_code、又没有 retry-after，按消费封顶处理（官方说法）。
        (429, Some(limit))
            if limit.code.as_deref() == Some("rate_limit_error")
                && !has_retry_after
                && is_anthropic_official(host) =>
        {
            Some(UpstreamLimit { kind: UpstreamLimitKind::Quota, code: limit.code, reason_zh: ANTHROPIC_CAP_REASON })
        }
        (429, Some(limit)) => Some(limit),
        (429, None) => Some(UpstreamLimit { kind: UpstreamLimitKind::RateLimited, code: None, reason_zh: "" }),
        (_, Some(limit)) if limit.kind.blocks_use() => Some(limit),
        // 不是 429 时，限流 / 过载类的码不归这里改判（例如 503 overloaded 照旧按 5xx 处理）。
        _ => None,
    }
}

fn classify_by_body(body: &str, host: &str) -> Option<UpstreamLimit> {
    let parsed: Option<Value> = serde_json::from_str(body).ok();
    let message = error_message(parsed.as_ref(), body);
    if let Some((phrase, kind, reason_zh)) = matched_phrase(&message) {
        let code = upstream_error_code(body).filter(|code| lookup(code).is_some_and(|(known, _)| known == kind));
        return Some(UpstreamLimit { kind, code: code.or_else(|| Some(phrase.to_string())), reason_zh });
    }
    let error = parsed.as_ref().and_then(|value| value.get("error")).filter(|error| error.is_object());
    let candidates = [
        error.and_then(|error| non_empty_text(error.get("details").and_then(|details| details.get("error_code")))),
        error.and_then(|error| non_empty_text(error.get("code"))),
        parsed.as_ref().and_then(|value| non_empty_text(value.get("code"))),
        error.and_then(|error| non_empty_text(error.get("type"))),
    ];
    for code in candidates.into_iter().flatten() {
        let Some((kind, reason_zh)) = lookup(&code) else { continue };
        // 百炼兼容模式的 insufficient_quota 是 Throttling.AllocationQuota（TPS/TPM 限流）；
        // 只有消息说到免费额度用完时才是额度问题。
        if code == "insufficient_quota" && is_dashscope(host) {
            let lowered = message.to_lowercase();
            if lowered.contains("free") || message.contains("免费") {
                return Some(UpstreamLimit {
                    kind: UpstreamLimitKind::Quota,
                    code: Some(code),
                    reason_zh: "百炼这个模型的免费额度已用完，且不支持按量付费，请换模型或开通付费",
                });
            }
            return Some(UpstreamLimit { kind: UpstreamLimitKind::RateLimited, code: Some(code), reason_zh: "" });
        }
        return Some(UpstreamLimit { kind, code: Some(code), reason_zh });
    }
    None
}

#[cfg(test)]
#[path = "upstream_limits_tests.rs"]
mod tests;
