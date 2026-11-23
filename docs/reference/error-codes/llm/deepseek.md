<!-- 由 backend/api/src/api_tests/provider_error_codes.rs 从 backend/packages/retainpdf-providers/error-codes/ 生成，不要手改：
     UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes -->

# DeepSeek 错误码

翻译模型服务商。接口主机：`api.deepseek.com`。数据：[`backend/packages/retainpdf-providers/error-codes/llm/deepseek.json`](../../../../backend/packages/retainpdf-providers/error-codes/llm/deepseek.json)；接口 `GET /api/v1/providers/error-codes?provider=deepseek`。回到[错误码索引](../README.md)。

含义、提示都是转述，原文看每条的出处。

## 错误长什么样

DeepSeek 只按 HTTP 状态码区分错误，没有单独的业务码表；下面每条的 code 就是 HTTP 状态码。官方错误码页没有给出错误响应体的字段结构，只说 400/422 的错误信息里会提示怎么改。DeepSeek 用 OpenAI 兼容接口，实际错误体通常是 OpenAI 风格 {"error": {"message", "type", "param", "code"}}，但这一点官方文档没有写明，属未核实。文档没有提到 Retry-After 头。另外：排队等待时非流式请求会持续收到空行，流式请求会收到 SSE 注释 `: keep-alive`，自己解析 HTTP 时要跳过；请求发出 10 分钟仍未开始推理，服务端会关闭连接。

## 同一个状态有几种意思时怎么分

- 没有业务码，HTTP 状态本身就能区分：429 只表示并发 / 频率限制（可重试），余额不足单独用 402（不可重试），过载用 503，不像智谱那样 429 混装多种原因。
- 文档没有「模型不存在」「上下文超长」「内容审核」的专门状态码，按推测会落在 400 或 422，要看错误信息文字（未核实）。
- 排队时非流式请求会持续收到空行、流式收到 SSE 注释 : keep-alive，要跳过；10 分钟还没开始推理服务端会断开连接。

## RetainPDF 怎么处理

走翻译请求层（OpenAI chat 协议），默认的翻译服务商。DeepSeek 只按 HTTP 状态区分错误，和我们的请求层规则一一对上；检测接口另外查余额。

共 10 条：有缺口 1 条（高 0、中 0、低 1），碰不到 1 条。缺口按用户影响排的总表见[索引](../README.md#缺口汇总)。

## 错误码

码一栏是服务商返回的码；服务商没有码的，括号里是我们起的编号（接口里的 `id`）。

| 码 | HTTP | 大类 | 可重试 | 含义 | 给用户的提示 | 我们怎么处理 | 对不对得上 | 出处 |
|---|---|---|---|---|---|---|---|---|
| （http_400） | 400 | 请求参数错误（`invalid_request`） | 否 | 请求体格式不对 | DeepSeek 不接受这个请求格式，请按错误信息里的提示检查请求参数 | 只这一块失败 → `upstream_bad_request`：400 不重试，这个请求失败，其余块继续；整份失败时归「上游服务拒绝请求（400）」。拒收 temperature、思考字段、json_schema 时自动降级重发。 | 对得上 | [文档](https://api-docs.deepseek.com/quick_start/error_codes) |
| （http_401） | 401 | 鉴权失败（`auth`） | 否 | API Key 错误，鉴权失败 | 检查 DeepSeek API Key 是否填对，没有的话到 DeepSeek 平台创建 | 整份翻译停下 → `auth_failed`：不重试；记下这组接口地址 + Key 被拒，同一次运行后面的请求不再发，整份翻译停下（agent 引擎同样报 AuthFailed）。换 Key 后可从翻译续跑。检测接口报「DeepSeek API Key 无效」。 | 对得上 | [文档](https://api-docs.deepseek.com/quick_start/error_codes) |
| （http_402） | 402 | 欠费或余额不足（`billing`） | 否 | 账户余额用完 | DeepSeek 账户余额不足，请充值后再试 | 整份翻译停下 → `upstream_quota_exhausted`：402 不重试，整份翻译停下，归「上游账户余额不足」，不可重试（agent 引擎报 QuotaExhausted）。 | 对得上 | [文档](https://api-docs.deepseek.com/quick_start/error_codes) |
| （http_408） | 408 | 超时（`timeout`） | 是 | 文件上传太慢导致超时（OCR、语音转文字等接口） | 上传文件到 DeepSeek 超时，检查网络后重试 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://api-docs.deepseek.com/quick_start/error_codes) |
| （http_413） | 413 | 文件问题（`file`） | 否 | 上传的文件超过大小限制（OCR、语音转文字等接口） | 文件超过 DeepSeek 的大小上限，请缩小文件 | 碰不到：413 只出在上传文件的接口（OCR、语音），翻译的 chat 请求碰不到。 | — | [文档](https://api-docs.deepseek.com/quick_start/error_codes) |
| （http_422） | 422 | 请求参数错误（`invalid_request`） | 否 | 请求里有参数取值不合法 | DeepSeek 不接受某个参数取值，请按错误信息调整模型参数 | 只这一块失败 → `python_unhandled_exception`：不重试；只算这个请求失败，不会像 401/402/403 那样整份停下；冒到任务层是「任务失败，但暂未识别出明确根因」。 | **缺口·低**：归 upstream_bad_request 一类并带上状态码。 | [文档](https://api-docs.deepseek.com/quick_start/error_codes) |
| （http_429） | 429 | 限流（`rate_limit`） | 是 | 请求太快，或超出并发 / QPS 限制 | 触发 DeepSeek 并发限制，请降低并发后重试 | 退避重试 → `upstream_rate_limited`：退避重试，认 Retry-After；单个请求累计等待超过 300 秒放弃。DeepSeek 的 429 只表示并发 / 频率限制，余额不足走 402，不会混。（[#56](https://github.com/wxyhgk/retain-pdf/issues/56)） | 对得上 | [文档](https://api-docs.deepseek.com/quick_start/error_codes) |
| （http_500） | 500 | 服务端错误（`server`） | 是 | DeepSeek 服务端出错 | DeepSeek 服务端出错，稍等后重试；持续出现请联系 DeepSeek | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://api-docs.deepseek.com/quick_start/error_codes) |
| （http_503） | 503 | 服务繁忙（`overloaded`） | 是 | 流量太大，服务器过载 | DeepSeek 服务繁忙，稍后重试 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://api-docs.deepseek.com/quick_start/error_codes) |
| （http_504） | 504 | 超时（`timeout`） | 是 | 请求没在时限内完成（OCR 或文档上传等） | DeepSeek 处理超时，稍后重试或缩小文件 | 退避重试：退避重试（408、429、500、502、503、504、529 在重试名单里）；重试用完后这一块失败，其余块继续。 | 对得上 | [文档](https://api-docs.deepseek.com/quick_start/error_codes) |

## 相关代码

- [`backend/translation-agent/retainpdf_translation_agent_engine/agent_openai.py`](../../../../backend/translation-agent/retainpdf_translation_agent_engine/agent_openai.py)
- [`backend/translation/retainpdf_translation/llm/providers/deepseek/client.py`](../../../../backend/translation/retainpdf_translation/llm/providers/deepseek/client.py)
- [`backend/translation/retainpdf_translation/llm/providers/deepseek/transport.py`](../../../../backend/translation/retainpdf_translation/llm/providers/deepseek/transport.py)
- [`backend/translation/retainpdf_translation/llm/shared/upstream_resilience.py`](../../../../backend/translation/retainpdf_translation/llm/shared/upstream_resilience.py)

## 备注

- DeepSeek 没有业务码，HTTP 状态码本身就能区分：429 只表示并发/频率限制（可重试），余额不足单独用 402（不可重试），过载用 503，不存在智谱那种 429 混装多种原因的问题。
- 文档里没有“模型不存在”“上下文超长”“内容审核”的专门状态码，这些情况按文档推测会落在 400 或 422，要靠错误信息文字区分（未核实）。
- 408、413、504 不在任务列出的状态里，但当前页面有；说明里都指向 OCR、语音转文字、文档上传等接口，普通 chat completions 较少遇到。
- 速率限制页：并发按账户计算（与用哪个 Key 无关），默认并发上限 deepseek-flash 为 2500、deepseek-v4-pro 为 500，超出返回 429；开启 user_id 隔离后每个 user_id 也有同样的上限。
- 错误响应体结构和 Retry-After 头官方未说明。

## 出处

- [Error Codes](https://api-docs.deepseek.com/quick_start/error_codes)（抓取 2026-11-23）
- [Rate Limit & Isolation](https://api-docs.deepseek.com/quick_start/rate_limit)（抓取 2026-11-23）

## issue 里见过

- [#56](https://github.com/wxyhgk/retain-pdf/issues/56)：维护者建议降并发避开 429

## 相关文档

- [`docs/reference/LLM_api/DeepSeek/错误码.md`](../../../../docs/reference/LLM_api/DeepSeek/错误码.md)
