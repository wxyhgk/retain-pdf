# 阅读页提问（ACP）

2026-11-25 加。方案和用户的决定见 [阅读页提问](../../ops/planning/reader-ask/20261125-阅读页提问.md)，后端那一半（ACP 桥、自带 agent）见同目录的后端文档。

## 入口

2026-11-26 起提问窗对着一个主对话（接口 [主对话和记忆](../../api/16-AI/02-主对话和记忆.md)，方案
[主对话、副对话和记忆](../../ops/planning/reader-ask/20261126-主对话副对话和记忆.md)）：不再是「书上一处一个窗口」，换 agent 接着聊，
每一问带自己的出处。2026-11-27 起**每本书一个主对话**（[主对话按书分](../../ops/planning/reader-ask/20261127-主对话按书分.md)）：
打开取的是这本书的（`conversations.main(documentId)`，请求体带 `document_id`；没有书是全局那条），同一个阅读页里换了书就清掉窗口、取新书的；
用户层记忆照旧所有书共用。

- 书页上右键：画笔那一排上面多一行。没选字是「在这里提问」（问鼠标下面那一块，认不出块就问这一页这个位置）；选着书页上的字是「问这段」。
- 选着书页上的字按 `?`：同「问这段」。没选字时 `?` 照旧是快捷键帮助（提问在捕获阶段先拿到，只在选着字时拦）。
- 选中、悬停都**不弹东西**（[以前两次拿掉过选中浮条](../../ops/planning/reader-ask/20261125-阅读页提问.md)）。窗口开着时在书页上选字，
  只是更新输入框上面那条出处（「第 56 页 · 选中 37 字」，× 去掉，点开看引的那段）；发出去以后清掉，同一段不会再带第二次。
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
| `packages/reader/src/contracts/ask.ts` | 阅读页的端口：`listAgents`、`openSession({ agentId, jobId, conversationId })`、`conversations`（主对话、副对话，类型就是契约 `ask-conversations.v1` 的）、`threads`（以前按书存的问答，只读）；`ReaderAskAnchor`（问的是书上哪儿） |
| `packages/reader/src/ask/anchor.ts` | 右键 / `?` 那一刻拼出处：栏、页、页内位置、悬停认出的块、选中的字、章节（书签优先，没有就前面最近的标题） |
| `packages/reader/src/ask/ask-context.ts` | 书上的位置 → 提问窗的 `AskContext`（页码、位置、引用、发给 agent 的那段字 `anchorPreamble`、`_meta.retainpdf.selection`）；端口开会话时绑上任务号和对话编号，本机 agent 的前文取上下文接口的 `text` |
| `packages/reader/src/ask/conversation-messages.ts` | 纯函数：书上的位置 → 结构化出处；库里的消息 → 提问窗（问题上的小标签、副对话结论卡片、压缩点）；答完一轮 → 追加请求（问和答一起、幂等号、`memory_ids`）；「深挖」认那条回答 |
| `packages/reader/src/ask/use-ask-conversation.ts` | 主对话：打开取主对话、读最近 50 条，「看更早的」再往前取；每答完一轮追加（`compaction_due` 就让后端压）；「深挖」开副对话、「结束」让后端写结论；归档主对话 |
| `packages/reader/src/ask/use-ask-marks.ts`、`ReaderAskMarks.tsx`、`styles/ask-marks.css` | 书页左边白边的「?」：主对话里这本书的问（`GET /documents/{id}/ask-messages`，画在问的那一块上沿，点了打开主对话），以前按书存的（点了只读地看那一次） |
| `packages/reader/src/ask/ReaderAskExtension.tsx` | 提问作为阅读页的内置扩展（2026-11-27 起，[阅读页贡献表](../../ops/planning/reader-redesign/20261127-阅读页贡献表.md)）：往贡献表登记右键菜单项、每页的「?」、快捷键说明，提问窗是它自己画的；阅读页主组件不再直接接提问 |
| `packages/reader/src/ask/use-reader-ask.tsx` | 提问的接线：右键菜单项（右键那一下算）、`?` 键、窗口开着时跟着书页选区更新出处、「?」点了开哪个、懒加载的 `ReaderAskPanel` |
| `packages/reader/src/ask/ReaderAskPanel.tsx` | 把上面这些接到 `@retainpdf/ask/window` 的 `AskWindow` 上（标题栏的面包屑「主对话 › 副对话」、副对话的「结束，带回结论」）；**单独一块，第一次提问才加载** |
| `web/src/features/reader/domain/ask-port.ts`、`ask-conversations-port.ts` | 宿主端口：列 agent（`GET /api/v1/ai/agents`），拼 WebSocket 地址（api_key；自带类 agent 再带模型配置、凭据引用、job_id、`conversation_id`）交给 `@retainpdf/ask/acp` 的 `openAcpWebSocketSession`；主对话接口（压缩、副对话结论带设置里那条模型连接） |

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

2026-11-26 提问窗能**选模型和思考强度**（输入框那一行，assistant-ui 的 ModelSelector）：照 ACP 的 `configOptions`，本机 Claude Code、pi 自己给；
RetainPDF 的自带类 agent 由网页端口合成「模型」一项（设置里存的那几条连接，换了下一问按新连接重开会话，`ask-port.ts` 的 `builtinModelOption`）；
思考强度不在前端编（每个模型支持的档位不一样），由后端的自带 agent 按当前模型报 `thought_level`（后端 `feat/ask-thought-level`），报了才显示。详见[提问窗包的 README](../../../frontend/packages/ask/README.md)。

## 出处和对话

- 每一问带自己的出处：自带 agent 认 `_meta.retainpdf.selection`（`initialize` 报 `agentCapabilities._meta.retainpdf.selection`），问题前面不写那段字；
  本机 agent 只认字，照旧写。出处的块编号是右键 / 选字时悬停认出的那一块。
- 新会话的前文：自带 agent 报了 `conversation` 能力就自己取（握手带 `conversation_id`）；别的 agent 第一问前面带上下文接口拼好的 `text`（记忆 + 摘要 + 最近几轮）。
- RetainPDF + pi（后端 #231）：握手带 `conversation_id` 后自己取前文，但 pi-acp 的 `initialize` 不报 `_meta.retainpdf`，web 端口按编号 `retainpdf-pi`
  标上 `conversation`（`withPiConversation`），窗口不再拼前几轮；它收不到 `_meta`，出处那段字照写。它的「已记住」不在工具卡片里：一轮答完阅读器按
  `GET /ai/memories?source_conversation_id=…&created_after=<这一轮开始前 2 秒>` 查 agent 新记的，画在那条回答下面，编号放进追加回答的 `memory_ids`
  （以后经 `retainpdf mcp` 的本机 agent 也走这条）。
- 「已记住」：自带 agent 的 `remember` 完成时 `tool_call_update` 的 `_meta.retainpdf.memory`，画在回答正文下面（工具卡片收起来也看得到），撤销调 `DELETE /ai/memories/{id}`；
  这一轮新记的编号追加时放进 `memory_ids`。重新打开窗口时只画回答，不再画「已记住」（工具调用不存）。
- 「深挖」：回答底下的分叉图标，从这条开副对话（标题从回答第一句截）；副对话的「结束，带回结论」让后端用设置里的模型写结论（最多等 180 秒），
  回到主对话末尾是一张结论卡片，卡片底下「看副对话」。结束了的副对话接着问会先再开它。
- 改一条已发出的问、重新回答（后端 #232，用户定「后面的作废，从这里重问」）：适配层认出这一问落在已有的位置上（`initialIds` + 答过的路），
  先交给宿主 `onRewrite`：阅读器把窗口里的编号换成库里的（刚追加的记在 `storedIds`），`POST …/messages/{id}/supersede`（已经作废的不算错），
  再开新会话（前文里没有作废的），这一问照用原来的出处；答完追加时问带 `edited_from`。读回来时作废的不画，改后的问上面画「改过」，
  点开看原来的问和回答开头一小段。没存上的那一轮（出错的）改了就只在窗口里分叉。
- 回答里选字引用回复（2026-11-27，用户要的）：在窗口里的回答上选一段字，输入框上面出「引用回答 · N 字」（不弹菜单，× 去掉，点开看那段）；
  发问时这段写成 Markdown 引用（每行 `> `、空一行）放在问题前面，agent 看得到、存进对话、改问题和重新回答照带；问题气泡开头的引用画成引用框。
  公式按 KaTeX 里的 TeX 取回（`$…$`），超过 600 字截断。只认两头都在回答里的选区（自己的问题、书页上的选字不算，书页的照旧走出处）。
  代码在 `packages/ask/src/window/answer-quote.tsx`；照搬的 Thread 为它加了 `prepareSend`（回车和发送键发出去前改输入框的字）和 `UserText`。
- 归档主对话：标题栏的归档图标，之后开一个新的主对话（只露归档，不露删除，用户 11-26 定）。
- 记忆面板：标题栏的记忆图标打开右边的抽屉（`packages/reader/src/ask/ReaderMemoryPanel.tsx`，端口 `port.memories`）。「关于你 / 这本书」两层，能搜、加、改、删；
  最上面「让 AI 使用记忆」读写 `/ai/ask-settings`（存在后端库里，不在浏览器设置里），关着时写明「AI 现在用不到这些记忆，也不会记新的」。
  阅读页为它引了组件库的 `button.css`、`choice.css`、`sheet.css`（`packages/reader/styles/entry.css`）。

- 右键时悬停框还没认出块（鼠标刚移过来、点在两段之间）：按点的位置找同一页最近的块（超过页高 15% 不算），带它的原文译文，
  不然问题里一个字都没有，模型只会说「看不到」（11-25 真机联调踩到）。
- 以前按书存的问答（后端 `ask-threads.v1`）2026-11-26 起只读：书页上照旧画「?」，点了在窗口里只读地看（没有输入框），能删；新的问题都进主对话。
- 本机 agent 没装：后端不再现场 npx 下载（下到一半会留坏缓存，见 11-25 联调），列表里 `available: false` 带 `install`；标题栏的插头图标
  点开是安装命令，能复制（11-26 前是窗口里单独一行「还能接本机的……（要先装）」）。

## 真机联调（2026-11-25）

自带 agent（`claude-haiku-5-5`）：思考摘要（英文，Anthropic 生成）先到，首字 2.5–3.3 秒；中文正文、KaTeX 对；追问接得上；
问答记录存、刷新读回、重新打开追问、删都过。踩到的：SDK 不给 `protocols` 时 Chrome 发子协议 `"undefined"`，桥不回，握手断（前端传 `[]`）；
悬停没认出块时问题不带文字（加了最近块）。

本机 Claude Code（`npm install -g @agentclientprotocol/claude-agent-acp` 以后）：用的是本机 Claude Code 自己的设置（这次 `claude-opus-5-5`，走用户的订阅）。
回答整段发来、段数少（所以段数少于 5 不算速度）；分项 token 在 `session/prompt` 结果的 `usage`，模型名在 `_meta["_claude/model"]`；
会自己调 `retainpdf mcp` 的 `view_page` 看这一页；这次没要许可（shell 命令直接跑了，失败）。

## 2026-11-27 一轮改进

用户贴来七条（入口太隐蔽、窗口不记、常问只在空白时有、问完译文改不回去、看图得自己截、选字覆盖出处、归档手滑），逐条做了，
方案和取舍见 [提问窗七处改进](../../ops/planning/reader-ask/20261127-提问窗七处改进.md)。

- **入口**：右下角小球里多「提问」（提问扩展的 `toolbarItems`），不带出处地开 / 关这本书的主对话；用户指南 `frontend/web/guide/reader.md` 补「问 AI」。
- **窗口记住**：摆法、浮动位置大小、贴右边的宽度、上次用的 agent 记在本机；**贴右边时书页让位**：贡献表的 `reserveRight` 口子，
  阅读页根节点带 `--reader-right-inset`，书页、底栏、小球往左让（窄屏让了书页不到 480px 就不让）。
  同一天改成书页区（`.reader-stage`）让出 `--reader-stage-right`；右边只停一个：提问窗贴右边时 Markdown 面板关掉，Markdown 后开时
  提问窗变回浮动（`dockTaken`），见 [书页区和右边一个停靠位](../../ops/planning/reader-redesign/20261127-书页区和右边一个停靠位.md)。
- **常问跟着出处**：带着出处、输入框空着时出处下面一排「讲讲这段 / 式子怎么来的 / 译文准不准」，点了直接带这处问。
- **改这段译文**：问题认出了块、这本书能改、这块能改时，回答底下一个按钮：跳到那块、打开编辑框，先填回答里选着的字
  （不然最后一个 ```` ```译文 ```` 代码块）；存还是自己点。阅读页接口加 `editBlock(itemId, draft?)`。
  顺手修了：这次打开刚问的问题，标签点了不跳（`contextSelection` 两种写法都认）。
- **术语加进术语表**：记忆面板里术语类（或这本书里写成「X 译为 Y」的）记忆多「加进术语表」，原文、译法先拆好，挑一张表或新建
  「阅读时定的术语」；同一个原文换成新译法，整份保存带 `expected_updated_at`。端口 `glossaries`。
- **截图**：右键「截一块问」拖出一块（罩子 `ReaderAskCrop.tsx`，截图时占着指针），输入框那一行「带上这一页」；有 pdf.js 文档按 1600 像素宽
  重新画，没有从屏幕画布裁（`pdf/region-image.ts`），走和「+」同一个附件适配器，发 ACP 的 image 块。
- **选字不覆盖**：已经带着出处时书页上新选的字不再悄悄换掉，输入框上面问「换成这段 / 再加一段 / ×」；一问最多三处，另外几处写进 `AskContext.extra`。
- **归档**：先在标题栏里确认；「以前的对话」列这本书归档了的主对话，点了只读地看。端口 `conversations.archived`。
- **太宽的公式、表格**：1.5 倍以内缩到放得下，再宽横着滚、对话区「放大看」。

交给后端（还没做）：自带 agent 的提示词在给改译建议时，把建议的整段译文写进 ```` ```译文 ```` 代码块，「改这段译文」就能直接填；
现在要用户自己在回答里选那段字。

## 还没做

- 本机 Codex、Gemini 真机试（要先装 ACP 适配器）。
- 扫描页没字时把那一块的图发过去（agent `acceptsImages` 时）。
- agent 那边接着上次的会话（ACP `session/load`，后端开了再接）。
- 追问建议（ACP `prompt_suggestions_update`）、换模型 / 思考强度（`config_option_update`、`session/set_model`）、本书提问列表。
- 白板：回答以后进白板（[以 PDF 为主体](../../ops/planning/learning-system/20261125-以PDF为主体的提问白板笔记.md)）。
