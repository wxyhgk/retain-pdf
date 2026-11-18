# Provider 校验接口

四个接口，都是 `POST`、`admin`（单机模式就是本机用户），用户点了「检测」按钮在等结果的前台请求：

| 接口 | 请求体字段 | 返回 |
|---|---|---|
| `/api/v1/providers/mineru/validate-token` | `mineru_token`（必填）、`base_url`、`model_version` | 校验结果（下面第 3 节） |
| `/api/v1/providers/paddle/validate-token` | `paddle_token`（必填）、`base_url` | 校验结果 |
| `/api/v1/providers/deepseek/validate-token` | `api_key`（必填）、`base_url`、`model`、`api_protocol` | 校验结果 |
| `/api/v1/providers/deepseek/balance` | 同上（只用 `api_key`、`base_url`） | 余额结果（第 4 节） |

- 请求体里**不认识的字段 400**（2026-10-22 起；以前 `base_url` 拼错会静默走默认地址，校验的是另一个服务商）。
  前端（`frontend/packages/api/src/providers.ts`）、CLI（`backend/cli/src/cmd/setup.rs`）发的字段都在上表里，CLI 查余额时发的四个字段都认。
- 必填字段为空也是 400（`mineru_token is required` 之类）；地址不合规是 400（第 5 节）。除此以外，连不上、Key 不对、服务商报错
  都是 **200**，结论在 `data.ok`、`data.status` 里。
- 前端只等 30 秒（`PROVIDER_PROBE_TIMEOUT_MS`），后端的超时要比它短，见第 6 节。

## 1. 请求体

```json
{ "mineru_token": "mineru-xxxx", "base_url": "https://mineru.net", "model_version": "vlm" }
{ "paddle_token": "xxxx", "base_url": "https://paddleocr.aistudio-app.com" }
{ "api_key": "sk-xxxx", "base_url": "https://api.deepseek.com/v1", "model": "deepseek-chat", "api_protocol": "openai" }
```

- `base_url` 空着用各家的默认地址（`RUST_API_MINERU_BASE_URL`、`RUST_API_PADDLE_BASE_URL`、`RUST_API_DEEPSEEK_BASE_URL`；
  `api_protocol=anthropic` 时默认 `https://api.anthropic.com/v1`）。
- `model_version` 默认 `vlm`。`api_protocol` 是 `openai`（默认）、`openai_responses` 或 `anthropic`，探针按翻译实际用的协议发请求。
- 翻译接口的 `model` 为空时只能查模型列表（只验 Key），填了就发一次 `max_tokens: 1` 的最小请求，Key、地址、模型一起验。OpenAI 格式下服务商回 400 说不认 `max_tokens`（OpenAI 的 gpt-5.x、o 系列，`param` 是 `max_tokens` 或正文提到 `max_completion_tokens`），换成 `max_completion_tokens: 16` 再发一次（issue #161）。

## 2. 各家怎么探

- MinerU：申请一个上传地址（`POST /api/v4/file-urls/batch`），不上传文件，不建 OCR 任务。
- Paddle：查一个随机编号的任务（`GET /api/v2/ocr/jobs/<随机>`），404 / 任务不存在算鉴权通过。
- 翻译接口：`/chat/completions`、`/responses` 或 Anthropic `/messages` 的最小请求；`model` 为空时 `GET /models`。
- 余额：只在 `base_url` 是 DeepSeek 官方地址时查，发往配置里固定的 `RUST_API_DEEPSEEK_BALANCE_URL`，不会把 Key 发到用户填的地址。

## 3. 校验结果

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "ok": false,
    "status": "expired",
    "summary": "MinerU Token 已过期",
    "retryable": false,
    "provider_code": "A0211",
    "provider_message": "token expired",
    "operator_hint": "更换新 Token",
    "trace_id": "trace-1",
    "base_url": "https://mineru.net",
    "checked_at": "2026-04-06T08:30:00Z"
  }
}
```

三个校验接口共用这一个结构（Rust 里叫 `ProviderProbeView`，2026-10-22 以前叫 `MineruTokenValidationView`，JSON 没变）。

- `summary` 是给用户看的中文；`operator_hint` 是下一步建议，可能带底层错误原文。
- `provider_code`：服务商的错误码，没有时是 HTTP 状态码（字符串），连不上时为 `null`。
- `provider_message`、`operator_hint` 最多 500 个字符，超出截断并以 `…` 结尾（服务商回一整页错误页时不原样转给前端）。
- 返回里不会有 Key 原文：Key 只放在请求头里，`base_url` 带账号密码直接 400。
- 界面判断用 `ok`；`status` 用来给更细的提示，**以后可能加值**，不认识的值按 `ok` + `summary` 处理。

### `status` 的取值

| `status` | `ok` | MinerU | Paddle | 翻译接口 | 含义 |
|---|---|---|---|---|---|
| `valid` | true | ✓ | ✓ | ✓ | 可用 |
| `rate_limited` | true | | | ✓ | Key 和模型都被接受了，此刻被限流（429） |
| `unauthorized` | false | ✓ | ✓ | ✓ | Key / Token 无效或没权限（401、403、MinerU `A0202` 等） |
| `expired` | false | ✓ | | | Token 已过期（MinerU `A0211`） |
| `model_unavailable` | false | | | ✓ | Key 通过了，模型名不存在或没开通；上游指明是别的参数（`error.param` 不是 `model`，或 `code` 是 `unsupported_parameter` / `unsupported_value`）时不算，归 `provider_error` |
| `insufficient_balance` | false | | | ✓ | 余额不足（402） |
| `invalid_input` | false | | | ✓ | Key 里有换行、全角空格等放不进请求头的字符，请求没发出去 |
| `redirected` | false | ✓ | ✓ | ✓ | 服务商回了 3xx。校验不跟随重定向（第 6 节），请检查地址 |
| `network_error` | false | ✓ | ✓ | ✓ | 没收到服务商的回复（连不上、超时、中途断开）；Paddle、翻译接口把 5xx 也算这一类 |
| `provider_error` | false | ✓ | ✓ | ✓ | 服务商回了别的错误，说不清是不是 Key 的问题 |

`retryable` 为 `true` 的只会是 `network_error`、`provider_error`（Key、模型、余额、地址的问题都要用户先改配置）；
`provider_error` 也可能是 `false`，例如服务商不支持 `/responses` 接口，或不收检测请求里的某个参数（`summary` 写明参数名，`provider_message` 末尾带上游错误码）。

## 4. 余额结果

```json
{
  "ok": true, "status": "available", "summary": "DeepSeek 余额可用：CNY 12.30", "retryable": false,
  "is_available": true,
  "balance_infos": [{ "currency": "CNY", "total_balance": "12.30", "granted_balance": "0.00", "topped_up_balance": "12.30" }],
  "provider_code": "200", "provider_message": null, "trace_id": null,
  "base_url": "https://api.deepseek.com/v1", "checked_at": "2026-10-22T08:30:00Z"
}
```

| `status` | 含义 |
|---|---|
| `available` | 余额可用 |
| `insufficient_balance` | 余额不足（返回里 `is_available=false`，或 402） |
| `unauthorized` | Key 无效（401、403） |
| `unsupported_provider` | `base_url` 不是 DeepSeek 官方地址，没有查 |
| `redirected` | 余额接口回了 3xx，没有跟随 |
| `network_error` | 没收到回复，或 5xx |
| `provider_error` | 别的 HTTP 错误 |

## 5. 地址检查

`base_url` 先过 `validate_provider_base_url`：要是 http(s)、不能带账号密码；能不能连本机和内网看部署模式：

| 部署 | 回环（`127.0.0.1`、`localhost`、`::1`）和私网（`10/8`、`172.16/12`、`192.168/16`、`fc00::/7`） | 链路本地（`169.254/16`、`fe80::/10`，云主机元数据） |
|---|---|---|
| 单机（默认） | 放开（2026-10-22 起；本机的 Ollama、vLLM 要能校验） | 拦 |
| 多用户 | 拦（行为不变） | 拦 |
| 设了 `RUST_API_ALLOW_PRIVATE_PROVIDER_URLS=1` | 放开 | 放开 |

被拦是 400，`message` 写明原因（`base_url host is not allowed; …`）。只看字面地址，域名解析到内网不拦（多用户已冻结，只记录）。

## 6. 超时、重试、重定向

校验接口和正式跑任务的客户端分开（正式任务的超时、重试不受影响）：

- 超时：四个接口共用 `RUST_API_PROVIDER_PROBE_TIMEOUT_SECS`，默认 20 秒；没设时认旧名 `RUST_API_DEEPSEEK_PROBE_TIMEOUT_SECS`。
  以前 MinerU、Paddle 校验用的是正式任务的 120 秒（Paddle 还重试 3 次），前端 30 秒就先放弃了。设得比 30 秒长，网页端会先显示「检测超时」。
- 不重试：Paddle 校验只试一次。
- 不跟随重定向：服务商回 3xx 直接给 `redirected`。跟随的话 Key 会被带到重定向后的地址（reqwest 跨主机只去掉 `Authorization`，
  不认识 Anthropic 的 `x-api-key`），重定向目标也绕过了第 5 节的地址检查。常见原因：http 和 https 写反了、地址多了或少了一段路径。

## 7. 前端怎么用

1. 用户输入或更新 Key / Token，点检测；
2. 调对应接口，看 `data.ok`，显示 `data.summary`；
3. 失败时可以补 `operator_hint`；调试模式再补 `provider_code`、`provider_message`、`trace_id`。

## 8. 和运行期失败诊断的关系

这几个接口是"前置校验"。运行期如果仍然出现鉴权问题，任务失败诊断里会继续识别（例如 MinerU `A0202` 无效 Token、`A0211` Token 过期）：
提交前用这些接口提前拦，运行中靠失败诊断兜底归因。

方案和取舍见 [服务商探测与用量](../../ops/planning/api-reorg/20261022-服务商探测与用量.md)。
