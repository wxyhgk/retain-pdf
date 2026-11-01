# OCR Provider 列表

## 接口

```http
GET /api/v1/providers/ocr
```

用于发现后端当前支持的 OCR provider、凭据字段、可配置 options、能力和产物布局。
不分页（提供方就几个）。返回的结构由契约 `contracts/ocr-providers.v1.schema.json` 钉住
（`@retainpdf/contracts/ocr-providers`，2026-10-22 补）。

## 响应示例

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "key": "paddle",
      "display_name": "PaddleOCR",
      "provider_kind": "remote",
      "credential": {
        "field": "paddle_token",
        "env": "RETAIN_PADDLE_API_TOKEN",
        "required_for": ["remote_url", "local_upload"]
      },
      "options": {
        "paddle_model": {
          "type": "string",
          "default": "PaddleOCR-VL-1.6",
          "aliases": {
            "paddleocr-vl": "PaddleOCR-VL-1.6"
          },
          "choices": [],
          "required": false,
          "client_settable": true
        }
      },
      "capabilities": {
        "supports_remote_url_submit": true,
        "supports_local_file_upload": true,
        "supports_polling": true,
        "supports_download_bundle": true,
        "supports_extra_formats": false,
        "supports_formula_toggle": false,
        "supports_table_toggle": false
      },
      "artifact_layout": {
        "provider_result_json": "paddle_result.json",
        "provider_bundle_zip": "paddle_bundle.zip",
        "provider_raw_dir": "paddle_raw",
        "layout_json": "paddle_result.json"
      }
    }
  ]
}
```

`local` 的两个选项只能服务器定，列出来但不给默认值：

```json
"options": {
  "command": {
    "type": "string",
    "default": null,
    "env": "RETAIN_LOCAL_OCR_COMMAND",
    "aliases": {},
    "choices": [],
    "required": false,
    "client_settable": false
  },
  "raw_provider": {
    "type": "string",
    "default": null,
    "env": "RETAIN_OCR_RAW_PROVIDER",
    "aliases": {},
    "choices": [],
    "required": false,
    "client_settable": false
  }
}
```

## 选项分两类：客户端可填、只能服务器定（2026-10-22）

`options.<键>.client_settable`（只增的字段）说明建任务时请求能不能在 `ocr.options` 里带这个键：

- `true`：客户端可填，例如 Paddle 的 `transport`、`paddle_model`，MinerU 的 `language`。
- `false`：只能服务器定——本地 / 命令型 OCR 要执行的 `command`、原始结果交给哪个转换器的 `raw_provider`，
  以及配置里带 `env` 的选项（没写 `client_settable: true` 时）。这类选项的 `default` 恒为 `null`
  （运维在 `ocr_providers.json` 里写的命令通常带本机路径，不给所有登录用户看），值由服务器的配置文件和环境变量定。
  建任务请求里带了返回 400：`ocr.options.command is server-owned; configure it on the server …`。
- 这里没列出的选项（例如 Paddle CLI 的 `cli_timeout`）除 `command`、`raw_provider` 外都算客户端可填。

每个选项怎么分的、为什么，见 [OCR 提供方选项分客户端和服务器](../../ops/planning/api-reorg/20261022-OCR提供方选项分客户端和服务器.md)。

## provider_kind

- `remote`: 后端内置远程 provider，例如 MinerU、Paddle。
- `local_command`: 配置型本地命令 provider。
- `remote_command`: 配置型远程命令 provider。

内置的 `glm_ocr`（智谱 GLM-OCR，2026-10-31）也是 `remote_command`，在 Python provider worker 里跑，用法和 key 的来源见 [GLM-OCR](./06-GLM-OCR.md)。

## 和翻译并行（2026-10-31 起）

整本任务（`book`、`translate`）的 OCR 能一片片公布已做完的页时，OCR 子任务和翻译阶段同时跑，翻译跟着 OCR 一轮轮翻
（事件格式见 [GLM-OCR](./06-GLM-OCR.md#和翻译并行2026-10-31)）。哪些会：

- `glm_ocr`：每 10 页一片串行提交（智谱按 key 排队，并发不加速）。OCR 子任务的进度 `substage` 是 `glm_ocr`。
- `paddle`（2026-11-01）：官方云服务（没填 `paddle_api_url`）、官方 HTTP、上传的文件时，原文切成每份 10 页同时提交最多 4 份
  （同一个 token 的几个任务是真并行的，实测 34 页从整份 46–94 秒降到 11–24 秒），一份迟迟不开始就再交一份。
  做完哪份就公布哪份，不等前面的份：翻译先翻已经到的页，所以 `ocr_stream` 的页数可能一下跳到 14/34（后两份先好了）。
  OCR 子任务的进度 `substage` 是 `paddle_chunks`（`progress_current/total` = 已识别页 / 总页）。
  自建 Paddle 服务、远程地址的原文、官方命令行照旧整份提交、做完再翻。
- 其余服务商照旧先 OCR、再翻译。

## 前端规则

- 不要硬编码 provider 参数表。
- 表单字段从 `credential` 和 `options` 生成；`client_settable: false` 的选项不要做成输入框，也不要发。
- `credential` 为 `null` 时不展示凭据输入。
- provider-specific 非密钥参数写入 `ocr.options`。
