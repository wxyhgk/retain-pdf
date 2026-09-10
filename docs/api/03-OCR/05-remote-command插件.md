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

如果插件没有落 source PDF，任务会失败，因为翻译和渲染后续必须使用本地 source artifact。
