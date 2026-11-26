# `retainpdf` 命令行

代码：`backend/cli`（命令）、`backend/packages/retainpdf-config`（配置）。

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
thinking = "auto"            # 思考深度：auto / off / low / medium / high / max

[providers.custom]
base_url = "https://llm.example.com/v1"
protocol = "openai"          # 接口协议：openai（/chat/completions）/ anthropic（/messages）
model = "my-model"

[translation.reviewer]       # 审校（精修挑错）用的模型，不写就用翻译模型
provider = "anthropic"
thinking = "high"            # 可以和翻译用同一家、不同的思考深度

[ocr]
provider = "paddle"          # mineru / paddle / glm_ocr：后端 OCR 服务商清单里要 token 的那几家

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
paddle_token = "..."         # 每家一个键：<服务商>_token，例如 mineru_token、glm_ocr_token
```

生效顺序：命令行参数 > 环境变量 > 文件 > 内置默认。环境变量见 `retainpdf config keys`
（如 `RETAINPDF_TRANSLATION_API_KEY`、`RETAINPDF_TRANSLATION_WORKERS`、`RETAINPDF_TRANSLATION_PROTOCOL`、
`RETAINPDF_TRANSLATION_THINKING`、`RETAINPDF_DATA_DIR`）。Anthropic 默认用 anthropic 协议，其余服务商默认 openai。
`retainpdf config show` 列出每一项的生效值和来源，密钥只显示末四位。

能配哪些项、怎么校验、存哪个文件，由 `retainpdf-config` 的配置项表（`keys.rs`）统一决定。

## 命令

```text
retainpdf setup                     一问一答地配置翻译服务商、模型、并发、API Key、OCR；后端开着时当场检测
retainpdf config show|get|set|unset|keys|path|edit
retainpdf status                    后端、数据目录、书库、同步、备份的概况
retainpdf doctor                    逐项检查（有不通过的项时退出码 2）
retainpdf backup list|create|restore <编号或序号> [--yes]|delete <…>
retainpdf compact [--drop-events <任务编号>]... [--yes]
                                    整理书库数据库（只在后端没开时用）：先备份，截短老任务存下的程序输出、
                                    给的已结束任务的进度事件现在就清掉、整库压缩并切到增量收缩模式
retainpdf sync status|run|on|off|test
retainpdf sync set --folder <文件夹> | --webdav <地址> --user <账号> [--password-stdin] [--device-name <名字>]
retainpdf books export [--document <书编号>]...
                                    把书库导出成给 AI 读的 Markdown 文件夹（<数据目录>/books/），只有后端开着时能用；
                                    格式见 docs/api/13-书库/05-书文件夹.md
retainpdf mcp                       给 AI agent 用的 MCP 服务（stdio，由 agent 当子进程起），见下面「MCP 服务」
```

全局参数：`--json`（输出 JSON 给脚本）、`--data <目录>`（数据目录，默认依次取配置、正在运行的后端、
桌面版的默认位置）。

开发用、帮助里不列的：`retainpdf db-snapshot dump --db <库的副本> --out <文件>` 和 `retainpdf db-snapshot diff <前> <后> [--ignore …]`，
数据库改表结构前后比对读出来的东西，见 [数据库贡献指南](../contributing/database.md)。

## MCP 服务：`retainpdf mcp`

2026-11-25 起。给 AI agent（Claude Code、Codex、Gemini CLI，或以后桌面版的 AI 面板经 ACP 起的 agent）用的 MCP 服务：
stdio、每行一条 JSON-RPC 2.0 消息，不开端口；协议版本 2025-06-18（客户端要 2025-03-26、2024-11-05 时照它的回）。
方案见 [AI 怎么拿到书的数据](../../ops/planning/ai-data-access/20261124-AI怎么拿到书的数据.md)。

书的内容 agent 直接读书文件夹（`retainpdf books export` 导出的 `<数据目录>/books/`），这里只有两个工具（阅读页提问时另有互动块的两个，见下面）：

| 工具 | 参数 | 做什么 |
|---|---|---|
| `revise_translation` | `job_id`、`item_id`（照抄锚点）、`new_text`、`expected_old_text`（读到的那句译文）、`reason` | `PATCH /jobs/{job_id}/translations/{item_id}`，`source: "agent"`，带 `expected_translated_text`。期间被改过（409 `text_mismatch`）、没过检查、任务在跑时不写，把原因和当前译文 / 问题清单写进结果 |
| `view_page` | `side`：`source` 给 `document_id` + 书的页码 `page`；`translated` 给 `job_id` + 锚点的 `item_id`（按 `pNNN` 取页）或任务自己的页号 `page`；`width` 240～1600，默认 1000 | 取页图（JPEG），作为图片返回 |

- **密钥**：环境变量 `RETAINPDF_AGENT_KEY`（AI 专用密钥，后端配 `RUST_API_AGENT_KEYS`）优先，没有就用 `run/backend.json` 里的
  本机密钥。用 AI 专用密钥时只能调登记表里写了 `agent` 的接口，改译文只能记成 `agent`。
- **后端没开**：照样启动、照样列工具，调工具时回「RetainPDF 没开」；每次调工具都重新找后端，中途打开 RetainPDF 也能用上。
- 改译文要用户确认：MCP 的工具注解标了不是只读；Claude Code 默认每次调都会问。桌面版 AI 面板对它弹确认（第 4 步）。
- 接到 Claude Code：`claude mcp add retainpdf -- retainpdf mcp`，再在书文件夹里打开 Claude Code。
- **阅读页提问时多两个工具**（2026-11-26）：ACP 桥补进 `session/new` 的这个 MCP 在 `env` 里另给 `RETAIN_OPENUI_PROMPT`、
  `RETAIN_OPENUI_LIBRARY`、`RETAIN_OPENUI_CHECK`、`RETAIN_OPENUI_NODE`；有了就在 `instructions` 后面接互动块的 L0，多 `openui_spec`
  （取说明）、`openui_check`（起 Node 跑检查器）两个工具，不调后端。自己在终端里配的 `retainpdf mcp` 没有这些变量，照旧两个工具。
  说明见 [阅读页提问](../../api/16-AI/01-阅读页提问.md) 的「回答里的互动块」。

## 后端开着还是没开

同一个数据目录同一时间只能有一个程序写。命令行先看 `run/backend.json`：记录的进程在、数据目录相同、
`/health` 应答，就把会改东西的命令（备份、恢复、同步）转给后端（`books export` 只能经后端，后端没开时报错；`compact` 不转，后端开着时拒绝：压缩要独占数据库）；没有在用这个数据目录的后端时，直接
操作数据目录（规则和后端一样：恢复前先备份、有任务在跑时不恢复；同步用 `retainpdf_data::sync::control`，
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

阅读页的 AI 助手服务 2026-11-03 跟 RetainPDF 自己的 AI 一起删了（产品里只留 Studio 的 AI）；
`[assistant]` 这一段配置还能读写、导出，但后端已经没有用它的服务。
