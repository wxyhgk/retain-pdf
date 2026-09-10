# 前端对接说明：图书馆数据层 API

> 当前实现说明，更新于 2026-09-02。现有 `/api/v1/library/books` 兼容接口保留；
> 所有业务接口使用 `X-API-Key` 认证，JSON 响应统一采用
> `{code, message, data}` 包装。

## 核心概念(前端需要理解的唯一模型变化)

- **document = 一篇 PDF 的稳定身份**(按文件内容 sha256 去重):同一篇 PDF 不管上传几次、
  翻译几次,都是同一个 `document_id`。job 变成了文档名下的"处理记录"。
- **锚点**:收藏和搜索命中都带 `(document_id, job_id, page_idx, block_id)` 四元组,
  `job_id + page + block` 就是阅读器现有的定位坐标,可以直接跳转到原位。

## 接口清单

### 1. 文档列表 / 详情 / 编辑

```
GET  /api/v1/documents?limit=50&offset=0&reading_status=reading&tag=化学&collection_id=xxx
GET  /api/v1/documents?job_id=xxx          ← 任意 job_id(含历史 run)直查所属文档,勿再扫列表反查 active_job_id
     → data.documents[]: { document_id, title, source_filename, page_count, bytes,
                           active_job_id, reading_status, tags[], added_at,
                           last_opened_at, updated_at, authors_json, year, doi }

GET  /api/v1/documents/:document_id

PATCH /api/v1/documents/:document_id
     body: { title?, reading_status?, tags? }
```

- `reading_status` 只接受 `unread | reading | done`,其他值返回 400;
- `tags` 是**整体替换**语义(传 `[]` 即清空);
- `active_job_id` 是该文档当前生效的处理 run——**打开阅读器就用它**;
- 列表按 `added_at` 倒序,`limit` 上限 500。

### 2. 收藏

```
POST /api/v1/favorites
     body: {
       page_idx, block_id, quote_text,                      ← 必填
       document_id?, job_id?,                               ← 二选一至少给一个
       char_start?, char_end?, kind?,
       translated_quote_text?, note?
     }
     → data: FavoriteRecord(含生成的 favorite_id、解析出的 document_id 和实际锚定的 job_id)

GET  /api/v1/favorites?document_id=xxx
     → `data.favorites[]`（按页码排序；不传参数 = 全部收藏，按时间倒序）

PATCH /api/v1/favorites/:favorite_id
     body: { note }                          ← 原子更新笔记,favorite_id 不变
DELETE /api/v1/favorites/:favorite_id
```

- **只给 `job_id`(含历史 run)时后端自动解析所属文档并锚定该 run 的块空间**——
  阅读器里收藏直接传当前 job_id 即可,打开历史 job 也能正确入库;
- 只给 `document_id` 时锚定其 `active_job_id`;
- `quote_text` 是引文快照,必填(选中的原文文本);`translated_quote_text` 建议一起传——
  锚点将来失效时快照保证内容不丢;
- `kind`: `sentence | data | figure`,默认 `sentence`;
- `char_start / char_end` 是块内选区(可选,不传表示整块)。

### 3. 全文检索(中英文都可)

```
GET /api/v1/search?q=光学光谱&limit=20
    → data.hits[]: { document_id, job_id, page_idx, block_id,
                     source_snippet, translated_snippet }
```

- snippet 里命中词用 `[` `]` 包裹,前端可替换成高亮标签;
- 任意长度的 `q` 都能查(≥3 字符走 FTS5 全文索引,更短自动回退模糊匹配);
- `limit` 上限 100。

### 4. AI 问答与 PDF Agent

> 前端只访问 Rust API：`/api/v1/ai/ask` 反向代理到 `retainpdf-ai`，认证仍使用
> `X-API-Key`。不要直连 Python 服务，也不要解析模型文案来推断操作状态。

```text
POST /api/v1/ai/ask
```

请求除 `question`、`document_id` / `job_id` 和 `conversation_id` 外，还支持：

- `parent_id`、`regenerate`：在消息树上续写或重新生成分支；
- `user_message_id`、`assistant_message_id`：客户端稳定 ID，网络重试时保持不变；
- `assistant_mode`：`reading | operations | auto`；
- `confirm_document_operation`：本次请求是否包含用户对 run/commit 的明确授权；
- `stream`：是否返回 SSE；
- `llm_api_key`、`llm_base_url`、`llm_model`：兼容的单请求模型覆盖。

运行模式和长期凭据通过 `GET|PUT /api/v1/ai/runtime-config` 管理。密钥只允许写入，
查询和错误响应都不会返回明文。

非流式 `data` 除 `answer/citations/tool_trace/rounds` 外，还包含
`persisted`、`conversation_id`、`agent_runtime`、`operation_refs` 和
`confirmation_requests`。`persisted=false` 时必须提示用户本轮历史可能没有保存。

流式事件包括：

| `type` | 说明 |
| --- | --- |
| `agent_session` | 会话 ID、实际 runtime 和确认模式 |
| `tool` / `agent_tool` | 阅读工具或 Agent 工具的安全过程投影 |
| `agent_operation` | operation 身份和状态刷新提示 |
| `agent_confirmation_required` | 后端生成的结构化待确认动作 |
| `answer_delta` | 增量文本片段，不是累积全文 |
| `compress` | 对话历史发生压缩 |
| `done` | 最终载荷，包含 `persisted` |
| `error` | 本轮失败 |

前端渲染要点：

- `[n]` 对应 `citations[].ref`，使用 `job_id + page_idx + block_id` 跳转；
- 默认确认模式下只渲染后端的 `confirmation_requests`，不要把“确认”自然语言
  再发给模型猜测；
- SSE 断线后重新查询 conversation 和 operation。SSE 本身不是可重放状态真源；
- AI 服务未启动时反代返回 502，可提示“AI 服务未运行”。

完整契约见 [`ai-ask.v1.schema.json`](../../../backend/contracts/ai-ask.v1.schema.json)，
接入与恢复说明见 [AI 问答与文档操作 API](../api/reader-ai-chat.md)。


### 5. 资产(收藏截图等图片附件)

```
POST /api/v1/assets                    ← multipart,字段名 file(png/jpeg/webp,≤20MB)
     → data: { asset_id, mime, bytes, created_at }
GET  /api/v1/assets/:asset_id          ← 文件本体;内容寻址,响应带 immutable 缓存头,可放心 <img src>
```

- `asset_id` = 文件 sha256:同一张图重复上传自动归并,拿到相同 id;
- **图片收藏流程**:canvas 导出 PNG → POST assets 拿 asset_id → POST favorites 时带
  `asset_id`(建议 `kind: "figure"`)和 `rect_json`(剪裁矩形几何原样存,换设备可还原);
- favorites 记录现在返回 `asset_id` / `rect_json` 字段,空串 = 纯文字收藏。

### 6. AI 问答会话（消息树 + durable operation）

```
POST   /api/v1/ai/conversations                      body: { title?, document_id? }
GET    /api/v1/ai/conversations?document_id=&limit=50&offset=0
POST   /api/v1/ai/conversations/fork
GET    /api/v1/ai/conversations/:id                  → 会话字段 + `messages[]`（seq 正序）
PATCH  /api/v1/ai/conversations/:id                  body: { title?, head_id? }
DELETE /api/v1/ai/conversations/:id                  级联删消息
POST   /api/v1/ai/conversations/:id/messages
GET    /api/v1/ai/conversations/:id/operations
```

- 消息通过 `parent_id` 组成树，conversation 的 `head_id` 决定当前可见分支；
- `/ai/ask` 自动写入本轮 user/assistant 消息，前端不要再调用 messages 重复写入；
- `citations_json` 是软锚点快照：job 删除后保留 snippet，但跳转应降级；
- PDF 操作必须从 operation 查询接口恢复。`agent_operation` SSE 只是刷新提示；
- run/retry/cancel/commit 请求必须带稳定幂等键和最新的状态、attempt、program hash，
  过期提交返回 409 后应立即刷新。

### 7. 分类(合集):建文件夹给 PDF 分组

> `collections`/`collection_documents` 表随图书馆数据层一起建好,一直没接
> 路由;现在补上。v1 只做扁平文件夹(不支持嵌套,`parent_id` 传了也接受,
> 但前端目前不需要用)。

```
POST   /api/v1/collections                body: { name, parent_id? }
GET    /api/v1/collections                → `data.collections[]`（按 sort_order 排序，含 document_count）
PATCH  /api/v1/collections/:id             body: { name?, sort_order? }
DELETE /api/v1/collections/:id             ← 只删文件夹本身,文档不受影响

POST   /api/v1/collections/:id/documents              body: { document_ids: [...] }
DELETE /api/v1/collections/:id/documents/:document_id
```

- 加入不存在的 `document_id` 返回 404;重复加入同一文档幂等(不报错、不重复计数);
- 查看某个文件夹里有哪些文档:`GET /api/v1/documents?collection_id=xxx`(见第 1 节),
  拿到的每条记录里的 `active_job_id` 就是该文档当前可打开的处理记录;
- 如果前端仍在用旧世界的 `/api/v1/library/books` 渲染卡片(而不是 `/api/v1/documents`
  投影),把上一步拿到的 `active_job_id` 集合拼进新加的 `job_ids` 参数
  (逗号分隔,见下方对 `/api/v1/library/books` 的说明),就能拿到与首页图书馆
  卡片同构的数据,不用另外做一套"文件夹详情卡片"渲染。

### `/api/v1/library/books` 新增可选参数:`job_ids`

```
GET /api/v1/library/books?job_ids=job-a,job-b,job-c
```

- 逗号分隔的 job_id 白名单,只返回命中的记录,形状与不传该参数时完全一致;
- 不传就是现状(分页 `limit`/`offset`),这是纯增量参数,不影响任何现有调用方;
- 传了 `job_ids` 时不做分页截断——语义是"精确给我这几个 job",不是"翻到第几页"。

## 两个必须处理的边界

1. **删除保护**:删除书籍(`DELETE /api/v1/library/books/:job_id`)时,如果该 job 被收藏
   引用,后端返回 **409**,message 里有引用数量——前端要把这个错误呈现为
   "该文档有 N 条收藏,请先删除收藏",而不是通用报错。
2. **重复上传**:同一 PDF 再次上传不会产生新文档(documents 列表数量不变),
   前端不要假设"上传成功 = 列表多一条"。

## 建议的迁移路径(不强制)

1. **第一步只做增量**:阅读器里加"选中 → 收藏"和收藏侧栏(纯新增,不动现有页面)。
   收藏跳转:用锚点里的 `job_id + page_idx + block_id` 复用现有阅读器定位。
2. **第二步**再把图书馆主页从 `/api/v1/library/books` 投影切到 `/api/v1/documents`,
   拿到标签 / 阅读状态 / 合集能力。

## 附:字段速查

| 字段 | 说明 |
|---|---|
| `document_id` | 文件内容 sha256(hex),稳定不变 |
| `active_job_id` | 当前生效的处理 run,阅读器入口 |
| `job_id`(收藏/命中里) | 锚点所在的块空间版本 |
| `block_id` | `document.v1.json` 的块 ID,如 `p001-b0002` |
| `page_idx` | 0 起始页码 |
| `reading_status` | `unread` / `reading` / `done` |
| `kind`(收藏) | `sentence` / `data` / `figure` |
