# @retainpdf/ask：提问窗

阅读页「在这里提问 / 问这段」打开的对话窗。只说 **ACP**（[Agent Client Protocol](https://agentclientprotocol.com)），
能接 RetainPDF 自带的 agent（`retainpdf`、`retainpdf-pi`），也能接本机的 Claude Code、Codex、pi 等。

这个包可以**整个交给另一个人或另一个 AI 来改**：它不认识「书」「阅读页」「RetainPDF 的接口」，宿主（阅读页）只通过下面几样东西和它打交道。
边界由 `frontend/web/tests/architecture/ask-package-boundary.test.mjs` 守着，越界测试就红。

## 宿主给什么、拿回什么

```tsx
import AskWindow from "@retainpdf/ask/window";          // 懒加载：lazy(() => import("@retainpdf/ask/window"))
import { openAcpWebSocketSession } from "@retainpdf/ask/acp";
import type { AskPort, AskContext, AskMessage, AskTurnRecord } from "@retainpdf/ask";

<AskWindow
  port={port}                       // AskPort：listAgents() 列 agent；openSession({ agentId }, handlers) 开一个 ACP 会话；conversationPreamble() 新会话的前文
  context={pending}                 // AskContext | null：下一问带的出处（输入框上面的小标签、那段字、_meta）；发问那一刻读
  onContextUsed={() => setPending(null)}  // 发出去了：宿主清掉，不然下一问还带
  onContextClear={() => setPending(null)} // 小标签上的 ×
  onClose={close}
  title={<Breadcrumb />}            // 标题栏左边（主对话 / 副对话）
  headerActions={<ArchiveButton />} // 标题栏右边多放的按钮
  footer={<SideBar />}              // 对话下面多放的一条
  onShowContext={(context) => goTo(context)}  // 点问题上面的小标签
  initialMessages={saved}           // 之前存的问答，接着显示（id、问题的 context、结论卡片 / 压缩点的 marks）
  earlier={{ loading, load }}       // 「看更早的」；没有更早的给 null
  onTurn={(turn: AskTurnRecord) => append(turn)}  // 每答完一轮：问题、回答、出处、会话、这一轮记下的记忆
  onFork={(message) => openSide(message)}         // 回答底下的「深挖」；不给就没有
  onOpenSide={(sideId) => showSide(sideId)}       // 结论卡片上的「看副对话」
  onForgetMemory={(id) => forget(id)}             // 「已记住」的撤销
  readOnly={false}                  // 只能看（没有输入框）
  onDelete={remove}                 // 不给就没有删除按钮
  onJumpToPage={(page) => goTo(page)}  // 回答里的页码点了
  pageCount={481}                   // 越界的数字不当页码
  katexStylesheetUrl={url}          // KaTeX 样式（宿主托管字体）
  onLayout={({ mode, width }) => …}  // 摆法变了（浮动 / 贴右边 / 放大）：宿主据此给页面让出右边
  answerAction={action}             // AskAnswerAction：回答底下宿主加的一个动作（阅读页「改这段译文」）
  attachTools={[tool]}              // AskAttachTool[]：输入框那一行「带上……」（阅读页「带上这一页」的截图）
  attachRequest={{ id, files }}     // 宿主从外面塞进来的附件（框选截图），id 变了就加
  contextOffer={offer}              // AskContextOffer | null：已经带着出处时宿主又选了一处，问「换成 / 再加 / 不要」
/>
```

- **`AskPort.openSession`** 一般就是拼好 WebSocket 地址交给 `openAcpWebSocketSession(url, handlers)`；会话要带的东西
  （RetainPDF 的任务号、模型配置、凭据引用）由宿主绑进地址或闭包里，窗口不管。
- **`AskContext`** 是一问的出处：`preamble` 写在这一问前面（agent 报了 `capabilities.selection` 就不写，它认 `meta`），`meta` 放进
  `session/prompt` 的 `_meta`。重新回答照用那一问的出处。RetainPDF 的阅读页在 `packages/reader/src/ask/ask-context.ts` 里拼；
  **后端的自带 agent 按 preamble 最后一行解析任务号和块号，格式别改**。
- **新会话的前文**：agent 报了 `capabilities.conversation`（自己取）就不带；宿主给了 `AskPort.conversationPreamble` 用它；不然拼窗口里看得到的前几轮。
- **`AskSession.capabilities`** 是 `initialize` 里的 `agentCapabilities._meta.retainpdf`（`selection`、`conversation`、`memory`），`socket.ts` 读。
- **`AskMessage`** 是存的格式（`role`、`text`、`thought`、`usage`，2026-11-26 加 `id`、`context`、`marks`）。字段只增不改。
- **引用回复**：在回答上选字，输入框上面出「引用回答」，发问时写成「> …」放在问题前面，问题气泡里开头的引用画成引用框（`src/window/answer-quote.tsx`）。
  照搬的 Thread 为它加了 `prepareSend`、`UserText` 两个插槽。
- **2026-11-27 加的**（[方案](../../../docs/ops/planning/reader-ask/20261127-提问窗七处改进.md)）：
  - 窗口的摆法、浮动位置大小、贴右边的宽度、上次用的 agent 记在本机（`window-memory.ts`，`use-window-layout.ts`）；放大不记。
  - 带着出处、输入框空着时，出处下面一排常问（`PendingStarters`）；空白对话带着出处时不再在下面重复。
  - `AskContext.extra`：另外几处出处（一段字），认结构化出处的 agent 也照带（`_meta` 只放第一处）。
  - 回答里太宽的独立公式、表格：1.5 倍以内缩到放得下（`style.zoom`），再宽横着滚、对话区出「放大看」（`wide-blocks.ts`）。
- **「已记住」**：工具卡片完成时 `_meta.retainpdf.memory` 有值，回答正文下面画「已记住：……（撤销）」（`src/window/conversation.tsx`）。

## 里面有什么

| 目录 | 干什么 |
|---|---|
| `src/contract.ts` | 上面那几个类型（主出口 `@retainpdf/ask` 只导出类型） |
| `src/acp/socket.ts` | `openAcpWebSocketSession`：握手、`session/new`、`session/prompt`、`session/cancel`（出口 `@retainpdf/ask/acp`） |
| `src/acp/parts.ts` | `session/update` → 一轮回答的各部分（正文、思考、工具调用、计划、子 agent、用量）；速度、用量那一行 |
| `src/acp/adapter.ts` | 接 assistant-ui 的 `LocalRuntime`：出处和之前几轮、边收边吐、许可、重新回答时重开会话 |
| `src/acp/messages.ts` | assistant-ui 的对话 ↔ 存的问答 |
| `src/window/` | 窗口（`AskWindow.tsx`）、标题栏、顶上引的那段、工具调用 / 计划 / 用量这几块（`blocks.tsx`）、能点的页码 |
| `src/openui/` | 回答里的互动块：```` ```openui-lang ```` 代码块用 OpenUI 的渲染器画成能动手的界面（`OpenUIBlock.tsx`，单独一块懒加载）；组件库去掉了 `Image`、YouTube（`library.ts`） |
| `scripts/openui-spec.mjs` | 从同一个组件库生成给后端的分层说明 `contracts/openui/`（`npm run generate:openui`）；组件库或 OpenUI 升级了要重新生成 |
| `src/ui/` | **照搬** assistant-ui 官方组件（MIT，https://r.assistant-ui.com）；思考强度滑块 `elements/effort-slider.tsx` 改自 [zanwei/claude-model-selector](https://github.com/zanwei/claude-model-selector)（MIT）。每个文件开头写了改了什么，别处不动，方便对着上游更新 |
| `styles/ask.css` | 窗口的样式。颜色、字号、圆角只用宿主的皮肤变量（`--paper`、`--ink`、`--ui-text-*`、`--ui-radius-*`） |
| `styles/tailwind.css` | 照搬组件要的 Tailwind 部分（动画、流光、打字光标，并扫这个包的源码） |

依赖：`@assistant-ui/react`（对话）、`@assistant-ui/react-markdown` + remark-math / rehype-katex（Markdown 和公式）、
react-rnd（窗口拖动）、ACP SDK、`@retainpdf/ui`（按钮、下拉框）。

## 选模型、思考强度

输入框那一行（「+」旁边）有 agent 的设置，都是 assistant-ui 的 ModelSelector（`src/ui/elements/model-selector.tsx`）：
一个按钮写「模型 · 思考强度」（前面是厂商图标），点开是带搜索、分组的模型列表，底下是思考强度的胶囊滑块（`src/ui/elements/effort-slider.tsx`，仿 Claude 桌面版：拖到刻度附近会吸过去，松手弹到最近一档；方向键、Home、End 也能换），
别的设置项（模式、快速……）收在「更多」里（`src/window/AskModelPicker.tsx`）。

- **图标多、字少**：标题栏选 agent 只有图标（自带模型是书本、retainpdf-pi 是 π，别的按名字认厂商，`src/window/BrandIcon.tsx`）；
  回答底下的用量只是一个图标，点开才是模型、token、缓存、速度、首字、用时。厂商图标来自 [lobe-icons](https://github.com/lobehub/lobe-icons)（MIT，
  `@lobehub/icons-static-svg`，开发依赖），`npm run generate:icons` 挑用得上的生成 `src/window/brand-icons.generated.ts`。
- **思考强度**：档位、名字都照 agent 报的（ACP `thought_level`），前端不编、不翻译。颜色只看档位在列表里排第几（第一档灰，往后绿 → 橙 → 红，`effortColor`），滑块走过的那段轨道从灰渐到这个颜色；只有一档不画滑块；
  开了思考（不是第一档）时，输入框的边框、光晕、发送按钮和整个窗口的边框都染上这个颜色（`AskWindow` 写 `--ask-effort-color`、`data-effort`）。
- **模型水印**：对话区背景正中放当前模型厂商的标志（很淡、在字后面、点不到；没有模型这一项就用 agent 的）。
- 开着弹层时 Esc 只关弹层，不关窗。数据照 ACP 的 **session config options**：

- agent 开会话时给 `configOptions`（`category` 是 `model` / `thought_level` / `mode`……），窗口用 `session/set_config_option` 改，agent 推 `config_option_update` 也跟着变。
  本机 Claude Code、pi 都给（2026-11-26 本机握手看过：Claude Code 有模型、思考强度、快速、ultracode、模式五项）。
- 选了 agent 就提前开会话（`prepare`），不用先问一句就能看到有哪些模型。
- 用户选过的值按 agent 记在本机浏览器（`window/config-memory.ts`），新会话开了再设一次（`acp/config.ts` 的 `pendingConfig`）；
  开会话时也交给宿主（`AskPort.openSession` 的 `config`）。
- 有的设置要在握手时定（`AskSession.reopenOnConfigChange`，可以按设置项判断。RetainPDF 的自带 agent：「模型」就是设置里存的连接，换了要换密钥和地址）：改了关掉会话，下一问按新设置重开，之前几轮照样带过去；别的设置（思考强度）照常 `session/set_config_option`。
- agent 一个设置项都不给，就什么都不画。

## 回答里的互动块（OpenUI）

agent 在回答里写 ```` ```openui-lang ```` 代码块，窗口用 [OpenUI](https://github.com/thesysdev/openui) 的渲染器画成界面（滑块、图表、闪卡、公式、示意图……）：
流式时边收边画；按钮的 `@ToAssistant` 当作用户的下一问发出去，`@OpenUrl` 只开 http(s)；写错了显示原文和「让它修」（把解析错误发回给 agent）。
深浅色按窗口底色判断。教 agent 怎么写是**后端**的事（分层提示词、`openui_spec` / `openui_check` 工具），这个包只负责生成说明文件和画。
方案见 `docs/ops/planning/reader-ask/20261126-互动块分层提示词.md`。

- 组件库的公式组件 import 了 KaTeX 的 CSS：宿主打包时要把 `katex/dist/katex.min.css` 当空的（RetainPDF 在 web 的 `build-js-bundle.mjs`），KaTeX 样式由 `katexStylesheetUrl` 给。
- OpenUI 的 lang-core 在 Node 里有抽样遥测（默认关）；生成脚本和测试都显式设了 `OPENUI_TELEMETRY_DISABLED=1`。浏览器里不发。

## 样式怎么接

宿主的 Tailwind 入口里：

```css
@import "../../ask/styles/tailwind.css";              /* 不带 layer */
@import "../../ask/styles/ask.css" layer(pages);
```

shadcn 那套主题变量（`--color-muted`、`--color-foreground` 等）由宿主给（RetainPDF 在阅读器的 `styles/shadcn-theme.css`）。

## 改的时候守的规矩

- 不引宿主：不许 `import` 阅读器、web、`@retainpdf/api`，相对路径不出 `src/`。要宿主的东西，加到 `AskWindowProps` 或 `AskPort` 上。
- 宿主只从三个出口引：`@retainpdf/ask`、`@retainpdf/ask/window`、`@retainpdf/ask/acp`。
- 自己写的文件（`src/ui/` 以外）每个不超过 380 行。
- 按钮、下拉框用 `@retainpdf/ui`，不写原生控件；CSS 不写死字号、圆角（`src/ui/` 照搬的除外）。
- 界面文字用简体中文，图标为主、字放悬停提示里，整窗 13px。
- 改了接口（`contract.ts`、`AskWindowProps`），同时改 `packages/reader/src/ask/ReaderAskPanel.tsx`（阅读页怎么接）和这份 README。

## 怎么跑、怎么看

- 测试：在 `frontend/web` 里 `npm test -- tests/ask/*.test.mjs`（纯函数、假 ACP 端口、jsdom 里真把窗口画出来点一遍、互动块的说明是最新的、检查器对错程序）。
  架构边界：`npm test -- tests/architecture/ask-package-boundary.test.mjs`。
- 构建：`npm run build --workspace @retainpdf/ask`（tsc 出 `dist/`，`dist/` 要提交）。web 的 `npm run build` 会按顺序先建它。
- 看效果：web 的演示模式（`reader.html?mock=done&job_id=mock-job-20260415`）有一个假 ACP agent
  （`frontend/web/src/platform/mock/ask-agent.ts`）：思考、计划、工具调用、子 agent、要许可、带公式和页码的回答、一个能拖滑块的互动块、用量。
- 更多背景（真机联调、踩过的坑）：`docs/core/frontend/reader-ask.md`。
