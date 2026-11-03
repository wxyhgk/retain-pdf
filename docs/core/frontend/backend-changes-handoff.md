# 后端改动交接（给前端）

> 注：本文是带日期的交接记录，里面写的旧地址已于 2026-10-18 全部删除（返回 404），新旧对照见 [任务接口分类](../../api/01-任务/04-任务接口分类.md) 和 [下载总览](../../api/07-产物下载/01-下载总览.md)。

本文只记**需要前端配合才能落地**的后端改动：新端点、新字段、新错误码，以及
前端具体要改哪个文件。纯后端的加固（事务边界、超时收尾之类）不在这里。

按后端提交倒序排列，最新在上。

---

## OCR 这一站照 OCR 子任务的状态（fix/ocr-stage-from-child）

2026-11-02。字段不变，取值的含义变准了：任务的 OCR 交给子任务（`<任务>-ocr`）跑时，`stages.ocr.state` 照子任务，不再按阶段先后推。

| 情况 | 以前 | 现在 |
|---|---|---|
| OCR 和翻译并行（GLM-OCR），翻译已经开始、OCR 还在跑 | `completed` | `in_progress` |
| 翻译失败，OCR 子任务也失败了或被取消了（比如重启时一起停了） | `completed` | `failed` |
| 翻译失败，OCR 子任务之前已经成功 | `completed` | `completed`（不变） |

前端 `features/library/domain/translation-ocr-reuse.ts` 的 `translationOcrStatus` 先看 `stages.ocr.state`，所以不用改就不会再挑没做完的 OCR
去复用（以前挑中了，后端回 `OCR_JOB_NOT_SUCCEEDED`，界面说「现有 OCR 产物暂时无法复用」）。要看一眼的是「进度」页：并行时 OCR 站以前
靠 `ocr_stream` 显示全书页数，现在 `stages.ocr.state` 本身也是 `in_progress` 了，确认显示没有打架。

---

## 阅读页的「AI」打开 Studio 的 AI（feat/studio-bridge-ask-ai）

2026-11-02。契约 `contracts/studio-bridge.v1.schema.json` 只加不改：Studio 的能力 `StudioFeature` 加 `"ask-ai"`，新消息 `ask-ai`
（RetainPDF → Studio，只有 `protocol`、`v`、`type` 三个字段，不许别的字段）。放在 Studio 里时只留 Studio 的 AI。

| 地方 | 现在 | 要改成 |
|---|---|---|
| 阅读页的「AI」 | 打开 RetainPDF 自己的 agent 终端 | 握手过、`hello.features` 有 `ask-ai` 时：先把眼下的 `reading` 立刻发出去（不等防抖），再发 `ask-ai`，不打开自己的终端；Studio 没列 `ask-ai` 时照旧 |

---

## 告诉 Studio 眼下读到哪（feat/studio-bridge-reading）

2026-11-02。契约 `contracts/studio-bridge.v1.schema.json` 只加不改：新消息 `reading`（RetainPDF → Studio）。Studio 里只用 Studio 自己的 AI，
它用只读接口读书（`/api/v1/documents`、`/search`、`/documents/:id/reading`、`/jobs/:id/reader/regions(/:item_id)`），缺的只是作者眼下在读哪本、哪一页。

消息：`{protocol, v: 1, type: "reading", job_id, document_id, title, page_idx, page_count}`，五个字段都要写，没有的写 `null`：

- `job_id`：字符串（非空）或 `null`；`document_id`、`title`：和 `quote`、`open-notes` 里的同一套；
- `page_idx`：0 起的整数（和 `navigate`、阅读页地址的 `page_idx` 一样）或 `null`；`page_count`：≥1 的整数或 `null`；
- 离开阅读页（回主页、详情页）：同一种消息，五个字段全是 `null`，不另起类型。

| 地方 | 现在 | 要改成 |
|---|---|---|
| 收 `hello` 回 `ready` | `features` 有 `theme`、`navigate`、`quote`、`notes` | 实现了下面两行时加上 `reading`（Studio 不用在 `hello.features` 登记，照发） |
| 阅读页（握手后） | — | 进阅读页发一次 `reading`；翻页后防抖、停下来再发 |
| 离开阅读页 | — | 发一条五个字段都是 `null` 的 `reading` |

---

## 阅读页唤出笔记（feat/studio-bridge-notes）

2026-11-01。接着下一节，契约 `contracts/studio-bridge.v1.schema.json` 只加不改。做法见
[阅读页唤出笔记](../../ops/planning/studio-workbench/20261101-阅读页唤出笔记.md)。

| 地方 | 现在 | 要改成 |
|---|---|---|
| 收 `hello` | 记 origin、换颜色、回 `ready` | 另外记下 `hello.features`（可选，没有就当只有 `quote`）；`ready` 的 `features` 加上 `notes`（实现了下面两行时） |
| 阅读页工具栏（新按钮「笔记」） | — | 握手过、而且 `hello.features` 有 `open-notes` 才显示；笔记收着时点了发 `open-notes`（`job_id`、`document_id`、`title`，和 `quote` 里的同一套），开着时发 `close-notes` |
| 收 `notes`（新） | — | 按 `open` 显示「笔记」按钮按下没有；`title` 可以用作提示（「笔记：书名」） |

Studio 收到 `open-notes` 会在阅读页旁边（右边）开出这本书的笔记，iframe 会变窄，阅读页要能跟着宽度重排。

---

## 放在笔记（Studio）里时和它说话（feat/studio-bridge-contract）

2026-11-01。新加的契约，后端接口不变。做法和分工见 [书和笔记接在一起](../../ops/planning/studio-workbench/20261101-书和笔记接在一起.md)，
消息格式见 `contracts/studio-bridge.v1.schema.json`（每种消息一个定义，`description` 写了什么时候发、谁认）。

Studio 左栏「翻译」把 RetainPDF 的网页放进 iframe，地址带 `?embed=studio`。前端要做：

| 地方 | 现在 | 要改成 |
|---|---|---|
| 地址参数 `embed=studio`（`web/src/platform/navigation/pages.ts` 的 `parseReaderParams`/`buildReaderParams`，以及首页、详情页的地址） | 没有这个参数 | 认它；带着它时不显示自己的顶栏、品牌、回首页这些和 Studio 重复的东西；页面之间跳转时带着它 |
| 收消息（新） | — | 只在 `embed=studio`、`window.parent !== window` 时听 `message`；只认 `event.source === window.parent`、`event.origin` 是本机回环地址（`http://localhost`、`http://127.0.0.1`、`http://[::1]`，任意端口）、`protocol`/`v` 对得上的；收到 `hello` 记下 origin、按 `theme` 换颜色、回 `ready`（`features` 列出实现了的：`theme`、`navigate`、`quote`）；收到 `theme` 换颜色（不改自己存的设置）；收到 `navigate` 打开 `reader.html?job_id=&page_idx=&block_id=&embed=studio` |
| 阅读页悬停框（`packages/reader/src/pdf/ReaderTextHoverLayer.tsx`，「复制」那一组） | 编号 + 复制 | 握手过（收到过 `hello`）才多一个「摘到笔记」，点了发 `quote`：`job_id`、`document_id`、`title`、`item_id`（四位）、`page_idx`（原文页，0 起）、`source_text`、`translated_text`（取 `reader/regions` 那一项的 `source.text`、`translated.text`）；targetOrigin 是握手记下的 origin，不用 `'*'` |

没在 Studio 里（没有 `embed=studio` 或没握手）时一切照旧，悬停框不出现「摘到笔记」。

---

## 取一个阅读区块（feat/reader-region-item）

2026-11-01。新加的接口，旧的不变。接口说明见 [任务接口分类 · 阅读](../../api/01-任务/04-任务接口分类.md#阅读)。

| 地方 | 加了什么 | 前端用法 |
|---|---|---|
| `GET /api/v1/jobs/{job_id}/reader/regions/{item_id}` | 新接口：一个区块，和 `reader/regions` 的 `items[]` 里同一项一样（`ReaderRegionItem`）；`item_id` 三位、四位都认；还没有区块 404 `not_ready`，没有这一块普通 404 | 阅读页不用改。笔记里引用一段时用它，不用取整本 |

契约：`contracts/reader-data.v1.schema.json` 加端点 `getReaderRegion`。要前端做的只有一件：重新生成
`frontend/packages/api/src/generated`（`api-client-codegen.test.mjs` 的「src/generated 和契约端点表一致」在这之前是红的），
和后端分支配对合进 `main`。

---

## 翻译 agent 的编辑部事件、翻译覆盖带引擎（feat/agent-editorial-events）

2026-10-30。都是新加的，旧字段、旧地址不变。做法见 [编辑部事件接口](../../ops/planning/translation-agent/20261030-编辑部事件接口.md)，
接口说明见 [编辑部事件](../../api/02-进度事件/03-编辑部事件.md)。

| 地方 | 加了什么 | 前端用法 |
|---|---|---|
| `GET /api/v1/documents/{document_id}/translation-coverage` 的 `jobs[]`（`CoverageJobView`） | `engine`：`"legacy"` / `"agent"`（老任务、纯 OCR 任务是 `legacy`）；`has_editorial_events`：有编辑部事件可看 | 翻译站写「翻译 agent · 模型名」；`has_editorial_events` 为真才显示编辑部 |
| `GET /api/v1/jobs/{job_id}/progress/editorial?after=&limit=` | 新接口：`{ events, next_after, has_more }`，事件是 editorial.v1 原样；legacy 任务是空列表 | 进行中每隔几秒带上次的 `next_after` 轮询，`has_more` 为真马上再取；翻完从 `after=0` 取全量回放；`next_after` 比带去的 `after` 小就从 0 重取 |

契约：`contracts/library-documents.v1.schema.json`（`CoverageJobView` 两个新键）、`contracts/job-events.v2.schema.json`
（端点 `listEditorialEvents`，类型 `EditorialEventsQuery`、`EditorialEventListView`、`EditorialEvent`）。

事件和前端解析器 `frontend/web/src/features/editorial-room/domain/events.ts` 的格式一致，另外几处：`page` 是这次跑的第几页（1 起），
通读的请求 `page` 是 0；`run_started` 多一个 `resumed`（续跑时已经做完的页数），续跑会再来一条 `run_started`；`page_done.statuses`
四个键总在。

---

## 删书架旧地址：书架列表、书架删除、合集工作区的 GET 删了（refactor/drop-library-shelf-old-routes）

2026-10-22。前端 `refactor/library-shelf-to-jobs`、`fix/collection-workspace-post` 等分支进了 main（16d13071）以后删的，
做法、留了什么、用量数据见 [删书架旧地址](../../ops/planning/api-reorg/20261022-删书架旧地址.md)。

### 变了什么

| 地址 | 以前 | 现在 | 前端改用 |
|---|---|---|---|
| `GET /api/v1/library/books`（带不带 `job_ids` 都一样） | 书架列表（冻结） | `404` | `GET /api/v1/jobs?job_ids=…&limit=…`（`limit` 1..=500，分批） |
| `DELETE /api/v1/library/books/{job_id}` | 旧地址，OCR 任务 404 | `404`，删不掉任务 | `DELETE /api/v1/jobs/{job_id}` |
| `GET /api/v1/library/books/{job_id}` | 2026-10-19 删了，`405` | `404`（这个路径上一个方法都不剩了） | `GET /api/v1/jobs/{job_id}` |
| `GET /api/v1/collections/{collection_id}/agent-workspace` | 旧地址，行为和 POST 一样 | `405`（同一路径还有 POST），不物化、不碰磁盘 | 同一路径 `POST` |

契约 `contracts/library-books.v1.schema.json`（文件名、`$id` 不变）删了 `LibraryBookListView`、`LibraryBookListItemView`、
`LibraryBookDetailView`、`ListLibraryBooksQuery`、只给单本详情用的 `ArtifactDisplayItemView`（任务详情的同名类型在
`job-status` 契约里，不受影响），和三条书架端点。留着的：`JobListView`、`JobListItemView`、`JobFailureBriefView`、
`JobProgressView` 这些任务列表类型，`LibraryDeleteResultView`（`@retainpdf/api` 的 `deleteJob` 用）、`LibraryDeleteQuery`、
`ListJobsQuery`。`@retainpdf/contracts/library-books` 的生成类型跟着少了这几个。

### 前端要做什么

不用改：后端删之前核对过，`frontend/`（含 `dist` 构建产物）、`backend/ai`、`backend/cli`、桌面脚本里都没有调这三个地址的代码，
`frontend/packages/api/src/types.ts` 只从 `library-books` 导出 `LibraryDeleteResultView`；前端契约测试读的
`JobListItemView`、`JobFailureBriefView`、`JobProgressView`、`JobStageSnapshotView`、两个枚举都还在。

可选（只是注释里的说法，不影响运行）：`frontend/packages/api/src/jobs.ts:127`、`frontend/web/scripts/frontend-homepage-smoke.py:24`、
`frontend/packages/api/README.md:13` 里「书架冻结 / no longer called」可以改成「已删」。

---


## 0000000000. 书库标签残留清掉、`/assets` 两个接口删掉

分支 `chore/drop-tags-and-assets`（2026-10-19）。对应书库审计 A2、B11、B12，决定和取舍见
[删标签残留和资产接口](../../ops/planning/api-reorg/20261019-删标签残留和资产接口.md)。

### 变了什么

1. `POST /api/v1/assets`、`GET /api/v1/assets/:asset_id` 删了（404）。前端没有调用方，不用改。
2. 后端不再提标签：AI 的 `list_documents` 工具去掉 `tag` 参数和结果里的 `tags`；接口目录里书的 PATCH 说明改成「书名、阅读状态」；
   `library-api.md` 去掉 `tag=`、`tags[]`、`tags?`。**接口行为没变**：书列表的 `tag`、PATCH 的 `tags` 照旧被静默忽略。

### 前端要做什么

前端已在 `refactor/drop-document-tags` 改完（那个分支还没合），这里记下对照：

| 文件 | 旧写法 | 新写法 |
|---|---|---|
| `frontend/packages/api/src/documents.ts` | `DocumentListQuery.tag`，非空时 `params.set("tag", …)` | 去掉；`GET /documents` 只发 `limit`、`offset`、`reading_status`、`collection_id`、`q` |
| `frontend/web/src/features/library/domain/documents/update-document.ts` | `payload.tags !== undefined` 时把 `tags` 发给 PATCH 并回填卡片 | 去掉；`PATCH /documents/:id` 只发 `title`、`reading_status` |
| `frontend/web/src/features/library/ui/page/LibraryFilterMenu.tsx` | 按 `item.tags` 过滤（恒为空） | 去掉标签过滤 |

### 以后

前端和 AI 都不发以后（`refactor/drop-document-tags` 合进 main 之后），后端会给书列表的查询参数（`ListDocumentsQuery`）和
PATCH 的请求体（`PatchDocumentInput`）加 `deny_unknown_fields`：再发 `tag`、`tags` 或别的不认识的字段会 400。这一步这次不做。

---
## 000000000. 书架冻结：删单个任务改用 `DELETE /jobs/{job_id}`，书架列表改调 `GET /jobs?job_ids=`

分支 `refactor/library-books-freeze`（2026-10-19）。对应书库接口审计 A1，做法和取舍见
[书架冻结与删任务新地址](../../ops/planning/api-reorg/20261019-书架冻结与删任务新地址.md)，新接口见 [删除任务](../../api/01-任务/05-删除任务.md)。

### 后端变了什么（只增不改，前端现在不改也能用）

1. 新增 `DELETE /api/v1/jobs/{job_id}`（`?force=true` 可选）：删这个任务和它的 `{job_id}-ocr` 子任务，书留着。
   返回和书架删除一样（`deleted`、`job_id`、`removed_paths`、`removed_child_jobs`），409 / `job_has_dependents` / `force`
   的规则也一样；不同的只有：**OCR 任务也能删**（书架删除把它挡成 404），以及单删 OCR 子任务 `P-ocr` 而父任务 `P` 还在时
   409 + `job_has_dependents`。
2. `DELETE /api/v1/library/books/{job_id}` 变成旧地址（接口目录里标了），行为不变。（2026-10-22 删了，见最上面一节。）
3. `GET /api/v1/library/books/{job_id}` 删了（前端、AI、CLI 都没调过）。同一地址还有 DELETE，所以 GET 返回 405。
4. `GET /api/v1/library/books` 冻结：不再加字段，前端改完下面第 1 条以后删。（2026-10-22 删了。）
5. 契约 `library-books.v1` 里 `LibraryBookDetailView` 定义暂留（标了废弃），因为前端还引用它（见下面第 4 条）。（2026-10-22 删了。）

### 前端要改的

1. `frontend/packages/api/src/library-books.ts` 的 `fetchLibraryBookList`（调用方：文档卡片叠加活态
   `features/library/domain/documents/shape-documents-with-books.ts:60`，文件夹 `features/collections/domain/controller.ts:67`）：
   - 旧：`GET library/books?limit=n&offset=0&job_ids=a,b`
   - 新：`GET jobs?job_ids=a,b&limit=n&include_live_stage=true`（`limit` 必须在 1..=500，越界 400；名单超过 500 个分批请求）。
     返回 `JobListView`：`items[]` 是任务列表项，标题用 `display_name`（没有 `title`），阶段和进度在 `items[].stage_snapshot`
     （`stage`、`stage_detail`、`progress`，已有的 `flattenStageSnapshot` 能摊平；终态任务的 `stage_snapshot` 是 `null`），
     `has_more` 表示还有没有下一页。`/jobs` 不排除 OCR 任务，`shape-documents-with-books.ts:70-85` 那段「没命中再逐个
     `GET /jobs/:id` 补」以后基本用不上（可以留着兜底）。
   - mock：`frontend/web/src/platform/mock/index.ts:90` 的 `synthesizeMockBook` 要改成按 `/jobs?job_ids=` 的形状造数据。
2. `frontend/packages/api/src/library-books.ts` 的 `deleteLibraryBook`（调用方 `features/library/domain/recent-jobs/actions.ts:75`，
   只在卡片没有 `document_id` 时走，见 `documents/delete-actions.ts:76`）：
   - 旧：`DELETE library/books/{id}`（`?force=true`）
   - 新：`DELETE jobs/{id}`（`?force=true`），返回形状和错误处理（`error.details.reason`）不变。
     `stripOcrSuffix` 可以留着：传 `-ocr` 子任务编号本来就该删它的父任务；要单删 OCR 任务时别去后缀。
3. 最近任务分页 `features/library/domain/recent-jobs/loader.ts:85`（`fetchLibraryBookList` 选项）→
   `recent-jobs/library-books-resource.ts:29` → `recent-jobs/pagination.ts:81`：没有 `fetchJobList` 时回退调书架列表，
   书架不给 `has_more`，只能靠「短页」猜。改成只用 `fetchJobList`（`GET /jobs`，回包有 `has_more`），去掉这条回退和
   `fetchLibraryBookList` 选项（`app/home/composition/create-runtime-features.ts:196` 已经同时传了 `fetchJobList`）。
4. 契约类型：`frontend/packages/api/src/types.ts:19` 重新导出的 `LibraryBookDetailView`，和
   `frontend/web/tests/contracts/library-books-contract.test.mjs:66` 那条「LibraryBookDetailView 字段存在于契约」的测试，删掉。
   删完告诉后端，后端再从 `contracts/library-books.v1.schema.json` 删这个定义和那条标了 `removed` 的端点。
5. 上面 1、3 都改完、不再调 `GET library/books` 以后告诉后端，后端删书架列表和 `DELETE library/books/{id}` 旧地址。

**已完成**：前端 1–4 都改完进了 main（16d13071），后端 2026-10-22 删了书架列表、`DELETE library/books/{id}` 旧地址、
`LibraryBookDetailView` 和那条端点（`refactor/drop-library-shelf-old-routes`，见最上面一节）。
## 00000000. 合集工作区改用 POST；合集不存在从 200 变 404，编号不合格 400

分支 `fix/collection-workspace-path`（2026-10-19）。对应书库接口审计 A6，决定见
[合集工作区编号校验与 POST](../../ops/planning/api-reorg/20261019-合集工作区编号校验与POST.md)。

### 变了什么

1. 新地址 `POST /api/v1/collections/{collection_id}/agent-workspace`（请求体不用带东西），返回和以前的 GET 一样的清单
   `{ schema, collection_id, books[], skipped[] }`。同一路径的 `GET` 还能用、行为一样，标成旧地址，前端改完后删掉。
   （**已完成**：前端改用 POST，GET 2026-10-22 删了，现在 `405`。）
2. 合集不存在：以前 `200` + 空清单（还在磁盘上建出空目录），现在 `404 collection not found: …`。
3. 编号不是建合集时生成的形状（`col-` + 14 位数字 + `-` + 6 位小写十六进制）：`400 invalid collection_id: …`。
   前端用的都是 `/collections` 列表里拿到的编号，正常走不到。
4. 还没有可读译文的书一律在 `skipped[]`（`reason: "还没有可读的译文"`）；以前会退回书卡的 `active_job_id`，可能链到还在跑的任务。
   一个文件夹超过 200 本时，多出来的也写进 `skipped[]`（以前悄悄少掉）。
5. 删文件夹（`DELETE /collections/{id}`）后，后端清掉它的工作区目录。响应不变。

### 前端要做什么

- `frontend/web/src/features/reader/domain/terminal-scope.ts:91` 的 `ensureCollectionWorkspace`：
  旧写法 `` fetchJson(`/api/v1/collections/${encodeURIComponent(collectionId)}/agent-workspace`) ``（GET）；
  新写法同一路径改成 `POST`。`fetchJson` 现在只发 GET（定义在 `frontend/web/src/features/reader/ui/terminal-chrome.tsx`，
  `fetch(new URL(path, baseUrl), { headers: { "X-API-Key": apiKey } })`；第 150 行把它传给 `ensureCollectionWorkspace`），
  要给它加一个方法参数，或者另传一个发 `method: "POST"` 的函数。
  对应测试 `frontend/web/tests/reader/terminal-scope.test.mjs` 跟着改。（**已完成**，前端已经发 POST。）
- 404 不用专门处理：`fetchJson` 遇到非 OK 抛 `HTTP 404`，`ensureCollectionWorkspace` 已经把它当失败原因显示、不切范围。
  如果想给出中文提示，可以对 404 说「这个文件夹已经不存在了」。
- `skipped[]` 的 `reason` 文字变了（只给 agent 和人看，前端没有按它判断），不用改。

---

## 0000000. 还没产出：404 带 `error.details.reason = "not_ready"`，任务不存在是不带 reason 的 404

分支 `fix/not-ready-404`（2026-10-19）。对应审计 C3、D2，规矩见 [错误约定](../../api/00-约定/02-认证与错误.md#还没产出404)，
逐个接口的改前改后见 [实现记录](../../ops/planning/api-reorg/20261019-还没产出返回404实现记录.md)。

### 变了什么

1. 原始文件和报告（`/jobs/{id}/files/output|pages|internal/…`、`reader/markdown`、`reports/translation|translation-qa|layout-fit|refine`、
   `translations/{item}` 及修订历史 / 改写 / 重翻）：任务在、东西还没产出时 `404` + `error.details.reason = "not_ready"`，
   `message` 统一成 `<名字> not ready`（如 `translated.pdf not ready`，不再带任务编号）。原来就是 404，只是多了 `reason`、换了措辞。
2. 任务不存在：照旧 `404`，`error.details` 是 `{}`，`message` 是 `job not found: …`。
3. 状态码变了的只有三处：
   - `files/output/all.zip` 任务没成功时 `409 job is not finished successfully` → `404` not_ready `all.zip not ready`；
   - `GET /jobs/{id}/translations` 还没有翻译清单时 `404` → `200` 空列表；
   - `reports/quality`、`reports/quality/items`、`data`、`data/{dataset}` 在任务还没有输出目录（排队中）时 `404 job has no output directory` → `200`
     （各段 `null`、空清单、`available: false`）。
4. 阅读器会碰到的地址（`/jobs/{id}`、`files`、`reader/regions`、`reader/metadata`、`reader/markdown`、`files/output/ocr.md`、`ocr/images/…`、
   `translated.pdf`、`/documents/{id}/files/source.pdf`、`/documents/{id}/reading`、`progress/layout`、`progress/pages/{page}`、`ai/board`）
   状态码**都没变**；其中 `reader/markdown`、`ocr.md`、`ocr/images/…`、`translated.pdf` 没产出时多了 `reason: "not_ready"`。
   边翻边看的 `error.code`（`LIVE_TRANSLATION_LAYOUT_NOT_READY` 409、`LIVE_TRANSLATION_PAGE_NOT_COMMITTED` 404）没动。

### 前端要做什么

- `frontend/packages/reader/src/hooks/reader-session/session-load-plan.ts` 的 `isStaleDocumentJobFailure`：
  旧写法 `input.status === 404 && !input.jobId && …`，正在跑的书拿到译文 PDF 的 404 也会被当成"任务丢了"退回原文；
  新写法加一条 `&& input.reason !== "not_ready"`，`session-assets.ts`（约 458 行）调用时把错误体里的 `error.details.reason` 传进去
  （抛出的错误要带上响应体里的 `reason`）。不改也不会比现在差：这些地址原来就是 404。
- `frontend/packages/api/src/translation-debug.ts`（可选）：`fetchTranslationDiagnostics`、`fetchTranslationItem` 现在 404 一律说
  「未找到…请确认已完成翻译」；可以按 `reason === "not_ready"` 说「还没生成」，没有 `reason` 说「任务不存在」。
  `fetchTranslationItems` 的 `404 → 空列表` 分支以后只在任务不存在时走到，不改也对。
- `all.zip`：前端没有按 409 判断，不用改。质量卡、取数在排队任务上从报错变成空状态，不用改。
- 判断"还没好"只看 `error.details.reason`，不要匹配英文 `message`（措辞已经变了：`pdf not ready: <id>` → `translated.pdf not ready`、
  `markdown not found: <id>` → `markdown not ready`、`refine report not found: <id>` → `refine report not ready`……）。

---

## 000000. 删除要顾到别的任务：强删先取消，被引用的任务不能直接删，删任务清全文索引

分支 `fix/force-delete-stops-runner`（2026-10-19）。对应状态一致性审计 1-#5、2-#1/#2/#4。

### 变了什么

1. `DELETE /library/books/{job_id}?force=true` 和 `DELETE /documents/{document_id}?force=true`：删之前，对其中排队 / 运行中的任务
   先走和 `POST /jobs/{job_id}/actions/cancel` 同一条路径（登记取消 + 终止 worker 进程），再删行删目录。以前强删既不取消也不杀进程，
   worker 继续花 OCR / 模型的钱，runner 的下一次落库还把已删的任务写回来（没有 `document_id` 的幽灵任务）。
   现在 runner 的落库写（CAS）在行不存在时不再 INSERT，runner 见到行没了会终止 worker 并收手。响应形状不变。
2. **新的 409 原因 `job_has_dependents`**：`DELETE /library/books/{job_id}` 删某个任务时，如果删除范围（该任务 + 它的 `-ocr` 子任务）之外
   还有别的任务在用它的产物（`request_payload.source.artifact_job_id` 指向它，典型是「换字体重新排版」产生的 render 任务，
   译文目录就是源任务的 `translated/`），返回 `409` + `error.details.reason = "job_has_dependents"`，message 里列出依赖者的编号，什么都不删。
   以前照删，之后整本书的 `/documents/{id}/reading` 因为找不到译文目录返回 500。带 `?force=true` 仍然放行（调用方明确要删）；
   `DELETE /documents/{id}` 整本删除时依赖者本来就在删除范围内，不受影响。原地重新渲染的任务引用自己，不算依赖。
3. 删除任务时同时清掉它在全文索引里的行（`blocks_fts`），再按这本书剩下的成功任务重建索引；搜索不再命中已删的任务。

### 前端要做什么

**不用改代码**（前端没有传 `force`；删书走的是 `DELETE /documents/{id}`，不会撞到 `job_has_dependents`）。
如果以后用删单个任务的接口（现在是 `DELETE /jobs/{job_id}`；书架的 `DELETE /library/books/{job_id}` 2026-10-22 删了）：遇到 `reason === "job_has_dependents"` 提示「先删除依赖它的任务（message 里有编号）」，
不要自动加 `force`。

---

## 00000. 请求体里不认识的字段一律 400

分支 `fix/unknown-fields-400`（2026-10-19）。所有用 `ApiJson` 读、目标类型 `deny_unknown_fields` 的请求体（邀请码、agent 会话、
译文修订 PATCH、retry-stage、resolve-ocr-ambiguity……），遇到不认识的字段从 `422 UNPROCESSABLE_ENTITY` 改成 `400 BAD_REQUEST`，
message 形如 ``unknown field `x`, expected one of ... in the request body``（只带字段名，不带值）。字段类型不对、缺字段、
枚举值不认识仍是 `422`。前端核对过没有地方按 `422` 判断，不用改。

## 0000. 任务操作被拒：状态不允许一律 409，带 `error.details.reason`

分支 `fix/actions-409-reasons`（2026-10-19）。对应审计 B1、B8。规矩见 [错误约定](../../api/00-约定/02-认证与错误.md)。

### 变了什么

1. **状态码**：任务或产物的当前状态不允许 = `409`；请求本身写错了 = `400`。
   以前 `retry-stage`（ocr / translation / render，含原地重渲染）和 `resume`/`rerun` 在「任务在跑」「产物不在」时返回 `400`，
   只有精修和取消返回 `409`。现在这些全是 `409`。仍是 `400` 的：`mode` 不支持、`refine` 对象放在非 refine 阶段、
   `create_new_job=false` 用在 ocr / translation、`create_new_job=true` 用在 refine、`overrides` 不合法、请求体里有不认识的字段。
2. **稳定原因**：每个任务操作的 `409` 都有 `error.details.reason`（信封其他部分不变）：

   | `reason` | 什么时候 | 接口 |
   |---|---|---|
   | `job_active` | 任务在排队/运行，先取消 | retry-stage（所有阶段）、resume/rerun、resolve-ocr-ambiguity |
   | `job_not_active` | 取消一个不在跑的任务 | cancel |
   | `artifacts_missing` | 要用的产物或原始来源不在 | retry-stage、resume/rerun |
   | `translations_not_owned` | 精修的任务渲染的是别的任务的译文 | retry-stage refine |
   | `ambiguous_ocr_dispatch` | OCR 派发结果不确定：走 resolve-ocr-ambiguity（绑定回执或接受重复风险），不要引导去重试翻译 | retry-stage（ocr）、resume/rerun |
   | `ambiguous_translation_request` | 翻译请求结果不确定：重复风险确认后 retry-stage(translation) + accept_duplicate_risk | retry-stage（translation）、resume/rerun |
   | `request_journal_corrupt` | 翻译请求日志损坏，确认也修不好 | retry-stage translation、resume/rerun |
   | `model_executor_unsupported` | 绑定了 Rust 模型执行器，这条旧路径不支持 | retry-stage、resume/rerun |
   | `stale_resolution` | OCR 歧义的 `resolution_revision` 过期，或被别的请求处理了 | resolve-ocr-ambiguity |
   | `no_ocr_dispatch` | 没有可处理的 OCR 歧义（既不是失败也不是已取消，或没有派发记录） | resolve-ocr-ambiguity |
   | `ocr_dispatch_unsupported` | 该服务商/操作不支持绑定收据 | resolve-ocr-ambiguity |

   `reason` 只增不改，不认识的值按「状态不允许，看 `message`」处理。
3. **GET 里同一套值**（只增字段）：`GET /jobs/:id/actions` 每个阶段多 `disabled_code`（`disabled_reason` 为空时是 `null`；
   翻译阶段在请求结果不确定时 `can_retry` 仍为 true、`disabled_code` 是 `ambiguous_translation_request`）；
   `GET /jobs/:id/actions/resume` 多 `reason_code`（能续跑时 `null`）。
4. **`retry-stage` 和 `resolve-ocr-ambiguity` 的请求体不认识的字段返回 `400`**（message 形如 ``unknown field `createNewJob`, expected one of ...``）。
   后端自己在 `GET actions` 里给的 `action.body` 都在可用字段内（有测试锁）。可用字段：`stage`、`mode`、`create_new_job`、`overrides`、
   `ambiguous_request_policy`、`refine`。
5. 翻译请求日志损坏（`request_journal_corrupt`）时，`GET actions` 里 translation 的 `can_retry` 现在是 `false`（以前是 `true`，点了必 409）。

### 前端要做什么

- `frontend/web/src/features/job-detail/domain/dialog/resume-actions.ts` 的 `isAmbiguousTranslationRerunError` 和
  `page/resume.ts` 里调用它的地方：现在靠正则匹配 `409` 和英文 `translation request outcome is ambiguous` 判断。
  改成读错误体：`error.details.reason === "ambiguous_translation_request"`（需要把 `ApiError` 里的响应体带出来）。
  OCR 的歧义是另一个值 `ambiguous_ocr_dispatch`，处理办法是 resolve-ocr-ambiguity，不能走翻译的重复风险确认。损坏的日志是 `request_journal_corrupt`，**不要**再给「接受重复风险」的入口。
  这两处不改也能用：消息文字没变，旧写法仍然匹配；改了以后不再依赖英文措辞。
- 凡是判断「任务在跑」的，用 `reason === "job_active"`，不要看 `message`。
- OCR 歧义现在在默认的 book/翻译任务上也认得出来（以前 OCR 派发记录挂在 `<id>-ocr` 子任务上，按任务编号查不到）：
  `GET /jobs/{id}/reports/failure` 的 `ocr_ambiguity` 会对这类失败任务给出值，`retry-stage`（ocr）和 `rerun` 会返回
  `409 reason=ambiguous_ocr_dispatch`，`resolve-ocr-ambiguity` 对它们可用。提交出错（超时、断连）和上传中途取消、
  进程在回执落库前重启，都会让派发记录变成 ambiguous。前端不用改；已经按 `ocr_ambiguity` 出处理入口的页面，会在这些任务上多出现该入口。
- `retryJobStage` 之类别往请求体里夹 `retry-stage` 不认识的字段（书籍元数据等），否则 `400`。后端侧已核对过目前发的只有
  `stage`、`mode`、`create_new_job`、`overrides`、`ambiguous_request_policy`、`refine`。
- 以前依赖「在跑 / 产物不在返回 400」的分支改看 `409`。

---

## 000. 续跑的正名是 `actions/resume`，任务视图加了 `actions.resume`

分支 `refactor/actions-resume-canonical`（2026-10-19）。只增不改。

- `POST /api/v1/jobs/:job_id/actions/rerun` 和 `actions/resume` 一直是同一个处理函数，现在在登记表里标成旧地址，行为不变，旧地址照常能用。
- 任务视图的 `actions` 加了 `resume`：`{enabled, method: "POST", path: ".../actions/resume", url}`，`enabled` 和 `rerun` 相同。`actions.rerun` 先留着、同值。
- 契约：`contracts/job-status.v1.schema.json` 的 `JobActionsView` 加了必有的 `resume`。
- 前端要改的：把读 `actions.rerun.url`、`actions.rerun.enabled`、调 `rerunJob` 的地方改成 `actions.resume`。等前端不再用 `rerun` 以后，后端删掉旧地址和 `actions.rerun`。

## 00. 列表项的 `failure` 进了契约：job-failure-brief 契约测试可以改比 schema

分支 `feat/contract-job-failure-brief`（2026-10-18）。JSON 不变，只是把一直存在、但没人描述过的 `failure` 补进契约。

- 定义：`contracts/library-books.v1.schema.json#/definitions/JobFailureBriefView`；`job-status.v1.schema.json` 里有结构相同的一份（两份由 `contracts/tests/job-definitions-parity.test.mjs` 锁一致）。（2026-10-23 `library-books` 那份和这条测试删了，只看 `job-status.v1`。）
- `JobListItemView.failure` 是**可选**属性（只有失败的任务才有，成功、进行中的整个键不出现，不是 null）。
  `JobFailureBriefView` 的 `category`、`stage`、`retryable`、`summary` 必有；`root_cause`、`suggestion`、`provider` 没有时键也不出现。
- 生成的 TS 类型已更新：`@retainpdf/contracts/library-books` 和 `/job-status` 都导出 `JobFailureBriefView`，`JobListItemView.failure?: JobFailureBriefView`。（2026-10-23 起只有 `/job-status` 导出。）
- 前端要改的：`frontend/web/tests/contracts/job-failure-brief-contract.test.mjs` 现在读 `backend/packages/retainpdf-jobs/src/views/job_types.rs`
  抠字段；改成对照上面这个 definition 的 `properties` / `required`，不再读 Rust 源码（这条由前端会话自己改，后端不动 `frontend/`）。
  `frontend/packages/domain` 里手写的失败简报类型也可以换成生成的 `JobFailureBriefView`。
- 后端侧有测试锁：`backend/api/src/api_tests/job_view_contract.rs` 的 `failed_job_list_item_failure_matches_published_schema`
  用真实路由取失败任务的列表项，`failure` 的键集合必须等于这个 definition。

## 0. 三阶段（OCR / 翻译 / 渲染）展示：数据够用了，但要读对地方

后端提交：`364aaaf9` `b575906e` `c85ff4af` `fce89bcc`

### 必须改代码的只有一处

`JobStageTiming` 新增两个 **required** 字段,生成的 DTO 已同步
(`@retainpdf/contracts` → `contracts/dist/job-status.d.ts`):

```ts
export interface JobStageTiming {
  stage: string; detail: string | null;
  enter_at: string; exit_at: string | null;
  duration_ms: number | null;
  terminal_status: JobStatusKind | null;
  progress_current: number | null;   // ← 新增，required
  progress_total: number | null;     // ← 新增，required
}
```

只读不构造的地方不受影响。**手工构造完整对象的地方**(测试 fixture、mock 数据
最可能)TypeScript 会报缺字段,填 `null` 即可。

同理 `RuntimeInput` 早先加过 `no_output_timeout_seconds`(也是 required,填 `0`)。

### 各读哪里

| 要显示什么 | 读哪里 |
|---|---|
| 现在在哪一段、进行到哪 | `stage_snapshot`(带 `stage` + `substage`)+ `stages.*.state` |
| 实时推送 | `GET /api/v1/jobs/:id/live-events`(SSE 长连接) |
| 细阶段流水 | `GET /api/v1/jobs/:id/events`，按 `display_stage` 分组、过滤 `lane=main` |
| **完成后回顾各段耗时与进度** | `runtime.stage_history`(新的 `progress_current/total`) |

**不要用 `stages.*.progress` 做完成后的回顾**——它只反映当前活跃阶段的瞬时
快照,阶段一结束就回到 null。这是有意为之:`stages` 回答「现在怎么样」,
`stage_history` 回答「当时怎么样」,两个问题两个地方。

另一个做法(终态回填 `stages.*.progress`)被否掉了:那样失败任务会显示
「translation: 30/50」,看上去像还在跑、实际是死在了 60% 处,前端必须同时读
`state` 才能判断这个数是活的还是死的。

### 事件长这样（字段是为三段展示设计的）

```jsonc
{ "display_stage": "ocr",              // 三段归属：ocr / translation / render
  "stage": "ocr_result_ready",         // 细阶段（全流程 15 个）
  "substage": "done",
  "lane": "main",                      // main / diagnostic / background
  "stage_detail": "Paddle 正在解析文件，第 4/4 页",   // 中文，可直接展示
  "provider": "paddle", "provider_stage": "done",
  "progress": { "unit": "step", "current": 4, "total": 4, "percent": 100.0 },
  "elapsed_ms": 0,
  "raw": { "source_kind": "ocr_child" } }              // 子任务事件已并入父流
```

三段各自的细阶段:

| 段 | 细阶段 |
|---|---|
| OCR | `ocr_submitting` → `ocr_upload` → `ocr_processing` → `ocr_result_ready` → `normalizing` |
| 翻译 | `translating` → `translate` → `continuation_review` → `page_policies` → `garbled_repair` |
| 渲染 | `rendering` → `render_prepare` → `render_preprocess` → `render` |

### 不用改代码，但行为变对了

- **`stage_history` 顺序修正**。以前是
  `translating → finished → rendering → failed`——「完成」夹在「渲染中」前面,
  没法按顺序画时间线。现在是 `translating → rendering → finished`。
  若之前为这个乱序写过绕过逻辑,可以删了。
- **进度文案不再自相矛盾**。以前会出现「进度 100% · 正在开始翻译」
  (数字来自 durable checkpoint、文字是阶段入场语),现在两者同源。
- **渲染阶段不再顶着翻译的进度**。归档刚上线时 rendering 和 finished 会带着
  翻译的 `59/59`(那是文本块数,不是页数),已修。

### 一个仍然存在的不一致

`stages.render.progress` 在任务结束后常残留一个 `2/3`,而 ocr / translation
是 null。那是 `background_snapshots` 里的残影,不是渲染的真实进度。**画完成后
的回顾一律走 `stage_history`**,就不会碰到它。

---

## 0.5 阅读视图分段读 markdown：用 HTTP Range，不新增端点

后端提交：`perf(api): markdown 原文改走文件流，直接支持 Range`

### 结论先说

你提案里的 `/markdown/metadata` 和 `/markdown/chunks` 两个端点**都不做**，
改用已有的 `GET /api/v1/jobs/:job_id/markdown?raw=true` + 标准 HTTP `Range`。

后端 API 已经 113 个,markdown 一个资源就占 3 条。加两条自定义端点去做一件
HTTP 本来就定义了的事,不划算。

### 为什么 metadata 端点不做

它的每一个字段,job detail 的 `artifacts.markdown` 里都已经有了:

| 提案的 `MarkdownMetadataView` | 已有的位置 |
|---|---|
| `ready` | `artifacts.markdown.ready` |
| `total_bytes` | `artifacts.markdown.size_bytes` |
| `raw_path` / `raw_url` | `artifacts.markdown.raw_path` / `raw_url` |
| `images_base_path` / `images_base_url` | 同名字段 |
| `chunks_path` | 不再需要 |

而且 `Content-Range: bytes 0-262143/620000` 的分母就是总字节数,第一次请求
就拿到了,连预先查一次都不用。

### 为什么 chunks 端点不做

`stream_file` 早就实现了完整的 Range(解析头、`206`、`Content-Range`、
`Accept-Ranges`、seek + 流式读),只是 markdown 这条路没接上——它原先把整篇
`read_to_string` 进堆再整个返回。现在接上了,顺带修掉了那次整篇读入
(实测最大的 `full.md` 是 620 KB)。

你否掉 Range 的理由是「按字节切会切到行/多字节字符中间,前端拼行更麻烦」。
多字节那半在浏览器里不成立:`TextDecoder(..., { stream: true })` 就是为跨块
序列设计的,是内置能力。行边界那半确实要前端做,但只有几行。

### 前端要怎么用

```js
const res = await fetch(rawUrl, {
  headers: { ...apiHeaders, Range: `bytes=${offset}-${offset + WINDOW - 1}` },
});
// 206；Content-Range: bytes <start>-<end>/<total>
const total = Number(res.headers.get("Content-Range").split("/")[1]);
const etag = res.headers.get("ETag");
```

两件必须自己做的事:

1. **字符边界**：整段读取过程共用**一个** `TextDecoder`,每次
   `decoder.decode(bytes, { stream: true })`。**不要**每段单独解码——那会在
   跨块的多字节字符上出乱码。
2. **行边界**：一段可能停在行中间,会把代码块 / 表格行 / 公式劈开。把最后一个
   `\n` 之后的残余留下,拼到下一段开头再交给渲染。

**版本检测**：比对各段的 `ETag`(size + mtime)。正文由 pipeline 一次性整篇写出,
当前没有任何路径会就地改写它(非 render 的 rerun/retry 都建新 job;render 就地
重跑只动 `rendered/` 里的译文 PDF),所以偏移量在实践中是稳定的——但那是当下 job 生命周期的
性质,不是这个端点给的保证。`ETag` 中途变了就从 0 重来,否则拼出来的是两个版本
的混合,而且是静默的。也可以直接用 `If-Range`。

### 几点提醒

- 图片仍是正文里的原始相对路径(`images/...`),用 `images_base_url` 解析。
  **复用 `frontend/packages/domain/src/job/artifacts.ts` 的
  `resolveMarkdownAssetUrl`,别在新数据层里重写一遍**——它第 281 行那个
  `while (rel.startsWith("images/"))` 是在剥双重前缀(`images_base_url` 已经
  以 `/images/` 结尾,而正文里写的是 `images/x.png`),漏掉就是 404。
- 不带 `Range` 时行为不变:`200` + 整篇,旧调用方不受影响。
- `/markdown/document` 保留。但阅读器迁走后它只剩 job-detail 页在用,而它贵在
  两处:整篇正文返回两份(原文 + 图片链接重写版),外加 `walkdir` 遍历整个 images
  目录逐个 stat + mime_guess。**如果 job-detail 那边也能改用 `?raw=true`,这条
  端点就可以删掉**,markdown 从 3 条端点收敛到 2 条。要不要做由你定,后端这边
  随时可以配合。

---

## 1. 收藏挡住删除 → 结构化 409 + 清空收藏端点

> 已撤销：收藏功能 2026-09 整体删除，`DELETE_BLOCKED_BY_FAVORITES` 和清空收藏的端点后端都已删掉（`chore/drop-favorites-errors`），
> 前端处理它的代码、批量删除的「一并删除收藏」二次确认也已删（`refactor/drop-favorites-leftovers`）。删除现在只在还有排队或运行中的任务时返回 409，见
> [图书馆数据层 API](library-api.md) 的「删除保护」。下面保留原记录。

后端提交：`feat(library): 收藏挡住删除时返回结构化 409，并给出清空收藏的端点`

### 变了什么

删除文档 (`DELETE /api/v1/documents/:document_id`) 或删除馆藏图书
(`DELETE /api/v1/library/books/:job_id`) 被收藏锚点挡住时，409 的响应体从
「一句中文 message」变成了带 `error.code` 和 `error.details` 的结构化错误。

同时新增两个端点，用来一次性清空收藏。

### 前端要做什么

**别再从 message 里正则抠数字。** 那句话会随文案改动和多语言而变。

```jsonc
{
  "code": "DELETE_BLOCKED_BY_FAVORITES",
  "message": "document is referenced by 2 favorite(s); remove the favorites first",
  "error": {
    "code": "DELETE_BLOCKED_BY_FAVORITES",
    "http_status": 409,
    "details": {
      "scope": "document",              // 或 "job"
      "document_id": "6f1c…",           // scope=job 时是 job_id
      "favorite_count": 2,
      "clear_favorites_path": "/api/v1/documents/6f1c…/favorites"
    }
  }
}
```

文档级和 run 级**共用同一个错误码**，因为前端要做的事一模一样，只有清空目标
不同，而那个目标已经在 `clear_favorites_path` 里给好了。所以只需要一个分支：

> 读 `favorite_count` → 提示用户「该文档有 N 条收藏，是否一并删除？」
> → 确认后 `DELETE clear_favorites_path` → 重试原来的删除

`DELETE clear_favorites_path` 返回 `{"data": {"deleted_count": N}}`。

几个边界：

- 幂等：目标存在但没有收藏时返回 `deleted_count: 0`，不是错误
- 目标不存在是 **404**，不要和上一条混为一谈
- `force=true` **不绕过**收藏保护，它只绕过「运行中的任务不可删」
- run 级的清空会连 `{job_id}-ocr` 子任务的收藏一起清（因为它解锁的那次删除
  会连着删子任务），所以清一次就够，不会出现「重试又 409」

详见 [图书馆数据层 API](./library-api.md#两个必须处理的边界)。

---

## 2. 新增 `no_output_timeout_seconds`（空闲超时）

后端提交：`fix(jobs): 给 worker 输出收尾加上限…` 之后的空闲超时提交

### 变了什么

任务提交的 `runtime` 块多了一个字段：

```jsonc
"runtime": {
  "timeout_seconds": 1800,
  "no_output_timeout_seconds": 0    // 新增，0 = 关闭（默认）
}
```

`timeout_seconds` 是整段执行的上限，必须按最坏情况给——一本大部头翻译几小时
是正常的，阈值就得设到几小时。于是「打完第一行就卡住不动」这种情况也要等满
那几小时才被发现。

`no_output_timeout_seconds` 独立地盯「还在不在动」：每收到一行 stdout 就重新
计时，只有 worker 彻底不出声才触发。

两者都判为 `failed` / `process_timeout`（处置方式一样），但 `stage_detail` 不同：

| 触发者 | `stage_detail` |
|---|---|
| `timeout_seconds` | `provider timeout`（normalizing 阶段是 `normalization timeout`） |
| `no_output_timeout_seconds` | `no output for {N}s` |

**这个区分是给用户看的**：前者要调阈值或降并发，后者要查上游是不是不回包了。
如果前端有失败原因的展示或文案映射，`no output for {N}s` 需要一条对应的说法。

校验：负数会被 400 拒绝（`no_output_timeout_seconds must be zero (disabled) or
a positive integer`）；`0` 和正数都放行。

### 前端要做什么

**默认关闭，所以不改也不会坏。** 想让用户能设它的话，要改两处字段白名单——
它们是手写的列表，不是从 `@retainpdf/contracts` 的类型生成的：

- `frontend/packages/api/src/jobs-submit.ts` 的 `legacyTopLevelFields`
  （在 `"timeout_seconds"` 旁边加 `"no_output_timeout_seconds"`）
- `frontend/web/src/platform/api/legacy/jobs-submit.ts`：第 33 行附近的字段
  数组，以及第 101 行附近 `appendFormField(form, "timeout_seconds", …)` 那句
  旁边补一句同形的

（原来 multipart 的 `/api/v1/translate/bundle` 也接受同名的扁平字段，该接口已于 2026-10-19 删除，
只剩 JSON 的 `runtime` 块。）

生成的 DTO 类型 `@retainpdf/contracts` 的 `RuntimeInput` 已经带上这个字段
（`contracts/dist/job-status.d.ts`），是 **required**——如果哪里在手工构造
完整的 `RuntimeInput` 对象，TypeScript 会要求补上，填 `0` 即可。

详见 [任务提交 API](../../../backend/api/docs/api-spec/jobs-submission.md) 的
Timeout note 一节。

---

## 3. 取消语义：normalizing 不再豁免

后端提交：`fix(jobs): 取消一律终止进程，normalizing 不再豁免`

### 变了什么

此前 OCR 任务在 `normalizing` 阶段点取消，后端会**跳过杀进程**，让它跑完。
结果是用户点了取消，任务却继续显示 running 直到自然结束。现在取消一律终止进程。

### 前端要做什么

**不用改代码**，但有一个时序需要知道：

OCR 专用的取消 (`POST /api/v1/ocr/jobs/{job_id}/cancel`) 只在任务还是
`queued` 时由它自己写终态行。过了这个点，它杀进程，终态由 runner 观察到进程
退出后写入。所以**取消后立刻轮询，可能还会读到一次 `running`**。

如果现在的实现是「取消成功 → 立即认定已取消 → 停止轮询」，那会显示不一致；
应该继续轮到状态真的变成 `canceled`。这个时序在改动前后都存在（改动前更糟：
它可能永远不变），只是现在窗口很短。

详见 [任务重试与控制](../../../backend/api/docs/api-spec/jobs-retry-and-control.md#cancel-job)。

---

## 重启后翻译自动续跑先看请求日志（fix/translation-resume-journal-gate）

后端提交：`fix(runner): 重启后翻译自动续跑先看请求 journal，结果不明就落 failed`

### 变了什么

API / jobsd 重启时，翻译阶段运行中的任务以前一律自动续跑，续跑的 Python 会把重启前在途、结果不明的请求原样再发一遍（可能重复计费），而手动重试要用户确认。
现在：请求日志里有「已发出、没有终态」的请求（或日志读不了）时，任务不再自动续跑，落成 `failed`，`failure_code = translation_request_ambiguous`，
`translation_request_recovery.requires_confirmation = true`。日志干净或没有日志时仍自动续跑。

### 前端要做什么

**不用改代码。** 失败任务走的就是已有的歧义路径：`GET actions` 里 translation 的 `can_retry=true`、`disabled_code=ambiguous_translation_request`，
`retry-stage` 不带 `accept_duplicate_risk` 返回 409 `ambiguous_translation_request`。`failure_code` 是新增的取值，前端按「不认识的值显示 `summary`」处理即可。

---

## 数据库恢复后对账、自动续跑次数上限（fix/recover-after-restore-and-crash-loop）

### 变了什么

1. **数据库恢复**（`POST /api/v1/backups/{id}/restore`）：备份时在排队 / 运行的任务，以前恢复出来一直是 running（没人在跑，一直转圈、rerun 409）。
   现在恢复时清掉它们的旧 pid，并立即按重启时的规则对账：有断点的回到 `queued` 自动续跑，没有的落 `failed`（`failure_code = worker_process_missing`）。
   任务跑在 jobsd 里时由 jobsd 的巡检接手，最多约 2 分半。接口的请求、返回都没变。
2. **自动续跑次数上限**：同一次运行连续 3 次自动续跑都没有新进度就又中断，第 4 次不再续跑，任务落 `failed`，
   `failure_code = auto_resume_limit_exceeded`（`failure_category=internal`、`retryable=true`、`resume_from=null`），
   `summary`「自动续跑次数超过上限，疑似导致运行时崩溃」，`recovery_hint` 提示先看日志再手动重试。

### 前端要做什么

**不用改代码。** 恢复后本来就要整页刷新，任务列表读到的就是对账后的状态。`auto_resume_limit_exceeded` 是新增的 `failure_code` 取值，
现有的失败弹窗按 `summary` / `recovery_hint` 显示（`failure-recovery.ts` 优先用后端的 `recovery_hint`），重试按钮照 `retryable` 和 `GET actions`。

详见 [失败结构](../../api/08-调试诊断/01-失败结构.md)、[数据库备份](../../api/10-备份/01-数据库备份.md)。

---

## 书的图跟着原文走、合并阅读过期带 reason（fix/library-media-freshness）

2026-10-19。决定和取舍见 [书库媒体新鲜度与合并阅读](../../ops/planning/api-reorg/20261019-书库媒体新鲜度与合并阅读.md)。

### 变了什么

1. **书的封面、缩略图、原文页**（`/documents/{id}/files/cover.jpg`、`thumbnail.jpg`、`pages/{page}.jpg`）：原文换了版本（Agent 文档操作提交）以后
   按新原文重新渲染（以前封面、缩略图一直是旧图）。响应头统一成 `Cache-Control: private, max-age=0, must-revalidate`
   （以前封面、缩略图 `private, max-age=86400`，原文页 `private, max-age=31536000, immutable`），`ETag` / `Last-Modified` 照旧，没变回 304。
   地址没变。
2. **合并阅读的虚拟任务 id**（`/documents/{id}/reading` 返回的 `merged-<书>-<指纹>`）：合并目录改成超过一天**没人读**才清理（以前按生成时间，
   正在读的也会被删）。清理以后拿着旧 id 的读请求仍是 `404`、`message` 仍是 `job not found: merged-…`，多了
   `error.details.reason = "merged_reading_expired"`。真不存在的普通任务还是不带 reason 的 404。
3. **翻译覆盖**（`/documents/{id}/translation-coverage`）：页数改成和阅读入口一样数原文 PDF。只有老数据（书没记页数）会变：
   `page_count`、`segments` 以前是 0 / 空，现在是实际页数。

### 前端要做什么

- 第 1、3 条**不用改代码**。
- 第 2 条可选（不改的话和现在一样：显示加载失败）。`frontend/packages/reader/src/hooks/reader-session/session-assets.ts` 的 `load()` catch 块
  （约 455 行，`isStaleDocumentJobFailure` 判断前后）：旧写法是 404 只在「书的链路、没有显式 job」时退回原文，显式的 `merged-…` 直接 `failBoot`；
  新写法加一个分支：`status === 404 && reason === "merged_reading_expired" && sessionJobId.startsWith("merged-")` 时，从 id 里取书的编号
  （`merged-` 后面 64 位十六进制），调 `fetchDocumentReading(apiPrefix, documentId)`（`frontend/packages/api/src/documents.ts:213`），
  拿到新的 `job_id` 就按它重新打开阅读器（和 `ReaderNavigation.tsx` 里 `buildReaderPageUrl(jobId, anchor)` 一样），拿不到（`null`）退回按书读原文。
  `session-load-plan.ts` 里可以照 `isStaleDocumentJobFailure` 加一个纯函数 `isExpiredMergedReading({ status, reason, sessionJobId })` 方便测。

## 书库列表分页、不认识的字段 400（fix/library-paging-and-unknown-fields）

2026-10-22。决定和调用方核对见 [书库列表分页与未知字段](../../ops/planning/api-reorg/20261022-书库列表分页与未知字段.md)。

### 变了什么

1. `GET /documents` 多了 `limit`、`offset`、`has_more`（带 `job_id` 时也有，`has_more` 恒为 false）；`GET /search`、
   `GET /documents/{id}/metadata-suggestions` 多了 `limit`、`has_more`。旧字段不变。
2. 这三个列表 `limit` 越界改成 400（以前静默夹）：`/documents` 1..=500，`/search`、元数据建议 1..=100。
3. `/documents` 排序加第二键 `document_id DESC`，同一秒入库的书翻页不再重复或漏掉。
4. `GET /documents/{id}/jobs` 的 `has_more` 改成多取一条判断；`total` 不变。
5. 不认识的字段一律 400：`GET /documents`、`/search`、元数据建议列表、书的任务列表的查询参数；`PATCH /documents/{id}`、
   `POST /collections`、`PATCH /collections/{id}`（`parent_id` 也 400）、`POST /collections/{id}/documents` 的请求体；
   `DELETE /documents/{id}` 的查询参数。查询串的 message 是 ``unknown field `x`, expected ... in the query string``。
   书架（`/library/books`）冻结，不收紧（2026-10-22 整个删了）。

### 前端要做什么

不用改：前端现在发的参数（main、`refactor/library-shelf-to-jobs`、`fix/collection-workspace-post` 都看过）没有一个会被新 400 打到，
最大的 `limit=500`（合集页）正好是上限。可选：

| 文件 | 现在 | 可以改成 |
|---|---|---|
| `frontend/web/src/features/library/domain/documents/document-library-source.ts` | `hasMore = offset + documents.length < total` | 读 `payload.has_more`（结果一样） |
| `frontend/web/src/features/library/domain/documents/job-actions.ts:81` | `fetchDocumentJobs(API_PREFIX, id)` 固定 `limit=50, offset=0`，超过 50 个任务只显示前 50 个 | 按 `has_more` 翻页 |
| `frontend/packages/api/src/documents.ts` | `DocumentListView` 已有 `limit`、`offset` | 加 `has_more: boolean`；`fetchDocumentMetadataSuggestions` 只取 `suggestions`，不用改 |


## 书库契约 library-documents.v1（contracts/library-documents-v1）

2026-10-22。方案见 [书库契约](../../ops/planning/api-reorg/20261022-书库契约.md)。

### 变了什么

1. 新契约 [`contracts/library-documents.v1.schema.json`](../../../contracts/library-documents.v1.schema.json)，生成的 TS 类型从
   `@retainpdf/contracts/library-documents` 导入。收了书（`DocumentRecord`、`DocumentListView`、`PatchDocumentInput`、
   `DeleteDocumentQuery`、`DocumentDeleteResultView`）、阅读入口（`DocumentReadingView`）、翻译覆盖（`TranslationCoverageView`、
   `CoverageSegment`、`CoverageJobView`）、书的文件清单（`DocumentFilesView`）、元数据建议（`DocumentMetadataSuggestionView` 等）、
   全文检索（`SearchQuery`、`SearchResultView`、`BlockSearchHit`）、合集（`CollectionRecord`、`CollectionListView`、
   `CreateCollectionInput`、`PatchCollectionInput`、`AddCollectionDocumentsInput`、`CollectionDeleteResultView`、
   `CollectionDocumentRemoveResultView`）。接口行为一点没变，只是把现在的返回写下来、Rust 测试钉住。
2. `library-books.v1` 删了已不存在的 `POST /library/books/batch-delete` 条目和 `LibraryBatchDeleteInput`、
   `LibraryBatchDeleteResultView` 两个类型（前端没有引用，`git grep` 过 main 和两个前端分支）。`LibraryBookDetailView` 还在，等前端去掉引用再删（2026-10-22 删了，见最上面一节）。

### 前端要做什么

不用改代码。可以逐步把手写的类型换成契约生成的（`import type { … } from "@retainpdf/contracts/library-documents"`，
`frontend/packages/api` 和 `frontend/web` 都已经依赖 `@retainpdf/contracts`）：

| 文件 | 现在手写的 | 换成 |
|---|---|---|
| `frontend/packages/api/src/documents.ts` | `DocumentRecord = Record<string, any> & {…}` | `DocumentRecord` |
| 同上 | `DocumentListView`（没有 `has_more`） | `DocumentListView` |
| 同上 | `DocumentMetadataEvidence`、`DocumentTitleCandidate`、`DocumentMetadataSuggestion` | `DocumentMetadataEvidenceView`、`DocumentTitleCandidateView`、`DocumentMetadataSuggestionView` |
| 同上 | `CreateDocumentMetadataSuggestionInput`、`ApplyDocumentMetadataSuggestionInput` | 同名 |
| 同上 | `DocumentReadingView` | 同名 |
| 同上 | `TranslationCoverageSegment`、`TranslationCoverageJob`、`TranslationCoverageView` | `CoverageSegment`、`CoverageJobView`、`TranslationCoverageView`（`note`、`kept_origin_blocks`、`kept_origin_blocks_supplied`、`failure_summary`、`error_head` 五个键后端一直都给，可以去掉 `?`） |
| `frontend/packages/api/src/collections.ts` | 六个函数都返回 `Promise<any>` | `CollectionListView`、`CollectionRecord`（建、改、加书）、`CollectionDeleteResultView`、`CollectionDocumentRemoveResultView` |
| `frontend/packages/api/src/search.ts` | `searchLibrary` 返回 `Promise<any>` | `SearchResultView` |
| `frontend/web/src/features/collections/domain/controller.ts:17` | `CollectionRecord`（字段大多可选） | `CollectionRecord` |
| `frontend/web/src/features/library/ui/island/index.ts:25` | `LibrarySearchHit` | 可以从 `BlockSearchHit` 派生 |

注意：

- `DocumentRecord.active_version_id` 没有时整个键不出现，类型里是可选；`authors_json`、`year`、`doi`、`last_opened_at` 没有功能
  （恒为 `"[]"`、`null`、`""`、`null`），不要拿来显示。
- `PatchDocumentInput.reading_status`、`DocumentRecord.reading_status` 是 `"unread" | "reading" | "done"`，`title_source` 是
  `"filename" | "pdf_metadata" | "ocr" | "user"`（手写的类型里多一个 `"ai"`，后端没有写这个值的地方）。
- 删合集回 `{ deleted: true }`、从合集拿掉一本书回 `{ removed: true }`，是同一个 Rust 类型的两种形状，契约里分成两个类型。

---

## OCR 提供方选项分客户端和服务器：请求不许带 `ocr.options.command`（fix/ocr-server-owned-options）

2026-10-22，审计 A2。做法和每个选项的分类见 [OCR 提供方选项分客户端和服务器](../../ops/planning/api-reorg/20261022-OCR提供方选项分客户端和服务器.md)。

| 地方 | 以前 | 现在 | 前端要做的 |
|---|---|---|---|
| `POST /api/v1/jobs`、`/documents/{id}/translate`、`/ocr`、`retry-stage` 的 `overrides.ocr.options` | `ocr.options.command`、`raw_provider` 原样盖在服务器配置上，流水线拿 `command` 去执行 | `400` `ocr.options.<键> is server-owned; …` | 无：界面不发 `ocr.options`（`buildOcrPayload` 只发 `provider`、`credential_ref`/token、`model_version`、`language`、`page_ranges`、Paddle 的 `paddle_api_url`） |
| `GET /api/v1/providers/ocr` 的 `options.<键>` | 没有 `client_settable`；`local.command`、`raw_provider` 给配置里的默认值 | 每个选项多一个 `client_settable`（只增）；`false` 的 `default` 恒为 `null` | 无（前端用自己写死的 `platform/config/providers.ts`，没调这个接口）。以后要改用它，契约在 `@retainpdf/contracts/ocr-providers`；`client_settable: false` 的不要做成输入框 |
| `frontend/web/scripts/frontend-status-smoke.mjs` 的 `--ocr-options` | 可以传 `{"command": …}` 跑本地 OCR | 带 `command`/`raw_provider` 会 400 | 冒烟脚本跑本地 OCR 时改在后端设 `RETAIN_LOCAL_OCR_COMMAND`（或 `ocr_providers.json`），`--ocr-options` 只放客户端可填的（例如 Paddle 的 `{"transport":"official_cli"}`）。帮助文字 `local requires a configured command` 可以改成「local 的命令在后端配置」 |

## 凭据不回明文、凭据接口的规矩、`/ready` 的信封（fix/credentials-no-plaintext）

2026-10-22。做法和取舍见 [凭据不回明文与内部接口](../../ops/planning/api-reorg/20261022-凭据不回明文与内部接口.md)。
（按约定加在末尾，免得和同时在做的分支冲突。）

### 变了什么

| 接口 | 以前 | 现在 |
|---|---|---|
| `GET /api/v1/credentials?include_values=true` | `200`，每条带 `secret` 明文 | `400`（``unknown field `include_values` … in the query string``）；不带参数照旧 `200`，任何接口都没有 `secret` 字段了 |
| `GET /api/v1/credentials` 带别的查询参数 | 忽略 | `400` |
| `PUT /api/v1/credentials/{credential_ref}` 带不同的 `kind` | 改掉种类 | `400`，凭据不变；带同样的 `kind`（大小写、空白不算）照常 |
| 凭据的三种 `409` | `error.details` 是 `{}` | 多一个 `reason`：`credential_in_use`、`credential_revision_conflict`、`credential_vault_revision_conflict`；顶层 `code`、`error.code` 不变 |
| `GET /ready` 不就绪（`503`） | 信封 `code: 0`、`message: "ok"` | `code: 50300`、`message: "not ready"`，多 `error`（`SERVICE_UNAVAILABLE`）；`data` 不变 |
| `GET /health` 读不出任务数 | `queue_depth`、`running_jobs` 是 `0` | `null`（正常时照旧是数字） |
| `POST /api/v1/internal/model/jobs/{job_id}/capability` | 发模型执行器的能力令牌 | 删了（`404`），前端本来就不调 |

### 前端要做什么

功能上不用改：`git grep` 过，前端没有调用方带 `include_values`（`createCredentialVault` 没有被引用，
`browser.ts` 2026-09-16 起不再从服务端拉明文），`PUT` 发的 `kind` 和原来一样，`/ready` 只看状态码。可以顺手删的死代码：

| 文件 | 现在 | 改成 |
|---|---|---|
| `frontend/packages/api/src/credentials.ts:16` | `CredentialMetadata` 里的 `secret?: string` | 删掉（后端不会再给） |
| `frontend/packages/api/src/credentials.ts:81-82` | `listCredentials(apiPrefix, { includeValues = false } = {})`，`includeValues` 为真时拼 `?include_values=true` | `listCredentials(apiPrefix)`，不拼参数（拼了会 400） |
| `frontend/packages/api/dist/credentials.{js,d.ts}` | 同上的构建产物 | 重新构建 |
| `frontend/web/tests/credentials/mineru.test.mjs:171`、`frontend/web/tests/home/credentials-dialog-component.test.mjs:315` | 注释提到 `?include_values=true` | 可以改成"这个参数后端已删" |

另外两点留给前端定：

- 设置页说"Key 只存在这个浏览器里"，但提交任务时内联的 Key 会被后端导入凭据库，任务在就一直在服务端（什么时候清见
  [凭据规范](../../../backend/api/docs/api-spec/credentials.md#when-credentials-imported-by-job-creation-are-removed)）。
  要不要在设置页加"清除服务端保存的密钥"（`GET /credentials` 列出、`DELETE /credentials/{credential_ref}` 删），由前端定。
- 凭据 `409` 现在可以按 `error.details.reason` 分支，`credentials.ts:75` 读顶层 `code` 的写法照旧能用。

## 单机模式收紧 CORS、终端握手查 Origin、回环监听时查 Host（fix/single-mode-origin-checks）

2026-10-22。审计第三节 6，用户定"收紧"。规则见 [API 总入口 1.1](../api/index.md#11-单机模式的来源和主机)，
方案见 [单机来源和主机校验](../../ops/planning/api-reorg/20261022-单机来源和主机校验.md)。

### 变了什么

| 地方 | 以前 | 现在 |
|---|---|---|
| 单机 CORS | `CorsLayer::permissive()`：任何来源都回 `Access-Control-Allow-Origin: *` | 只回给回环页面（`localhost`、`127.0.0.0/8`、`[::1]`，端口不限）、和 API 同主机只是端口不同的页面、`RUST_API_ALLOWED_ORIGINS` 列出的来源；回的是来源本身（不是 `*`），`Vary: origin`。别的来源不回 CORS 头，但请求照常处理（不 403）。`null`、`file://` 不放行 |
| 预检 | 全放行 | 方法、请求头照预检回显（`X-API-Key`、`Content-Type`、`Range` 都能过） |
| 跨源可读的响应头 | 全部（`*`） | 不变，仍是全部（`Content-Disposition`、`Content-Range`、`ETag`、`Accept-Ranges`、`Content-Length`……）；不回 `Allow-Credentials`，单机前端本来就不带 credentials |
| 助手终端 `ws(s)://…/api/v1/ai/terminal` | 只看 key | 握手带 `Origin` 且不在上面那份名单里就 HTTP `403`（`error.code = "FORBIDDEN"`）；不带 `Origin` 的（命令行）照旧只看 key |
| AI 服务 `/v1/fx/terminal`（41100） | 只看 key | 带 `Origin` 一律拒（浏览器从不直连它，前端走上面那条） |
| `Host` | 不查 | 后端监听回环地址时（开发栈默认 key、桌面版），`Host` 不是 `localhost`、IP 字面量或 `RUST_API_ALLOWED_HOSTS` 里的主机名就 `403 request host is not allowed`（含 `/health`）。监听非回环地址（Docker、换了 key 的开发栈）只在配了名单时查 |

### 核对过的调用方（不用改）

- 开发栈：页面 `http://127.0.0.1:40001` / `http://localhost:40001` → API `:41000`，回环来源；局域网 / 公网 IP、域名分两个端口
  访问时页面和 API 同主机只差端口，都放行。`serve_same_origin.py` 同源转发，后端收到 `Host: 127.0.0.1:41000`、页面的 `Origin`
  原样转发——不在名单里也只是不回 CORS 头，浏览器看来同源，不受影响；它不转发 WebSocket，终端照旧直连 `apiBase`。
- 桌面壳网关：页面 `http://127.0.0.1:<网关端口>`，`/api/*` 转发时删掉 `Host`，Node 补成 `127.0.0.1:<后端端口>`；终端 WebSocket
  直连 `apiBase`（`http://127.0.0.1:<后端端口>`），`Origin` 是 `http://127.0.0.1:<网关端口>`，回环，放行。就绪探测、复用探测都打
  `http://127.0.0.1:<端口>/health`。
- Docker：web 容器 NGINX 同源代理，`Host $http_host` 原样转发，后端监听 `0.0.0.0` 不查 `Host`；容器健康检查打
  `http://127.0.0.1:41000/ready`、`http://127.0.0.1/health`。
- AI 服务、`retainpdf-agent`、CLI 默认 `apiBase`、`dev.sh` / `dev_stack.py` 的探测都用 `127.0.0.1`，IP 字面量放行。

### 桌面壳退回 `file://`：前端已在 fix/desktop-gateway-origin 做完

网关起不来时桌面壳退回 `file://` 页面。实测（Electron 44.4.3）：这时 `fetch` 不带 `Origin`、也不发预检，走"没有 `Origin` 只看 key"，
不受影响；但终端 WebSocket 握手带 `Origin: file://`，后端不放行（`file://`、`null` 都不放：浏览器里双击打开的本地 HTML 也是这个来源）。
前端已在 `fix/desktop-gateway-origin` 改好：网关端口用尽时退到端口 0；退回 `file://` 时用 `session.webRequest.onBeforeSendHeaders`
把发往本机 `apiBase` 的 `Origin` 改成 `http://127.0.0.1`。

### 其它

- `frontend/packages/api/src/internal/runtime.ts` 第 89 行注释说"当前后端是 `CorsLayer::permissive()`"，已经不对了，前端顺手改掉即可，
  不影响行为。

## 服务商密钥校验：超时、重定向、不认识的字段，单机能测本机模型（fix/provider-probes）

2026-10-22。方案见 [服务商探测与用量](../../ops/planning/api-reorg/20261022-服务商探测与用量.md)，接口说明见
[Provider 校验接口](../rust_api/08-Provider%20校验接口.md)。

### 变了什么

| 接口 | 以前 | 现在 |
|---|---|---|
| `POST /providers/mineru/validate-token` | Token 无效、过期、超时都报 `provider_error`「没能完成 MinerU 校验，请稍后重试」 | 分得清：`unauthorized`、`expired`、`network_error`；服务商回 3xx 给 `redirected` |
| `POST /providers/{mineru,paddle}/validate-token` | 超时 120 秒（Paddle 还重试 3 次），前端 30 秒先放弃 | 四个接口共用 20 秒（`RUST_API_PROVIDER_PROBE_TIMEOUT_SECS`），不重试 |
| 四个校验接口 | 跟随重定向（Key 会被带到重定向后的地址） | 不跟随，`status: "redirected"`、`ok: false` |
| 四个校验接口 | 请求体里不认识的字段忽略 | 400，`message` 带字段名 |
| 四个校验接口（单机） | `base_url` 是 `127.0.0.1`、`localhost`、内网地址时 400 | 正常检测（链路本地 `169.254.x` 照旧 400）；多用户不变 |
| 四个校验接口 | `provider_message` 不截断 | 最多 500 字，超出以 `…` 结尾 |
| `GET /usage` 等三个用量接口 | 台账里一行怪时间戳能让接口 500 | 那一行照样计入总数，只是不进 `by_month` |

### 前端要做什么

不用改代码，字段和地址都没变；核对过前端发的字段都认（`mineru_token`；`paddle_token`、`base_url`；`api_key`、`base_url`、`model`、
`api_protocol`；余额 `api_key`、`base_url`）。

- `status` 多一个值 `redirected`，界面按 `summary` 显示就行；
- 可以顺手改 `frontend/packages/api/src/providers.ts:4-6` 的注释：后端的超时变量现在叫 `RUST_API_PROVIDER_PROBE_TIMEOUT_SECS`
  （四个接口共用，默认 20 秒；旧名 `RUST_API_DEEPSEEK_PROBE_TIMEOUT_SECS` 还认）；
- 以后有契约（`provider-probe.v1`）了再把四个函数的 `Promise<any>` 换成契约类型，这次没加契约。

## 备份恢复和同步脱离请求、409 带 reason、`last_restore`（fix/backup-sync-detached）

2026-10-22。方案见 [备份恢复和同步脱离请求](../../ops/planning/api-reorg/20261022-备份恢复和同步脱离请求.md)。

### 变了什么

1. `GET /api/v1/backups`（以及恢复、删除返回里的 `status`）多一个 `last_restore`：最近一次恢复的结果（不论成败），没恢复过
   或服务重启后为 `null`。字段：`backup_id`、`ok`、`safety_backup`（可能为 `null`）、`reason`、`error`、`started_at`、`finished_at`。
   恢复的请求中途断开（关了设置页）时恢复照样做完，刷新后凭它知道结果。
2. 恢复备份的 `409` 带 `error.details.reason`：`restore_blocked`（有任务在跑）、`backup_damaged`、`backup_newer`。
   **坏备份、来自新版本的备份由 `400` 改 `409`。** `POST /sync/run` 不跑时的 `409` 带 `sync_disabled` / `sync_not_configured`，
   后者的 `message` 改成「同步已开启，但还没有填写同步位置」。
3. `PUT /api/v1/sync`、`POST /api/v1/sync/test` 请求体里不认识的字段 `400`（以前静默忽略）；`PUT /sync` 校验失败时什么都不改。
4. `POST /sync/test` 更快给结论：每个请求 10 秒、不重试，整体 60 秒；超时的 `error` 是「测试连接超时：60 秒内没有结果」。
5. 立即备份的请求断开后 `running` 会回到 `false`（以前一直卡在 `true`，「立即备份」按钮禁用）。

### 前端要做什么

不用改代码。核对过：

- `frontend/packages/api/src/backups.ts:38-50`、`sync.ts:76-88` 的 `readEnvelope` 只读 `message`，不看状态码；400 改 409 后提示文字不变
  （「这份备份已损坏，不能恢复：…」「这份备份来自更新版本的程序…」）。`frontend/web/tests/backup/backup-panel.test.mjs:62` 本来就按 409 模拟。
- `SyncSettingsPanel.tsx` 发的 `PUT /sync`（`save({ folder, transport })`、`save({ device_name })`、`save({ enabled })`、`davPayload()`）
  和 `POST /sync/test`（`davPayload()`）都只带已知字段；CLI `backend/cli/src/cmd/sync.rs` 也只发已知字段。

可选：

| 文件 | 现在 | 可以改成 |
|---|---|---|
| `frontend/packages/api/src/backups.ts` 的 `BackupStatus` | 没有 `last_restore` | 加 `last_restore: { backup_id: string; ok: boolean; safety_backup: string \| null; reason: string \| null; error: string \| null; started_at: string; finished_at: string } \| null` |
| `frontend/web/src/features/backup/ui/BackupPanel.tsx` | 恢复请求失败（网络断开）只显示报错 | 刷新状态后看 `last_restore`：`ok` 就提示已恢复、给出 `safety_backup`；失败显示 `error` |

## 术语表：重跑用现在的表、PUT 保留没给的字段、删 import（fix/glossaries-rerun-and-put）

2026-10-22。方案见 [术语表重跑与整份替换](../../ops/planning/api-reorg/20261022-术语表重跑与整份替换.md)，接口见
[术语表](../../api/04-翻译/03-术语表.md)。

### 变了什么（前端不改也照旧能用）

1. 重跑、阶段重试出新任务时按**现在的**术语表重新解析，加上当时内联的条目；源任务用的表已删 `409`，
   `error.details.reason = "glossary_missing"`（以前 `404`），停用了 `409 glossary_disabled`。
2. `PUT /glossaries/:id` 请求里没出现的 `description`、`source_lang`、`target_lang`、`enabled` 保留原值（以前被清空、
   `enabled` 重置成 `true`）。`name`、`entries` 仍必填，缺了 `422`。可选 `expected_updated_at`，表被别处改过 `409 glossary_changed`。
   表已删的 `PUT` 是 `404`，不会重新建出来。
3. 建任务时 `translation.glossary_id` 指向不存在或停用的表 `400`（以前不存在 `404`、停用照样用）。前端下拉已经过滤掉删了的表；
   停用的表现在下拉里还列着，选了会 400，所以下面第 2 条要改。
4. 去重键改成（原词，上下文），`case_insensitive` 的原词按小写比、其余区分大小写：以前被吞掉的同词不同上下文、
   大小写不同的精确词，以后会留下。`parse-csv` 回包多 `duplicate_count`。
5. CSV：报错带行号（`row 3: …`）；制表符分隔的文本（Excel 复制）能直接解析；导出带 BOM、`Content-Disposition`，
   `= + - @` 开头的单元格前加 `'`（粘回解析框会去掉）。
6. JSON 词条里不认识的 `level`/`match_mode`、编译不过的正则 `400`；`context` 最多 500 字。前端只发合法值，不受影响。
7. `GET /glossaries` 不认识的查询参数 `400`，`?q=` 空串不再返回空列表。前端不带参数，不受影响。
8. 删了 `POST /api/v1/glossaries/import`（前端没用，`git grep` 过）。

### 前端要做什么

| 文件 | 现在 | 改成 |
|---|---|---|
| `frontend/web/src/features/glossaries/domain/glossaries-store.ts:44-50` | `GlossaryEntryRow` 没有 `context` | 加 `context: string` |
| 同上 `:135-143`（`normalizeEntryForRow`） | 读详情时丢掉 `context` | `context: entry.context \|\| ""` |
| 同上 `:171`（`readEditorPayload`） | `context: ""` 写死 | `context: \`${row.context \|\| ""}\`.trim()`（编辑器可以先不显示这一列，但要原样带回，否则存一次就把 `context` 清空） |
| `frontend/web/src/features/ingest/domain/workflow/glossary-options.ts:47` | `fetchGlossaries(apiPrefix)` 列全部 | 下拉只列启用的：`GET /glossaries?enabled=true`（`frontend/packages/api/src/glossaries.ts:6` 的 `fetchGlossaries` 加个可选查询参数） |
| `frontend/web/src/features/glossaries/ui/GlossaryImportPanel.tsx:21` | 占位符 `原词,译文,类型,匹配模式,备注`（没表头时后端按 `原词,译文,备注` 读，第 3 列会被当成备注） | 改成 `原词,译文,备注`，或提示「第一行写表头：原词,译文,类型,匹配模式,备注」 |
| `frontend/web/src/features/glossaries/domain/controller.ts:192`（可选） | `PUT` 不带版本 | 带上详情里的 `updated_at` 作 `expected_updated_at`；`409` 且 `reason === "glossary_changed"` 时提示「术语表已被别处修改，请刷新后再改」 |
| 重跑、重试失败的提示（可选） | 只显示 `message` | `reason === "glossary_missing"` 时提示「术语表已删除，请改选后重新翻译」 |
| `parse-csv` 预览（可选） | — | `duplicate_count > 0` 时提示「有 N 行重复，已按最后一行」 |

## 契约端点加 `client_name`、`transport`：可以开第 0 期（contracts/client-names-phase0）

2026-10-22。方案是前端的 [从契约生成前端请求函数](../../ops/planning/api-client-codegen/20261022-从契约生成前端请求函数.md)，
后端做了什么、一致性检查怎么比见 [契约端点加函数名和传输方式](../../ops/planning/api-reorg/20261022-契约端点加函数名和传输方式.md)，
字段说明在 [`contracts/README.md`](../../../contracts/README.md) 的「端点表」。

### 变了什么（接口行为没变）

1. `contracts/library-documents.v1.schema.json` 的 17 条端点都有了 `client_name`（照前端给的名单，方法、地址逐条对过）和
   `transport: "json"`。
2. `agent-calculation.v1` 计算产物下载那条的 `response_body: "binary"` 改成 `transport: "binary"`（`git grep` 过，前端没人读
   `response_body`）。`reader-data.v1` 的 `GET /jobs/:job_id/progress/stream` 标了 `transport: "sse"`。其余端点没写 `transport`，
   按 `json` 算，还没有 `client_name`。
3. `npm --prefix contracts run lint:schemas` 现在查端点表：键有白名单，`transport` 只能是 `json`/`sse`/`binary`/`websocket`/`raw_json`，
   `client_name` 小驼峰、**全部契约里不重名**。
4. rust_api 测试 `route_manifest::contract_endpoints_are_registered`：契约端点表的每条方法加地址都要在接口登记表里（排除
   jobs-control，`runtime-config` 比 `proxy_path`，`{x}`/`:x` 归一，去掉 `?` 查询串）。契约里的地址现在全部是活的。
5. `@retainpdf/contracts` 生成的 TS 类型没变（生成器只读 `input`/`query`/`output` 指向的定义）。

### 前端可以开始第 0 期

| 做什么 | 在哪 |
|---|---|
| 写生成器：读 `contracts/library-documents.v1.schema.json` 的 `endpoints`，有 `client_name` 且 `transport` 是 `json`（或不写）的生成函数 | `frontend/packages/api/scripts/` → `frontend/packages/api/src/generated/` |
| 手写 `request()`（拼地址、`X-API-Key`、拆信封、`attachErrorDetails`） | `frontend/packages/api/src/` |
| 把 `documents.ts`、`collections.ts`、`search.ts` 换成生成的函数，有中文报错、兜底的留成薄包装 | `frontend/packages/api/src/` |

注意：

- 生成的函数名以契约为准。要改名、要给别的契约的端点起名，告诉后端改契约（lint 会拦重名）。
- 查询参数、请求体的定义都是 `additionalProperties: false`，后端对不认识的字段回 400。
- 第 1 期要补进契约的接口，列清单给后端（方案第 5 节）。

## 第 1a 期：已有端点补 `client_name`（contracts/client-names-phase1a）

2026-10-22。决定和名单见 [契约第 1a 期补函数名](../../ops/planning/api-reorg/20261022-契约第1a期补函数名.md)。接口行为、生成的 TS 类型都没变。

1. 前端清单 1a 的 16 条全部照名单写上 `client_name`，`transport: "json"`：`listJobs`、`getJob`（job-status）、`createJob`（create-job）、
   `deleteJob`（library-books）、`listJobDatasets`、`getJobDataset`（job-data）、`listJobEvents`（job-events.v2）、`listJobFiles`、
   `getLiveLayout`、`getLivePage`、`getReaderMarkdown`、`getReaderMetadata`、`getReaderRegions`（reader-data）、`getUsageSummary`、
   `getDocumentUsage`、`getJobUsage`（token-usage）。
2. `GET /api/v1/jobs` 在 `library-books.v1` 的那条留着、不起名（删了它，`JobListView`、`ListJobsQuery` 就不再从
   `@retainpdf/contracts/library-books` 导出）。生成器按 `client_name` 取端点，不会生成两遍。
3. `progress/pages/:page` 从 0 开始，和返回的 `page_idx` 一致。
4. `getJobDataset` 的 `query` 以前是一段说明文字，生成器会报错；现在是 `JobDatasetQuery`（`@retainpdf/contracts/job-data`）：
   `fields`、`group_by`、`sort`、`offset`、`limit` 具名，其余键是等值筛选（索引签名 `string | number | boolean | undefined`），
   `{ group_by: "reader_item_id", limit: 1000 }` 可以直接传。

| 做什么 | 在哪 |
|---|---|
| 把手写的任务、阅读器、用量请求换成生成的函数 | `frontend/packages/api/src/` 里 jobs、reader、usage 相关文件 |
| （可选）类型改从 `@retainpdf/contracts/job-status` 引 `JobListView`、`ListJobsQuery`，之后后端可以删 `library-books.v1` 那条重复的 `GET /jobs` | `frontend/` 下引 `@retainpdf/contracts/library-books` 的地方 |

## 第 1b 期：任务操作与报告（contracts/phase1b-job-actions-reports）

2026-10-22。决定见 [契约第 1b 期任务操作与报告](../../ops/planning/api-reorg/20261022-契约第1b期任务操作与报告.md)。接口行为没变，只是补了契约。
同一期的译文条目、书的翻译 / OCR / 任务列表在另一个分支。

1. 两份新契约，从新子路径导入：

   | 导入 | 端点（`client_name`） | 主要类型 |
   |---|---|---|
   | `@retainpdf/contracts/job-actions` | `listJobActions`（`GET actions`）、`cancelJob`（`POST actions/cancel`）、`resolveOcrAmbiguity`、`getResumePlan`（`GET actions/resume`）、`resumeJob`（`POST actions/resume`）、`retryJobStage` | `StageActionsView`、`StageRetryActionView`、`LastRefineView`、`JobResumePlanView`、`JobSubmissionView`、`RetryStageRequest`、`RetryStageSubmissionView`、`ResumeJobInput`、`OcrAmbiguityResolutionRequest`、`OcrAmbiguityResolutionView`、`ActionBlockReason` |
   | `@retainpdf/contracts/job-reports` | `getFailureReport`（`GET reports/failure`）、`getQualityReport`（`GET reports/quality`）、`listQualityItems`（`GET reports/quality/items`）、`getTranslationReport`（`GET reports/translation`） | `JobDiagnosticsView`、`OcrAmbiguityView`、`QualitySummaryView`、`QualityItemsQuery`、`QualityItemsView`、`QualityItem`、`TranslationDiagnosticsView` |

   原始 schema 是 `@retainpdf/contracts/job-actions.v1.schema.json`、`job-reports.v1.schema.json`。

2. 错误码（各端点的 `note` 里有全文）：
   - 操作被拒一律 409，`error.details.reason` 是 `ActionBlockReason` 的值，按它分支、不要解析文字：
     取消 `job_not_active`；续跑 `job_active`、`artifacts_missing`、`model_executor_unsupported`、`ambiguous_ocr_dispatch`、
     `request_journal_corrupt`、`ambiguous_translation_request`、`stale_resolution`；重试再加 `translations_not_owned`；
     OCR 歧义处理 `job_active`、`no_ocr_dispatch`、`stale_resolution`、`ocr_dispatch_unsupported`。
   - 请求写错 400（不认识的字段、`retry-stage` 的 stage / `create_new_job` / `refine` 组合不对、`quality/items` 的 `kind`、`limit` 不对）。
   - `reports/translation` 报告还没生成：404，`error.details.reason=not_ready`。其余报告接口报告缺了照样 200，那一段是 null / 空清单。
   - 多用户模式下续跑、重试、OCR 歧义处理建新任务时页数额度不够：402，`error.code=PAGE_QUOTA_EXCEEDED`。

3. 和手写类型对不上、换成生成的类型时要注意的（`frontend/packages/api/src/`）：

   | 文件 | 现在手写的 | 契约里的 |
   |---|---|---|
   | `jobs-actions.ts` | `JobStageRetryActionView` 的 `reason`、`disabled_reason`、`will_reuse`、`will_rerun`、`danger` 可选，`action` 里的字段可选 | 都必有；`action` 不能重试时是 `null`；多了 `disabled_code`（`ActionBlockReason \| null`）；`action.body` 是 `RetryStageRequest` |
   | `jobs-actions.ts` | `LastRefineView` 的 `mode`、`escalated_count`、`escalated` 可选 | 都必有（老报告没有时是空串 / 0 / 空数组） |
   | `jobs-actions.ts` | `JobDiagnosticsView` 只写了 `failure_code`、`ocr_ambiguity`，其余 `[key: string]: unknown` | 全部字段；`render_diagnostics`、`translation_request_recovery` 没有时整个键不出现 |
   | `jobs-actions.ts` | `fetchResumePlan`、`resumeJob`、`cancelJob`、`retryJobStage` 返回 `any` | `JobResumePlanView`、`JobSubmissionView`、`JobSubmissionView`、`RetryStageSubmissionView` |
   | `jobs-actions.ts` | `resumeJob` 的 body 是 `Record<string, unknown>` | `ResumeJobInput`：只有 `overrides.translation` 的四个 key 字段，别的 400 |
   | `quality.ts` | `QualitySummaryView.layout.min_scale`、`min_final_font_size` 是 `number`；`refine.qa_before`、`qa_after` 不可空 | `number \| null`；`QaSnapshot \| null` |
   | `quality.ts` | `QualityItem.page` 是 `number`，`translation_item_id`、`reason` 可选 | `page` 是 `number \| null`；`translation_item_id`、`reason` 必有；按类出现的 `scale` 等可为 `null`；多了 `attempts` |
   | `quality.ts` | `QualityItemsView` 没有 `has_more` | 有 `has_more` |
   | `translation-debug.ts` | `fetchTranslationDiagnostics` 返回 `any` | `TranslationDiagnosticsView`（`summary` 是流水线的诊断文件，`{[k]: JsonValue}`，契约不展开） |

4. 调用方现在发的参数都在契约里：`cancelJob` 发 `{}`（后端不读请求体）；`resumeJob` 默认发 `{}`；`retryJobStage` 只发
   `stage`、`mode`、`create_new_job`、`overrides`、`ambiguous_request_policy`、`refine`；`resolveOcrAmbiguity` 发
   `resolution`、`resolution_revision` 和回执字段；`fetchQualityItems` 发 `kind`、`offset`、`limit`、可选 `page`、`severity`。

## 第 1b 期：译文条目和书的任务进契约（contracts/phase1b-translations-documents）

2026-10-22。决定见 [契约第 1b 期译文条目和书的任务](../../ops/planning/api-reorg/20261022-契约第1b期译文条目和书的任务.md)。接口行为没变，只是补了契约和类型。

| 函数名 | 方法、地址 | 类型从哪导入 | 返回 | 请求 |
|---|---|---|---|---|
| `listTranslationItems` | `GET /api/v1/jobs/:job_id/translations` | `@retainpdf/contracts/translation-revisions` | `TranslationDebugListView` | 查询 `ListTranslationItemsQuery` |
| `getTranslationItem` | `GET /api/v1/jobs/:job_id/translations/:item_id` | 同上 | `TranslationDebugItemView` | — |
| `replayTranslationItem` | `POST /api/v1/jobs/:job_id/translations/:item_id/replay` | 同上 | `TranslationReplayView` | 不带请求体 |
| `listDocumentJobs` | `GET /api/v1/documents/:document_id/jobs` | `@retainpdf/contracts/library-documents` | `DocumentJobListView` | 查询 `ListDocumentJobsQuery`（只认 `limit`、`offset`） |
| `translateDocument` | `POST /api/v1/documents/:document_id/translate` | 同上 | `JobSubmissionView` | `CreateJobInput` |
| `ocrDocument` | `POST /api/v1/documents/:document_id/ocr` | 同上 | `JobSubmissionView` | `CreateJobInput` |

要注意的：

1. **402 页数额度**（只有多用户模式）：`{"code": "PAGE_QUOTA_EXCEEDED", "message": "页数额度不够：…", "error": {"code": "PAGE_QUOTA_EXCEEDED", "http_status": 402, "details": {"required_pages": 3, "balance": 2}}}`。
   顶层 `code` 是字符串，不是数字，按 `error.code` 认（现在的 `pageQuotaErrorFromPayload` 就是这么认的）；`details` 的类型是
   `PageQuotaExceededErrorDetails`。被拒时不留任务。
2. 翻译复用 OCR 出错（404 `OCR_JOB_NOT_FOUND`；409 `OCR_JOB_NOT_SUCCEEDED`、`OCR_ARTIFACT_NOT_REUSABLE`、`OCR_ARTIFACT_MISSING`、
   `OCR_PAGE_COVERAGE_MISMATCH`）也是顶层字符串 `code`，同级有 `reason`、`can_fallback_to_ocr`，`error.details` 里也有这两个（`documentRequestError` 已经两处都读）。
3. `CreateJobInput` 和 `@retainpdf/contracts/create-job` 里的是同一份（逐字抄的，测试锁住），两边的类型可以互用。
4. `JobSubmissionView` 没有 `document_id`（`use-book-detail-*.ts` 里 `result.document_id || documentId` 的兜底照旧要留）；
   `sibling_job_ids` 只有翻译拆成几个任务时才出现。书的任务列表条目是 `JobListItemView`（和 `GET /jobs` 同形），**没有** `ocr_reused`，
   `DocumentJobSummary.ocr_reused` 这个可选字段在列表里永远读不到，提交结果里才有。
5. 译文条目列表在任务还没产出翻译清单时是 200 空列表，404 只表示任务不存在（`fetchTranslationItems` 把 404 当空列表的兜底可以去掉，
   要不要去由前端定）。单条、重放的 404 带 `error.details.reason = "not_ready"` 时是清单还没出来。`item`、`payload` 是原样的条目和
   开发脚本输出，类型是开放对象。重放是同步跑一次模型，最长 300 秒，失败（脚本出错、超时）500；模型调用本身失败时仍是 200，
   `payload.replay_error` 里有原因。合并阅读的虚拟任务（`merged-…`）重放 409 `TRANSLATION_REVISION_CONFLICT`、`reason: read_only_job`。
6. 生成器合进来以后重新生成：`src/generated/` 会多出 `translation-revisions.ts`（3 个函数），`library-documents.ts` 多 3 个函数。

| 做什么 | 在哪 |
|---|---|
| 换成生成的函数，中文报错、404 兜底留成薄包装 | `frontend/packages/api/src/translation-debug.ts`、`documents.ts`（`fetchDocumentJobs`、`translateDocument`、`ocrDocument`） |
| 手写的 `DocumentJobSubmissionView`、`DocumentJobsView`、`DocumentJobSummary` 换成契约类型 | `frontend/packages/api/src/documents.ts` |

## 任务列表契约补 `include_live_stage`（contracts/list-jobs-include-live-stage）

2026-10-23。决定见 [任务列表契约补 include_live_stage](../../ops/planning/api-reorg/20261023-任务列表契约补include_live_stage.md)。接口行为没变。

- `job-status.v1`、`library-books.v1` 的 `ListJobsQuery` 加了 `include_live_stage?: boolean`：`false` 只读库里的任务摘要，不导入事件历史；
  省略或 `true` 是完整的实时阶段。
- 前端要做：重新生成 `frontend/packages/api/src/generated`；最近任务、任务中心调 `listJobs` 时为绕开多余属性检查放的宽类型变量可以去掉，
  直接传 `{ ..., include_live_stage: false }`。

## 删 `library-books.v1` 重复登记的任务列表（contracts/library-books-drop-duplicate-list-jobs）

2026-10-23。决定见 [删 library-books 重复的任务列表](../../ops/planning/api-reorg/20261023-删library-books重复的任务列表.md)。接口行为没变。

- `library-books.v1` 只剩 `DELETE /api/v1/jobs/:job_id`（`deleteJob`）。`@retainpdf/contracts/library-books` 只导出 `LibraryDeleteQuery`、
  `LibraryDeleteResultView`；`JobListView`、`JobListItemView`、`JobFailureBriefView`、`JobProgressView`、`ListJobsQuery` 等从
  `@retainpdf/contracts/job-status` 取。`src/generated` 不用重新生成（那条本来就没有 `client_name`）。
- 前端要做：两个测试还读 `contracts/library-books.v1.schema.json` 的任务列表定义，改读 `contracts/job-status.v1.schema.json`：
  - `frontend/web/tests/contracts/library-books-contract.test.mjs` 的 `CONTRACT_PATH`（读 `JobProgressView`、`JobStatusKind`、`WorkflowKind`、
    `JobListItemView`、`JobStageSnapshotView`）；
  - `frontend/web/tests/contracts/job-failure-brief-contract.test.mjs` 的 `SCHEMA`（读 `JobFailureBriefView`）。
- 改完告诉后端，后端再删 `library-books.v1` 里这 14 个任务列表定义。
- 前端 `test/contracts-read-job-status-schema`（8fa12fba）改好以后，同一个分支删了这 14 个定义：`library-books.v1.schema.json` 的
  `definitions` 只剩 `LibraryDeleteQuery`、`LibraryDeleteResultView`，`contracts/tests/job-definitions-parity.test.mjs` 删了，
  `package-boundary` 断言不再抄回来。生成的 TS 没变，前端不用做什么。

## 磁盘快满时拒绝新上传、新任务（fix/disk-space-guard）

2026-10-24。决定见 [磁盘剩余空间下限](../../ops/planning/backend-review/20261024-磁盘剩余空间下限.md)。只增不改。

- 数据目录所在磁盘剩余空间低于下限（`RUST_API_MIN_FREE_DISK_MB`，默认 1024 MiB）时，`POST /uploads`、所有建任务的入口
  （`POST /jobs`、书的翻译和 OCR、重试、续跑）、原地重跑返回 `503`，`error.details.reason = "insufficient_storage"`，
  `message` 是英文的「not enough free disk space to …: N MiB left …, need at least M MiB」。被拒时什么都没写。
- `GET /health` 的 `data` 多一个 `disk`：`{ free_bytes: number | null, min_free_bytes: number, low: boolean }`。
  `/ready` 不因为磁盘变成 503。
- 前端可以做（可选）：按 `reason === "insufficient_storage"` 提示「磁盘空间不够，删掉一些任务再试」，不要解析 `message`；
  需要的话设置页或首页按 `/health` 的 `disk.low` 给个提醒。现在这类 503 会走通用的报错显示。

## 排队的任务按先后开跑，排满了 429（fix/job-queue-fifo）

2026-10-24。决定见 [排队先来先跑和排队上限](../../ops/planning/backend-review/20261024-排队先来先跑和排队上限.md)。只增不改。

- 排队的任务现在按交上来的先后开跑（以前名额空出来时谁先轮询到谁跑）。接口不变。
- 排队（还没开跑）的任务已经有 `RUST_API_MAX_QUEUED_JOBS` 个（默认 1000）时，所有建任务的入口（`POST /jobs`、书的翻译和 OCR、
  重试、续跑）、原地重跑返回 `429`，`error.code = "TOO_MANY_REQUESTS"`，`error.details.reason = "queue_full"`，
  `message` 是英文的「N jobs are already waiting to run (limit M); try again after some of them start」。被拒时什么都没写。
- 前端可以做（可选）：按 `reason === "queue_full"` 提示「排队的任务太多了，等前面的开跑再交」，不要解析 `message`；
  批量提交时遇到它可以停下剩下的。现在这类 429 会走通用的报错显示。正常用（几十、几百本）碰不到。

## 恢复备份期间上传、建任务回 409 `restore_in_progress`（fix/restore-in-progress-gate）

2026-10-28。决定见 [恢复备份期间不建任务不收上传](../../ops/planning/backend-review/20261028-恢复备份期间不建任务不收上传.md)。只增不改。

- 恢复数据库备份的那几秒里，`POST /uploads`、所有建任务的入口（`POST /jobs`、书的翻译和 OCR、重试、续跑）、原地重跑返回 `409`，
  `error.code = "CONFLICT"`，`error.details.reason = "restore_in_progress"`，`message` 是英文的
  「a database backup is being restored; try again in a moment」。被拒时什么都没写。
- 前端可以做（可选）：按 `reason === "restore_in_progress"` 提示「正在恢复备份，稍等再试」，不要解析 `message`；批量上传遇到它可以
  等 `GET /backups` 的 `running` 变回 `false` 再接着传。现在这类 409 会走通用的报错显示。恢复本来就要求没有排队、在跑的任务，正常用很少碰到。

## 术语表契约 glossaries.v1（contracts/glossaries-v1）

2026-10-29。设置类第 2 批第 1 组（前端排的顺序）。决定见 [设置类第 2 批：术语表契约](../../ops/planning/api-client-codegen/20261029-设置类第2批-术语表契约.md)。接口行为没变，只是补了契约。

- 新契约 `contracts/glossaries.v1.schema.json`，npm 子路径 `@retainpdf/contracts/glossaries`。7 条端点都有 `client_name`：
  `listGlossaries`（`GET /glossaries`，查询 `ListGlossariesQuery`）、`createGlossary`、`getGlossary`、`updateGlossary`、`deleteGlossary`
  （都回 `GlossaryDetailView`）、`exportGlossaryCsv`（`transport: binary`，直接是 CSV 文件）、`parseGlossaryCsv`（回 `GlossaryCsvParseView`）。
- 和 `frontend/packages/api/src/glossaries.ts` 手写的那 7 个地址、方法一样；手写的返回都是 `any`，换成生成的以后有类型。名字不全一样：
  手写的 `fetchGlossaries`、`fetchGlossary` 在契约里叫 `listGlossaries`、`getGlossary`，其余 5 个同名。`deleteGlossary` 回的是删掉的那张表
  （`GlossaryDetailView`），`parseGlossaryCsv` 的回包有 `duplicate_count`（去重丢掉的行数）。
- 前端可以做：重新生成 `src/generated`，换掉 `glossaries.ts` 里手写的 7 个请求（`glossaries-store.ts` 里拼地址的几处一起收）。

## 全文检索命中加整本书页号 document_page

2026-11-03。Studio 会话检查时发现：分段翻译的书，`GET /api/v1/search` 命中里的 `page_idx` 是建索引那个任务自己的本地页号，
`GET /documents/{id}/reading` 给的合并任务却按整本书编页，「搜到第 N 页 → 按书读第 N 页」会落到别的页。

- 新字段 `document_page`（1 起，整本书的页号；任务记录读不到时 `null`），旧字段都不变。契约 `library-documents.v1` 的
  `BlockSearchHit` 加了这个键（必有，可为 `null`），生成的 DTO 已更新。
- 前端可以做（可选）：从搜索结果跳到按书阅读的任务时用 `document_page - 1`；直接打开命中的 `job_id` 那个任务时照旧用 `page_idx`。

## Studio 按书跳转：studio-bridge.v1 的 navigate 加 document_id

2026-11-03。方案见 [按书跳转](../../ops/planning/studio-workbench/20261103-按书跳转.md)。契约只加不改。

- `NavigateMessage` 加可选的 `document_id`；`Feature` 加 `navigate-document`。`job_id` 照旧必填（按书找不到时用）。
- 前端要做（阅读页，`frontend/web/src/platform/studio-bridge/`）：
  1. `ready` 的 features 里加 `navigate-document`（做完下面一条再加，Studio 看到它才会发 `document_id`）。
  2. 收到带 `document_id` 的 navigate：调 `GET /api/v1/documents/:document_id/reading`，拿到 `job_id` 就打开它；
     `job_id` 是 `null` 或请求失败，就照旧打开消息里的 `job_id`。`page_idx`、`block_id` 照旧用：按书打开的任务都按整本书编页，
     不用换算。
- 不加 `navigate-document` 的话什么都不变：Studio 照旧只发 `job_id`。

## 删掉 RetainPDF 自己的 AI（2026-11-03）

2026-11-03。决定见 [RetainPDF 不要自己的 AI](../../ops/planning/frontend-migration/20261103-RetainPDF不要自己的AI.md)：产品里只留
Studio（`frontend/studio`）自己的 AI，后端把 RetainPDF 自己的 AI 服务和它的接口全删了。网页那边 2026-11-03 已经不调这些接口。
这次是删接口，不是只增不改；下面列的地址现在都是 `404`。

- **删了的接口**：
  - `/api/v1/ai/*`：`POST /ai/ask`、`GET|PUT /ai/runtime-config`、`/ai/conversations…`（列表、新建、读、改、删、`fork`、
    `messages`、`operations`、`calculations`）、`/ai/operations/:operation_id…`（读、`run`、`retry`、`cancel`、`commit`、
    `candidate.pdf`）、`/ai/calculations/:calculation_id…`（读、`artifacts/:artifact_id`）、助手终端 WebSocket `GET /ai/terminal`；
  - `/api/v1/internal/agent/*`（能力令牌、文档操作、计算、运行时会话）；
  - 画板 `GET /api/v1/jobs/:job_id/ai/board`、`GET /api/v1/jobs/:job_id/ai/board/:name`（任务接口从 9 类变成 8 类，没有 `ai` 了）；
  - 合集的 Agent 工作区 `POST /api/v1/collections/:id/agent-workspace`（删合集照旧清 `<data_root>/collections/<id>/`）；
  - 书的 Agent 版本 `GET /api/v1/documents/:id/agent-versions`。
- **删了的契约**（`contracts/` 和 `backend/contracts/` 两份，`@retainpdf/contracts` 的子路径一起去掉）：`ai-ask.v1`、
  `ai-conversations.v1`、`agent-calculation.v1`、`public-document-operation.v1`、`runtime-config.v1`。
  `frontend/web/tests/contracts/library-books-contract.test.mjs`、`job-status-contract.test.mjs` 注释里还提到 `ai-ask`、`ai-conversations`，只是注释。
- **健康检查的旧字段留着**：`GET /health` 的 `ai_service` 键还在，值固定 `"disabled"`；`GET /ready` 的 `components.ai_service`
  固定 `{ "required": false, "status": "not_required" }`，`reasons` 不会再出现 `ai_service_not_healthy`。前端读到这两个键不用改。
- **没删的**：翻译用的大模型、凭据、模型执行器（`/api/v1/internal/model/jobs/...`）、翻译 agent、`retainpdf-agent` 可执行文件、
  `retainpdf-pipeline diagnose-failure`；库里的对话、文档操作、计算记录表也留着（不再有接口读写）。删凭据时不再查
  `secrets/ai-runtime.json` 里的引用。
- **桌面壳要跟着改**（归前端会话，后端没动 `frontend/`）：
  1. `frontend/desktop/src/main/plugins/backend.js`：去掉 `startRetainpdfAiService` 和调它的两处（复用外部后端时、`RUST_API_AI_SUPERVISE`
     不是 `1` 时）、`AI_SERVICE_PORT = 41100`、`aiServicePort` / `aiServiceRoot`、退出时先停 AI 的那段顺序；启动进度里的
     「Rust API 与 AI 服务正在启动」换掉。rust_api 不再认 `RUST_API_AI_SUPERVISE`，也不会去拉 AI 服务。
  2. `frontend/desktop/src/main/backend-env.js`：去掉 `RUST_API_AI_*`（`RUST_API_AI_SERVICE_BASE`、`RUST_API_AI_HOST`、`RUST_API_AI_PORT`、
     `RUST_API_AI_SUPERVISE`）和 `RETAIN_AI_*`（`RETAIN_AI_HOST`、`RETAIN_AI_PORT`、`RETAIN_AI_API_KEYS`、`RETAIN_AI_RUST_API_KEY`、
     `RETAIN_AI_RUST_API_BASE`、`RETAIN_AI_DATA_ROOT`、`RETAIN_AI_FX_AGENT_CLI_COMMAND`，以及从设置 `assistant` 段写的
     `RETAIN_AI_LLM_MODEL`、`RETAIN_AI_LLM_BASE_URL`、`RETAIN_AI_LLM_API_KEY`、`RETAIN_AI_MAX_TOOL_ROUNDS`）；`backend-env.test.mjs` 跟着改。
     后端已经不读这些变量，留着不报错，只是没用。
  3. `frontend/desktop/scripts/prepare-app.mjs`：删掉把 `backend/ai` 复制成 `app/backend/ai_service` 的那段（`servicesAiRoot`、
     `aiServiceSrc`/`aiServiceDst`、`retainpdf_ai/__main__.py` 检查）。现在 `backend/ai` 没了，这段会直接报
     `missing ai_service at …`，桌面打包过不去。
  4. `frontend/desktop/scripts/report-package-size.mjs`：去掉 `app/backend/ai_service` 这一项。
  5. `frontend/desktop/requirements-ai-service.txt`：`.github/scripts/sync_backend_python_requirements.py` 不再生成它，CI 的桌面打包
     （`build-desktop-packages.yml`）也不再 `pip install -r` 它；文件可以删掉。

## 删掉命令行 retainpdf-agent（2026-11-03）

用户定：`retainpdf-agent`（给 RetainPDF 自己的 AI 终端里的 agent 调本机接口用的命令行）一起删了。它靠的 Agent 能力令牌
认证在删 AI 那次已经没了，翻译、翻译 agent、管线、Studio 都不用它。上一节「没删的」里列了它，以这一节为准。

- 后端删了 `backend/api/src/bin/retainpdf-agent.rs`；Docker 镜像不再带它；CI 的 macOS 桌面包检查不再要求 `bin/retainpdf-agent`。
- 前端要做（桌面壳）：`frontend/desktop/scripts/prepare-app.mjs` 的 `resolveAgentBinary` 和拷贝 bin 那段、清单字段
  `agentBinaryBundled`；`scripts/run-local.mjs` 的 `requiredBackendBinaries` 去掉它；`src/main/backend-env.js` 里提到它的地方。
  `cargo build --workspace --bins` 不再产出它，打包时找不到会报错，所以要和这个分支一起合。

