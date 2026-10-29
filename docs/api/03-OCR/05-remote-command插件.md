# remote_command 插件

`remote_command` 用于接入新的远程 OCR 服务，但不把第三方 submit / poll / download 状态机写进 Rust 主流程。

## 设计原则

- 后端只负责启动插件命令、传入 source、options、credential 和 artifact 路径。
- 插件命令负责远程 API 的提交、轮询、下载、重试。
- 主 workflow 只消费源 PDF 和 `document.v1.json`。

## 配置示例

```json
{
  "providers": {
    "my_remote_ocr": {
      "display_name": "My Remote OCR",
      "kind": "remote_command",
      "credential": {
        "field": "credential",
        "env": "RETAIN_MY_REMOTE_OCR_TOKEN",
        "required_for": ["remote_url", "local_upload"]
      },
      "options": {
        "command": {
          "type": "string",
          "default": "python /path/to/my_remote_ocr.py"
        },
        "raw_provider": {
          "type": "string",
          "default": "generic_flat_ocr"
        }
      }
    }
  }
}
```

`command`、`raw_provider` 只能服务器定：只认这份配置的默认值和环境变量，任务请求的 `ocr.options` 里带了 400
（`ocr.options.command is server-owned; …`，2026-10-22，见 [local-command 插件](./04-local-command插件.md)）。
配置里带 `env` 的选项默认也只能服务器定；要让客户端能填，在选项里写 `"client_settable": true`（对 `command`、`raw_provider` 无效）。

## 凭据

配置型 command provider 的凭据可来自：

- `ocr.options.credential`
- `ocr.options.token`
- `ocr.options.api_key`
- provider config 里的 `credential.env`

worker 会把解析后的密钥写入：

```text
RETAIN_OCR_CREDENTIAL
```

如果配置了 `credential.env`，插件也可以读取自己的环境变量。

## URL 输入契约

当任务使用 `source.file_url` 时：

- `RETAIN_OCR_SOURCE_URL` 会包含原始 URL。
- `RETAIN_OCR_SOURCE_PDF` 可能为空。
- 插件必须把最终源 PDF 写入 `RETAIN_OCR_SOURCE_DIR`。

如果插件没有落 source PDF，任务会失败，因为翻译和渲染后续必须使用本地 source artifact。它必须是一份能打开的真 PDF：
交回 raw payload 时，后端按它每页的尺寸把坐标缩放到 PDF point（2026-10-29 起）。
