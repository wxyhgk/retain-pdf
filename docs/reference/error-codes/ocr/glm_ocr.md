<!-- 由 backend/api/src/api_tests/provider_error_codes.rs 从 backend/packages/retainpdf-providers/error-codes/ 生成，不要手改：
     UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes -->

# GLM-OCR（智谱 layout_parsing） 错误码

OCR 服务商。接口主机：`open.bigmodel.cn`、`api.z.ai`。数据：[`backend/packages/retainpdf-providers/error-codes/ocr/glm_ocr.json`](../../../../backend/packages/retainpdf-providers/error-codes/ocr/glm_ocr.json)；接口 `GET /api/v1/providers/error-codes?provider=glm_ocr`。回到[错误码索引](../README.md)。

含义、提示都是转述，原文看每条的出处。

## 错误长什么样

同步接口 POST /api/paas/v4/layout_parsing（open.bigmodel.cn 或 api.z.ai），成功 HTTP 200 直接返回整份结果（id、md_results、layout_details、data_info、usage），没有任务号轮询。失败时 HTTP 状态 + body {error: {code: &lt;字符串业务码>, message}}，业务码用智谱通用码表（12xx 参数类随 400、1220 随 403、11xx/13xx 额度与限流类随 429、500 内部错误）。

## 同一个状态有几种意思时怎么分

- 429 必须看业务码 error.code：1302、1305 是限流 / 过载（重试）；1113 是余额不足；1308–1321、1309、1311、1313–1315 是套餐、用量上限、Key 类型问题，短时间重试没用。
- 错误体有两种写法：BigModel 文档是 {error: {code: "1113"（字符串）, message}}，Z.ai 的 layout-parsing OpenAPI 写的是顶层 {code: 1113（整数）, message}。两种都要认；仓库 _error_code 现在只读 error.code，读不到时退回按 HTTP 状态处理。
- 码表和智谱通用码表相同（见 llm/zhipu），这里只列 GLM-OCR 场景下碰得到、处理方式和翻译不同的码。

## RetainPDF 怎么处理

Python：glm_ocr_api.py 的 parse_pdf 经 retry.py 的 request_with_retry 发请求：408/429/5xx 和网络错误重试 5 次，退避起步 15 秒，认 Retry-After，429 累计等待有上限；429 先看业务码，FAIL_FAST_CODES（1113、1308–1321 等）第一次就停（#164，2026-11-23 已修）；其余 4xx 抛 GlmOcrRequestRejected 不重试；5xx 用完重试后驱动把这一片拆成逐页再发。

共 32 条：有缺口 0 条（高 0、中 0、低 0），碰不到 0 条。缺口按用户影响排的总表见[索引](../README.md#缺口汇总)。

## 错误码

码一栏是服务商返回的码；服务商没有码的，括号里是我们起的编号（接口里的 `id`）。

| 码 | HTTP | 大类 | 可重试 | 含义 | 给用户的提示 | 我们怎么处理 | 对不对得上 | 出处 |
|---|---|---|---|---|---|---|---|---|
| `1214` | 400 | 请求参数错误（`invalid_request`） | 否 | 参数值不合法；GLM-OCR 下典型情况是 file 传了裸 base64、没带 data:application/pdf;base64, 前缀 | GLM-OCR 请求参数不合法（文件需带 data URI 前缀），请升级或反馈问题 | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request：「GLM-OCR 拒绝了请求（码）：…」。 | 对得上 | [文档](https://docs.z.ai/api-reference/api-code) |
| `1210` | 400 | 请求参数错误（`invalid_request`） | 否 | 调用参数有误（如 start_page_id/end_page_id 等取值不对） | GLM-OCR 请求参数有误，请检查页码范围等参数 | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request：「GLM-OCR 拒绝了请求（码）：…」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/faq/api-code) |
| `1211` | 400 | 模型不存在（`model_not_found`） | 否 | 模型不存在（layout_parsing 只接受 glm-ocr） | GLM-OCR 模型名不对，请确认使用 glm-ocr | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request：「GLM-OCR 拒绝了请求（码）：…」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/faq/api-code) |
| `1213` | 400 | 请求参数错误（`invalid_request`） | 否 | 缺少必需参数（如 model 或 file） | GLM-OCR 请求缺少必需参数，请反馈问题 | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request：「GLM-OCR 拒绝了请求（码）：…」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/faq/api-code) |
| `1220` | 403 | 没有权限（`permission`） | 否 | 当前 API Key 无权调用该接口（layout_parsing） | 当前智谱 API Key 无权调用 GLM-OCR，请换用有权限的 Key | 不重试，任务失败 → `auth_failed`：GlmOcrRequestRejected 带上 status_code / provider_code，归 auth_failed：「GLM-OCR 鉴权失败（码）：…」，建议按智谱 API Key 说。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/faq/api-code) |
| `1113` | 429 | 欠费或余额不足（`billing`） | 否 | 账户余额不足或没有资源包（虽是 429 但不是限流） | 智谱账号余额或资源包不足，请充值后再试或换一个有余额的 API Key | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，抛 GlmOcrQuotaExhausted，报中文原因、HTTP 状态和业务码，归「上游账户余额或额度不足」，不可重试（#164 已修）。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.z.ai/api-reference/api-code) |
| `1302` | 429 | 限流（`rate_limit`） | 是 | 请求频率超限 | GLM-OCR 请求太频繁，稍后会自动重试；可减少并发 | 退避重试 → `upstream_rate_limited`：退避重试 5 次（起步 15 秒，认 Retry-After，429 累计等待有上限），用完抛 GlmOcrRateLimited，报 HTTP 状态和业务码，归「外部服务请求被限流」。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.z.ai/api-reference/api-code) |
| `1305` | 429 | 服务繁忙（`overloaded`） | 是 | 服务访问量过大，暂时繁忙 | GLM-OCR 服务繁忙，请稍后重试 | 退避重试 → `upstream_rate_limited`：退避重试 5 次（起步 15 秒，认 Retry-After，429 累计等待有上限），用完抛 GlmOcrRateLimited，报 HTTP 状态和业务码，归「外部服务请求被限流」。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.z.ai/api-reference/api-code) |
| （http_500） | 500 | 服务端错误（`server`） | 是 | 服务端内部错误，响应里没有业务码 | 智谱服务端出错，稍后重试；持续出现请联系智谱客服 | 退避重试：5xx 重试 5 次；用完抛 GlmOcrServerError，驱动把这一片拆成逐页再发（超大图纸页可能稳定 500）。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1000` | 401 | 鉴权失败（`auth`） | 否 | 身份验证没有通过 | 检查智谱 API Key 是否填对、是否已被删除或停用 | 不重试，任务失败 → `auth_failed`：GlmOcrRequestRejected 带上 status_code / provider_code，归 auth_failed：「GLM-OCR 鉴权失败（码）：…」，建议按智谱 API Key 说。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1001` | 401 | 鉴权失败（`auth`） | 否 | 请求头里没有带鉴权信息 | 没有填写智谱 API Key，请在设置里补上 | 不重试，任务失败 → `auth_failed`：GlmOcrRequestRejected 带上 status_code / provider_code，归 auth_failed：「GLM-OCR 鉴权失败（码）：…」，建议按智谱 API Key 说。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1003` | 401 | 鉴权失败（`auth`） | 否 | 鉴权 Token 已过期 | 智谱鉴权 Token 已过期，请重新生成 API Key 或 Token | 不重试，任务失败 → `auth_failed`：GlmOcrRequestRejected 带上 status_code / provider_code，归 auth_failed：「GLM-OCR 鉴权失败（码）：…」，建议按智谱 API Key 说。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1005` | 401 | 鉴权失败（`auth`） | 否 | 账号开了二次认证保护，需要先完成二次认证 | 智谱账号要求二次认证，请先登录智谱控制台完成二次认证 | 不重试，任务失败 → `auth_failed`：GlmOcrRequestRejected 带上 status_code / provider_code，归 auth_failed：「GLM-OCR 鉴权失败（码）：…」，建议按智谱 API Key 说。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1200` | 500 | 服务端错误（`server`） | 是 | API 调用失败（笼统的服务端错误） | 智谱接口调用失败，稍后重试；持续出现请联系智谱客服 | 退避重试：5xx 重试 5 次；用完抛 GlmOcrServerError，驱动把这一片拆成逐页再发（超大图纸页可能稳定 500）。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1230` | 500 | 服务端错误（`server`） | 是 | 接口调用流程中出错 | 智谱服务处理出错，稍后重试；持续出现请联系智谱客服 | 退避重试：5xx 重试 5 次；用完抛 GlmOcrServerError，驱动把这一片拆成逐页再发（超大图纸页可能稳定 500）。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1234` | 500 | 服务端错误（`server`） | 是 | 网络错误，响应里附带错误 id | 智谱侧网络错误，稍后重试；持续出现请带上错误 id 联系智谱客服 | 退避重试：5xx 重试 5 次；用完抛 GlmOcrServerError，驱动把这一片拆成逐页再发（超大图纸页可能稳定 500）。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1261` | 400 | 输入或输出太长（`context_length`） | 否 | 提示词超长，超过模型上下文 | 输入内容超过模型上下文长度，请缩小每批翻译的内容或换上下文更长的模型 | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request：「GLM-OCR 拒绝了请求（码）：…」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1301` | 400 | 内容审核（`content_filter`） | 否 | 输入或生成内容被判定可能不安全或敏感，被拦截 | 这段内容触发了智谱的内容安全拦截，原样重试不会通过，可跳过该段或换服务商 | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request：「GLM-OCR 内容审核拦截了这份文件（1301）：…」。 | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1308` | 429 | 额度或用量上限（`quota`） | 否 | 达到某个时间窗口的用量上限，到重置时间后恢复（多见于 Coding Plan） | 已达到智谱套餐的用量上限，等到错误信息里的重置时间后再用，或改用按量付费的标准 Key | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，抛 GlmOcrQuotaExhausted，报中文原因、HTTP 状态和业务码，归「上游账户余额或额度不足」，不可重试（#164 已修）。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1309` | 429 | 欠费或余额不足（`billing`） | 否 | GLM Coding Plan 套餐已到期 | 智谱 GLM Coding Plan 已到期，请续订，或换成按量付费的标准 API Key | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，抛 GlmOcrQuotaExhausted，报中文原因、HTTP 状态和业务码，归「上游账户余额或额度不足」，不可重试（#164 已修）。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1310` | 429 | 额度或用量上限（`quota`） | 否 | 达到每周或每月用量上限，到重置时间后恢复 | 已达到智谱套餐的周/月用量上限，等到重置时间，或改用按量付费的标准 Key | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，抛 GlmOcrQuotaExhausted，报中文原因、HTTP 状态和业务码，归「上游账户余额或额度不足」，不可重试（#164 已修）。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1311` | 429 | 没有权限（`permission`） | 否 | 当前订阅套餐不包含这个模型 | 当前智谱套餐不能用这个模型，请换套餐内的模型或改用标准 API Key | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，中文原因说明是 Key 的套餐不对（#164 已修）。失败码借用「余额或额度不足」，原因看 summary 里的中文说明。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1313` | 429 | 限流（`rate_limit`） | 否 | 使用方式不符合公平使用策略，请求频率被平台限制 | 智谱判定使用方式不符合公平使用策略并限了频，需要在智谱个人中心申请解除限制 | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，抛 GlmOcrQuotaExhausted，报中文原因、HTTP 状态和业务码，归「上游账户余额或额度不足」，不可重试（#164 已修）。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1314` | 429 | 欠费或余额不足（`billing`） | 否 | 企业套餐已失效 | 智谱企业套餐已失效，请联系企业管理员 | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，抛 GlmOcrQuotaExhausted，报中文原因、HTTP 状态和业务码，归「上游账户余额或额度不足」，不可重试（#164 已修）。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1315` | 429 | 没有权限（`permission`） | 否 | 这个 Key 只能用于企业编程套餐场景 | 这个智谱 Key 是企业编程套餐专用的，请到官网换成对应产品类型的 Key | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，中文原因说明是 Key 的套餐不对（#164 已修）。失败码借用「余额或额度不足」，原因看 summary 里的中文说明。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1316` | 429 | 额度或用量上限（`quota`） | 否 | 达到 5 小时用量上限，且主账号余额不足，无法超额按量付费 | 智谱套餐 5 小时额度已用完且余额不足，充值或等到重置时间 | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，抛 GlmOcrQuotaExhausted，报中文原因、HTTP 状态和业务码，归「上游账户余额或额度不足」，不可重试（#164 已修）。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1317` | 429 | 额度或用量上限（`quota`） | 否 | 达到 7 天用量上限，且主账号余额不足，无法超额按量付费 | 智谱套餐 7 天额度已用完且余额不足，充值或等到重置时间 | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，抛 GlmOcrQuotaExhausted，报中文原因、HTTP 状态和业务码，归「上游账户余额或额度不足」，不可重试（#164 已修）。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1318` | 429 | 额度或用量上限（`quota`） | 否 | 达到 5 小时用量上限，且子账号月消费已到上限，不能超额付费 | 智谱 5 小时额度已用完，子账号月消费也到上限，请联系管理员调整或等到重置时间 | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，抛 GlmOcrQuotaExhausted，报中文原因、HTTP 状态和业务码，归「上游账户余额或额度不足」，不可重试（#164 已修）。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1319` | 429 | 额度或用量上限（`quota`） | 否 | 达到 7 天用量上限，且子账号月消费已到上限，不能超额付费 | 智谱 7 天额度已用完，子账号月消费也到上限，请联系管理员调整或等到重置时间 | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，抛 GlmOcrQuotaExhausted，报中文原因、HTTP 状态和业务码，归「上游账户余额或额度不足」，不可重试（#164 已修）。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1320` | 429 | 额度或用量上限（`quota`） | 否 | 达到 5 小时用量上限，且企业级月消费已到上限，不能超额付费 | 智谱 5 小时额度已用完，企业月消费也到上限，请联系管理员调整或等到重置时间 | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，抛 GlmOcrQuotaExhausted，报中文原因、HTTP 状态和业务码，归「上游账户余额或额度不足」，不可重试（#164 已修）。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| `1321` | 429 | 额度或用量上限（`quota`） | 否 | 达到 7 天用量上限，且企业级月消费已到上限，不能超额付费 | 智谱 7 天额度已用完，企业月消费也到上限，请联系管理员调整或等到重置时间 | 不重试，任务失败 → `upstream_quota_exhausted`：在 FAIL_FAST_CODES 里：第一次就停，抛 GlmOcrQuotaExhausted，报中文原因、HTTP 状态和业务码，归「上游账户余额或额度不足」，不可重试（#164 已修）。（[#164](https://github.com/wxyhgk/retain-pdf/issues/164)） | 对得上 | [文档](https://docs.bigmodel.cn/cn/api/api-code) |
| （missing_layout_details） | 200 | 其他（`other`） | 是 | HTTP 200 但返回的不是 JSON，或者没有 layout_details（官方文档没有这一条，是 RetainPDF 自己的检查）。 | 稍后重试；反复出现时把任务日志里的返回内容反馈给我们。 | 退避重试：5xx 重试 5 次；用完抛 GlmOcrServerError，驱动把这一片拆成逐页再发（超大图纸页可能稳定 500）。 | 对得上 | [文档](https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E6%96%87%E6%A1%A3%E8%A7%A3%E6%9E%90.md) |

## 相关代码

- [`backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py`](../../../../backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py)
- [`backend/pipeline/retainpdf_pipeline/ocr/ocr_provider/glm_ocr_api.py`](../../../../backend/pipeline/retainpdf_pipeline/ocr/ocr_provider/glm_ocr_api.py)
- [`backend/pipeline/retainpdf_pipeline/ocr/ocr_provider/glm_ocr_driver.py`](../../../../backend/pipeline/retainpdf_pipeline/ocr/ocr_provider/glm_ocr_driver.py)
- [`backend/pipeline/retainpdf_pipeline/ocr/provider_failures.py`](../../../../backend/pipeline/retainpdf_pipeline/ocr/provider_failures.py)
- [`backend/pipeline/retainpdf_pipeline/ocr/retry.py`](../../../../backend/pipeline/retainpdf_pipeline/ocr/retry.py)

## 备注

- GLM-OCR 共用智谱通用码表（见 llm/zhipu）；这里收了 GLM-OCR 碰得到的码，含义同智谱表，处理方式按 GLM-OCR 这条代码路径写。
- 1214 与 data URI 前缀的关系官方没写：官方只说 file 支持 URL 或 base64；'裸 base64 会 400/1214、必须带 data:application/pdf;base64, 前缀' 是仓库 glm_ocr_api.py 文档串里记的实测经验（外部 CLI，2026-10-16），code 1214 本身含义（参数值不合法）来自官方码表
- 1210/1211/1213/1220 在 GLM-OCR 下的具体触发场景（页码参数、模型名、缺 file、Key 无权限）是按通用含义和 layout_parsing 参数推断，官方没有 OCR 专门说明；仓库对 429 以外的 4xx 一律不重试（GlmOcrRequestRejected），没有逐码区分
- 限制：单图 ≤10MB、PDF ≤50MB、支持 PDF/JPG/PNG；页数上限中文 API 参考和中英文指南都写 100 页，但 Z.ai 英文 API 参考写的是 30 页，二者不一致；仓库按 100 页封顶（GLM_OCR_MAX_PAGES_PER_REQUEST=100），默认每片 10 页（RETAIN_GLM_OCR_CHUNK_PAGES），所以实际不受这个分歧影响
- 超出大小或页数时会返回哪个业务码，官方没写（推测为 12xx 参数类，未证实，未收录）
- 可选参数 start_page_id/end_page_id（最小 1）可指定解析页段；request_id 6-64 字符，user_id 6-128 字符
- 错误体结构不一致：Z.ai layout-parsing 的 OpenAPI 写的是顶层 {code: int, message}，而 Z.ai/智谱错误码页写的是 {error: {code: string, message}}；仓库 _error_code 只读 error.code，若真返回顶层 code 会读不到业务码（会退回按 HTTP 状态处理）
- 官方只有同步接口，没有 GLM-OCR 的异步/轮询版本；也没写并发和限速，仓库经验是 3 路并发 × 100 页必遇 429，串行 + 退避可过
- 仓库还记了一条官方未写的经验：某些超大图纸页会稳定 HTTP 500，拆成单页再发可能通过（GlmOcrServerError，glm_ocr_driver._page_by_page_chunk）
- 价格：智谱 0.2 元/百万 tokens（输入输出同价）；Z.ai $0.03/百万 tokens

## 出处

- [GLM-OCR 模型指南（智谱开放平台）](https://docs.bigmodel.cn/cn/guide/models/vlm/glm-ocr)（抓取 2026-11-23）
- [文档解析 API 参考（智谱开放平台）](https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E6%96%87%E6%A1%A3%E8%A7%A3%E6%9E%90.md)（抓取 2026-11-23）
- [Layout Parsing API reference（Z.ai）](https://docs.z.ai/api-reference/tools/layout-parsing.md)（抓取 2026-11-23）
- [GLM-OCR guide（Z.ai）](https://docs.z.ai/guides/vlm/glm-ocr.md)（抓取 2026-11-23）
- [API Error Codes（Z.ai）](https://docs.z.ai/api-reference/api-code)（抓取 2026-11-23）
- [错误码（智谱开放平台）](https://docs.bigmodel.cn/cn/faq/api-code)（抓取 2026-11-23）

## issue 里见过

- [#164](https://github.com/wxyhgk/retain-pdf/issues/164)：智谱 429 / 1113 被当成限流退避 5 次（2026-11-23 已修：额度类第一次就停）
