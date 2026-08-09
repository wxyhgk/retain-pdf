# AI Agent 集成计划（暂缓）

## 状态

- 当前状态：暂缓实施
- 当前主线：完善类似 Notion 的 Studio 编辑平台
- 重新评估时机：Studio 的文章编辑、资源管理、版本保存和发布流程稳定之后

## 目标

未来允许 Grok Build、Codex 或其他兼容 Agent 在用户确认下辅助编辑一篇 Article Bundle：

```text
blog/<slug>/
├── index.md
├── img/
├── assets/
├── ai/
└── article.config.yaml
```

AI 可以读取正文和科学文件、提出修改、生成摘要或解释计算结果，但不能绕过 Studio 的保存与审核流程。

## 推荐架构

不将 Grok Build 的终端 TUI 移植到浏览器。Studio 作为 Web 客户端，本地后端通过官方进程接口连接 Agent：

```text
Studio Web UI
    ↓ WebSocket / SSE
本地 Studio 后端
    ↓ ACP JSON-RPC / stdio
Grok Build Agent
```

正式方案优先使用 `grok agent stdio` 的 ACP 接口；一次性的 `streaming-json` 只用于早期验证。避免 fork 和长期维护整套 Grok Build Rust 工程。

## 分阶段计划

### 阶段 1：只读验证

- Agent 工作目录锁定到当前 `blog/<slug>/`。
- 只能读取 `index.md`、`img/`、`assets/`、`ai/` 和 `article.config.yaml`。
- Studio 展示流式回答，不允许 Agent 写文件或执行 shell。
- 验证认证、会话恢复、取消和事件映射。

### 阶段 2：受控修改

- Agent 只生成 patch，不直接覆盖文件。
- Studio 展示 Markdown diff。
- 用户确认后，由 Studio 现有的安全保存接口执行写入。
- 修改前创建 checkpoint，支持撤销。
- 将计划、会话摘要和 patch 保存到文章的 `ai/` 目录。

### 阶段 3：科学工作流

- 读取 SDF、XYZ、GJF、输出文件和轨迹。
- 生成结构说明、计算参数摘要和可复现性检查清单。
- 所有生成内容仍经过 diff 与人工确认。
- 只有确有必要时，才评估隔离环境中的有限命令执行。

## 安全边界

- API Key、登录令牌、文件系统和子进程只能存在于本地后端。
- 对文章路径执行 canonicalize，拒绝 `..`、符号链接越界和仓库外路径。
- 初期不开放 terminal/shell capability。
- 不使用 `--always-approve`。
- 将来开放命令时使用隔离进程或容器、严格 sandbox、`dontAsk` 和精确 allowlist。
- 联网部署前必须增加身份认证、CSRF 防护、会话隔离、限流和审计记录。

## 暂不实施的内容

- 不把 Grok Build TUI 编译为 WebAssembly。
- 不 fork Grok Build 的完整 Rust workspace。
- 不允许 Agent 自动发布文章。
- 不在浏览器中保存模型密钥。
- 不在 Studio 基础编辑体验稳定前开发多 Agent、skills、plugins 或 MCP 管理界面。

## 恢复开发的前置条件

- Studio 已能稳定创建、编辑、保存和恢复文章。
- `img/` 与 `assets/` 已有完整的上传、引用和删除流程。
- Markdown、公式、2D/3D 分子及轨迹均能在编辑状态下可靠预览。
- Git checkpoint、diff 和撤销流程已经建立。
- 本地权限模型与未来在线部署边界已经确定。

## 参考

- Grok Build 官方仓库：https://github.com/xai-org/grok-build
- Headless 与 ACP：https://docs.x.ai/build/cli/headless-scripting
- Permissions：https://docs.x.ai/build/features/permissions
- Sandbox：https://docs.x.ai/build/features/sandbox
