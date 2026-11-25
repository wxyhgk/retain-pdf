# 阅读页提问（ACP）

2026-11-25 加。方案和用户的决定见 [阅读页提问](../../ops/planning/reader-ask/20261125-阅读页提问.md)，后端那一半（ACP 桥、自带 agent）见同目录的后端文档。

## 入口

- 书页上右键：画笔那一排上面多一行。没选字是「在这里提问」（问鼠标下面那一块，认不出块就问这一页这个位置）；选着书页上的字是「问这段」。
- 选着书页上的字按 `?`：同「问这段」。没选字时 `?` 照旧是快捷键帮助（提问在捕获阶段先拿到，只在选着字时拦）。
- 选中、悬停都**不弹东西**（[以前两次拿掉过选中浮条](../../ops/planning/reader-ask/20261125-阅读页提问.md)）。
- 宿主不给 `ReaderAskPort` 就没有这些入口。现在只有演示模式给（假 agent，`frontend/web/src/platform/mock/ask-agent.ts`）；
  后端桥合了以后 web 宿主换成 WebSocket 那个端口。

## 代码

| 文件 | 干什么 |
|---|---|
| `packages/reader/src/contracts/ask.ts` | 端口：`listAgents`、`openSession`（ACP 会话：`prompt`、`cancel`、`close`，回调 `onUpdate`、`onPermission`）；`ReaderAskAnchor`（问的是哪儿） |
| `packages/reader/src/ask/anchor.ts` | 右键 / `?` 那一刻拼出处：栏、页、页内位置、悬停认出的块、选中的字、章节（书签优先，没有就前面最近的标题） |
| `packages/reader/src/ask/acp-parts.ts` | ACP `session/update` → 一轮回答的各部分：正文、思考、工具调用、计划、子 agent、用量；速度和底下那一行 |
| `packages/reader/src/ask/acp-adapter.ts` | 接 assistant-ui 的 `LocalRuntime`：第一句前面带出处；边收边吐；许可等用户点；换 agent 重开会话 |
| `packages/reader/src/ask/ReaderAskWindow.tsx` | 浮动窗口（react-rnd）+ assistant-ui 的对话、输入框 + streamdown 渲染回答（KaTeX 公式）；**单独一块，第一次提问才加载** |
| `packages/reader/src/ask/ReaderAskMarks.tsx` | 书页左边白边的「?」：这次打开里问过的地方，点了重新打开那次问答（对话按 assistant-ui 的导出存在内存里） |
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

## 还没做

- 接真的后端桥（等后端 `feat/acp-bridge` 合并）；自带 agent 的模型配置从设置里的翻译模型取。
- 扫描页没字时把那一块的图发过去（agent `acceptsImages` 时）。
- 问答记录存后端、下次打开还在（ACP `session/load`）；现在重新打开只是界面上接着显示，agent 那边是新会话。
- 白板：回答以后进白板（[以 PDF 为主体](../../ops/planning/learning-system/20261125-以PDF为主体的提问白板笔记.md)）。
