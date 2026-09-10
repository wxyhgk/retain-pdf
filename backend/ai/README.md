# retainpdf-ai

常驻 AI 服务。默认的 `python-retrieval-v1` 使用由
`ocr/normalized/document.v1.json` 与 `translated/page-*.json` 派生的结构化索引回答当前文档；
原文与译文共享 page/block/bbox 锚点。`md/full.md` 仅用于兼容缺少结构化产物的旧任务。实验性的
`vercel-fx-acp-v1` 通过 host-owned broker 使用同一套阅读、确定性计算和 durable
PDF operation。Rust 仍是 operation、calculation、candidate、commit 和恢复状态的
唯一权威来源。

## 架构

```
POST /v1/ask
  └── app.py                         HTTP 鉴权、路由装配
      └── AskOrchestrator            请求预校验、同步/SSE 编排
          ├── ConversationState      会话树、摘要、durable 消息写入
          └── AgentRuntime
              ├── python-unified-agent-v1（操作 runtime 可选项）
              │   └── 单一 OpenAI-compatible model loop
              ├── openai-compatible-agent-v1
              │   └── 单一 OpenAI-compatible model loop
              └── vercel-fx-acp-v1
                  ├── fx acp 0.0.5（无 MCP，私有 HOME/workspace）
                  └── 固定 host broker grammar

`assistant_mode=auto` 先由宿主做保守路由：阅读、总结、解释、检索和计算进入
`python-retrieval-v1`；只有明确的旋转、删除页面、重排、拆分等修改意图才进入
当前 operation runtime。歧义请求默认 reading。operation runtime 的同一模型循环可看到：
  - search_fulltext / read_blocks / Markdown 兼容工具
  - calculate_expression / calculate_statistics / analyze_table / generate_chart
  - durable PDF operation 工具

返回：`answer + citations[]`（document/job/page/block 结构化锚点）+ `tool_trace`；
SSE 另提供 `agent_session`、统一的 `agent_tool`、`agent_operation`；done 返回
`operation_refs` 与 `calculation_refs`。浏览器收到提示后仍必须查询 Rust public API
获取权威状态。
```

当前模块边界：

| 模块 | 唯一职责 |
|---|---|
| `app.py` | FastAPI 初始化、鉴权和薄路由；保留历史兼容导出 |
| `api_contracts.py` | `/v1/ask` 与 runtime-config 的 Pydantic 请求模型 |
| `ask_orchestration.py` | runtime 选择、凭据预校验、同步/SSE turn 编排与结果投影 |
| `request_routing.py` | `auto` 的保守意图分类；显式 reading/operations 不改写 |
| `request_control.py` | 请求总 deadline、断流取消和结构化终态错误 |
| `conversation_state.py` | 会话创建、历史读取、摘要提交、消息预写和最终回写 |
| `conversation_tree.py` | 纯消息树可见分支投影；兼容旧线性消息 |
| `runtime_config_api.py` | runtime 配置查询/更新、CAS revision、自检和 `/readyz` |
| `credential_vault.py` | 读取 Rust 凭据库、校验 kind，并用共享锁保护引用生命周期 |
| `runtime_credential_refs.py` | runtime key/ref 互斥选择、脱敏响应和无 secret 持久化投影 |
| `runtime.py` | 兼容 façade；实现位于 `runtimes/` |
| `agent.py` | 检索 Agent 兼容 façade |
| `retrieval_agent.py` | bounded function-calling 检索循环和 document/job scope |
| `agent_llm.py` | OpenAI-compatible HTTP/SSE transport 与用户可行动错误映射 |
| `agent_evidence.py` | 引用编号、安全工具结果投影和回答清洗 |
| `agent_command_broker.py` | broker 生命周期、capability 签发与受限 CLI 执行 |
| `agent_broker_*.py` | broker 契约、命令语法、事件投影和 Unix socket framing |

依赖方向保持单向：HTTP 装配 → 请求编排 → 状态/runtime；兼容 façade 不承载
业务状态。Rust 仍是 conversation、document、operation 和 candidate 的唯一
持久化写入者。

进入模型循环前，宿主先检查当前任务产物。存在 `document.v1` 时只暴露
`search_fulltext` / `read_blocks`；否则若存在 `md/full.md`，只暴露
`search_markdown` / `read_markdown_chunk`；两者都不存在的阅读请求直接返回
`AI_DOCUMENT_CONTENT_UNAVAILABLE`。OpenAI Agent 没有文档 scope 时使用
`list_documents` / `search_fulltext` / `read_blocks` / `search_favorites`
做全库只读检索。

安全计算不执行 Python 或 shell，不访问网络，也不接收任意服务端路径。表格分析和
图表必须引用当前 document/job/page/block；原始表达式与表格内容不写入 Rust。
Rust 只保存输入哈希、结构化引用、受限结果和校验后的 SVG 产物。AI 服务重试同一
request/tool/input 时复用稳定 calculation identity；这属于可恢复重放，不宣称后台
会在进程重启后自动续算尚未完成的内存计算。

刻意不用 agent 框架:单 provider、单用户本地服务,裸循环全权掌控超时/
轮数/引用编号;工具定义同构,将来迁移只换循环外壳。

## 运行

```bash
RETAIN_AI_API_KEYS=dev-local-key \
RETAIN_AI_RUST_API_KEY=dev-local-key \
RETAIN_AI_LLM_API_KEY=sk-... \
retainpdf-ai
# 等价兼容入口：python3 -m retainpdf_ai
```

环境变量(均有默认值,凭证除外):

| 变量 | 默认 | 说明 |
|---|---|---|
| `RETAIN_AI_API_KEYS` | 回退 `RETAIN_API_KEYS` | 本服务的 X-API-Key 集合(逗号分隔)；两者都空时鉴权入口返回 500 |
| `RETAIN_AI_RUST_API_KEY` | 必填 | 调用 Rust API 的 key |
| `RETAIN_AI_HOST` | `127.0.0.1` | AI 服务监听地址 |
| `RETAIN_AI_LLM_API_KEY` | 空 | 启动期回退；`python/openai` 也可使用已保存或请求级 Key |
| `RETAIN_AI_LLM_CREDENTIAL_REF` | 空 | Rust 凭据库中 `kind=agent_llm_api_key` 的启动期引用；优先于 LLM key |
| `RETAIN_AI_RUST_API_BASE` | `http://127.0.0.1:41000` | Rust API 地址 |
| `RETAIN_AI_LLM_BASE_URL` | `https://api.deepseek.com/v1` | LLM 端点 |
| `RETAIN_AI_LLM_MODEL` | `deepseek-v4-flash` | 模型 |
| `RETAIN_AI_LLM_TIMEOUT_S` | `60` | 普通 OpenAI-compatible 请求超时秒数 |
| `RETAIN_AI_PORT` | `41100` | 监听端口 |
| `RETAIN_AI_MAX_TOOL_ROUNDS` | `6` | agent 工具轮数上限 |
| `RETAIN_AI_READING_MAX_TOOL_ROUNDS` | `3` | reading 工具轮数上限；最大固定为 3 |
| `RETAIN_AI_REQUEST_DEADLINE_SECS` | `90` | 整个 AI turn 的总 deadline |
| `RETAIN_AI_HEARTBEAT_INTERVAL_SECS` | `5` | 无其他事件时的 SSE 心跳间隔；限制为 1–10 秒 |
| `RETAIN_AI_MEMORY_WINDOW_TURNS` | `6` | 近期保留对话轮数 |
| `RETAIN_AI_MEMORY_COMPRESS_AFTER_TURNS` | `12` | 超过则抽取式压缩早期轮次 |
| `RETAIN_AI_MEMORY_MAX_CHARS` | `24000` | 喂给模型的 history 字符上限 |
| `RETAIN_AI_DATA_ROOT` | `<repo>/data` | 任务产物根目录 |
| `RETAIN_AI_RUNTIME` | `python` | `python`、`openai` 或实验性的 `fx` |
| `RETAIN_AI_AGENT_CONFIRMATION_MODE` | `explicit` | `explicit` 或仅放行受限 PDF operation 的 `green_light` |
| `RETAIN_AI_AGENT_CLI_COMMAND` | `retainpdf-agent` | 所有文档 Agent 共用的宿主控制 CLI |
| `RETAIN_AI_FX_COMMAND` | `fx` | 固定的 fx 可执行文件路径/名称 |
| `RETAIN_AI_FX_EXPECTED_VERSION` | `0.0.5` | ACP 初始化必须精确匹配的 fx 版本 |
| `RETAIN_AI_FX_GATEWAY_BASE_URL` | 空（FX 官方 Gateway） | FX 0.0.5 自定义 Gateway；仅支持带端口的回环 HTTP |
| `RETAIN_AI_FX_GATEWAY_API_KEY` | 空 | 仅 fx 子进程使用，不复用 Rust API key |
| `RETAIN_AI_FX_GATEWAY_CREDENTIAL_REF` | 空 | Rust 凭据库中 `kind=fx_gateway_api_key` 的启动期引用；优先于 Gateway key |
| `RETAIN_AI_FX_MODEL` | 空 | 后端配置的 fx 模型；HTTP 请求不能指定 |
| `RETAIN_AI_FX_STATE_ROOT` | `<repo>/data/agent-runtime/fx` | 私有 HOME、workspace 与 session 状态根；不会自动跟随自定义 `RETAIN_AI_DATA_ROOT` |
| `RETAIN_AI_FX_STARTUP_TIMEOUT_SECS` | `10` | ACP 启动/初始化超时 |
| `RETAIN_AI_FX_TURN_TIMEOUT_SECS` | `120` | 单次 ACP prompt 超时 |
| `RETAIN_AI_FX_MAX_CONCURRENT_TURNS` | `4` | 不同 conversation 的进程内并发上限；最小为 1 |
| `RETAIN_AI_FX_OPENAI_BASE_URL` | 空 | 可选 OpenAI Chat Completions 兼容端点；设置后由宿主回环桥接，不需要 Vercel Gateway key |
| `RETAIN_AI_FX_OPENAI_API_KEY` | 空 | 兼容端点 key；空值表示不发送 Authorization |
| `RETAIN_AI_FX_AGENT_CLI_COMMAND` | `retainpdf-agent` | 仅由宿主中介启动的真实控制 CLI 路径/名称 |

`openai` 使用 `RETAIN_AI_LLM_BASE_URL`、`RETAIN_AI_LLM_MODEL` 和
`RETAIN_AI_LLM_API_KEY`，因此可接入任意支持 Chat Completions function calling
的 OpenAI-compatible 模型端点。它与 FX 共用 host-owned broker、短期 capability、
显式 run/commit/retry 确认、候选版本和 Rust 恢复状态；模型不会直接接触 Rust API key。
`/v1/ask` 的 `llm_base_url`、`llm_model`、`llm_api_key` 只覆盖当前 Python/OpenAI
turn，不写入安全配置文件或 conversation；FX 是 runtime-managed transport，会
忽略这组三个请求字段。

FX 0.0.5 没有公开的任意远程 endpoint 参数。它只接受环境变量形式的本地测试
覆盖，而且只信任 `http://127.0.0.1:<port>`、`http://localhost:<port>` 或
`http://[::1]:<port>`。配置自定义地址时，后端同时向私有 FX 子进程传入
`FX_GATEWAY_BASE_URL` 和派生的
`FX_GATEWAY_CHAT_URL=<base>/v3/ai/language-model`；只传前者不会改变主模型请求。
空值保留 FX 官方 Gateway。其他地址会在保存或启动前明确失败，避免 FX 静默回退
官方地址。需要远程自定义域名时应升级或修改 FX；普通 OpenAI-compatible 地址继续
使用 `openai` 模式。

推荐先通过 Rust `POST /api/v1/credentials` 创建 `agent_llm_api_key` 或
`fx_gateway_api_key`，再把返回的不透明引用写入 runtime-config 的
`llm_credential_ref` 或 `fx_gateway_credential_ref`。AI 服务只把引用写到
`$RETAIN_AI_DATA_ROOT/secrets/ai-runtime.json`，实际模型调用或 FX subprocess 启动前
才从 Rust 凭据库解析 secret。GET 会返回引用和 configured 状态，但引用模式的掩码
固定为 `••••`，不会泄露 secret 后四位。配置文件目录权限为 `0700`、文件权限为
`0600`。配置文件使用单调 revision、进程内锁、
跨进程文件锁和 compare-and-swap，避免两个局部更新互相覆盖；写入完成后还会
fsync 文件及父目录。保存前会校验 URL、必需 Key、FX ACP 能力，并对自定义本地
Gateway 做有界 TCP 可达性检查；保存成功后由 Rust 监督器重启 AI 子进程。
`/readyz` 只有在新进程载入同一 configured revision 且自定义 Gateway 仍可达时
才返回 200，`/healthz` 只表示进程存活。环境变量仍作为未创建安全配置文件时的
启动回退；显式保存空 FX URL 表示官方默认 Gateway，不会重新落回环境变量 URL。
旧客户端提交的 `llm_api_key` / `fx_gateway_api_key` 暂时仍兼容，并继续写入这个权限
保护的本地明文 JSON；新客户端应只提交引用。引用与对应的旧 key 字段互斥。AI 配置
写入会持有 Rust 凭据生命周期共享锁，删除凭据会持有独占锁并检查 Agent 引用，避免
“引用校验成功后、配置落盘前”被并发删除。普通问答每个 turn、FX 每次 subprocess
启动都会重新解析引用，因此凭据轮换不会继续长期使用进程启动时的旧 secret。
引用不存在、类型错误或保险库不可安全读取时，`/readyz` 返回
`503 credential_reference_unavailable`；runtime-config GET/PUT 返回安全的 503，
不会把文件路径、记录内容或 secret 带入诊断。

对应的受鉴权入口经 Rust API 暴露为：

- `GET /api/v1/ai/runtime-config`
- `PUT /api/v1/ai/runtime-config`

AI sidecar 的直接路径是 `GET/PUT /v1/runtime-config`。两者的 `data` 字段由
`backend/contracts/runtime-config.v1.schema.json` 锁定；问答/SSE 与公开 operation
则分别由 `ai-ask.v1.schema.json` 和 `public-document-operation.v1.schema.json`
锁定。

响应绝不包含原始 Key。空输入表示沿用已保存值；显式清除使用
`clear_llm_api_key` / `clear_fx_gateway_api_key`，并继续受当前模式的必需凭据
校验约束；清除只解除 runtime-config 的引用，不删除 Rust 凭据记录。客户端可把
GET 返回的 `configured_revision` 作为 PUT 的
`expected_revision`；过期写入返回 409。GET 同时返回 `active_revision`、
`restart_state` 和实际派生的 FX base/chat URL，因而无需靠轮询猜测重启是否完成。
无变化的 PUT 不增加 revision，也不触发重启。`RuntimeConfigUpdate` 拒绝未知字段，
避免拼写错误被静默吞掉；客户端仍应依据返回 view 判断配置是否实际生效。

FX 和 OpenAI operation runtime 都只批准经过精确 argv 语法验证的
`retainpdf-agent` 控制命令。每次调用由
宿主签发单 action、60 秒的 document/conversation scoped capability，并在
独立子进程里执行真实 CLI；模型环境和生成的 wrapper 都拿不到 capability 或
Rust API key。默认 `explicit` 模式下，`operation run/commit/retry` 还要求本次 HTTP
请求带有用户侧 `confirm_document_operation: true`，模型无法自行提升确认状态；
未确认时响应会包含 `confirmation_requests`，流式请求还会产生
`agent_confirmation_required`，前端不应解析模型的“确认”文案。

`confirmation_requests` 覆盖 run、commit 和 retry；`ambiguous` retry 另外标记
`requires_risk_acceptance=true`。`green_light` 模式把这些受限 effect 视为宿主
已授权，允许 Agent 在状态机许可时直接生成并提交候选版本。它不会开放 shell、
文件路径或任意程序：精确
命令语法、当前文档/会话范围、短期 capability、幂等键、Rust 状态校验和 candidate
验证全部保留。该模式默认关闭，可通过 runtime-config 的
`agent_confirmation_mode` 持久化修改，修改后需按 revision 机制重启生效。
`operation run` 保持为同一个粗粒度工具：失败后可加 `--retry failed`；状态为
`ambiguous` 时必须使用 `--retry ambiguous --accept-duplicate-risk yes`。宿主把
它们映射成持久化 retry attempt，同一请求断网重放不会创建多个 attempt。

当前已支持 `retainpdf_page_program_v1`：通过 `select_pages` 和
`rotate_pages` 的顺序组合完成页面删除、重排、复制和旋转，生成真实 PDF
candidate。每个输出页还会按批准的页面计划做最长边最大 512px 的整页栅格化，
与对应源页的预期旋转结果做 RGB 像素比较；visual report 的 hash 由 Rust 在
发布前复核。执行的是固定
后端解释器，不是模型 Python；任意 Python、Typst、Ghostscript 程序仍需独立
OS/container 隔离后才能开放。

## 调用示例

```bash
curl -s -X POST http://127.0.0.1:41100/v1/ask \
  -H "X-API-Key: dev-local-key" -H "Content-Type: application/json" \
  -d '{"document_id":"doc-id","job_id":"job-id","question":"这篇文献对卤素锂交换的结论是什么?"}'
```

## 测试

```bash
uv sync --project backend --extra test
uv run --project backend python -m pytest backend/ai/tests -q
python backend/contracts/check_parity.py --require-upstream
npm --prefix contracts test
```
