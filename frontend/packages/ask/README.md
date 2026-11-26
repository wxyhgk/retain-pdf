# @retainpdf/ask：提问窗

阅读页「在这里提问 / 问这段」打开的对话窗。只说 **ACP**（[Agent Client Protocol](https://agentclientprotocol.com)），
能接 RetainPDF 自带的 agent（`retainpdf`、`retainpdf-pi`），也能接本机的 Claude Code、Codex、pi 等。

这个包可以**整个交给另一个人或另一个 AI 来改**：它不认识「书」「阅读页」「RetainPDF 的接口」，宿主（阅读页）只通过下面几样东西和它打交道。
边界由 `frontend/web/tests/architecture/ask-package-boundary.test.mjs` 守着，越界测试就红。

## 宿主给什么、拿回什么

```tsx
import AskWindow from "@retainpdf/ask/window";          // 懒加载：lazy(() => import("@retainpdf/ask/window"))
import { openAcpWebSocketSession } from "@retainpdf/ask/acp";
import type { AskPort, AskContext, AskMessage } from "@retainpdf/ask";

<AskWindow
  port={port}                       // AskPort：listAgents() 列 agent；openSession({ agentId }, handlers) 开一个 ACP 会话
  context={context}                 // AskContext：问的是哪儿——页码、悬停写全的位置、引用（原文 / 译文 / 选中）、发给 agent 的出处
  onClose={close}
  onShowContext={backToWhereAsked}  // 点标题栏的页码
  initialMessages={saved}           // 之前存的问答，接着显示
  onTurnDone={(messages, agentId) => save(messages)}  // 每答完一轮，整段交出去存
  onDelete={remove}                 // 不给就没有删除按钮
  onJumpToPage={(page) => goTo(page)}  // 回答里的页码点了
  pageCount={481}                   // 越界的数字不当页码
  katexStylesheetUrl={url}          // KaTeX 样式（宿主托管字体）
/>
```

- **`AskPort.openSession`** 一般就是拼好 WebSocket 地址交给 `openAcpWebSocketSession(url, handlers)`；会话要带的东西
  （RetainPDF 的任务号、模型配置、凭据引用）由宿主绑进地址或闭包里，窗口不管。
- **`AskContext.preamble`** 是新会话第一问前面带给 agent 的一段字。换 agent、重新回答、断线重连后会再带一次，后面跟着之前几轮。
  RetainPDF 的阅读页在 `packages/reader/src/ask/ask-context.ts` 里拼；**后端的自带 agent 按它最后一行解析任务号和块号，格式别改**。
- **`AskMessage`** 是存的格式（`role`、`text`、`thought`、`usage`）。后端 `ask-threads.v1` 按这个存，字段只增不改。

## 里面有什么

| 目录 | 干什么 |
|---|---|
| `src/contract.ts` | 上面那几个类型（主出口 `@retainpdf/ask` 只导出类型） |
| `src/acp/socket.ts` | `openAcpWebSocketSession`：握手、`session/new`、`session/prompt`、`session/cancel`（出口 `@retainpdf/ask/acp`） |
| `src/acp/parts.ts` | `session/update` → 一轮回答的各部分（正文、思考、工具调用、计划、子 agent、用量）；速度、用量那一行 |
| `src/acp/adapter.ts` | 接 assistant-ui 的 `LocalRuntime`：出处和之前几轮、边收边吐、许可、重新回答时重开会话 |
| `src/acp/messages.ts` | assistant-ui 的对话 ↔ 存的问答 |
| `src/window/` | 窗口（`AskWindow.tsx`）、标题栏、顶上引的那段、工具调用 / 计划 / 用量这几块（`blocks.tsx`）、能点的页码 |
| `src/ui/` | **照搬** assistant-ui 官方组件（MIT，https://r.assistant-ui.com）。每个文件开头写了改了什么，别处不动，方便对着上游更新 |
| `styles/ask.css` | 窗口的样式。颜色、字号、圆角只用宿主的皮肤变量（`--paper`、`--ink`、`--ui-text-*`、`--ui-radius-*`） |
| `styles/tailwind.css` | 照搬组件要的 Tailwind 部分（动画、流光、打字光标，并扫这个包的源码） |

依赖：`@assistant-ui/react`（对话）、`@assistant-ui/react-markdown` + remark-math / rehype-katex（Markdown 和公式）、
react-rnd（窗口拖动）、ACP SDK、`@retainpdf/ui`（按钮、下拉框）。

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

- 测试：在 `frontend/web` 里 `npm test -- tests/ask/*.test.mjs`（纯函数、假 ACP 端口，加一个 jsdom 里真把窗口画出来点一遍的）。
  架构边界：`npm test -- tests/architecture/ask-package-boundary.test.mjs`。
- 构建：`npm run build --workspace @retainpdf/ask`（tsc 出 `dist/`，`dist/` 要提交）。web 的 `npm run build` 会按顺序先建它。
- 看效果：web 的演示模式（`reader.html?mock=done&job_id=mock-job-20260415`）有一个假 ACP agent
  （`frontend/web/src/platform/mock/ask-agent.ts`）：思考、计划、工具调用、子 agent、要许可、带公式和页码的回答、用量。
- 更多背景（真机联调、踩过的坑）：`docs/core/frontend/reader-ask.md`。
