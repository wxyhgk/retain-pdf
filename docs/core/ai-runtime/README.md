# RetainPDF AI Runtime（文档索引）

**状态：** 当前实现 + 后续路线图

**更新：** 2026-09-02

**代码位置：** `backend/ai`

**产品入口：** 阅读器整本问答 → Rust 代理 `POST /api/v1/ai/ask` → retainpdf-ai `:41100`

---

## 文档

| 文档 | 内容 |
|------|------|
| **[AI_RUNTIME.md](./AI_RUNTIME.md)** | 当前 Transport / Orchestrator / Runtime / broker 架构与安全边界 |
| **[SESSION_AND_MEMORY.md](./SESSION_AND_MEMORY.md)** | 当前消息树、上下文压缩、durable 写入和恢复语义 |
| **[SKILLS.md](./SKILLS.md)** | Skill 包格式、与 Tool 的边界、首个 `literature-qa` 示例 |

---

## 一句话目标

> **AI 服务只做编排；Rust 管数据与权限；工具形状与主流 SDK 同构；Skills / Memory / Multi-agent 可插拔挂上，不必推倒重写。**

---

## 当前调用链

```
POST /v1/ask → AskOrchestrator
               ├─ ConversationState（消息树 + 摘要 + durable 写入）
               └─ AgentRuntime
                   ├─ Python Markdown retrieval
                   ├─ OpenAI-compatible PDF Agent
                   └─ FX ACP PDF Agent
```

`app.py` 和 `agent.py` 已是兼容 façade/薄装配层。Rust 继续拥有业务状态与权限；
Python AI 服务负责请求编排、模型 transport 和安全工具调用。

共享 wire 契约位于 `backend/contracts/`：`ai-ask.v1` 锁定问答/SSE，
`runtime-config.v1` 锁定配置更新与脱敏 view，`public-document-operation.v1` 锁定
Rust 面向浏览器的 operation 查询和 CAS action。AI 文档不另行定义第二套字段。

---

## 实施顺序（建议）

1. **Session 贯通（B1）** ✅ auto-create + 消息树 + done 回传
2. **Memory 压缩（B2）** ✅ 窗口 + extractive 摘要 + SSE `compress`
3. **Runtime/Agent/broker 模块化** ✅ 兼容 façade + 单向依赖
4. **OpenAI/FX durable PDF operation** ✅ capability + confirmation + candidate
5. Skill 加载器、跨轮 evidence 与第二 agent（可选）

每步都应可单独合并、可回滚，不阻断现有 `/v1/ask`。
