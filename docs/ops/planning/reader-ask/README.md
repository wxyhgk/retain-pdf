# 阅读页提问（2026-11 起）

在书页任意位置、或选中一段字，直接问 AI（右键或选中后按 `?`）；回答在浮动窗口里流式出来。问答窗只说 ACP，能接 RetainPDF 自带模型，
也能接本机的 Claude Code、Codex、Gemini CLI。按日期记录方案和决定，新决定写新文件，旧文件不改写。

| 日期 | 文档 | 内容 |
|---|---|---|
| 2026-11-25 | [阅读页提问](./20261125-阅读页提问.md) | 入口（右键「在这里提问 / 问这段」、选中后按 ?）、浮动回答窗、书页上的「?」；前端端口；问答窗用开源的（assistant-ui、streamdown）、协议用 ACP（接本机 Claude Code / Codex / Gemini，自带模型也包成 ACP agent）；要后端的：本机 ACP 桥、自带模型 agent、存问答记录 |
| 2026-11-25 | [后端 ACP 桥和自带 agent](./20261125-后端ACP桥和自带agent.md) | 用户定桥全放后端、先做 ACP；`GET /ai/agents`、`/ai/agents/{id}/acp`（WebSocket）；只给 `session/new` 补 `cwd` 和 `retainpdf mcp`；本机 agent 的闸门（单机、本机监听、本机 Host、没经过代理）；自带 agent 用 Python 起；分三步 |
