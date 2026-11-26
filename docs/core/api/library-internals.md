# 书库、凭据、术语表：内部设计

对外接口用法看 `docs/api/`：[书与文档](../../api/13-书库/01-书与文档.md)、[合集、标签与检索](../../api/13-书库/02-合集标签与检索.md)、
[元数据建议](../../api/13-书库/03-元数据建议.md)、[字体与运行资源](../../api/13-书库/04-字体与运行资源.md)、
[凭据](../../api/14-凭据/01-凭据.md)、[术语表](../../api/04-翻译/03-术语表.md)。这一篇只记实现思路和为什么这样做，
内容来自原来的 `backend/api/docs/api-spec/credentials.md`、`document-metadata.md`、`jobs-document-history.md`、`glossaries.md`
（2026-11-24 拆开：用法合进 `docs/api/`，实现留在这里）。

## 凭据库

代码：读写在服务商包 `backend/packages/retainpdf-providers/src/credentials/`，文件格式（版本、上限、路径、名字规则、读之前的安全检查）
只在 `backend/packages/retainpdf-data/src/credentials.rs` 定义一次，任务运行时取密钥的一侧共用，免得两边按不同格式读写。

- 位置 `<数据目录>/secrets/credentials.json`，格式 `retainpdf_credential_vault_v1`：库级 `revision` 加 `credentials` 表，每条
  `kind`、`provider`、`label`、`secret`、`revision`、`managed_by`（只有导入的内联密钥是 `legacy_job_import`）、时间戳。
- 文件最大 256 KiB，单个密钥最大 8192 字节。读之前查：是符号链接、不是普通文件、太大都拒绝；POSIX 上权限不是 `0600` 也拒绝
  （别人能读）。目录 `0700`、文件 `0600`。
- 写：原子替换；POSIX 上先拿私有文件锁 `.credentials.lock`（`flock`），跨后端进程串行，发布前对替换文件和它的父目录都 `fsync`，
  再回成功。其它平台只有进程内锁和原子替换。
- 五个接口的文件 IO、进程内和跨进程锁、`fsync`、删除时的 SQLite 引用计数都放在阻塞线程（`spawn_blocking`），不占异步工作线程。
- 新编号 `cred_` + 16 位十六进制随机数。
- 修订号：每条有自己的 `revision`，库也有一个。更新带了这一条的修订号就只比这一条，不会因为别的凭据（比如另一个 OCR 凭据）变了就冲突；
  库级修订号留给旧客户端和新建、删除。

### 建任务和删凭据之间的锁

建任务从校验引用到任务落库，全程拿着共享的使用锁（`CredentialUsageLock`：进程内读锁 + POSIX 上的共享文件锁）；删除拿独占锁。
所以并发的删除插不进这两步之间：要么任务先落库、删除回 `CREDENTIAL_IN_USE`，要么删除先完成、建任务回 `CREDENTIAL_REF_NOT_FOUND`。
进程内各平台都成立，跨进程只在 POSIX 上成立。

删除默认数一遍所有已落库任务请求里的引用（含已结束的：重试、续跑还要用）。以前还查 AI 运行时配置 `secrets/ai-runtime.json`
和 AI 启动环境变量里的引用，2026-11-03 跟 AI 服务一起删了。冲突回应不带任务编号、个数、运行时字段或密钥。

### 内联密钥的导入和回收

- 内联的 `ocr.mineru_token`、`ocr.paddle_token`、命令型服务商的 `ocr.options.credential|token|api_key`、`translation.api_key`
  在任务落库前导入成托管凭据（`get_or_create_managed_credential`），任务里只留引用。只和**同样是导入来的**、种类、服务商（不分大小写）、
  值都一样的复用；用户自己建的哪怕值一样也不合并。
- 只有真要跑 OCR 时才导入选中的那个 OCR 密钥，其余内联 OCR 字段清空；复用已有 OCR 产物时内联 OCR 密钥直接丢掉。
- 回收（`retainpdf-jobs` 的 `lifecycle/managed_credential_gc`）：删任务、删书、重跑丢掉旧 `-ocr` 子任务之后，没有任务再引用的托管凭据删掉。
  重试换下来的那条不在这次回收。对托管凭据显式 `PUT` 会去掉 `managed_by`，转成用户的。

### 运行时怎么拿到密钥

建任务时校验引用，库里只存不透明的引用；在拉起 worker 前一刻才解析出密钥，经各服务商原有的环境变量传进去
（如 `RETAIN_TRANSLATION_API_KEY`、`RETAIN_REVIEWER_API_KEY`，命令型 OCR 是 `RETAIN_OCR_CREDENTIAL` 加配置里的专用变量）。
OCR 阶段的 spec 里只有 `env:...` 这样的引用，不含凭据库引用或密钥。worker 的 stdout/stderr 和落库的任务状态都用解析出的密钥做一遍擦除。

## 书（文档）怎么存

- 书现在存成条目模型：`library_items`（条目）、`item_files`（一个文件，`file_id` 就是 `document_id`，带 `active_job_id`、
  `chosen_version_id`、`reading_status`）、`item_references`（书名、书名来源、锁定、年份、DOI）、`item_creators`、`item_tags`；
  对外的 `DocumentRecord` 读自视图 `library_documents`（`database/retainpdf-db/schema.sql`）。
- 任务的相关表：`uploads`（源文件名、大小、页数）、`jobs`（状态、阶段、进度、时间戳、请求和运行时状态）、`artifacts.artifacts_json`
  （每个任务的产物路径，加上缓存的书的展示信息，如 `cover_image_path`、`thumbnail_image_path`；扫 Markdown 图片目录只是兜底）、
  `job_artifact_entries`（规范化的产物清单）、`events`（完整的历史进度）。
- `has_translation` 读时用 SQL 现算（每行一次走索引的查找），只查任务表，不打开 PDF。
- 书列表的页和 `total` 在同一个 SQLite 快照里读，不会跳行，所以 `has_more` 能直接用 `offset + 条数 < total` 算。
  `q` 用 `LIKE` 而不是全文索引：只比标题和文件名两列，个人文献库的量级够用。
- 删书：先在一个事务里删完所有库里的行，再删磁盘文件。文件删除进不了事务，只能在「留孤儿文件」和「丢索引行」之间二选一；
  选留文件——占的是可回收的空间，重删是幂等的，而丢了的索引行拿不回来。
  磁盘这边删任务目录、上传目录，2026-11-26 起还删书的缓存目录 `documents/<document_id>/`（`retainpdf-files` 的
  `remove_document_artifacts_dir`：只删 `documents/` 下一层、真是目录、解析后还在 `documents/` 里的；书的编号是原文的内容哈希，
  一本书一个目录，别的书不会用它；删不掉只记日志），以及这本书的问答记着的 pi 会话文件（删之前从 `ask_threads` 取出会话编号，
  删完调 `retainpdf-providers` 的 `remove_pi_sessions`；还有别的提问记着同一个会话的留着）。删一次提问也一样清它的 pi 会话。

### 合并阅读

多次范围翻译合并成虚拟任务 `merged-<document_id>-<指纹>`，目录在 `<数据目录>/documents/<document_id>/merged/<指纹>/`
（`retainpdf-library` 的 `merge/`）。

- 每次按虚拟 id 读都刷新目录里的 `.last-used`；旧的合并目录只有在超过 24 小时没人读、而且同一本书有了更新的合并时才清理，
  阅读入口当前指向的那个永远不删。
- 指纹由这些决定：合并器版本、原文、每页取自哪个任务的哪一页、每个被引用任务的输出 PDF / 译文 manifest / 译文断点
  （`translation-checkpoint.v1.json`）/ 规范化文档的大小和修改时间、OCR 页号表。断点是 2026-11-26 加的：手改译文只原子换掉页文件和断点
  （generation 加一），不动 manifest 和 PDF，以前改了译文合并阅读一直是旧的。取断点的文件戳而不是读 generation：断点能有几 MB，
  每次打开都解析不划算，而它只在提交时整个换掉，戳变了就是 generation 变了。
- 同一个指纹同时只生成一次，后到的等它做完；全进程同时最多生成 2 个。
- 书的页数取原文 PDF 的实际页数（按文件戳缓存），读不了才退回 `documents.page_count`；`/translation-coverage` 用同一个数。
  覆盖只计算、不生成合并，打开详情页不会触发一次合并。

### 译文版本

数据库 v30（2026-11-18）：`translation_versions`、`translation_version_jobs`（版本里有哪些任务），书选的版本记在 `item_files.chosen_version_id`。
哪类任务开新版本、哪类并进源版本，见 [书与文档 · 译文版本](../../api/13-书库/01-书与文档.md#译文版本) 和
[译文版本第一期](../../ops/planning/translation-versions/20261118-译文版本第一期.md)。读某个版本时，它自己的任务盖在底版本链上（自己的页总是优先）。

## 元数据建议的实现

代码 `backend/packages/retainpdf-library/src/metadata_suggestions.rs` 和同名目录。

- PDF 只解析 Info 字典去读 `Title`（Info 在压缩对象流里时才解析整个 PDF）；加密 PDF 不给 Info 书名。
- 规范化文档边读边算哈希（证据哈希不变），只留前 8 页；超过 256 MB 拒绝。两样都在阻塞线程里做，不占异步运行时。
- 规范化文档取任务登记的那份（`artifacts.normalized_document_json`，经任务包的 `stored_path` 读），不再给没登记的任务去猜
  `<任务目录>/ocr/normalized/document.v1.json`；这和复用 OCR、阶段重试一致。
- 建议和证据哈希先落库（`item_title_suggestions`）再返回。应用在一个 SQLite 立即事务里完成，同时更新建议和书。
- 书名来源（数据库 v12 起）之前就改过名的书，迁移 v28 把它们标成 `user` 并锁定。
- 以后要加模型兜底：只能读有界的候选证据，另写一条 `source=ai` 的建议，仍走同一个带护栏的「应用」，不许直接改书的行。

## 文档级任务列表

`/documents/{id}/jobs` 的 `total` 是 `COUNT(*)`，列表会跳过读不出来的坏行；所以 `has_more` 改成多取一条判断，不再用 `total` 算
（以前最后一页会误报还有）。`attempt`、`retry_count`、`last_retry_at` 来自任务的 `runtime_json`。

## 术语表

- 去重和「内联覆盖表」用同一个键（原词，上下文）：`case_insensitive` 的原词按小写比，`exact`、`regex` 区分大小写，上下文不分大小写；
  JSON 接口严格（不认识的 `level`、`match_mode` 和编译不过的正则 `400`），CSV 宽松（落到默认值）。
- CSV 分隔符识别：按 CSV 引号规则解析后打分——认得出表头的优先，其次能切出多列；首行按制表符能切出多列时优先当制表符
  （Excel 复制出来的单元格不加引号，备注里的逗号不会让它被当成逗号分隔，2026-11-09），再看各行列数是否一致。
- 导出时给以 `=`、`+`、`-`、`@`、制表符、回车开头的单元格加 `'` 防公式注入，`parse-csv` 去掉它，导出再导入能还原。
- 任务里存快照（合并后的 `glossary_entries`）和用户内联条目（`glossary_inline_entries`）；出新任务的重跑按现在的表重新解析，
  原地重渲染不重新解析。

## 其它

- 字体列表要起 `fc-list` 子进程（约 70 毫秒），前端又拉得很勤，所以按字体目录的修改时间加 10 分钟过期缓存，上传字体时清掉；
  扫描和上传后的 `fc-cache -f` 都在阻塞线程里。
- 全文检索用 FTS5 的 trigram 分词，查询少于 3 个字时退回 `LIKE` 扫描（`database/retainpdf-db/src/db/documents/search.rs`）。
- 删合集顺手清 `<数据目录>/collections/<id>/`（以前合集的 Agent 工作区在里面），清不掉只记日志。
