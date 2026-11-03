# RetainPDF 不要自己的 AI

2026-11-03。

## 为什么

问用户「打开书时右栏（AI）收不收起」时，用户答「不要我们的 AI 了」；再问是哪一个，选了 **RetainPDF 自己的 AI**。
产品里只留笔记软件 Studio 的 AI（`frontend/studio`，另一个会话在把它收敛成以 pi 为主）。阅读页上原来有三个 AI 入口
（阅读页的 agent 终端、主页「AI 问答」、Studio 的 AI），删到一个。

## 前端删了什么（这一份）

- 阅读页：dock 里的「AI」（宿主槽位面板 `terminal` = fx agent 终端）和 agent 画板；整套宿主槽位面板机制
  （`reader-host-panels.ts`、`ReaderHostPanelShell`）只为它存在，一起删；AI 回答渲染、引用、会话
  （`packages/reader/src/shared/ai`、`components/ai`、`ai.ts`、`runtime/ai.ts`、`ai.css` 等样式、`./ai` `./runtime/ai` `./ai.css`
  出口），`credentialsPort`、终端和画板适配键。
- 主页：「AI 问答」页签（`features/ask`，约 4900 行），`?tab=ask` 的旧深链落回图书馆。
- 设置：「AI Agent」那张卡（它配的是助手自己的模型，不是翻译的）。
- 接口层：`@retainpdf/api` 的 ai、conversations、document-operations、agent-operation-model、agent-runtime-settings 和
  `materializeCollectionWorkspace`；`@retainpdf/domain/ai`；web 的对应 domains 和 mocks；`features/fx-terminal`。
- 依赖：阅读器包的 `@assistant-ui/react`、`ai`、`@ai-sdk/react`、`katex`、`markstream-react`；web 的 `@assistant-ui/react`、
  `@xterm/xterm`、`@xterm/addon-fit`；构建时拷 KaTeX 字体那段和 `dist/css/fonts`。
- 早就没有页面在用的「AI 助手」弹窗编号和样式（`ai-assistant-dialog`、`ai-assistant.css`）。

## 留着的

- 放在 Studio 里时阅读页竖条上的「AI」：Studio 在 `hello` 里认 `ask-ai` 才出现，点了打开 Studio 的 AI（`hostAi`）。单独打开
  RetainPDF 时没有 AI。
- Markdown 面板（它的公式用 MathJax，不靠 KaTeX）、翻译用的模型和密钥、翻译 agent。

## 还没做（等后端）

- 桌面版启动时还拉起 Python 的 AI 服务（`desktop/src/main/plugins/backend.js` 的 `startRetainpdfAiService`、`backend-env.js`
  的 `RUST_API_AI_*` / `RETAIN_AI_*`）：打包版里 Rust 也会自己监督这个进程（`RUST_API_AI_SUPERVISE`），CI 还会打包它。
  和后端删 `backend/ai`、`/ai/*` 一起改，不单改桌面壳。在那之前它空转，前端不再调它。
- 后端不再被前端调用的接口：`/api/v1/ai/ask`、`/ai/runtime-config`、`/ai/conversations…`、`/ai/operations…`、`/ai/terminal`、
  `/jobs/:job_id/ai/board…`、`/collections/:id/agent-workspace`。清单发给后端会话，由它删。
