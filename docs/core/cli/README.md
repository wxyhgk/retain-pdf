# `retainpdf` 命令行

代码：`backend/cli`（命令）、`backend/packages/retain-config`（配置）。

## 配置：`~/.retainpdf/`

和 Codex、Claude Code 一样，配置放在用户目录下，命令行和桌面版共用（`RETAINPDF_HOME` 可以换位置）：

```text
~/.retainpdf/
  config.toml        设置，可以手改，程序改值时保留注释
  credentials.toml   接口密钥与 OCR token（明文，权限 0600）
  run/backend.json   正在运行的后端：地址、本机访问密钥、数据目录（后端启动时写）
```

```toml
[translation]
provider = "deepseek"        # deepseek / qwen / openai / anthropic / zhipu / custom

[providers.deepseek]         # 每个服务商一张表，不写用内置默认
model = "deepseek-flash"
workers = 50                 # 并发

[providers.custom]
base_url = "https://llm.example.com/v1"
model = "my-model"

[ocr]
provider = "paddle"          # paddle / mineru

[assistant]                  # 阅读页 AI 助手，不写和翻译一样
provider = "qwen"

[backend]
data_dir = "~/RetainPDF"     # 不写用桌面版的默认位置
max_running_jobs = 2
```

```toml
# credentials.toml
[providers.deepseek]
api_key = "sk-..."
[ocr]
paddle_token = "..."
```

生效顺序：命令行参数 > 环境变量 > 文件 > 内置默认。环境变量见 `retainpdf config keys`
（如 `RETAINPDF_TRANSLATION_API_KEY`、`RETAINPDF_TRANSLATION_WORKERS`、`RETAINPDF_DATA_DIR`）。
`retainpdf config show` 列出每一项的生效值和来源，密钥只显示末四位。

能配哪些项、怎么校验、存哪个文件，由 `retain-config` 的配置项表（`keys.rs`）统一决定。

## 命令

```text
retainpdf setup                     一问一答地配置翻译服务商、模型、并发、API Key、OCR；后端开着时当场检测
retainpdf config show|get|set|unset|keys|path|edit
retainpdf status                    后端、数据目录、书库、同步、备份的概况
retainpdf doctor                    逐项检查（有不通过的项时退出码 2）
retainpdf backup list|create|restore <编号或序号> [--yes]|delete <…>
retainpdf sync status|run|on|off|test
retainpdf sync set --folder <文件夹> | --webdav <地址> --user <账号> [--password-stdin] [--device-name <名字>]
```

全局参数：`--json`（输出 JSON 给脚本）、`--data <目录>`（数据目录，默认依次取配置、正在运行的后端、
桌面版的默认位置）。

## 后端开着还是没开

同一个数据目录同一时间只能有一个程序写。命令行先看 `run/backend.json`：记录的进程在、数据目录相同、
`/health` 应答，就把会改东西的命令（备份、恢复、同步）转给后端；没有在用这个数据目录的后端时，直接
操作数据目录（规则和后端一样：恢复前先备份、有任务在跑时不恢复；同步用 `retain_data::sync::control`，
与后端同一套）；记录说后端在却连不上时，会改东西的命令拒绝执行。`status`、`doctor` 只读，任何时候都能用。

后端只在 `RUST_API_WRITE_RUNTIME_FILE=1` 时写运行记录（桌面版、开发脚本打开），测试和别的部署起的后端
不碰用户目录。
