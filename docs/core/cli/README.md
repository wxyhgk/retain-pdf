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

## 桌面版

- **配置的唯一来源是 `~/.retainpdf/`。** 设置页的翻译服务商、各服务商的模型 / 地址 / 并发 / API Key、
  OCR 与 token 都经命令行读写（`retainpdf config export --with-secrets` / `config import`，见
  `frontend/desktop/src/main/retainpdf-home.js`）。在终端里改的，应用下次读设置就是新的。
- **`desktop-config.json` 只留界面状态和其它任务选项**（首次启动、托盘提示、公式模式等），不再存密钥。
- **第一次启动新版时自动迁移。** 旧文件里的接口设置搬进 `~/.retainpdf/`，原文件先备份成
  `desktop-config.before-retainpdf-home.json`（0600），然后从旧文件里删掉这些字段。
- **启动后端时：**
  - `[backend]`（同时任务数、同步间隔、备份间隔）、`[assistant]`（模型、地址、密钥、工具轮数）作为
    环境变量的默认值传进去；
  - `backend.data_dir` 配了就用它当数据目录；
  - 打开 `RUST_API_WRITE_RUNTIME_FILE`。
- **命令行没编译时退回旧做法**（全部存在 `desktop-config.json`），开发时不受影响。
- **设置 → 更新 →「安装命令行工具」：**
  - 把包里的 `retainpdf` 链接到 `/usr/local/bin`（可写时）或 `~/.local/bin`，后者不在 PATH 里时提示怎么加；
  - 同名的普通文件不覆盖；
  - Windows 暂不支持。

AI 助手服务自己的设置（运行方式、模型、密钥，「AI 设置」页管理，存在数据目录里）还没有并进来；
`[assistant]` 目前只作为它没设置过时的默认值。
