<!-- 由 backend/api/src/api_tests/provider_error_codes.rs 从 backend/packages/retainpdf-providers/error-codes/ 生成，不要手改：
     UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes -->

# Anthropic 错误码

翻译模型服务商。接口主机：`api.anthropic.com`。数据：[`backend/packages/retainpdf-providers/error-codes/llm/anthropic.json`](../../../../backend/packages/retainpdf-providers/error-codes/llm/anthropic.json)；接口 `GET /api/v1/providers/error-codes?provider=anthropic`。回到[错误码索引](../README.md)。

含义、提示都是转述，原文看每条的出处。

## 错误长什么样

JSON body {"type": "error", "error": {"type", "message", "details"?: {"error_code"}}, "request_id"}；error.type 是主分类，Messages API 上更细的原因在 error.details.error_code（如 enforced_spend_limit_reached、ramp_limit_exceeded）。新 type 值可能增加，需兜底。 响应头：request-id（同 body 的 request_id），retry-after（秒；不是所有 429 都有，消费封顶 429 一定没有）， anthropic-ratelimit-{requests,tokens,input-tokens,output-tokens}-{limit,remaining,reset}（reset 为 RFC 3339 时间），Priority Tier 另有 anthropic-priority-{input,output}-tokens-*，快速模式有 anthropic-fast-*。 流式：HTTP 200 之后仍可能来 event: error，data 为 {"type":"error","error":{"type":"overloaded_error",...}}。 成功响应的 stop_reason ∈ end_turn/max_tokens/stop_sequence/tool_use/pause_turn/refusal/model_context_window_exceeded。 经 Anthropic 的 /v1/chat/completions 兼容端点时，error.type 固定为 invalid_request_error，error.code 放 Anthropic 的错误类型，需按 HTTP 状态 + error.code 判断。

## 同一个状态有几种意思时怎么分

- 429 的 error.type 都是 rate_limit_error，要看 error.details.error_code：没有或 ramp_limit_exceeded 是限流 / 爬坡（有 retry-after，可重试）；enforced_spend_limit_reached 是月度花费封顶（没有 retry-after，到下月前重试都没用）。没有 details 时，429 又没有 retry-after 头就按额度处理。
- 400 也有歧义：自设花费上限到了返回 400 invalid_request_error（message 以 You have reached your specified API usage limits 开头），余额不足是 400 + Your credit balance is too low；只能看 message。402 billing_error 是支付信息问题。
- 500 可能是 api_error 也可能是 timeout_error，看 error.type；模型名写错一般是 404 not_found_error，没有单独的 model_not_found。
- HTTP 200 也可能没翻完：看 stop_reason（max_tokens、model_context_window_exceeded、refusal）；流式时 200 之后仍可能来 event: error。

## RetainPDF 怎么处理

走翻译请求层的 Anthropic Messages 协议，处理同 OpenAI：401/403 整份停下、402 整份停下归余额不足、400 这个请求失败（拒收 temperature、思考字段时自动降级）、429/5xx/529 退避重试、其他 4xx 只算这个请求失败。4xx 先读业务码（2026-11-23）：429 的 details.error_code=enforced_spend_limit_reached（或官方地址的 429 不带 retry-after）、400 的 credit balance too low / reached your specified API usage limits 都和 402 一样整份停下，归 upstream_quota_exhausted；ramp_limit_exceeded 照旧当限流。

共 20 条：有缺口 0 条（高 0、中 0、低 0），碰不到 2 条。缺口按用户影响排的总表见[索引](../README.md#缺口汇总)。

## 错误码

码一栏是服务商返回的码；服务商没有码的，括号里是我们起的编号（接口里的 `id`）。

| 码 | HTTP | 大类 | 可重试 | 含义 | 给用户的提示 | 我们怎么处理 | 对不对得上 | 出处 |
|---|---|---|---|---|---|---|---|---|
| `invalid_request_error` | 400 | 请求参数错误（`invalid_request`） | 否 | 请求格式或内容有问题；其他未单列的 4XX 也可能用这个类型。 | 看 error.message 指出的字段并修正请求参数。 | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。拒收 temperature 时自动去掉重发并记住；思考字段不被接受时退下一档。 | 对得上 | [文档](https://platform.claude.com/docs/en/api/errors) |
| （specified_api_usage_limits） | 400 | 额度或用量上限（`quota`） | 否 | 达到组织或工作区自己设置的消费上限；message 以 "You have reached your specified API usage limits"（工作区为 "...specified workspace API usage limits"）开头并写明恢复时间。 | 去 Claude Console 的 Spend limits 提高或取消自设上限，或等恢复时间。 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：400 的 message 里有「reached your specified … API usage limits」，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://platform.claude.com/docs/en/api/rate-limits) |
| （prompt_too_long） | 400 | 输入或输出太长（`context_length`） | 否 | 输入本身已超过模型上下文窗口（message 为 "prompt is too long"）。 | 减少每次发送的内容（拆小分块）。 | 只这一块失败：单次请求太长：不再换参数重发同样的请求，批量拆成单块再发，单块仍太长这一块保留原文（死信，degradation_reason=request_too_long，不挡导出），不记凭据、不停整份。Rust 执行器不拆批：记 failed + request_too_long，任务失败 summary 写明「单次请求太长」。 | 对得上 | [文档](https://platform.claude.com/docs/en/build-with-claude/context-windows) |
| （credit_balance_too_low） | 400 | 欠费或余额不足（`billing`） | 否 | 预付余额用完：message 为 "Your credit balance is too low to access the Anthropic API..."（文档给出文本，未写状态码；400 为通用知识）。 | 去 Claude Console 的 Billing 页面购买额度或开启自动充值。 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：400 的 message 里有「credit balance is too low」，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers) |
| （prefill_unsupported） | 400 | 不支持的参数或调用方式（`unsupported`） | 否 | 新模型（Claude 4.6 及以后）不支持 assistant 预填，最后一条必须是 user 消息。 | 去掉末尾的 assistant 预填，改用结构化输出或 system 指令。 | 碰不到：翻译请求最后一条总是 user 消息，不用预填。 | — | [文档](https://platform.claude.com/docs/en/api/errors) |
| `authentication_error` | 401 | 鉴权失败（`auth`） | 否 | API Key 有问题（格式错、已吊销或过期）。message 以 "CORS requests are not allowed" 开头时是浏览器直连被组织禁止，与密钥无关。 | 核对或重新生成 Anthropic API Key 后再试。 | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://platform.claude.com/docs/en/api/errors) |
| `billing_error` | 402 | 欠费或余额不足（`billing`） | 否 | 账单或支付信息有问题。 | 去 Claude Console 检查付款方式和账单信息。 | 整份翻译停下 → `upstream_quota_exhausted`：402 不重试，整份翻译停下，归「上游账户余额不足」，不可重试（agent 引擎报 QuotaExhausted）。 | 对得上 | [文档](https://platform.claude.com/docs/en/api/errors) |
| `permission_error` | 403 | 没有权限（`permission`） | 否 | 该 API Key 无权使用所请求的资源（模型、功能或工作区）。 | 在 Claude Console 检查组织权限和工作区设置。 | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://platform.claude.com/docs/en/api/errors) |
| `not_found_error` | 404 | 模型不存在（`model_not_found`） | 否 | 请求的资源不存在；接口路径或资源 ID 错误（模型名写错通常也落在这里）。 | 核对接口地址和模型名称。 | 整份翻译停下 → `upstream_model_unavailable`：第一次被拒就整份停下（同一组 Key + 这个模型后面的请求不再发，同一个 Key 的别的模型照常），失败码 upstream_model_unavailable：提示改模型名、开通模型或核对接口地址，从翻译续跑；agent 停下原因 model_unavailable，Rust 执行器 error_code=model_unavailable。 | 对得上 | [文档](https://platform.claude.com/docs/en/api/errors) |
| `conflict_error` | 409 | 其他（`other`） | 是 | 请求与资源当前状态冲突（并发修改或唯一值重复）。 | 解决冲突后再重试。 | 碰不到：Messages 请求不改资源，碰不到 409。 | — | [文档](https://platform.claude.com/docs/en/api/errors) |
| `request_too_large` | 413 | 请求参数错误（`invalid_request`） | 否 | 请求体超过字节上限（Messages API 128 MB；第一方 API 在 Cloudflare 层就拒绝）。 | 减小单次请求体积（少带图片/文件或拆分）。 | 只这一块失败：单次请求太长：不再换参数重发同样的请求，批量拆成单块再发，单块仍太长这一块保留原文（死信，degradation_reason=request_too_long，不挡导出），不记凭据、不停整份。Rust 执行器不拆批：记 failed + request_too_long，任务失败 summary 写明「单次请求太长」。 | 对得上 | [文档](https://platform.claude.com/docs/en/api/errors) |
| `rate_limit_error` | 429 | 限流（`rate_limit`） | 是 | 触发速率限制（RPM/ITPM/OTPM），通常带 retry-after 头。 | 按 retry-after 秒数等待后重试，降低并发。 | 退避重试 → `upstream_rate_limited`：退避重试，认 Retry-After；单个请求累计等待超过 300 秒放弃，归「外部服务请求被限流」。 | 对得上 | [文档](https://platform.claude.com/docs/en/api/errors) |
| `enforced_spend_limit_reached` | 429 | 额度或用量上限（`quota`） | 否 | 达到所在用量档位的月度消费封顶；error.details.error_code 为此值，且没有 retry-after 头，下月 1 日 00:00 UTC 前持续失败。 | 在 Claude Console 的 Rate limits 页申请升档，或等下月恢复。 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：429 的 error.details.error_code 是 enforced_spend_limit_reached；api.anthropic.com 的 429 没有 retry-after 头时也按这一类（文档：消费封顶的 429 不带，限流的带），认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://platform.claude.com/docs/en/api/rate-limits) |
| `ramp_limit_exceeded` | 429 | 限流（`rate_limit`） | 是 | 用量增长太快触发爬坡限制，即使未达速率上限；error.details.error_code 为此值。 | 按 retry-after 等待，之后每分钟最多加一个台阶慢慢加量。 | 退避重试 → `upstream_rate_limited`：退避重试，认 Retry-After；单个请求累计等待超过 300 秒放弃，归「外部服务请求被限流」。 | 对得上 | [文档](https://platform.claude.com/docs/en/api/rate-limits) |
| `api_error` | 500 | 服务端错误（`server`） | 是 | Anthropic 内部意外错误。 | 指数退避后重试；持续出现带 request-id 联系支持。 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://platform.claude.com/docs/en/api/errors) |
| `timeout_error` | 504、500 | 超时（`timeout`） | 是 | 请求处理超时；开始输出前就触及服务端时限时也可能以 500 返回此类型。 | 重试；长输出改用流式或 Message Batches。 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://platform.claude.com/docs/en/api/errors) |
| `overloaded_error` | 529 | 服务繁忙（`overloaded`） | 是 | API 暂时过载（全体用户流量高峰）；流式中途也可能以 error 事件出现。 | 稍等后重试，或暂时换一个模型。 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://platform.claude.com/docs/en/api/errors) |
| `max_tokens` | 200 | 输入或输出太长（`context_length`） | 否 | 输出达到 max_tokens 上限被截断。 | 调大 max_tokens，或减小每次翻译的分块。 | 只这一块失败：回答不完整（截断 / 被内容过滤）时不收半截译文：批量留下已用 &lt;&lt;&lt;END>>> 写完的块、其余拆单块重翻；单块重试一次后记这一块失败（degradation_reason=model_output_truncated / model_output_content_filter），收尾补救不成保留原文。Rust 执行器记 failed + output_incomplete（不再记结果不明、不暂停），任务失败 summary 写明「模型回答不完整」。 | 对得上 | [文档](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons) |
| `model_context_window_exceeded` | 200 | 输入或输出太长（`context_length`） | 否 | 生成填满了模型上下文窗口（Claude 4.5 及以后输入+max_tokens 超窗时会接受请求，到顶后以此停止）。 | 按截断处理，减小分块后重试。 | 只这一块失败：回答不完整（截断 / 被内容过滤）时不收半截译文：批量留下已用 &lt;&lt;&lt;END>>> 写完的块、其余拆单块重翻；单块重试一次后记这一块失败（degradation_reason=model_output_truncated / model_output_content_filter），收尾补救不成保留原文。Rust 执行器记 failed + output_incomplete（不再记结果不明、不暂停），任务失败 summary 写明「模型回答不完整」。 | 对得上 | [文档](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons) |
| `refusal` | 200 | 内容审核（`content_filter`） | 否 | 安全分类器拒答，按正常 200 返回而非错误；详情看 stop_details。 | 该段内容被拒答，请改写原文、换模型或跳过。 | 退避重试：拒答时 content 没有文字，抛错重试；用完后这一块失败、保留原文。 | 对得上 | [文档](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons) |

## 相关代码

- [`backend/packages/retainpdf-providers/src/model_executor/limits.rs`](../../../../backend/packages/retainpdf-providers/src/model_executor/limits.rs)
- [`backend/packages/retainpdf-providers/src/model_executor/upstream_codes.rs`](../../../../backend/packages/retainpdf-providers/src/model_executor/upstream_codes.rs)
- [`backend/packages/retainpdf-providers/src/upstream_limits.rs`](../../../../backend/packages/retainpdf-providers/src/upstream_limits.rs)
- [`backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py`](../../../../backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py)
- [`backend/translation-agent/retainpdf_translation_agent/agent.py`](../../../../backend/translation-agent/retainpdf_translation_agent/agent.py)
- [`backend/translation-agent/retainpdf_translation_agent_engine/agent_flow.py`](../../../../backend/translation-agent/retainpdf_translation_agent_engine/agent_flow.py)
- [`backend/translation-agent/retainpdf_translation_agent_engine/agent_openai.py`](../../../../backend/translation-agent/retainpdf_translation_agent_engine/agent_openai.py)
- [`backend/translation-classic/retainpdf_translation_classic/llm/shared/orchestration/batched_plain.py`](../../../../backend/translation-classic/retainpdf_translation_classic/llm/shared/orchestration/batched_plain.py)
- [`backend/translation-classic/retainpdf_translation_classic/llm/shared/orchestration/output_limit_failures.py`](../../../../backend/translation-classic/retainpdf_translation_classic/llm/shared/orchestration/output_limit_failures.py)
- [`backend/translation-classic/retainpdf_translation_classic/llm/shared/orchestration/single_item_flow.py`](../../../../backend/translation-classic/retainpdf_translation_classic/llm/shared/orchestration/single_item_flow.py)
- [`backend/translation/retainpdf_translation/llm/providers/deepseek/client.py`](../../../../backend/translation/retainpdf_translation/llm/providers/deepseek/client.py)
- [`backend/translation/retainpdf_translation/llm/providers/deepseek/transport.py`](../../../../backend/translation/retainpdf_translation/llm/providers/deepseek/transport.py)
- [`backend/translation/retainpdf_translation/llm/shared/model_wire.py`](../../../../backend/translation/retainpdf_translation/llm/shared/model_wire.py)
- [`backend/translation/retainpdf_translation/llm/shared/output_limits.py`](../../../../backend/translation/retainpdf_translation/llm/shared/output_limits.py)
- [`backend/translation/retainpdf_translation/llm/shared/rust_executor.py`](../../../../backend/translation/retainpdf_translation/llm/shared/rust_executor.py)
- [`backend/translation/retainpdf_translation/llm/shared/upstream_error_codes.py`](../../../../backend/translation/retainpdf_translation/llm/shared/upstream_error_codes.py)
- [`backend/translation/retainpdf_translation/llm/shared/upstream_resilience.py`](../../../../backend/translation/retainpdf_translation/llm/shared/upstream_resilience.py)

## 备注

- 429 有歧义：error.type 都是 rate_limit_error，但可能是 (a) 普通速率限制（有 retry-after，可重试），(b) 爬坡限制 error.details.error_code=ramp_limit_exceeded（有 retry-after，可重试但要慢慢加量）， (c) 档位月度消费封顶 error.details.error_code=enforced_spend_limit_reached（没有 retry-after，重试到下月都无用），(d) Claude Code 工作区的消费上限（带 retry-after）。 区分规则：先看 error.details.error_code；没有该字段时，429 且无 retry-after 头应按额度耗尽处理、不要自动重试。SDK 默认自动重试 2 次，会在封顶 429 上白白重试。
- 400 也有歧义：自设消费上限达到时返回 400 invalid_request_error（不是 429），只能靠 message 前缀 'You have reached your specified ... API usage limits' 识别；余额不足 'Your credit balance is too low' 同理只能看 message。
- 'Your credit balance is too low...' 的文本出自订阅者 API 额度页面，该页未写 HTTP 状态；400 invalid_request_error 属通用知识。402 billing_error 是另一种情况（支付信息问题）。
- 404 not_found_error 是通用的资源不存在，模型名写错时一般也是它，文档没有单独的 model_not_found 码。
- 500 可能是 api_error 也可能是 timeout_error，看 error.type。
- OAuth 应用代用户计费时另有 402 billing_error + linked_organization_spend_limit_reached / linked_organization_billing_unavailable、403 user_profile_not_billable 等码，RetainPDF 直连 API Key 不涉及，未收录。
- 预填、thinking 配置、tool_choice 等 400 校验错误见错误页 Common validation errors，只列了与翻译最相关的预填一条。
- docs.anthropic.com 无法直接抓取，内容取自当前官方文档站 platform.claude.com（含 .md 与 llms-full.txt）。

## 出处

- [Claude API errors](https://platform.claude.com/docs/en/api/errors)（抓取 2026-11-23）
- [Rate limits (spend caps, ramp limits, response headers)](https://platform.claude.com/docs/en/api/rate-limits)（抓取 2026-11-23）
- [Streaming messages (error events)](https://platform.claude.com/docs/en/build-with-claude/streaming)（抓取 2026-11-23）
- [Stop reasons and fallback](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons)（抓取 2026-11-23）
- [Context windows (overflow behavior)](https://platform.claude.com/docs/en/build-with-claude/context-windows)（抓取 2026-11-23）
- [API credits for subscribers (credit balance message)](https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers)（抓取 2026-11-23）
- [OAuth reference (billing errors, chat/completions error mapping)](https://platform.claude.com/docs/en/manage-claude/oauth-apps/oauth-reference)（抓取 2026-11-23）
