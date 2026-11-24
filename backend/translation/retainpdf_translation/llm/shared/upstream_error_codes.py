"""上游报错里的业务码：哪些 4xx 其实是余额、额度、预算用完（重试没用，整份翻译停下），哪些才是真限流。

只看 HTTP 状态不够：OpenAI、Anthropic、智谱、千问、OpenCode 都把「额度用完」放在 429 里（千问欠费还有 400 / 403），
以前一律当限流，每个请求退避到 300 秒才放弃，用户看到的是「稍后重试即可」（2026-11-23 用户定：按业务码整份停下）。
这里读响应体的错误码，认出来的交回 ``UpstreamRejection``；认不出的交回 None，调用方照旧按状态码处理
（429 退避、认 Retry-After）。

- ``quota``：余额、额度、预算、套餐到期。和 402 一样：第一次就停，记下这组凭据，结构化失败归 ``upstream_quota_exhausted``。
- ``access``：这个 Key 的套餐不能用这个模型（智谱 1311、1315）。和 401/403 一样停下，归 ``auth_failed``。
- ``model``：模型不存在、名字写错、这个 Key 没开通（OpenAI ``model_not_found``、Anthropic ``not_found_error``、千问
  ``ModelNotFound`` 等、智谱 1211），以及任何 404（接口地址写错也是 404，同样是配置错误）。和 401/403 一样第一次就停，
  归 ``upstream_model_unavailable``，换模型后从翻译续跑（2026-11-23）。
- ``region``：所在地区不支持（OpenAI 403 ``unsupported_country_region_territory``）。整份停下，归 ``upstream_region_unsupported``
  （2026-11-24 以前归 ``auth_failed``），说法是「换网络或换服务商」，换 Key 没用。
- ``content``：内容审核没过（智谱 1301、千问 ``DataInspectionFailed`` / ``FaqRuleBlocked``、OpenAI ``invalid_prompt`` 等）。
  不重试、不停整份：只这一块保留原文，翻译诊断里记「内容审核未过」。

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
- OpenCode：429 的 message 是 「Policy budget exceeded」（工作区预算用完）。Go 套餐的 ``rate-limited``（用量 meter）
  文档没写超额时回什么状态和错误体，不认。
- 千问 Coding Plan 的 ``usage allocated quota exceeded``（短时用量过高，约一小时恢复，300 秒内重试没用）按额度停；
  ``Throttling.AllocationQuota`` 只有 message 说免费额度用完（free tier、quota exhausted……）的才按额度停。
- 模型不可用：OpenAI ``model_not_found``（404），Anthropic ``not_found_error``（404），千问 ``ModelNotFound`` /
  ``model_not_found`` / ``model_not_supported`` / ``WorkSpaceNotFound`` / ``NotFound``（404）、``Endpoint.AccessDenied``
  （403，调了已下线的模型快照）、``invalid_parameter_error`` 且 message 说模型没开通（400），智谱 1211（400）。
- 地区：OpenAI 403 ``unsupported_country_region_territory``，或 403 的 message 说 country / region / territory not supported。
- 内容审核：智谱 1301（400）；千问 ``DataInspectionFailed`` / ``data_inspection_failed`` / ``FaqRuleBlocked``（400）；
  OpenAI ``invalid_prompt``、``bio_policy``、``misalignment_policy_violation``（以 4xx 回来时；Responses API 200 +
  ``status=failed`` 那种形态不在这里）。

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
MODEL = "model"
REGION = "region"
CONTENT = "content"
# 这几种认出来后同一组凭据（模型不可用时是凭据 + 模型）注定还会被拒：第一次就整份停下。内容审核只是这一块。
STOP_KINDS = frozenset({QUOTA, ACCESS, MODEL, REGION})

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
QWEN_USAGE_QUOTA_MESSAGES = (
    ("usage allocated quota exceeded", "usage allocated quota exceeded", "Coding Plan 短时用量过高被限制，约一小时后恢复"),
)
_FREE_TIER_MARKERS = ("free tier", "free quota", "free allocated", "free trial", "quota exhausted", "免费额度")
# 百炼 TPM 限流的码（兼容模式下是 insufficient_quota）：只有 message 说免费额度用完的才是额度
QWEN_THROTTLE_QUOTA_CODES = ("insufficient_quota", "Throttling.AllocationQuota")

# 模型不存在、没开通（各家独有的码，不看地址）
MODEL_CODES = {
    "model_not_found": "模型不存在，或这个 Key 没有权限用它",
    "not_found_error": "请求的模型或接口不存在",
    "ModelNotFound": "模型不存在、名字写错、在这个地域不可用或没开通",
    "model_not_supported": "这个模型不支持 OpenAI 兼容方式调用",
    "WorkSpaceNotFound": "接口地址里的业务空间不存在",
    "Endpoint.AccessDenied": "调用端点被拒，多半是这个模型版本已下线",
}
ZHIPU_MODEL_CODES = {"1211": "模型不存在，模型名写错了"}
# 千问 invalid_parameter_error 是笼统的参数错，只有 message 说模型没开通、不存在时才算
QWEN_MODEL_PARAM_CODE = "invalid_parameter_error"
_MODEL_MISSING_MARKERS = (
    "not activated",
    "has not been activated",
    "not been opened",
    "未开通",
    "model not exist",
    "model does not exist",
    "model not found",
    "does not exist or you do not have access",
)
REGION_CODES = {"unsupported_country_region_territory": "所在国家或地区不受支持"}
_REGION_MARKERS = (
    "country, region, or territory not supported",
    "unsupported_country_region_territory",
    "unsupported region",
    "not available in your region",
)
CONTENT_CODES = {
    "DataInspectionFailed": "输入或输出被阿里云内容安全拦截",
    "data_inspection_failed": "输入或输出被阿里云内容安全拦截",
    "FaqRuleBlocked": "命中 FAQ 规则干预被拦截",
    "invalid_prompt": "提示词被判为不合规",
    "bio_policy": "触发生物安全策略被拦截",
    "misalignment_policy_violation": "触发安全审查被拦截",
}
ZHIPU_CONTENT_CODES = {"1301": "输入或生成内容被判定可能不安全或敏感，被拦截"}


@dataclass(frozen=True)
class UpstreamRejection:
    """认出来的「重试没用」：``kind`` 是 ``quota`` / ``access`` / ``model`` / ``region`` / ``content``，
    ``code`` 是服务商的码（只认 message 时写认出的那段；没有码的 404 写 ``http_404``）。"""

    kind: str
    provider: str
    code: str
    reason: str
    http_status: int | None = None

    @property
    def provider_label(self) -> str:
        return PROVIDER_LABELS.get(self.provider, self.provider or "上游")

    @property
    def stops_run(self) -> bool:
        """同一组凭据之后的请求注定同样被拒，整份翻译停下（内容审核只是这一块）。"""
        return self.kind in STOP_KINDS

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
    """一次上游 4xx 响应是不是「重试没用」：余额额度用完、套餐不能用这个模型、模型不可用、地区不支持、内容审核没过。
    ``body`` 可以是文本、字节或解析好的 dict。"""
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

    # 内容审核、地区、模型不可用：各家独有的码，先认（和额度类的码不重叠）
    if provider == ZHIPU:
        for code in codes:
            if code in ZHIPU_CONTENT_CODES:
                return hit(CONTENT, code, ZHIPU_CONTENT_CODES[code])
            if code in ZHIPU_MODEL_CODES:
                return hit(MODEL, code, ZHIPU_MODEL_CODES[code])
    for code in codes:
        if code in CONTENT_CODES:
            return hit(CONTENT, code, CONTENT_CODES[code])
    if status == 403:
        for code in codes:
            if code in REGION_CODES:
                return hit(REGION, code, REGION_CODES[code], provider or OPENAI)
        for marker in _REGION_MARKERS:
            if marker in lowered:
                return hit(REGION, "unsupported_region", "所在国家或地区不受支持", provider or OPENAI)
    for code in codes:
        if code in MODEL_CODES:
            return hit(MODEL, code, MODEL_CODES[code])
        if code == QWEN_MODEL_PARAM_CODE and any(marker in lowered for marker in _MODEL_MISSING_MARKERS):
            return hit(MODEL, code, "模型还没在百炼模型市场开通", provider or QWEN)

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
    for marker, code, reason in QWEN_QUOTA_MESSAGES + QWEN_USAGE_QUOTA_MESSAGES:
        if marker in lowered:
            return hit(QUOTA, code, reason, QWEN)
    for code in codes:
        if code == "Throttling.AllocationQuota" or (provider == QWEN and code == "insufficient_quota"):
            # 百炼的 insufficient_quota 是 Throttling.AllocationQuota（TPM 限流），只有说免费额度用完的才是额度
            if any(marker in lowered for marker in _FREE_TIER_MARKERS):
                return hit(QUOTA, code, "免费额度用完", QWEN)
            return None
        if code not in OPENAI_QUOTA_CODES:
            continue
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
    if status == 404:
        # 对话接口回 404：模型名写错 / 没开通，或者接口地址（base_url）写错。哪种都是配置错，每个块都会一样被拒
        return hit(MODEL, "http_404", "模型或接口地址不存在")
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
    交回 (``quota`` / ``auth`` / ``model`` / ``region`` / ``content``, 「HTTP 429，Anthropic 业务码 …：…」)，认不出交回 None。"""
    rejection = classify_rejection(status, body, headers=headers, url=url)
    if rejection is None:
        return None
    return _AGENT_KINDS.get(rejection.kind, "auth"), rejection.describe()


# 业务码种类 → agent 的种类（``retainpdf_translation_agent.agent._classify`` 认这几个）
_AGENT_KINDS = {QUOTA: "quota", ACCESS: "auth", MODEL: "model", REGION: "region", CONTENT: "content"}


__all__ = [
    "ACCESS",
    "CONTENT",
    "MODEL",
    "QUOTA",
    "REGION",
    "STOP_KINDS",
    "UpstreamRejection",
    "agent_http_classifier",
    "classify_rejection",
    "classify_response",
    "provider_of",
]
