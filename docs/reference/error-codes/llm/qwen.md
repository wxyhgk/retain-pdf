<!-- 由 backend/api/src/api_tests/provider_error_codes.rs 从 backend/packages/retainpdf-providers/error-codes/ 生成，不要手改：
     UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes -->

# 阿里云百炼（千问 / DashScope） 错误码

翻译模型服务商。接口主机：`dashscope.aliyuncs.com`、`dashscope-intl.aliyuncs.com`。数据：[`backend/packages/retainpdf-providers/error-codes/llm/qwen.json`](../../../../backend/packages/retainpdf-providers/error-codes/llm/qwen.json)；接口 `GET /api/v1/providers/error-codes?provider=qwen`。回到[错误码索引](../README.md)。

含义、提示都是转述，原文看每条的出处。

## 错误长什么样

OpenAI 兼容模式（/compatible-mode/v1）的错误体是 OpenAI 风格：{"error": {"message": "...", "type": "invalid_request_error", "param": null, "code": "invalid_api_key"}}。错误码文档里写成“A/b”的条目（如 InvalidApiKey/invalid_api_key、Throttling.AllocationQuota/insufficient_quota），斜杠前是 DashScope 原生协议的 code，斜杠后是 OpenAI 兼容模式下 error.code 的取值；文档没给小写别名的码（如 Arrearage）在兼容模式下 code 直接是原生码，文档示例里 Arrearage 的 type 和 code 都是 Arrearage。同一个码下面可能挂多条不同的 message，具体原因要结合 error.message 看。Request ID 是 UUID，在响应头或响应体中；DashScope 原生协议的错误体是顶层 code/message/request_id。错误码页只在 RAG API 的重试表里提到 Retry-After 头，没有说明 OpenAI 兼容端点会不会返回。

## 同一个状态有几种意思时怎么分

- 兼容模式错误体是 OpenAI 风格 {error: {message, type, param, code}}。文档写成「A / b」的码，斜杠前是 DashScope 原生 code，斜杠后是兼容模式 error.code 的值（数据里放在 code 和 aliases）。
- 429 下既有可重试的限流 / 过载（Throttling.*），也有不可重试的计费类（CommodityNotPurchased、PrepaidBillOverdue、PostpaidBillOverdue、BudgetLimitExceeded）；先看 error.code，再看 error.message 是否含 free / quota exhausted。
- 欠费 Arrearage 可能是 400 也可能是 403，按 code 判断，不要按状态码判断。
- InternalError.Algo.InvalidParameter（400）既用于输入超长，也用于重复工具调用死循环，看 message（Range of input length / Repetitive tool calls）。
- Coding Plan 的五条是错误消息文字，不是独立的码；sk-sp- 开头的套餐 Key 配通用 Base URL 会 401 invalid_api_key。

## RetainPDF 怎么处理

走翻译请求层（OpenAI 兼容模式 /compatible-mode/v1）：401/403 整份停下、400 这个请求失败、429/5xx 退避重试、其他 4xx 只算这个请求失败。4xx 先读业务码（2026-11-23）：欠费、未订购、预算用完、免费额度用完即停（Arrearage、CommodityNotPurchased、PrepaidBillOverdue、PostpaidBillOverdue、BudgetLimitExceeded、AllocationQuota.FreeTierOnly）和 Coding Plan 时段额度用完整份停下，归 upstream_quota_exhausted；兼容模式的 insufficient_quota 是 TPM 限流，照旧退避（message 说免费额度用完的除外）。

共 46 条：有缺口 10 条（高 0、中 5、低 5），碰不到 2 条。缺口按用户影响排的总表见[索引](../README.md#缺口汇总)。

## 错误码

码一栏是服务商返回的码；服务商没有码的，括号里是我们起的编号（接口里的 `id`）。

| 码 | HTTP | 大类 | 可重试 | 含义 | 给用户的提示 | 我们怎么处理 | 对不对得上 | 出处 |
|---|---|---|---|---|---|---|---|---|
| `InvalidApiKey` / `invalid_api_key` | 401 | 鉴权失败（`auth`） | 否 | API Key 无效，或 Key 与地域、Base URL 不匹配 | 检查百炼 API Key 是否正确、是否已删除，以及 Key 与 Base URL 的地域是否一致（Coding Plan 的 sk-sp- Key 要配专属地址） | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `AccessDenied` / `access_denied` | 403 | 没有权限（`permission`） | 否 | 访问被拒：无权使用该模型、模型已下线、Key 限定了可用模型范围，或调用方式（同步/异步）不对 | 确认这个百炼 Key 有权调用该模型（检查 Key 的访问模型范围），模型没有下线 | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `AccessDenied.Unpurchased` | 403 | 没有权限（`permission`） | 否 | 还没有开通百炼服务 | 阿里云账号还没开通百炼，请登录百炼控制台开通（需要实名认证） | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `Model.AccessDenied` | 403 | 没有权限（`permission`） | 否 | 无权调用这个标准模型或自定义模型（常见于子业务空间 Key） | 当前业务空间没有该模型的调用授权，请在百炼控制台授权，或改用主账号的 Key | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `Workspace.AccessDenied` | 403 | 没有权限（`permission`） | 否 | 无权访问该业务空间的模型或应用 | 这个 Key 无权访问对应业务空间，请检查业务空间授权或改用主账号 Key | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `Endpoint.AccessDenied` | 403 | 模型不存在（`model_not_found`） | 否 | 调用端点被拒，常见原因是调用了已下线的模型快照 | 这个千问模型版本可能已下线，请换成推荐的替代模型 | 整份翻译停下 → `auth_failed`：按 403 整份停下，归「鉴权失败」。 | **缺口·低**：原因是调了已下线的模型快照，文案应提示换模型而不是换 Key。 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `AllocationQuota.FreeTierOnly` | 403 | 额度或用量上限（`quota`） | 否 | 免费额度已用完，且开了“免费额度用完即停”或账号未认证 | 百炼免费额度已用完，请在控制台关闭“免费额度用完即停”或完成认证并充值 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：error.code 是 AllocationQuota.FreeTierOnly（403，不再按 403 归鉴权失败），认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `Arrearage` | 400 | 欠费或余额不足（`billing`） | 否 | Key 所属阿里云账号欠费，访问被拒 | 阿里云账号欠费，请到“费用与成本”充值；资源包只抵扣特定模型和用量，超出部分仍会扣余额 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：error.code 是 Arrearage（400 或 403 都认），认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `InvalidParameter` | 400 | 请求参数错误（`invalid_request`） | 否 | 请求参数或格式不符合要求（具体看 message） | 请求参数不被百炼接受，请按错误信息调整模型参数（如 max_tokens、temperature、思考模式） | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。拒收 temperature、思考字段、json_schema 时自动降级重发。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `InvalidParameter.NotSupportEnableThinking` | 400 | 不支持的参数或调用方式（`unsupported`） | 否 | 这个模型不支持 enable_thinking 参数 | 该千问模型不支持思考模式开关，请去掉思考参数或换支持思考的模型 | 自动改请求重发：思考字段不被接受时退下一档（不带思考字段）再发。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `InternalError.Algo.InvalidParameter` | 400 | 输入或输出太长（`context_length`） | 否 | 算法侧参数错误，常见为输入长度超过模型上限，也用于检测到重复工具调用死循环 | 输入超过千问模型的上下文长度，请缩小每批翻译内容或换上下文更长的模型 | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。 | **缺口·低**：多半是输入超长，可以拆小批再发。 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `invalid_parameter_error` | 400 | 没有权限（`permission`） | 否 | OpenAI 兼容接口下，目标模型还没在模型市场开通 | 该模型在百炼模型市场还没开通，请先开通再调用 | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。 | **缺口·中**：模型没在模型市场开通是配置问题，应第一次就整份停下，提示去开通。 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `DataInspectionFailed` / `data_inspection_failed` | 400 | 内容审核（`content_filter`） | 否 | 输入或输出疑似含敏感内容，被内容安全拦截 | 这段内容触发了阿里云内容安全拦截，原样重试不会通过，可跳过该段或换服务商 | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。 | **缺口·低**：应标成「内容审核未过」，保留原文，不当成配置错误。 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `FaqRuleBlocked` | 400 | 内容审核（`content_filter`） | 否 | 输入或输出命中 FAQ 规则干预被拦截 | 内容被百炼的规则干预拦截，请修改内容或检查业务空间的干预规则 | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。 | **缺口·低**：应标成「内容审核未过」，保留原文，不当成配置错误。 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `InvalidParameter.DataInspection` | 400 | 文件问题（`file`） | 是 | 内容审核时下载图片或音频超时 | 百炼下载输入的图片或音频超时，请把文件放到国内可访问的存储后重试 | 碰不到：只在下载图片、音频做审核时出现，翻译请求是纯文本。 | — | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `ModelNotFound` / `model_not_found` | 404 | 模型不存在（`model_not_found`） | 否 | 模型不存在、名称写错、在该地域不可用，或未开通 | 检查千问模型名称拼写，确认该模型在当前地域可用且已开通 | 只这一块失败 → `python_unhandled_exception`：不重试；只算这个请求失败，不会像 401/402/403 那样整份停下；冒到任务层是「任务失败，但暂未识别出明确根因」。 | **缺口·中**：模型名写错或没开通时每个块各自失败，最后说不清原因。应和 401/403 一样第一次就整份停下，给「模型不存在」类失败，换模型后从翻译续跑。 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `model_not_supported` | 404 | 不支持的参数或调用方式（`unsupported`） | 否 | 该模型不支持 OpenAI 兼容方式调用 | 这个模型不能走 OpenAI 兼容接口，请换一个兼容模式支持的千问模型 | 只这一块失败 → `python_unhandled_exception`：不重试；只算这个请求失败，不会像 401/402/403 那样整份停下；冒到任务层是「任务失败，但暂未识别出明确根因」。 | **缺口·中**：模型名写错或没开通时每个块各自失败，最后说不清原因。应和 401/403 一样第一次就整份停下，给「模型不存在」类失败，换模型后从翻译续跑。 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `WorkSpaceNotFound` | 404 | 请求参数错误（`invalid_request`） | 否 | Base URL 里的业务空间不存在 | 检查 Base URL 里的业务空间 ID 是否正确，账号是否是该业务空间成员 | 只这一块失败 → `python_unhandled_exception`：不重试；只算这个请求失败，不会像 401/402/403 那样整份停下；冒到任务层是「任务失败，但暂未识别出明确根因」。 | **缺口·中**：模型名写错或没开通时每个块各自失败，最后说不清原因。应和 401/403 一样第一次就整份停下，给「模型不存在」类失败，换模型后从翻译续跑。Base URL 里的业务空间不对也是同一类配置错误。 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `NotFound` | 404 | 请求参数错误（`invalid_request`） | 否 | 要查询或操作的资源不存在，或请求路径不存在 | 请求地址或资源 ID 不对，请检查 Base URL 和接口路径 | 只这一块失败 → `python_unhandled_exception`：不重试；只算这个请求失败，不会像 401/402/403 那样整份停下；冒到任务层是「任务失败，但暂未识别出明确根因」。 | **缺口·中**：模型名写错或没开通时每个块各自失败，最后说不清原因。应和 401/403 一样第一次就整份停下，给「模型不存在」类失败，换模型后从翻译续跑。Base URL 里的业务空间不对也是同一类配置错误。 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `Throttling` | 429 | 限流（`rate_limit`） | 是 | 接口调用触发限流（笼统） | 请求太频繁触发了百炼限流，请降低并发后稍后重试 | 退避重试 → `upstream_rate_limited`：退避重试，认 Retry-After；单个请求累计等待超过 300 秒放弃，归「外部服务请求被限流」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `Throttling.RateQuota` / `limit_requests` | 429 | 限流（`rate_limit`） | 是 | 请求次数频率（RPS/RPM）超限 | 每分钟请求数超过百炼限额，请降低并发后重试 | 退避重试 → `upstream_rate_limited`：退避重试，认 Retry-After；单个请求累计等待超过 300 秒放弃，归「外部服务请求被限流」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `Throttling.BurstRate` / `limit_burst_rate` | 429 | 限流（`rate_limit`） | 是 | 请求量突然陡增，触发稳定性保护（尚未到限流阈值） | 请求量增长过快，请平滑发送（逐步增加并发、指数退避）后重试 | 退避重试 → `upstream_rate_limited`：退避重试，认 Retry-After；单个请求累计等待超过 300 秒放弃，归「外部服务请求被限流」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `Throttling.AllocationQuota` / `insufficient_quota` | 429 | 限流（`rate_limit`） | 是 | 每秒/每分钟 Token 用量（TPS/TPM）超限；也用于免费额度到期且该模型不支持按量付费等配额类情况 | Token 用量速度超过百炼限额，请降低并发或缩小每批内容后重试；若错误信息提到免费额度耗尽，需换模型或开通付费 | 退避重试 → `upstream_rate_limited`：TPS / TPM 限流照旧退避重试，认 Retry-After，单个请求累计等待超过 300 秒放弃。兼容模式下这个码是 insufficient_quota：百炼地址上只有 message 说免费额度用完（free tier、free quota、免费额度）时才按额度处理——第一次就停、整份翻译停下、归 upstream_quota_exhausted；其余照旧当限流。agent 引擎、Rust 模型执行器和检测接口同样这么分。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `Throttling.Concurrency` | 429 | 限流（`rate_limit`） | 是 | 并发请求数超出平台动态分配的上限 | 百炼并发数超限，稍等后重试，或降低并发 | 退避重试 → `upstream_rate_limited`：退避重试，认 Retry-After；单个请求累计等待超过 300 秒放弃，归「外部服务请求被限流」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `Throttling.ServiceOverloaded` | 429 | 服务繁忙（`overloaded`） | 是 | 平台资源过载，暂时处理不了 | 百炼服务繁忙，稍后重试 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `Throttling.ResourceExhausted` | 429 | 服务繁忙（`overloaded`） | 是 | 平台资源饱和，暂时处理不了 | 百炼服务繁忙，稍后重试 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `CommodityNotPurchased` | 429 | 欠费或余额不足（`billing`） | 否 | 业务空间还没订购 | 百炼业务空间未订购，请先订购 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：error.code 是 CommodityNotPurchased（429），认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `PrepaidBillOverdue` | 429 | 欠费或余额不足（`billing`） | 否 | 业务空间预付费账单已到期 | 百炼预付费账单到期，请续费 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：error.code 是 PrepaidBillOverdue（429），认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `PostpaidBillOverdue` | 429 | 欠费或余额不足（`billing`） | 否 | 后付费的模型推理商品已失效 | 百炼后付费账单逾期，请到阿里云费用中心处理 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：error.code 是 PostpaidBillOverdue（429），认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `BudgetLimitExceeded` | 429 | 欠费或余额不足（`billing`） | 否 | 预算管理里设的预算用完，且开了“达预算即停” | 百炼预算已用完，请在预算管理里提高预算或关闭“达预算即停” | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：error.code 是 BudgetLimitExceeded（429），认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `InternalError` / `internal_error` | 500 | 服务端错误（`server`） | 是 | 服务端内部错误 | 百炼服务端出错，稍后重试；持续出现请带 Request ID 联系阿里云 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `InternalError.Algo` | 500 | 服务端错误（`server`） | 是 | 模型推理服务异常（也可能是模型生成的工具调用 JSON 不合法） | 千问模型推理出错，先重试；反复出现可换模型 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `InternalError.Timeout` | 500 | 超时（`timeout`） | 是 | 异步任务提交后 3 小时内没出结果，超时 | 百炼异步任务超时，请检查任务状态后再决定是否重新提交 | 碰不到：只用于异步任务，翻译走同步调用。 | — | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `InternalError.Configuration` | 500 | 服务端错误（`server`） | 是 | 服务端配置异常 | 百炼服务端配置异常，稍后重试或联系阿里云 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `InternalError.DataInspection` | 500 | 服务端错误（`server`） | 是 | 内容审核服务暂时不可用 | 百炼内容审核服务暂不可用，稍后重试 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `InternalError.TranslationFailed` | 500 | 服务端错误（`server`） | 是 | 翻译处理失败 | 百炼翻译处理失败，稍后重试；仍失败请检查输入内容 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `SystemError` | 500 | 服务端错误（`server`） | 是 | 系统错误 | 百炼系统错误，稍后重试 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `ModelServiceFailed` | 500 | 服务端错误（`server`） | 是 | 调用模型服务失败 | 千问模型服务调用失败，稍后重试 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `RequestTimeOut` | 500 | 超时（`timeout`） | 是 | 请求超时（大模型非流式调用 300 秒超时） | 千问请求超过 300 秒超时，可改用流式输出或缩小每批内容后重试 | 退避重试 → `upstream_timeout`：按超时重试；用完后归「外部服务请求超时」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `ServiceUnavailable` | 500、503 | 服务繁忙（`overloaded`） | 是 | 系统容量不足，请求被限流（资源饱和） | 百炼服务容量不足，稍后重试 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `ModelUnavailable` | 503 | 服务繁忙（`overloaded`） | 是 | 模型暂时无法提供服务 | 这个千问模型暂时不可用，稍后重试或换模型 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/error-code) |
| `hour allocated quota exceeded` | — | 额度或用量上限（`quota`） | 否 | Coding Plan 每 5 小时请求额度用完（这是错误消息，不是独立的码） | 百炼 Coding Plan 的 5 小时额度用完，等额度恢复后再用 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：message 里有「hour allocated quota exceeded」（Coding Plan 时段额度，不看状态码），认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/coding-plan-faq) |
| `week allocated quota exceeded` | — | 额度或用量上限（`quota`） | 否 | Coding Plan 每周额度用完，周一 0 点（UTC+8）重置 | 百炼 Coding Plan 的周额度用完，等周一重置 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：message 里有「week allocated quota exceeded」（Coding Plan 时段额度，不看状态码），认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/coding-plan-faq) |
| `month allocated quota exceeded` | — | 额度或用量上限（`quota`） | 否 | Coding Plan 每月额度用完，订阅日 0 点（UTC+8）重置 | 百炼 Coding Plan 的月额度用完，等订阅日重置 | 整份翻译停下 → `upstream_quota_exhausted`：请求层读响应体业务码：message 里有「month allocated quota exceeded」（Coding Plan 时段额度，不看状态码），认出是余额、额度或预算用完，不再当限流退避或只算这一块失败：第一次就停，记下这组接口地址 + Key，同一次运行后面的请求不再发，整份翻译停下，归「上游账户余额或额度不足」（upstream_quota_exhausted，不可重试），报错和失败的 upstream 带 HTTP 状态和业务码；agent 引擎（OpenAI、Anthropic 两种协议）和 Rust 模型执行器规则相同。检测接口报欠费或额度用完（insufficient_balance / quota_exceeded），不再说「可用（当前被限流）」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/coding-plan-faq) |
| `concurrency allocated quota exceeded` | — | 限流（`rate_limit`） | 是 | Coding Plan 并发数超过平台动态上限 | 百炼 Coding Plan 并发超限，降低并发后稍等重试 | 退避重试 → `upstream_rate_limited`：退避重试，认 Retry-After；单个请求累计等待超过 300 秒放弃，归「外部服务请求被限流」。 | 对得上 | [文档](https://help.aliyun.com/zh/model-studio/coding-plan-faq) |
| `usage allocated quota exceeded` | 429 | 限流（`rate_limit`） | 否 | Coding Plan 短时间资源消耗过高，被临时限流（通常约一小时恢复） | 百炼 Coding Plan 短时用量过高被临时限流，约一小时后再试，或把大任务拆小分时段跑 | 退避重试 → `upstream_rate_limited`：429，当限流退避到 300 秒上限。 | **缺口·低**：官方说通常约一小时才恢复，300 秒内重试没用；应按消息文字直接停下，提示一小时后再试。 | [文档](https://help.aliyun.com/zh/model-studio/coding-plan-faq) |

## 相关代码

- [`backend/packages/retainpdf-providers/src/model_executor/upstream_codes.rs`](../../../../backend/packages/retainpdf-providers/src/model_executor/upstream_codes.rs)
- [`backend/packages/retainpdf-providers/src/upstream_limits.rs`](../../../../backend/packages/retainpdf-providers/src/upstream_limits.rs)
- [`backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py`](../../../../backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py)
- [`backend/translation-agent/retainpdf_translation_agent_engine/agent_flow.py`](../../../../backend/translation-agent/retainpdf_translation_agent_engine/agent_flow.py)
- [`backend/translation-agent/retainpdf_translation_agent_engine/agent_openai.py`](../../../../backend/translation-agent/retainpdf_translation_agent_engine/agent_openai.py)
- [`backend/translation/retainpdf_translation/llm/providers/deepseek/client.py`](../../../../backend/translation/retainpdf_translation/llm/providers/deepseek/client.py)
- [`backend/translation/retainpdf_translation/llm/providers/deepseek/transport.py`](../../../../backend/translation/retainpdf_translation/llm/providers/deepseek/transport.py)
- [`backend/translation/retainpdf_translation/llm/shared/model_wire.py`](../../../../backend/translation/retainpdf_translation/llm/shared/model_wire.py)
- [`backend/translation/retainpdf_translation/llm/shared/upstream_error_codes.py`](../../../../backend/translation/retainpdf_translation/llm/shared/upstream_error_codes.py)
- [`backend/translation/retainpdf_translation/llm/shared/upstream_resilience.py`](../../../../backend/translation/retainpdf_translation/llm/shared/upstream_resilience.py)

## 备注

- 429 歧义：429 下既有可重试的限流/过载（Throttling、Throttling.RateQuota、Throttling.BurstRate、Throttling.Concurrency、Throttling.ServiceOverloaded、Throttling.ResourceExhausted、Throttling.AllocationQuota 的 TPM 场景），也有不可重试的计费类（CommodityNotPurchased、PrepaidBillOverdue、PostpaidBillOverdue、BudgetLimitExceeded）。OpenAI 兼容页的状态码表里“429 You exceeded your current quota”被描述为“额度超限或者欠费”，而错误码页把 insufficient_quota（Throttling.AllocationQuota）解释为 TPS/TPM 限流，二者说法不一致；同一个 insufficient_quota 下还有“免费额度到期且不支持按量付费”这种不可重试的 message。区分办法：看 error.code，再看 error.message 是否含 free / quota exhausted 一类字样。
- 欠费的状态码：错误码页把 Arrearage 放在 400 一节，而快速排障表在 403 AccessDenied 一行写“消息涉及欠费时参见 Arrearage”，实际状态码可能是 400 也可能是 403，按 code 判断，不要按状态码判断。
- InternalError.Algo.InvalidParameter 的 HTTP 状态是 400，但同一个码既用于输入超长（context_length），也用于检测到重复工具调用死循环，需要看 message（Range of input length / Repetitive tool calls）。
- ServiceUnavailable 在 500 和 503 两节都出现，含义相同。
- Coding Plan 的五条（hour/week/month/concurrency/usage allocated quota exceeded）在官方文档里是错误消息字符串，不是独立错误码，这里用消息原文当 code，type 标为 coding_plan_message；只有 usage 一条在 Coding Plan FAQ 里写明是 429，其余状态码文档没写。
- OpenAI 兼容页另有一张笼统状态码表：400 Invalid Request Error、401 Invalid API-key provided、429 Rate limit reached、429 You exceeded your current quota、500 服务端错误、503 引擎过载可重试。
- 错误码页还列了大量多模态/语音/视频/知识库/Sandbox/RAG/ParseX 专用码（InvalidFile.*、Audio.*、BadRequest.*、KB_*、11900xxx 等），与文本翻译无关，未收录。英文版错误码页（help.aliyun.com/en/model-studio/error-code-start）未单独抓取比对。
- 用 sk-sp- 开头的套餐专属 Key 搭配通用 Base URL 会返回 401 invalid_api_key；用通用 Key 调 Token Plan 专属模型返回 403 access_denied。

## 出处

- [错误码 - 大模型服务平台百炼（Model Studio）](https://help.aliyun.com/zh/model-studio/error-code)（抓取 2026-11-23）
- [如何通过 OpenAI 接口调用千问模型（含异常响应示例和状态码说明）](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)（抓取 2026-11-23）
- [Coding Plan 常见问题](https://help.aliyun.com/zh/model-studio/coding-plan-faq)（抓取 2026-11-23）
