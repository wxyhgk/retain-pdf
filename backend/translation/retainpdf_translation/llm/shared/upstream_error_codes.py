"""上游报错里的业务码：哪些 4xx 其实是余额、额度、预算用完（重试没用，整份翻译停下），哪些才是真限流。

只看 HTTP 状态不够：OpenAI、Anthropic、智谱、千问、OpenCode 都把「额度用完」放在 429 里（千问欠费还有 400 / 403），
以前一律当限流，每个请求退避到 300 秒才放弃，用户看到的是「稍后重试即可」（2026-11-23 用户定：按业务码整份停下）。
这里读响应体的错误码，认出来的交回 ``UpstreamRejection``；认不出的交回 None，调用方照旧按状态码处理
（429 退避、认 Retry-After）。

- ``quota``：余额、额度、预算、套餐到期。和 402 一样：第一次就停，记下这组凭据，结构化失败归 ``upstream_quota_exhausted``。
- ``access``：这个 Key 的套餐不能用这个模型（智谱 1311、1315）。和 401/403 一样停下，归 ``auth_failed``。

各家的码和区分规则（官方文档，2026-11-23 查）：

- OpenAI：429 且 ``error.code`` 或 ``error.type`` 是计费类（``insufficient_quota``、``credit_balance_exhausted``、
  ``organization_spend_limit_exceeded``、``project_spend_limit_exceeded``、``organization_usage_limit_exceeded``、
  ``billing_hard_limit_reached``）。没有码、``rate_limit_exceeded``、``slow_down`` 是真限流。
- Anthropic：429 的 ``error.details.error_code`` 是 ``enforced_spend_limit_reached``；或者 ``api.anthropic.com`` 的 429
  没有 ``retry-after`` 头（文档：消费封顶的 429 一定没有，限流的有；只认官方地址，智谱等兼容地址本来就不发这个头）。
  ``ramp_limit_exceeded`` 是爬坡限流。400 ``invalid_request_error`` 只能看 message：「reached your specified ... API usage
  limits」（自设消费上限）、「credit balance is too low」（预付余额用完）。
- 智谱（``bigmodel.cn``、``z.ai``）：``error.code``（也认顶层 ``code``）1113 欠费、1308–1321 套餐额度和消费上限
  （1311、1315 是 Key 的套餐不能用这个模型，归 ``access``；1312 官方表里没有，不认）。1302 并发限制、1305 过载是真限流。
- 千问 / 百炼：``CommodityNotPurchased``、``PrepaidBillOverdue``、``PostpaidBillOverdue``、``BudgetLimitExceeded``（429），
  ``Arrearage``（400 / 403），``AllocationQuota.FreeTierOnly``（403），Coding Plan 的 hour/week/month allocated quota
  exceeded。百炼地址上的 ``insufficient_quota`` 是 TPM 限流（Throttling.AllocationQuota），照旧退避；message 说免费额度
  用完的除外。
- OpenCode：429 的 message 是 「Policy budget exceeded」（工作区预算用完）。

码只用在 4xx 上；5xx 照旧按状态码。不读、不记 Key；交回的原因不含响应体原文。
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from typing import Mapping
from urllib.parse import urlparse


QUOTA = "quota"
ACCESS = "access"

OPENAI = "openai"
ANTHROPIC = "anthropic"
ZHIPU = "zhipu"
QWEN = "qwen"
OPENCODE = "opencode"

PROVIDER_LABELS = {
    OPENAI: "OpenAI",
    ANTHROPIC: "Anthropic",
    ZHIPU: "智谱",
    QWEN: "阿里云百炼",
    OPENCODE: "OpenCode",
}

OPENAI_QUOTA_CODES = {
    "insufficient_quota": "额度不足",
    "credit_balance_exhausted": "预付余额已用完",
    "organization_spend_limit_exceeded": "组织达到自设的月度消费上限",
    "project_spend_limit_exceeded": "项目达到自设的月度消费上限",
    "organization_usage_limit_exceeded": "组织达到核定的月度用量上限",
    "billing_hard_limit_reached": "达到计费硬上限",
}
ANTHROPIC_QUOTA_CODES = {
    "enforced_spend_limit_reached": "达到所在用量档位的月度消费封顶",
}
ANTHROPIC_QUOTA_MESSAGES = (
    ("credit balance is too low", "credit_balance_too_low", "预付余额用完"),
    ("reached your specified", "spend_limit_reached", "达到自设的消费上限"),
)
ZHIPU_QUOTA_CODES = {
    "1113": "账户欠费或余额不足，也没有可用资源包",
    "1308": "达到时间窗口的用量上限，到重置时间后恢复",
    "1309": "GLM Coding Plan 套餐已到期",
    "1310": "达到每周或每月用量上限，到重置时间后恢复",
    "1313": "使用方式不符合公平使用策略，请求频率被平台限制",
    "1314": "企业套餐已失效",
    "1316": "达到 5 小时用量上限，且主账号余额不足",
    "1317": "达到 7 天用量上限，且主账号余额不足",
    "1318": "达到 5 小时用量上限，且子账号月消费已到上限",
    "1319": "达到 7 天用量上限，且子账号月消费已到上限",
    "1320": "达到 5 小时用量上限，且企业级月消费已到上限",
    "1321": "达到 7 天用量上限，且企业级月消费已到上限",
}
ZHIPU_ACCESS_CODES = {
    "1311": "这个 Key 的套餐不包含这个模型",
    "1315": "这个 Key 的类型不能调用这个接口或模型",
}
QWEN_QUOTA_CODES = {
    "CommodityNotPurchased": "业务空间还没订购",
    "PrepaidBillOverdue": "业务空间预付费账单已到期",
    "PostpaidBillOverdue": "后付费的模型推理商品已失效",
    "BudgetLimitExceeded": "预算管理里设的预算用完",
    "Arrearage": "阿里云账号欠费",
    "AllocationQuota.FreeTierOnly": "免费额度已用完，且开了「免费额度用完即停」",
}
QWEN_QUOTA_MESSAGES = (
    ("hour allocated quota exceeded", "hour allocated quota exceeded", "Coding Plan 5 小时额度用完"),
    ("week allocated quota exceeded", "week allocated quota exceeded", "Coding Plan 周额度用完"),
    ("month allocated quota exceeded", "month allocated quota exceeded", "Coding Plan 月额度用完"),
)
OPENCODE_QUOTA_MESSAGES = (
    ("policy budget exceeded", "policy_budget_exceeded", "工作区预算用完"),
)
_FREE_TIER_MARKERS = ("free tier", "free quota", "free allocated", "免费额度")


@dataclass(frozen=True)
class UpstreamRejection:
    """认出来的「重试没用」：``kind`` 是 ``quota`` / ``access``，``code`` 是服务商的码（只认 message 时写认出的那段）。"""

    kind: str
    provider: str
    code: str
    reason: str
    http_status: int | None = None

    @property
    def provider_label(self) -> str:
        return PROVIDER_LABELS.get(self.provider, self.provider or "上游")

    def describe(self) -> str:
        """「HTTP 429，OpenAI 业务码 insufficient_quota：额度不足」：报错里给用户看的那段，不含响应体原文。"""
        status = f"HTTP {self.http_status}" if self.http_status else "HTTP ?"
        return f"{status}，{self.provider_label} 业务码 {self.code}：{self.reason}"


def provider_of(url: str) -> str:
    """按地址认服务商；认不出（自建、中转）交回空串，只用各家独有的码判断。"""
    host = str(urlparse(str(url or "")).hostname or "").lower()
    if not host:
        return ""
    if host == "api.openai.com":
        return OPENAI
    if host == "api.anthropic.com":
        return ANTHROPIC
    if host.endswith("bigmodel.cn") or host == "z.ai" or host.endswith(".z.ai"):
        return ZHIPU
    if "dashscope" in host and host.endswith(("aliyuncs.com", "aliyun.com")):
        return QWEN
    if host == "opencode.ai" or host.endswith(".opencode.ai"):
        return OPENCODE
    return ""


def _error_fields(body: Any) -> tuple[list[str], str, str]:
    """响应体 → (错误码候选，message，Anthropic 的 details.error_code)。认 ``{"error": {...}}`` 和顶层 ``code``/``message``。"""
    codes: list[str] = []
    message = ""
    detail_code = ""
    if not isinstance(body, dict):
        return codes, message, detail_code
    error = body.get("error")
    containers = [error] if isinstance(error, dict) else []
    containers.append(body)
    for container in containers:
        for key in ("code", "type"):
            value = container.get(key)
            if value not in (None, "") and not isinstance(value, (dict, list)):
                codes.append(str(value).strip())
        if not message and isinstance(container.get("message"), str):
            message = container["message"]
        details = container.get("details")
        if not detail_code and isinstance(details, dict) and details.get("error_code"):
            detail_code = str(details["error_code"]).strip()
    if isinstance(error, str) and not message:
        message = error
    return codes, message, detail_code


def _parse_body(body: Any) -> tuple[Any, str]:
    if isinstance(body, (bytes, bytearray)):
        body = bytes(body).decode("utf-8", "replace")
    if isinstance(body, str):
        text = body
        try:
            return json.loads(body), text
        except ValueError:
            return None, text
    return body, ""


def _has_header(headers: Mapping[str, Any] | None, name: str) -> bool:
    if not headers:
        return False
    try:
        for key, value in headers.items():
            if str(key).lower() == name and str(value or "").strip():
                return True
    except Exception:  # noqa: BLE001 - 读不了头就当没有
        return False
    return False


def classify_rejection(
    status: int | None,
    body: Any,
    *,
    headers: Mapping[str, Any] | None = None,
    url: str = "",
) -> UpstreamRejection | None:
    """一次上游 4xx 响应是不是「余额、额度用完」或「套餐不能用这个模型」。``body`` 可以是文本、字节或解析好的 dict。"""
    try:
        status = int(status) if status is not None else None
    except (TypeError, ValueError):
        status = None
    if status is None or not 400 <= status < 500:
        return None
    provider = provider_of(url)
    parsed, text = _parse_body(body)
    codes, message, detail_code = _error_fields(parsed)
    lowered = f"{message}\n{text}".lower()

    def hit(kind: str, code: str, reason: str, who: str = "") -> UpstreamRejection:
        return UpstreamRejection(kind=kind, provider=who or provider, code=code, reason=reason, http_status=status)

    # Anthropic：details.error_code 最准；爬坡限流明确是限流
    if detail_code in ANTHROPIC_QUOTA_CODES:
        return hit(QUOTA, detail_code, ANTHROPIC_QUOTA_CODES[detail_code], ANTHROPIC)
    if detail_code == "ramp_limit_exceeded":
        return None
    if provider == ZHIPU:
        for code in codes:
            if code in ZHIPU_ACCESS_CODES:
                return hit(ACCESS, code, ZHIPU_ACCESS_CODES[code])
            if code in ZHIPU_QUOTA_CODES:
                return hit(QUOTA, code, ZHIPU_QUOTA_CODES[code])
    for code in codes:
        if code in QWEN_QUOTA_CODES:
            return hit(QUOTA, code, QWEN_QUOTA_CODES[code], QWEN)
    for marker, code, reason in QWEN_QUOTA_MESSAGES:
        if marker in lowered:
            return hit(QUOTA, code, reason, QWEN)
    for code in codes:
        if code not in OPENAI_QUOTA_CODES:
            continue
        if provider == QWEN and code == "insufficient_quota":
            # 百炼的 insufficient_quota 是 Throttling.AllocationQuota（TPM 限流），只有说免费额度用完的才是额度
            if any(marker in lowered for marker in _FREE_TIER_MARKERS):
                return hit(QUOTA, code, "免费额度用完", QWEN)
            return None
        return hit(QUOTA, code, OPENAI_QUOTA_CODES[code], provider or OPENAI)
    for marker, code, reason in OPENCODE_QUOTA_MESSAGES:
        if marker in lowered:
            return hit(QUOTA, code, reason, OPENCODE)
    if status == 400:
        for marker, code, reason in ANTHROPIC_QUOTA_MESSAGES:
            if marker in lowered:
                return hit(QUOTA, code, reason, provider or ANTHROPIC)
    if status == 429 and provider == ANTHROPIC and not _has_header(headers, "retry-after"):
        # 文档：限流的 429 带 retry-after，消费封顶的不带；没有 details.error_code 时按额度用完停下
        return hit(QUOTA, "429_without_retry_after", "429 没有 retry-after（消费封顶）")
    return None


def classify_response(response: Any) -> UpstreamRejection | None:
    """``requests.Response`` 版本。读不了正文就交回 None（照旧按状态码处理）。"""
    if response is None:
        return None
    status = getattr(response, "status_code", None)
    try:
        if status is None or not 400 <= int(status) < 500:
            return None
    except (TypeError, ValueError):
        return None
    try:
        text = response.text or ""
    except Exception:  # noqa: BLE001 - 正文读不出来不影响原来的处理
        text = ""
    return classify_rejection(
        status,
        text,
        headers=getattr(response, "headers", None),
        url=str(getattr(response, "url", "") or ""),
    )


def agent_http_classifier(
    status: int, body: str, headers: Mapping[str, Any] | None, url: str
) -> tuple[str, str] | None:
    """给翻译 agent 自己的 Anthropic 请求（``make_http_transport(classify=…)``）用：
    交回 (``quota`` / ``auth``, 「HTTP 429，Anthropic 业务码 …：…」)，认不出交回 None。"""
    rejection = classify_rejection(status, body, headers=headers, url=url)
    if rejection is None:
        return None
    return ("quota" if rejection.kind == QUOTA else "auth"), rejection.describe()


__all__ = [
    "ACCESS",
    "QUOTA",
    "UpstreamRejection",
    "agent_http_classifier",
    "classify_rejection",
    "classify_response",
    "provider_of",
]
