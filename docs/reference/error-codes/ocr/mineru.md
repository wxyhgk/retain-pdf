<!-- 由 backend/api/src/api_tests/provider_error_codes.rs 从 backend/packages/retainpdf-providers/error-codes/ 生成，不要手改：
     UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes -->

# MinerU 错误码

OCR 服务商。接口主机：`mineru.net`。数据：[`backend/packages/retainpdf-providers/error-codes/ocr/mineru.json`](../../../../backend/packages/retainpdf-providers/error-codes/ocr/mineru.json)；接口 `GET /api/v1/providers/error-codes?provider=mineru`。回到[错误码索引](../README.md)。

含义、提示都是转述，原文看每条的出处。

## 错误长什么样

JSON 包 {code, msg, trace_id, data}：code=0 成功，非 0 为错误码（标准 API 是 A0202/A0211 这类字符串或 -500/-10001/-600xx 这类负整数）。官方没给标准 API 的 HTTP 状态对照，成败看 body 里的 code；任务级失败在查询结果 data.state=failed、data.err_msg（Agent 接口另有 err_code）。Agent 轻量接口按 IP 每分钟限频，超出返回 HTTP 429。

## 同一个状态有几种意思时怎么分

- 成败看响应体 code：0 成功，非 0 是错误码（A0202 这类字符串或 -600xx 这类负整数）；官方没给标准 API 的 HTTP 状态对照。
- 任务级失败在查询结果 data.state=failed、data.err_msg。
- -60018 是每日解析任务数到上限（不是页数）；每天 1000 页最高优先级额度超了只降优先级、不报错。

## RetainPDF 怎么处理

Rust 客户端（errors.rs）把官方表里 27 个标准 API 码全部映射到 OcrErrorCategory，每条带中文处理建议（在 OCR 诊断里）；轮询对 ServiceUnavailable、QueueFull、RemoteReadTimeout、WebReadFailed、-60001/-60010/-60016/-60020/-60021 和 408/429/5xx 重试（response_error.rs 的 retryable_query），Python 的 get_json 规则相同。任务层按分类给失败码（job_failure_ocr_provider.rs、Python ocr/provider_failures.py，2026-11-23）：鉴权、-60013 → auth_failed；-60018/-60019 → upstream_quota_exhausted；文件类 → ocr_file_rejected；参数类 → upstream_bad_request；服务商处理失败 → ocr_provider_failed。前端 2026-05 起默认不再提供 MinerU（#23、#46、#48），后端仍支持。

共 31 条：有缺口 0 条（高 0、中 0、低 0），碰不到 4 条。缺口按用户影响排的总表见[索引](../README.md#缺口汇总)。

## 错误码

码一栏是服务商返回的码；服务商没有码的，括号里是我们起的编号（接口里的 `id`）。

| 码 | HTTP | 大类 | 可重试 | 含义 | 给用户的提示 | 我们怎么处理 | 对不对得上 | 出处 |
|---|---|---|---|---|---|---|---|---|
| `A0202` | — | 鉴权失败（`auth`） | 否 | Token 错误 | MinerU Token 不对，请检查是否带 Bearer 前缀，或换一个新 Token | 不重试，任务失败 → `auth_failed`：Unauthorized → 「鉴权失败」，阶段说明「MinerU Token 无效或鉴权失败」。（[#5](https://github.com/wxyhgk/retain-pdf/issues/5)） | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `A0211` | — | 鉴权失败（`auth`） | 否 | Token 已过期 | MinerU Token 已过期，请到 MinerU 官网重新生成 Token | 不重试，任务失败 → `auth_failed`：CredentialExpired → 「鉴权失败」，「MinerU Token 已过期，请更换新 Token」。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-500` | — | 请求参数错误（`invalid_request`） | 否 | 参数错误（类型或 Content-Type 不对） | 请求参数类型或 Content-Type 不对，请检查请求格式 | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request，summary 带业务码和服务商原话。Rust、Python 两条路一致。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-10001` | — | 服务端错误（`server`） | 是 | 服务异常 | MinerU 服务异常，请稍后重试 | 退避重试 → `ocr_provider_failed`：ServiceUnavailable，轮询时可重试；提交时不重试。重试用完落 ocr_provider_failed（可重试），summary 带码和原话。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-10002` | — | 请求参数错误（`invalid_request`） | 否 | 请求参数错误 | 请求参数格式不对，请检查后再提交 | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request，summary 带业务码和服务商原话。Rust、Python 两条路一致。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60001` | — | 服务端错误（`server`） | 是 | 生成上传链接失败 | MinerU 生成上传链接失败，请稍后重试 | 退避重试 → `ocr_provider_failed`：查询时退避重试（Rust retryable_query、Python get_json），用完落 ocr_provider_failed（可重试），summary 带码和原话。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60002` | — | 不支持的参数或调用方式（`unsupported`） | 否 | 识别文件类型失败 | 无法识别文件类型，请确认文件名和链接带正确的后缀且格式受支持 | 不重试，任务失败 → `ocr_file_rejected`：归 ocr_file_rejected（input 类，不可重试）：summary「MinerU 拒收了这份文件：&lt;原因>（码）：原话」，建议换文件、压缩或拆分。Rust、Python 两条路一致。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60003` | — | 文件问题（`file`） | 否 | 读取文件失败 | 文件读取失败，请检查文件是否损坏后重新上传 | 不重试，任务失败 → `ocr_file_rejected`：归 ocr_file_rejected（input 类，不可重试）：summary「MinerU 拒收了这份文件：&lt;原因>（码）：原话」，建议换文件、压缩或拆分。Rust、Python 两条路一致。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60004` | — | 文件问题（`file`） | 否 | 文件为空 | 上传的文件是空的，请换一个有效文件 | 不重试，任务失败 → `ocr_file_rejected`：归 ocr_file_rejected（input 类，不可重试）：summary「MinerU 拒收了这份文件：&lt;原因>（码）：原话」，建议换文件、压缩或拆分。Rust、Python 两条路一致。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60005` | — | 文件问题（`file`） | 否 | 文件大小超出限制（最大 200MB） | 文件超过 200MB，请压缩或拆分后再试 | 不重试，任务失败 → `ocr_file_rejected`：归 ocr_file_rejected（input 类，不可重试）：summary「MinerU 拒收了这份文件：&lt;原因>（码）：原话」，建议换文件、压缩或拆分。Rust、Python 两条路一致。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60006` | — | 文件问题（`file`） | 否 | 文件页数超出限制（单文件最多 200 页） | 文件页数太多，请拆分文件或指定页码范围后再试 | 不重试，任务失败 → `ocr_file_rejected`：归 ocr_file_rejected（input 类，不可重试）：summary「MinerU 拒收了这份文件：&lt;原因>（码）：原话」，建议换文件、压缩或拆分。Rust、Python 两条路一致。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60007` | — | 服务繁忙（`overloaded`） | 是 | 模型服务暂时不可用 | MinerU 模型服务暂时不可用，请稍后重试 | 退避重试 → `ocr_provider_failed`：ServiceUnavailable，轮询时可重试；提交时不重试。重试用完落 ocr_provider_failed（可重试），summary 带码和原话。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60008` | — | 超时（`timeout`） | 是 | 读取文件超时（URL 读不到） | MinerU 读取文件链接超时，请确认链接可访问后重试 | 退避重试 → `ocr_provider_failed`：RemoteReadTimeout，轮询时可重试；提交时不重试。（官方建议检查 URL 是否能访问，我们重试影响不大）。重试用完落 ocr_provider_failed（可重试），summary 带码和原话。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60009` | — | 服务繁忙（`overloaded`） | 是 | 任务提交队列已满 | MinerU 提交队列已满，请稍后重试 | 退避重试 → `upstream_rate_limited`：QueueFull，轮询时可重试；提交时不重试。重试用完落 upstream_rate_limited（可重试）。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60010` | — | 服务端错误（`server`） | 是 | 解析失败 | MinerU 解析失败，请稍后重试 | 退避重试 → `ocr_provider_failed`：查询时退避重试（Rust retryable_query、Python get_json），用完落 ocr_provider_failed（可重试），summary 带码和原话。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60011` | — | 文件问题（`file`） | 否 | 没拿到有效文件 | MinerU 没收到有效文件，请确认文件已上传成功 | 不重试，任务失败 → `ocr_provider_failed`：归 ocr_provider_failed（可重试），summary 带码和原话。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60012` | — | 请求参数错误（`invalid_request`） | 否 | 任务不存在 | 找不到这个 MinerU 任务（task_id 无效或已删除），请重新提交 | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request，summary 带业务码和服务商原话。Rust、Python 两条路一致。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60013` | — | 没有权限（`permission`） | 否 | 没有权限访问该任务 | 只能访问自己提交的 MinerU 任务，请检查 Token 是否与提交时一致 | 不重试，任务失败 → `auth_failed`：归 auth_failed：「MinerU 拒绝访问：没有权限」，建议查 Token 是否和提交时一致。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60014` | — | 请求参数错误（`invalid_request`） | 否 | 试图删除运行中的任务 | 任务还在运行，暂时不能删除 | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request，summary 带业务码和服务商原话。Rust、Python 两条路一致。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60015` | — | 文件问题（`file`） | 否 | 文件转换失败 | 文件转换失败，请先手动转成 PDF 再上传 | 不重试，任务失败 → `ocr_file_rejected`：归 ocr_file_rejected（input 类，不可重试）：summary「MinerU 拒收了这份文件：&lt;原因>（码）：原话」，建议换文件、压缩或拆分。Rust、Python 两条路一致。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60016` | — | 服务端错误（`server`） | 是 | 导出为指定格式失败 | 导出格式转换失败，可换一种导出格式或重试 | 退避重试 → `ocr_provider_failed`：查询时退避重试（Rust retryable_query、Python get_json），用完落 ocr_provider_failed（可重试），summary 带码和原话。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60017` | — | 其他（`other`） | 否 | 重试次数已达上限 | 这份文件重试次数已用完，需等 MinerU 模型升级后再试 | 不重试，任务失败 → `ocr_provider_failed`：落 ocr_provider_failed 但标不可重试（重试次数已达上限），建议换用其他 OCR。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60018` | — | 额度或用量上限（`quota`） | 否 | 今日解析任务数已达上限 | 今日 MinerU 解析任务数已用完，明天再试或换一个 Token | 不重试，任务失败 → `upstream_quota_exhausted`：不重试。Rust 归 QuotaExceeded / HtmlQuotaExceeded，任务失败归「上游账户余额或额度不足」（upstream_quota_exhausted），summary「MinerU 今日解析额度已用完（-60018）」，建议明天再试或换 Token、换 OCR；失败的 upstream.code 是业务码。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60019` | — | 额度或用量上限（`quota`） | 否 | HTML 文件解析额度不足 | 今日 MinerU 网页（HTML）解析额度已用完，明天再试 | 不重试，任务失败 → `upstream_quota_exhausted`：不重试。Rust 归 QuotaExceeded / HtmlQuotaExceeded，任务失败归「上游账户余额或额度不足」（upstream_quota_exhausted），summary「MinerU 今日解析额度已用完（-60019）」，建议明天再试或换 Token、换 OCR；失败的 upstream.code 是业务码。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60020` | — | 服务端错误（`server`） | 是 | 文件拆分失败 | MinerU 拆分文件失败，请稍后重试 | 退避重试 → `ocr_provider_failed`：查询时退避重试（Rust retryable_query、Python get_json），用完落 ocr_provider_failed（可重试），summary 带码和原话。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60021` | — | 文件问题（`file`） | 是 | 读取文件页数失败 | MinerU 读取页数失败，请稍后重试；仍失败请检查 PDF 是否损坏 | 退避重试 → `ocr_provider_failed`：查询时退避重试（Rust retryable_query、Python get_json），用完落 ocr_provider_failed（可重试），summary 带码和原话。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-60022` | — | 限流（`rate_limit`） | 是 | 网页读取失败（可能是网络或限频） | MinerU 读取网页失败，可能是网络或限频，请稍后重试 | 退避重试 → `ocr_provider_failed`：WebReadFailed，轮询时可重试；提交时不重试。重试用完落 ocr_provider_failed（可重试），summary 带码和原话。 | 对得上 | [文档](https://mineru.net/apiManage/docs) |
| `-30001` | — | 文件问题（`file`） | 否 | 文件超过 Agent 轻量接口的 10MB 上限 | 文件超过 10MB，请改用标准 API 或拆分文件 | 碰不到：RetainPDF 用带 Token 的标准 API，不用 Agent 轻量接口；这几个码仓库没有映射，出现会落 Unknown。 | — | [文档](https://mineru.net/apiManage/docs) |
| `-30002` | — | 不支持的参数或调用方式（`unsupported`） | 否 | Agent 轻量接口不支持该文件类型 | 该文件类型轻量接口不支持，请上传 PDF、图片、Word、PPT 或 Excel | 碰不到：RetainPDF 用带 Token 的标准 API，不用 Agent 轻量接口；这几个码仓库没有映射，出现会落 Unknown。 | — | [文档](https://mineru.net/apiManage/docs) |
| `-30003` | — | 文件问题（`file`） | 否 | 文件页数超过 Agent 轻量接口上限 | 页数超过轻量接口上限，请改用标准 API 或设置 page_range | 碰不到：RetainPDF 用带 Token 的标准 API，不用 Agent 轻量接口；这几个码仓库没有映射，出现会落 Unknown。 | — | [文档](https://mineru.net/apiManage/docs) |
| `-30004` | — | 请求参数错误（`invalid_request`） | 否 | 请求参数错误（缺必填参数） | 请求缺少必填参数，请检查后再提交 | 碰不到：RetainPDF 用带 Token 的标准 API，不用 Agent 轻量接口；这几个码仓库没有映射，出现会落 Unknown。 | — | [文档](https://mineru.net/apiManage/docs) |

## 相关代码

- [`backend/packages/retainpdf-core/src/job_failure_fallback.rs`](../../../../backend/packages/retainpdf-core/src/job_failure_fallback.rs)
- [`backend/packages/retainpdf-core/src/job_failure_ocr_provider.rs`](../../../../backend/packages/retainpdf-core/src/job_failure_ocr_provider.rs)
- [`backend/packages/retainpdf-core/src/job_failure_structured.rs`](../../../../backend/packages/retainpdf-core/src/job_failure_structured.rs)
- [`backend/packages/retainpdf-data/src/ocr_provider/mineru/errors.rs`](../../../../backend/packages/retainpdf-data/src/ocr_provider/mineru/errors.rs)
- [`backend/packages/retainpdf-data/src/ocr_provider/mineru/response_error.rs`](../../../../backend/packages/retainpdf-data/src/ocr_provider/mineru/response_error.rs)
- [`backend/packages/retainpdf-runner/src/job_runner/ocr_flow/mineru_retry.rs`](../../../../backend/packages/retainpdf-runner/src/job_runner/ocr_flow/mineru_retry.rs)
- [`backend/pipeline/retainpdf_pipeline/ocr/mineru_provider/mineru_api.py`](../../../../backend/pipeline/retainpdf_pipeline/ocr/mineru_provider/mineru_api.py)
- [`backend/pipeline/retainpdf_pipeline/ocr/provider_failures.py`](../../../../backend/pipeline/retainpdf_pipeline/ocr/provider_failures.py)

## 备注

- 官方表 27 个标准 API 码（A0202、A0211、-500、-10001、-10002、-60001~-60022）仓库 errors.rs 全部有映射，含义一致，没有漏码也没有多出的码
- 可重试性差异：官方对 -60001（上传链接生成失败）、-60010（解析失败）、-60020（拆分失败）、-60021（读页数失败）都建议稍后重试，但 response_error.rs 的 retryable_query 只把 ServiceUnavailable/QueueFull/RemoteReadTimeout/WebReadFailed 当可重试，这四个码会直接失败（-60010 还在测试里被钉成不可重试）；-60016 官方也说可重试，仓库同样不重试
- 反过来 -60008（读取文件超时）官方建议是检查 URL 可访问，仓库按可重试处理，影响不大
- -60018 官方说的是每日解析任务数（不是页数）达上限；另有每账号每天 1000 页最高优先级额度，超出只降优先级、不报错
- 限制：标准 API 单文件 ≤200MB、≤200 页（有第三方页面写 600 页，官方文档写 200 页），批量最多 200 个文件、每次请求最多 50 个；Agent 轻量接口 ≤10MB、≤20 页（官方 -30003 的示例消息里写 50 页，与限制表的 20 页自相矛盾）
- Agent 轻量接口的 -30001~-30004 仓库没有映射（仓库用的是带 Token 的标准 API；若出现会被 PROVIDER_CODE_RE 抽出、落到 Unknown）
- 官方没给标准 API 各码的 HTTP 状态，http_status 留空；仓库测试（backend/packages/retainpdf-runner/src/job_runner/stdout_parser/tests.rs）假设 A0202/A0211 随 HTTP 401 返回，未经官方文档证实
- 仓库 -60002 的提示写了具体格式清单（pdf,doc,docx,ppt,pptx,png,jp(e)g），官方当前文字只要求后缀正确、格式受支持

## 出处

- [MinerU 文档解析接口文档（错误码一节）](https://mineru.net/apiManage/docs)（抓取 2026-11-23）

## issue 里见过

- [#5](https://github.com/wxyhgk/retain-pdf/issues/5)：Windows 上 Token 检测不过（新版已修）
- [#23](https://github.com/wxyhgk/retain-pdf/issues/23)：选 MinerU 保存后跳回 Paddle（MinerU 逐步下线）
- [#46](https://github.com/wxyhgk/retain-pdf/issues/46)：同 #23，当时有意为之
- [#48](https://github.com/wxyhgk/retain-pdf/issues/48)：「请先填写当前 OCR Provider 凭证。」（MinerU 当时不开放）
