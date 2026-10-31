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

## 前端规则

- 不要硬编码 provider 参数表。
- 表单字段从 `credential` 和 `options` 生成；`client_settable: false` 的选项不要做成输入框，也不要发。
- `credential` 为 `null` 时不展示凭据输入。
- provider-specific 非密钥参数写入 `ocr.options`。
