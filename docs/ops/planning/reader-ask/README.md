# 阅读页提问（2026-11 起）

在书页上右键或选中后按 `?` 提问，回答在浮动窗口里流式出来；问答窗只说 ACP，能接 RetainPDF 自带模型，也能接本机的 Claude Code、Codex、Gemini CLI。
按日期记录方案和决定，新决定写新文件，旧文件不改写。前端的方案（「20261125-阅读页提问.md」）在前端分支 feat/reader-ask 上，合进来时在下表加一行。

| 日期 | 文档 | 内容 |
|---|---|---|
| 2026-11-25 | [后端 ACP 桥和自带 agent](./20261125-后端ACP桥和自带agent.md) | 用户定桥全放后端、先做 ACP；`GET /ai/agents`、`/ai/agents/{id}/acp`（WebSocket）；只给 `session/new` 补 `cwd` 和 `retainpdf mcp`；本机 agent 的闸门（单机、本机监听、本机 Host、没经过代理）；自带 agent 用 Python 起；分三步 |
| 2026-11-25 | [第 2 步：自带 agent](./20261125-第2步：自带agent.md) | 新包 backend/ask-agent：stdio 上的 ACP 服务端，三种协议流式（思考、正文、用量、缓存命中），取消、出错照 ACP；SSE 一律 UTF-8 |
