# Session 与上下文状态

**状态：** B1 会话贯通与 B2 抽取式压缩已实现

**更新：** 2026-09-02

**目标：** 说明当前 durable 状态、消息树、压缩和断线恢复语义

## 1. 状态由谁拥有

| 状态 | 权威来源 | AI 服务职责 |
|---|---|---|
| conversation 与 message | Rust SQLite / conversation API | 读取、追加，不直接写数据库 |
| 当前可见分支 | `head_id`、`message_id`、`parent_id` | `conversation_tree.py` 投影根到叶路径 |
| 本轮 MemoryView | AI 进程内 | 从权威分支组装；可以裁剪，不是持久化真值 |
| extractive summary | Rust 中的 assistant message | AI 生成并通过 Rust API 提交 |
| citations/tool trace | assistant message 的 JSON 字段 | 每轮生成快照并持久化 |
| operation/candidate | Rust operation 状态机 | 只引用 operation ID，不从聊天文本推断状态 |
| FX session cursor | Rust runtime-session 映射 | FX runtime CAS 更新；丢失时重建 |
| FX 本地 session 文件 | 私有 `RETAIN_AI_FX_STATE_ROOT` | fx 的不透明缓存；不是业务真值，可丢失后重建 |

实现入口：

| 模块 | 职责 |
|---|---|
| `conversation_tree.py` | 纯可见分支与 transcript 投影 |
| `conversation_state.py` | 会话创建、读取、摘要提交、消息预写和最终回写 |
| `memory/compress.py` | `extractive_v1` 压缩策略 |
| `memory/assemble.py` | 有界 history 组装和粗略 token 估算 |
| `ask_orchestration.py` | 决定上述状态动作在同步/SSE turn 中的顺序 |
| `rust_client.py` | conversation/runtime-session HTTP 客户端 |

`app.py` 只装配这些组件，不再拥有会话状态算法。

## 2. Rust conversation 契约

当前单一真值是 `backend/contracts/ai-conversations.v1.schema.json`。

Conversation 的关键字段：

```json
{
  "conversation_id": "conv_...",
  "title": "...",
  "document_id": "doc_...",
  "message_count": 4,
  "head_id": "msg_..."
}
```

Message 的关键字段：

```json
{
  "message_id": "msg_...",
  "conversation_id": "conv_...",
  "seq": 4,
  "role": "assistant",
  "content": "...",
  "citations_json": "[]",
  "tool_trace_json": "[]",
  "model": "...",
  "parent_id": "msg_..."
}
```

当前没有 `skill_id`、`memory_json` 或 `metadata_json`。摘要使用普通 assistant
message，正文以 `【对话摘要】` 开头；不要把路线图里的扩展字段当作现有 API。

## 3. 可见消息树

Rust 返回完整 messages 和 `head_id`。AI 服务按以下规则构造本轮 transcript：

1. 按 `seq` 排序。
2. 从 `head_id` 沿 `parent_id` 回溯到根，再反转为根到叶。
3. regenerate 时以请求的 `parent_id` 作为 `stop_at`，只读取该 user 节点之前的
   可见路径。
4. 旧消息如果没有 `message_id/parent_id`，使用合成 ID 按 `seq` 串为线性链。
5. 非 user/assistant 或空内容不进入 MemoryView。

算法唯一实现位于 `conversation_tree.py::visible_path`。前端可以切换 `head_id`，
但不应自己实现另一套“可见消息”规则来决定发给模型的历史。

## 4. 会话创建与 turn 写入

请求未提供 `conversation_id` 时，AI 服务会通过 Rust 创建会话，并在同步结果或
SSE `agent_session/done` 中返回 ID。标题取首个问题的单行前 48 个字符。自动创建是
best effort：Rust conversation API 不可用时会返回空 ID；Python/OpenAI 仍可能生成
非持久回答，但 FX 要求 durable conversation，不能在空 ID 下执行 turn。

普通阅读 turn：

```text
读取可见分支 → 组装/压缩 history → 执行 runtime
              → append user → append assistant(set_head=true) → done
```

具有 document operation 能力的 turn：

```text
读取/压缩 history
  → append user(set_head=true)
  → 使用该 durable message_id 创建/运行 operation
  → append assistant(set_head=true)
  → done
```

operation 路径必须预写 user message，因为 capability 和幂等身份都包含
`conversation_id/document_id/request_message_id`。若客户端携带稳定
`user_message_id` 重试，写入异常后只复用 ID、role 与 content 全部匹配的既有消息。
预写失败时 operation broker 不获得完整 scope；即使后续回答可用，最终
`persisted` 仍保持 false。若 runtime 随后失败，conversation 中可能只留下已经
durable 的 user message，恢复时应以 Rust 返回的消息树为准。

regenerate 不再重复写 user，只追加一个以指定 user message 为 parent 的 assistant
兄弟节点，并把新节点设为 head。

最终消息写入失败不会抹掉已经生成的回答；结果返回 `persisted=false`，调用方必须
明确提示该轮可能无法在刷新或重启后恢复。当前实现没有 conversation/store 时把
持久化步骤视作 no-op success，因此 `persisted=true` 必须与非空
`conversation_id` 一起判断，不能单独作为 durable 证明。

## 5. `extractive_v1` 压缩

默认配置：

| 变量 | 默认 | 作用 |
|---|---:|---|
| `RETAIN_AI_MEMORY_WINDOW_TURNS` | `6` | history 保留的近期 user turn 数 |
| `RETAIN_AI_MEMORY_COMPRESS_AFTER_TURNS` | `12` | 超过后压缩早期 turn |
| `RETAIN_AI_MEMORY_MAX_CHARS` | `24000` | 组装后 history 的字符护栏 |

压缩不调用 LLM：

1. 找到可见分支中的最新摘要。
2. 统计摘要之后的 user turn。
3. 折叠窗口之外的早期消息，抽取用户关注、带 `[n]` 的结论和 citation snippet。
4. 生成以 `【对话摘要】` 开头、默认不超过 1800 字符的 assistant message。
5. 先通过 Rust durable 写入摘要；成功后才发 `compress` 事件。
6. 本轮 history 使用摘要加近期窗口，并受单消息 clip 与总字符上限保护。
7. 本轮 user/assistant 挂到新摘要形成的分支上，避免摘要成为永远读不到的兄弟节点。

`force_compress=true` 只用于测试或调试；窗口没有可折叠内容时仍不会伪造压缩事件。

`compress` 事件形状：

```json
{
  "type": "compress",
  "dropped_turns": 8,
  "summary_chars": 900,
  "kept_evidence": 4,
  "policy": "extractive_v1",
  "window_turns": 6
}
```

`done.memory` 是可忽略的调试视图，当前包含 `window_turns`、`had_summary`、
`history_messages`、`prompt_tokens_est`、`total_chars`、`compressed` 和
`evidence_count`。它不是新的持久化状态源。

## 6. 引用与证据

当前 citation 编号在单个 turn 内从 1 开始。assistant 消息保存本轮
`citations_json` 和 `tool_trace_json`，旧气泡因此仍可展示和跳转；但是编号不会在
多个 turn 之间单调延续，历史 evidence 也不会自动重新注入模型。

跨 turn evidence snapshot、持久化 `ref_counter` 和基于证据的长期记忆仍是路线图，
当前尚未实现。

## 7. 断网、刷新与重启

- 已写入 Rust 的 conversation/message/summary 可在刷新和服务重启后恢复。
- 已创建的 operation/candidate 不依赖 AI 进程内存；重新查询 Rust API 即可恢复。
- SSE 是通知通道，不是日志。断线后不按浏览器最后的事件重放状态。
- 模型 token、Python queue 和 worker thread 是临时态；进程崩溃时未写入的回答会丢失。
- `persisted=false` 表示本轮回答已经返回，但 request 或 final durable 写入不完整。
- 空 `conversation_id` 时，即使 `persisted=true` 也没有可恢复的 conversation。
- FX cursor 或本地 session 文件丢失只影响对话连续性，不改变 Rust 中
  document/operation 真值。

恢复流程：

```text
重新获取 conversation detail/head
  → 按唯一 tree 算法恢复可见分支
  → 查询 operation 列表/详情
  → 发起下一轮 ask
```

## 8. 测试与契约门禁

```bash
uv run --project backend python -m pytest \
  backend/ai/tests/test_memory.py \
  backend/ai/tests/test_tools_and_app.py \
  backend/ai/tests/test_streaming.py -q

uv run --project backend python -m pytest backend/ai/tests -q
python backend/contracts/check_parity.py --require-upstream
```

必须覆盖：

- 自动创建 conversation 并回传 ID。
- 第二轮注入第一轮可见历史。
- regenerate 产生兄弟 assistant 分支。
- summary 位于新 head 的祖先路径上。
- 请求消息预写失败与传输歧义恢复。
- SSE `compress` 在 `agent_session` 之前，`done` 在最终 durable 写入之后。
- 历史写入失败返回 `persisted=false`。
- 空 conversation 与 `persisted` 的组合不会被误判成已持久化。

## 9. 尚未实现

- `metadata_json`/专用 summary message kind。
- 跨 turn evidence snapshot 与稳定引用编号。
- 面向 token 而非字符估算的模型级预算。
- 客户端取消向运行中的同步 LLM/tool call 传播。
- 多 Agent 共享 memory/evidence 的 durable 协议。
