# 前端对接说明：图书馆数据层 API

> 当前实现说明，更新于 2026-09-02。书架 `/api/v1/library/books` 已经删光：2026-10-19 冻结并删了
> `GET /library/books/:job_id`，2026-10-22 前端改调 `GET /api/v1/jobs?job_ids=`、`DELETE /api/v1/jobs/:job_id` 以后，
> 列表 `GET /library/books` 和删除旧地址 `DELETE /library/books/:job_id` 也删了，请求得 404（见
> [书架冻结与删任务新地址](../../ops/planning/api-reorg/20261019-书架冻结与删任务新地址.md)、
> [删书架旧地址](../../ops/planning/api-reorg/20261022-删书架旧地址.md)、[给前端的交接](backend-changes-handoff.md)）；
> 所有业务接口使用 `X-API-Key` 认证，JSON 响应统一采用
> `{code, message, data}` 包装。
>
> 字段以契约为准：书、合集、全文检索、阅读入口、翻译覆盖、书的文件清单、元数据建议，以及书的任务列表、翻译这本书、给这本书做 OCR（第 1b 期）见
> [`library-documents.v1.schema.json`](../../../contracts/library-documents.v1.schema.json)（2026-10-22 起，TS 类型从
> `@retainpdf/contracts/library-documents` 导入，可以换掉 `frontend/packages/api` 里手写的类型，见
> [给前端的交接](backend-changes-handoff.md)）；任务列表见 `job-status.v1.schema.json`，删任务的返回见 `library-books.v1.schema.json`（名字沿用书架时期，
> 书架的类型 2026-10-22 删了）。

## 核心概念(前端需要理解的唯一模型变化)

- **document = 一篇 PDF 的稳定身份**(按文件内容 sha256 去重):同一篇 PDF 不管上传几次、
  翻译几次,都是同一个 `document_id`。job 变成了文档名下的"处理记录"。
- **锚点**:收藏和搜索命中都带 `(document_id, job_id, page_idx, block_id)` 四元组,
  `job_id + page + block` 就是阅读器现有的定位坐标,可以直接跳转到原位。

## 接口清单

### 1. 文档列表 / 详情 / 编辑

```
GET  /api/v1/documents?limit=50&offset=0&reading_status=reading&collection_id=xxx&q=xxx
GET  /api/v1/documents?job_id=xxx          ← 任意 job_id(含历史 run)直查所属文档,勿再扫列表反查 active_job_id
     → data: { documents[], total, limit, offset, has_more }
       documents[]: DocumentRecord { document_id, title, title_source, title_locked,
                      source_filename, page_count, bytes, active_job_id, active_version_id?,
                      reading_status, added_at, updated_at, source_pdf_url, cover_url,
                      thumbnail_url, has_translation,
                      authors_json, year, doi, last_opened_at }   ← 最后四个没有功能,见下

GET  /api/v1/documents/:document_id

PATCH /api/v1/documents/:document_id
     body: { title?, reading_status? }
```

- `reading_status` 只接受 `unread | reading | done`,其他值返回 400;
- `active_job_id` 是书卡当前对应的任务(在跑的优先,其次最好的成功任务,再次最近提交的);打开阅读器用 `GET /api/v1/documents/:id/reading` 给的 `job_id`
  (分次范围翻译时是合并后的虚拟任务),不要直接用 `active_job_id`;
- `active_version_id` 没有时整个键不出现(不是 `null`);
- `authors_json`(恒为字符串 `"[]"`)、`year`(恒 `null`)、`doi`(恒 `""`)、`last_opened_at`(恒 `null`)没有写入点,
  留着只为不破坏旧客户端,不要拿来显示;
- 列表按 `added_at` 倒序、同一秒的按 `document_id` 倒序,`limit` 默认 50、范围 1..=500,越界 400(2026-10-22 前静默夹)。
- `limit`、`offset`、`has_more` 2026-10-22 起回显;有没有下一页看 `has_more`,不用再拿 `offset + 条数 < total` 算(两者结果一样)。
- 带 `job_id` 时其余参数都不起作用,最多返回 1 条,`has_more` 恒为 `false`。
- 只认上面这些查询参数,不认识的 400(例如已删的 `tag`)。PATCH 只认 `title`、`reading_status`,别的字段 400。
- `DELETE /api/v1/documents/:document_id?force=true`:只认 `force`,拼错 400(以前当成不强删)。

书上的两个列表(2026-10-22 起同样回显 `limit`、给 `has_more`,不认识的查询参数 400):

```
GET /api/v1/documents/:document_id/jobs?limit=50&offset=0
    → data: { items[], invocation_summary, total, limit, offset, has_more }   ← limit 1..=500,默认 20
GET /api/v1/documents/:document_id/metadata-suggestions?limit=20
    → data: { suggestions[], limit, has_more }                                ← limit 1..=100,默认 20,没有 offset
```

- 书的任务列表的 `has_more` 改成多取一条判断(以前用 `total` 算,库里有读不出来的任务行时最后一页会误报还有);
  `total` 照旧是 `COUNT(*)`。一本书超过 50 个任务时,按 `has_more` 翻页才能看全。

### 2. 收藏

> 已删除：收藏功能 2026-09 整体删除，下面的 `/api/v1/favorites` 接口都已不存在（返回 404），只保留原记录。

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
GET /api/v1/search?q=光学光谱&limit=20[&document_id=xxx]
    → data: { query, hits[], limit, has_more }
      hits[]: { document_id, job_id, page_idx, block_id,
                source_snippet, translated_snippet }
```

- snippet 里命中词用 `[` `]` 包裹,前端可替换成高亮标签;
- 任意长度的 `q` 都能查(≥3 字符走 FTS5 全文索引,更短自动回退模糊匹配);
- `limit` 默认 20、范围 1..=100,越界 400(2026-10-22 前静默夹);`has_more` 表示命中不止这些(没有 `offset`,要更多就加大 `limit`);
- 只认 `q`、`limit`、`document_id`,不认识的参数 400。

### 4. AI 问答与 PDF Agent（已删）

> 2026-11-03 起前端不再调 `/api/v1/ai/*`：RetainPDF 自己的 AI（阅读页的 agent 终端和画板、主页「AI 问答」、设置里的
> AI Agent）删了，产品里只留笔记软件 Studio 的 AI（`frontend/studio`）。后端接口由后端会话随后删除，见
> [RetainPDF 不要自己的 AI](../../ops/planning/frontend-migration/20261103-RetainPDF不要自己的AI.md)。

### 5. 资产

> 已删除：`POST /api/v1/assets`、`GET /api/v1/assets/:asset_id` 2026-10-19 删除（返回 404）。
> 它们原本给收藏截图用，收藏 2026-09 删掉以后没有调用方。标签同样已删（2026-09-26），
> 书的列表不认 `tag`，PATCH 不认 `tags`。

### 6. AI 问答会话（已删）

> 同上，2026-11-03 起前端不再用。

### 7. 分类(合集):建文件夹给 PDF 分组

> `collections`/`collection_documents` 表随图书馆数据层一起建好,一直没接
> 路由;现在补上。v1 只做扁平文件夹:建的时候可以带 `parent_id`(前端不发),
> 改的时候不能改上级——`PATCH` 传 `parent_id` 2026-10-22 起返回 400(以前 200 但不生效)。
> 合集的请求体不认识的字段一律 400。

```
POST   /api/v1/collections                body: { name, parent_id? }
GET    /api/v1/collections                → `data.collections[]`（按 sort_order 排序，含 document_count）
PATCH  /api/v1/collections/:id             body: { name?, sort_order? }   ← 只认这两个
DELETE /api/v1/collections/:id             ← 只删文件夹本身,文档不受影响

POST   /api/v1/collections/:id/documents              body: { document_ids: [...] }
DELETE /api/v1/collections/:id/documents/:document_id
POST   /api/v1/collections/:id/agent-workspace        ← 物化文件夹的 Agent 工作区（单机版；旧写法 GET 2026-10-22 删了，现在 405）
```

- `agent-workspace`：终端切到「文件夹」范围前调一次，返回 `{ schema, collection_id, books[], skipped[] }`。
  编号不是建合集时生成的形状 400；合集不存在 404（2026-10-19 前是 200 + 空清单）；没有可读译文、超过 200 本上限的书在 `skipped[]` 里带 `reason`。
  删文件夹时后端顺手清掉它的工作区目录。

- 加入不存在的 `document_id` 返回 404(书的记录在、库里读不出来是 500,不说成不存在);重复加入同一文档幂等(不报错、不重复计数);
- 查看某个文件夹里有哪些文档:`GET /api/v1/documents?collection_id=xxx`(见第 1 节),
  拿到的每条记录里的 `active_job_id` 就是该文档当前可打开的处理记录;
- 要叠加任务活态(状态、进度、阶段)时,把上一步拿到的 `active_job_id` 集合拼进
  `GET /api/v1/jobs?job_ids=a,b&limit=n&include_live_stage=true`(`n` ≤ 500,超了分批;
  不排除 OCR 任务),标题读 `display_name`,阶段和进度读 `stage_snapshot`。
  旧的做法是同样拼进 `/api/v1/library/books?job_ids=`,书架 2026-10-22 删了。

## 两个必须处理的边界

1. **删除保护**:删除单个任务(`DELETE /api/v1/jobs/:job_id`;旧地址 `DELETE /api/v1/library/books/:job_id` 2026-10-22 删了)或文档
   (`DELETE /api/v1/documents/:document_id`)时,如果名下还有排队或运行中的任务,后端返回
   **409**(`error.code` 为 `CONFLICT`,2026-10-19 起带 `error.details.reason = "job_active"`,
   和任务操作同一个值;前端可以按它判断,不用再靠"409 且不是 job_has_dependents"去推)。带 `?force=true` 才会连运行中的任务一起删;前端不自动
   force,提示用户先取消任务再删除。删单个书籍时,如果别的任务还在用它的产物(比如换字体重排出的
   render 任务),也返回 409,`error.details.reason` 为 `job_has_dependents`,message 里列出依赖它的任务;
   前端按 reason 单独提示"先删掉那些任务",不说成"任务在跑"。整本删除不受这条影响。以前被收藏锚点挡住时的 `DELETE_BLOCKED_BY_FAVORITES` 和
   `clear_favorites_path` 已随收藏功能一起删掉。
   强删（`force=true`）会先取消运行中的任务再删；删单个任务时若别的任务还在用它的产物（重新排版的 render 任务），
   不带 `force` 返回 409 + `error.details.reason = "job_has_dependents"`。
2. **重复上传**:同一 PDF 再次上传不会产生新文档(documents 列表数量不变),
   前端不要假设"上传成功 = 列表多一条"。

## 建议的迁移路径(不强制)

1. **第一步只做增量**:阅读器里加"选中 → 收藏"和收藏侧栏(纯新增,不动现有页面)。
   收藏跳转:用锚点里的 `job_id + page_idx + block_id` 复用现有阅读器定位。
2. **第二步**再把图书馆主页从 `/api/v1/library/books` 投影切到 `/api/v1/documents`,
   拿到阅读状态 / 合集能力。(已完成:前端 2026-10 切完,书架 2026-10-22 删了。)

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
