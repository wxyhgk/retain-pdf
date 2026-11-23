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
    "http_status": 200,
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
- `http_status`（数字，2026-11-23 起）：服务商回的 HTTP 状态码；没收到回复（连不上、超时）时为 `null`。
  MinerU、Paddle 校验成功时不记状态码，也是 `null`。
- `provider_code`（字符串）：**服务商自己的业务码**，从正文里读（MinerU `A0211`、Paddle `errorCode`、智谱 `1113`、
  OpenAI `insufficient_quota`、百炼 `Arrearage`……，怎么读见第 3.1 节）；正文里没有时为 `null`。
  2026-11-23 以前翻译接口在这里放 HTTP 状态码（`"429"`、成功时 `"200"`），MinerU 没有业务码时也拿 HTTP 状态码顶上，
  现在 HTTP 状态码只在 `http_status`。前端、CLI 都不读这个字段（2026-11-23 查过），所以直接改了含义，没有另起字段。
- `provider_message`、`operator_hint` 最多 500 个字符，超出截断并以 `…` 结尾（服务商回一整页错误页时不原样转给前端）。
- 返回里不会有 Key 原文：Key 只放在请求头里，`base_url` 带账号密码直接 400。
- 界面判断用 `ok`；`status` 用来给更细的提示，**以后可能加值**，不认识的值按 `ok` + `summary` 处理。

### `status` 的取值

| `status` | `ok` | MinerU | Paddle | 翻译接口 | 含义 |
|---|---|---|---|---|---|
| `valid` | true | ✓ | ✓ | ✓ | 可用 |
| `rate_limited` | true | | | ✓ | Key 和模型都被接受了，此刻被限流或服务商繁忙（429，且业务码不是欠费、额度类，见 3.1） |
| `unauthorized` | false | ✓ | ✓ | ✓ | Key / Token 无效或没权限（401、403、MinerU `A0202` 等）；套餐不包含这个模型、Key 类型不对（智谱 `1311`、`1315`，虽然是 429）也算 |
| `expired` | false | ✓ | | | Token 已过期（MinerU `A0211`） |
| `model_unavailable` | false | | | ✓ | Key 通过了，模型名不存在或没开通；上游指明是别的参数（`error.param` 不是 `model`，或 `code` 是 `unsupported_parameter` / `unsupported_value`）时不算，归 `provider_error` |
| `insufficient_balance` | false | | | ✓ | 欠费、余额不足、没订购、套餐到期：402，或业务码是这一类（OpenAI `credit_balance_exhausted`、智谱 `1113`/`1309`/`1314`、百炼 `Arrearage` 等，常是 429 或 400） |
| `quota_exceeded` | false | | | ✓ | 2026-11-23 起：到了用量或花费上限（OpenAI `insufficient_quota`、Anthropic `enforced_spend_limit_reached`、智谱 `1308`/`1310`/`1316`–`1321`、百炼 `BudgetLimitExceeded`、OpenCode「Policy budget exceeded」等），要等重置或调高上限 |
| `invalid_input` | false | | | ✓ | Key 里有换行、全角空格等放不进请求头的字符，请求没发出去 |
| `redirected` | false | ✓ | ✓ | ✓ | 服务商回了 3xx。校验不跟随重定向（第 6 节），请检查地址 |
| `network_error` | false | ✓ | ✓ | ✓ | 没收到服务商的回复（连不上、超时、中途断开）；Paddle、翻译接口把 5xx 也算这一类 |
| `provider_error` | false | ✓ | ✓ | ✓ | 服务商回了别的错误，说不清是不是 Key 的问题 |

`insufficient_balance`、`quota_exceeded` 和套餐类的 `unauthorized` 的 `summary` 是「翻译 API 不可用：<原因和下一步>」，
例如「翻译 API 不可用：智谱账户欠费或余额不足（也没有可用资源包），请充值后再用」；`operator_hint` 是「这不是限流，过一会儿重试也没用；处理好之前翻译会失败。」。

`retryable` 为 `true` 的只会是 `network_error`、`provider_error`（Key、模型、余额、地址的问题都要用户先改配置）；
`provider_error` 也可能是 `false`，例如服务商不支持 `/responses` 接口，或不收检测请求里的某个参数（`summary` 写明参数名，`provider_message` 末尾带上游错误码）。

### 3.1 业务码和 429（2026-11-23）

HTTP 429 在好几家都不只是限流：OpenAI 的额度用完、智谱欠费 `1113`、百炼 `Arrearage`、Anthropic 的月度消费封顶、
OpenCode 的工作区预算都走 429。以前翻译接口的校验只看状态码，429 一律报「可用（当前被限流）」，欠费的 Key 也是绿灯。
现在读正文里的业务码再分，代码在 `backend/packages/retainpdf-providers/src/upstream_limits.rs`
（`upstream_error_code`、`classify_upstream_limit`，从 `retainpdf-providers` 的门面导出，Rust 里别处要分 429 也用它）。

业务码按这个顺序找，第一个有值的算数：

1. Anthropic 的 `error.details.error_code`；
2. `error.code`（OpenAI、智谱、百炼兼容模式；数字也认）；
3. 顶层 `code`（百炼原生协议、Z.ai 的另一种写法）；
4. `error.type`（Anthropic；OpenAI 计费类只给 type 时）；
5. 都没有时，消息里有固定说法就用那句话：OpenCode 的 `Policy budget exceeded`、`Insufficient account funds`，
   百炼 Coding Plan 的 `hour/week/month allocated quota exceeded`。这些说法比码先看（OpenCode 包在 Anthropic 外壳里转发时，外壳的 type 是笼统的限流）。

| 归类 | 码（举例） | 校验 Key 的 `status` |
|---|---|---|
| 限流 | 没带码的 429、OpenAI `rate_limit_exceeded`/`slow_down`、Anthropic `rate_limit_error`/`ramp_limit_exceeded`、智谱 `1302`、百炼 `Throttling.*`（过载类除外）、`limit_requests` | `rate_limited`（`ok: true`，「可用（当前被限流）」） |
| 服务商繁忙 | 智谱 `1305`、百炼 `Throttling.ServiceOverloaded`/`ResourceExhausted`（都是 429） | `rate_limited`（`ok: true`，「可用（服务商当前繁忙）」） |
| 欠费 | 402；OpenAI `credit_balance_exhausted`；Anthropic `billing_error`、400「Your credit balance is too low」；智谱 `1113`/`1309`/`1314`；百炼 `Arrearage`（400/403）、`CommodityNotPurchased`、`PrepaidBillOverdue`、`PostpaidBillOverdue`；OpenCode「Insufficient account funds」 | `insufficient_balance` |
| 额度、上限 | OpenAI `insufficient_quota`（code 或 type）、`billing_hard_limit_reached`、`*_spend_limit_exceeded`、`organization_usage_limit_exceeded`；Anthropic `enforced_spend_limit_reached`、400「You have reached your specified … limits」；智谱 `1308`/`1310`/`1313`/`1316`–`1321`；百炼 `BudgetLimitExceeded`、`AllocationQuota.FreeTierOnly`（403）、Coding Plan 的时间窗额度；OpenCode「Policy budget exceeded」 | `quota_exceeded` |
| 套餐不含、Key 类型不对 | 智谱 `1311`、`1315` | `unauthorized` |

两条特殊规则：

- 百炼兼容模式的 `insufficient_quota` 是 TPS/TPM 限流（`Throttling.AllocationQuota`），和 OpenAI 的同名码意思相反：主机名带
  `dashscope` 或以 `aliyuncs.com` 结尾时按限流，消息里提到免费额度（free / 免费）时才算额度用完。
- Anthropic 官方地址（`*.anthropic.com`）回 429 `rate_limit_error`、没有 `details.error_code`、响应头又没有 `retry-after` 时，
  按消费封顶处理（官方文档的说法）。第三方的 Anthropic 兼容地址不套这条。

认不出的 429 照旧当限流；认不出码的非 429 照原来的分类走（401/403 → `unauthorized`，5xx → `network_error`……）。
不发额外请求，只看这一次的正文和响应头。只填了 Key 没填模型（走 `GET /models`）时，欠费、额度类照样报不可用，普通 429 照旧是 `provider_error`。

码表来源是各家官方错误码文档（2026-11-23 抓取），和错误码目录（[服务商错误码](../../reference/error-codes/README.md)）同一批数据；
这里的码表是检测接口自己用的一小份（只收限流、繁忙、欠费、额度、套餐五类），目录改了不会自动跟着变。

## 4. 余额结果

```json
{
  "ok": true, "status": "available", "summary": "DeepSeek 余额可用：CNY 12.30", "retryable": false,
  "is_available": true,
  "balance_infos": [{ "currency": "CNY", "total_balance": "12.30", "granted_balance": "0.00", "topped_up_balance": "12.30" }],
  "http_status": 200, "provider_code": null, "provider_message": null, "trace_id": null,
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

`http_status`、`provider_code` 和校验结果一样分开放（2026-11-23 起）：`http_status` 是余额接口回的状态码，`provider_code` 是正文里的业务码
（DeepSeek 基本没有，多数是 `null`；以前这里放 HTTP 状态码）。

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
3. 失败时可以补 `operator_hint`；调试模式再补 `http_status`、`provider_code`、`provider_message`、`trace_id`。

## 8. 拉取翻译接口的模型列表（2026-11-19）

`POST /api/v1/providers/translation/models`（admin；契约 [`translation-providers.v1`](../../../contracts/translation-providers.v1.schema.json)，调用函数 `listTranslationProviderModels`）。设置里「从服务商拉取」模型用：浏览器不能直接调服务商（跨域、Key 不能发出去），
后端代一次 `GET {base_url}/models`。Key 用完不存、不回显。

请求（`deny_unknown_fields`）：

```json
{ "base_url": "https://api.deepseek.com/v1", "api_key": "sk-…", "api_protocol": "openai" }
```

- `api_protocol`：`openai`（默认，也包括 `openai_responses`）发 `GET {base_url}/models`，`Authorization: Bearer`；
  `anthropic` 发 `GET {…/v1}/models`，`x-api-key` + `anthropic-version`，按 `has_more` / `last_id` 翻页（最多 10 页）。
- `base_url` 为空时：Anthropic 用官方地址，别的用默认翻译地址（和校验 Key 一样）。
- 地址检查、超时、不跟随重定向和上面第 5、6 节一样；没有 Key、地址不合规是 400。

返回（都是 200，看 `ok` / `status`）：

```json
{ "ok": true, "status": "ok", "summary": "拉到 4 个模型，其中 2 个对话模型", "source": "provider",
  "base_url": "https://api.deepseek.com/v1", "fetched_at": "…", "http_status": null, "provider_code": null, "provider_message": null,
  "chat_models": 2,
  "models": [ { "id": "deepseek-flash", "display_name": null, "owned_by": "deepseek", "created": 1760000000,
                "kind": "chat", "price_provider": "deepseek", "price_basis": "host",
                "price": { "input": 0.15, "output": 0.6, "cache_read": 0.003, "cache_write": null, "tiers": [], "peak_multiplier": 2.0 } } ] }
```

- `models` 按 `id` 排序、去重（重复的留第一条），最多 2000 个。认得出的列表形状：`{"data": [...]}`、裸数组、`{"models": [...]}`
  （Gemini 的 `name: "models/…"` 去掉前缀）。
- `kind`：名字里看得出是向量、语音、画图、审核、重排、OCR、实时、视频之类的记 `other`，其余 `chat`；`chat_models` 是 `chat` 的个数。
  前端默认只列 `chat`，「显示全部」再列别的。
- `price`：和 `POST /api/v1/usage/prices` 同一个形状、同一套对价规则（每百万 token 的美元，查不到是 `null`）。
- `status` 不是 `ok` 时 `models` 为空：

| `status` | 什么时候 | 界面 |
|---|---|---|
| `unsupported` | 服务商回 404 / 405 / 501，或者回的不是 JSON、没有模型列表 | 「这个接口不支持列模型，请手动填」 |
| `unauthorized` | 401 / 403 | Key 不对或没有权限 |
| `invalid_input` | Key 里有换行、全角空格等放不进请求头的字符 | 让用户重新粘贴 |
| `unreachable` | 连不上、超时、读到一半断开 | 稍后重试 |
| `provider_error` | 别的错误、重定向、列表太大（8 MB） | 显示 `summary`，调试时看 `http_status`、`provider_code`、`provider_message` |

`provider_message` 是服务商的报错原文，截到 500 个字符，里面出现的 Key 换成 `[REDACTED]`。

`http_status` 是出错时服务商回的 HTTP 状态码（成功、没收到回复时为 `null`），`provider_code` 是正文里的业务码（第 3.1 节，没有时 `null`）；
2026-11-23 以前 `provider_code` 放的是 HTTP 状态码。按业务码认出欠费、额度用完、套餐不含时 `status` 照旧（401/403 是 `unauthorized`，
其余 `provider_error`），`summary` 换成「服务商说这个 Key 现在不能用：<原因>」。

## 9. 用翻译接口的配置问一次模型，可以带图片（2026-11-22）

`POST /api/v1/providers/translation/ask`（admin；契约 [`translation-providers.v1`](../../../contracts/translation-providers.v1.schema.json)，调用函数
`askTranslationProviderModel`）。给前端、调试和以后的表格排版 agent 用：浏览器不能直接调服务商，后端代发一次对话请求。Key 用完不存、不回显。
实现在 `backend/packages/retainpdf-providers/src/provider_probe/ask.rs`。

请求（`deny_unknown_fields`；请求体上限 24 MB，比别的 JSON 接口的 2 MB 大，见接口登记的 `large_body`）：

```json
{ "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "api_key": "sk-…", "api_protocol": "openai",
  "model": "qwen-vl-max", "system": "你是排版检查员。", "prompt": "这两张表一样吗？",
  "images": [ { "media_type": "image/png", "data": "<base64>" } ], "max_tokens": 512 }
```

- 必填 `api_key`、`model`、`prompt`（最多 100000 字）。`images` 最多 4 张，每张解码后最多 4 MB，类型 png / jpeg / webp / gif，
  `data` 是标准 base64（不带 `data:` 前缀）。`max_tokens` 默认 1024，最多 8192。
- 按 `api_protocol` 换写法：`openai`（默认）发 `POST {base_url}/chat/completions`，图片是 `image_url` + data URL，新模型不认 `max_tokens`
  时换 `max_completion_tokens` 再发一次；`openai_responses` 发 `/responses`（`input_image`，`store: false`）；`anthropic` 发
  `/messages`（`image` 块，base64）。
- 地址检查、不跟随重定向和第 5、6 节一样；超时放长到 180 秒（看图要时间）。没有 Key / 模型 / 提示词、图片不对、地址不合规、
  字段不认识是 400。

返回（服务商那边的结果都是 200，看 `ok` / `status`）：

```json
{ "ok": true, "status": "ok", "summary": "模型已回答", "base_url": "…", "model": "qwen-vl-max", "protocol": "openai",
  "text": "两张表一样", "usage": { "input_tokens": 812, "output_tokens": 6 }, "images": 1, "elapsed_ms": 2310,
  "http_status": 200, "provider_code": null, "provider_message": null, "asked_at": "…" }
```

| `status` | 什么时候 |
|---|---|
| `unauthorized` | 401 / 403；套餐不含这个模型、Key 类型不对（智谱 `1311`、`1315`） |
| `rejected` | 别的 4xx：常见是模型不支持看图、图片太大、模型名不对（看 `provider_message`） |
| `rate_limited` | 429 且业务码是限流或服务商繁忙，或没带码（第 3.1 节） |
| `insufficient_balance` | 2026-11-23 起：欠费、余额不足、没订购、套餐到期（402，或第 3.1 节的欠费类业务码，常是 429） |
| `quota_exceeded` | 2026-11-23 起：用量或花费上限（第 3.1 节的额度类业务码） |
| `provider_error` | 5xx、重定向、回的不是 JSON |
| `unreachable` | 连不上、超时、读到一半断开 |
| `empty` | 回了但没有文字（可能都用在思考上，调大 `max_tokens`） |
| `invalid_input` | Key 里有放不进请求头的字符 |

`http_status` 是服务商回的 HTTP 状态码（成功时也有；连不上、超时、请求没发出时为 `null`），`provider_code` 是正文里的业务码（第 3.1 节）。
以前 429 一律 `rate_limited`、`summary` 是「服务商限流或额度不够」，`provider_code` 放 HTTP 状态码；2026-11-23 起按业务码分开，
欠费、额度类的 `summary` 是「服务商拒绝了：<原因>（重试没用）」。

Python 这边（翻译、表格 agent 用的 `request_chat_content`）也能带图了：消息的 `content` 写成片段列表（`model_wire.text_part` /
`model_wire.image_part`），三种协议各自换写法，见 `backend/translation/retainpdf_translation/llm/shared/model_wire.py` 开头。
Rust 模型执行器（`RETAIN_MODEL_EXECUTOR`）还只收文字，带图的请求在 Python 这边直接报错，不会悄悄丢图。

## 10. 和运行期失败诊断的关系

这几个接口是"前置校验"。运行期如果仍然出现鉴权问题，任务失败诊断里会继续识别（例如 MinerU `A0202` 无效 Token、`A0211` Token 过期）：
提交前用这些接口提前拦，运行中靠失败诊断兜底归因。

各家上游错误码（含义、给用户的提示、运行期我们怎么处理、和官方说法对不对得上）另有目录接口 `GET /api/v1/providers/error-codes`
（2026-11-23，signed，契约 `provider-error-codes.v1`），见 [服务商错误码接口](../../api/08-调试诊断/03-服务商错误码.md)、
[服务商错误码](../../reference/error-codes/README.md)。检测接口以前把 429 一律报成「可用（当前被限流）」，2026-11-23 起按业务码分开（第 3.1 节）；
运行期翻译那一侧的同类缺口还记在目录里。

方案和取舍见 [服务商探测与用量](../../ops/planning/api-reorg/20261022-服务商探测与用量.md)。
