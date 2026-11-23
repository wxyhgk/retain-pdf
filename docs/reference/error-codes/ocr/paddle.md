<!-- 由 backend/api/src/api_tests/provider_error_codes.rs 从 backend/packages/retainpdf-providers/error-codes/ 生成，不要手改：
     UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes -->

# PaddleOCR 错误码

OCR 服务商。接口主机：`paddleocr.aistudio-app.com`。数据：[`backend/packages/retainpdf-providers/error-codes/ocr/paddle.json`](../../../../backend/packages/retainpdf-providers/error-codes/ocr/paddle.json)；接口 `GET /api/v1/providers/error-codes?provider=paddle`。回到[错误码索引](../README.md)。

含义、提示都是转述，原文看每条的出处。

## 错误长什么样

异步任务接口 (POST/GET https://paddleocr.aistudio-app.com/api/v2/ocr/jobs[/{jobId}]): JSON 包 {traceId, code, msg, data}，code=0 成功；错误码与 HTTP 状态成对出现（见 http_status）；任务失败时 GET 返回 code=11003、HTTP 200，原因在 data.errorMsg，data.state=failed。同步版面解析接口 (POST /layout-parsing，PaddleX serving 格式): {logId, errorCode, errorMsg}，失败时 errorCode 等于 HTTP 状态码 (403/413/422/429/500/503/504)。鉴权头 Authorization: Bearer &lt;token>（示例里小写 bearer）。

## 同一个状态有几种意思时怎么分

- 成败看响应体 code（0 成功）和 HTTP 状态，二者成对出现；任务失败时 GET 返回 HTTP 200、code=11003，原因在 data.errorMsg，data.state=failed。
- 异步接口的 403 要看 code：12001 是当日页数额度用完（不是 Token 错），401 才是 Token 无效。
- 429 在两个接口里意思不同：异步接口 12002 是请求太快（可重试）；同步版面解析接口的 429 是当日页数额度用完（不可重试）。RetainPDF 只用异步接口。
- 字段名：异步接口是 code / msg / traceId，同步接口是 errorCode / errorMsg / logId；两种都要认（Rust 用 serde alias 都认，Python 的 _check_envelope 只读 errorCode）。

## RetainPDF 怎么处理

两条代码路径。Rust（整份提交、轮询，平时走这条）：提交遇排队已满（10010）、429、HTTP 500 退避重交（服务商明确没收下，2026-11-23），其余不重交（避免重复计费）；轮询对网络错误和 429 / 12002 退避再查；分类在 errors.rs（OcrErrorCategory），任务层按分类给失败码（job_failure_ocr_provider.rs）：鉴权 → auth_failed，12001 → upstream_quota_exhausted，文件类 → ocr_file_rejected，参数类 → upstream_bad_request，11002 / 11003 / 500 → ocr_provider_failed。Python（OCR 和翻译并行、分片上传时）：retry.py 对 408/429/5xx 重试（默认 3 次），10010 在提交处重交；不重试的 4xx 和 HTTP 200 包里的错误读出 code/msg（errorCode/errorMsg 也认），抛 PaddleRequestRejected（12001 是 PaddleQuotaExhausted），按业务码给同样的失败码（ocr/provider_failures.py）；报错只带状态码、业务码、服务商原话和 traceId，不带签名地址。

共 23 条：有缺口 0 条（高 0、中 0、低 0），碰不到 6 条。缺口按用户影响排的总表见[索引](../README.md#缺口汇总)。

## 错误码

码一栏是服务商返回的码；服务商没有码的，括号里是我们起的编号（接口里的 `id`）。

| 码 | HTTP | 大类 | 可重试 | 含义 | 给用户的提示 | 我们怎么处理 | 对不对得上 | 出处 |
|---|---|---|---|---|---|---|---|---|
| `401` | 401 | 鉴权失败（`auth`） | 否 | Token 无效（异步任务接口） | PaddleOCR Token 无效，请到 AI Studio 重新获取 Token 后再试 | 不重试，任务失败 → `auth_failed`：Rust、Python 两条路径都归「鉴权失败」，不重试。建议按服务商出：Rust 是「检查 PaddleOCR Token 是否有效、是否与接口地址匹配」（以前写死「检查 MinerU Token…」），Python 是按服务商的通用说法。 | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `403` | 403 | 鉴权失败（`auth`） | 否 | Token 错误，或请求地址与 Token 不匹配（同步版面解析接口） | PaddleOCR Token 不对或与接口地址不匹配，请检查 Token 和 API 地址 | 碰不到：RetainPDF 只用异步任务接口（/api/v2/ocr/jobs），同步版面解析接口的码碰不到。 | — | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/Xmjclapam) |
| `413` | 413 | 文件问题（`file`） | 否 | 请求体过大：文件太大或页数太多（同步接口） | 文件太大，请减少页数或压缩 PDF 后再试 | 碰不到：RetainPDF 只用异步任务接口（/api/v2/ocr/jobs），同步版面解析接口的码碰不到。 | — | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/Xmjclapam) |
| `422` | 422 | 请求参数错误（`invalid_request`） | 否 | 参数不合法，具体原因见 errorMsg（同步接口） | 请求参数不合法，请查看服务端说明后调整参数 | 碰不到：RetainPDF 只用异步任务接口（/api/v2/ocr/jobs），同步版面解析接口的码碰不到。 | — | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/Xmjclapam) |
| `429` | 429 | 额度或用量上限（`quota`） | 否 | 当日该模型的解析页数已超出上限（同步接口配额） | 今日 PaddleOCR 解析页数已用完，明天再试、换一个模型或申请提额 | 碰不到：RetainPDF 只用异步任务接口（/api/v2/ocr/jobs），同步版面解析接口的码碰不到。（仓库 errors.rs 把 429 一律当成可重试的 QueueFull，对同步接口的「当日额度用完」不对，只是我们碰不到。） | — | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/Xmjclapam) |
| `500` | 500 | 服务端错误（`server`） | 是 | 服务端系统内部错误 | PaddleOCR 服务内部出错，请稍后重试；反复出现请联系 PaddleOCR 官方 | 退避重试 → `ocr_provider_failed`：提交收到 HTTP 500 算服务商没收下：退避重交，Rust 撤销提交意图（重试不被「结果不明确」挡住）；用完「PaddleOCR 服务暂时出错（HTTP 500），稍后再试」，可重试。（[#47](https://github.com/wxyhgk/retain-pdf/issues/47) [#84](https://github.com/wxyhgk/retain-pdf/issues/84)） | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `503` | 503 | 服务繁忙（`overloaded`） | 是 | 当前并发请求过多，服务忙 | PaddleOCR 服务繁忙，请稍后重试 | 碰不到：RetainPDF 只用异步任务接口（/api/v2/ocr/jobs），同步版面解析接口的码碰不到。 | — | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/Xmjclapam) |
| `504` | 504 | 超时（`timeout`） | 是 | 网关超时 | PaddleOCR 网关超时，请稍后重试，或把文件拆成更少页数 | 碰不到：RetainPDF 只用异步任务接口（/api/v2/ocr/jobs），同步版面解析接口的码碰不到。 | — | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/Xmjclapam) |
| `10001` | 400 | 文件问题（`file`） | 否 | 提交的文件是空的 | 上传的文件是空的，请换一个有效文件 | 不重试，任务失败 → `ocr_file_rejected`：归 ocr_file_rejected（input 类，不可重试）：summary「PaddleOCR 拒收了这份文件：&lt;原因>（码）：errorMsg」，建议换文件、压缩或拆分。 | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `10002` | 400 | 请求参数错误（`invalid_request`） | 否 | 无法识别提交的文件 URL | 文件链接无法识别，请检查链接是否正确、可公开访问 | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request，summary 带 errorCode 和 errorMsg。Rust、Python 两条路一致。 | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `10003` | 400 | 文件问题（`file`） | 否 | 文件大小超过限制（链接 200MB、本地上传 50MB） | 文件太大（本地上传最多 50MB），请压缩或拆分后再试 | 不重试，任务失败 → `ocr_file_rejected`：归 ocr_file_rejected（input 类，不可重试）：summary「PaddleOCR 拒收了这份文件：&lt;原因>（码）：errorMsg」，建议换文件、压缩或拆分。 | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `10004` | 400 | 不支持的参数或调用方式（`unsupported`） | 否 | 文件格式不受支持 | 文件格式不支持，请转成 PDF 或常见图片格式后再试 | 不重试，任务失败 → `ocr_file_rejected`：归 ocr_file_rejected（input 类，不可重试）：summary「PaddleOCR 拒收了这份文件：&lt;原因>（码）：errorMsg」，建议换文件、压缩或拆分。 | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `10005` | 400 | 文件问题（`file`） | 否 | 文件内容无法解析（可能损坏） | 文件无法解析，请检查文件是否损坏后重新上传 | 不重试，任务失败 → `ocr_file_rejected`：归 ocr_file_rejected（input 类，不可重试）：summary「PaddleOCR 拒收了这份文件：&lt;原因>（码）：errorMsg」，建议换文件、压缩或拆分。 | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `10006` | 400 | 文件问题（`file`） | 否 | 文件页数超过单次上限（PDF 最多 1000 页） | 页数太多，请拆分文件或选择部分页后再试 | 不重试，任务失败 → `ocr_file_rejected`：提交前按 max_pages 挡住（默认 999 页），整本翻译超长时分片上传，正常碰不到；真碰到归 ocr_file_rejected（换文件或拆分）。（[#50](https://github.com/wxyhgk/retain-pdf/issues/50) [#141](https://github.com/wxyhgk/retain-pdf/issues/141) [#154](https://github.com/wxyhgk/retain-pdf/issues/154)） | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `10007` | 400 | 模型不存在（`model_not_found`） | 否 | model 参数错误，模型不存在 | 所选 PaddleOCR 模型不存在，请检查模型名称 | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request，summary 带 errorCode 和 errorMsg。Rust、Python 两条路一致。 | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `10008` | 400 | 请求参数错误（`invalid_request`） | 否 | 请求参数错误（optionalPayload 或 extraFormats 不合法） | 请求参数不合法，请检查 OCR 选项配置 | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request，summary 带 errorCode 和 errorMsg。Rust、Python 两条路一致。 | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `10009` | 400 | 请求参数错误（`invalid_request`） | 否 | 同一个 batchId 下任务数超过 100 | 同一批次任务太多，请分成多批提交 | 不重试，任务失败 → `upstream_bad_request`：归 upstream_bad_request，summary 带 errorCode 和 errorMsg。Rust、Python 两条路一致。 | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `10010` | — | 服务繁忙（`overloaded`） | 是 | 任务提交队列已满 | PaddleOCR 提交队列已满，请稍后重试 | 退避重试 → `upstream_rate_limited`：提交处退避重交（次数同请求重试次数，默认 3 次，等 10 秒、20 秒），用完「PaddleOCR 排队已满或请求太快（10010）：…」，可重试。Rust、Python 一致。（[#148](https://github.com/wxyhgk/retain-pdf/issues/148)） | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `11001` | 404 | 请求参数错误（`invalid_request`） | 否 | jobId 不存在 | 找不到这个 OCR 任务，请重新提交 | 不重试，任务失败：检测 Token 时故意用不存在的 jobId 探测，11001 说明 Token 有效；轮询路径只按 HTTP 404 认 TaskNotFound。 | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `11002` | 400 | 其他（`other`） | 否 | 任务已过期 | OCR 任务已过期，请重新提交 | 不重试，任务失败 → `ocr_provider_failed`：「PaddleOCR 任务已过期（11002）」，建议重新提交，可重试。 | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `11003` | 200 | 服务端错误（`server`） | 是 | 任务解析失败，原因在 data.errorMsg（HTTP 仍为 200） | PaddleOCR 解析这份文件失败，可重试一次；仍失败请查看服务端说明或换用其他 OCR | 退避重试 → `ocr_provider_failed`：任务失败按 state=failed 处理（分片会重交那一片），最终落 ocr_provider_failed，summary 带 data.errorMsg。（[#47](https://github.com/wxyhgk/retain-pdf/issues/47) [#84](https://github.com/wxyhgk/retain-pdf/issues/84)） | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `12001` | 403 | 额度或用量上限（`quota`） | 否 | 今日解析页数额度已用完 | 今日 PaddleOCR 页数额度已用完，明天再试或换一个 Token | 不重试，任务失败 → `upstream_quota_exhausted`：不重试。Rust 按业务码 12001 归 QuotaExceeded（不再按 403 归 PermissionDenied），任务失败归「上游账户余额或额度不足」（upstream_quota_exhausted），summary「PaddleOCR 今日解析页数额度已用完（12001）」，建议明天再试或换 Token、换 OCR；Python 读 code/msg（errorCode/errorMsg 也认），抛 PaddleQuotaExhausted，同样归 upstream_quota_exhausted、不可重试。失败的 upstream.code 是 12001。 | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |
| `12002` | 429 | 限流（`rate_limit`） | 是 | 请求频率过高 | PaddleOCR 请求太频繁，请稍后重试 | 退避重试 → `upstream_rate_limited`：Rust 轮询遇 429 / 12002 退避后再查；提交时同 10010 退避重交。 | 对得上 | [文档](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5) |

## 相关代码

- [`backend/packages/retainpdf-core/src/job_failure_fallback.rs`](../../../../backend/packages/retainpdf-core/src/job_failure_fallback.rs)
- [`backend/packages/retainpdf-core/src/job_failure_ocr_provider.rs`](../../../../backend/packages/retainpdf-core/src/job_failure_ocr_provider.rs)
- [`backend/packages/retainpdf-core/src/job_failure_structured.rs`](../../../../backend/packages/retainpdf-core/src/job_failure_structured.rs)
- [`backend/packages/retainpdf-data/src/ocr_provider/paddle/client.rs`](../../../../backend/packages/retainpdf-data/src/ocr_provider/paddle/client.rs)
- [`backend/packages/retainpdf-data/src/ocr_provider/paddle/errors.rs`](../../../../backend/packages/retainpdf-data/src/ocr_provider/paddle/errors.rs)
- [`backend/packages/retainpdf-runner/src/job_runner/ocr_flow/dispatch_journal.rs`](../../../../backend/packages/retainpdf-runner/src/job_runner/ocr_flow/dispatch_journal.rs)
- [`backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py`](../../../../backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py)
- [`backend/pipeline/retainpdf_pipeline/ocr/ocr_provider/paddle_api.py`](../../../../backend/pipeline/retainpdf_pipeline/ocr/ocr_provider/paddle_api.py)
- [`backend/pipeline/retainpdf_pipeline/ocr/ocr_provider/paddle_chunked.py`](../../../../backend/pipeline/retainpdf_pipeline/ocr/ocr_provider/paddle_chunked.py)
- [`backend/pipeline/retainpdf_pipeline/ocr/provider_failures.py`](../../../../backend/pipeline/retainpdf_pipeline/ocr/provider_failures.py)

## 备注

- 字段名差异：官方异步接口文档写的是 code/msg/traceId，不是 errorCode/errorMsg/logId；Rust 端 models.rs 和 errors.rs 用 serde alias 两种都认；Python paddle_api.py 的 _error_fields 2026-11-23 起也两种都认（以前 _check_envelope 只读 errorCode，HTTP 200 + code 会漏判）
- 429 含义分歧：同步接口配额页说 429 = 当日页数额度用完（不可重试）；异步接口里额度用完是 12001 (HTTP 403)，429 对应 12002 请求频率过高（可重试）。仓库 errors.rs 把 429 一律归为 QueueFull（可重试），对同步接口的 429 不对
- 12001 (HTTP 403)：2026-11-23 起 Rust errors.rs 按业务码归 QuotaExceeded、Python 抛 PaddleQuotaExhausted，都归额度用完（以前按 HTTP 403 归 PermissionDenied / 鉴权失败）；12002、10001-10009、11002 仍没有专门映射，只按 HTTP 状态兜底（400 -> InvalidRequest）
- 11001 仓库只在 probe（用不存在的 jobId 探测连通性）里当作正常；轮询路径没有映射成 TaskNotFound（只有 errorCode=404 才映射）
- 10010 官方没写 HTTP 状态；仓库测试里用的报文是 {code:10010,msg:'任务提交队列已满，请稍后重试'}
- 仓库额外映射了 404/408/409（TaskNotFound/RemoteReadTimeout/OperationNotAllowed），官方文档没有列这几个码，属仓库防御性兜底，未收录
- 额度数字中英文页不一致：中文配额页（2026-09-08）为每用户每模型每天 20000 页、单文件建议 ≤1000 页且超出只解析前 1000 页；英文页（2026-02-10）仍写 3000 页/天、100 页，以中文新版为准；该配额页没说明是否同时适用于异步任务接口
- 异步接口单次请求 PDF 最多 1000 页，文件链接最大 200MB、本地上传最大 50MB；官方未列支持的文件类型清单
- 11003 是否可重试官方没说；这里标 true 是因为仓库 paddle_chunked.py 会对失败分片重交，官方只说失败不会部分成功
- PaddleX GitHub 的通用 serving 文档没有再单独抓取，只用 AI Studio 页面里同一段说明（失败时 errorCode 等于 HTTP 状态码），仓库 AsyncParse.md 的副本与之一致

## 出处

- [异步API使用文档（AI Studio PaddleOCR，更新 2026-02-04）](https://ai.baidu.com/ai-doc/AISTUDIO/fml7mozw5)（抓取 2026-11-23）
- [Asynchronous API Usage Guide（英文版，更新 2026-02-04）](https://ai.baidu.com/ai-doc/AISTUDIO/Mml7n69e7)（抓取 2026-11-23）
- [API 配额规则和错误码说明（中文版，更新 2026-09-08）](https://ai.baidu.com/ai-doc/AISTUDIO/Xmjclapam)（抓取 2026-11-23）
- [API Quota Rules and Error Code Description（英文版，更新 2026-02-10，数字较旧）](https://ai.baidu.com/ai-doc/AISTUDIO/pmjcld5qm)（抓取 2026-11-23）
- [PaddleOCR-VL-1.5_API_en（同步 layout-parsing 接口说明）](https://ai.baidu.com/ai-doc/AISTUDIO/Vmkz2nz1p)（抓取 2026-11-23）

## issue 里见过

- [#47](https://github.com/wxyhgk/retain-pdf/issues/47)：等 4 分钟后失败，PaddleOCR 服务端不稳，用户只看到「暂未识别出明确根因」
- [#84](https://github.com/wxyhgk/retain-pdf/issues/84)：同上，等服务端恢复
- [#50](https://github.com/wxyhgk/retain-pdf/issues/50)：300 页限制提示（页数上限，已改）
- [#141](https://github.com/wxyhgk/retain-pdf/issues/141)：超 200 页 OCR 不能做（v2026.11.22 起分片上传）
- [#154](https://github.com/wxyhgk/retain-pdf/issues/154)：同 #141
- [#148](https://github.com/wxyhgk/retain-pdf/issues/148)：高峰期排队很久（适配其他 OCR 待调研）

## 相关文档

- [`docs/reference/ocr/PaddleOCR/错误码.md`](../../../../docs/reference/ocr/PaddleOCR/错误码.md)
