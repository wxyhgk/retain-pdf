# 删掉 RetainPDF 自己的 AI

2026-11-03。用户定：不要 RetainPDF 自己的 AI 了，产品里只留 Studio（`frontend/studio`）的那一个 AI。
前端会话先拿掉了前端的全部调用（合进 main 以后发来不再调用的接口清单），后端再删。删库表另外问过，用户选「库表留着」。

## 删了什么

- Python AI 服务 `backend/ai`（问答、会话、Agent、fx 运行时、终端、工作区、画板）。
- Rust 包 `retainpdf-ai`（AI 代理和网关、Agent 能力令牌、计算、文档操作、运行时会话）；rust_api 里监督 AI 进程的
  `runtime/ai_supervisor.rs`、`AppState` 的 `ai_gateway` 和 `agent_capabilities`、请求头 `X-RetainPDF-Agent-Capability`
  的认证；配置 `AiProxyConfig`、`AiServiceConfig`（`RUST_API_AI_*`），以及本来就没人用的 `ReaderLlmConfig`、`RagConfig`。
- 接口 37 个（158 → 121）：`/api/v1/ai/*`（问答、运行配置、会话、文档操作、计算、终端）、`/api/v1/internal/agent/*`、
  `/api/v1/jobs/:id/ai/board`（画板，任务接口从 9 类变 8 类）、`POST /api/v1/collections/:id/agent-workspace`、
  `GET /api/v1/documents/:id/agent-versions`。
- 书库包的 AI 对话服务；合集工作区只留删合集时清目录（以前建过的工作区还在磁盘上）。
- 核心包给 AI 工作区拼路径的 `resolve_ai_dir`、`resolve_ai_board_dir`、`MergedJobId::ai_dir`。
- pipeline 的 `document_operations`、`retainpdf-pipeline document-operation`。
- 契约 `ai-ask.v1`、`ai-conversations.v1`、`agent-calculation.v1`、`public-document-operation.v1`、`runtime-config.v1`。
- `tests/e2e/agent`（AI 助手的端到端工具）；开发栈的 `--runtime`、`--ai-port`、fx 预检；Docker 镜像里的 AI 服务和 fx；
  nginx 里 `/api/v1/ai/ask` 那段；CI 的 AI 服务测试、`requirements-ai-service.txt` 的生成和桌面打包时安装它；
  `uv.lock` 里只给 AI 服务用的 15 个包。
- 凭据库删凭据时不再查 AI 运行时配置（`secrets/ai-runtime.json`）的引用。

## 留着的

- 库里的对话、文档操作、计算记录表和数据库层（`database/retainpdf-db`）；同步照旧带着这些表。
- 健康检查的 `ai_service` 键（旧字段不删）：`/health` 固定 `disabled`，`/ready` 的 `components.ai_service` 固定不需要。
- 翻译用的大模型、凭据、模型执行器、`/api/v1/internal/model/jobs/...`（翻译工作进程调模型）、翻译 agent。
- Studio 的 AI 读书用的只读接口：`/documents/:id/reading`、`/search`、`/jobs/:id/reader/*`。

## 要前端跟着改的

桌面壳归前端会话：`frontend/desktop/src/main/plugins/backend.js` 的 `startRetainpdfAiService`、`backend-env.js` 的
`RUST_API_AI_*` / `RETAIN_AI_*`、`scripts/prepare-app.mjs` 打包 `ai_service` 那段（`backend/ai` 没了会直接报错）、
`report-package-size.mjs` 的 `app/backend/ai_service`、`requirements-ai-service.txt`。和这个分支一起合。
细节见 `docs/core/frontend/backend-changes-handoff.md`。

## README

根目录三份 README（中、英、越）的「文档 AI 问答」一节以前宣传按页引用的问答和 PDF Agent。用户定改写成 Studio 的
读书笔记与 AI（笔记在中间、原书在旁边、AI 在右边）。截图 `ai-assistant.png` 还是旧的，等前端会话换。
