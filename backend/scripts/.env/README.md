# 本地密钥

这个目录只放本机开发时使用的密钥文件。

当前约定：

- `mineru.env`
  文件中写入 `MINERU_API_TOKEN=...`
- `deepseek.env`（默认翻译 provider）
  文件中写入 `DEEPSEEK_API_KEY=...`
- `atlascloud.env`（可选翻译 provider，Atlas Cloud，OpenAI 兼容）
  文件中写入 `ATLASCLOUD_API_KEY=...`
  仅在设置 `RETAIN_TRANSLATION_PROVIDER=atlascloud` 时需要
  模板见 `atlascloud.env.example`

说明：

- 目录里的真实 `*.env` 文件已经被 Git 忽略
- 这里只用于本地开发，不用于对外交付
- 如果命令行传了 `--token` 或 `--api-key`，仍然以命令行参数为准
