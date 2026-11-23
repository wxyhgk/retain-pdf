<!-- 由 backend/api/src/api_tests/provider_error_codes.rs 从 backend/packages/retainpdf-providers/error-codes/ 生成，不要手改：
     UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes -->

# 智谱（BigModel / Z.ai） 错误码

翻译模型服务商。接口主机：`open.bigmodel.cn`、`api.z.ai`。数据：[`backend/packages/retainpdf-providers/error-codes/llm/zhipu.json`](../../../../backend/packages/retainpdf-providers/error-codes/llm/zhipu.json)；接口 `GET /api/v1/providers/error-codes?provider=zhipu`。回到[错误码索引](../README.md)。

含义、提示都是转述，原文看每条的出处。

## 错误长什么样

两层：外层是 HTTP 状态码，内层是响应体里的业务码。响应体为 JSON：{"error": {"code": "1001", "message": "..."}}，code 是字符串形式的数字。判断原因要读 error.code，不能只看 HTTP 状态（429 同时承载限流、过载、欠费、套餐额度用完等多种业务码）。文档没有提到 Retry-After 或速率相关响应头。流式（SSE）调用中途异常终止时不返回这些错误码，而是在 finish_reason 里给原因。GLM-OCR 版面解析接口（POST /paas/v4/layout_parsing）共用这张业务码表，没有单独的错误码表；BigModel 版 OpenAPI 的 Error 结构是 error.code(string)/error.message，而 Z.ai 版 OpenAPI 把 Error 写成顶层 code(int32)/message，两站文档不一致，解析时两种形状都要兼容。

## 同一个状态有几种意思时怎么分

- 两层：外层 HTTP 状态，内层响应体业务码 {error: {code: "1113", message}}（code 是字符串形式的数字）。判断原因要读 error.code，不能只看状态码。
- 429 承载三类情况：可重试的限流 / 过载（1302 账户并发限制、1305 模型整体过载）；不可重试的计费（1113 欠费 / 余额不足、1309 编程套餐到期、1314 企业套餐失效）；短时间重试没用的套餐额度和限制（1308、1310、1316–1321 要等 next_flush_time 重置；1311 套餐不含该模型、1313 公平使用限制、1315 Key 类型不对）。
- 流式调用中途出错不返回业务码，看 finish_reason（sensitive、network_error）。
- BigModel 中文站和 Z.ai 英文站的码和状态完全相同，措辞有差异（1113、1234、1305、1318–1321）。

## RetainPDF 怎么处理

作翻译模型时走翻译请求层（OpenAI 兼容 chat，如 glm-5.3-flash）。4xx 先读业务码（2026-11-23，只认智谱地址）：1113、1308–1310、1313、1314、1316–1321 不再退避，整份停下归 upstream_quota_exhausted；1311、1315 整份停下归 auth_failed；1302 并发、1305 过载照旧当限流退避。规则和 GLM-OCR 那边（见 ocr/glm_ocr）一致。

共 35 条：有缺口 0 条（高 0、中 0、低 0），碰不到 0 条。缺口按用户影响排的总表见[索引](../README.md#缺口汇总)。

## 错误码

码一栏是服务商返回的码；服务商没有码的，括号里是我们起的编号（接口里的 `id`）。

| 码 | HTTP | 大类 | 可重试 | 含义 | 给用户的提示 | 我们怎么处理 | 对不对得上 | 出处 |
|---|---|---|---|---|---|---|---|---|
| （http_500） | 500 | 服务端错误（`server`） | 是 | 服务端内部错误，响应里没有业务码 | 智谱服务端出错，稍后重试；持续出现请联系智谱客服 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1000` | 401 | 鉴权失败（`auth`） | 否 | 身份验证没有通过 | 检查智谱 API Key 是否填对、是否已被删除或停用 | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1001` | 401 | 鉴权失败（`auth`） | 否 | 请求头里没有带鉴权信息 | 没有填写智谱 API Key，请在设置里补上 | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1003` | 401 | 鉴权失败（`auth`） | 否 | 鉴权 Token 已过期 | 智谱鉴权 Token 已过期，请重新生成 API Key 或 Token | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1005` | 401 | 鉴权失败（`auth`） | 否 | 账号开了二次认证保护，需要先完成二次认证 | 智谱账号要求二次认证，请先登录智谱控制台完成二次认证 | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1113` | 429 | 欠费或余额不足（`billing`） | 否 | 账户欠费或余额不足，也没有可用资源包 | 检查智谱账号余额或资源包，充值后再重试 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：智谱地址（bigmodel.cn、z.ai）上 error.code 或顶层 code 是 1113、1308–1310、1313、1314、1316–1321，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1200` | 500 | 服务端错误（`server`） | 是 | API 调用失败（笼统的服务端错误） | 智谱接口调用失败，稍后重试；持续出现请联系智谱客服 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1210` | 400 | 请求参数错误（`invalid_request`） | 否 | 请求参数有误 | 请求参数不被智谱接受，请检查模型设置（如温度、最大输出长度）后重试 | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1211` | 400 | 模型不存在（`model_not_found`） | 否 | 模型不存在，模型代码写错了 | 智谱找不到这个模型，请检查模型名称拼写 | 整份翻译停下 → `upstream_model_unavailable`：第一次被拒就整份停下（同一组 Key + 这个模型后面的请求不再发，同一个 Key 的别的模型照常），失败码 upstream_model_unavailable：提示改模型名、开通模型或核对接口地址，从翻译续跑；agent 停下原因 model_unavailable，Rust 执行器 error_code=model_unavailable。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1212` | 400 | 不支持的参数或调用方式（`unsupported`） | 否 | 当前模型不支持这种调用方式 | 这个智谱模型不支持当前调用方式（如同步/异步/流式），请换模型或换调用方式 | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1213` | 400 | 请求参数错误（`invalid_request`） | 否 | 缺少某个必填参数 | 请求缺少必填参数，请查看错误信息里提到的字段 | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1214` | 400 | 请求参数错误（`invalid_request`） | 否 | 某个参数取值非法 | 错误信息里提到的参数取值不合法，请调整后重试 | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1215` | 400 | 请求参数错误（`invalid_request`） | 否 | 两个互斥的参数被同时设置 | 错误信息里的两个参数不能同时设置，请只保留一个 | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1220` | 403 | 没有权限（`permission`） | 否 | 无权访问该接口 | 当前智谱账号或 Key 没有这个接口的权限，请在智谱控制台确认已开通 | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1221` | 400 | 不支持的参数或调用方式（`unsupported`） | 否 | 该接口已下线 | 智谱已下线这个接口，需要改用新的接口或模型 | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1222` | 400 | 请求参数错误（`invalid_request`） | 否 | 请求的接口不存在 | 请求地址不对，请检查 Base URL 和接口路径 | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1230` | 500 | 服务端错误（`server`） | 是 | 接口调用流程中出错 | 智谱服务处理出错，稍后重试；持续出现请联系智谱客服 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1234` | 500 | 服务端错误（`server`） | 是 | 网络错误，响应里附带错误 id | 智谱侧网络错误，稍后重试；持续出现请带上错误 id 联系智谱客服 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1261` | 400 | 输入或输出太长（`context_length`） | 否 | 提示词超长，超过模型上下文 | 输入内容超过模型上下文长度，请缩小每批翻译的内容或换上下文更长的模型 | 只这一块失败：单次请求太长：不再换参数重发同样的请求，批量拆成单块再发，单块仍太长这一块保留原文（死信，degradation_reason=request_too_long，不挡导出），不记凭据、不停整份。Rust 执行器不拆批：记 failed + request_too_long，任务失败 summary 写明「单次请求太长」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1301` | 400 | 内容审核（`content_filter`） | 否 | 输入或生成内容被判定可能不安全或敏感，被拦截 | 这段内容触发了智谱的内容安全拦截，原样重试不会通过，可跳过该段或换服务商 | 只这一块失败：不重试、不停整份：这一块保留原文（死信，degradation_reason=upstream_content_rejected），翻译诊断记「内容审核未过」；批量请求被拦时退到逐块，只有触发的块保留原文；Rust 执行器 error_code=content_rejected（不暂停）。agent 引擎按页请求，整个 agent 阶段失败。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1302` | 429 | 限流（`rate_limit`） | 是 | 触发账户速率（并发）限制 | 请求太密集，触发了智谱账号的并发限制，请降低并发数后重试 | 退避重试 → `upstream_rate_limited`：退避重试，认 Retry-After；单个请求累计等待超过 300 秒放弃，归「外部服务请求被限流」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/rate-limit) |
| `1305` | 429 | 服务繁忙（`overloaded`） | 是 | 该模型访问量过大，平台级过载保护 | 智谱这个模型当前访问量过大，稍后重试，重试间隔逐步拉长 | 退避重试 → `upstream_rate_limited`：退避重试，认 Retry-After；单个请求累计等待超过 300 秒放弃，归「外部服务请求被限流」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/rate-limit) |
| `1308` | 429 | 额度或用量上限（`quota`） | 否 | 达到某个时间窗口的用量上限，到重置时间后恢复（多见于 Coding Plan） | 已达到智谱套餐的用量上限，等到错误信息里的重置时间后再用，或改用按量付费的标准 Key | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：智谱地址（bigmodel.cn、z.ai）上 error.code 或顶层 code 是 1113、1308–1310、1313、1314、1316–1321，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1309` | 429 | 欠费或余额不足（`billing`） | 否 | GLM Coding Plan 套餐已到期 | 智谱 GLM Coding Plan 已到期，请续订，或换成按量付费的标准 API Key | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：智谱地址（bigmodel.cn、z.ai）上 error.code 或顶层 code 是 1113、1308–1310、1313、1314、1316–1321，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1310` | 429 | 额度或用量上限（`quota`） | 否 | 达到每周或每月用量上限，到重置时间后恢复 | 已达到智谱套餐的周/月用量上限，等到重置时间，或改用按量付费的标准 Key | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：智谱地址（bigmodel.cn、z.ai）上 error.code 或顶层 code 是 1113、1308–1310、1313、1314、1316–1321，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1311` | 429 | 没有权限（`permission`） | 否 | 当前订阅套餐不包含这个模型 | 当前智谱套餐不能用这个模型，请换套餐内的模型或改用标准 API Key | 整份翻译停下 → `auth_failed`：请求层读智谱地址上的 error.code（也认顶层 code），1311、1315 是这个 Key 的套餐不能用这个模型，不再当限流退避：和 401/403 一样第一次就停，同一次运行后面的请求不再发，整份翻译停下，归「鉴权失败」（auth_failed），报错写明「这个 Key 的套餐不包含这个模型 / 类型不能调用」并带 HTTP 状态和业务码，换 Key 后可从翻译续跑；agent 引擎和 Rust 模型执行器规则相同。检测接口报 unauthorized（套餐不含）。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1313` | 429 | 限流（`rate_limit`） | 否 | 使用方式不符合公平使用策略，请求频率被平台限制 | 智谱判定使用方式不符合公平使用策略并限了频，需要在智谱个人中心申请解除限制 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：智谱地址（bigmodel.cn、z.ai）上 error.code 或顶层 code 是 1113、1308–1310、1313、1314、1316–1321，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1314` | 429 | 欠费或余额不足（`billing`） | 否 | 企业套餐已失效 | 智谱企业套餐已失效，请联系企业管理员 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：智谱地址（bigmodel.cn、z.ai）上 error.code 或顶层 code 是 1113、1308–1310、1313、1314、1316–1321，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1315` | 429 | 没有权限（`permission`） | 否 | 这个 Key 只能用于企业编程套餐场景 | 这个智谱 Key 是企业编程套餐专用的，请到官网换成对应产品类型的 Key | 整份翻译停下 → `auth_failed`：请求层读智谱地址上的 error.code（也认顶层 code），1311、1315 是这个 Key 的套餐不能用这个模型，不再当限流退避：和 401/403 一样第一次就停，同一次运行后面的请求不再发，整份翻译停下，归「鉴权失败」（auth_failed），报错写明「这个 Key 的套餐不包含这个模型 / 类型不能调用」并带 HTTP 状态和业务码，换 Key 后可从翻译续跑；agent 引擎和 Rust 模型执行器规则相同。检测接口报 unauthorized（套餐不含）。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1316` | 429 | 额度或用量上限（`quota`） | 否 | 达到 5 小时用量上限，且主账号余额不足，无法超额按量付费 | 智谱套餐 5 小时额度已用完且余额不足，充值或等到重置时间 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：智谱地址（bigmodel.cn、z.ai）上 error.code 或顶层 code 是 1113、1308–1310、1313、1314、1316–1321，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1317` | 429 | 额度或用量上限（`quota`） | 否 | 达到 7 天用量上限，且主账号余额不足，无法超额按量付费 | 智谱套餐 7 天额度已用完且余额不足，充值或等到重置时间 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：智谱地址（bigmodel.cn、z.ai）上 error.code 或顶层 code 是 1113、1308–1310、1313、1314、1316–1321，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1318` | 429 | 额度或用量上限（`quota`） | 否 | 达到 5 小时用量上限，且子账号月消费已到上限，不能超额付费 | 智谱 5 小时额度已用完，子账号月消费也到上限，请联系管理员调整或等到重置时间 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：智谱地址（bigmodel.cn、z.ai）上 error.code 或顶层 code 是 1113、1308–1310、1313、1314、1316–1321，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1319` | 429 | 额度或用量上限（`quota`） | 否 | 达到 7 天用量上限，且子账号月消费已到上限，不能超额付费 | 智谱 7 天额度已用完，子账号月消费也到上限，请联系管理员调整或等到重置时间 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：智谱地址（bigmodel.cn、z.ai）上 error.code 或顶层 code 是 1113、1308–1310、1313、1314、1316–1321，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1320` | 429 | 额度或用量上限（`quota`） | 否 | 达到 5 小时用量上限，且企业级月消费已到上限，不能超额付费 | 智谱 5 小时额度已用完，企业月消费也到上限，请联系管理员调整或等到重置时间 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：智谱地址（bigmodel.cn、z.ai）上 error.code 或顶层 code 是 1113、1308–1310、1313、1314、1316–1321，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1321` | 429 | 额度或用量上限（`quota`） | 否 | 达到 7 天用量上限，且企业级月消费已到上限，不能超额付费 | 智谱 7 天额度已用完，企业月消费也到上限，请联系管理员调整或等到重置时间 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：智谱地址（bigmodel.cn、z.ai）上 error.code 或顶层 code 是 1113、1308–1310、1313、1314、1316–1321，认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |

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
- [`backend/translation-classic/retainpdf_translation_classic/llm/shared/orchestration/terminal_payloads.py`](../../../../backend/translation-classic/retainpdf_translation_classic/llm/shared/orchestration/terminal_payloads.py)
- [`backend/translation/retainpdf_translation/llm/providers/deepseek/client.py`](../../../../backend/translation/retainpdf_translation/llm/providers/deepseek/client.py)
- [`backend/translation/retainpdf_translation/llm/providers/deepseek/transport.py`](../../../../backend/translation/retainpdf_translation/llm/providers/deepseek/transport.py)
- [`backend/translation/retainpdf_translation/llm/shared/output_limits.py`](../../../../backend/translation/retainpdf_translation/llm/shared/output_limits.py)
- [`backend/translation/retainpdf_translation/llm/shared/rust_executor.py`](../../../../backend/translation/retainpdf_translation/llm/shared/rust_executor.py)
- [`backend/translation/retainpdf_translation/llm/shared/upstream_error_codes.py`](../../../../backend/translation/retainpdf_translation/llm/shared/upstream_error_codes.py)
- [`backend/translation/retainpdf_translation/llm/shared/upstream_resilience.py`](../../../../backend/translation/retainpdf_translation/llm/shared/upstream_resilience.py)

## 备注

- 429 歧义：HTTP 429 承载三类完全不同的情况，必须看 error.code 区分——可重试的限流/过载（1302 账户并发限制、1305 模型整体过载，退避后重试即可）；不可重试的计费（1113 欠费/余额不足、1309 Coding Plan 到期、1314 企业套餐失效）；不可短期重试的套餐额度和限制（1308、1310、1316–1321 要等错误信息里的 next_flush_time 重置；1311 套餐不含该模型、1313 公平使用限频需人工申诉、1315 Key 类型不对）。1308/1310/1316–1321 标为 retryable=false 是指短时间内重试无用，到重置时间后可恢复。
- 两站差异（BigModel 中文 vs Z.ai 英文）：业务码集合和 HTTP 状态完全相同；措辞差异——1113 中文写“账户已欠费”，英文写“余额不足或没有资源包”；1234 中文让“联系客服”，英文让“稍后重试”；1305 中文是“该模型访问量过大”，英文是“服务可能暂时过载”；1005 中文说明是开了二次认证保护；1309 续订链接不同（bigmodel.cn/claude-code vs z.ai/subscribe）；1313 解除限制的途径不同；1318/1319 中文明确是“子账号月消费上限”、1320/1321 是“企业级月消费上限”，英文版 1318–1321 统一写成 monthly spend limit，看不出子账号/企业之分。示例域名分别是 open.bigmodel.cn 和 open.z.ai。
- 文档表里没有的码（不要自行假设）：1002、1004、1100–1112 等 1100 段其他码、1312、1216–1219、1223–1229 等都不在两站的官方表里；任务描述里提到的“1100 段余额/账户”在官方表中只有 1113 一个。
- GLM-OCR 版面解析（/paas/v4/layout_parsing）文档只给了通用 Error 结构，没有专属业务码；两站 OpenAPI 定义的 Error 形状不一致（见 error_shape）。
- Coding Plan Key：Z.ai 自 2026-10-16 起标准 API Key 与 Coding Plan Key 分开管理，Key 类型决定计费方式；用 Coding Plan Key 调用标准接口、或计划到期后的兼容 Key 继续调套餐端点，可能触发 1309/1311/1315 一类错误（文档未逐一对应，属推断）。
- 速率限制页（BigModel）说明 1302 是账户维度的并发上限（同时在处理中的请求数），1305 是平台级过载，与单个账户行为无关；没有提到 Retry-After 头。Z.ai 的 rate-limit 页面 .md 版本跳转成网站 HTML，未能读取，1302/1305 的解释只取自 BigModel。
- 流式调用中途出错不返回业务码，看 finish_reason。

## 出处

- [错误码（智谱开放平台 BigModel 中文文档；/cn/faq/api-code 内容完全相同）](https://docs.bigmodel.cn/cn/api/api-code)（抓取 2026-11-23）
- [Errors（Z.ai 国际站）](https://docs.z.ai/api-reference/api-code)（抓取 2026-11-23）
- [速率限制（BigModel，解释 1302 / 1305）](https://docs.bigmodel.cn/cn/api/rate-limit)（抓取 2026-11-23）
- [文档解析 POST /paas/v4/layout_parsing（GLM-OCR，BigModel）](https://docs.bigmodel.cn/api-reference/模型-api/文档解析)（抓取 2026-11-23）
- [Layout Parsing（GLM-OCR，Z.ai）](https://docs.z.ai/api-reference/tools/layout-parsing)（抓取 2026-11-23）
- [API Key Management Guide（Z.ai，标准 Key 与 Coding Plan Key 分开管理）](https://docs.z.ai/devpack/notice/api-key-management)（抓取 2026-11-23）
