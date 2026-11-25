# 阅读页提问（2026-11 起）

在书页任意位置、或选中一段字，直接问 AI（右键或选中后按 `?`）；回答在浮动窗口里流式出来。问答窗只说 ACP，能接 RetainPDF 自带模型，
也能接本机的 Claude Code、Codex、Gemini CLI，2026-11-26 起是 ACP 官方登记表里的那些（pi、OpenCode、Qwen Code……）。按日期记录方案和决定，新决定写新文件，旧文件不改写。

| 日期 | 文档 | 内容 |
|---|---|---|
| 2026-11-25 | [阅读页提问](./20261125-阅读页提问.md) | 入口（右键「在这里提问 / 问这段」、选中后按 ?）、浮动回答窗、书页上的「?」；前端端口；问答窗用开源的（assistant-ui、streamdown）、协议用 ACP（接本机 Claude Code / Codex / Gemini，自带模型也包成 ACP agent）；要后端的：本机 ACP 桥、自带模型 agent、存问答记录 |
| 2026-11-25 | [后端 ACP 桥和自带 agent](./20261125-后端ACP桥和自带agent.md) | 用户定桥全放后端、先做 ACP；`GET /ai/agents`、`/ai/agents/{id}/acp`（WebSocket）；只给 `session/new` 补 `cwd` 和 `retainpdf mcp`；本机 agent 的闸门（单机、本机监听、本机 Host、没经过代理）；自带 agent 用 Python 起；分三步 |
| 2026-11-25 | [第 2 步：自带 agent](./20261125-第2步：自带agent.md) | 新包 backend/ask-agent：stdio 上的 ACP 服务端，三种协议流式（思考、正文、用量、缓存命中），取消、出错照 ACP；SSE 一律 UTF-8 |
| 2026-11-25 | [第 3 步：问答记录](./20261125-第3步：问答记录.md) | 按书存每次提问（锚点、agent、ACP 会话编号、问答）：数据库 v39 两张表挂在书的文件上、删书级联；书库领域；`/documents/{id}/ask-threads` 列、建、读、`PATCH` 整份换问答、删；契约 `ask-threads.v1`；上限；`session/load` 以后做 |
| 2026-11-25 | [自带 agent 读书](./20261125-自带agent读书.md) | 握手带 `job_id`，自带 agent 经后端读书（`reader/regions` 开给 AI 专用密钥，没配用本机主密钥）；**材料先给**（选中的字和那一块之外补所在的节、前后的块，不带字的取那一页、扫描页附图，系统提示词带目录），**工具一直在、模型自己定**（`read_pages` / `search_book` / `view_page`，只有 4 轮的防失控上限；用户否了按问题删工具的硬规则），靠提示词和实测控制；三种协议的工具调用 |
| 2026-11-26 | [ACP 官方登记表；pi 做我们自己的 agent（提案）](./20261126-ACP官方登记表.md) | 本机 agent 改从 ACP 官方登记表来：仓库里的快照（`ops/development/update_acp_registry.py` 刷新，运行时不联网）加人工名单 `agents.json`（旧 id 别名、推荐、不列的、npx 命令名）；PATH 上有命令才算装了，照旧不现场下载；列 42 个、装了的在前；本机握手实测（pi、Claude Code、Qwen、OpenCode、Kimi 成，Gemini 个人版被停、Grok 要登录）。**提案没定**：用 pi 扩展加读书工具做「RetainPDF + pi」，和 Python 自带 agent 的得失 |
