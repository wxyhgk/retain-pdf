# 后端改动交接（给前端）

> 注：本文是带日期的交接记录，里面写的旧地址已于 2026-10-18 全部删除（返回 404），新旧对照见 [任务接口分类](../../api/01-任务/04-任务接口分类.md) 和 [下载总览](../../api/07-产物下载/01-下载总览.md)。
>
> 讲 Studio（`studio-bridge`、`embed=studio`、摘到笔记、读到哪……）的几节是历史：2026-11-06 Studio 不再嵌 RetainPDF，前端的嵌入代码删了，
> 见 [不再管 Studio](../../ops/planning/studio-workbench/20261106-不再管Studio.md)。

本文只记**需要前端配合才能落地**的后端改动：新端点、新字段、新错误码，以及
前端具体要改哪个文件。纯后端的加固（事务边界、超时收尾之类）不在这里。

按后端提交倒序排列，最新在上。

---

## 阅读页提问：主对话按书分（feat/ask-main-per-book）

2026-11-27，只增不改（前端已接：`feat/ask-main-per-book-web`，取主对话带这本书的 `document_id`、换书清掉窗口），见 [主对话和记忆](../../api/16-AI/02-主对话和记忆.md) 的「主对话按书分」，决定 [主对话按书分](../../ops/planning/reader-ask/20261127-主对话按书分.md)。
用户反馈「主对话串了，好几个 pdf 打开都是同一个聊天框」，定为每本书一个主对话、用户层记忆照旧共用。契约 `ask-conversations.v1`：
`getMainAskConversation` 多了可选的请求体 `EnsureAskMainConversationInput {document_id?}`，`ListAskConversationsQuery` 多 `document_id`。

| 文件 | 现在 | 要改成 |
|---|---|---|
| 打开提问窗取主对话（`POST /api/v1/ai/ask-conversations/main`） | 不带请求体，所有书同一条 | 在书里带 `{"document_id": "<这本书>"}`，取或建这本书开着的主对话；没在书里（或不想分书）照旧不带，是全局那条。**老后端不认 `document_id`（请求体不认识的字段 400），前后端一起合** |
| 归档、「归档并开新的主对话」 | 归档全局那条 | 归档的是这本书的主对话，再取就是这本书新的一条；别的书不受影响。`409 ask_main_conversation_open` 现在按书算 |
| 历史 / 归档列表（`GET /api/v1/ai/ask-conversations`） | `kind`、`status`、`parent_id` 筛 | 要只看这本书的加 `document_id=<书>`（主对话是这本书的、副对话是开在这本书的）；返回的主对话 `document_id` 是它属于哪本书（`null` 是全局那条） |
| 升级后的旧数据 | — | 以前那条全局主对话按书拆开了：每本书里问过的在那本书的主对话里，没有书的留在全局那条（不用前端做什么） |

## 阅读页提问：消息记 agent 会话、删对话清 pi 会话文件（fix/ask-conversation-pi-sessions）

2026-11-27，只增不改。前端真机测出来的：删了对话，`retainpdf-pi` 的会话文件还在。

| 文件 | 现在 | 要改成 |
|---|---|---|
| 追加一轮（`POST /api/v1/ai/ask-conversations/{id}/messages`） | 不带会话 | 问和答都带 `session_id`：这一轮用的 ACP 会话的 `sessionId`（`session/new` 回的那个）。删对话时后端据此删 pi 的会话文件；不带就删不了。所有 agent 都带也没关系，没有会话文件的什么都不做 |

## 阅读页提问：改一条已发出的问（feat/ask-edit-message）

2026-11-26，只增不改，见 [主对话和记忆](../../api/16-AI/02-主对话和记忆.md) 的「改一条已发出的问」。用户定：后面的作废，从这里重问。
契约 `ask-conversations.v1` 加了字段和一个端点（没写 `client_name`）。

| 文件 | 现在 | 要改成 |
|---|---|---|
| 主对话里的问（编辑按钮） | 没有 | 点「编辑」改完提交：先 `POST /api/v1/ai/ask-conversations/{id}/messages/{message_id}/supersede`，再开新会话（自带 agent 取的上下文已经不带作废的）用改后的问去问，答完照常追加一轮，问那条带 `edited_from: <被改的那条>` |
| 消息列表 | 每条都画 | 消息多了 `superseded_at`、`edited_from`：`superseded_at` 不是 null 的折叠成「已改写，点开看原来的」；`edited_from` 有值的问可以标「已编辑」。分页的 `compactions` 只剩生效的压缩点 |
| 书上的「?」 | 照旧 | 不用改：作废的问后端已经不回 |

## RetainPDF + pi 也有记忆和前文（feat/pi-ask-memory）

2026-11-26，只增不改，见 [主对话和记忆](../../api/16-AI/02-主对话和记忆.md) 的「RetainPDF + pi 怎么用」。契约没改。

| 文件 | 现在 | 要改成 |
|---|---|---|
| 阅读页提问的握手（连 `retainpdf-pi`） | 只给 `retainpdf` 带 `conversation_id` | `retainpdf-pi` 也带 `conversation_id`；带了以后它自己取前文（摘要 + 最近几轮 + 记忆），前端不要再把前几轮拼成文字带过去。pi-acp 的 `initialize` 没有 `_meta.retainpdf`，按 agent 编号认 |
| 每一问 | `retainpdf` 用 `_meta.retainpdf.selection` | `retainpdf-pi` 收不到 `_meta`：照旧在问题前面写那段可读出处（「（RetainPDF 任务 …，第 N 页）」） |
| 「已记住（撤销）」 | 看 `tool_call_update` 的 `_meta.retainpdf.memory` | `retainpdf-pi` 的卡片没有这个：一问答完后 `GET /api/v1/ai/memories?source_conversation_id=<对话>&created_after=<这一问开始的时间>`，有就画「已记住：……（撤销）」，编号放进追加回答的 `memory_ids`。工具名一样（`remember`、`search_memories`） |

## 阅读页提问第二期：压缩主对话、后端写副对话结论（feat/ask-compaction）

2026-11-26，只增不改，见 [主对话和记忆](../../api/16-AI/02-主对话和记忆.md) 的「压缩」。契约 `ask-conversations.v1` 只加字段和两个端点（没写 `client_name`）。
用户定的：库是正本，压缩和副对话结论都由**后端**用设置里那条模型生成，和当前用的是哪个 agent 无关。

| 文件 | 现在 | 要改成 |
|---|---|---|
| `frontend/web/src/features/reader/domain/ask-port.ts`（追加一轮） | 只看 `messages` | 返回多了 `compaction_due`：为 `true` 且设置里有模型时，随手 `POST /api/v1/ai/ask-conversations/{id}/compactions`，body `{connection: {model, base_url, api_protocol, thinking, credential_ref}}`（和自带 agent 握手同一套）。不用等它，失败（`409 ask_compaction_nothing` / `ask_compaction_stale`、`502 ask_summarize_failed`）下次再试 |
| 消息列表 | 只有消息 | 分页返回多了 `compactions: [{compaction_id, covers_to_seq, created_at}]`（所有压缩点）：在 `seq == covers_to_seq` 那条后面画「之前的已压缩，点开看原文」；点开看摘要正文用 `GET …/compactions`，原文照旧在消息分页里 |
| 副对话「结束」 | 前端给 `summary` | 可以改成只给 `summarize_with`（同上的 `connection`），后端总结成卡片再回填；给了 `summary` 照旧用它。后端要等模型（最多 180 秒），按钮要有进行中的样子；`502 ask_summarize_failed` 时副对话没结束，可以重试或让用户自己写 |
| 本机 agent 的上下文 | `context.text` | 不用改：压过以后 `text` 里多一段「【之前对话的摘要】」，`summary`、`summary_covers_to_seq` 也在结构化字段里 |

## 阅读页提问：全局主对话、副对话、记忆（feat/ask-main-conversation）

2026-11-26，只增不改，见 [主对话和记忆](../../api/16-AI/02-主对话和记忆.md)，方案 [主对话、副对话和记忆](../../ops/planning/reader-ask/20261126-主对话副对话和记忆.md)。
契约新增 `ask-conversations.v1`（`@retainpdf/contracts/ask-conversations`，端点还没写 `client_name`：前端接的时候连同生成客户端一起加）。
旧的按书问答记录 `/documents/{id}/ask-threads` 原样留着、**只读保留**（不迁），新的问答不再往里写。

用户定的（2026-11-26）：对话以后端库为正本，agent 只负责回答；一个全局主对话（不按书切），每条消息记自己属于哪本书；副对话结束时结论回到主对话；
记忆分用户层（每次都带）和书层（按书取），agent 记的时候回答里显示「已记住（撤销）」；阅读页选中时**不弹任何东西**，主窗口只在发问时读当前选区。

| 文件 | 现在 | 要改成 |
|---|---|---|
| `frontend/web/src/features/reader/domain/ask-port.ts` | 问答记录按书：`listAskThreads(documentId)`、建线程、每答完一轮 `PATCH` 整份 | 打开问答窗 `POST /ai/ask-conversations/main` 拿主对话，`GET …/{id}/messages?limit=` 读历史（往上滚用第一条的 `seq` 当 `before_seq`）；每答完一轮 `POST …/{id}/messages`，问和答一起，问带 `selection`（下一行）、`document_id`、`agent_id`、`client_message_id`（重试安全），答带 `thought`、`usage`、这一轮「已记住」的 `memory_ids` |
| `frontend/packages/reader/src/ask/ask-context.ts`（`anchorPreamble`）、`contract.ts` 的 `AskContext` | 出处是一段字，新会话第一问前面带一次 | 照旧带那段字（本机 agent 只认字）；另在 `session/prompt` 的 `_meta.retainpdf.selection` 放结构化出处 `{document_id, job_id, translation_version, pane, page, item_ids, selected_text, section?, source_text?, translated_text?, prefix?, suffix?}`（只有 `page` 必填；选区换成块编号由前端做）。自带 agent 的 `initialize` 报了 `agentCapabilities._meta.retainpdf.selection` 时可以不带那段字 |
| `frontend/packages/ask/src/acp/adapter.ts`（新开会话时把前几轮拼成「我：…你：…」） | 每次新会话都拼文字 | 自带 agent：握手多带 `conversation_id`（主对话或副对话的编号）；它报了 `agentCapabilities._meta.retainpdf.conversation` 就**不再拼**（它自己从后端取记忆和最近几轮）。本机 agent：`GET /ai/ask-conversations/{id}/context?document_id=<书>`，把返回的 `text`（记忆 + 最近几轮）放进新会话第一问前面 |
| 问答窗的工具卡片 | 照 ACP 画 | `tool_call_update` 的 `_meta.retainpdf.memory` 有值（`{id, scope, text, category, document_id, created, replaced}`）就画成「已记住：……（撤销）」小条，撤销调 `DELETE /ai/memories/{id}`（被它替代的旧记忆会恢复）；`created: false` 是已经记过的，不画撤销 |
| 副对话（新） | — | 回答上点「深挖」→ `POST /ai/ask-conversations` `{parent_id, forked_from_message_id, title, document_id}`，标题栏面包屑「主对话 › 标题」；结束 → `POST …/{id}/close` `{summary}`（第一期摘要前端给，比如让当前 agent 总结一句；第二期后端生成），回到主对话，返回的 `card`（`role: side_summary`）画成摘要卡片、能展开看副对话（`GET …/{side_id}/messages`） |
| 书页上的「?」 | `listAskThreads` | 另取 `GET /documents/{id}/ask-messages`（所有对话里属于这本书、有页码的问）；旧的 `ask-threads` 照旧能画、能点开看 |
| 记忆面板（新） | — | `GET /ai/memories?scope=&document_id=&q=&status=`、`PATCH /ai/memories/{id}`、`DELETE …`；用户自己加 `POST /ai/memories`（`origin` 不给就是 `user`） |
| 设置里「让 AI 使用记忆」（新，用户 11-26 定） | — | 开关读 `GET /ai/ask-settings` 的 `memory_enabled`（默认开），改 `PATCH /ai/ask-settings` `{memory_enabled}`。存在后端库里，**不要**放进浏览器设置。关掉以后后端和自带 agent 自己就不读不记；前端只需在记忆面板上说明「AI 现在用不到这些记忆」，已经记下的照常能看、改、删 |
| 主对话的「删除」（用户 11-26 定） | — | 界面上只给「归档并开新的主对话」（`PATCH …/{id}` `{status: "archived"}` 再 `POST …/main`）；只有归档过的主对话才给「删除」。删开着的主对话后端回 `409 ask_main_conversation_open`。副对话随时能删 |

- 本机 agent 记的「已记住」第三期才有（经 `retainpdf mcp`）；到时前端每答完一轮按 `GET /ai/memories?source_conversation_id=…&created_after=…` 补画。
- 新的错误：`409 ask_conversation_not_open`（往结束了的副对话追加）、`409 ask_main_conversation_open`（重开旧主对话时已有开着的；删开着的主对话）、
  `409 ask_memory_limit`、`409 ask_memory_deleted`、`409 ask_memory_disabled`（「让 AI 使用记忆」关着时 agent 记记忆）、`409 ask_conversation_limit`。多用户模式下这批接口 `404`（全局数据没有归属）。
- 压缩（主对话太长时的摘要、压缩点）第二期做，到时上下文接口的 `summary` 有值、消息分页带压缩点。

## 删问答、删书时清 pi 会话：问答记录要带上 `session_id`（fix/derived-follow-edits）

2026-11-26，只增不改，见 [阅读页提问](../../api/16-AI/01-阅读页提问.md) 问答记录一节的「删除」。删一次提问、删书时，后端按问答记录的
`session_id` 删 `retainpdf-pi` 存在 `<数据目录>/ask-pi/sessions/` 下的会话文件（整段对话的第二份）。**现在前端建、改问答记录都不带
`session_id`，库里全是空的，这条清理一个也对不上**——会话文件照旧只增不删。接口、契约没变（`session_id` 一直是可选字段）。

| 文件 | 现在 | 要改成 |
|---|---|---|
| `frontend/web/src/features/reader/domain/ask-port.ts` 的 `askThreadsPort.create` / `update` | `{agent_id, anchor, messages}` / `{agent_id?, messages}` | 加 `session_id`：ACP `session/new` 回的 `sessionId`（同一次提问换了会话就带新的） |
| `frontend/packages/reader/src/ask/use-ask-threads.ts` 调 `threads.create` / `threads.update` 的两处 | 只传 `agentId`、`anchor`、`messages` | 把当前会话的 `sessionId` 一起传给端口（端口的输入类型加一个可选的 `sessionId`） |

其它 agent（`retainpdf`、本机 Claude Code、Codex）带上也没关系：后端只在 pi 的会话目录里按会话头认，对不上就不动。

---

## 阅读页提问：自带 agent 报思考档位，会话里能改（feat/ask-thought-level）

2026-11-26，只增不改，见 [阅读页提问](../../api/16-AI/01-阅读页提问.md) 的「思考强度：`configOptions` 和 `session/set_config_option`」
和「RetainPDF + pi」的「思考强度」。握手参数、契约 `ai-agents.v1` 都没变（ACP 消息不在契约里）。

- `retainpdf`、`retainpdf-pi` 的 `session/new` 结果都带 `configOptions`，只有一项 `{id: "thought_level", category: "thought_level", type: "select", currentValue, options: [{value, name}]}`，
  `options` 是这个模型实际有的档位、从弱到强（按位置上色正好）。**没有 `category: "model"` 那一项**，模型照旧是前端合成的设置里存的连接，换模型带新握手参数重开会话。
- `currentValue` 是握手的 `thinking` 换成的档位（换算写在接口文档里，和实际发的请求一致）。
- `session/set_config_option(configId: "thought_level", value)` 只改下一问，回整份 `configOptions`；`value` 不在 `options` 里回 `-32602`。
- 认不出的模型（不是 Claude、GPT，也不是 DashScope、DeepSeek、智谱的地址）：2026-11-27 起，地址不是 `api.openai.com` 的（OpenAI Chat 和 Responses 都算）报通用的 `off` / `on`（Chat 上名字带 qwen3 的走 Qwen3 的开关），前端照开关画，不用改；`api.openai.com` 上认不出的（`gpt-4o`）仍然不报 `configOptions`，前端不显示这一栏。

**前端不用改**：`frontend/packages/ask/src/acp/adapter.ts` 现在的写法（收 `configOptions`、开会话后用 `set_config_option` 设回上次选的、
不在 `options` 里的跳过、收 `config_option_update`）正好对上。要留意的几处：

| 文件 | 现在 | 要注意 |
|---|---|---|
| `frontend/packages/ask/src/acp/config.ts`（读 `configOptions`） | 认 `value` / `name` / `description` | `retainpdf-pi` 的选项带 `description: null`（pi-acp 给的，桥不删）；`retainpdf` 的不带 `description` |
| 同上 / 记住上次选的档位的地方 | 按 `id` 记一个值 | 两个 agent、不同模型的档位名不一样：Qwen、DeepSeek 在 `retainpdf` 里是 `off` / `on`，在 `retainpdf-pi` 里是 `off` / `high`；GPT-5 是 `minimal`…`high`，GPT-5.1 起是 `none`…`xhigh`。换了模型、值不在新 `options` 里就跳过（现在就是这样） |
| 同上 | 收 `config_option_update` | `retainpdf` 不发这条（档位只在前端改时变，结果里已经是整份）；`retainpdf-pi` 每次改都会发一条（已去掉模型那项），另有旧写法 `current_mode_update`，不用管 |

---

## 重试时断点作废有一条事件（fix/regroup-followups）

2026-11-26，只增不改，见 [翻译事件](../../api/04-翻译/07-翻译事件.md) 的「断点不能接着用、已译的页作废」。**前端不改也能用**：
它是一条普通的进度事件，`message` 会照常显示。想醒目提示「这次是从头翻的」，读 `payload.observation.resume_checkpoint_discarded`
（`source_attempt_id`、`reason`），不要按 `message` 关键词判断。

---

## 阅读页提问：回答里的互动块，后端给三类 agent 加 L0 和两个工具（feat/ask-openui）

2026-11-26，只增不改，见 [阅读页提问](../../api/16-AI/01-阅读页提问.md) 的「回答里的互动块」，方案
[互动块后端实现](../../ops/planning/reader-ask/20261126-互动块后端实现.md)。接口、握手参数、契约都没变；`contracts/openui/` 的两个文件照旧由前端生成、后端只读。
**前端不改也能用**：自带的两个 agent 和本机 agent（经 `retainpdf mcp`）的系统提示词都带了 L0，回答里会出现 ```` ```openui-lang ```` 代码块，前端已经会画。

### 桌面版（`frontend/desktop`）要做的

不做时：桌面版里 `contracts/openui/` 找不到，互动块整个不开（没有 L0、没有工具，回答照旧）；找得到说明文件但没有检查器或 Node 时，
`openui_spec` 能用，`openui_check` 回「检查器用不了」，模型照说明写、不检查。

| 文件 | 旧写法 | 新写法 |
|---|---|---|
| `frontend/desktop/scripts/prepare-app.mjs`（拷 rpr 引擎那一段旁边） | 不带 | 把仓库的 `contracts/openui/ask-openui-prompt.v1.json`、`ask-openui-library.v1.json` 拷到 `path.join(outputBackendRoot, "contracts", "openui")` |
| 同上 | 不带 | 带检查器：在 `backend/openui-check` 里 `npm ci --omit=dev --ignore-scripts`（环境变量加 `OPENUI_TELEMETRY_DISABLED=1`、`DO_NOT_TRACK=1`；**`--ignore-scripts` 不能省**，lang-core 的 postinstall 是安装统计），把 `bin/`、`lib/`、`node_modules/`、`package.json` 拷到 `path.join(outputBackendRoot, "openui-check")`，再删掉 `node_modules/.bin`（和 rpr 引擎一样，免得签名遍历撞断链）。依赖都是纯 JS（lang-core 1.2.0、ci-info、zod），和平台无关 |
| `frontend/desktop/src/main/backend-env.js` 的 `buildBackendEnv` | 没有 | 加 `RUST_API_OPENUI_DIR: path.join(backendRoot, "contracts", "openui")`、`RUST_API_OPENUI_CHECK_DIR: path.join(backendRoot, "openui-check")`（桌面版的项目根就是 `backendRoot`，后端的默认位置 `<项目根>/backend/openui-check` 对不上，要显式给） |
| 同上 | （`RUST_API_NODE_DIR` 见上一节「代装本机 agent」） | 检查器用同一个 Node：先找 `RUST_API_NODE_DIR`，再找 PATH。Node ≥ 20 就行。用 Electron 当 node 的那种小脚本（`ELECTRON_RUN_AS_NODE=1 exec <Electron> "$@"`）也能跑 |

- Node（2026-11-26 补，fix/openui-node-fallback）：桌面版不用为检查器另带 Node。后端找 node 的顺序是 `RUST_API_NODE_DIR` → `RETAINPDF_NODE_BIN`（桌面版已经指向 Electron 本体，排版引擎、Word 导出同一个变量）→ PATH；三处起检查器时都带 `ELECTRON_RUN_AS_NODE=1`。

### 前端页面要做的（可选）

| 文件 | 旧写法 | 新写法 |
|---|---|---|
| 提问窗的工具卡片（`frontend/packages/ask`） | 只有读书的工具 | 多两种卡片：`retainpdf` 的 `title` 是「取互动块说明：core、components:inputs」（`kind: "read"`）和「检查互动块」（`kind: "other"`），摘要是「core、components:inputs（约 1874 token）」「没问题」「2 处问题：unknown-component、type-mismatch」；`retainpdf-pi` 的 `title` 是工具名 `openui_spec` / `openui_check`；本机 agent 由它自己定（Claude Code 一般是 `mcp__retainpdf__openui_check`）。可以折叠成一行或不显示 |
| 用量那一行（可选） | — | `_meta.retainpdf.usage.openui`：`spec_calls`、`sections`、`check_calls`、`check_problems`、`refused`（这一问调过互动块的工具才有） |
| 「让它修」 | — | 照旧把解析错误作为下一问发回去就行；自带 agent 每一问取说明、检查的额度重算（取 2 次、查 3 次），下一问模型会重新取说明再改 |

## 扫描件的行间公式编号：CPU 小模型截图识别（feat/formula-number-ocr-crop）

2026-11-26，只增不改，方案 [扫描件公式编号小模型](../../ops/planning/ocr-normalization/20261126-扫描件公式编号小模型.md)。
document.v1 的 `content.formula_number.source` 多一个取值 `ocr_crop`，可选多两个字段 `repaired`、`repaired_from`（见
`backend/pipeline/retainpdf_pipeline/ocr/document_schema/README.md`「行间公式编号」）。**网页前端不用改**（还没读这个字段）。

新依赖 `rapidocr==3.10.0`、`onnxruntime==1.32.0` 是 `retainpdf-pipeline[scan-ocr]` 这个 extra：后端工作区（开发环境、CI、Docker）装上了；
桌面的依赖清单由 `sync_backend_python_requirements.py` 只按必装依赖生成，**这次没变**。桌面不装也能跑：这一步跳过，
`derived.formula_numbers.ocr_crop.skipped = "ocr_engine_unavailable"`，归一化、翻译照常（`ops/release/desktop_python_check.py` 已把 `rapidocr`
登记成可选 import）。桌面要用这个功能时：

| 文件 | 旧写法 | 新写法 |
|---|---|---|
| `.github/scripts/sync_backend_python_requirements.py` 的三个 `frontend/desktop/requirements-desktop-*.txt` 目标 | `_render_requirements(pipeline_runtime, …)` | 和 Docker 一样用 `docker_runtime`（必装 + `scan-ocr` extra），再跑一遍脚本生成 |
| 生成出来的 `frontend/desktop/requirements-desktop-{posix,windows,macos}.txt` | 到 `urllib3==2.5.0` 为止 | 多两行 `onnxruntime==1.32.0`、`rapidocr==3.10.0`（pip 再带上 numpy、opencv-python-headless、shapely、pyclipper、omegaconf、PyYAML、tqdm、colorlog、six、protobuf、flatbuffers） |

体积（新增的这些包）：

| 平台 | 轮子（下载） | 装好以后 |
|---|---|---|
| macOS arm64 | 约 100 MB（onnxruntime 22.5、opencv 25.8、rapidocr 27.3、numpy 5.5–15） | 本机实测约 215 MB（onnxruntime 80、cv2 67、rapidocr 32 含 31 MB 模型、numpy 24、shapely 5） |
| Linux x86_64 | 约 138 MB（opencv 63.7、onnxruntime 27.8、rapidocr 27.3、numpy 16.9） | 实测约 350 MB（解开 manylinux_2_28 轮子） |
| Windows x64 | 约 106 MB（opencv 47.8、rapidocr 27.3、onnxruntime 16.7、numpy 12.6） | 没量，估 250 MB 上下 |

要注意的：

- onnxruntime 1.32.0 **没有 macOS x86_64（Intel）轮子**；opencv-python-headless 5.1.0.95 的 macOS 轮子要 **macOS 15** 起。
  桌面要支持 Intel Mac 或更老的 macOS，得给桌面另钉 opencv 4.x（rapidocr 要 ≥ 4.5.1.48）、Intel 上不装 onnxruntime（这一步跳过）。
- Linux 安装包只装 manylinux 轮子（`--only-binary=:all:`）：上面几个都有 manylinux_2_28 的轮子，glibc 基线检查（2.28）应该过，没实测。
- 模型用 rapidocr 包里自带的（PP-OCRv6 small 检测 + 识别，约 31 MB），不联网下载，不用另外打包。

---

## 阅读页提问：后端代装本机 agent，桌面版默认装上 pi 和 Claude Code（feat/acp-agent-install）

2026-11-26，只增不改，见 [阅读页提问](../../api/16-AI/01-阅读页提问.md) 的「代装本机 agent」，方案
[本机 agent 默认安装](../../ops/planning/reader-ask/20261126-本机agent默认安装.md)。**不改前端也能用**：列表形状不变，
只多一个 `install_status`；推荐名单里 Google Antigravity（`antigravity-acp`）换下 Gemini CLI（`gemini` 照旧列出，`featured` 没了）。
新接口 `POST /api/v1/ai/agents/:agent_id/install` 登记的是 `by(none)`，前端、桌面接上以后改成 `by(web)` / `by(desktop)`。

### 桌面版（`frontend/desktop`）要做的

| 文件 | 旧写法 | 新写法 |
|---|---|---|
| `frontend/desktop/src/main/backend-env.js` 的 `buildBackendEnv` | 没有 | 加 `RUST_API_ACP_DEFAULT_INSTALL: "1"`：后端启动后在后台把 pi（连 pi-acp）和 Claude Code 的适配器装进 `<数据目录>/acp-agents/`（用户自己已经装在 PATH 上的不装），不挡启动 |
| 同上 | 没有 | 加 `RUST_API_NODE_DIR: <自带 Node 的目录>`：放 `node`、`npm` 的那一层（macOS / Linux 是 Node 发行包的 `bin/`，Windows 是放 `node.exe`、`npm.cmd` 的根；给发行包的根后端也认）。没设时后端用 PATH 上的 npm；PATH 上也没有，pi-acp 就不能代装（`install_status.reason` 说找不到 npm），Claude Code 的适配器在 macOS / Linux 改走压缩包 |
| 打包脚本（`frontend/desktop/scripts/prepare-app.mjs` 一带） | 不带 Node（Word 导出、rpr 用 Electron 当 node） | 带一份官方 Node，**≥ 22.19**（pi 1.6.1 要），按平台放进资源目录。想省体积也可以用 Electron 当 node：目录里放一个叫 `node` 的小脚本（`ELECTRON_RUN_AS_NODE=1 exec <Electron> "$@"`）加一份 npm 包的 `npm`；Windows 上 npm 的 `.cmd` 外壳找 node 的方式不同，不建议 |

- 后端起 npm 和起托管的 npm 包时会把这个目录放在子进程 PATH 最前面（npm 包的入口是 `#!/usr/bin/env node`），桌面壳不用另外改 PATH。
- 第一次装 pi + pi-acp 约 170 MB（本机 75 秒），Claude Code 的适配器更大；npm 缓存用用户的 `~/.npm`。
- macOS 上后端用 reqwest 下的压缩包不带隔离属性（quarantine），解开就能起。

### 前端页面要做的（建议）

| 文件 | 旧写法 | 新写法 |
|---|---|---|
| `frontend/web/src/features/reader/domain/ask-port.ts` 的 `AgentRow` | 没有 `install_status` | 另有可选的 `install_status: {state, managed, installable, method?, installed_version?, error?, reason?}`；`state` 是 `missing` / `installing` / `installed` / `failed` |
| 同上，没装的 agent | 显示 `install`（终端命令）或 `install_url` | `install_status.installable` 为 true 时给一个「安装」按钮：`POST /api/v1/ai/agents/{id}/install`（没有请求体，回 202 / 200，`data` 是这个 agent 的新样子），之后每 2 秒左右 `GET /ai/agents` 直到 `state` 不是 `installing`；`failed` 显示 `error`，可以再点；`installable` 为 false 时照旧显示 `install` / `install_url`，`reason` 可以做成提示 |
| `frontend/packages/api`（生成客户端） | 只有 `listAiAgents` | 契约里新接口没写 `client_name`，前端按自己的命名加（比如 `installAiAgent`），再 `npm --prefix frontend/packages/api run generate:client` |
| `frontend/web/src/platform/mock/ask-agent.ts`（可选） | 没有安装状态 | 演示模式可以给一个 agent 带 `installable: true` 试按钮 |

- 安装接口的闸门和起本机 agent 一样：只有本机地址打开的页面能装（局域网共享、经过代理 403），多用户、服务器上一律 403。
  不认识的 404、自带的 400、后端不能代装 409（`error.details.reason = "agent_not_installable"`，`message` 是原因）。
- 状态只在后端内存里：后端重启后正在装的会停（下次再装会清掉半成品），失败原因没了。

## 阅读页提问：第二个自带 agent「RetainPDF + pi」（feat/pi-agent）

2026-11-26，只增不改，见 [阅读页提问](../../api/16-AI/01-阅读页提问.md) 的「RetainPDF + pi」，方案
[RetainPDF 加 pi](../../ops/planning/reader-ask/20261126-RetainPDF加pi.md)。`GET /api/v1/ai/agents` 的第二行多了
`{"id": "retainpdf-pi", "name": "RetainPDF + pi", "kind": "builtin", …}`：用设置里的模型，agent 是本机装的 pi（加我们的读书扩展）。
只在本机 agent 的闸门里能用（单机、本机打开），没装 pi-acp / pi 时 `available: false`，`reason`、`install` 和本机 agent 一样。

**不改前端时**：列表里会显示这一行，但前端现在只给 `id === "retainpdf"` 带模型配置，点了它握手缺 `model` / `credential_ref`，回 `400`。

前端要改的：

| 文件 | 旧写法 | 新写法 |
|---|---|---|
| `frontend/web/src/features/reader/domain/ask-port.ts` 的 `toReaderAgents` | `const builtin = id === BUILTIN_AGENT_ID` | `const builtin = row.kind === "builtin"`（两个自带的都「用设置里的翻译模型」、都要设置里配了模型；`acceptsImages` 也是两个都 `true`） |
| 同上，`openSession` | `agentId === BUILTIN_AGENT_ID` 时才带 `builtinModelQuery()`、`credential_ref`（`ensureAskCredential`）、`job_id` | 按列表里这一行的 `kind === "builtin"` 判断（`openSession` 拿不到行的话，可以先认 `agentId === "retainpdf" \|\| agentId === "retainpdf-pi"`），三样都带上 |
| 同上，`description` | 自带的写「用设置里的翻译模型」 | `retainpdf-pi` 可以用后端给的 `description`（「用设置里的模型，agent 骨架是本机装的 pi……」），或写「用设置里的翻译模型（pi）」 |
| `frontend/web/tests/reader/reader-ask-port.test.mjs`（可选） | 只有 `retainpdf` 一个 builtin | 加一行 `retainpdf-pi`，测它也带模型配置 |

连上以后和 `retainpdf` 的差别（pi-acp 0.0.35 的行为，问答窗照 ACP 画就行）：

- 工具卡片的 `title` 是工具名（`read_pages`、`search_book`、`view_page`），`kind` 是 `other`；`rawInput` 是模型给的参数，可以照 Python 版自己拼「读第 5、6 页」。
- 没有 `_meta.retainpdf.usage`：`usage_update` 只有 `used` / `size`，`session/prompt` 的结果只有 `stopReason`，用量那一行只能显示上下文占了多少。
- 多了 `session_info_update`（会话标题，pi-acp 取问题开头）和 `available_commands_update`（pi-acp 的斜杠命令：`compact`、`export`……），不用显示。
- `initialize` 回 `loadSession: true`（pi 的会话存在后端的 `<数据目录>/ask-pi/sessions`），以后做「重新打开接着问」可以用 `session/load`。
- 模型要是想调别的工具（bash 之类）会看到一张 `kind: "execute"` 的失败卡片（「Tool bash not found」），这是被锁住了，不是出错。

---

## 阅读页提问：本机 agent 改从 ACP 官方登记表来（feat/acp-registry）

2026-11-26，只增不改，见 [阅读页提问](../../api/16-AI/01-阅读页提问.md) 的「能用哪些 agent」，方案
[ACP 官方登记表](../../ops/planning/reader-ask/20261126-ACP官方登记表.md)。**不改前端也能用**：`GET /api/v1/ai/agents` 还是那个形状，
`claude-code`、`codex`、`gemini` 三个 id 不变，只是本机 agent 从 3 个变成 42 个（pi、OpenCode、Qwen Code、Kimi Code、goose、Copilot、Cursor……），
装了的排在前面。

前端要改的（建议）：

| 文件 | 旧写法 | 新写法 |
|---|---|---|
| `frontend/web/src/features/reader/domain/ask-port.ts` 的 `AgentRow` | `{id, name, kind, available, reason, launch, install}` | 另有可选的 `registry_id`、`description`（英文一句）、`version`、`homepage`、`license`、`distribution`（`binary` / `npx` / `uvx`）、`install_url`、`featured` |
| 同上，列 agent | 全列 | 42 个太长：只展开 `available` 的和 `featured` 的（推荐 10 个），其余没装的折进「更多」 |
| 同上，没装的提示 | 显示 `install`（安装命令） | 只有压缩包的 agent（goose、Cursor、OpenCode……）没有 `install`，给 `install_url`（下载地址）；`reason` 里也写了「下载……解压，把 X 放进 PATH」。`homepage` 可以做成「说明」链接 |
| `frontend/web/src/platform/mock/ask-agent.ts`（可选） | 三个 agent | 演示模式可以加一个 pi，用 `registry_id`、`featured` 试折叠 |

- 握手地址不变；登记表 id 也认（`/ai/agents/claude-acp/acp` 等于 `claude-code`），前端继续用列表里的 `id` 就行。
- 实测：Gemini CLI 个人版 `session/new` 回 `-32000`（Google 停了个人版 Code Assist，要换 API key 或迁 Antigravity）；Grok 回
  `Authentication required`（要 ACP 的 `authenticate`）。这两种错误桥原样转，问答窗把 JSON-RPC 错误的 `message` 显示出来就好。
- pi（`pi-acp`）不收桥补的 `retainpdf` MCP 服务，读不了书，只靠出处那段字回答。
- `docs/core/frontend/reader-ask.md` 里「本机 Claude Code / Codex / Gemini」的说法，前端改时顺带更新。

---

## 阅读页提问：自带 agent 自己读书（feat/ask-agent-tools）

2026-11-25，只增不改，见 [阅读页提问](../../api/16-AI/01-阅读页提问.md) 的「自带 agent 读书」，方案
[自带 agent 读书](../../ops/planning/reader-ask/20261125-自带agent读书.md)。不改前端，自带 agent 和以前一样只靠出处那段字回答。

前端要改的（`frontend/web/src/features/reader/domain/ask-port.ts` 连 agent 的那段）：

| | 旧写法 | 新写法 |
|---|---|---|
| 连自带 agent | `WS /api/v1/ai/agents/retainpdf/acp?api_key=…&model=…&base_url=…&api_protocol=…&thinking=…&credential_ref=…` | 再加 `&job_id=<阅读页的任务编号>`（打开阅读页用的那个，合并阅读的 `merged-…` 照传；要 URL 编码）。本机 agent 不用传 |

- 握手新的错误（升级前，HTTP）：`job_id` 字符不对 `400`，没有这个任务 `404`，多用户下不是自己的 `403`。
- 连上以后多了 ACP 的工具卡片：代码先把附近的材料给了模型，问这段字本身一般不调工具；问到书里别处（「书里别处怎么用这个词」
  「第 30 页讲什么」「全书讲什么」）时 agent 会读页、搜书。每个工具一条
  `tool_call`（`title` 如「读第 5、6 页」「在书里找「Hamiltonian」」，`kind` 是 `read` / `search` / `fetch`，`status: in_progress`）
  和一条 `tool_call_update`（`completed` / `failed`，`content` 是一句摘要）。按 ACP 画就行，不用许可（不发 `session/request_permission`）。
- `usage_update` 的 `_meta.retainpdf.usage` 多了 `rounds`、`tool_calls`、`context`（代码自动取了哪些页、几块），
  token 是各轮加起来的；问答记录里照旧原样存。
- 可选（以后）：`session/prompt` 的参数里给 `_meta: {retainpdf: {anchor: {page, item_id, selection, source_text, translated_text}}}`
  （问答记录的锚点写法）。不给时 agent 从 `anchorPreamble`（`frontend/packages/reader/src/ask/ask-context.ts`，2026-11-26 以前是 `acp-adapter.ts` 的 `anchorPromptBlocks`）写的出处里认（最后一行「（RetainPDF 任务 …，块 …，第 … 页）」和
  「我选中的这段：」「这一块的原文：」「这一块的译文：」），所以**改那段出处的写法前先告诉后端**，或者先改成给 `_meta`。

---

## 阅读页提问：问答记录存后端（feat/ask-records）

2026-11-25，新接口，只增不改，见 [阅读页提问](../../api/16-AI/01-阅读页提问.md) 的「问答记录」、契约 `ask-threads.v1`
（`@retainpdf/contracts/ask-threads`，src、dist 已生成）。书页上的「?」可以从后端读了，不再只在内存里：

| 方法 | 地址 | 请求体 | 返回 `data` |
|---|---|---|---|
| `GET` | `/api/v1/documents/{document_id}/ask-threads` | — | `AskThreadListView`：`{threads: AskThreadRecord[]}`，最近改过的在前，不带问答正文 |
| `POST` | `/api/v1/documents/{document_id}/ask-threads` | `CreateAskThreadInput`：`{agent_id, session_id?, anchor, messages?}` | `AskThreadView` |
| `GET` | `/api/v1/documents/{document_id}/ask-threads/{thread_id}` | — | `AskThreadView` |
| `PATCH` | `/api/v1/documents/{document_id}/ask-threads/{thread_id}` | `PatchAskThreadInput`：`{agent_id?, session_id?, messages?}` | `AskThreadView` |
| `DELETE` | `/api/v1/documents/{document_id}/ask-threads/{thread_id}` | — | `{thread_id, deleted: true}` |

- `AskThreadRecord`：`thread_id`（`ask-` 开头）、`document_id`、`agent_id`、`session_id`（可 null）、`title`（后端取第一句问，最长 80 字）、
  `anchor`、`message_count`、`created_at`、`updated_at`。`AskThreadView` 再多 `messages: [{role, text, thought, usage}]`
  （`role` 是 `user` / `assistant`，`thought`、`usage` 没有是 null；`usage` 原样存，直接放 `_meta.retainpdf.usage`）。
- `anchor` 就是 `ReaderAskAnchor` 换成下划线：`{pane, page, item_id, selection, source_text, translated_text, section, point}`
  （`point` 是 `{x, y}` 或 null）。请求里只有 `pane`、`page` 必填，返回里每个键都在。
- 建议的接法（`packages/reader` 的 `ReaderAskMarks`、web 的 `ask-port.ts`，前端定）：打开书 `GET` 列表画「?」；第一轮答完 `POST`
  （带上 `messages`）；以后每答完一轮把整段对话 `PATCH` 一次（`messages` 整份换掉，重发同一份没关系）；点「?」`GET` 一次再打开；删「?」`DELETE`。
- 重新打开时 agent 那边是新会话：把记下的问答带进第一问，拿到新的 `sessionId` 再 `PATCH` `session_id`。自带 agent 的 `session/load` 以后做。
- 错误：书不在、这次提问不在这本书上 404；书上已有 500 次 409 `ask_thread_limit`；字段不对、超长（一条正文 50000 字、一次提问 200 条 / 1 MB）400。
- 契约里**没写 `client_name`**（前端生成客户端有漂移检查）：前端接的时候在两份契约（`contracts/`、`backend/contracts/`）的 5 个端点加
  `client_name`（比如 `listAskThreads`、`createAskThread`、`getAskThread`、`patchAskThread`、`deleteAskThread`），跑 `npm run generate`（contracts）
  和 `npm run generate:client`，同一个提交。

---

## 阅读页提问：agent 列表和 ACP 桥（feat/acp-bridge）

2026-11-25，新接口，见 [阅读页提问](../../api/16-AI/01-阅读页提问.md)、契约 `ai-agents.v1`（`@retainpdf/contracts/ai-agents`）：

- `GET /api/v1/ai/agents`：自带的 + 本机 agent，`available`、`reason`、`launch`；`local_agents.enabled`。契约里**先没写 `client_name`**：
  生成客户端（`frontend/packages/api`）有漂移检查，后端加了名字前端测试就红。前端接的时候在契约里加 `client_name`（比如 `listAiAgents`），
  两份契约（`contracts/`、`backend/contracts/`）一起改，跑 `npm run generate`（contracts）和 `npm run generate:client`，同一个提交。
- WebSocket `GET /api/v1/ai/agents/{agent_id}/acp?api_key=…`：ACP 原样转；自带 agent 再带 `model`、`base_url`、`api_protocol`、
  `thinking`、`credential_ref`。握手前就不行的是 HTTP 错误（400 / 403 / 404），连上后 agent 退出关闭码 1011。
- 自带 agent 本身（Python `retainpdf_ask_agent`）是第 2 步，合进来之前连 `retainpdf` 会马上 1011。
- 桌面局域网共享拦 `/api/v1/ai`（前端 feat/reader-ask 已加）。

---

## 目录 agent：建任务的 `translation.toc`（feat/toc-agent）

2026-11-25，只增不改，**前端不用改**，见 [翻译参数](../../api/04-翻译/01-翻译参数.md) 的「目录翻译（`toc`）」：

- 契约 `create-job.v1` / `library-documents.v1` 的 `TranslationInput`、`job-status.v1` 的 `PublicTranslationInput` 多一个可选字段
  `toc`（`agent` 默认 / `translate`），`@retainpdf/contracts` 的 src、dist 已重新生成，`CREATE_JOB_SECTION_FIELDS.translation` 多了 `toc`。
- 不提交就是 `agent`：目录 agent 和普通翻译同步跑，目录条目和正文同名标题用同一个译名。不用放进界面；以后要给用户关掉的开关，提交 `translate`。
- 任务详情的请求参数回显 `translation.toc`（老任务回显 `agent`）。

---

## 防重复提交：续跑查重、`Idempotency-Key` 请求头（feat/job-idempotency）

2026-11-24，只增不改，见 [防重复提交](../../api/00-约定/06-防重复提交.md) 和
[决定记录](../../ops/planning/api-reorg/20261124-防重复提交.md)：

- **续跑、重试出新任务时查重（前端不改也生效）**：`POST /jobs/{id}/actions/resume`（旧名 `rerun`）、`retry-stage`（出新任务时）、
  `resolve-ocr-ambiguity`，如果这个任务已经续跑 / 重试出一个还在排队或在跑的新任务，回 `409`，
  `error.details.reason = "derived_job_active"`，`error.details.active_job_id` 是那个任务的编号。契约 `job-actions.v1` 的
  `ActionBlockReason` 加了这个值，`@retainpdf/contracts` 的 dist 已重新生成；`frontend/packages/api` 的生成客户端不用变。
  前端的 `reason` 分支对不认识的值本来就按「状态不允许，看 message」处理，不改也不会坏（会显示英文 message）。
- **新请求头 `Idempotency-Key`**（不带时行为完全不变）：`POST /jobs`、`POST /documents/{id}/translate`、`/ocr`、
  `POST /jobs/{id}/actions/resume`（及 `rerun`）、`retry-stage`、`resolve-ocr-ambiguity` 接受。同一把 key、同一个请求第二次来
  不再执行，原样回第一次的 2xx 结果并带响应头 `Idempotent-Replayed: true`；上一个还在处理 `409 idempotency_key_in_flight`；
  同一把 key 换了请求体 `409 idempotency_key_reused`；key 不合法 `400`。记录保留 24 小时。CORS：单机模式请求头照回显、响应头全暴露，
  不用改；桌面端局域网转发（`frontend/desktop/src/main/lan-share.js`）只去掉几个固定的头，这个头照常转发。

前端要做：
1. `frontend/packages/api/src/request.ts` 的 `RequestOptions` 加 `headers?: Record<string, string>`，`request()` 发请求时并进去
   （旧写法：只有 `signal`、`fetchImpl`、`onError`；新写法：多一个 `headers`，生成的客户端函数不用改，它们原样把 `options` 传下去）。
2. 用户每点一次「翻译 / 续跑 / 重试」生成一个 UUID（`crypto.randomUUID()`），放进 `Idempotency-Key`；**同一次点击的网络重试
   （包括超时后自动重发）复用同一个**，下一次点击换新的。要改的入口：
   - `frontend/packages/api/src/jobs-submit.ts` 的 `createJob`（`POST /jobs`）；
   - `frontend/packages/api/src/documents.ts` 的 `translateDocument`、`ocrDocument`；
   - `frontend/packages/api/src/jobs-actions.ts` 的 `resumeJob`、`retryJobStage`、`resolveOcrAmbiguity`。
   旧写法：`actions.resumeJob(apiPrefix, { job_id, body }, { onError: submitFailure() })`；新写法：调用方传进一个 key，
   `{ onError: submitFailure(), headers: { "Idempotency-Key": key } }`。key 在按钮点击处生成（比如 `libraryController.resumeJob` 一类），
   重试逻辑拿同一个 key 重发。
3. 新的 409 原因怎么展示（按 `error.details.reason` 分支，不解析 message）：
   - `derived_job_active`：「这个任务已经在续跑 / 重试中（任务 {active_job_id}），等它结束或先取消它。」给一个跳到那个任务的链接
     （书籍详情里就是切到那个任务、刷新任务列表）。按钮不用变灰，`GET /actions` 的 `disabled_code` 里不会有这个值。
   - `idempotency_key_in_flight`：同一次点击的重发撞上第一次还没处理完，等一两秒用**同一个 key** 再发一次即可，不用提示用户。
   - `idempotency_key_reused`：前端自己的 bug（同一个 key 发了不同的请求），记日志、换新 key；给用户看通用的「提交失败，请重试」。
   - 响应头 `Idempotent-Replayed: true` 只是告诉你这是重放，结果和第一次一样，当成功处理就行。
4. 前端测试：没有钉 `ActionBlockReason` 的测试；如果书籍详情有按 reason 显示文案的表（`job-failure-model.ts` 之类），加上面三个值。

前端已跟上（`feat/idempotent-submit`，2026-11-25），和上面的建议有两处不同：
- key 不从按钮传进来，由 `@retainpdf/api` 的 6 个提交函数（`createJob`、`translateDocument`、`ocrDocument`、`resumeJob`、
  `retryJobStage`、`resolveOcrAmbiguity`）每次调用自己生成（`src/idempotency.ts` 的 `newIdempotencyKey()`）：前端没有自动重发，
  一次调用就是一次点击。`RequestOptions` 加的是 `idempotencyKey?: string`，不是通用的 `headers`。
  `crypto.randomUUID` 只在安全上下文里有（局域网 `http://192.168.x.x` 打开时没有），退回 `getRandomValues` 拼 UUID v4。
- `derived_job_active` 不提示「等它结束」，直接切到那个任务：网页的 `platform/api/domains/jobs-actions.ts` 把续跑 / 重试的这个 409
  换成一张指向 `active_job_id` 的回执（`already_active: true`），书籍详情、任务中心、任务详情都照提交成功的路子切过去、跟进度；
  任务详情的提示写「已经有一个从这里续跑出来的任务在跑（编号），正在跳转」。OCR 歧义处理在 `ocr-ambiguity-recovery.ts` 里同样跟进那个任务。
  `HttpError` 加了 `activeJobId`。没带 `active_job_id` 时退回提示文案（`describeActionError`）。
- `idempotency_key_in_flight` / `idempotency_key_reused` 每次一把新 key 碰不到，`in_flight` 只留了一句兜底文案。
- 测试：`frontend/web/tests/platform/idempotent-submit.test.mjs`。

---

## 请求体写错统一回 400，顶层 `code` 的用法（fix/api-error-format）

2026-11-24，**前端不用改**，见 [请求体错误统一回 400](../../ops/planning/api-reorg/20261124-请求体错误统一回400.md)：

- **请求体类型不对、缺必填字段、枚举值不认识：`422 UNPROCESSABLE_ENTITY`（顶层 `42200`）→ `400 BAD_REQUEST`（顶层 `40000`）**，
  `error.details.reason = "schema_mismatch"`，`message` 没变。所有用 `ApiJson` 收请求体的接口都是（凭据、术语表、改单条译文、
  任务动作、书库、设置……）。以前已经是 400 的两种也多带一个 reason：不是 JSON `invalid_json`、不认识的字段 `unknown_field`。
  见 [认证与错误·请求体写错（400）](../../api/00-约定/02-认证与错误.md#请求体写错400)。
- 核对过 `frontend/`：源码里没有按 `422`、`42200`、`UNPROCESSABLE_ENTITY` 判断的地方。改单条译文**内容**没过检查仍是
  `422 TRANSLATION_REVISION_REJECTED`（`frontend/packages/api/src/translation-debug.ts` 按 `details.reason` 说人话，照旧能用）；
  测试里的 422（`tests/shared/translation-debug-client.test.mjs`、`tests/book-detail/edit-translation.test.mjs`、
  `tests/reader/reader-block-edit.test.mjs`、`tests/shared/document-ocr-client.test.mjs`）都是这个或自己造的假回应，不受影响。
- **顶层 `code` 现有行为不改**：多数是数字，凭据、书的元数据建议、边翻边看、改单条译文、复用 OCR 建任务、账号这几类是字符串
  （清单见 [响应格式·顶层 code 的类型](../../api/00-约定/01-响应格式.md#顶层-code-的类型)）。以后前端做分支判断只看
  `error.code` 和 `error.details.reason`，不要看顶层 `code` 和它的类型；后端以后新加的错误顶层 `code` 一律是数字。

---

## 失败简报带 `failure_code`，地区不支持单独成码（feat/failure-brief-code）

2026-11-24，只增不改，见 [失败简报带失败码](../../ops/planning/error-codes/20261124-失败简报带失败码.md)：

- **任务列表的失败简报（`JobFailureBriefView`，`GET /jobs`、`GET /documents/{id}/jobs` 的 `failure`）加可选 `failure_code`**，
  和任务详情 `failure.failure_code` 同一个值；没有失败码或只有旧数据兜底出的 `unknown` 时整个键不出现。契约
  `job-status.v1`、`library-documents.v1` 已改，`@retainpdf/contracts` 的 dist 已重新生成；`frontend/packages/api` 的生成客户端不用变
  （`generate:client:check` 是绿的）。
- **所在地区不支持的失败码从 `auth_failed` 改成 `upstream_region_unsupported`**（新任务；老任务记录不变）。`failure_category` 照旧
  `auth`、`retryable=false`、`resume_from=translation`，`summary`「所在地区不支持这个翻译服务商」，`recovery_hint` 说换网络或换服务商、换 Key 没用。
  前端现在按 `category` 显示，不改也不会坏（还是「凭据被拒」那套说法）。

前端要做（这次就是为了这两处）：
1. `frontend/web/src/features/book-detail/domain/job-failure-model.ts`：`failureAdvice` 先按 `brief.failure_code` 查一张表，查到就用，
   查不到照旧按 `category` 查 `BY_CATEGORY`。建议两条：
   - `upstream_model_unavailable`：标题「翻译模型不可用」，说明「模型名写错、这个 Key 没开通该模型，或接口地址写错，原样重试没用。去设置里改好模型后从翻译继续，不会重做 OCR。」，`retryLikelyHelps: false`，`settingsAction: "去设置改模型"`；
   - `upstream_region_unsupported`：标题「服务商不支持当前地区」，说明「服务商不向当前网络所在的地区提供服务，换 Key 没用。换网络或在设置里换一个翻译服务商后，从翻译继续。」，`retryLikelyHelps: false`，`settingsAction: "去设置换服务商"`。
   手写的 `JobFailureBrief` 类型（`@/platform/contracts/library-payloads.js`）加 `failure_code?: string`，或换成生成的 `JobFailureBriefView`。
2. `frontend/web/src/features/editorial-room/domain/narration.ts` 的 `STOP_REASON_TEXT` 加
   `model_unavailable: "模型不可用（名字写错或没开通），改好后可以接着跑"`、
   `region_unsupported: "服务商不支持当前地区，换网络或换服务商后可以接着跑"`（上一节 fix/llm-request-codes 就写过，这次一起做）。

---

## 服务端版本头、安全响应头（feat/api-response-headers）

2026-11-24，只增不改，**前端不用改**，细节见 [认证与错误·版本和安全响应头](../../api/00-约定/02-认证与错误.md#版本和安全响应头)：

- **每个回应带 `X-RetainPDF-Version`**（两个端口、出错、预检都有），值是应用版本（`2026.11.23` 这种；构建时没注入是
  `0.0.0+unknown`），和前端 `APP_VERSION` 同一个来源（`RETAIN_PDF_VERSION`）。`GET /health` 的 `data` 新加 `version`（同一个值）、
  `build`（提交号，拿不到是 `null`）。Docker 下网页镜像和后端镜像可能升级得不一样，前端以后想提示「网页和后端版本不一致」，
  可以在任意一个 API 回应上读这个头和 `APP_VERSION` 比（单机模式跨域也能读，CORS 暴露全部头）；任何一边是 `0.0.0+unknown`
  或带 `+` 的开发版本时别提示。要不要做、做在哪由前端定。
- **每个回应带 `X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`**。
- **文件出口带 `Content-Security-Policy: sandbox`，PDF 除外**：任务和书的文件、页预览、术语表 CSV 在浏览器里直接打开时是沙箱页面
  （不跑脚本）。核对过前端：阅读器的 PDF 用 pdf.js 按段 fetch（`packages/reader/src/pdf/pdf-range-transport.ts`），Markdown 图片用
  `<img>` / fetch 成 blob（`packages/reader/src/shared/content/markdown-images.ts`），唯一的 iframe 是阅读层 `reader.html`
  （`web/src/features/reader/ui/SoftReaderHost.tsx`，前端自己的页面，不是 API 地址），都不受影响。详情页「打开译文 PDF」等新标签页
  链接打开的是 PDF，PDF 没加沙箱，内置查看器照常显示。
- Docker 的 nginx 给页面加了 `Content-Security-Policy: frame-ancestors 'self'`（只限制谁能嵌，不限制脚本、样式）、nosniff、
  `Referrer-Policy: same-origin`（点到外站不带页面地址）。阅读层 iframe 是同源，不受影响；别的域名嵌 Docker 版页面会被挡。

---

## 规矩漏网补齐（fix/api-rule-gaps）

2026-11-24，见 [规矩漏网补齐](../../ops/planning/api-reorg/20261124-规矩漏网补齐.md)。**前端不用改**，下面都是可选的：

- **新 409 原因**：`PUT /documents/{id}/translation-version` 选了隐藏的版本带 `version_hidden`；`files/internal/{name}` 是目录带
  `artifact_is_directory`（正常碰不到）。「从翻译阶段重试」补 OCR 产物时任务变了的 409 现在带 `job_active` / `stale_resolution`，
  `frontend/web/src/platform/api/domains/jobs-actions.ts` 的 `ACTION_CONFLICT_MESSAGES` 已经认识这两个。想给隐藏版本一句中文的话，
  切换版本出错时按 `error.details.reason === "version_hidden"` 显示「这个版本已隐藏，先恢复再选」。
- **查询串不认识的参数 400**：文件出口（`/jobs/{id}/files/…`、`/documents/{id}/files/…`）、`DELETE /jobs/{id}`、`progress/stream`。
  核对过前端现在带的都认（`download`、`dpi`、`width`、`watermark`、`version`、`include_job_dir`、`force`、`after_seq`）。
  `include_job_dir`：「下载 Markdown」（`frontend/packages/domain/src/job/actions.ts` 的 `resolveJobMarkdownBundleAction`、
  `artifacts.ts` 的 `resolveManifestArtifactUrl`）在 `output/ocr.zip` 上带 `?include_job_dir=true`，文件清单里有这一项，
  前端会话核对过还在用；后端一直不看它，登记成认识的参数，行为不变。前端不用改。
- **边翻边看的流出错先发 `event: error`**：data 是错误信封 JSON（`code`、`message`、`error.code`、`error.details.reason`），然后流结束。
  现在的 `frontend/packages/api/src/live-translation.ts` 只认 `translation_units_committed`，别的事件跳过，流结束后
  `use-live-translation.ts` 照旧重连，不会出错。想显示原因（比如任务被删了就别再重连）：`parseSseFrame` 之后
  `frame.event === "error"` 时 `JSON.parse(frame.data)`，抛一个带 `error.code` / `http_status` 的 `LiveTranslationApiError`，
  `404` 时不再重连。
- **编辑部事件**：返回多 `limit`（默认 500）；`limit` 越界 400（前端不带 `limit`，不受影响）。契约 `job-events.v2` 的
  `EditorialEventListView` 加了必填 `limit`，`@retainpdf/contracts` 的 dist 已重新生成，`frontend/packages/api` 的生成客户端不用变
  （`generate:client:check` 是绿的）。
- **报错文字**：`POST /jobs`、书的 `/translate`、`/ocr` 字段类型不对时 `message` 从 serde 原文改成
  `invalid job payload: request body does not match the expected schema`（不认识的字段照旧带字段名），状态码照旧 400。

---

## 运维指标 `GET /metrics`、JSON 日志、访问日志开关（feat/request-metrics）

2026-11-24，只加不改，**前端不用改**：

- 新接口 `GET /metrics`（要 Key，多用户下 `admin`，`by(ops)`）：Prometheus 文本格式，给监控抓取，前端不调。
  见 [运维指标](../../api/08-调试诊断/04-运维指标.md)。
- 新环境变量 `RUST_LOG_FORMAT=json`（日志一行一个 JSON）、`RUST_API_ACCESS_LOG=1`（每个请求一行访问日志），默认都和以前一样。
  桌面壳启动后端时不用设。
- 接口用量文件 `route-usage.json` 多了 `route_stats`，`routes` 没变。

---

## 设置类第 2 批补完：凭据、服务商校验、字体、同步、备份、登录状态、上传进契约（feat/contracts-settings）

2026-11-24。决定见 [设置类第 2 批补完和在用接口冻结](../../ops/planning/api-client-codegen/20261124-设置类第2批补完和在用接口冻结.md)。
**接口行为没变**，只补了契约和后端测试。

- **前端要做（必须）**：重新生成客户端 `npm --prefix frontend/packages/api run generate:client`。不重新生成，前端测试
  `tests/contracts/api-client-codegen.test.mjs` 的「src/generated 和契约端点表一致」是红的。会多 4 个文件、19 个函数：
  - `src/generated/credentials.ts`：`listCredentials`、`createCredential`、`getCredential`、`updateCredential`、`deleteCredential`；
  - `src/generated/provider-probes.ts`：`validateMineruToken`、`validatePaddleToken`、`validateDeepSeekToken`、`queryDeepSeekBalance`；
  - `src/generated/platform-settings.ts`：`listFonts`、`getSyncStatus`、`updateSyncSettings`、`runSyncNow`、`testSyncTarget`、
    `getBackupStatus`、`createBackup`、`deleteBackup`、`restoreBackup`；
  - `src/generated/auth-session.ts`：`getAuthSession`。
- 新的类型子路径：`@retainpdf/contracts/credentials`、`/provider-probes`、`/platform-settings`、`/auth-session`、`/uploads`。
- **前端可以做（一组一组换，不换也不坏）**：

  | 文件 | 旧写法 | 新写法 |
  |---|---|---|
  | `frontend/packages/api/src/credentials.ts` | 手写 `credentialRequest` 发 `listCredentials`、`createCredential`、`updateCredential`，类型手写 | 生成的同名函数；类型 `CredentialListView`、`CredentialMutationView`、`CreateCredentialInput`、`UpdateCredentialInput` 从 `@retainpdf/contracts/credentials` 取；要删凭据用 `deleteCredential`（查询 `expected_revision`、`force`） |
  | `frontend/packages/api/src/providers.ts` | `validateMineruToken` 等 4 个用 `submitJson`，返回 `any` | 生成的同名函数，返回 `ProviderProbeView` / `DeepSeekBalanceView`；30 秒超时照 `fetchTranslationProviderModels` 的写法用 `signal` |
  | `frontend/packages/api/src/fonts.ts` | `listFonts` 手写，兼容 `{fonts: [...]}` | 生成的 `listFonts`，后端一直回数组（`FontListView = FontInfo[]`） |
  | `frontend/packages/api/src/sync.ts` | `fetchSyncStatus`、`updateSyncSettings`、`runSyncNow`、`testSyncTarget` 手写 | 生成的 `getSyncStatus`（改了名）和其余 3 个同名函数；类型 `SyncStatusView` 等 |
  | `frontend/packages/api/src/backups.ts` | `fetchBackupStatus`、`createBackup`、`restoreBackup`、`deleteBackup` 手写；手写的 `BackupStatus` 没有 `last_restore` | 生成的 `getBackupStatus`（改了名）和其余 3 个；`BackupStatusView` 带 `last_restore` |
  | `frontend/packages/api/src/auth.ts` | `fetchAuthSession` 用自己的 `request` | 生成的 `getAuthSession`；注意它要保留「先不带凭据问一次」的模式切换（`resolveAuthSession`），只换发请求那一步 |

- 不生成函数的：`GET /health`（不在 `/api/v1` 下；契约 `platform-settings.v1` 有返回类型 `HealthView`，`version`、`build` 是可选的，
  分支 feat/api-response-headers 加）、`POST /uploads`（multipart，返回类型 `UploadView` 在 `@retainpdf/contracts/uploads`）、
  两个文件下载（`files/output/*name`、`documents/:id/files/:name`，`binary`，照旧用地址）。
- 以后前端要调的新接口必须先进契约：rust_api 新测试 `in_use_endpoints_without_contract_only_shrink` 查接口登记表里 `by(web)`、
  `by(desktop)` 的接口都在契约端点表里（名单只许减，现在是空的）。后端加接口时会一起写契约，前端照旧重新生成。

---

## 翻译模型不可用、地区不支持、内容审核没过（fix/llm-request-codes）

2026-11-23，翻译请求层补上剩下的几类「重试没用」，细节见
[失败结构](../../api/08-调试诊断/01-失败结构.md#翻译请求的模型不可用地区不支持内容审核)。只增不改，字段一个没动：

- **新 `failure_code` `upstream_model_unavailable`**：模型名写错、Key 没开通该模型、接口地址写错（任何 404）。翻译第一次被拒就整份停下，
  `failure_category=auth`、`retryable=false`、`resume_from=translation`，`summary`「翻译模型不可用（HTTP 404）：模型名写错、这个 Key
  没开通该模型，或接口地址写错」，`recovery_hint` 后端给。前端按已有规则显示就能用（`auth` 分类会给「去设置换 Key」）。
- **地区不支持**照旧是 `auth_failed`，但 `summary`「所在地区不支持这个翻译服务商」、`suggestion` 说换网络或换服务商。
- **内容审核没过**不产生任务失败：那一块保留原文（死信），任务照常完成，算进「N 个块保留原文未翻译」。
- `upstream_bad_request` 的 `summary` 现在带实际状态码（409、413、422……）和服务商原话，以前固定「上游服务拒绝请求（400）」。
- 编辑部事件 `run_stopped.reason`（翻译 agent 的停下原因）可能出现两个新值 `model_unavailable`、`region_unsupported`。

前端可以做（不做也不坏，只是说法不够准）：
1. `frontend/web/src/features/editorial-room/domain/narration.ts` 的 `STOP_REASON_TEXT`：旧的只有 `quota_exhausted`、`auth_failed`、
   `rate_limited` 三个；新加 `model_unavailable: "模型不可用（名字写错或没开通），改好后可以接着跑"`、
   `region_unsupported: "服务商不支持当前地区，换网络或换服务商后可以接着跑"`。不加的话这两个值照原样显示英文。
2. `frontend/web/src/features/book-detail/domain/job-failure-model.ts` 的 `failureAdvice` 只按 `category` 查 `BY_CATEGORY`，
   `upstream_model_unavailable` 落 `auth`，标题是「凭据被拒」、按钮「去设置换 Key」，下面的 `summary` 写明是模型不可用。
   失败简报（`JobFailureBriefView`）里没有 `failure_code`，想给这类单独的标题（「翻译模型不可用」「去设置改模型」）需要后端在简报里
   加一个字段，要的话告诉后端（只增不改）。

---

## 走 Rust 模型执行器的翻译失败也带 `upstream`（fix/executor-failure-upstream）

2026-11-23，用户定补上 feat/failure-upstream 留下的缺口：任务绑了 `translation.execution_connection`、翻译请求走 Rust 模型执行器时，
翻译失败的 `failure.upstream` 以前没有，现在和直连一样有 `{provider, http_status, code}`（`provider` 按接口地址认，认不出是 `custom`）。
字段、出现的位置都不变，**前端不用改**，按已有的目录查找规则显示就行。执行器没收到上游回应的失败（连不上、本地超时）照旧没有 `upstream`。

---

## 检测接口：HTTP 状态码和厂商业务码分开，429 分清限流和欠费（fix/probe-status-codes）

2026-11-23，用户定：检测接口（`/providers/deepseek/validate-token`、`/providers/{mineru,paddle}/validate-token`、
`/providers/deepseek/balance`、`/providers/translation/models`、`/providers/translation/ask`）以前把 HTTP 状态码塞进 `provider_code`，
429 一律当限流——欠费的 Key 检测显示「可用（当前被限流）」。细节见 [Provider 校验接口第 3.1 节](../../api/08-调试诊断/05-服务商校验.md)。

变了什么：
- **加** `http_status`（数字或 `null`）：服务商回的 HTTP 状态码，六个接口都有。契约 `translation-providers.v1` 的
  `TranslationModelListView`、`TranslationModelAskView` 加了这个必有字段。
- **改含义** `provider_code`：只放服务商自己的业务码（智谱 `"1113"`、OpenAI `"insufficient_quota"`、百炼 `"Arrearage"`、OpenCode
  `"Policy budget exceeded"`），没有时 `null`；以前是 `"429"`、`"200"` 这样的 HTTP 状态码。查过前端（`frontend/`）、CLI 都不读这几个接口的
  `provider_code`（任务失败里的 `provider_code` 是另一回事，没动），所以没另起字段。这是「只增不改」的一次破例，2026-11-23 用户同意；以后改字段含义照旧另起新字段。
- **加 `status` 取值**：校验 Key 加 `quota_exceeded`（`ok: false`，额度或花费上限）；问模型加 `insufficient_balance`、`quota_exceeded`
  （契约 `TranslationModelAskStatus` 的 enum 加了两个值）。欠费类业务码（429 的智谱 1113、OpenAI credit_balance_exhausted、400 的百炼
  Arrearage……）现在落已有的 `insufficient_balance`；智谱 1311（套餐不含这个模型）、1315（Key 类型不对）落 `unauthorized`。
  真正的限流照旧 `rate_limited` + `ok: true`。拉模型列表的 `status` 没加值，只是 `summary` 换成具体原因。

前端要做的：
1. `frontend/web/src/features/ingest/domain/actions/submit/translation-probe.ts` 第 37 行：
   旧 `const CONFIG_FAILURES = ["unauthorized", "model_unavailable", "insufficient_balance", "invalid_input"]`，
   新的加上 `"quota_exceeded"`——不加的话额度用完的 Key 提交时不会弹提醒（设置页照样显示红字，因为 `ok` 是 `false`）。
2. 契约的 `dist/` 已经重新生成；`frontend/packages/api` 的 `generate:client` 只看接口清单，这次没加接口，不用重新生成。
3. 调试面板要显示状态码的话改读 `http_status`，`provider_code` 当厂商码显示（可以拿它查错误码目录 `GET /api/v1/providers/error-codes?provider=…&code=…`，见下一节）。

---

## 本机环境类失败码、Paddle 当日额度不再说成鉴权失败（fix/failure-fallback-classes）

2026-11-23，用户把错误码缺口交给后端：兜底「暂未识别出明确根因」的几类补上分类。只增不改，字段一个没动，细节见
[失败结构](../../api/08-调试诊断/01-失败结构.md#本机环境类失败码与-ocr-额度用完)。

新 `failure_code`（四个都 `failure_category=environment`、`retryable=false`、`resume_from=null`，`summary`、`recovery_hint` 后端给）：
`out_of_memory`（内存不足，#80）、`runtime_environment_broken`（缺模块 / 依赖库 / 安装文件，#7 #135 #143 #162）、
`path_too_long`（Windows 路径过长，#79 #81）、`local_permission_denied`（本机权限、文件被占用、安全软件拦截，#38）。

改了说法的：
- PaddleOCR 当日页数额度用完（HTTP 403 + 12001）从 `auth_failed`（Python 路径）/ `unknown`（Rust 路径）改成 `upstream_quota_exhausted`，
  `summary`「PaddleOCR 今日解析页数额度已用完（12001）」；MinerU 当日额度（-60018/-60019）同样从 `unknown` 改成这个码。
- OCR worker import 期崩溃不再被认成 `render_failed`；渲染失败的文字兜底要求有渲染阶段的证据。
- `auth_failed` 的 `suggestion` 按服务商出，不再对 PaddleOCR 用户说「检查 MinerU Token」。
- Paddle Token 检测（`POST /api/v1/providers/paddle/validate-token`）碰到 12001 时 `status` 从 `unauthorized` 变成 `provider_error`（不再说 Token 无效）。

前端要做的：不用改。失败卡片照旧显示 `summary`、`recovery_hint`；如果有按 `failure_category` 选图标、颜色的地方，多了一个取值 `environment`
（本机环境问题，换 Key、等一会儿都没用），没处理时按默认样式显示也行。

## 服务商错误码目录，给失败提示用（feat/provider-error-codes）

2026-11-23，用户要「把这些模型的文档的错误码全部爬取下来，然后做成文档，接入 api，方便后面的前端提示」。新接口
`GET /api/v1/providers/error-codes`（signed，前端 feat/error-diagnostics 接上以后 2026-11-23 登记改成 `by(web)`），契约 `provider-error-codes.v1`
（`listProviderErrorCodes`、`ProviderErrorCodesQuery`、`ProviderErrorCatalogueView`），细节见
[服务商错误码接口](../../api/08-调试诊断/03-服务商错误码.md)，逐家的表见 [服务商错误码](../../reference/error-codes/README.md)。
只增不改，任务失败的字段一个没动。

返回什么：
- `vendors[]`：9 家（`paddle`、`mineru`、`glm_ocr`、`openai`、`anthropic`、`deepseek`、`zhipu`、`qwen`、`opencode`），每家 `entries[]`：
  `code`（没码时 `null`）、`aliases`、`http_status`、`category`、`retryable`、`meaning_zh`、**`user_hint_zh`（给用户的提示）**、`source_url`，
  以及 `retainpdf_handling`（我们怎么处理、`status` 为 `gap` 时我们的分类和官方说法不一致）。
- `categories[]`：16 个大类，各带通用提示 `user_hint_zh` 和对照的 `failure_codes`。
- `failure_codes[]`：全部 `failure_code`，带 `summary_zh`、`resume_from`、`recovery_hint`。
- 筛选：`?kind=ocr|llm`、`?provider=`、`?code=`（精确匹配 code / aliases / id）、`?http_status=`。不认识的厂商 200 + 空 `vendors`。

任务失败怎么对到一条提示（现有字段就能做）：
1. OCR 阶段：厂商编号用任务详情的 `request_payload.ocr.provider`（`paddle` / `mineru` / `glm_ocr`；失败里的 `provider` 只有 Rust 认出的
   Paddle、MinerU 失败才是厂商名，Python worker 报的是 `ocr`）+ 失败里的 `provider_code` → `?provider=…&code=…`，显示条目的 `user_hint_zh`
   （例：GLM-OCR 余额不足 `provider_code=1113` → 「智谱账号余额或资源包不足，请充值后再试或换一个有余额的 API Key」）。
2. 翻译阶段：失败里的 `provider` 是 `translation`，现在多数没有服务商的码和 HTTP 状态；`upstream_host` 有值时对 `vendors[].hosts` 找厂商。
3. 查不到条目：按 `failure_code` 用 `failure_codes[].recovery_hint`（任务失败里本来就有 `recovery_hint`），或大类的 `user_hint_zh`。
4. 数据是静态的（编译时嵌入），可以进页面时拉一次全量缓存，不用每次失败都请求。

前端要做的（接的时候再做，不急）：
1. `npm --prefix frontend/packages/api run generate:client`：契约加了带 `client_name` 的接口，`src/generated/provider-error-codes.ts`
   要重新生成（不生成 `generate:client:check` 会红；CI 现在不跑这一步）。
2. 失败卡片上在后端的 `summary` / `recovery_hint` 下面加一行条目的 `user_hint_zh`，放哪、要不要显示 `meaning_zh` 由前端定。

后端还没做、等以后的（第 4 步，没做）：任务失败里加 `upstream: {provider, http_status, code}`，让翻译阶段也能精确对到一条。
现在翻译侧的错误只带状态码文字（「HTTP 401」），厂商要从接口地址推，Python 结构化失败、Rust 的 `JobFailureInfo`（19 处构造）、
`job-status.v1` / `job-reports.v1` 两份契约都要改，量不小，另开分支做；做之前前端按上面第 2 步的办法凑合。

---

## 任务失败带上游错误码 `upstream`，OCR 失败的 `provider` 写服务商（feat/failure-upstream）

2026-11-23，用户把错误码缺口交给后端：前端要能把失败的任务对上错误码目录（`GET /api/v1/providers/error-codes`）里的条目。只增不改，旧字段照旧。

新字段 `upstream`（契约定义 `JobFailureUpstream`，`job-status.v1`、`job-reports.v1`、`library-documents.v1` 各一份，结构一样）：

```json
"upstream": { "provider": "openai", "http_status": 429, "code": "insufficient_quota" }
```

- 出现在：任务详情 `failure.upstream`、任务列表 / 书的任务列表的 `failure.upstream`（`JobFailureBriefView`）、
  `GET /jobs/{job_id}/reports/failure` 的 `upstream`（`JobDiagnosticsView`）、失败事件的 `payload.upstream`。
- 有时三个键都在、不知道的是 `null`；HTTP 状态和错误码都不知道（超时、连不上、本地异常、旧任务）时**整个键不出现**。
- `provider` 用目录里的服务商编号：翻译 `openai` / `anthropic` / `deepseek` / `zhipu` / `qwen` / `opencode`，认不出的接口地址是 `custom`；
  OCR `paddle` / `mineru` / `glm_ocr`。`code` 是服务商自己的错误码，原样、字符串（`"1113"`、`"-60018"`、`"insufficient_quota"`）。

怎么查目录条目：`upstream.provider` 对服务商的 `id` → 先按 `upstream.code` 对 `entries[].code`（再看 `aliases`）→ 对不上再按
`upstream.http_status` 对 `entries[].http_status`。`provider` 是 `custom` / `null`、或者没有 `upstream` 时，照旧按 `failure_code` 显示通用提示。
三个例子：

| 失败 | `failure.provider` | `failure.upstream` |
|---|---|---|
| 翻译 429（OpenAI 额度用完） | `translation` | `{"provider":"openai","http_status":429,"code":"insufficient_quota"}` |
| GLM-OCR 余额不足 | `glm_ocr` | `{"provider":"glm_ocr","http_status":429,"code":"1113"}` |
| Paddle 今日额度用完（Rust 那条路） | `paddle` | `{"provider":"paddle","http_status":403,"code":"12001"}` |

另外：OCR 失败的 `failure.provider` 以前是泛称 `ocr`（Python OCR worker 报的），现在是服务商编号（`paddle` / `mineru` / `glm_ocr` / `local`），
不用再读 `request_payload.ocr.provider`。`job-failure-model.ts`、`diagnostics.ts` 里把 `provider` 原样显示的地方会从「ocr」变成「glm_ocr」这类，
要不要换成中文名由前端定。

前端要做的：
1. 契约 DTO 已重新生成（`contracts/dist`），`JobFailureInfo` / `JobFailureBriefView` / `JobDiagnosticsView` 多了可选的 `upstream`；
   用到 `frontend/packages/api` 生成的请求函数的，照常跑 `generate:client` 看有没有变化。
2. 失败卡片（`frontend/web/src/features/book-detail/domain/job-failure-model.ts`、`job-detail/domain/dialog/failure-recovery.ts`）：
   有 `upstream` 时按上面的规则查目录，显示条目的 `user_hint_zh`；`failure-recovery.ts` 里从 `ocr_provider_diagnostics.last_error` 取 `provider_code`
   的地方可以改读 `failure.upstream.code`（旧的照旧能用）。

细节见 [失败结构](../../api/08-调试诊断/01-失败结构.md) 的「上游信息」一节。走 Rust 模型执行器的翻译失败以前没有 `upstream`，2026-11-23 补上了（见最上面一节）。

---

---

## 服务商限流时进度里报「等待中」（feat/upstream-wait-events）

2026-11-23，用户：被限流等待时进度里带出来，前端显示「服务商限流，等待中」，别像卡住了。只加不改，旧字段、旧事件都不变。

后端给的：
- 任务详情 `GET /api/v1/jobs/{job_id}` 和任务列表（`include_live_stage`）的 `stage_snapshot` 多一个可选字段 `upstream_wait`：
  翻译或 OCR 请求因为服务商 429（限流）/ 529（过载）/ 503（暂不可用）在退避等待时出现，所有在等的请求等完就**不出现**（不是 null）。
  形状 `{provider, http_status, reason, code, retry_after_s, wait_source, attempt, max_attempts, started_at, until}`，
  契约 `job-status.v1` 的 `UpstreamWaitView`（`@retainpdf/contracts/job-status` 重新生成后有 `UpstreamWaitView` 类型）。
  `provider` 是服务商 id：`openai` / `anthropic` / `deepseek` / `zhipu` / `qwen` / `opencode` / `custom`，OCR `paddle` / `mineru` / `glm_ocr`。
- 事件流 `GET /api/v1/jobs/{job_id}/progress/events` 多一对进度事件：`payload.observation.upstream_wait_transition` 为
  `started`（`payload.observation.upstream_wait` 是等待信息）和 `ended`（`upstream_wait: null`）。进度数字、`stage_detail` 和上一条一样。
- 同一阶段几十个请求同时被限流也只有一对事件；字段在等待期间一直在。

前端要做的（建议）：
1. 进度卡、书架卡：`stage_snapshot.upstream_wait` 在时，在进度旁显示「服务商限流，等待中」，可加服务商名和倒计时
   （如「DeepSeek 限流，约 30 秒后重试」，倒计时读 `until`）；`until` 过了字段还在时只显示「等待中」，不要当成卡死或失败。
   `reason=overloaded` 可写「服务商繁忙」，`unavailable` 写「服务商暂不可用」。字段消失就恢复原样。
2. 类型：`npm --prefix contracts run generate` 已在后端分支里跑过（`contracts/dist` 已提交）；前端用 `JobStageSnapshotView.upstream_wait` 即可，
   不用自己拼事件。
3. 不用改的：进度条、`stage_detail` 照旧。

说明见 [查询任务详情](../../api/01-任务/02-查询任务详情.md#服务商限流等待stage_snapshotupstream_wait)、
[事件总览](../../api/02-进度事件/01-事件总览.md#服务商限流等待事件2026-11-23)。

## 用翻译接口问一次模型，可以带图片（feat/model-image-input）

2026-11-22，用户要"后端增加一个 api，最好可以发图片"。新接口 `POST /api/v1/providers/translation/ask`（admin），在契约
`translation-providers.v1` 里（`askTranslationProviderModel`、`TranslationModelAskRequest`、`TranslationModelAskView`），
细节见 [Provider 校验接口第 9 节](../../api/08-调试诊断/05-服务商校验.md)。只增不改，别的接口不动。

前端要做的：
1. `npm --prefix frontend/packages/api run generate:client`：契约加了接口，`src/generated/translation-providers.ts` 要重新生成
   （不生成 `generate:client:check` 会红）。
2. 要不要在界面上用（比如设置里"测试看图"、调试面板）由前端定；请求体里图片是 base64（不带 `data:` 前缀），最多 4 张、每张 4 MB。

## 字体和 Typst 改成按需下载（feat/runtime-assets）

2026-11-22，用户定：安装包里不带思源宋体（压缩后约 33MB）和 Typst（约 16MB），首次启动在后台下载，缓存在数据目录，
升级不重下；断网时用包里留着的 DroidSansFallback 先排。后端这半已经做好，**打开开关之前行为不变**（包里照旧带着时，
状态都是 `bundled`，不会去下）。

后端给的：
- `GET /api/v1/runtime-assets`：`{downloads_enabled, assets: [{id: "fonts"|"typst", title, version, state, bytes_done, bytes_total, source, error}]}`，
  `state` = `bundled` / `ready` / `missing` / `downloading` / `failed`。
- `POST /api/v1/runtime-assets/download`：在后台把缺的、失败的再下一遍，马上返回当前状态。
- 两个都不在契约里（和 `/api/v1/fonts` 一样手写调用）。

前端（第 3 步）要做的，**要等 npm 上的包发好以后再发版**，不然用户那边下不到、只能用后备字体：
1. `frontend/desktop/src/main/backend-env.js`：加 `RETAIN_PDF_RUNTIME_ASSETS: "download"`；`RETAIN_PDF_FONT_PATH`、
   `RETAIN_PDF_TITLE_BOLD_FONT_PATH` 只在包里那个文件存在时才设（指向不存在的文件时 Python 会照用、然后报错，不会自己换字体）；
   `RETAIN_PDF_TYPST_FONT_FAMILY` 不要再写死 `Source Han Serif SC`，不设就行（Python 按有没有思源宋体自己选，没有时用 `Droid Sans Fallback`）；
   `TYPST_BIN` 照旧只在文件存在时设（现在就是这样）。
2. `frontend/desktop/src/main/plugins/backend.js` 第 194 行：包里没有 typst 时不要报错退出。
3. 打包（`scripts/prepare-app.mjs`、workflow 里下载 Typst 的那几步）：不再拷 `SourceHanSerifSC-*.otf` 和 `typst/`；
   `DroidSansFallbackFull.ttf` 留在 `backend/fonts/`。`typst-packages` 照旧带着（小）。
4. 设置页：显示每份资源的状态和进度（`bytes_done / bytes_total`），`failed` 时给「重新下载」（POST），`missing`/`failed` 时提示
   「生成的 PDF 会暂时用后备字体」。
5. 断网试一次：不联网新装、翻译一本，PDF 照样出来（黑体风格）；联网后重新渲染换成宋体。

为什么、怎么做的见 [字体和 Typst 按需下载](../../ops/planning/desktop-size/20261122-字体和Typst按需下载.md)。

---

## 阅读页能看到表格译文，开关可以放进界面了（feat/reader-table-translations）

2026-11-22。表格翻译 T4。建任务时 `translation.tables` 选 `translate`，表格 agent 整表翻了的表，
`GET /api/v1/jobs/{job_id}/reader/regions` 里这一块变成：

| 字段 | 以前（只有原文） | 现在（整表翻了） |
|---|---|---|
| `status` | `source_only` | `translated` |
| `translated.text` | `null` | 整表译文 HTML（`<table>…</table>`，跨行跨列照原表） |
| `markdown` | 原文表格 HTML | 整表译文 HTML |
| `source.*`、`translated.bbox`、`region_type`、`sub_type` | 不变 | 不变（位置用原文的） |

没开表格翻译、整表保留原文、结构不可信没送的表照旧是 `source_only`。字段和契约都没加，只是这些块有了译文。

前端要做的：

1. **开关放进建任务界面**（以前交接写的「先不要放」作废）：`translation.tables`，`keep`（默认）/ `translate`，
   契约里早就有（`create-job.v1`、`library-documents.v1` 的 `translateDocument`）。建议文案：「翻译表格（试验）：正文翻完后逐张翻表格，
   只翻有文字层的表；阅读页能看到，译文 PDF 里表格还是原文」。会多花一些 token（评测集 55 张表约 31 万 token，用量页记在「表格翻译」）。
2. **阅读页**：`reader-blocks.ts` 拿 `translated.text` 当译文，表格块的内容本来就是 HTML，预计 Markdown 视图、悬停框、复制、
   MD 打包下载不用改就能拿到译文。请确认表格块的译文按 HTML 渲染（不是当纯文本显示 `<td>`）。
3. **译文 PDF 里的表格还是原文**（放回 PDF 是 T5）。阅读页 PDF 视图的译文一侧看不到表格译文，这是预期的。
4. **表格译文还不能「改」**：单块修改只改正文翻译清单里的条目，表格译文不在清单里（单格修改以后再接）。表格块的「改」先别对译文开放。

为什么、怎么做的见 [T4 阅读页用上表格译文](../../ops/planning/table-translation/20261122-T4阅读页用上表格译文.md)。

---

## 下载的译文 PDF、对照 PDF、Word 默认带水印（feat/export-watermark）

2026-11-20，用户定：默认开、每页右下角「logo + RetainPDF」。`/jobs/{id}/files/output/translated.pdf`、`side-by-side.pdf`、
`translated.docx` 默认返回带水印的版本，加 `?watermark=0` 返回原版。地址、字段都没变，下载按钮不改就带水印。

前端已做（2026-11-20，`fix/reader-no-watermark`）：`resolveReaderTranslatedPdfUrl` 出口统一过 `withoutExportWatermark`，阅读页打开书、对比版本显示的译文都带 `watermark=0`；下载菜单走 dialog runtime-port 的 `currentArtifactUrls`，不加，照旧带水印。书详情页的下载链接也不加。「导出时加水印」开关还没做。

原来的交代：阅读页显示译文加载的也是 `translated.pdf`，不改的话阅读页译文右下角会出现水印。
- `frontend/packages/reader/src/shared/data/resource-resolver.ts`：译文 PDF 地址（`manifestCandidates` 取到的 `pdf` / `translated_pdf` / `result_pdf`，
  和兜底的 `jobOutputFilePath(job_id, "translated.pdf")`）后面加 `watermark=0`（地址里已有 `?` 就用 `&`）；
- 阅读页「下载」菜单（`shared/state/downloads/resolve.ts`、`web/src/features/reader/domain/dialog/runtime-port.ts`）用的是同一个地址：
  显示用的加 `watermark=0`，下载用的不加（要带水印）。

前端可选：设置里加「导出时加水印」开关，关的时候下载地址带上 `watermark=0`（`book-detail/domain/artifact-resources.ts` 的
`jobOutputFileUrl(...)`：旧 `?download=1`，新 `?download=1&watermark=0`；译文 PDF 那一项用后端给的 `pdfUrl`，在后面加）。

做法见 [导出水印](../../ops/planning/export-watermark/20261120-导出水印.md)。

## 加回单个任务的用量（feat/job-usage）

2026-11-20。`GET /api/v1/jobs/{job_id}/reports/usage` 加回来了，只增不改。契约 `token-usage.v1`：调用函数名 `getJobUsage`，
返回 `UsageSummaryView`，和书的用量同形状（含 `estimated_cost_usd`、`pricing`），`scope` 多了取值 `"job"`。
`contracts/src`、`dist` 已重新生成；前端跑 `npm --prefix frontend/packages/api run generate:client` 生成调用函数。

为什么：进度页顶上的「1040.2 万 / 约 ¥15.58」和各节点上的 token 是 `GET /documents/{id}/usage` 的书的合计，
这本书前后跑过 10 个任务，这一次其实只用了约 76 万 token、约 ¥1。前端要改的：

- 进度页（单个任务）顶上的 token、花费，和翻译、精修节点上的 token，改用 `getJobUsage(job_id)`；
  按 `by_stage[].group` 分节点（`translation`、`preparation`、`refine`）。
- 精修组（`group = "refine"`）现在挂在排版节点上，应该挂到精修，没有精修节点就不显示。
- 书的合计（`getDocumentUsage`）仍然可以放在概览，写明「全书累计」。

前端已跟上（`fix/job-usage`，2026-11-20）：`@retainpdf/api/usage` 加 `fetchJobUsage`，`features/usage` 加 `useJobUsage`；
`ProcessingTabWithUsage` 改读这一次任务（`doc:` 开头的占位编号不读），细节区那页改叫「本次用量」；
`processing-hud-model` 不再把精修组挂到版面站（流水线没有精修站，合计里照样算）；概览的「花费」小字写「全书累计 N 个任务，按标价估算」。

---

## 拉取模型列表进契约（feat/provider-models-contract）

2026-11-19。`POST /api/v1/providers/translation/models` 登记进新契约 `contracts/translation-providers.v1.schema.json`
（`@retainpdf/contracts/translation-providers`），调用函数名 `listTranslationProviderModels`，字段和上一节一样。
`contracts/src`、`dist` 已重新生成；前端跑 `npm --prefix frontend/packages/api run generate:client` 生成调用函数，手写的那份可以删掉。

---

## 从翻译接口拉取模型列表（feat/provider-model-list）

2026-11-19。新接口，只增不改。详见 [Provider 校验接口](../../api/08-调试诊断/05-服务商校验.md) 第 8 节。

- `POST /api/v1/providers/translation/models`，请求 `{base_url, api_key, api_protocol}`（内联 Key，用完不存）。
- 返回 `{ok, status, summary, source: "provider", base_url, fetched_at, provider_code, provider_message, chat_models, models}`；
  `models` 每项 `{id, display_name, owned_by, created, kind: "chat"|"other", price_provider, price_basis, price}`，按 id 排序去重。
- 设置里「从服务商拉取」：默认只列 `kind = "chat"`，「显示全部」列全部；`price` 和 `/usage/prices` 同形状，可以直接显示单价，不用再调一次。
- `status = "unsupported"` 时提示「这个接口不支持列模型，请手动填」；`unauthorized` 是 Key 不对。

---

## 查单价、估价（feat/usage-estimate）

2026-11-19。新接口和新字段，只增不改。详见 [模型用量](../../api/11-用量/01-模型用量.md#估价)。

| 接口 | 用途 |
|---|---|
| `POST /api/v1/usage/prices`（`lookupModelPrices`） | 下拉框里每个候选模型的单价（每百万 token，美元） |
| `GET /api/v1/documents/{id}/usage/estimate?base_url=&model=`（`estimateDocumentUsage`） | 这本书换这个模型重新翻译大概多少钱：`translation.low_cny`–`high_cny` |
| `GET /api/v1/usage/estimate?base_url=&model=&pages=`（`estimateLibraryUsage`） | 还没有的书按书库每页平均估 |
| 用量汇总、单价、估价里的 `pricing.usd_cny` | 1 美元 = 7.16 元（写死），前端不用再自己写 7.2 |

- 契约 `token-usage.v1` 加了三个接口和 `PriceLookupView`、`UsageEstimateView` 等类型，`contracts/src`、`dist` 已重新生成；
  前端的调用函数要跑 `npm --prefix frontend/packages/api run generate:client` 重新生成。
- 估价放后端算：缓存、分档、DeepSeek 忙闲时的规则只在后端一处，前端只显示 `low_cny`–`high_cny`。
  `basis = "none"`（没有可参照的用量）时不显示金额；`low_usd` 为 `null` 是模型查不到价。

---

## 人文书第二遍分两轮（feat/agent-split-review）

2026-11-19。接口、字段、事件都没变，前端不用改。人文社科、通俗读物每页的第二遍从"编辑一次做完"改成两轮：先审校只审意思，再由编辑只改文笔。
编辑部事件照旧是一对 `review_started` / `review_done`（`tickets`、`applied`、`rejected` 是两轮加起来的）；块的修改历史里，
第一轮的说明以「审校（错译 / 漏译或添加 / 语气偏离 / 数字或术语）」开头，第二轮以「编辑（文笔）」开头。
「编辑模型」（`reviewer_*`）两轮都用；用 flash 模型时第一轮会改硬一些句子，界面上推荐配 claude-haiku-5-5 一档的话，可以在提示里写。

---

## 编辑部事件：翻译 agent 查了什么（feat/agent-tools）

2026-11-19。只加不改：编辑部事件（`GET /jobs/:id/progress/editorial`）新增一种 `tool_call`，初译时模型调了只读工具才有：

- `page`、`role`（现在只有 `translator`）；
- `tool`：`search_book`（全书搜原文）/ `lookup_term`（查术语表）；
- `query`：搜的词，最多 80 字；
- `found`：搜到几处 / 查到几条；
- `error`：只在出错时有，例如这一页的次数用完了。

同一页的几轮工具调用算在同一次 `translate_call` 里，不会多出 `translate_call`。正式流程还没开工具（先在 agent_lab 上对比），
所以现在的任务不会产生这个事件；不认识的事件类型照旧跳过即可。格式见 `docs/api/02-进度事件/03-编辑部事件.md`。

前端要做的（可选）：编辑部画面认 `tool_call`，显示成例如「查全书：coroner（3 处）」「查术语表：inquest（没有）」。

---

## 译文版本：一本书的几份译文能切换（feat/translation-versions）

2026-11-18。只加不改：老前端不传 `version` 时阅读入口的行为和以前一样（用户没选过版本 = 自动，逐页取最新）。契约
`library-documents.v1` 追加三个端点和几个类型（`contracts/src`、`dist` 已重新生成）：

- `GET /api/v1/documents/{id}/translation-versions[?include_hidden=true]` → `TranslationVersionsView`：
  `current_version_id`（null = 自动）、`has_newer`（选了某个版本、后面还有更新的：提示「有新版本」）、`versions`（从旧到新）。
  每个版本有 `name`（显示用）、`label`（用户起的）、`origin`、`base_version_id`、`created_at`、`status`、`page_ranges`、`whole_book`、
  `engine`、`model`、`reviewer_model`、`edited_blocks`（手改了几块）、`hidden`、`is_current`。
- `PUT /api/v1/documents/{id}/translation-version` `{ "version_id": "tv-…" | null }`：切换；null 回到自动；隐藏的版本 409。
- `PATCH /api/v1/documents/{id}/translation-versions/{version_id}` `{ "label"?: string, "hidden"?: boolean }`：改名（空串清掉）、隐藏、恢复。
- `GET /api/v1/documents/{id}/reading?version=<id|auto>`：回包多 `version_id`（null = 自动）。不给 `version` 读书的当前版本。

前端要做的：

- 阅读页 `web/src/features/reader/domain/resolve-reading-target.ts`：`resolveReadingJobId` 现在调 `/reading`；切版本时带上
  `version`（或先 `PUT` 当前版本再照旧调 `/reading`，两种都行，后者会记住用户的选择）。
- 书详情 / 阅读页加一个版本下拉：列 `versions`（`name` + `created_at`，`edited_blocks > 0` 显示「改过 N 处」，`status=running` 显示翻译中），
  第一项「自动（最新）」对应 `version_id: null`；`has_newer` 时提示「有新版本」。改名、隐藏放在下拉的更多菜单里。
- 只重翻几页（书库「翻译这本书」带页码）出来的版本，读的时候其余页自动用来源版本，前端不用拼。
- 手改译文照旧用 `/jobs/{job_id}/translations/...`（改在那个版本的任务里）；合并阅读的虚拟任务仍是只读。

---

## 精翻（agent）可以单独配编辑模型（feat/agent-rewrite-pass）

2026-11-18。接口字段没变。`engine=agent` 时，建任务里已有的 `reviewer_model`、`reviewer_base_url`、`reviewer_api_key` /
`reviewer_credential_ref`、`reviewer_api_protocol`、`reviewer_thinking` 现在会被用上：人文社科、通俗读物每页由「编辑」整块重写（也改文笔），
理工类照旧挑错；填了审校模型（和翻译模型不同名）时，编辑 / 审校走它，通读和初译仍走翻译模型。

前端可以做（不做也不出错，编辑就用翻译模型）：

- 翻译选项里选「精翻」时，提供一个可选的「编辑模型」：服务商、模型名，提交成 `reviewer_*`。试过的搭配：初译 qwen3.8-flash +
  编辑 claude-haiku-5-5，比全用 qwen 自然得多，比全用 Haiku 省。
- 「编辑部」画面：编辑重写的事件和审校一样是 `review_started` / `review_done`（`applied` 是改了几块）；块的修改历史里说明以
  「编辑（文笔）」「编辑（意思）」开头。

---

## 术语页读得到翻译 agent 的术语（feat/agent-terms-dataset）

2026-11-18。agent 任务（`engine=agent`）跳过译前准备，没有 `term-base.v1.json`，`terms`、`term_conflicts` 一直是空的。
取数接口 `GET /api/v1/jobs/{job_id}/data/{dataset}` 加了两个数据集（契约 `job-data.v1` 的登记表，没有新接口），读 agent
自己的术语表 `translated/agent/run/glossary.json`：

- `agent_terms`：术语。字段 `id`、`source`、`target`、`category`（`term` 术语 / `keep` 保留原文 / `abbr` 缩写 / `name` 人名等专名）、
  `status`（`candidate` 候选 / `approved` 审定 / `locked` 用户给的）、`scope`、`chapters`、`note`、`first_seen_page`（页面标签，字符串）、
  `first_seen_quote`、`votes`（候选：每种译法报了几次）、`version`。`category`、`status`、`source`、`id` 能筛选。
- `agent_term_tickets`：歧义单（同一个词报上来和表里不同的译法，没有自动统一）。字段 `term`、`source`、`current`、`proposed`、
  `page_label`、`quote`、`why`，公共字段 `item_id`、`reader_item_id`、`page` 有（从块号推）。

前端要做的：

- `web/src/features/book-detail/ui/tabs/BookDetailTermsTab.tsx`：现在只 `load(jobId, "terms", …)`、`load(jobId, "term_conflicts", …)`。
  `terms` 不可用（`available=false`）而 `agent_terms` 可用时改读 `agent_terms`（`limit: 1000`；没有 `frequency`，可以按 `source` 排），
  冲突一栏读 `agent_term_tickets`。或者两边都读、合在一起显示——一个任务只会有其中一边。
- `web/src/features/book-detail/domain/terms-model.ts`：字段对应 `treatment` → `category`、`review_status` → `status`；agent 的条目没有
  `kind`、`origin`、`level`、`annotate`、`frequency`、`conflict_candidates`（候选看 `votes`）。
- 旧任务、legacy 任务不受影响；`GET /data` 的目录里多两条，没有 agent 跑过时 `available=false`。

---

## 翻译 agent 不再只收 Anthropic 协议（feat/agent-openai-protocol）

2026-11-18。建任务时 `translation.engine=agent` 配 `api_protocol=openai` / `openai_responses` 不再 400
（以前回 `translation.engine=agent requires translation.api_protocol=anthropic`）。字段、取值都没变，契约只改了 `engine` 的说明。

前端要做的：

- `web/src/features/ingest/domain/workflow/payload.ts`：`agentEngineAvailable(apiProtocol)` 以前写 `return apiProtocol === "anthropic";`，
  改成不看协议（直接 `true`，或者删掉这个函数，`translationEngineFields` 只看 `engine === "agent"`）；上面那行注释「agent 只在 anthropic 协议下发（否则后端 400）」跟着改。
- `web/src/features/ingest/ui/components/TranslationOptionsPanel.tsx`：`unavailable` 文案「翻译 agent 只支持 Anthropic 格式的接口……」不再需要。
- 旧前端不改也不出错：只是 OpenAI 协议下选不了 agent。

为什么、怎么做的见 [agent 接 OpenAI 协议](../../ops/planning/translation-agent/20261118-agent接OpenAI协议.md)。

---

## 建任务加 `translation.tables`（feat/table-agent）

2026-11-14。表格翻译 T3：建任务的 `translation` 里加 `tables`，`keep`（默认，行为不变）/ `translate`；填别的值 400。
任务详情回显的 `request.translation` 里也多了 `tables`。契约 `create-job.v1`、`job-status.v1`、`library-documents.v1`（`translateDocument`
的请求体）都加了这个字段，`contracts/src`、`dist` 重新生成了。

前端现在**不用做什么**：不提交就是 `keep`。阅读页、PDF 还没用上表格译文（T4、T5），先不要把开关放进界面。要重新生成
`frontend/packages/api/src/generated/` 的话，只会多出这个可选字段。

---

## 删掉三个没人调的接口（chore/api-delete-batch2）

2026-11-14。`GET /api/v1/jobs/{job_id}/reports/usage`、`GET /api/v1/jobs/{job_id}/reports/quality/items`、
`GET /api/v1/jobs/{job_id}/reader/regions/{item_id}` 删了，现在返回 404。契约里的 `getJobUsage`（`token-usage.v1`）、
`listQualityItems` 和 `QualityItem*` 三个类型（`job-reports.v1`）、`getReaderRegion`（`reader-data.v1`）跟着删。`UsageSummaryView.scope`
不会再是 `job`，但契约里先留着这个取值：`features/usage/domain/usage-view-model.ts` 判断了 `scope === "job"`，前端删了这个判断告诉后端，再从契约去掉。

前端要做的：重新生成 `frontend/packages/api/src/generated/`（不然生成一致性测试是红的）；`frontend/packages/api/src/quality.ts`
里手写的 `QualityItem`、`QualityItemsView`、`QualityItemKind` 和 `web/src/platform/api/domains/quality.ts`、`mocks/quality.ts` 里对它们的
引用可以删。为什么能删见 [第二批删接口](../../ops/planning/api-reorg/20261114-第二批删接口.md)。

---

## OCR 这一站照 OCR 子任务的状态（fix/ocr-stage-from-child）

2026-11-02。字段不变，取值的含义变准了：任务的 OCR 交给子任务（`<任务>-ocr`）跑时，`stages.ocr.state` 照子任务，不再按阶段先后推。

| 情况 | 以前 | 现在 |
|---|---|---|
| OCR 和翻译并行（GLM-OCR），翻译已经开始、OCR 还在跑 | `completed` | `in_progress` |
| 翻译失败，OCR 子任务也失败了或被取消了（比如重启时一起停了） | `completed` | `failed` |
| 翻译失败，OCR 子任务之前已经成功 | `completed` | `completed`（不变） |

前端 `features/library/domain/translation-ocr-reuse.ts` 的 `translationOcrStatus` 先看 `stages.ocr.state`，所以不用改就不会再挑没做完的 OCR
去复用（以前挑中了，后端回 `OCR_JOB_NOT_SUCCEEDED`，界面说「现有 OCR 产物暂时无法复用」）。要看一眼的是「进度」页：并行时 OCR 站以前
靠 `ocr_stream` 显示全书页数，现在 `stages.ocr.state` 本身也是 `in_progress` 了，确认显示没有打架。

---

## 阅读页的「AI」打开 Studio 的 AI（feat/studio-bridge-ask-ai）

2026-11-02。契约 `contracts/studio-bridge.v1.schema.json` 只加不改：Studio 的能力 `StudioFeature` 加 `"ask-ai"`，新消息 `ask-ai`
（RetainPDF → Studio，只有 `protocol`、`v`、`type` 三个字段，不许别的字段）。放在 Studio 里时只留 Studio 的 AI。

| 地方 | 现在 | 要改成 |
|---|---|---|
| 阅读页的「AI」 | 打开 RetainPDF 自己的 agent 终端 | 握手过、`hello.features` 有 `ask-ai` 时：先把眼下的 `reading` 立刻发出去（不等防抖），再发 `ask-ai`，不打开自己的终端；Studio 没列 `ask-ai` 时照旧 |

---

## 告诉 Studio 眼下读到哪（feat/studio-bridge-reading）

2026-11-02。契约 `contracts/studio-bridge.v1.schema.json` 只加不改：新消息 `reading`（RetainPDF → Studio）。Studio 里只用 Studio 自己的 AI，
它用只读接口读书（`/api/v1/documents`、`/search`、`/documents/:id/reading`、`/jobs/:id/reader/regions(/:item_id)`），缺的只是作者眼下在读哪本、哪一页。

消息：`{protocol, v: 1, type: "reading", job_id, document_id, title, page_idx, page_count}`，五个字段都要写，没有的写 `null`：

- `job_id`：字符串（非空）或 `null`；`document_id`、`title`：和 `quote`、`open-notes` 里的同一套；
- `page_idx`：0 起的整数（和 `navigate`、阅读页地址的 `page_idx` 一样）或 `null`；`page_count`：≥1 的整数或 `null`；
- 离开阅读页（回主页、详情页）：同一种消息，五个字段全是 `null`，不另起类型。

| 地方 | 现在 | 要改成 |
|---|---|---|
| 收 `hello` 回 `ready` | `features` 有 `theme`、`navigate`、`quote`、`notes` | 实现了下面两行时加上 `reading`（Studio 不用在 `hello.features` 登记，照发） |
| 阅读页（握手后） | — | 进阅读页发一次 `reading`；翻页后防抖、停下来再发 |
| 离开阅读页 | — | 发一条五个字段都是 `null` 的 `reading` |

---

## 阅读页唤出笔记（feat/studio-bridge-notes）

2026-11-01。接着下一节，契约 `contracts/studio-bridge.v1.schema.json` 只加不改。做法见
[阅读页唤出笔记](../../ops/planning/studio-workbench/20261101-阅读页唤出笔记.md)。

| 地方 | 现在 | 要改成 |
|---|---|---|
| 收 `hello` | 记 origin、换颜色、回 `ready` | 另外记下 `hello.features`（可选，没有就当只有 `quote`）；`ready` 的 `features` 加上 `notes`（实现了下面两行时） |
| 阅读页工具栏（新按钮「笔记」） | — | 握手过、而且 `hello.features` 有 `open-notes` 才显示；笔记收着时点了发 `open-notes`（`job_id`、`document_id`、`title`，和 `quote` 里的同一套），开着时发 `close-notes` |
| 收 `notes`（新） | — | 按 `open` 显示「笔记」按钮按下没有；`title` 可以用作提示（「笔记：书名」） |

Studio 收到 `open-notes` 会在阅读页旁边（右边）开出这本书的笔记，iframe 会变窄，阅读页要能跟着宽度重排。

---

## 放在笔记（Studio）里时和它说话（feat/studio-bridge-contract）

2026-11-01。新加的契约，后端接口不变。做法和分工见 [书和笔记接在一起](../../ops/planning/studio-workbench/20261101-书和笔记接在一起.md)，
消息格式见 `contracts/studio-bridge.v1.schema.json`（每种消息一个定义，`description` 写了什么时候发、谁认）。

Studio 左栏「翻译」把 RetainPDF 的网页放进 iframe，地址带 `?embed=studio`。前端要做：

| 地方 | 现在 | 要改成 |
|---|---|---|
| 地址参数 `embed=studio`（`web/src/platform/navigation/pages.ts` 的 `parseReaderParams`/`buildReaderParams`，以及首页、详情页的地址） | 没有这个参数 | 认它；带着它时不显示自己的顶栏、品牌、回首页这些和 Studio 重复的东西；页面之间跳转时带着它 |
| 收消息（新） | — | 只在 `embed=studio`、`window.parent !== window` 时听 `message`；只认 `event.source === window.parent`、`event.origin` 是本机回环地址（`http://localhost`、`http://127.0.0.1`、`http://[::1]`，任意端口）、`protocol`/`v` 对得上的；收到 `hello` 记下 origin、按 `theme` 换颜色、回 `ready`（`features` 列出实现了的：`theme`、`navigate`、`quote`）；收到 `theme` 换颜色（不改自己存的设置）；收到 `navigate` 打开 `reader.html?job_id=&page_idx=&block_id=&embed=studio` |
| 阅读页悬停框（`packages/reader/src/pdf/ReaderTextHoverLayer.tsx`，「复制」那一组） | 编号 + 复制 | 握手过（收到过 `hello`）才多一个「摘到笔记」，点了发 `quote`：`job_id`、`document_id`、`title`、`item_id`（四位）、`page_idx`（原文页，0 起）、`source_text`、`translated_text`（取 `reader/regions` 那一项的 `source.text`、`translated.text`）；targetOrigin 是握手记下的 origin，不用 `'*'` |

没在 Studio 里（没有 `embed=studio` 或没握手）时一切照旧，悬停框不出现「摘到笔记」。

---

## 取一个阅读区块（feat/reader-region-item）

2026-11-01。新加的接口，旧的不变。接口说明见 [任务接口分类 · 阅读](../../api/01-任务/04-任务接口分类.md#阅读)。

| 地方 | 加了什么 | 前端用法 |
|---|---|---|
| `GET /api/v1/jobs/{job_id}/reader/regions/{item_id}` | 新接口：一个区块，和 `reader/regions` 的 `items[]` 里同一项一样（`ReaderRegionItem`）；`item_id` 三位、四位都认；还没有区块 404 `not_ready`，没有这一块普通 404 | 阅读页不用改。笔记里引用一段时用它，不用取整本 |

契约：`contracts/reader-data.v1.schema.json` 加端点 `getReaderRegion`。要前端做的只有一件：重新生成
`frontend/packages/api/src/generated`（`api-client-codegen.test.mjs` 的「src/generated 和契约端点表一致」在这之前是红的），
和后端分支配对合进 `main`。

---

## 翻译 agent 的编辑部事件、翻译覆盖带引擎（feat/agent-editorial-events）

2026-10-30。都是新加的，旧字段、旧地址不变。做法见 [编辑部事件接口](../../ops/planning/translation-agent/20261030-编辑部事件接口.md)，
接口说明见 [编辑部事件](../../api/02-进度事件/03-编辑部事件.md)。

| 地方 | 加了什么 | 前端用法 |
|---|---|---|
| `GET /api/v1/documents/{document_id}/translation-coverage` 的 `jobs[]`（`CoverageJobView`） | `engine`：`"legacy"` / `"agent"`（老任务、纯 OCR 任务是 `legacy`）；`has_editorial_events`：有编辑部事件可看 | 翻译站写「翻译 agent · 模型名」；`has_editorial_events` 为真才显示编辑部 |
| `GET /api/v1/jobs/{job_id}/progress/editorial?after=&limit=` | 新接口：`{ events, next_after, has_more }`，事件是 editorial.v1 原样；legacy 任务是空列表 | 进行中每隔几秒带上次的 `next_after` 轮询，`has_more` 为真马上再取；翻完从 `after=0` 取全量回放；`next_after` 比带去的 `after` 小就从 0 重取 |

契约：`contracts/library-documents.v1.schema.json`（`CoverageJobView` 两个新键）、`contracts/job-events.v2.schema.json`
（端点 `listEditorialEvents`，类型 `EditorialEventsQuery`、`EditorialEventListView`、`EditorialEvent`）。

事件和前端解析器 `frontend/web/src/features/editorial-room/domain/events.ts` 的格式一致，另外几处：`page` 是这次跑的第几页（1 起），
通读的请求 `page` 是 0；`run_started` 多一个 `resumed`（续跑时已经做完的页数），续跑会再来一条 `run_started`；`page_done.statuses`
四个键总在。

---

## 删书架旧地址：书架列表、书架删除、合集工作区的 GET 删了（refactor/drop-library-shelf-old-routes）

2026-10-22。前端 `refactor/library-shelf-to-jobs`、`fix/collection-workspace-post` 等分支进了 main（16d13071）以后删的，
做法、留了什么、用量数据见 [删书架旧地址](../../ops/planning/api-reorg/20261022-删书架旧地址.md)。

### 变了什么

| 地址 | 以前 | 现在 | 前端改用 |
|---|---|---|---|
| `GET /api/v1/library/books`（带不带 `job_ids` 都一样） | 书架列表（冻结） | `404` | `GET /api/v1/jobs?job_ids=…&limit=…`（`limit` 1..=500，分批） |
| `DELETE /api/v1/library/books/{job_id}` | 旧地址，OCR 任务 404 | `404`，删不掉任务 | `DELETE /api/v1/jobs/{job_id}` |
| `GET /api/v1/library/books/{job_id}` | 2026-10-19 删了，`405` | `404`（这个路径上一个方法都不剩了） | `GET /api/v1/jobs/{job_id}` |
| `GET /api/v1/collections/{collection_id}/agent-workspace` | 旧地址，行为和 POST 一样 | `405`（同一路径还有 POST），不物化、不碰磁盘 | 同一路径 `POST` |

契约 `contracts/library-books.v1.schema.json`（文件名、`$id` 不变）删了 `LibraryBookListView`、`LibraryBookListItemView`、
`LibraryBookDetailView`、`ListLibraryBooksQuery`、只给单本详情用的 `ArtifactDisplayItemView`（任务详情的同名类型在
`job-status` 契约里，不受影响），和三条书架端点。留着的：`JobListView`、`JobListItemView`、`JobFailureBriefView`、
`JobProgressView` 这些任务列表类型，`LibraryDeleteResultView`（`@retainpdf/api` 的 `deleteJob` 用）、`LibraryDeleteQuery`、
`ListJobsQuery`。`@retainpdf/contracts/library-books` 的生成类型跟着少了这几个。

### 前端要做什么

不用改：后端删之前核对过，`frontend/`（含 `dist` 构建产物）、`backend/ai`、`backend/cli`、桌面脚本里都没有调这三个地址的代码，
`frontend/packages/api/src/types.ts` 只从 `library-books` 导出 `LibraryDeleteResultView`；前端契约测试读的
`JobListItemView`、`JobFailureBriefView`、`JobProgressView`、`JobStageSnapshotView`、两个枚举都还在。

可选（只是注释里的说法，不影响运行）：`frontend/packages/api/src/jobs.ts:127`、`frontend/web/scripts/frontend-homepage-smoke.py:24`、
`frontend/packages/api/README.md:13` 里「书架冻结 / no longer called」可以改成「已删」。

---


## 0000000000. 书库标签残留清掉、`/assets` 两个接口删掉

分支 `chore/drop-tags-and-assets`（2026-10-19）。对应书库审计 A2、B11、B12，决定和取舍见
[删标签残留和资产接口](../../ops/planning/api-reorg/20261019-删标签残留和资产接口.md)。

### 变了什么

1. `POST /api/v1/assets`、`GET /api/v1/assets/:asset_id` 删了（404）。前端没有调用方，不用改。
2. 后端不再提标签：AI 的 `list_documents` 工具去掉 `tag` 参数和结果里的 `tags`；接口目录里书的 PATCH 说明改成「书名、阅读状态」；
   `library-api.md` 去掉 `tag=`、`tags[]`、`tags?`。**接口行为没变**：书列表的 `tag`、PATCH 的 `tags` 照旧被静默忽略。

### 前端要做什么

前端已在 `refactor/drop-document-tags` 改完（那个分支还没合），这里记下对照：

| 文件 | 旧写法 | 新写法 |
|---|---|---|
| `frontend/packages/api/src/documents.ts` | `DocumentListQuery.tag`，非空时 `params.set("tag", …)` | 去掉；`GET /documents` 只发 `limit`、`offset`、`reading_status`、`collection_id`、`q` |
| `frontend/web/src/features/library/domain/documents/update-document.ts` | `payload.tags !== undefined` 时把 `tags` 发给 PATCH 并回填卡片 | 去掉；`PATCH /documents/:id` 只发 `title`、`reading_status` |
| `frontend/web/src/features/library/ui/page/LibraryFilterMenu.tsx` | 按 `item.tags` 过滤（恒为空） | 去掉标签过滤 |

### 以后

前端和 AI 都不发以后（`refactor/drop-document-tags` 合进 main 之后），后端会给书列表的查询参数（`ListDocumentsQuery`）和
PATCH 的请求体（`PatchDocumentInput`）加 `deny_unknown_fields`：再发 `tag`、`tags` 或别的不认识的字段会 400。这一步这次不做。

---
## 000000000. 书架冻结：删单个任务改用 `DELETE /jobs/{job_id}`，书架列表改调 `GET /jobs?job_ids=`

分支 `refactor/library-books-freeze`（2026-10-19）。对应书库接口审计 A1，做法和取舍见
[书架冻结与删任务新地址](../../ops/planning/api-reorg/20261019-书架冻结与删任务新地址.md)，新接口见 [删除任务](../../api/01-任务/05-删除任务.md)。

### 后端变了什么（只增不改，前端现在不改也能用）

1. 新增 `DELETE /api/v1/jobs/{job_id}`（`?force=true` 可选）：删这个任务和它的 `{job_id}-ocr` 子任务，书留着。
   返回和书架删除一样（`deleted`、`job_id`、`removed_paths`、`removed_child_jobs`），409 / `job_has_dependents` / `force`
   的规则也一样；不同的只有：**OCR 任务也能删**（书架删除把它挡成 404），以及单删 OCR 子任务 `P-ocr` 而父任务 `P` 还在时
   409 + `job_has_dependents`。
2. `DELETE /api/v1/library/books/{job_id}` 变成旧地址（接口目录里标了），行为不变。（2026-10-22 删了，见最上面一节。）
3. `GET /api/v1/library/books/{job_id}` 删了（前端、AI、CLI 都没调过）。同一地址还有 DELETE，所以 GET 返回 405。
4. `GET /api/v1/library/books` 冻结：不再加字段，前端改完下面第 1 条以后删。（2026-10-22 删了。）
5. 契约 `library-books.v1` 里 `LibraryBookDetailView` 定义暂留（标了废弃），因为前端还引用它（见下面第 4 条）。（2026-10-22 删了。）

### 前端要改的

1. `frontend/packages/api/src/library-books.ts` 的 `fetchLibraryBookList`（调用方：文档卡片叠加活态
   `features/library/domain/documents/shape-documents-with-books.ts:60`，文件夹 `features/collections/domain/controller.ts:67`）：
   - 旧：`GET library/books?limit=n&offset=0&job_ids=a,b`
   - 新：`GET jobs?job_ids=a,b&limit=n&include_live_stage=true`（`limit` 必须在 1..=500，越界 400；名单超过 500 个分批请求）。
     返回 `JobListView`：`items[]` 是任务列表项，标题用 `display_name`（没有 `title`），阶段和进度在 `items[].stage_snapshot`
     （`stage`、`stage_detail`、`progress`，已有的 `flattenStageSnapshot` 能摊平；终态任务的 `stage_snapshot` 是 `null`），
     `has_more` 表示还有没有下一页。`/jobs` 不排除 OCR 任务，`shape-documents-with-books.ts:70-85` 那段「没命中再逐个
     `GET /jobs/:id` 补」以后基本用不上（可以留着兜底）。
   - mock：`frontend/web/src/platform/mock/index.ts:90` 的 `synthesizeMockBook` 要改成按 `/jobs?job_ids=` 的形状造数据。
2. `frontend/packages/api/src/library-books.ts` 的 `deleteLibraryBook`（调用方 `features/library/domain/recent-jobs/actions.ts:75`，
   只在卡片没有 `document_id` 时走，见 `documents/delete-actions.ts:76`）：
   - 旧：`DELETE library/books/{id}`（`?force=true`）
   - 新：`DELETE jobs/{id}`（`?force=true`），返回形状和错误处理（`error.details.reason`）不变。
     `stripOcrSuffix` 可以留着：传 `-ocr` 子任务编号本来就该删它的父任务；要单删 OCR 任务时别去后缀。
3. 最近任务分页 `features/library/domain/recent-jobs/loader.ts:85`（`fetchLibraryBookList` 选项）→
   `recent-jobs/library-books-resource.ts:29` → `recent-jobs/pagination.ts:81`：没有 `fetchJobList` 时回退调书架列表，
   书架不给 `has_more`，只能靠「短页」猜。改成只用 `fetchJobList`（`GET /jobs`，回包有 `has_more`），去掉这条回退和
   `fetchLibraryBookList` 选项（`app/home/composition/create-runtime-features.ts:196` 已经同时传了 `fetchJobList`）。
4. 契约类型：`frontend/packages/api/src/types.ts:19` 重新导出的 `LibraryBookDetailView`，和
   `frontend/web/tests/contracts/library-books-contract.test.mjs:66` 那条「LibraryBookDetailView 字段存在于契约」的测试，删掉。
   删完告诉后端，后端再从 `contracts/library-books.v1.schema.json` 删这个定义和那条标了 `removed` 的端点。
5. 上面 1、3 都改完、不再调 `GET library/books` 以后告诉后端，后端删书架列表和 `DELETE library/books/{id}` 旧地址。

**已完成**：前端 1–4 都改完进了 main（16d13071），后端 2026-10-22 删了书架列表、`DELETE library/books/{id}` 旧地址、
`LibraryBookDetailView` 和那条端点（`refactor/drop-library-shelf-old-routes`，见最上面一节）。
## 00000000. 合集工作区改用 POST；合集不存在从 200 变 404，编号不合格 400

分支 `fix/collection-workspace-path`（2026-10-19）。对应书库接口审计 A6，决定见
[合集工作区编号校验与 POST](../../ops/planning/api-reorg/20261019-合集工作区编号校验与POST.md)。

### 变了什么

1. 新地址 `POST /api/v1/collections/{collection_id}/agent-workspace`（请求体不用带东西），返回和以前的 GET 一样的清单
   `{ schema, collection_id, books[], skipped[] }`。同一路径的 `GET` 还能用、行为一样，标成旧地址，前端改完后删掉。
   （**已完成**：前端改用 POST，GET 2026-10-22 删了，现在 `405`。）
2. 合集不存在：以前 `200` + 空清单（还在磁盘上建出空目录），现在 `404 collection not found: …`。
3. 编号不是建合集时生成的形状（`col-` + 14 位数字 + `-` + 6 位小写十六进制）：`400 invalid collection_id: …`。
   前端用的都是 `/collections` 列表里拿到的编号，正常走不到。
4. 还没有可读译文的书一律在 `skipped[]`（`reason: "还没有可读的译文"`）；以前会退回书卡的 `active_job_id`，可能链到还在跑的任务。
   一个文件夹超过 200 本时，多出来的也写进 `skipped[]`（以前悄悄少掉）。
5. 删文件夹（`DELETE /collections/{id}`）后，后端清掉它的工作区目录。响应不变。

### 前端要做什么

- `frontend/web/src/features/reader/domain/terminal-scope.ts:91` 的 `ensureCollectionWorkspace`：
  旧写法 `` fetchJson(`/api/v1/collections/${encodeURIComponent(collectionId)}/agent-workspace`) ``（GET）；
  新写法同一路径改成 `POST`。`fetchJson` 现在只发 GET（定义在 `frontend/web/src/features/reader/ui/terminal-chrome.tsx`，
  `fetch(new URL(path, baseUrl), { headers: { "X-API-Key": apiKey } })`；第 150 行把它传给 `ensureCollectionWorkspace`），
  要给它加一个方法参数，或者另传一个发 `method: "POST"` 的函数。
  对应测试 `frontend/web/tests/reader/terminal-scope.test.mjs` 跟着改。（**已完成**，前端已经发 POST。）
- 404 不用专门处理：`fetchJson` 遇到非 OK 抛 `HTTP 404`，`ensureCollectionWorkspace` 已经把它当失败原因显示、不切范围。
  如果想给出中文提示，可以对 404 说「这个文件夹已经不存在了」。
- `skipped[]` 的 `reason` 文字变了（只给 agent 和人看，前端没有按它判断），不用改。

---

## 0000000. 还没产出：404 带 `error.details.reason = "not_ready"`，任务不存在是不带 reason 的 404

分支 `fix/not-ready-404`（2026-10-19）。对应审计 C3、D2，规矩见 [错误约定](../../api/00-约定/02-认证与错误.md#还没产出404)，
逐个接口的改前改后见 [实现记录](../../ops/planning/api-reorg/20261019-还没产出返回404实现记录.md)。

### 变了什么

1. 原始文件和报告（`/jobs/{id}/files/output|pages|internal/…`、`reader/markdown`、`reports/translation|translation-qa|layout-fit|refine`、
   `translations/{item}` 及修订历史 / 改写 / 重翻）：任务在、东西还没产出时 `404` + `error.details.reason = "not_ready"`，
   `message` 统一成 `<名字> not ready`（如 `translated.pdf not ready`，不再带任务编号）。原来就是 404，只是多了 `reason`、换了措辞。
2. 任务不存在：照旧 `404`，`error.details` 是 `{}`，`message` 是 `job not found: …`。
3. 状态码变了的只有三处：
   - `files/output/all.zip` 任务没成功时 `409 job is not finished successfully` → `404` not_ready `all.zip not ready`；
   - `GET /jobs/{id}/translations` 还没有翻译清单时 `404` → `200` 空列表；
   - `reports/quality`、`reports/quality/items`、`data`、`data/{dataset}` 在任务还没有输出目录（排队中）时 `404 job has no output directory` → `200`
     （各段 `null`、空清单、`available: false`）。
4. 阅读器会碰到的地址（`/jobs/{id}`、`files`、`reader/regions`、`reader/metadata`、`reader/markdown`、`files/output/ocr.md`、`ocr/images/…`、
   `translated.pdf`、`/documents/{id}/files/source.pdf`、`/documents/{id}/reading`、`progress/layout`、`progress/pages/{page}`、`ai/board`）
   状态码**都没变**；其中 `reader/markdown`、`ocr.md`、`ocr/images/…`、`translated.pdf` 没产出时多了 `reason: "not_ready"`。
   边翻边看的 `error.code`（`LIVE_TRANSLATION_LAYOUT_NOT_READY` 409、`LIVE_TRANSLATION_PAGE_NOT_COMMITTED` 404）没动。

### 前端要做什么

- `frontend/packages/reader/src/hooks/reader-session/session-load-plan.ts` 的 `isStaleDocumentJobFailure`：
  旧写法 `input.status === 404 && !input.jobId && …`，正在跑的书拿到译文 PDF 的 404 也会被当成"任务丢了"退回原文；
  新写法加一条 `&& input.reason !== "not_ready"`，`session-assets.ts`（约 458 行）调用时把错误体里的 `error.details.reason` 传进去
  （抛出的错误要带上响应体里的 `reason`）。不改也不会比现在差：这些地址原来就是 404。
- `frontend/packages/api/src/translation-debug.ts`（可选）：`fetchTranslationDiagnostics`、`fetchTranslationItem` 现在 404 一律说
  「未找到…请确认已完成翻译」；可以按 `reason === "not_ready"` 说「还没生成」，没有 `reason` 说「任务不存在」。
  `fetchTranslationItems` 的 `404 → 空列表` 分支以后只在任务不存在时走到，不改也对。
- `all.zip`：前端没有按 409 判断，不用改。质量卡、取数在排队任务上从报错变成空状态，不用改。
- 判断"还没好"只看 `error.details.reason`，不要匹配英文 `message`（措辞已经变了：`pdf not ready: <id>` → `translated.pdf not ready`、
  `markdown not found: <id>` → `markdown not ready`、`refine report not found: <id>` → `refine report not ready`……）。

---

## 000000. 删除要顾到别的任务：强删先取消，被引用的任务不能直接删，删任务清全文索引

分支 `fix/force-delete-stops-runner`（2026-10-19）。对应状态一致性审计 1-#5、2-#1/#2/#4。

### 变了什么

1. `DELETE /library/books/{job_id}?force=true` 和 `DELETE /documents/{document_id}?force=true`：删之前，对其中排队 / 运行中的任务
   先走和 `POST /jobs/{job_id}/actions/cancel` 同一条路径（登记取消 + 终止 worker 进程），再删行删目录。以前强删既不取消也不杀进程，
   worker 继续花 OCR / 模型的钱，runner 的下一次落库还把已删的任务写回来（没有 `document_id` 的幽灵任务）。
   现在 runner 的落库写（CAS）在行不存在时不再 INSERT，runner 见到行没了会终止 worker 并收手。响应形状不变。
2. **新的 409 原因 `job_has_dependents`**：`DELETE /library/books/{job_id}` 删某个任务时，如果删除范围（该任务 + 它的 `-ocr` 子任务）之外
   还有别的任务在用它的产物（`request_payload.source.artifact_job_id` 指向它，典型是「换字体重新排版」产生的 render 任务，
   译文目录就是源任务的 `translated/`），返回 `409` + `error.details.reason = "job_has_dependents"`，message 里列出依赖者的编号，什么都不删。
   以前照删，之后整本书的 `/documents/{id}/reading` 因为找不到译文目录返回 500。带 `?force=true` 仍然放行（调用方明确要删）；
   `DELETE /documents/{id}` 整本删除时依赖者本来就在删除范围内，不受影响。原地重新渲染的任务引用自己，不算依赖。
3. 删除任务时同时清掉它在全文索引里的行（`blocks_fts`），再按这本书剩下的成功任务重建索引；搜索不再命中已删的任务。

### 前端要做什么

**不用改代码**（前端没有传 `force`；删书走的是 `DELETE /documents/{id}`，不会撞到 `job_has_dependents`）。
如果以后用删单个任务的接口（现在是 `DELETE /jobs/{job_id}`；书架的 `DELETE /library/books/{job_id}` 2026-10-22 删了）：遇到 `reason === "job_has_dependents"` 提示「先删除依赖它的任务（message 里有编号）」，
不要自动加 `force`。

---

## 00000. 请求体里不认识的字段一律 400

分支 `fix/unknown-fields-400`（2026-10-19）。所有用 `ApiJson` 读、目标类型 `deny_unknown_fields` 的请求体（邀请码、agent 会话、
译文修订 PATCH、retry-stage、resolve-ocr-ambiguity……），遇到不认识的字段从 `422 UNPROCESSABLE_ENTITY` 改成 `400 BAD_REQUEST`，
message 形如 ``unknown field `x`, expected one of ... in the request body``（只带字段名，不带值）。字段类型不对、缺字段、
枚举值不认识仍是 `422`。前端核对过没有地方按 `422` 判断，不用改。

## 0000. 任务操作被拒：状态不允许一律 409，带 `error.details.reason`

分支 `fix/actions-409-reasons`（2026-10-19）。对应审计 B1、B8。规矩见 [错误约定](../../api/00-约定/02-认证与错误.md)。

### 变了什么

1. **状态码**：任务或产物的当前状态不允许 = `409`；请求本身写错了 = `400`。
   以前 `retry-stage`（ocr / translation / render，含原地重渲染）和 `resume`/`rerun` 在「任务在跑」「产物不在」时返回 `400`，
   只有精修和取消返回 `409`。现在这些全是 `409`。仍是 `400` 的：`mode` 不支持、`refine` 对象放在非 refine 阶段、
   `create_new_job=false` 用在 ocr / translation、`create_new_job=true` 用在 refine、`overrides` 不合法、请求体里有不认识的字段。
2. **稳定原因**：每个任务操作的 `409` 都有 `error.details.reason`（信封其他部分不变）：

   | `reason` | 什么时候 | 接口 |
   |---|---|---|
   | `job_active` | 任务在排队/运行，先取消 | retry-stage（所有阶段）、resume/rerun、resolve-ocr-ambiguity |
   | `job_not_active` | 取消一个不在跑的任务 | cancel |
   | `artifacts_missing` | 要用的产物或原始来源不在 | retry-stage、resume/rerun |
   | `translations_not_owned` | 精修的任务渲染的是别的任务的译文 | retry-stage refine |
   | `ambiguous_ocr_dispatch` | OCR 派发结果不确定：走 resolve-ocr-ambiguity（绑定回执或接受重复风险），不要引导去重试翻译 | retry-stage（ocr）、resume/rerun |
   | `ambiguous_translation_request` | 翻译请求结果不确定：重复风险确认后 retry-stage(translation) + accept_duplicate_risk | retry-stage（translation）、resume/rerun |
   | `request_journal_corrupt` | 翻译请求日志损坏，确认也修不好 | retry-stage translation、resume/rerun |
   | `model_executor_unsupported` | 绑定了 Rust 模型执行器，这条旧路径不支持 | retry-stage、resume/rerun |
   | `stale_resolution` | OCR 歧义的 `resolution_revision` 过期，或被别的请求处理了 | resolve-ocr-ambiguity |
   | `no_ocr_dispatch` | 没有可处理的 OCR 歧义（既不是失败也不是已取消，或没有派发记录） | resolve-ocr-ambiguity |
   | `ocr_dispatch_unsupported` | 该服务商/操作不支持绑定收据 | resolve-ocr-ambiguity |

   `reason` 只增不改，不认识的值按「状态不允许，看 `message`」处理。
3. **GET 里同一套值**（只增字段）：`GET /jobs/:id/actions` 每个阶段多 `disabled_code`（`disabled_reason` 为空时是 `null`；
   翻译阶段在请求结果不确定时 `can_retry` 仍为 true、`disabled_code` 是 `ambiguous_translation_request`）；
   `GET /jobs/:id/actions/resume` 多 `reason_code`（能续跑时 `null`）。
4. **`retry-stage` 和 `resolve-ocr-ambiguity` 的请求体不认识的字段返回 `400`**（message 形如 ``unknown field `createNewJob`, expected one of ...``）。
   后端自己在 `GET actions` 里给的 `action.body` 都在可用字段内（有测试锁）。可用字段：`stage`、`mode`、`create_new_job`、`overrides`、
   `ambiguous_request_policy`、`refine`。
5. 翻译请求日志损坏（`request_journal_corrupt`）时，`GET actions` 里 translation 的 `can_retry` 现在是 `false`（以前是 `true`，点了必 409）。

### 前端要做什么

- `frontend/web/src/features/job-detail/domain/dialog/resume-actions.ts` 的 `isAmbiguousTranslationRerunError` 和
  `page/resume.ts` 里调用它的地方：现在靠正则匹配 `409` 和英文 `translation request outcome is ambiguous` 判断。
  改成读错误体：`error.details.reason === "ambiguous_translation_request"`（需要把 `ApiError` 里的响应体带出来）。
  OCR 的歧义是另一个值 `ambiguous_ocr_dispatch`，处理办法是 resolve-ocr-ambiguity，不能走翻译的重复风险确认。损坏的日志是 `request_journal_corrupt`，**不要**再给「接受重复风险」的入口。
  这两处不改也能用：消息文字没变，旧写法仍然匹配；改了以后不再依赖英文措辞。
- 凡是判断「任务在跑」的，用 `reason === "job_active"`，不要看 `message`。
- OCR 歧义现在在默认的 book/翻译任务上也认得出来（以前 OCR 派发记录挂在 `<id>-ocr` 子任务上，按任务编号查不到）：
  `GET /jobs/{id}/reports/failure` 的 `ocr_ambiguity` 会对这类失败任务给出值，`retry-stage`（ocr）和 `rerun` 会返回
  `409 reason=ambiguous_ocr_dispatch`，`resolve-ocr-ambiguity` 对它们可用。提交出错（超时、断连）和上传中途取消、
  进程在回执落库前重启，都会让派发记录变成 ambiguous。前端不用改；已经按 `ocr_ambiguity` 出处理入口的页面，会在这些任务上多出现该入口。
- `retryJobStage` 之类别往请求体里夹 `retry-stage` 不认识的字段（书籍元数据等），否则 `400`。后端侧已核对过目前发的只有
  `stage`、`mode`、`create_new_job`、`overrides`、`ambiguous_request_policy`、`refine`。
- 以前依赖「在跑 / 产物不在返回 400」的分支改看 `409`。

---

## 000. 续跑的正名是 `actions/resume`，任务视图加了 `actions.resume`

分支 `refactor/actions-resume-canonical`（2026-10-19）。只增不改。

- `POST /api/v1/jobs/:job_id/actions/rerun` 和 `actions/resume` 一直是同一个处理函数，现在在登记表里标成旧地址，行为不变，旧地址照常能用。
- 任务视图的 `actions` 加了 `resume`：`{enabled, method: "POST", path: ".../actions/resume", url}`，`enabled` 和 `rerun` 相同。`actions.rerun` 先留着、同值。
- 契约：`contracts/job-status.v1.schema.json` 的 `JobActionsView` 加了必有的 `resume`。
- 前端要改的：把读 `actions.rerun.url`、`actions.rerun.enabled`、调 `rerunJob` 的地方改成 `actions.resume`。等前端不再用 `rerun` 以后，后端删掉旧地址和 `actions.rerun`。

## 00. 列表项的 `failure` 进了契约：job-failure-brief 契约测试可以改比 schema

分支 `feat/contract-job-failure-brief`（2026-10-18）。JSON 不变，只是把一直存在、但没人描述过的 `failure` 补进契约。

- 定义：`contracts/library-books.v1.schema.json#/definitions/JobFailureBriefView`；`job-status.v1.schema.json` 里有结构相同的一份（两份由 `contracts/tests/job-definitions-parity.test.mjs` 锁一致）。（2026-10-23 `library-books` 那份和这条测试删了，只看 `job-status.v1`。）
- `JobListItemView.failure` 是**可选**属性（只有失败的任务才有，成功、进行中的整个键不出现，不是 null）。
  `JobFailureBriefView` 的 `category`、`stage`、`retryable`、`summary` 必有；`root_cause`、`suggestion`、`provider` 没有时键也不出现。
- 生成的 TS 类型已更新：`@retainpdf/contracts/library-books` 和 `/job-status` 都导出 `JobFailureBriefView`，`JobListItemView.failure?: JobFailureBriefView`。（2026-10-23 起只有 `/job-status` 导出。）
- 前端要改的：`frontend/web/tests/contracts/job-failure-brief-contract.test.mjs` 现在读 `backend/packages/retainpdf-jobs/src/views/job_types.rs`
  抠字段；改成对照上面这个 definition 的 `properties` / `required`，不再读 Rust 源码（这条由前端会话自己改，后端不动 `frontend/`）。
  `frontend/packages/domain` 里手写的失败简报类型也可以换成生成的 `JobFailureBriefView`。
- 后端侧有测试锁：`backend/api/src/api_tests/job_view_contract.rs` 的 `failed_job_list_item_failure_matches_published_schema`
  用真实路由取失败任务的列表项，`failure` 的键集合必须等于这个 definition。

## 0. 三阶段（OCR / 翻译 / 渲染）展示：数据够用了，但要读对地方

后端提交：`364aaaf9` `b575906e` `c85ff4af` `fce89bcc`

### 必须改代码的只有一处

`JobStageTiming` 新增两个 **required** 字段,生成的 DTO 已同步
(`@retainpdf/contracts` → `contracts/dist/job-status.d.ts`):

```ts
export interface JobStageTiming {
  stage: string; detail: string | null;
  enter_at: string; exit_at: string | null;
  duration_ms: number | null;
  terminal_status: JobStatusKind | null;
  progress_current: number | null;   // ← 新增，required
  progress_total: number | null;     // ← 新增，required
}
```

只读不构造的地方不受影响。**手工构造完整对象的地方**(测试 fixture、mock 数据
最可能)TypeScript 会报缺字段,填 `null` 即可。

同理 `RuntimeInput` 早先加过 `no_output_timeout_seconds`(也是 required,填 `0`)。

### 各读哪里

| 要显示什么 | 读哪里 |
|---|---|
| 现在在哪一段、进行到哪 | `stage_snapshot`(带 `stage` + `substage`)+ `stages.*.state` |
| 实时推送 | `GET /api/v1/jobs/:id/live-events`(SSE 长连接) |
| 细阶段流水 | `GET /api/v1/jobs/:id/events`，按 `display_stage` 分组、过滤 `lane=main` |
| **完成后回顾各段耗时与进度** | `runtime.stage_history`(新的 `progress_current/total`) |

**不要用 `stages.*.progress` 做完成后的回顾**——它只反映当前活跃阶段的瞬时
快照,阶段一结束就回到 null。这是有意为之:`stages` 回答「现在怎么样」,
`stage_history` 回答「当时怎么样」,两个问题两个地方。

另一个做法(终态回填 `stages.*.progress`)被否掉了:那样失败任务会显示
「translation: 30/50」,看上去像还在跑、实际是死在了 60% 处,前端必须同时读
`state` 才能判断这个数是活的还是死的。

### 事件长这样（字段是为三段展示设计的）

```jsonc
{ "display_stage": "ocr",              // 三段归属：ocr / translation / render
  "stage": "ocr_result_ready",         // 细阶段（全流程 15 个）
  "substage": "done",
  "lane": "main",                      // main / diagnostic / background
  "stage_detail": "Paddle 正在解析文件，第 4/4 页",   // 中文，可直接展示
  "provider": "paddle", "provider_stage": "done",
  "progress": { "unit": "step", "current": 4, "total": 4, "percent": 100.0 },
  "elapsed_ms": 0,
  "raw": { "source_kind": "ocr_child" } }              // 子任务事件已并入父流
```

三段各自的细阶段:

| 段 | 细阶段 |
|---|---|
| OCR | `ocr_submitting` → `ocr_upload` → `ocr_processing` → `ocr_result_ready` → `normalizing` |
| 翻译 | `translating` → `translate` → `continuation_review` → `page_policies` → `garbled_repair` |
| 渲染 | `rendering` → `render_prepare` → `render_preprocess` → `render` |

### 不用改代码，但行为变对了

- **`stage_history` 顺序修正**。以前是
  `translating → finished → rendering → failed`——「完成」夹在「渲染中」前面,
  没法按顺序画时间线。现在是 `translating → rendering → finished`。
  若之前为这个乱序写过绕过逻辑,可以删了。
- **进度文案不再自相矛盾**。以前会出现「进度 100% · 正在开始翻译」
  (数字来自 durable checkpoint、文字是阶段入场语),现在两者同源。
- **渲染阶段不再顶着翻译的进度**。归档刚上线时 rendering 和 finished 会带着
  翻译的 `59/59`(那是文本块数,不是页数),已修。

### 一个仍然存在的不一致

`stages.render.progress` 在任务结束后常残留一个 `2/3`,而 ocr / translation
是 null。那是 `background_snapshots` 里的残影,不是渲染的真实进度。**画完成后
的回顾一律走 `stage_history`**,就不会碰到它。

---

## 0.5 阅读视图分段读 markdown：用 HTTP Range，不新增端点

后端提交：`perf(api): markdown 原文改走文件流，直接支持 Range`

### 结论先说

你提案里的 `/markdown/metadata` 和 `/markdown/chunks` 两个端点**都不做**，
改用已有的 `GET /api/v1/jobs/:job_id/markdown?raw=true` + 标准 HTTP `Range`。

后端 API 已经 113 个,markdown 一个资源就占 3 条。加两条自定义端点去做一件
HTTP 本来就定义了的事,不划算。

### 为什么 metadata 端点不做

它的每一个字段,job detail 的 `artifacts.markdown` 里都已经有了:

| 提案的 `MarkdownMetadataView` | 已有的位置 |
|---|---|
| `ready` | `artifacts.markdown.ready` |
| `total_bytes` | `artifacts.markdown.size_bytes` |
| `raw_path` / `raw_url` | `artifacts.markdown.raw_path` / `raw_url` |
| `images_base_path` / `images_base_url` | 同名字段 |
| `chunks_path` | 不再需要 |

而且 `Content-Range: bytes 0-262143/620000` 的分母就是总字节数,第一次请求
就拿到了,连预先查一次都不用。

### 为什么 chunks 端点不做

`stream_file` 早就实现了完整的 Range(解析头、`206`、`Content-Range`、
`Accept-Ranges`、seek + 流式读),只是 markdown 这条路没接上——它原先把整篇
`read_to_string` 进堆再整个返回。现在接上了,顺带修掉了那次整篇读入
(实测最大的 `full.md` 是 620 KB)。

你否掉 Range 的理由是「按字节切会切到行/多字节字符中间,前端拼行更麻烦」。
多字节那半在浏览器里不成立:`TextDecoder(..., { stream: true })` 就是为跨块
序列设计的,是内置能力。行边界那半确实要前端做,但只有几行。

### 前端要怎么用

```js
const res = await fetch(rawUrl, {
  headers: { ...apiHeaders, Range: `bytes=${offset}-${offset + WINDOW - 1}` },
});
// 206；Content-Range: bytes <start>-<end>/<total>
const total = Number(res.headers.get("Content-Range").split("/")[1]);
const etag = res.headers.get("ETag");
```

两件必须自己做的事:

1. **字符边界**：整段读取过程共用**一个** `TextDecoder`,每次
   `decoder.decode(bytes, { stream: true })`。**不要**每段单独解码——那会在
   跨块的多字节字符上出乱码。
2. **行边界**：一段可能停在行中间,会把代码块 / 表格行 / 公式劈开。把最后一个
   `\n` 之后的残余留下,拼到下一段开头再交给渲染。

**版本检测**：比对各段的 `ETag`(size + mtime)。正文由 pipeline 一次性整篇写出,
当前没有任何路径会就地改写它(非 render 的 rerun/retry 都建新 job;render 就地
重跑只动 `rendered/` 里的译文 PDF),所以偏移量在实践中是稳定的——但那是当下 job 生命周期的
性质,不是这个端点给的保证。`ETag` 中途变了就从 0 重来,否则拼出来的是两个版本
的混合,而且是静默的。也可以直接用 `If-Range`。

### 几点提醒

- 图片仍是正文里的原始相对路径(`images/...`),用 `images_base_url` 解析。
  **复用 `frontend/packages/domain/src/job/artifacts.ts` 的
  `resolveMarkdownAssetUrl`,别在新数据层里重写一遍**——它第 281 行那个
  `while (rel.startsWith("images/"))` 是在剥双重前缀(`images_base_url` 已经
  以 `/images/` 结尾,而正文里写的是 `images/x.png`),漏掉就是 404。
- 不带 `Range` 时行为不变:`200` + 整篇,旧调用方不受影响。
- `/markdown/document` 保留。但阅读器迁走后它只剩 job-detail 页在用,而它贵在
  两处:整篇正文返回两份(原文 + 图片链接重写版),外加 `walkdir` 遍历整个 images
  目录逐个 stat + mime_guess。**如果 job-detail 那边也能改用 `?raw=true`,这条
  端点就可以删掉**,markdown 从 3 条端点收敛到 2 条。要不要做由你定,后端这边
  随时可以配合。

---

## 1. 收藏挡住删除 → 结构化 409 + 清空收藏端点

> 已撤销：收藏功能 2026-09 整体删除，`DELETE_BLOCKED_BY_FAVORITES` 和清空收藏的端点后端都已删掉（`chore/drop-favorites-errors`），
> 前端处理它的代码、批量删除的「一并删除收藏」二次确认也已删（`refactor/drop-favorites-leftovers`）。删除现在只在还有排队或运行中的任务时返回 409，见
> [图书馆数据层 API](library-api.md) 的「删除保护」。下面保留原记录。

后端提交：`feat(library): 收藏挡住删除时返回结构化 409，并给出清空收藏的端点`

### 变了什么

删除文档 (`DELETE /api/v1/documents/:document_id`) 或删除馆藏图书
(`DELETE /api/v1/library/books/:job_id`) 被收藏锚点挡住时，409 的响应体从
「一句中文 message」变成了带 `error.code` 和 `error.details` 的结构化错误。

同时新增两个端点，用来一次性清空收藏。

### 前端要做什么

**别再从 message 里正则抠数字。** 那句话会随文案改动和多语言而变。

```jsonc
{
  "code": "DELETE_BLOCKED_BY_FAVORITES",
  "message": "document is referenced by 2 favorite(s); remove the favorites first",
  "error": {
    "code": "DELETE_BLOCKED_BY_FAVORITES",
    "http_status": 409,
    "details": {
      "scope": "document",              // 或 "job"
      "document_id": "6f1c…",           // scope=job 时是 job_id
      "favorite_count": 2,
      "clear_favorites_path": "/api/v1/documents/6f1c…/favorites"
    }
  }
}
```

文档级和 run 级**共用同一个错误码**，因为前端要做的事一模一样，只有清空目标
不同，而那个目标已经在 `clear_favorites_path` 里给好了。所以只需要一个分支：

> 读 `favorite_count` → 提示用户「该文档有 N 条收藏，是否一并删除？」
> → 确认后 `DELETE clear_favorites_path` → 重试原来的删除

`DELETE clear_favorites_path` 返回 `{"data": {"deleted_count": N}}`。

几个边界：

- 幂等：目标存在但没有收藏时返回 `deleted_count: 0`，不是错误
- 目标不存在是 **404**，不要和上一条混为一谈
- `force=true` **不绕过**收藏保护，它只绕过「运行中的任务不可删」
- run 级的清空会连 `{job_id}-ocr` 子任务的收藏一起清（因为它解锁的那次删除
  会连着删子任务），所以清一次就够，不会出现「重试又 409」

详见 [图书馆数据层 API](./library-api.md#两个必须处理的边界)。

---

## 2. 新增 `no_output_timeout_seconds`（空闲超时）

后端提交：`fix(jobs): 给 worker 输出收尾加上限…` 之后的空闲超时提交

### 变了什么

任务提交的 `runtime` 块多了一个字段：

```jsonc
"runtime": {
  "timeout_seconds": 1800,
  "no_output_timeout_seconds": 0    // 新增，0 = 关闭（默认）
}
```

`timeout_seconds` 是整段执行的上限，必须按最坏情况给——一本大部头翻译几小时
是正常的，阈值就得设到几小时。于是「打完第一行就卡住不动」这种情况也要等满
那几小时才被发现。

`no_output_timeout_seconds` 独立地盯「还在不在动」：每收到一行 stdout 就重新
计时，只有 worker 彻底不出声才触发。

两者都判为 `failed` / `process_timeout`（处置方式一样），但 `stage_detail` 不同：

| 触发者 | `stage_detail` |
|---|---|
| `timeout_seconds` | `provider timeout`（normalizing 阶段是 `normalization timeout`） |
| `no_output_timeout_seconds` | `no output for {N}s` |

**这个区分是给用户看的**：前者要调阈值或降并发，后者要查上游是不是不回包了。
如果前端有失败原因的展示或文案映射，`no output for {N}s` 需要一条对应的说法。

校验：负数会被 400 拒绝（`no_output_timeout_seconds must be zero (disabled) or
a positive integer`）；`0` 和正数都放行。

### 前端要做什么

**默认关闭，所以不改也不会坏。** 想让用户能设它的话，要改两处字段白名单——
它们是手写的列表，不是从 `@retainpdf/contracts` 的类型生成的：

- `frontend/packages/api/src/jobs-submit.ts` 的 `legacyTopLevelFields`
  （在 `"timeout_seconds"` 旁边加 `"no_output_timeout_seconds"`）
- `frontend/web/src/platform/api/legacy/jobs-submit.ts`：第 33 行附近的字段
  数组，以及第 101 行附近 `appendFormField(form, "timeout_seconds", …)` 那句
  旁边补一句同形的

（原来 multipart 的 `/api/v1/translate/bundle` 也接受同名的扁平字段，该接口已于 2026-10-19 删除，
只剩 JSON 的 `runtime` 块。）

生成的 DTO 类型 `@retainpdf/contracts` 的 `RuntimeInput` 已经带上这个字段
（`contracts/dist/job-status.d.ts`），是 **required**——如果哪里在手工构造
完整的 `RuntimeInput` 对象，TypeScript 会要求补上，填 `0` 即可。

详见 [创建任务](../../api/01-任务/01-创建任务.md) 的
「超时」一节。

---

## 3. 取消语义：normalizing 不再豁免

后端提交：`fix(jobs): 取消一律终止进程，normalizing 不再豁免`

### 变了什么

此前 OCR 任务在 `normalizing` 阶段点取消，后端会**跳过杀进程**，让它跑完。
结果是用户点了取消，任务却继续显示 running 直到自然结束。现在取消一律终止进程。

### 前端要做什么

**不用改代码**，但有一个时序需要知道：

OCR 专用的取消 (`POST /api/v1/ocr/jobs/{job_id}/cancel`) 只在任务还是
`queued` 时由它自己写终态行。过了这个点，它杀进程，终态由 runner 观察到进程
退出后写入。所以**取消后立刻轮询，可能还会读到一次 `running`**。

如果现在的实现是「取消成功 → 立即认定已取消 → 停止轮询」，那会显示不一致；
应该继续轮到状态真的变成 `canceled`。这个时序在改动前后都存在（改动前更糟：
它可能永远不变），只是现在窗口很短。

详见 [续跑、取消与 OCR 歧义处理](../../api/06-阶段操作/03-续跑取消与OCR歧义.md)。

---

## 重启后翻译自动续跑先看请求日志（fix/translation-resume-journal-gate）

后端提交：`fix(runner): 重启后翻译自动续跑先看请求 journal，结果不明就落 failed`

### 变了什么

API / jobsd 重启时，翻译阶段运行中的任务以前一律自动续跑，续跑的 Python 会把重启前在途、结果不明的请求原样再发一遍（可能重复计费），而手动重试要用户确认。
现在：请求日志里有「已发出、没有终态」的请求（或日志读不了）时，任务不再自动续跑，落成 `failed`，`failure_code = translation_request_ambiguous`，
`translation_request_recovery.requires_confirmation = true`。日志干净或没有日志时仍自动续跑。

### 前端要做什么

**不用改代码。** 失败任务走的就是已有的歧义路径：`GET actions` 里 translation 的 `can_retry=true`、`disabled_code=ambiguous_translation_request`，
`retry-stage` 不带 `accept_duplicate_risk` 返回 409 `ambiguous_translation_request`。`failure_code` 是新增的取值，前端按「不认识的值显示 `summary`」处理即可。

---

## 数据库恢复后对账、自动续跑次数上限（fix/recover-after-restore-and-crash-loop）

### 变了什么

1. **数据库恢复**（`POST /api/v1/backups/{id}/restore`）：备份时在排队 / 运行的任务，以前恢复出来一直是 running（没人在跑，一直转圈、rerun 409）。
   现在恢复时清掉它们的旧 pid，并立即按重启时的规则对账：有断点的回到 `queued` 自动续跑，没有的落 `failed`（`failure_code = worker_process_missing`）。
   任务跑在 jobsd 里时由 jobsd 的巡检接手，最多约 2 分半。接口的请求、返回都没变。
2. **自动续跑次数上限**：同一次运行连续 3 次自动续跑都没有新进度就又中断，第 4 次不再续跑，任务落 `failed`，
   `failure_code = auto_resume_limit_exceeded`（`failure_category=internal`、`retryable=true`、`resume_from=null`），
   `summary`「自动续跑次数超过上限，疑似导致运行时崩溃」，`recovery_hint` 提示先看日志再手动重试。

### 前端要做什么

**不用改代码。** 恢复后本来就要整页刷新，任务列表读到的就是对账后的状态。`auto_resume_limit_exceeded` 是新增的 `failure_code` 取值，
现有的失败弹窗按 `summary` / `recovery_hint` 显示（`failure-recovery.ts` 优先用后端的 `recovery_hint`），重试按钮照 `retryable` 和 `GET actions`。

详见 [失败结构](../../api/08-调试诊断/01-失败结构.md)、[数据库备份](../../api/10-备份/01-数据库备份.md)。

---

## 书的图跟着原文走、合并阅读过期带 reason（fix/library-media-freshness）

2026-10-19。决定和取舍见 [书库媒体新鲜度与合并阅读](../../ops/planning/api-reorg/20261019-书库媒体新鲜度与合并阅读.md)。

### 变了什么

1. **书的封面、缩略图、原文页**（`/documents/{id}/files/cover.jpg`、`thumbnail.jpg`、`pages/{page}.jpg`）：原文换了版本（Agent 文档操作提交）以后
   按新原文重新渲染（以前封面、缩略图一直是旧图）。响应头统一成 `Cache-Control: private, max-age=0, must-revalidate`
   （以前封面、缩略图 `private, max-age=86400`，原文页 `private, max-age=31536000, immutable`），`ETag` / `Last-Modified` 照旧，没变回 304。
   地址没变。
2. **合并阅读的虚拟任务 id**（`/documents/{id}/reading` 返回的 `merged-<书>-<指纹>`）：合并目录改成超过一天**没人读**才清理（以前按生成时间，
   正在读的也会被删）。清理以后拿着旧 id 的读请求仍是 `404`、`message` 仍是 `job not found: merged-…`，多了
   `error.details.reason = "merged_reading_expired"`。真不存在的普通任务还是不带 reason 的 404。
3. **翻译覆盖**（`/documents/{id}/translation-coverage`）：页数改成和阅读入口一样数原文 PDF。只有老数据（书没记页数）会变：
   `page_count`、`segments` 以前是 0 / 空，现在是实际页数。

### 前端要做什么

- 第 1、3 条**不用改代码**。
- 第 2 条可选（不改的话和现在一样：显示加载失败）。`frontend/packages/reader/src/hooks/reader-session/session-assets.ts` 的 `load()` catch 块
  （约 455 行，`isStaleDocumentJobFailure` 判断前后）：旧写法是 404 只在「书的链路、没有显式 job」时退回原文，显式的 `merged-…` 直接 `failBoot`；
  新写法加一个分支：`status === 404 && reason === "merged_reading_expired" && sessionJobId.startsWith("merged-")` 时，从 id 里取书的编号
  （`merged-` 后面 64 位十六进制），调 `fetchDocumentReading(apiPrefix, documentId)`（`frontend/packages/api/src/documents.ts:213`），
  拿到新的 `job_id` 就按它重新打开阅读器（和 `ReaderNavigation.tsx` 里 `buildReaderPageUrl(jobId, anchor)` 一样），拿不到（`null`）退回按书读原文。
  `session-load-plan.ts` 里可以照 `isStaleDocumentJobFailure` 加一个纯函数 `isExpiredMergedReading({ status, reason, sessionJobId })` 方便测。

## 书库列表分页、不认识的字段 400（fix/library-paging-and-unknown-fields）

2026-10-22。决定和调用方核对见 [书库列表分页与未知字段](../../ops/planning/api-reorg/20261022-书库列表分页与未知字段.md)。

### 变了什么

1. `GET /documents` 多了 `limit`、`offset`、`has_more`（带 `job_id` 时也有，`has_more` 恒为 false）；`GET /search`、
   `GET /documents/{id}/metadata-suggestions` 多了 `limit`、`has_more`。旧字段不变。
2. 这三个列表 `limit` 越界改成 400（以前静默夹）：`/documents` 1..=500，`/search`、元数据建议 1..=100。
3. `/documents` 排序加第二键 `document_id DESC`，同一秒入库的书翻页不再重复或漏掉。
4. `GET /documents/{id}/jobs` 的 `has_more` 改成多取一条判断；`total` 不变。
5. 不认识的字段一律 400：`GET /documents`、`/search`、元数据建议列表、书的任务列表的查询参数；`PATCH /documents/{id}`、
   `POST /collections`、`PATCH /collections/{id}`（`parent_id` 也 400）、`POST /collections/{id}/documents` 的请求体；
   `DELETE /documents/{id}` 的查询参数。查询串的 message 是 ``unknown field `x`, expected ... in the query string``。
   书架（`/library/books`）冻结，不收紧（2026-10-22 整个删了）。

### 前端要做什么

不用改：前端现在发的参数（main、`refactor/library-shelf-to-jobs`、`fix/collection-workspace-post` 都看过）没有一个会被新 400 打到，
最大的 `limit=500`（合集页）正好是上限。可选：

| 文件 | 现在 | 可以改成 |
|---|---|---|
| `frontend/web/src/features/library/domain/documents/document-library-source.ts` | `hasMore = offset + documents.length < total` | 读 `payload.has_more`（结果一样） |
| `frontend/web/src/features/library/domain/documents/job-actions.ts:81` | `fetchDocumentJobs(API_PREFIX, id)` 固定 `limit=50, offset=0`，超过 50 个任务只显示前 50 个 | 按 `has_more` 翻页 |
| `frontend/packages/api/src/documents.ts` | `DocumentListView` 已有 `limit`、`offset` | 加 `has_more: boolean`；`fetchDocumentMetadataSuggestions` 只取 `suggestions`，不用改 |


## 书库契约 library-documents.v1（contracts/library-documents-v1）

2026-10-22。方案见 [书库契约](../../ops/planning/api-reorg/20261022-书库契约.md)。

### 变了什么

1. 新契约 [`contracts/library-documents.v1.schema.json`](../../../contracts/library-documents.v1.schema.json)，生成的 TS 类型从
   `@retainpdf/contracts/library-documents` 导入。收了书（`DocumentRecord`、`DocumentListView`、`PatchDocumentInput`、
   `DeleteDocumentQuery`、`DocumentDeleteResultView`）、阅读入口（`DocumentReadingView`）、翻译覆盖（`TranslationCoverageView`、
   `CoverageSegment`、`CoverageJobView`）、书的文件清单（`DocumentFilesView`）、元数据建议（`DocumentMetadataSuggestionView` 等）、
   全文检索（`SearchQuery`、`SearchResultView`、`BlockSearchHit`）、合集（`CollectionRecord`、`CollectionListView`、
   `CreateCollectionInput`、`PatchCollectionInput`、`AddCollectionDocumentsInput`、`CollectionDeleteResultView`、
   `CollectionDocumentRemoveResultView`）。接口行为一点没变，只是把现在的返回写下来、Rust 测试钉住。
2. `library-books.v1` 删了已不存在的 `POST /library/books/batch-delete` 条目和 `LibraryBatchDeleteInput`、
   `LibraryBatchDeleteResultView` 两个类型（前端没有引用，`git grep` 过 main 和两个前端分支）。`LibraryBookDetailView` 还在，等前端去掉引用再删（2026-10-22 删了，见最上面一节）。

### 前端要做什么

不用改代码。可以逐步把手写的类型换成契约生成的（`import type { … } from "@retainpdf/contracts/library-documents"`，
`frontend/packages/api` 和 `frontend/web` 都已经依赖 `@retainpdf/contracts`）：

| 文件 | 现在手写的 | 换成 |
|---|---|---|
| `frontend/packages/api/src/documents.ts` | `DocumentRecord = Record<string, any> & {…}` | `DocumentRecord` |
| 同上 | `DocumentListView`（没有 `has_more`） | `DocumentListView` |
| 同上 | `DocumentMetadataEvidence`、`DocumentTitleCandidate`、`DocumentMetadataSuggestion` | `DocumentMetadataEvidenceView`、`DocumentTitleCandidateView`、`DocumentMetadataSuggestionView` |
| 同上 | `CreateDocumentMetadataSuggestionInput`、`ApplyDocumentMetadataSuggestionInput` | 同名 |
| 同上 | `DocumentReadingView` | 同名 |
| 同上 | `TranslationCoverageSegment`、`TranslationCoverageJob`、`TranslationCoverageView` | `CoverageSegment`、`CoverageJobView`、`TranslationCoverageView`（`note`、`kept_origin_blocks`、`kept_origin_blocks_supplied`、`failure_summary`、`error_head` 五个键后端一直都给，可以去掉 `?`） |
| `frontend/packages/api/src/collections.ts` | 六个函数都返回 `Promise<any>` | `CollectionListView`、`CollectionRecord`（建、改、加书）、`CollectionDeleteResultView`、`CollectionDocumentRemoveResultView` |
| `frontend/packages/api/src/search.ts` | `searchLibrary` 返回 `Promise<any>` | `SearchResultView` |
| `frontend/web/src/features/collections/domain/controller.ts:17` | `CollectionRecord`（字段大多可选） | `CollectionRecord` |
| `frontend/web/src/features/library/ui/island/index.ts:25` | `LibrarySearchHit` | 可以从 `BlockSearchHit` 派生 |

注意：

- `DocumentRecord.active_version_id` 没有时整个键不出现，类型里是可选；`authors_json`、`year`、`doi`、`last_opened_at` 没有功能
  （恒为 `"[]"`、`null`、`""`、`null`），不要拿来显示。
- `PatchDocumentInput.reading_status`、`DocumentRecord.reading_status` 是 `"unread" | "reading" | "done"`，`title_source` 是
  `"filename" | "pdf_metadata" | "ocr" | "user"`（手写的类型里多一个 `"ai"`，后端没有写这个值的地方）。
- 删合集回 `{ deleted: true }`、从合集拿掉一本书回 `{ removed: true }`，是同一个 Rust 类型的两种形状，契约里分成两个类型。

---

## OCR 提供方选项分客户端和服务器：请求不许带 `ocr.options.command`（fix/ocr-server-owned-options）

2026-10-22，审计 A2。做法和每个选项的分类见 [OCR 提供方选项分客户端和服务器](../../ops/planning/api-reorg/20261022-OCR提供方选项分客户端和服务器.md)。

| 地方 | 以前 | 现在 | 前端要做的 |
|---|---|---|---|
| `POST /api/v1/jobs`、`/documents/{id}/translate`、`/ocr`、`retry-stage` 的 `overrides.ocr.options` | `ocr.options.command`、`raw_provider` 原样盖在服务器配置上，流水线拿 `command` 去执行 | `400` `ocr.options.<键> is server-owned; …` | 无：界面不发 `ocr.options`（`buildOcrPayload` 只发 `provider`、`credential_ref`/token、`model_version`、`language`、`page_ranges`、Paddle 的 `paddle_api_url`） |
| `GET /api/v1/providers/ocr` 的 `options.<键>` | 没有 `client_settable`；`local.command`、`raw_provider` 给配置里的默认值 | 每个选项多一个 `client_settable`（只增）；`false` 的 `default` 恒为 `null` | 无（前端用自己写死的 `platform/config/providers.ts`，没调这个接口）。以后要改用它，契约在 `@retainpdf/contracts/ocr-providers`；`client_settable: false` 的不要做成输入框 |
| `frontend/web/scripts/frontend-status-smoke.mjs` 的 `--ocr-options` | 可以传 `{"command": …}` 跑本地 OCR | 带 `command`/`raw_provider` 会 400 | 冒烟脚本跑本地 OCR 时改在后端设 `RETAIN_LOCAL_OCR_COMMAND`（或 `ocr_providers.json`），`--ocr-options` 只放客户端可填的（例如 Paddle 的 `{"transport":"official_cli"}`）。帮助文字 `local requires a configured command` 可以改成「local 的命令在后端配置」 |

## 凭据不回明文、凭据接口的规矩、`/ready` 的信封（fix/credentials-no-plaintext）

2026-10-22。做法和取舍见 [凭据不回明文与内部接口](../../ops/planning/api-reorg/20261022-凭据不回明文与内部接口.md)。
（按约定加在末尾，免得和同时在做的分支冲突。）

### 变了什么

| 接口 | 以前 | 现在 |
|---|---|---|
| `GET /api/v1/credentials?include_values=true` | `200`，每条带 `secret` 明文 | `400`（``unknown field `include_values` … in the query string``）；不带参数照旧 `200`，任何接口都没有 `secret` 字段了 |
| `GET /api/v1/credentials` 带别的查询参数 | 忽略 | `400` |
| `PUT /api/v1/credentials/{credential_ref}` 带不同的 `kind` | 改掉种类 | `400`，凭据不变；带同样的 `kind`（大小写、空白不算）照常 |
| 凭据的三种 `409` | `error.details` 是 `{}` | 多一个 `reason`：`credential_in_use`、`credential_revision_conflict`、`credential_vault_revision_conflict`；顶层 `code`、`error.code` 不变 |
| `GET /ready` 不就绪（`503`） | 信封 `code: 0`、`message: "ok"` | `code: 50300`、`message: "not ready"`，多 `error`（`SERVICE_UNAVAILABLE`）；`data` 不变 |
| `GET /health` 读不出任务数 | `queue_depth`、`running_jobs` 是 `0` | `null`（正常时照旧是数字） |
| `POST /api/v1/internal/model/jobs/{job_id}/capability` | 发模型执行器的能力令牌 | 删了（`404`），前端本来就不调 |

### 前端要做什么

功能上不用改：`git grep` 过，前端没有调用方带 `include_values`（`createCredentialVault` 没有被引用，
`browser.ts` 2026-09-16 起不再从服务端拉明文），`PUT` 发的 `kind` 和原来一样，`/ready` 只看状态码。可以顺手删的死代码：

| 文件 | 现在 | 改成 |
|---|---|---|
| `frontend/packages/api/src/credentials.ts:16` | `CredentialMetadata` 里的 `secret?: string` | 删掉（后端不会再给） |
| `frontend/packages/api/src/credentials.ts:81-82` | `listCredentials(apiPrefix, { includeValues = false } = {})`，`includeValues` 为真时拼 `?include_values=true` | `listCredentials(apiPrefix)`，不拼参数（拼了会 400） |
| `frontend/packages/api/dist/credentials.{js,d.ts}` | 同上的构建产物 | 重新构建 |
| `frontend/web/tests/credentials/mineru.test.mjs:171`、`frontend/web/tests/home/credentials-dialog-component.test.mjs:315` | 注释提到 `?include_values=true` | 可以改成"这个参数后端已删" |

另外两点留给前端定：

- 设置页说"Key 只存在这个浏览器里"，但提交任务时内联的 Key 会被后端导入凭据库，任务在就一直在服务端（什么时候清见
  [凭据](../../api/14-凭据/01-凭据.md#建任务时内联的密钥)）。
  要不要在设置页加"清除服务端保存的密钥"（`GET /credentials` 列出、`DELETE /credentials/{credential_ref}` 删），由前端定。
- 凭据 `409` 现在可以按 `error.details.reason` 分支，`credentials.ts:75` 读顶层 `code` 的写法照旧能用。

## 单机模式收紧 CORS、终端握手查 Origin、回环监听时查 Host（fix/single-mode-origin-checks）

2026-10-22。审计第三节 6，用户定"收紧"。规则见 [API 总入口 1.1](../api/index.md#11-单机模式的来源和主机)，
方案见 [单机来源和主机校验](../../ops/planning/api-reorg/20261022-单机来源和主机校验.md)。

### 变了什么

| 地方 | 以前 | 现在 |
|---|---|---|
| 单机 CORS | `CorsLayer::permissive()`：任何来源都回 `Access-Control-Allow-Origin: *` | 只回给回环页面（`localhost`、`127.0.0.0/8`、`[::1]`，端口不限）、和 API 同主机只是端口不同的页面、`RUST_API_ALLOWED_ORIGINS` 列出的来源；回的是来源本身（不是 `*`），`Vary: origin`。别的来源不回 CORS 头，但请求照常处理（不 403）。`null`、`file://` 不放行 |
| 预检 | 全放行 | 方法、请求头照预检回显（`X-API-Key`、`Content-Type`、`Range` 都能过） |
| 跨源可读的响应头 | 全部（`*`） | 不变，仍是全部（`Content-Disposition`、`Content-Range`、`ETag`、`Accept-Ranges`、`Content-Length`……）；不回 `Allow-Credentials`，单机前端本来就不带 credentials |
| 助手终端 `ws(s)://…/api/v1/ai/terminal` | 只看 key | 握手带 `Origin` 且不在上面那份名单里就 HTTP `403`（`error.code = "FORBIDDEN"`）；不带 `Origin` 的（命令行）照旧只看 key |
| AI 服务 `/v1/fx/terminal`（41100） | 只看 key | 带 `Origin` 一律拒（浏览器从不直连它，前端走上面那条） |
| `Host` | 不查 | 后端监听回环地址时（开发栈默认 key、桌面版），`Host` 不是 `localhost`、IP 字面量或 `RUST_API_ALLOWED_HOSTS` 里的主机名就 `403 request host is not allowed`（含 `/health`）。监听非回环地址（Docker、换了 key 的开发栈）只在配了名单时查 |

### 核对过的调用方（不用改）

- 开发栈：页面 `http://127.0.0.1:40001` / `http://localhost:40001` → API `:41000`，回环来源；局域网 / 公网 IP、域名分两个端口
  访问时页面和 API 同主机只差端口，都放行。`serve_same_origin.py` 同源转发，后端收到 `Host: 127.0.0.1:41000`、页面的 `Origin`
  原样转发——不在名单里也只是不回 CORS 头，浏览器看来同源，不受影响；它不转发 WebSocket，终端照旧直连 `apiBase`。
- 桌面壳网关：页面 `http://127.0.0.1:<网关端口>`，`/api/*` 转发时删掉 `Host`，Node 补成 `127.0.0.1:<后端端口>`；终端 WebSocket
  直连 `apiBase`（`http://127.0.0.1:<后端端口>`），`Origin` 是 `http://127.0.0.1:<网关端口>`，回环，放行。就绪探测、复用探测都打
  `http://127.0.0.1:<端口>/health`。
- Docker：web 容器 NGINX 同源代理，`Host $http_host` 原样转发，后端监听 `0.0.0.0` 不查 `Host`；容器健康检查打
  `http://127.0.0.1:41000/ready`、`http://127.0.0.1/health`。
- AI 服务、`retainpdf-agent`、CLI 默认 `apiBase`、`dev.sh` / `dev_stack.py` 的探测都用 `127.0.0.1`，IP 字面量放行。

### 桌面壳退回 `file://`：前端已在 fix/desktop-gateway-origin 做完

网关起不来时桌面壳退回 `file://` 页面。实测（Electron 44.4.3）：这时 `fetch` 不带 `Origin`、也不发预检，走"没有 `Origin` 只看 key"，
不受影响；但终端 WebSocket 握手带 `Origin: file://`，后端不放行（`file://`、`null` 都不放：浏览器里双击打开的本地 HTML 也是这个来源）。
前端已在 `fix/desktop-gateway-origin` 改好：网关端口用尽时退到端口 0；退回 `file://` 时用 `session.webRequest.onBeforeSendHeaders`
把发往本机 `apiBase` 的 `Origin` 改成 `http://127.0.0.1`。

### 其它

- `frontend/packages/api/src/internal/runtime.ts` 第 89 行注释说"当前后端是 `CorsLayer::permissive()`"，已经不对了，前端顺手改掉即可，
  不影响行为。

## 服务商密钥校验：超时、重定向、不认识的字段，单机能测本机模型（fix/provider-probes）

2026-10-22。方案见 [服务商探测与用量](../../ops/planning/api-reorg/20261022-服务商探测与用量.md)，接口说明见
[Provider 校验接口](../../api/08-调试诊断/05-服务商校验.md)。

### 变了什么

| 接口 | 以前 | 现在 |
|---|---|---|
| `POST /providers/mineru/validate-token` | Token 无效、过期、超时都报 `provider_error`「没能完成 MinerU 校验，请稍后重试」 | 分得清：`unauthorized`、`expired`、`network_error`；服务商回 3xx 给 `redirected` |
| `POST /providers/{mineru,paddle}/validate-token` | 超时 120 秒（Paddle 还重试 3 次），前端 30 秒先放弃 | 四个接口共用 20 秒（`RUST_API_PROVIDER_PROBE_TIMEOUT_SECS`），不重试 |
| 四个校验接口 | 跟随重定向（Key 会被带到重定向后的地址） | 不跟随，`status: "redirected"`、`ok: false` |
| 四个校验接口 | 请求体里不认识的字段忽略 | 400，`message` 带字段名 |
| 四个校验接口（单机） | `base_url` 是 `127.0.0.1`、`localhost`、内网地址时 400 | 正常检测（链路本地 `169.254.x` 照旧 400）；多用户不变 |
| 四个校验接口 | `provider_message` 不截断 | 最多 500 字，超出以 `…` 结尾 |
| `GET /usage` 等三个用量接口 | 台账里一行怪时间戳能让接口 500 | 那一行照样计入总数，只是不进 `by_month` |

### 前端要做什么

不用改代码，字段和地址都没变；核对过前端发的字段都认（`mineru_token`；`paddle_token`、`base_url`；`api_key`、`base_url`、`model`、
`api_protocol`；余额 `api_key`、`base_url`）。

- `status` 多一个值 `redirected`，界面按 `summary` 显示就行；
- 可以顺手改 `frontend/packages/api/src/providers.ts:4-6` 的注释：后端的超时变量现在叫 `RUST_API_PROVIDER_PROBE_TIMEOUT_SECS`
  （四个接口共用，默认 20 秒；旧名 `RUST_API_DEEPSEEK_PROBE_TIMEOUT_SECS` 还认）；
- 以后有契约（`provider-probe.v1`）了再把四个函数的 `Promise<any>` 换成契约类型，这次没加契约。

## 备份恢复和同步脱离请求、409 带 reason、`last_restore`（fix/backup-sync-detached）

2026-10-22。方案见 [备份恢复和同步脱离请求](../../ops/planning/api-reorg/20261022-备份恢复和同步脱离请求.md)。

### 变了什么

1. `GET /api/v1/backups`（以及恢复、删除返回里的 `status`）多一个 `last_restore`：最近一次恢复的结果（不论成败），没恢复过
   或服务重启后为 `null`。字段：`backup_id`、`ok`、`safety_backup`（可能为 `null`）、`reason`、`error`、`started_at`、`finished_at`。
   恢复的请求中途断开（关了设置页）时恢复照样做完，刷新后凭它知道结果。
2. 恢复备份的 `409` 带 `error.details.reason`：`restore_blocked`（有任务在跑）、`backup_damaged`、`backup_newer`。
   **坏备份、来自新版本的备份由 `400` 改 `409`。** `POST /sync/run` 不跑时的 `409` 带 `sync_disabled` / `sync_not_configured`，
   后者的 `message` 改成「同步已开启，但还没有填写同步位置」。
3. `PUT /api/v1/sync`、`POST /api/v1/sync/test` 请求体里不认识的字段 `400`（以前静默忽略）；`PUT /sync` 校验失败时什么都不改。
4. `POST /sync/test` 更快给结论：每个请求 10 秒、不重试，整体 60 秒；超时的 `error` 是「测试连接超时：60 秒内没有结果」。
5. 立即备份的请求断开后 `running` 会回到 `false`（以前一直卡在 `true`，「立即备份」按钮禁用）。

### 前端要做什么

不用改代码。核对过：

- `frontend/packages/api/src/backups.ts:38-50`、`sync.ts:76-88` 的 `readEnvelope` 只读 `message`，不看状态码；400 改 409 后提示文字不变
  （「这份备份已损坏，不能恢复：…」「这份备份来自更新版本的程序…」）。`frontend/web/tests/backup/backup-panel.test.mjs:62` 本来就按 409 模拟。
- `SyncSettingsPanel.tsx` 发的 `PUT /sync`（`save({ folder, transport })`、`save({ device_name })`、`save({ enabled })`、`davPayload()`）
  和 `POST /sync/test`（`davPayload()`）都只带已知字段；CLI `backend/cli/src/cmd/sync.rs` 也只发已知字段。

可选：

| 文件 | 现在 | 可以改成 |
|---|---|---|
| `frontend/packages/api/src/backups.ts` 的 `BackupStatus` | 没有 `last_restore` | 加 `last_restore: { backup_id: string; ok: boolean; safety_backup: string \| null; reason: string \| null; error: string \| null; started_at: string; finished_at: string } \| null` |
| `frontend/web/src/features/backup/ui/BackupPanel.tsx` | 恢复请求失败（网络断开）只显示报错 | 刷新状态后看 `last_restore`：`ok` 就提示已恢复、给出 `safety_backup`；失败显示 `error` |

## 术语表：重跑用现在的表、PUT 保留没给的字段、删 import（fix/glossaries-rerun-and-put）

2026-10-22。方案见 [术语表重跑与整份替换](../../ops/planning/api-reorg/20261022-术语表重跑与整份替换.md)，接口见
[术语表](../../api/04-翻译/03-术语表.md)。

### 变了什么（前端不改也照旧能用）

1. 重跑、阶段重试出新任务时按**现在的**术语表重新解析，加上当时内联的条目；源任务用的表已删 `409`，
   `error.details.reason = "glossary_missing"`（以前 `404`），停用了 `409 glossary_disabled`。
2. `PUT /glossaries/:id` 请求里没出现的 `description`、`source_lang`、`target_lang`、`enabled` 保留原值（以前被清空、
   `enabled` 重置成 `true`）。`name`、`entries` 仍必填，缺了 `422`。可选 `expected_updated_at`，表被别处改过 `409 glossary_changed`。
   表已删的 `PUT` 是 `404`，不会重新建出来。
3. 建任务时 `translation.glossary_id` 指向不存在或停用的表 `400`（以前不存在 `404`、停用照样用）。前端下拉已经过滤掉删了的表；
   停用的表现在下拉里还列着，选了会 400，所以下面第 2 条要改。
4. 去重键改成（原词，上下文），`case_insensitive` 的原词按小写比、其余区分大小写：以前被吞掉的同词不同上下文、
   大小写不同的精确词，以后会留下。`parse-csv` 回包多 `duplicate_count`。
5. CSV：报错带行号（`row 3: …`）；制表符分隔的文本（Excel 复制）能直接解析；导出带 BOM、`Content-Disposition`，
   `= + - @` 开头的单元格前加 `'`（粘回解析框会去掉）。
6. JSON 词条里不认识的 `level`/`match_mode`、编译不过的正则 `400`；`context` 最多 500 字。前端只发合法值，不受影响。
7. `GET /glossaries` 不认识的查询参数 `400`，`?q=` 空串不再返回空列表。前端不带参数，不受影响。
8. 删了 `POST /api/v1/glossaries/import`（前端没用，`git grep` 过）。

### 前端要做什么

| 文件 | 现在 | 改成 |
|---|---|---|
| `frontend/web/src/features/glossaries/domain/glossaries-store.ts:44-50` | `GlossaryEntryRow` 没有 `context` | 加 `context: string` |
| 同上 `:135-143`（`normalizeEntryForRow`） | 读详情时丢掉 `context` | `context: entry.context \|\| ""` |
| 同上 `:171`（`readEditorPayload`） | `context: ""` 写死 | `context: \`${row.context \|\| ""}\`.trim()`（编辑器可以先不显示这一列，但要原样带回，否则存一次就把 `context` 清空） |
| `frontend/web/src/features/ingest/domain/workflow/glossary-options.ts:47` | `fetchGlossaries(apiPrefix)` 列全部 | 下拉只列启用的：`GET /glossaries?enabled=true`（`frontend/packages/api/src/glossaries.ts:6` 的 `fetchGlossaries` 加个可选查询参数） |
| `frontend/web/src/features/glossaries/ui/GlossaryImportPanel.tsx:21` | 占位符 `原词,译文,类型,匹配模式,备注`（没表头时后端按 `原词,译文,备注` 读，第 3 列会被当成备注） | 改成 `原词,译文,备注`，或提示「第一行写表头：原词,译文,类型,匹配模式,备注」 |
| `frontend/web/src/features/glossaries/domain/controller.ts:192`（可选） | `PUT` 不带版本 | 带上详情里的 `updated_at` 作 `expected_updated_at`；`409` 且 `reason === "glossary_changed"` 时提示「术语表已被别处修改，请刷新后再改」 |
| 重跑、重试失败的提示（可选） | 只显示 `message` | `reason === "glossary_missing"` 时提示「术语表已删除，请改选后重新翻译」 |
| `parse-csv` 预览（可选） | — | `duplicate_count > 0` 时提示「有 N 行重复，已按最后一行」 |

## 契约端点加 `client_name`、`transport`：可以开第 0 期（contracts/client-names-phase0）

2026-10-22。方案是前端的 [从契约生成前端请求函数](../../ops/planning/api-client-codegen/20261022-从契约生成前端请求函数.md)，
后端做了什么、一致性检查怎么比见 [契约端点加函数名和传输方式](../../ops/planning/api-reorg/20261022-契约端点加函数名和传输方式.md)，
字段说明在 [`contracts/README.md`](../../../contracts/README.md) 的「端点表」。

### 变了什么（接口行为没变）

1. `contracts/library-documents.v1.schema.json` 的 17 条端点都有了 `client_name`（照前端给的名单，方法、地址逐条对过）和
   `transport: "json"`。
2. `agent-calculation.v1` 计算产物下载那条的 `response_body: "binary"` 改成 `transport: "binary"`（`git grep` 过，前端没人读
   `response_body`）。`reader-data.v1` 的 `GET /jobs/:job_id/progress/stream` 标了 `transport: "sse"`。其余端点没写 `transport`，
   按 `json` 算，还没有 `client_name`。
3. `npm --prefix contracts run lint:schemas` 现在查端点表：键有白名单，`transport` 只能是 `json`/`sse`/`binary`/`websocket`/`raw_json`，
   `client_name` 小驼峰、**全部契约里不重名**。
4. rust_api 测试 `route_manifest::contract_endpoints_are_registered`：契约端点表的每条方法加地址都要在接口登记表里（排除
   jobs-control，`runtime-config` 比 `proxy_path`，`{x}`/`:x` 归一，去掉 `?` 查询串）。契约里的地址现在全部是活的。
5. `@retainpdf/contracts` 生成的 TS 类型没变（生成器只读 `input`/`query`/`output` 指向的定义）。

### 前端可以开始第 0 期

| 做什么 | 在哪 |
|---|---|
| 写生成器：读 `contracts/library-documents.v1.schema.json` 的 `endpoints`，有 `client_name` 且 `transport` 是 `json`（或不写）的生成函数 | `frontend/packages/api/scripts/` → `frontend/packages/api/src/generated/` |
| 手写 `request()`（拼地址、`X-API-Key`、拆信封、`attachErrorDetails`） | `frontend/packages/api/src/` |
| 把 `documents.ts`、`collections.ts`、`search.ts` 换成生成的函数，有中文报错、兜底的留成薄包装 | `frontend/packages/api/src/` |

注意：

- 生成的函数名以契约为准。要改名、要给别的契约的端点起名，告诉后端改契约（lint 会拦重名）。
- 查询参数、请求体的定义都是 `additionalProperties: false`，后端对不认识的字段回 400。
- 第 1 期要补进契约的接口，列清单给后端（方案第 5 节）。

## 第 1a 期：已有端点补 `client_name`（contracts/client-names-phase1a）

2026-10-22。决定和名单见 [契约第 1a 期补函数名](../../ops/planning/api-reorg/20261022-契约第1a期补函数名.md)。接口行为、生成的 TS 类型都没变。

1. 前端清单 1a 的 16 条全部照名单写上 `client_name`，`transport: "json"`：`listJobs`、`getJob`（job-status）、`createJob`（create-job）、
   `deleteJob`（library-books）、`listJobDatasets`、`getJobDataset`（job-data）、`listJobEvents`（job-events.v2）、`listJobFiles`、
   `getLiveLayout`、`getLivePage`、`getReaderMarkdown`、`getReaderMetadata`、`getReaderRegions`（reader-data）、`getUsageSummary`、
   `getDocumentUsage`、`getJobUsage`（token-usage）。
2. `GET /api/v1/jobs` 在 `library-books.v1` 的那条留着、不起名（删了它，`JobListView`、`ListJobsQuery` 就不再从
   `@retainpdf/contracts/library-books` 导出）。生成器按 `client_name` 取端点，不会生成两遍。
3. `progress/pages/:page` 从 0 开始，和返回的 `page_idx` 一致。
4. `getJobDataset` 的 `query` 以前是一段说明文字，生成器会报错；现在是 `JobDatasetQuery`（`@retainpdf/contracts/job-data`）：
   `fields`、`group_by`、`sort`、`offset`、`limit` 具名，其余键是等值筛选（索引签名 `string | number | boolean | undefined`），
   `{ group_by: "reader_item_id", limit: 1000 }` 可以直接传。

| 做什么 | 在哪 |
|---|---|
| 把手写的任务、阅读器、用量请求换成生成的函数 | `frontend/packages/api/src/` 里 jobs、reader、usage 相关文件 |
| （可选）类型改从 `@retainpdf/contracts/job-status` 引 `JobListView`、`ListJobsQuery`，之后后端可以删 `library-books.v1` 那条重复的 `GET /jobs` | `frontend/` 下引 `@retainpdf/contracts/library-books` 的地方 |

## 第 1b 期：任务操作与报告（contracts/phase1b-job-actions-reports）

2026-10-22。决定见 [契约第 1b 期任务操作与报告](../../ops/planning/api-reorg/20261022-契约第1b期任务操作与报告.md)。接口行为没变，只是补了契约。
同一期的译文条目、书的翻译 / OCR / 任务列表在另一个分支。

1. 两份新契约，从新子路径导入：

   | 导入 | 端点（`client_name`） | 主要类型 |
   |---|---|---|
   | `@retainpdf/contracts/job-actions` | `listJobActions`（`GET actions`）、`cancelJob`（`POST actions/cancel`）、`resolveOcrAmbiguity`、`getResumePlan`（`GET actions/resume`）、`resumeJob`（`POST actions/resume`）、`retryJobStage` | `StageActionsView`、`StageRetryActionView`、`LastRefineView`、`JobResumePlanView`、`JobSubmissionView`、`RetryStageRequest`、`RetryStageSubmissionView`、`ResumeJobInput`、`OcrAmbiguityResolutionRequest`、`OcrAmbiguityResolutionView`、`ActionBlockReason` |
   | `@retainpdf/contracts/job-reports` | `getFailureReport`（`GET reports/failure`）、`getQualityReport`（`GET reports/quality`）、`listQualityItems`（`GET reports/quality/items`）、`getTranslationReport`（`GET reports/translation`） | `JobDiagnosticsView`、`OcrAmbiguityView`、`QualitySummaryView`、`QualityItemsQuery`、`QualityItemsView`、`QualityItem`、`TranslationDiagnosticsView` |

   原始 schema 是 `@retainpdf/contracts/job-actions.v1.schema.json`、`job-reports.v1.schema.json`。

2. 错误码（各端点的 `note` 里有全文）：
   - 操作被拒一律 409，`error.details.reason` 是 `ActionBlockReason` 的值，按它分支、不要解析文字：
     取消 `job_not_active`；续跑 `job_active`、`artifacts_missing`、`model_executor_unsupported`、`ambiguous_ocr_dispatch`、
     `request_journal_corrupt`、`ambiguous_translation_request`、`stale_resolution`；重试再加 `translations_not_owned`；
     OCR 歧义处理 `job_active`、`no_ocr_dispatch`、`stale_resolution`、`ocr_dispatch_unsupported`。
   - 请求写错 400（不认识的字段、`retry-stage` 的 stage / `create_new_job` / `refine` 组合不对、`quality/items` 的 `kind`、`limit` 不对）。
   - `reports/translation` 报告还没生成：404，`error.details.reason=not_ready`。其余报告接口报告缺了照样 200，那一段是 null / 空清单。
   - 多用户模式下续跑、重试、OCR 歧义处理建新任务时页数额度不够：402，`error.code=PAGE_QUOTA_EXCEEDED`。

3. 和手写类型对不上、换成生成的类型时要注意的（`frontend/packages/api/src/`）：

   | 文件 | 现在手写的 | 契约里的 |
   |---|---|---|
   | `jobs-actions.ts` | `JobStageRetryActionView` 的 `reason`、`disabled_reason`、`will_reuse`、`will_rerun`、`danger` 可选，`action` 里的字段可选 | 都必有；`action` 不能重试时是 `null`；多了 `disabled_code`（`ActionBlockReason \| null`）；`action.body` 是 `RetryStageRequest` |
   | `jobs-actions.ts` | `LastRefineView` 的 `mode`、`escalated_count`、`escalated` 可选 | 都必有（老报告没有时是空串 / 0 / 空数组） |
   | `jobs-actions.ts` | `JobDiagnosticsView` 只写了 `failure_code`、`ocr_ambiguity`，其余 `[key: string]: unknown` | 全部字段；`render_diagnostics`、`translation_request_recovery` 没有时整个键不出现 |
   | `jobs-actions.ts` | `fetchResumePlan`、`resumeJob`、`cancelJob`、`retryJobStage` 返回 `any` | `JobResumePlanView`、`JobSubmissionView`、`JobSubmissionView`、`RetryStageSubmissionView` |
   | `jobs-actions.ts` | `resumeJob` 的 body 是 `Record<string, unknown>` | `ResumeJobInput`：只有 `overrides.translation` 的四个 key 字段，别的 400 |
   | `quality.ts` | `QualitySummaryView.layout.min_scale`、`min_final_font_size` 是 `number`；`refine.qa_before`、`qa_after` 不可空 | `number \| null`；`QaSnapshot \| null` |
   | `quality.ts` | `QualityItem.page` 是 `number`，`translation_item_id`、`reason` 可选 | `page` 是 `number \| null`；`translation_item_id`、`reason` 必有；按类出现的 `scale` 等可为 `null`；多了 `attempts` |
   | `quality.ts` | `QualityItemsView` 没有 `has_more` | 有 `has_more` |
   | `translation-debug.ts` | `fetchTranslationDiagnostics` 返回 `any` | `TranslationDiagnosticsView`（`summary` 是流水线的诊断文件，`{[k]: JsonValue}`，契约不展开） |

4. 调用方现在发的参数都在契约里：`cancelJob` 发 `{}`（后端不读请求体）；`resumeJob` 默认发 `{}`；`retryJobStage` 只发
   `stage`、`mode`、`create_new_job`、`overrides`、`ambiguous_request_policy`、`refine`；`resolveOcrAmbiguity` 发
   `resolution`、`resolution_revision` 和回执字段；`fetchQualityItems` 发 `kind`、`offset`、`limit`、可选 `page`、`severity`。

## 第 1b 期：译文条目和书的任务进契约（contracts/phase1b-translations-documents）

2026-10-22。决定见 [契约第 1b 期译文条目和书的任务](../../ops/planning/api-reorg/20261022-契约第1b期译文条目和书的任务.md)。接口行为没变，只是补了契约和类型。

| 函数名 | 方法、地址 | 类型从哪导入 | 返回 | 请求 |
|---|---|---|---|---|
| `listTranslationItems` | `GET /api/v1/jobs/:job_id/translations` | `@retainpdf/contracts/translation-revisions` | `TranslationDebugListView` | 查询 `ListTranslationItemsQuery` |
| `getTranslationItem` | `GET /api/v1/jobs/:job_id/translations/:item_id` | 同上 | `TranslationDebugItemView` | — |
| `replayTranslationItem` | `POST /api/v1/jobs/:job_id/translations/:item_id/replay` | 同上 | `TranslationReplayView` | 不带请求体 |
| `listDocumentJobs` | `GET /api/v1/documents/:document_id/jobs` | `@retainpdf/contracts/library-documents` | `DocumentJobListView` | 查询 `ListDocumentJobsQuery`（只认 `limit`、`offset`） |
| `translateDocument` | `POST /api/v1/documents/:document_id/translate` | 同上 | `JobSubmissionView` | `CreateJobInput` |
| `ocrDocument` | `POST /api/v1/documents/:document_id/ocr` | 同上 | `JobSubmissionView` | `CreateJobInput` |

要注意的：

1. **402 页数额度**（只有多用户模式）：`{"code": "PAGE_QUOTA_EXCEEDED", "message": "页数额度不够：…", "error": {"code": "PAGE_QUOTA_EXCEEDED", "http_status": 402, "details": {"required_pages": 3, "balance": 2}}}`。
   顶层 `code` 是字符串，不是数字，按 `error.code` 认（现在的 `pageQuotaErrorFromPayload` 就是这么认的）；`details` 的类型是
   `PageQuotaExceededErrorDetails`。被拒时不留任务。
2. 翻译复用 OCR 出错（404 `OCR_JOB_NOT_FOUND`；409 `OCR_JOB_NOT_SUCCEEDED`、`OCR_ARTIFACT_NOT_REUSABLE`、`OCR_ARTIFACT_MISSING`、
   `OCR_PAGE_COVERAGE_MISMATCH`）也是顶层字符串 `code`，同级有 `reason`、`can_fallback_to_ocr`，`error.details` 里也有这两个（`documentRequestError` 已经两处都读）。
3. `CreateJobInput` 和 `@retainpdf/contracts/create-job` 里的是同一份（逐字抄的，测试锁住），两边的类型可以互用。
4. `JobSubmissionView` 没有 `document_id`（`use-book-detail-*.ts` 里 `result.document_id || documentId` 的兜底照旧要留）；
   `sibling_job_ids` 只有翻译拆成几个任务时才出现。书的任务列表条目是 `JobListItemView`（和 `GET /jobs` 同形），**没有** `ocr_reused`，
   `DocumentJobSummary.ocr_reused` 这个可选字段在列表里永远读不到，提交结果里才有。
5. 译文条目列表在任务还没产出翻译清单时是 200 空列表，404 只表示任务不存在（`fetchTranslationItems` 把 404 当空列表的兜底可以去掉，
   要不要去由前端定）。单条、重放的 404 带 `error.details.reason = "not_ready"` 时是清单还没出来。`item`、`payload` 是原样的条目和
   开发脚本输出，类型是开放对象。重放是同步跑一次模型，最长 300 秒，失败（脚本出错、超时）500；模型调用本身失败时仍是 200，
   `payload.replay_error` 里有原因。合并阅读的虚拟任务（`merged-…`）重放 409 `TRANSLATION_REVISION_CONFLICT`、`reason: read_only_job`。
6. 生成器合进来以后重新生成：`src/generated/` 会多出 `translation-revisions.ts`（3 个函数），`library-documents.ts` 多 3 个函数。

| 做什么 | 在哪 |
|---|---|
| 换成生成的函数，中文报错、404 兜底留成薄包装 | `frontend/packages/api/src/translation-debug.ts`、`documents.ts`（`fetchDocumentJobs`、`translateDocument`、`ocrDocument`） |
| 手写的 `DocumentJobSubmissionView`、`DocumentJobsView`、`DocumentJobSummary` 换成契约类型 | `frontend/packages/api/src/documents.ts` |

## 任务列表契约补 `include_live_stage`（contracts/list-jobs-include-live-stage）

2026-10-23。决定见 [任务列表契约补 include_live_stage](../../ops/planning/api-reorg/20261023-任务列表契约补include_live_stage.md)。接口行为没变。

- `job-status.v1`、`library-books.v1` 的 `ListJobsQuery` 加了 `include_live_stage?: boolean`：`false` 只读库里的任务摘要，不导入事件历史；
  省略或 `true` 是完整的实时阶段。
- 前端要做：重新生成 `frontend/packages/api/src/generated`；最近任务、任务中心调 `listJobs` 时为绕开多余属性检查放的宽类型变量可以去掉，
  直接传 `{ ..., include_live_stage: false }`。

## 删 `library-books.v1` 重复登记的任务列表（contracts/library-books-drop-duplicate-list-jobs）

2026-10-23。决定见 [删 library-books 重复的任务列表](../../ops/planning/api-reorg/20261023-删library-books重复的任务列表.md)。接口行为没变。

- `library-books.v1` 只剩 `DELETE /api/v1/jobs/:job_id`（`deleteJob`）。`@retainpdf/contracts/library-books` 只导出 `LibraryDeleteQuery`、
  `LibraryDeleteResultView`；`JobListView`、`JobListItemView`、`JobFailureBriefView`、`JobProgressView`、`ListJobsQuery` 等从
  `@retainpdf/contracts/job-status` 取。`src/generated` 不用重新生成（那条本来就没有 `client_name`）。
- 前端要做：两个测试还读 `contracts/library-books.v1.schema.json` 的任务列表定义，改读 `contracts/job-status.v1.schema.json`：
  - `frontend/web/tests/contracts/library-books-contract.test.mjs` 的 `CONTRACT_PATH`（读 `JobProgressView`、`JobStatusKind`、`WorkflowKind`、
    `JobListItemView`、`JobStageSnapshotView`）；
  - `frontend/web/tests/contracts/job-failure-brief-contract.test.mjs` 的 `SCHEMA`（读 `JobFailureBriefView`）。
- 改完告诉后端，后端再删 `library-books.v1` 里这 14 个任务列表定义。
- 前端 `test/contracts-read-job-status-schema`（8fa12fba）改好以后，同一个分支删了这 14 个定义：`library-books.v1.schema.json` 的
  `definitions` 只剩 `LibraryDeleteQuery`、`LibraryDeleteResultView`，`contracts/tests/job-definitions-parity.test.mjs` 删了，
  `package-boundary` 断言不再抄回来。生成的 TS 没变，前端不用做什么。

## 磁盘快满时拒绝新上传、新任务（fix/disk-space-guard）

2026-10-24。决定见 [磁盘剩余空间下限](../../ops/planning/backend-review/20261024-磁盘剩余空间下限.md)。只增不改。

- 数据目录所在磁盘剩余空间低于下限（`RUST_API_MIN_FREE_DISK_MB`，默认 1024 MiB）时，`POST /uploads`、所有建任务的入口
  （`POST /jobs`、书的翻译和 OCR、重试、续跑）、原地重跑返回 `503`，`error.details.reason = "insufficient_storage"`，
  `message` 是英文的「not enough free disk space to …: N MiB left …, need at least M MiB」。被拒时什么都没写。
- `GET /health` 的 `data` 多一个 `disk`：`{ free_bytes: number | null, min_free_bytes: number, low: boolean }`。
  `/ready` 不因为磁盘变成 503。
- 前端可以做（可选）：按 `reason === "insufficient_storage"` 提示「磁盘空间不够，删掉一些任务再试」，不要解析 `message`；
  需要的话设置页或首页按 `/health` 的 `disk.low` 给个提醒。现在这类 503 会走通用的报错显示。

## 排队的任务按先后开跑，排满了 429（fix/job-queue-fifo）

2026-10-24。决定见 [排队先来先跑和排队上限](../../ops/planning/backend-review/20261024-排队先来先跑和排队上限.md)。只增不改。

- 排队的任务现在按交上来的先后开跑（以前名额空出来时谁先轮询到谁跑）。接口不变。
- 排队（还没开跑）的任务已经有 `RUST_API_MAX_QUEUED_JOBS` 个（默认 1000）时，所有建任务的入口（`POST /jobs`、书的翻译和 OCR、
  重试、续跑）、原地重跑返回 `429`，`error.code = "TOO_MANY_REQUESTS"`，`error.details.reason = "queue_full"`，
  `message` 是英文的「N jobs are already waiting to run (limit M); try again after some of them start」。被拒时什么都没写。
- 前端可以做（可选）：按 `reason === "queue_full"` 提示「排队的任务太多了，等前面的开跑再交」，不要解析 `message`；
  批量提交时遇到它可以停下剩下的。现在这类 429 会走通用的报错显示。正常用（几十、几百本）碰不到。

## 恢复备份期间上传、建任务回 409 `restore_in_progress`（fix/restore-in-progress-gate）

2026-10-28。决定见 [恢复备份期间不建任务不收上传](../../ops/planning/backend-review/20261028-恢复备份期间不建任务不收上传.md)。只增不改。

- 恢复数据库备份的那几秒里，`POST /uploads`、所有建任务的入口（`POST /jobs`、书的翻译和 OCR、重试、续跑）、原地重跑返回 `409`，
  `error.code = "CONFLICT"`，`error.details.reason = "restore_in_progress"`，`message` 是英文的
  「a database backup is being restored; try again in a moment」。被拒时什么都没写。
- 前端可以做（可选）：按 `reason === "restore_in_progress"` 提示「正在恢复备份，稍等再试」，不要解析 `message`；批量上传遇到它可以
  等 `GET /backups` 的 `running` 变回 `false` 再接着传。现在这类 409 会走通用的报错显示。恢复本来就要求没有排队、在跑的任务，正常用很少碰到。

## 术语表契约 glossaries.v1（contracts/glossaries-v1）

2026-10-29。设置类第 2 批第 1 组（前端排的顺序）。决定见 [设置类第 2 批：术语表契约](../../ops/planning/api-client-codegen/20261029-设置类第2批-术语表契约.md)。接口行为没变，只是补了契约。

- 新契约 `contracts/glossaries.v1.schema.json`，npm 子路径 `@retainpdf/contracts/glossaries`。7 条端点都有 `client_name`：
  `listGlossaries`（`GET /glossaries`，查询 `ListGlossariesQuery`）、`createGlossary`、`getGlossary`、`updateGlossary`、`deleteGlossary`
  （都回 `GlossaryDetailView`）、`exportGlossaryCsv`（`transport: binary`，直接是 CSV 文件）、`parseGlossaryCsv`（回 `GlossaryCsvParseView`）。
- 和 `frontend/packages/api/src/glossaries.ts` 手写的那 7 个地址、方法一样；手写的返回都是 `any`，换成生成的以后有类型。名字不全一样：
  手写的 `fetchGlossaries`、`fetchGlossary` 在契约里叫 `listGlossaries`、`getGlossary`，其余 5 个同名。`deleteGlossary` 回的是删掉的那张表
  （`GlossaryDetailView`），`parseGlossaryCsv` 的回包有 `duplicate_count`（去重丢掉的行数）。
- 前端可以做：重新生成 `src/generated`，换掉 `glossaries.ts` 里手写的 7 个请求（`glossaries-store.ts` 里拼地址的几处一起收）。

## 全文检索命中加整本书页号 document_page

2026-11-03。Studio 会话检查时发现：分段翻译的书，`GET /api/v1/search` 命中里的 `page_idx` 是建索引那个任务自己的本地页号，
`GET /documents/{id}/reading` 给的合并任务却按整本书编页，「搜到第 N 页 → 按书读第 N 页」会落到别的页。

- 新字段 `document_page`（1 起，整本书的页号；任务记录读不到时 `null`），旧字段都不变。契约 `library-documents.v1` 的
  `BlockSearchHit` 加了这个键（必有，可为 `null`），生成的 DTO 已更新。
- 前端可以做（可选）：从搜索结果跳到按书阅读的任务时用 `document_page - 1`；直接打开命中的 `job_id` 那个任务时照旧用 `page_idx`。

## Studio 按书跳转：studio-bridge.v1 的 navigate 加 document_id

2026-11-03。方案见 [按书跳转](../../ops/planning/studio-workbench/20261103-按书跳转.md)。契约只加不改。

- `NavigateMessage` 加可选的 `document_id`；`Feature` 加 `navigate-document`。`job_id` 照旧必填（按书找不到时用）。
- 前端要做（阅读页，`frontend/web/src/platform/studio-bridge/`）：
  1. `ready` 的 features 里加 `navigate-document`（做完下面一条再加，Studio 看到它才会发 `document_id`）。
  2. 收到带 `document_id` 的 navigate：调 `GET /api/v1/documents/:document_id/reading`，拿到 `job_id` 就打开它；
     `job_id` 是 `null` 或请求失败，就照旧打开消息里的 `job_id`。`page_idx`、`block_id` 照旧用：按书打开的任务都按整本书编页，
     不用换算。
- 不加 `navigate-document` 的话什么都不变：Studio 照旧只发 `job_id`。

## 删掉 RetainPDF 自己的 AI（2026-11-03）

2026-11-03。决定见 [RetainPDF 不要自己的 AI](../../ops/planning/frontend-migration/20261103-RetainPDF不要自己的AI.md)：产品里只留
Studio（`frontend/studio`）自己的 AI，后端把 RetainPDF 自己的 AI 服务和它的接口全删了。网页那边 2026-11-03 已经不调这些接口。
这次是删接口，不是只增不改；下面列的地址现在都是 `404`。

- **删了的接口**：
  - `/api/v1/ai/*`：`POST /ai/ask`、`GET|PUT /ai/runtime-config`、`/ai/conversations…`（列表、新建、读、改、删、`fork`、
    `messages`、`operations`、`calculations`）、`/ai/operations/:operation_id…`（读、`run`、`retry`、`cancel`、`commit`、
    `candidate.pdf`）、`/ai/calculations/:calculation_id…`（读、`artifacts/:artifact_id`）、助手终端 WebSocket `GET /ai/terminal`；
  - `/api/v1/internal/agent/*`（能力令牌、文档操作、计算、运行时会话）；
  - 画板 `GET /api/v1/jobs/:job_id/ai/board`、`GET /api/v1/jobs/:job_id/ai/board/:name`（任务接口从 9 类变成 8 类，没有 `ai` 了）；
  - 合集的 Agent 工作区 `POST /api/v1/collections/:id/agent-workspace`（删合集照旧清 `<data_root>/collections/<id>/`）；
  - 书的 Agent 版本 `GET /api/v1/documents/:id/agent-versions`。
- **删了的契约**（`contracts/` 和 `backend/contracts/` 两份，`@retainpdf/contracts` 的子路径一起去掉）：`ai-ask.v1`、
  `ai-conversations.v1`、`agent-calculation.v1`、`public-document-operation.v1`、`runtime-config.v1`。
  `frontend/web/tests/contracts/library-books-contract.test.mjs`、`job-status-contract.test.mjs` 注释里还提到 `ai-ask`、`ai-conversations`，只是注释。
- **健康检查的旧字段留着**：`GET /health` 的 `ai_service` 键还在，值固定 `"disabled"`；`GET /ready` 的 `components.ai_service`
  固定 `{ "required": false, "status": "not_required" }`，`reasons` 不会再出现 `ai_service_not_healthy`。前端读到这两个键不用改。
- **没删的**：翻译用的大模型、凭据、模型执行器（`/api/v1/internal/model/jobs/...`）、翻译 agent、`retainpdf-agent` 可执行文件、
  `retainpdf-pipeline diagnose-failure`；库里的对话、文档操作、计算记录表也留着（不再有接口读写）。删凭据时不再查
  `secrets/ai-runtime.json` 里的引用。
- **桌面壳要跟着改**（归前端会话，后端没动 `frontend/`）：
  1. `frontend/desktop/src/main/plugins/backend.js`：去掉 `startRetainpdfAiService` 和调它的两处（复用外部后端时、`RUST_API_AI_SUPERVISE`
     不是 `1` 时）、`AI_SERVICE_PORT = 41100`、`aiServicePort` / `aiServiceRoot`、退出时先停 AI 的那段顺序；启动进度里的
     「Rust API 与 AI 服务正在启动」换掉。rust_api 不再认 `RUST_API_AI_SUPERVISE`，也不会去拉 AI 服务。
  2. `frontend/desktop/src/main/backend-env.js`：去掉 `RUST_API_AI_*`（`RUST_API_AI_SERVICE_BASE`、`RUST_API_AI_HOST`、`RUST_API_AI_PORT`、
     `RUST_API_AI_SUPERVISE`）和 `RETAIN_AI_*`（`RETAIN_AI_HOST`、`RETAIN_AI_PORT`、`RETAIN_AI_API_KEYS`、`RETAIN_AI_RUST_API_KEY`、
     `RETAIN_AI_RUST_API_BASE`、`RETAIN_AI_DATA_ROOT`、`RETAIN_AI_FX_AGENT_CLI_COMMAND`，以及从设置 `assistant` 段写的
     `RETAIN_AI_LLM_MODEL`、`RETAIN_AI_LLM_BASE_URL`、`RETAIN_AI_LLM_API_KEY`、`RETAIN_AI_MAX_TOOL_ROUNDS`）；`backend-env.test.mjs` 跟着改。
     后端已经不读这些变量，留着不报错，只是没用。
  3. `frontend/desktop/scripts/prepare-app.mjs`：删掉把 `backend/ai` 复制成 `app/backend/ai_service` 的那段（`servicesAiRoot`、
     `aiServiceSrc`/`aiServiceDst`、`retainpdf_ai/__main__.py` 检查）。现在 `backend/ai` 没了，这段会直接报
     `missing ai_service at …`，桌面打包过不去。
  4. `frontend/desktop/scripts/report-package-size.mjs`：去掉 `app/backend/ai_service` 这一项。
  5. `frontend/desktop/requirements-ai-service.txt`：`.github/scripts/sync_backend_python_requirements.py` 不再生成它，CI 的桌面打包
     （`build-desktop-packages.yml`）也不再 `pip install -r` 它；文件可以删掉。

## 删掉命令行 retainpdf-agent（2026-11-03）

用户定：`retainpdf-agent`（给 RetainPDF 自己的 AI 终端里的 agent 调本机接口用的命令行）一起删了。它靠的 Agent 能力令牌
认证在删 AI 那次已经没了，翻译、翻译 agent、管线、Studio 都不用它。上一节「没删的」里列了它，以这一节为准。

- 后端删了 `backend/api/src/bin/retainpdf-agent.rs`；Docker 镜像不再带它；CI 的 macOS 桌面包检查不再要求 `bin/retainpdf-agent`。
- 前端要做（桌面壳）：`frontend/desktop/scripts/prepare-app.mjs` 的 `resolveAgentBinary` 和拷贝 bin 那段、清单字段
  `agentBinaryBundled`；`scripts/run-local.mjs` 的 `requiredBackendBinaries` 去掉它；`src/main/backend-env.js` 里提到它的地方。
  `cargo build --workspace --bins` 不再产出它，打包时找不到会报错，所以要和这个分支一起合。

## OCR 服务商的能力和上限从接口读（2026-11-12，插件化 P1b）

`GET /api/v1/providers/ocr` 每家服务商多了 4 个字段（契约 `ocr-providers.v1`，只增不改），数据来自后端的服务商清单
`backend/config/ocr_providers.json`：

| 新字段 | 对应前端 `frontend/web/src/platform/config/providers.ts` 里手抄的 |
|---|---|
| `limits.max_pages`（0 = 不限，已算上环境变量覆盖） | `maxPages` |
| `limits.max_file_bytes`（0 = 不限） | `maxBytes` |
| `docs_url` | `docsUrl` |
| `streams_pages`：`always` / `never` / `chunked_upload` | （前端没有；要显示"OCR 和翻译并行"时用） |
| `shares_translation_key_host`：GLM-OCR 是 `open.bigmodel.cn` | （前端在 OCR-only 任务里自己带翻译 key 的那段逻辑可以参考它） |

前端要做（前端会话排期）：`providers.ts` 里的 `maxPages`、`maxBytes`、`docsUrl` 改成读这个接口，删掉手抄的值。
PaddleOCR 返回 `max_file_bytes = 104857600`（100MB）和 `limits.chunked_upload_exempt = true`：整本翻译任务（OCR 之后紧接着翻译）
按片上传，不看文件大小（后端 2026-11-12 起不再拦，以前超过 100MB 建任务会被拒）；纯 OCR 任务、填了自建服务地址、
`transport=official_cli` 是整份提交，照旧 100MB。前端 `maxBytes: 0` 对整本翻译是对的，纯 OCR 任务要按 100MB 拦。

## 接口规矩尾巴：409 全带 reason、`GET /jobs` 收紧、改译文不再回 422（2026-11-25，fix/api-rule-tail）

见 [规矩尾巴补完](../../ops/planning/api-reorg/20261125-规矩尾巴补完.md)。都是只增或前端已经不受影响的改动，**前端不改也照常能用**。

1. 改单条译文 `PATCH /jobs/{job_id}/translations/{item_id}` 新译文没过检查：`422` → `400`，`error.code` 照旧
   `TRANSLATION_REVISION_REJECTED`，`details` 不变。`frontend/packages/api/src/translation-debug.ts` 的 `reviseTranslationItem`
   按 `details.reason` 出提示，不用改；如果别处（测试、注释）写了 422，顺手改成 400。
2. `GET /jobs` 查询串里不认识的参数 `400`（以前忽略）。`frontend/packages/api/src/jobs.ts` 的 `listJobs` 带的参数都认识，
   桌面壳 `backend-http.js` 的 `limit`、`offset` 也认识；以后加参数要先在后端加。契约 `job-status.v1` 的 `ListJobsQuery` 加了
   `additionalProperties: false`，生成的类型只多一段说明。
3. 新的 409 `reason`（以前 `details` 是 `{}`）：`legacy_job_unsupported`（很早版本做的任务，读不了产物）、`event_source_not_file`
   （兜底）、`job_exists`（建任务指定的编号已存在，前端不指定编号碰不到）、`tag_name_taken`（改标签名撞名，带 `existing_tag_id`；
   标签接口前端还没接）。可选：给 `legacy_job_unsupported` 一句人话，例如「这是很早的版本做的任务，读不了，请重新上传翻译」。

前端已跟上（`feat/idempotent-submit`，2026-11-25）：
- 第 1 条：`frontend/web/tests/book-detail/edit-translation.test.mjs` 的模拟错误改成 `status: 400`；前端没有按 422 分支的代码。
- 第 3 条：`@retainpdf/api` 的 `request()` 遇到 `legacy_job_unsupported` 不管调用方给的是哪种文案，都换成
  「这是很早的版本做的任务，读不了它的文件，请重新上传翻译。」并挂上 `reason`（`http.ts` 的 `explainLegacyJob`），所有生成的请求函数都经过这里。
  直接拿地址下载的产物（`<a href>`）不经过它。

## 删续跑旧名 `actions/rerun`（2026-11-25，chore/drop-rerun-alias）

`POST /jobs/{job_id}/actions/rerun` 删了（404）。前端早就只调 `actions/resume`（`resumeJob`），不受影响；接受 `Idempotency-Key` 的提交接口
现在是 6 个（少了 rerun）。任务视图的 `actions.rerun` 字段还在，和 `actions.resume` 完全同值（地址也是 `actions/resume`）。

前端要做（不急）：`frontend/packages/domain/src/job/actions.ts` 里 `actions.rerun?.enabled ?? artifactActions.rerun?.enabled` 的兜底去掉，
只读 `resume`；去掉以后告诉后端，后端再删 `actions.rerun` 字段。见 [删续跑旧名 rerun](../../ops/planning/api-reorg/20261125-删续跑旧名rerun.md)。

前端已跟上（`chore/drop-rerun-fallback`，2026-11-25）：`resolveJobActions` 只看 `actions.resume`（和 `artifacts.actions.resume`），
不再读 `actions.rerun`；演示模式的任务数据也改成 `actions.resume`。后端可以删 `actions.rerun` 字段了。

## 第三批删接口（2026-11-25，chore/api-delete-batch3）

删了 `POST /fonts/upload`、`GET /jobs/{job_id}/data`（数据集目录，`listJobDatasets`）、`GET /jobs/{job_id}/reports/translation-qa`、
`reports/layout-fit`、`reports/refine`，前端都没调。见 [第三批删接口](../../ops/planning/api-reorg/20261125-第三批删接口.md)。

前端要做：
1. 重新生成请求函数：`frontend/packages/api/src/generated/job-data.ts` 的 `listJobDatasets` 会消失（`getJobDataset` 照旧），不重新生成
   「src/generated 和契约端点表一致」的检查是红的。契约 `job-data.v1` 删了 `JobDataCatalogView`、`JobDataDatasetInfo`、`JobDataFieldInfo`。
2. 可选：`frontend/desktop/src/main/lan-share.js` 拦截名单里的 `/api/v1/fonts/upload` 和它的测试可以删（拦一个不存在的地址无害）。

前端已跟上（`chore/api-client-regen-batch3`，2026-11-25）：两条都做了。`generate:client` 重新生成 `job-data.ts`；手写的
`frontend/packages/api/src/job-data.ts`、`web/src/platform/api/domains/job-data.ts`、`mocks/job-data.ts` 去掉 `JobDataCatalogView` 的导出和引用；
`lan-share.js` 拦截名单和 `lan-share.test.mjs` 去掉 `/api/v1/fonts/upload`。

## 改译文可以带读到的旧译文（2026-11-25，feat/revision-expected-text）

`PATCH /jobs/{job_id}/translations/{item_id}` 请求体多了可选的 `expected_translated_text`，对不上 409 `text_mismatch`（带
`current_translated_text`）。给 agent 用，前端编辑框不用带，**前端不用改**。`REVISION_REASON_MESSAGES` 想覆盖全的话可以加一句
`text_mismatch: "这段译文刚被别处改过，重新打开再改。"`。契约 `translation-revisions.v1` 已重新生成。

## 退出时停 worker、在途请求排空（2026-11-26，fix/shutdown-inflight）

后端状态管理第 0 步 Z1。打包桌面版退出时 jobsd 现在会停掉自己起的 worker（以前 worker 成孤儿接着花钱）；翻译收到 SIGTERM 后
最多等 2 秒让在途请求回来、写上终态再退出；连接都没建成的请求记 `failed_not_sent`，不算结果不明。效果是退出再打开、断网以后，
落 `translation_request_ambiguous` 要用户确认的任务变少。**前端不用改**：没有新字段、新状态（「待确认」状态是第 1 步的事），
桌面壳给后端的 10 秒退出时限没变（`frontend/desktop/src/main/graceful-stop.js`），后端在 7 秒左右收完。
