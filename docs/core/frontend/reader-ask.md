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
  - 自带 agent（`retainpdf`）带设置里默认翻译模型的 `model`、`base_url`、`api_protocol`、`thinking`、阅读页的 `job_id`（让它自己读书），
    和凭据库里翻译密钥的引用 `credential_ref`（不传明文 key）。翻译任务一直带明文 key 提交，多数人浏览器里没有引用：连之前把设置里的翻译密钥
    存进凭据库（有引用就更新成当前这把），引用记回浏览器设置。没配翻译模型才标「用不了」。后端接口见 `docs/api/16-AI/01-阅读页提问.md`。

## 代码

2026-11-26 起提问窗拆成独立的包 **`frontend/packages/ask`（`@retainpdf/ask`）**，能整个交给别人（或别的 AI）改：
它不认识书和阅读页，接口、目录、规矩见 [它的 README](../../../frontend/packages/ask/README.md)，边界由
`frontend/web/tests/architecture/ask-package-boundary.test.mjs` 守着。阅读器里只留「书上的哪儿」和问答记录：

| 文件 | 干什么 |
|---|---|
| `packages/reader/src/contracts/ask.ts` | 阅读页的端口：`listAgents`、`openSession({ agentId, jobId })`、`threads`（问答记录）；`ReaderAskAnchor`（问的是书上哪儿）。agent、会话、问答的类型就是 `@retainpdf/ask` 的 |
| `packages/reader/src/ask/anchor.ts` | 右键 / `?` 那一刻拼出处：栏、页、页内位置、悬停认出的块、选中的字、章节（书签优先，没有就前面最近的标题） |
| `packages/reader/src/ask/ask-context.ts` | 书上的位置 → 提问窗的 `AskContext`（页码、位置、引用、发给 agent 的出处 `anchorPreamble`）；端口开会话时绑上任务号 |
| `packages/reader/src/ask/ReaderAskPanel.tsx` | 把上面这些接到 `@retainpdf/ask/window` 的 `AskWindow` 上；**单独一块，第一次提问才加载** |
| `packages/reader/src/ask/ReaderAskMarks.tsx`、`styles/ask-marks.css` | 书页左边白边的「?」：这本书问过的地方，点了重新打开那次问答 |
| `packages/reader/src/ask/use-ask-threads.ts` | 问答记录：打开书读回问过的地方；每答完一轮整段存（第一次 POST，之后 PATCH）；一句没问就关不留「?」；删 |
| `web/src/features/reader/domain/ask-port.ts` | 宿主端口：列 agent（`GET /api/v1/ai/agents`），拼 WebSocket 地址（api_key；自带类 agent 再带模型配置、凭据引用、job_id）交给 `@retainpdf/ask/acp` 的 `openAcpWebSocketSession`；问答记录接口 |

提问窗包里的文件（`packages/ask/src/`）：`acp/parts.ts`（`session/update` → 回答的各部分）、`acp/adapter.ts`（接 assistant-ui）、
`acp/messages.ts`（存的问答）、`acp/socket.ts`（连 ACP）、`window/`（窗口、标题栏、引用、工具调用这几块、能点的页码）、`ui/`（照搬的 assistant-ui）。
测试在 `frontend/web/tests/ask/`。

开源库（assistant-ui、react-rnd、KaTeX、ACP SDK）都是 `@retainpdf/ask` 的依赖；阅读器的 `vite.config.ts` 把 `@retainpdf/ask` 当 external，
由 web 的 esbuild 打包、拆块：提问窗那一块约 940KB，不提问的人不加载。KaTeX 的样式和 woff2 字体由 `prepare-runtime-deps.mjs`
拷到 `web/vendor/katex/`，打开提问窗时按宿主给的地址（`resolveKatexStylesheetUrl`）插一个 `<link>`，桌面版离线也能用。

## 回答怎么画

2026-11-26 起整个对话区照搬 assistant-ui 官方的 Thread（现在在 `packages/ask/src/ui/`，28 个文件按上游目录：`elements/`、`utils/`、`hooks/`、`shadcn/`；
只改引用路径、文字换中文、`markdown-text` 按它的 LaTeX 文档加 remark-math / rehype-katex、`thread.aui` 显式泛型和 `MessageFooter` 插槽，每个文件开头写了改了什么）。
复制、重新回答、改问题、版本切换、导出 Markdown、回到最下面、工具分组、思考秒数、贴图片都是它的。我们往里塞：工具调用（ACP 许可 → approval）、
计划 / 子 agent（makeAssistantDataUI）、「在想…」（Indicator）、用量那一行（MessageFooter）、欢迎语（Welcome）。照搬目录不算手写控件棘轮。
重新回答、改问题、切版本时对话和 ACP 会话里的对不上：适配层关掉旧会话、开新的，带出处和到这里为止的对话。
贴图片：png / jpeg / webp / gif，4MB 以内（后端：Anthropic 单张约 5MB，一条消息 32MB），发 ACP 的 image 块。


2026-11-26 起回答里的几样用 assistant-ui 官方组件（MIT，从 `https://r.assistant-ui.com` 拷进 `packages/ask/src/ui/`（当时在阅读器包里），
只改引用路径、文字换中文，方便对着上游更新）：思考 `reasoning.tsx`、工具调用 `tool-fallback.tsx`、计划 `todo-list.tsx`、子 agent `agent-status.tsx`
（加上它们要的 `collapsible-root`、`surfaces`、`range`）。按钮、输入框经 `ui/controls.tsx` 转到 `@retainpdf/ui`，样式挂 `reader-ask-action`（只在提问窗里）。
动画靠 `tw-animate-css`、`tw-shimmer`（`packages/ask/styles/tailwind.css`，阅读器的 `styles/entry.css` 引入）。没选 Vercel AI Elements：要 motion 和 streamdown 四个插件，工具组件绑 AI SDK 的消息类型。

- 思考（`agent_thought_chunk`）：Reasoning 折叠条，思考中标题流光、预览区跟着滚，写完收起成「思考（N 秒）」。
- 工具调用（`tool_call` / `tool_call_update`）：ToolFallback，一行一个（状态图标、用时），展开看参数和结果；agent 要许可（`session/request_permission`）时
  换成它的 `approval`（allow_once → allow-once……），展开出「允许 / 总是允许 / 不允许」，选了回给 agent。关窗、停下时没回的许可按取消回掉。
- 计划（`plan`）：TodoList（pending / in_progress / completed → 待办 / 进行中 / 完成，进度「1/3」）。子 agent（`subagent_update`）：AgentStatus 胶囊。
- 底下一行：agent 名、输入 / 输出 token、缓存命中、上下文占比、费用、速度（有输出 token 按 token/s，没有按字/s 估）、首字、用时。
  分项 token 不在 ACP 标准里，读 `_meta.retainpdf.usage`（自带 agent）或 `_meta.usage`。
- 模型常写 `\( \)`、`\[ \]`，换成 `$`、`$$` 再给 remark-math（代码块里不动）。
- 发出去到第一段之前显示「在想…」，超过 10 秒改成「还在等 agent 回应……」。连不上（没开、设置不对、握手被拒）在回答位置写原因；连接断了下一问重开会话。

2026-11-26 第二轮细节（用户：「太粗糙了」「多用 icon，少写文字，字体变小」）：

- **页码能点**：回答正文（remark 插件把页码换成链接，`markdown-text` 的 `a` 认出来画成页码标签）、工具调用的标题和结果都认。
  只认 1…总页数；自带 agent 的系统提示词本来就要求引用写「（第 12 页）」，所以不用改后端。块级定位（带块编号）以后再说。
- **顶上引的那段**：公式渲染、两行截断不再拦腰切、展开、原文 / 译文切换。
- **工具调用**：不再是「用了 1 个工具」：只有一个时直接一行（kind 图标、标题、结果摘要、状态、用时，点开看全文和参数）；
  连着几个时组标题是用到的几种图标和「×N」，正在跑的写它的标题。等许可的照旧用 ToolFallback 的许可界面。
- **思考用时**：写成「思考 · 0.8s」，不到 1 秒也写（上游取整成 0 就不显示）；用时存进问答记录（`usage.thoughtMs`），重新打开照样有。
- **窗口**：浮动、贴右边（占满右侧，左边框拖宽窄）、放大三种；双击标题栏放大 / 还原。长的独立公式横着滚，不撑破窗口。
- **字号**：整窗 `--ui-text-md`（13px），照搬 Thread 的 Tailwind rem 字号在 `ask.css` 里压一档（标题、输入框、代码、思考条）。
- **用量**：一排图标 + 短数字（3.8k、2%、6.6s），悬停写全（`turnFooterItems`）。
- **空白时**：三个常问（讲讲这段、式子怎么来的、译文准不准），点了直接问。「回到最下面」挪到右边、变小，不压正文。

2026-11-26 回答里可以有**互动块**（OpenUI）：```` ```openui-lang ```` 代码块画成能动手的界面，一直开，去掉 `Image`、YouTube（留 HtmlView）；
提示词分层（前端生成 `contracts/openui/`，后端的 `openui_spec` / `openui_check` 教 agent），见
[方案](../../ops/planning/reader-ask/20261126-互动块分层提示词.md) 和 [提问窗包的 README](../../../frontend/packages/ask/README.md)。

## 出处和问答记录

- 右键时悬停框还没认出块（鼠标刚移过来、点在两段之间）：按点的位置找同一页最近的块（超过页高 15% 不算），带它的原文译文，
  不然问题里一个字都没有，模型只会说「看不到」（11-25 真机联调踩到）。
- 问答记录（后端 `ask-threads.v1`，按书存，一本最多 500 次）：宿主的 `port.threads` 驼峰 ↔ 接口下划线；存不上照样能问，只是关了书就没了。
- agent 那边每次打开是新会话（ACP 的 `session/load` 后端还没开）：第一问前面带出处和之前最近 12 条（最多 8000 字）。
- 本机 agent 没装：后端不再现场 npx 下载（下到一半会留坏缓存，见 11-25 联调），列表里 `available: false` 带 `install`；标题栏的插头图标
  点开是安装命令，能复制（11-26 前是窗口里单独一行「还能接本机的……（要先装）」）。

## 真机联调（2026-11-25）

自带 agent（`claude-haiku-5-5`）：思考摘要（英文，Anthropic 生成）先到，首字 2.5–3.3 秒；中文正文、KaTeX 对；追问接得上；
问答记录存、刷新读回、重新打开追问、删都过。踩到的：SDK 不给 `protocols` 时 Chrome 发子协议 `"undefined"`，桥不回，握手断（前端传 `[]`）；
悬停没认出块时问题不带文字（加了最近块）。

本机 Claude Code（`npm install -g @agentclientprotocol/claude-agent-acp` 以后）：用的是本机 Claude Code 自己的设置（这次 `claude-opus-5-5`，走用户的订阅）。
回答整段发来、段数少（所以段数少于 5 不算速度）；分项 token 在 `session/prompt` 结果的 `usage`，模型名在 `_meta["_claude/model"]`；
会自己调 `retainpdf mcp` 的 `view_page` 看这一页；这次没要许可（shell 命令直接跑了，失败）。

## 还没做

- 本机 Codex、Gemini 真机试（要先装 ACP 适配器）。
- 扫描页没字时把那一块的图发过去（agent `acceptsImages` 时）。
- agent 那边接着上次的会话（ACP `session/load`，后端开了再接）。
- 追问建议（ACP `prompt_suggestions_update`）、换模型 / 思考强度（`config_option_update`、`session/set_model`）、本书提问列表。
- 白板：回答以后进白板（[以 PDF 为主体](../../ops/planning/learning-system/20261125-以PDF为主体的提问白板笔记.md)）。
