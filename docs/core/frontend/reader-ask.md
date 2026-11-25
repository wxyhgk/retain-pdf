# 阅读页提问（ACP）

2026-11-25 加。方案和用户的决定见 [阅读页提问](../../ops/planning/reader-ask/20261125-阅读页提问.md)，后端那一半（ACP 桥、自带 agent）见同目录的后端文档。

## 入口

- 书页上右键：画笔那一排上面多一行。没选字是「在这里提问」（问鼠标下面那一块，认不出块就问这一页这个位置）；选着书页上的字是「问这段」。
- 选着书页上的字按 `?`：同「问这段」。没选字时 `?` 照旧是快捷键帮助（提问在捕获阶段先拿到，只在选着字时拦）。
- 选中、悬停都**不弹东西**（[以前两次拿掉过选中浮条](../../ops/planning/reader-ask/20261125-阅读页提问.md)）。
- 宿主不给 `ReaderAskPort` 就没有这些入口。web 宿主（`frontend/web/src/features/reader/domain/ask-port.ts`）：演示模式给假 agent
  （`platform/mock/ask-agent.ts`）；局域网共享打开的页面不给（桌面网关拦了 `/api/v1/ai`）；其余给真的：
  - 列 agent：`listAiAgents`（`@retainpdf/api/ai`，契约 `ai-agents.v1`）。
  - 连 agent：ACP SDK 的 `client()` + `experimental/ws-client`，WebSocket `/api/v1/ai/agents/{id}/acp?api_key=…`；`initialize` →
    `session/new`（`cwd`、`mcpServers` 空着，桥补书文件夹和 `retainpdf mcp`）→ `session/prompt`，停是 `session/cancel`。
  - 自带 agent（`retainpdf`）带设置里默认翻译模型的 `model`、`base_url`、`api_protocol`、`thinking` 和凭据库里翻译密钥的引用
    `credential_ref`（不传明文 key）；缺了在下拉里标「用不了」并写缺什么。后端接口见 `docs/api/16-AI/01-阅读页提问.md`。

## 代码

| 文件 | 干什么 |
|---|---|
| `packages/reader/src/contracts/ask.ts` | 端口：`listAgents`、`openSession`（ACP 会话：`prompt`、`cancel`、`close`，回调 `onUpdate`、`onPermission`）；`ReaderAskAnchor`（问的是哪儿） |
| `packages/reader/src/ask/anchor.ts` | 右键 / `?` 那一刻拼出处：栏、页、页内位置、悬停认出的块、选中的字、章节（书签优先，没有就前面最近的标题） |
| `packages/reader/src/ask/acp-parts.ts` | ACP `session/update` → 一轮回答的各部分：正文、思考、工具调用、计划、子 agent、用量；速度和底下那一行 |
| `packages/reader/src/ask/acp-adapter.ts` | 接 assistant-ui 的 `LocalRuntime`：第一句前面带出处；边收边吐；许可等用户点；换 agent 重开会话 |
| `packages/reader/src/ask/ReaderAskWindow.tsx` | 浮动窗口（react-rnd）+ assistant-ui 的对话、输入框 + streamdown 渲染回答（KaTeX 公式）；**单独一块，第一次提问才加载** |
| `packages/reader/src/ask/ReaderAskMarks.tsx` | 书页左边白边的「?」：这本书问过的地方，点了重新打开那次问答 |
| `packages/reader/src/ask/use-ask-threads.ts` | 问答记录：打开书读回问过的地方；每答完一轮整段存（第一次 POST，之后 PATCH）；一句没问就关不留「?」；删 |
| `packages/reader/src/ask/thread-messages.ts` | assistant-ui 的对话 ↔ 存的问答（问题 / 回答 + 思考 + 用量和用时）；新会话第一问带上之前几轮 |
| `packages/reader/styles/ask.css` | 窗口、回答（streamdown 出的是普通元素，按元素写样式，不用它的 Tailwind 类）、「?」 |

开源库（assistant-ui、streamdown、`@streamdown/math`、react-rnd、KaTeX、ACP SDK）在阅读器的 `vite.config.ts` 里是 external，
由 web 的 esbuild 打包、拆块：提问窗那一块约 940KB，不提问的人不加载。KaTeX 的样式和 woff2 字体由 `prepare-runtime-deps.mjs`
拷到 `web/vendor/katex/`，打开提问窗时按宿主给的地址（`resolveKatexStylesheetUrl`）插一个 `<link>`，桌面版离线也能用。

## 回答怎么画

- 思考（`agent_thought_chunk`）：折叠块，出字时展开、写完收起。
- 工具调用（`tool_call` / `tool_call_update`）：小卡片，标题、状态、读到的位置、输出；agent 要许可（`session/request_permission`）时卡片上出它给的几个选项。关窗、停下时没回的许可按取消回掉。
- 计划（`plan`）：整份替换的清单，做完的划掉。子 agent（`subagent_update`）：一行，标题和状态。
- 底下一行：agent 名、输入 / 输出 token、缓存命中、上下文占比、费用、速度（有输出 token 按 token/s，没有按字/s 估）、首字、用时。
  分项 token 不在 ACP 标准里，读 `_meta.retainpdf.usage`（自带 agent）或 `_meta.usage`。
- 模型常写 `\( \)`、`\[ \]`，换成 `$`、`$$` 再给 remark-math（代码块里不动）。
- 发出去到第一段之前显示「在想…」，超过 10 秒改成「还在等 agent 回应……」。连不上（没开、设置不对、握手被拒）在回答位置写原因；连接断了下一问重开会话。

## 出处和问答记录

- 右键时悬停框还没认出块（鼠标刚移过来、点在两段之间）：按点的位置找同一页最近的块（超过页高 15% 不算），带它的原文译文，
  不然问题里一个字都没有，模型只会说「看不到」（11-25 真机联调踩到）。
- 问答记录（后端 `ask-threads.v1`，按书存，一本最多 500 次）：宿主的 `port.threads` 驼峰 ↔ 接口下划线；存不上照样能问，只是关了书就没了。
- agent 那边每次打开是新会话（ACP 的 `session/load` 后端还没开）：第一问前面带出处和之前最近 12 条（最多 8000 字）。
- 本机 agent 没装：后端不再现场 npx 下载（下到一半会留坏缓存，见 11-25 联调），列表里 `available: false` 带 `install`；问答窗「还能接本机的……（要先装）」
  展开是安装命令，能复制。

## 真机联调（2026-11-25）

自带 agent（`claude-haiku-5-5`）：思考摘要（英文，Anthropic 生成）先到，首字 2.5–3.3 秒；中文正文、KaTeX 对；追问接得上；
问答记录存、刷新读回、重新打开追问、删都过。踩到的：SDK 不给 `protocols` 时 Chrome 发子协议 `"undefined"`，桥不回，握手断（前端传 `[]`）；
悬停没认出块时问题不带文字（加了最近块）。本机 Claude Code 没测成：要先 `npm install -g @agentclientprotocol/claude-agent-acp`。

## 还没做

- 本机 Claude Code、Codex、Gemini 真机试（要先装 ACP 适配器）。
- 扫描页没字时把那一块的图发过去（agent `acceptsImages` 时）。
- agent 那边接着上次的会话（ACP `session/load`，后端开了再接）。
- 白板：回答以后进白板（[以 PDF 为主体](../../ops/planning/learning-system/20261125-以PDF为主体的提问白板笔记.md)）。
