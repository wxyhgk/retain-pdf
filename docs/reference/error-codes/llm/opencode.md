<!-- 由 backend/api/src/api_tests/provider_error_codes.rs 从 backend/packages/retainpdf-providers/error-codes/ 生成，不要手改：
     UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes -->

# OpenCode Go 错误码

翻译模型服务商。接口主机：`opencode.ai`。数据：[`backend/packages/retainpdf-providers/error-codes/llm/opencode.json`](../../../../backend/packages/retainpdf-providers/error-codes/llm/opencode.json)；接口 `GET /api/v1/providers/error-codes?provider=opencode`。回到[错误码索引](../README.md)。

含义、提示都是转述，原文看每条的出处。

## 错误长什么样

OpenCode 没有统一的错误码文档。已文档化的形状只有两种：(1) Go 授权失败的 JSON {"type": "error", "error": {"type": "EntitlementError", "message": "..."}}（Anthropic 风格外壳，error.type 为 PascalCase 名字）；(2) 计费/预算失败时的文本 "Upstream request failed: Insufficient account funds" / "Upstream request failed: Policy budget exceeded"（文档以纯文本展示，未说明是否包在 JSON 里）。 其余情况只按 HTTP 状态区分：401 密钥问题、402 余额/信用额度、403 权限或订阅、429 预算。 Go 基址 https://opencode.ai/inference/go，协议路径 /openai/v1/responses、/openai/v1/chat/completions、/anthropic/v1/messages、/google/v1beta/models/&lt;model>:generateContent，Console 会在协议间互转。 成功响应在 usage 里带 cost 与 opencode.{billing_source, list_cost, allowance, tokens}。用量查询 GET /inference/go/v1/usage 返回 rolling/weekly/monthly 三个 meter（status ok|rate-limited、percent、resetsAt）。 Go 要求发送稳定的会话头 x-opencode-session 并使用自己的 User-Agent。

## 同一个状态有几种意思时怎么分

- 没有统一的错误码文档：Go 授权失败是 {type: "error", error: {type: "EntitlementError", message}}；计费、预算失败是文字 Upstream request failed: Insufficient account funds / Policy budget exceeded。
- 429 文档里只用于工作区预算（Policy budget exceeded，重试没用）；看 message 是否含 Policy budget exceeded，否则有 retry-after 再按限流处理，也可调 /inference/go/v1/usage 看哪个 meter 是 rate-limited。
- 403 可能是没有 Go 订阅（EntitlementError）、免费模型被非 OpenCode 客户端调用、或 Key 权限不够；看 error.type 和 message。
- 会把请求转给上游并在协议间翻译，上游原生错误是否透传、以什么形状透传文档没写，遇到未知错误按对应协议的错误形状解析。

## RetainPDF 怎么处理

中转站，走翻译请求层；接口地址是 opencode.ai 时自动带 x-opencode-session 会话头（#144）。按 HTTP 状态处理，另外 429 的 message 是「Policy budget exceeded」时整份停下归 upstream_quota_exhausted（2026-11-23）。

共 8 条：有缺口 1 条（高 0、中 0、低 1），碰不到 0 条。缺口按用户影响排的总表见[索引](../README.md#缺口汇总)。

## 错误码

码一栏是服务商返回的码；服务商没有码的，括号里是我们起的编号（接口里的 `id`）。

| 码 | HTTP | 大类 | 可重试 | 含义 | 给用户的提示 | 我们怎么处理 | 对不对得上 | 出处 |
|---|---|---|---|---|---|---|---|---|
| （invalid_key） | 401 | 鉴权失败（`auth`） | 否 | 没带密钥，或密钥无效、已过期、已吊销（过期密钥不能续期）。 | 在 OpenCode Console 重新创建 API Key 并填入。 | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://opencode.ai/docs/console/api/) |
| `EntitlementError` | 403 | 没有权限（`permission`） | 否 | 该密钥不在 Go 订阅覆盖范围内，例如工作区没有有效的 Go 订阅（message 如 "OpenCode Go subscription required."）。 | 在 OpenCode Console 订阅 Go，或用订阅者本人/服务账号的密钥；Go Plus 下其他成员的个人密钥不在覆盖内。 | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://opencode.ai/docs/console/go/) |
| （free_model_client_only） | 403 | 没有权限（`permission`） | 否 | 免费档聊天模型只允许在 OpenCode 自己的客户端里用，其他客户端即使带密钥也返回 403。 | 改用付费模型或 Go 订阅的模型。 | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://opencode.ai/docs/console/api/inference/) |
| （key_permission_insufficient） | 403 | 没有权限（`permission`） | 否 | 请求超出密钥权限，例如受限密钥没有 Models › Request（调用模型）或 Models › Read（列模型）。 | 在 Console 给密钥加上 Models › Request 权限，或换一个权限足够的密钥。 | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://opencode.ai/docs/console/api/) |
| （insufficient_account_funds） | 402 | 欠费或余额不足（`billing`） | 否 | 按量付费余额用完（余额不会变负），message 为 "Upstream request failed: Insufficient account funds"。 | 在 OpenCode Console 充值或开启自动充值。 | 整份翻译停下 → `upstream_quota_exhausted`：402 不重试，整份翻译停下，归「上游账户余额不足」，不可重试（agent 引擎报 QuotaExhausted）。 | 对得上 | [文档](https://opencode.ai/docs/console/billing/) |
| （credit_limit_reached） | 402 | 欠费或余额不足（`billing`） | 否 | 月结（发票）账户达到信用额度，或有发票逾期。 | 在 Console 支付逾期发票或联系 OpenCode 提高信用额度。 | 整份翻译停下 → `upstream_quota_exhausted`：402 不重试，整份翻译停下，归「上游账户余额不足」，不可重试（agent 引擎报 QuotaExhausted）。 | 对得上 | [文档](https://opencode.ai/docs/console/billing/) |
| （policy_budget_exceeded） | 429 | 额度或用量上限（`quota`） | 否 | 达到工作区预算（成员/服务账号/策略预算），message 为 "Upstream request failed: Policy budget exceeded"；响应不说明是哪个预算，到重置或管理员提额前一直失败。 | 请工作区管理员在 Console 提高预算，或等预算周期重置；在 Activity › Logs 可看到是哪条策略。 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：429 的 message 里有「Policy budget exceeded」（工作区预算用完；不限地址），认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://opencode.ai/docs/console/budgets/) |
| `rate-limited` | — | 额度或用量上限（`quota`） | 否 | Go 的 5 小时 / 每周 / 每月用量额度用完（用量接口里对应 meter 的 status 变为 rate-limited，resetsAt 给出重置时间）。超额请求返回的 HTTP 状态和错误体文档没有写明。 | 等 resetsAt 时间重置，或在 Console 的 Go 页面开启 Extra Usage 用余额继续，或升级 Go Plus。 | 退避重试 → `upstream_rate_limited`：Go 的时段额度用完时接口返回什么状态码官方没写；若是 429 就当限流退避到 300 秒上限。 | **缺口·低**：未核实。额度要等 resetsAt 才恢复，应按额度处理；可调 /inference/go/v1/usage 看哪个 meter 是 rate-limited。 | [文档](https://opencode.ai/docs/console/go/) |

## 相关代码

- [`backend/packages/retainpdf-providers/src/model_executor/upstream_codes.rs`](../../../../backend/packages/retainpdf-providers/src/model_executor/upstream_codes.rs)
- [`backend/packages/retainpdf-providers/src/upstream_limits.rs`](../../../../backend/packages/retainpdf-providers/src/upstream_limits.rs)
- [`backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py`](../../../../backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py)
- [`backend/translation-agent/retainpdf_translation_agent_engine/agent_flow.py`](../../../../backend/translation-agent/retainpdf_translation_agent_engine/agent_flow.py)
- [`backend/translation-agent/retainpdf_translation_agent_engine/agent_openai.py`](../../../../backend/translation-agent/retainpdf_translation_agent_engine/agent_openai.py)
- [`backend/translation/retainpdf_translation/llm/providers/deepseek/client.py`](../../../../backend/translation/retainpdf_translation/llm/providers/deepseek/client.py)
- [`backend/translation/retainpdf_translation/llm/providers/deepseek/transport.py`](../../../../backend/translation/retainpdf_translation/llm/providers/deepseek/transport.py)
- [`backend/translation/retainpdf_translation/llm/shared/upstream_error_codes.py`](../../../../backend/translation/retainpdf_translation/llm/shared/upstream_error_codes.py)
- [`backend/translation/retainpdf_translation/llm/shared/upstream_resilience.py`](../../../../backend/translation/retainpdf_translation/llm/shared/upstream_resilience.py)

## 备注

- 文档覆盖很少：没有错误码总表，没有 retry-after / 速率限制头的说明，没有 5xx / 过载 / 超时的说明，也没说明 Go 额度用完时请求返回什么状态码（只知道用量接口 status=rate-limited，以及开启 Extra Usage 后会改扣余额而不是拦截）。
- 429 歧义：文档里 429 只用于工作区预算（Policy budget exceeded，重试无用）。上游模型服务商的限速 429 是否原样透传、Go 额度耗尽是否也用 429，文档都没写；建议看 message 是否含 'Policy budget exceeded'，否则若有 retry-after 头再按限速处理，并可调用 /inference/go/v1/usage 看哪个 meter 是 rate-limited。
- 403 歧义：可能是没有 Go 订阅（EntitlementError）、免费模型被非 OpenCode 客户端调用、或密钥权限不够；看 error.type 和 message 区分。另外 Go 的部分模型受工作区隐私设置（地区 Global、允许训练数据的付费端点）限制，被拦时的状态码文档未写。
- 由于 Console 会把请求转给上游并在协议间翻译，上游（OpenAI/Anthropic 等）原生错误是否、以何种形状透传，文档未说明；遇到未知错误时应同时按对应协议（Responses/Chat/Messages）的错误形状解析。
- 非官方信息（仅供参考，未收录）：GitHub issue #25209 中用户贴出过 402 + {"error":{"code":"402","message":"Insufficient account balance","type":"insufficient_balance"}}；issue #34483 报告过 'Free usage exceeded, subscribe to go'。Bifrost 文档称 OpenCode 有自定义错误格式（示例 AuthError 'Invalid API key.'）。这些都不是 OpenCode 官方文档。
- opencode.ai 的 /docs/go.md 返回 HTML；使用的是 llms.txt 指向的 Markdown 版本（/docs/console/*.md），引用时用去掉 .md 的规范 URL。

## 出处

- [OpenCode Go (Console docs)](https://opencode.ai/docs/console/go/)（抓取 2026-11-23）
- [Console API overview (keys, permissions, revocation)](https://opencode.ai/docs/console/api/)（抓取 2026-11-23）
- [Console Inference API](https://opencode.ai/docs/console/api/inference/)（抓取 2026-11-23）
- [Console model list API (errors table)](https://opencode.ai/docs/console/api/models/)（抓取 2026-11-23）
- [Console budgets](https://opencode.ai/docs/console/budgets/)（抓取 2026-11-23）
- [Console billing](https://opencode.ai/docs/console/billing/)（抓取 2026-11-23）
- [Console harnesses (base URLs)](https://opencode.ai/docs/console/harnesses/)（抓取 2026-11-23）

## issue 里见过

- [#144](https://github.com/wxyhgk/retain-pdf/issues/144)：中转站要求的 x-opencode-session 请求头（v2026.11.22 已修）
