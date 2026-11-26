# RetainPDF + pi：用 pi 做第二个自带 agent

2026-11-26，分支 `feat/pi-agent`。接着 [ACP 官方登记表](./20261126-ACP官方登记表.md) 第二部分「pi 做我们自己的 agent」：
用户 2026-11-26 定了**做**，先走 pi-acp 加包装脚本这条路（方案里的第 2 步），不换掉 Python 自带 agent。
接口用法见 [docs/api/16-AI/01-阅读页提问.md](../../../api/16-AI/01-阅读页提问.md) 的「RetainPDF + pi」。

## 做了什么

```
浏览器 ──WebSocket──▶ 后端 ACP 桥 ──stdio──▶ pi-acp ──PI_ACP_PI_COMMAND──▶ backend/pi-agent/bin/retainpdf-pi ──exec──▶ pi
                     （acp/pi.rs）            （本机装的）                       （加锁定参数）                        └ -e extension/index.ts
```

- **新 agent id `retainpdf-pi`**，`kind: "builtin"`，排在 `retainpdf` 后面。和 `retainpdf` 一样用设置里的模型：握手参数相同
  （`model`、`base_url`、`api_protocol`、`thinking`、`credential_ref`、`job_id`），读书的环境变量相同
  （`RETAIN_ASK_JOB_ID` / `DOCUMENT_ID` / `BACKEND_URL` / `BACKEND_KEY`）。
- **扩展** `backend/pi-agent/extension/`（TS，pi 用 jiti 加载，不编译；Node 直接去掉类型跑测试）：
  - `book.ts`：三个只读工具 `read_pages` / `search_book` / `view_page`，材料（`background` / `prefetch` / `overview`），
    **照搬** `backend/ask-agent/retainpdf_ask_agent/tools.py`——接口、页码换算、截断上限、给模型的字都一样，测试是同一套书、同一批断言。
  - `index.ts`：注册工具（参数写成普通 JSON Schema，不 import pi 的包，假 pi 对象就能测）；`input` 钩子把材料放在这一问**最前面**
    （和 Python 版一样，系统提示词说的「消息最前面……那段」）；`before_agent_start` 往系统提示词加一节 `<book>`（页数、目录）；
    `turn_start` / `tool_call` 管防失控上限（4 轮、每轮 4 个，超了不执行、回一句话；再多两轮还在调就结束这一问）；
    **除了这三个工具，一切工具调用都拦下**（升级 pi 后默认行为变了的保险）。
- **系统提示词不另抄**：包装脚本 `--system-prompt` 给 `ask_system.txt`，有书时 `--append-system-prompt` 给 `ask_tools.txt`（都在
  `backend/ask-agent/retainpdf_ask_agent/prompts/`）。pi 会在后面加 `<cwd>`（书文件夹的路径）和我们的 `<book>`，不加它自己的「coding assistant」那段。
- **包装脚本** `backend/pi-agent/bin/retainpdf-pi`（POSIX sh）：pi-acp 给的参数（`--mode rpc --no-themes [--session 文件]`）原样传，后面加：

  | 参数 | 为什么 |
  |---|---|
  | `--model retainpdf/<模型> --thinking <档位>` | 用桥写的私有 `models.json` 里唯一的服务商 |
  | `--system-prompt …/ask_system.txt`、`--append-system-prompt …/ask_tools.txt` | 沿用 Python 版的提示词 |
  | `-e …/extension/index.ts` | 我们的扩展（`-ne` 下显式给的照样加载） |
  | `-nbt --tools read_pages,search_book,view_page` | 关掉 pi 的 read / bash / edit / write，只开读书的三个 |
  | `--no-mcp` | 不连任何 MCP（pi 0.99 起 MCP 是内置扩展） |
  | `-ne -ns -np` | 不加载自动发现的扩展、skill、提示词模板（用户 `~/.pi` 里的） |
  | `-nc` | 不读 `AGENTS.md` / `CLAUDE.md`（pi 会从工作目录一路往上找） |
  | `-na` | 不信任工作目录里的 `.pi/`（书文件夹里放了也不加载） |
  | `--offline` | 不联网更新模型目录 |
  | `--session-dir <数据目录>/ask-pi/sessions` | 会话放我们的数据目录 |

- **桥**（`backend/packages/retainpdf-providers/src/acp/pi.rs`）：
  - 「装了没有」走登记表里 pi-acp 的解析和 `requires`（`registry.rs` 只加了 `resolve_local_agent_and_requirement`，顺带拿 pi 的路径），
    所以并行的「后端托管安装」分支合进来后，托管目录里的 pi-acp / pi 自动生效。没装：`available: false`，`reason`、`install` 和本机 agent 的 pi-acp 一样。
  - **闸门**：pi 是用户本机的 Node 程序，和本机 agent 同一道（单机、只在本机监听、本机地址打开、没经过代理、没关 `RUST_API_LOCAL_AGENTS`）。
    服务器、Docker 上只有 `retainpdf`。Windows 先不支持（包装脚本是 sh）。安装包没带 `backend/pi-agent` 或提示词时列成不能用，说清楚。
  - **每次连接一个私有配置目录**（`PI_CODING_AGENT_DIR` = `<数据目录>/ask-pi/connections/<时间>-<随机>/`），连接结束就删（`AgentProcess.scratch_dir`，
    桥结束时删）；握手后没升级成 WebSocket 漏下的，下次起 pi 时扫掉两天前的。里面两个文件：
    - `models.json`：只有服务商 `retainpdf`。`api_protocol` → `api`：`openai` → `openai-completions`，`openai_responses` → `openai-responses`，
      `anthropic` → `anthropic-messages`。Anthropic 的地址去掉 `/v1`（pi 用官方 SDK 的写法），空着用 `https://api.anthropic.com`；
      OpenAI 协议空着和 Python 版一样用 DeepSeek 的。`apiKey` 写 **`$RETAIN_ASK_API_KEY`**：密钥只在环境变量里，不落盘。
      兼容开关（真机撞出来的，见下）：Anthropic `forceAdaptiveThinking: true`；不是 `api.openai.com` 的 `supportsDeveloperRole: false`。
      上下文窗口和 Python 版一样估（Anthropic 20 万、别的 12.8 万），输出上限 16384。
    - `settings.json`：默认模型和三个工具；`cacheWarming: off`（pi 默认会在空闲时发请求保温缓存，花钱）、`enableInstallTelemetry: false`、
      `defaultProjectTrust: never`、`enableSkillCommands: false`。**没有 `auth.json`**（它比 `models.json` 优先；pi 启动时会自己写一个 `{}`，空的）。
  - **pi-acp 的 `HOME`** 换成 `<数据目录>/ask-pi/home`：pi-acp 的会话对照表（`~/.pi/pi-acp/session-map.json`）、它列斜杠命令时读的
    `~/.pi/agent/prompts`、`extensions` 都不碰用户的 `~/.pi`。包装脚本再把 pi 的 `HOME` 换回用户的（`RETAIN_PI_USER_HOME`）：pi 的安装器把
    Node 放在 `~/.local/share/pi-node`，HOME 换掉就找不到 Node；pi 的配置目录照旧是私有的。
  - 另给 `PI_OFFLINE=1`、`PI_SKIP_VERSION_CHECK=1`、`PI_TELEMETRY=0`。
  - 不补 `retainpdf mcp`（pi-acp 不把 `mcpServers` 交给 pi，书由扩展自己读）；`cwd` 照旧是书文件夹。
- 思考档位：`off` / `low` / `medium` / `high` 照传；`max` 先按 `high`（pi 的 `xhigh` / `max` 要模型另登记 `thinkingLevelMap`）；
  没给（「自动」，前端选「关」时也不传）Anthropic 用 `low`（和 Python 版对 claude-haiku-5-5 的自动档一样），别的 `off`。

### 锁住了什么

| | 怎么锁的 | 怎么验的 |
|---|---|---|
| 没有 bash、不改文件 | `-nbt` + `--tools` 白名单 + 扩展的 `tool_call` 拦一切别的工具；`settings.json` 的 `defaultTools` 也只有这三个 | `pi-acp.test.ts`：假模型要调 `bash`，回的是「Tool bash not found」，模型请求里只声明了三个工具（pi 1.1.0、1.6.1 都过） |
| 不读用户的 `~/.pi`、`AGENTS.md`、skill、MCP | 私有 `PI_CODING_AGENT_DIR`；pi-acp 的 HOME 私有；`-ne -ns -np -nc -na --no-mcp` | 测试看系统提示词里没有 `AGENTS.md`、没有 coding assistant 那段；pi-acp 的会话对照表写在私有 HOME |
| 不放 `auth.json`、密钥不落盘 | `models.json` 只写 `$RETAIN_ASK_API_KEY` | Rust 测试读私有目录每个文件找不到密钥；`pi-acp.test.ts` 跑完扫整个临时目录（配置、会话、HOME）找不到密钥 |
| 模型挑不了地址、书 | 书、后端地址、读书密钥只在环境变量里；工具是写死的几个只读 GET | 同 Python 版 |
| 不花冤枉钱 | `cacheWarming: off`、`--offline`、安装统计关 | — |

没锁的（知道的）：
- pi-acp 自己的斜杠命令（问题以 `/export`、`/compact` 开头时 pi-acp 先处理，`/export` 会在书文件夹写一个 HTML）。前端发的问题前面总有出处那段字，碰不到；
  要彻底关得换成自己的 Node 入口（见「以后」）。
- 后端进程的环境变量 pi-acp、pi 都继承（和 Python 自带 agent、本机 agent 一样）；没有 bash，模型读不到。
- 后端环境里要是有 `ANTHROPIC_API_KEY` 之类，pi 的内置服务商会变成「能用」，pi-acp 的 `configOptions` 里能切过去；前端不发切模型的请求，`enabledModels` 也只写了 `retainpdf/<模型>`。

### pi 版本

- 本机 2026-11-26：pi 1.1.0（pi 安装器装的，`~/.pi/agent/install/releases/1.1.0`）、pi-acp 0.0.35；另在临时目录 `npm install --prefix` 了 pi 1.6.1。
- 包装脚本的每个参数在 1.1.0 和 1.6.1 的 `--help` 里都有，`pi-acp.test.ts` 两个版本都过。
- **最低 1.1.0**：1.0.2（本机也有）没有 `--no-mcp`，pi 起不来（pi-acp 回 `Cannot call write after a stream was destroyed`）。桥不查版本（每次列表都起一次 `pi --version` 太慢），
  版本太老时问答窗看到的是 agent 退出的原因。
- pi-acp 0.0.x 是一个人维护的；它的行为（工具卡片、用量、斜杠命令）跟着它走。

## 真机撞出来的（2026-11-26）

- **claude-haiku-5-5 回 400**：「`thinking.type.enabled` is not supported for this model. Use `thinking.type.adaptive` and `output_config.effort`」。
  pi 对内置目录里没有的模型（我们的服务商是 `retainpdf`）默认发 `enabled` + 预算；内置目录里 Anthropic 的 4.6 以后都标了 `forceAdaptiveThinking`。
  所以 Anthropic 协议一律加 `forceAdaptiveThinking: true`；老模型（4.5 以前）不认 adaptive，到时思考选「关」。
- **qwen3.8-flash（DashScope）回 400**：「developer is not one of ['system', 'assistant', 'user', 'tool', 'function']」。pi 1.1.0 对自定义服务商默认把系统提示词
  按 `developer` 发；不是 `api.openai.com` 的一律 `supportsDeveloperRole: false`。
- pi-acp 把一问的几段文字**直接接起来、不加分隔**（`promptToPiMessage` 里 `message += text`），出处那段的最后一行「（RetainPDF 任务 …，第 N 页）」
  后面紧跟着问题。扩展按这一行拆回「出处」和「问题」（`splitPrompt`），「问题里写的第 N 页」只在问题那段里找，和 Python 版一样。
- `pi -p` 在标准输入没关时会一直等（读 stdin 当附加消息），命令行试的时候要 `</dev/null`。pi-acp 用的是 `--mode rpc`，没有这个问题。

## 实测（真模型，和 Python 自带 agent 对比）

2026-11-26。起一个临时后端（这个分支的 `rust_api`，端口 41150，临时数据目录：数据库用 `sqlite3 .backup` 拷一份、只拷一个任务——
和 [自带 agent 读书](./20261125-自带agent读书.md) 实测同一篇 70 页的论文；自己的 API key；不碰开发者在 41000 端口的开发栈），
在临时凭据库里存 claude-haiku-5-5、qwen3.8-flash 的密钥，**经后端的 ACP 桥（WebSocket）**连 `retainpdf` 和 `retainpdf-pi`，
握手参数和前端一样（`model`、`base_url`、`api_protocol`、`thinking=low`、`credential_ref`、`job_id`）。本机 pi 1.1.0、pi-acp 0.0.35。
每个问题一个新会话，`session/new` 后等 1 秒再问；带字的问题照前端 `anchorPromptBlocks` 的写法附出处。跑完删了临时数据目录。

表里是「工具次数 / 首字秒数 / 总秒数」。首字是发问到第一段思考或正文（两边都流式发思考），总是到 `session/prompt` 回来：

| 问题 | Haiku：Python | Haiku：pi | Qwen：Python | Qwen：pi |
|---|---|---|---|---|
| (a) 这句译得对吗 | 0 / 3.8 / 11.6 | 0 / 6.3 / 15.7 | 2 / 0.6 / 29.9 | 0 / 0.7 / 20.0 |
| (a) 解释这段 | 0 / 4.9 / 8.9 | 0 / 3.9 / 10.4 | 0 / 1.7 / 27.4 | 0 / 0.6 / 48.4 |
| (a) 这个公式什么意思 | 0 / 5.0 / 7.8 | 0 / 5.1 / 10.1 | 0 / 5.7 / 27.9 | 3 / 1.6 / 32.7 |
| (a) 选中词问这里指什么 | 0 / 5.1 / 5.4 | 0 / 3.8 / 6.1 | 0 / 0.7 / 21.5 | 0 / 1.0 / 21.7 |
| (b) 选中词问书里别处怎么用 | 1 / 2.7 / 8.4 | 1 / 2.6 / 6.6 | 1 / 3.3 / 29.6 | 1 / 0.7 / 12.0 |
| (b) 选中概念问前面哪里定义过 | 1 / 6.8 / 12.0 | 1 / 3.1 / 6.6 | 1 / 0.6 / 10.3 | 1 / 2.5 / 12.2 |
| (c) 第 5 页讲了什么 | 0 / 2.0 / 5.5 | 0 / 6.3 / 10.8 | 0 / 2.6 / 23.1 | 1 / 2.7 / 27.2 |
| (c) 书里哪里讲到某个不等式 | 1 / 4.1 / 8.2 | 1 / 5.3 / 8.3 | 1 / 16.4 / 29.9 | 1 / 0.6 / 13.8 |
| (c) 主要结论、证明分几步 | 1 / 7.5 / 19.4 | 1 / 2.5 / 13.5 | 1 / 2.5 / 29.5 | 3 / 0.6 / 35.5 |
| 合计工具 / 首字中位数 / 总时间中位数 | 4 / 4.9 / 8.4 | 4 / 3.9 / 10.1 | 6 / 2.5 / 27.9 | 10 / 0.7 / 21.7 |

- **Haiku 两边几乎一样**：调工具的题、次数完全相同（带字问这段本身都是 0，问别处、整本书各 1 次）；九题总时间 87 秒对 88 秒。
  首字 pi 偶尔慢 2–4 秒（第一题、「第 5 页」），pi 先发一段思考再答，Python 版思考摘要短；看不出系统性差别。
- **Qwen：pi 版爱调工具一些**（10 次对 6 次）：「这个公式」先搜了两次 `d_\phi` 的定义再读第 4 页；「主要结论」一次要读 6 页被参数校验挡回
  （最多 5 页），又分两次读了第 1–10 页；「第 5 页」代码已经给了那一页，它又读了一遍译文。Python 版在「这句译得对吗」读了 2 次。
  提示词一样，差别多半来自 pi 把系统提示词、工具说明的拼法和历史的组织方式不同（pi 的系统提示词多了 `<addendum>`、`<cwd>`、`<book>` 的标签）。
  要压的话和 Python 版一样改提示词，不加代码规则。
- **回答质量**：两边都答在点上。(a) 都照材料答、引用页码；(b)「书里别处怎么用」都找到定义（第 4 页）和别处的用法，「前面哪里定义过」都定位到第 4 页的定义；
  (c)「哪里讲到」都找到附录（第 37–41 页）和其中的定理（第 40 页），「主要结论」都给出定理 1.1 的界和推论。
- **Python 版碰上 Anthropic 读超时**：Haiku 第一遍有 3 题回 `ReadTimeout … read timeout=15`（JSON-RPC 错误），重跑后得到上表；pi 版这一轮没碰上
  （pi 的超时、重试是它自己的：`httpIdleTimeoutMs` 默认 5 分钟、`retry` 默认 3 次）。Python 版 15 秒的读超时偏短，另记一笔。
- **pi 的重试提示混进正文**：Qwen pi「书里别处怎么用」的回答开头是「Retrying (attempt 1/3, waiting 2s)...」——pi-acp 把 pi 的自动重试通知当
  `agent_message_chunk` 发了。要么等 pi-acp 改，要么换自己的入口时把它发成别的更新。
- 花费：pi-acp 不发用量明细（没有 `_meta.retainpdf.usage`），这一轮没算 pi 版的钱；按 token 量看和 Python 版同一量级（同一份材料、同样的工具结果）。
- 起会话：pi-acp 每个 `session/new` 起一个 pi 进程（Node + jiti 加载扩展），之前握手实测 `initialize` 2.2 秒、`session/new` 1.6 秒；
  Python 版是几十毫秒。前端是打开问答窗时就连，用户打字时已经起好了。

## 以后

1. 看用户用下来怎么样，再定要不要当默认。Python 版服务器上也能用、不要 Node，现在照旧是默认。
2. 想多控制一些（工具卡片的标题、`_meta.retainpdf.usage`、关掉 pi-acp 的斜杠命令、自己管会话），把 pi-acp 换成自己的 Node 入口：
   pi 的 SDK（`createAgentSession`）加 `@agentclientprotocol/sdk`，扩展原样用。
3. 桌面版带 pi：并行分支「后端托管安装本机 agent」做（npm 私有 prefix，默认装 pi + pi-acp）。那边合进来后这里不用改——找 pi-acp、pi 走的是同一个解析函数；
   但安装包要带上 `backend/pi-agent/` 和 `backend/ask-agent/…/prompts/`（`AcpConfig.backend_root` 现在是 `<项目根>/backend`，桌面版的目录不一样时要给它指路）。
4. 会话（`<数据目录>/ask-pi/sessions`）现在只增不删，前端用上 `session/load` 之前先加个保留期限。

## 待定

- 前端要跟着改（交接里写了）：现在只给 `id === "retainpdf"` 带模型配置，`retainpdf-pi` 点了会 400，要改成按 `kind === "builtin"` 判断。
- Windows：包装脚本是 sh，先列成不能用。要支持得另写 `.cmd` 或换成 Node 入口。
- 用户想自己改 agent 时，是直接改 `backend/pi-agent/extension/`，还是另给一个「用户扩展目录」（`-e` 多加一个用户目录、或开 `--skill`）——先没开，开了就绕过了上面的锁。

## 第二期：记忆和前文（2026-11-26，feat/pi-ask-memory）

和自带 agent 同一套（[主对话和记忆](20261126-主对话副对话和记忆.md)），新文件 `extension/memory.ts`：

- 桥（`acp/mod.rs` 的 `ask_backend_env`，Python 版和 pi 共用）给 pi 后端地址和密钥（没带书也给）、`RETAIN_ASK_CONVERSATION_ID`。
- 工具 `remember`、`search_memories`：说明、参数、额度、总开关和 Python 版一字一样（测试起 Python 对比）；包装脚本 `--tools` 白名单、
  桥写的 `defaultTools` 加上这两个，有后端时接 `ask_memory.txt`；`agent_id` 记成 `retainpdf-pi`。
- 前文：开会话取 `context`，`memory_text` 放进系统提示词一节 `memory`（目录那节后面）；摘要和最近几轮写成文字放在**第一问前面**——pi 的
  会话历史扩展塞不进去。续接 pi 旧会话（会话文件里已有消息）不再放。
- 和 Python 版不一样的：pi-acp 不转发 `_meta`，出处只能从前端写在问题里的那段认（`selection` 到不了）；「已记住」卡片没有
  `_meta.retainpdf.memory`，前端按 `source_conversation_id` + `created_after` 取这一问新记的。

