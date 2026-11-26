# 数据库与持久化贡献指南

## 运行时位置

当前 Rust API 使用 SQLite，默认位置是 `DATA_ROOT/db/jobs.db`。本地开发常见路径是：

- `data/db/jobs.db`：SQLite 数据库，默认不提交。
- `data/jobs/**`：任务运行目录和中间产物，默认不提交。
- `data/uploads/**`：上传文件，默认不提交。
- `data/downloads/**`：下载产物，默认不提交。

存储结构见 [运行时存储结构](../api/storage.md)。

## 代码边界

数据库访问统一收敛在
`database/retainpdf-db/src/db.rs` 及其子模块（`retainpdf-data` 重导出成 `retainpdf_data::db`）：

- `db.rs`：`Db` facade，对外提供 job、artifact、event、document、collection、glossary、translation version、sync 等持久化能力。
- `database/retainpdf-db/schema.sql`：**现在每张表的完整样子**（列、类型、默认值、主键、外键、索引、触发器），新建空库跑完全部建表和迁移的快照。
  改了结构（加迁移）要重新生成：`UPDATE_SCHEMA=1 cargo test -p retainpdf-db schema_snapshot`，看 diff 只该有预期的改动。
  老库一路升上来和新建的库一样，`an_old_database_upgraded_matches_a_fresh_one` 守着；真实库可以只读比一次：
  `RETAINPDF_COMPARE_DB=<库文件> cargo test -p retainpdf-db compare_a_real_database -- --ignored --nocapture`。
- `db/snapshot_diff.rs`：**改表结构前后的比对工具**（数据库重做每一步都用，见
  [数据库重做总体设计](../../ops/planning/database-redesign/20261120-数据库重做总体设计.md)）。它只调 `Db` 的公开读接口，把读出来的
  任务快照、产物清单、进度事件、断点续跑记录、书、上传、译文版本、进度流、各种列表和计数导成一行一条的 JSON（按类别、编号排好，
  请求里的凭证换成指纹），迁移前后各导一份逐条比，读接口不变就该一模一样。读接口要先知道的编号（上传、进度流、续跑的阶段和外部调用）
  在 `enumerate_keys` 里从表列出，**改表名、拆表时改这一处**。用法（打开旧库会按当前程序升级它，所以只对副本用，给正在用的库会拒绝）：

  ```bash
  sqlite3 data/db/jobs.db ".backup /tmp/x/before.db" && cp /tmp/x/before.db /tmp/x/after.db
  <main 上编的 retainpdf> db-snapshot dump --db /tmp/x/before.db --out /tmp/x/before.jsonl
  <分支上编的 retainpdf>  db-snapshot dump --db /tmp/x/after.db  --out /tmp/x/after.jsonl   # 打开时跑新迁移
  retainpdf db-snapshot diff /tmp/x/before.jsonl /tmp/x/after.jsonl [--ignore 类别[:字段路径前缀]]...
  ```

  一样退出码 0，有不同 1，并列出哪条、哪个字段、前后的值。`--ignore` 只写**有意的**变化，合并说明里写明忽略了什么、为什么。
- `db/schema/base.sql`：最早几张表（上传、任务、产物、事件、术语表）的幂等建表，新库的起点；不往这里加新表、新列。
- `db/schema/mod.rs`：编号迁移的执行器，以及老表的幂等加列（`LEGACY_COLUMNS`，现在只有 `jobs.document_id`）。
- `db/schema/migrations/`：编号迁移，一个迁移一个 `vNN_<领域>.sql`，说明写在文件开头；清单在 `migrations/mod.rs`。版本号就是清单里的位置，已上线的只能往后追加，不能改、删、调序。
  改列的取值、删列、加带外键的列这种**不能重跑**的迁移（v32 起），在 `schema/mod.rs` 的 `APPLIED_CHECKS` 登记一条「已经是迁移后的样子」的查询：
  正常升级碰不到，是给把 `user_version` 倒回去重跑后面迁移的测试用的（SQLite 删不掉带外键的列，撤不回去）。
  要测「老库升上来」，优先用 `schema::create_at_version(conn, N)` 新建一个停在第 N 个迁移的库、按那时的表写数据、再 `Db::init`，
  不用手动撤掉后面迁移做的改动（例子见 `documents/tests.rs` 的 `a_v35_book_reads_the_same_after_the_library_items_migration`）。
- 状态、流程这类取值存**纯文本**并用 `CHECK` 钉住取值（v32 起 `jobs.status`、`jobs.workflow`；以前是 JSON 字符串 `"succeeded"`）。
  代码里写库、查库用 `JobStatusKind::as_str()` / `WorkflowKind::as_str()`，不要 `serde_json::to_string`（那会带引号）。
  OCR 子任务的父任务在 `jobs.parent_job_id`（写任务时由数据库层按编号 `{父任务}-ocr` 填，父任务不在库里时留空）。
- 任务的运行信息（接口里的 `runtime`，v33 起）**只存算不出来的**：阶段历史在 `job_stage_history`（一段一行，只追加；写的时候只动有变化的行），
  进入当前阶段、最后出错和重试的时间、重试次数是 `jobs` 上的列。当前阶段、结束原因、两个耗时、最终失败分类和摘要读出来时按
  `JobRecord::fill_derived_runtime` 现算——和写之前 `sync_runtime_info` 最后一步是同一个函数，所以读出来的和写进去时算的一样
  （`runtime_reads_back_exactly_what_was_computed_before_writing` 钉着）。`LEGACY_COLUMNS` 从 v33 起不再补（否则会把删掉的 `runtime_json` 加回来）。
- `job_usage_cache` / `job_usage_rollups`（v34）：每个任务的模型用量汇总，是**缓存**——正本是任务目录里的台账和报告，`source_key`
  记着算的时候这些文件的大小、修改时间和价格表指纹，对不上就重算（任务包 `reports/usage/cache.rs`）。没有指向 `jobs` 的外键
  （库里删了记录、目录还在的任务照样算用量），不同步。
- 进度流 `event_feed_items`（v35 起）：来自 `events` 的条目只存 `source_event_uid`（是哪条原始事件），内容读的时候由任务包
  `progress/event_feed/sync.rs` 的 `project_event` 现算——和导入时是同一个函数；来自任务目录 jsonl 文件的条目照旧存 `payload_json`。
  原始事件按保留期删掉时来源的 revision 会变、进度流随之重建；读的同时被删按「事件流变了」报，前端从头重读。
- 防重复提交（v38，见 [防重复提交](../../ops/planning/api-reorg/20261124-防重复提交.md)）：`job_derivations` 记续跑、重试、OCR 歧义恢复
  建的新任务从哪个源任务派生（新任务删了跟着删），`Db::save_derived_job_as_new_run` 在同一个 `BEGIN IMMEDIATE` 事务里查「源任务还有没有
  排队中 / 运行中的派生任务」和落库；`idempotency_keys` 是 `Idempotency-Key` 请求头的短期记录（保留 24 小时，rust_api 的
  `app/idempotency.rs` 用，定期清理删过期的）。两张都不同步、不回填。
- 产物路径一律存相对数据目录的写法（`normalize_job_artifacts_for_storage`）。事件日志 `events_jsonl`、上一份译文 `previous_output_pdf` 2026-11-21 才补上，
  宽松处理：数据目录外的（别的设备同步来的）原样留着、不报错；以前存成本机绝对路径的，`Db::init` 里 `relativize_stored_artifact_paths` 改一次。
- 增量收缩：`PRAGMA incremental_vacuum` 每还一页返回一行，要用 `maintenance::incremental_vacuum` 走到头（`execute_batch` 只走一步、只还一页）。
- `db/rows.rs`：共享数据库行 decode；领域专用 decode 留在对应子模块。
- 书库（v36 起）是「条目主表 + 各类型明细表」：条目 `library_items`（现在只有文献 `reference`，以后有笔记、批注、插件的类型）、
  书目 `item_references`（常用 CSL 字段是列，其余整块放 `extra_csl_json`；书名来源和锁也在这里）、作者 `item_creators`（一人一行）、
  条目下的文件 `item_files`（`file_id` = PDF 内容的 sha256 = 接口里的 `document_id`；阅读状态、当前任务、选哪份译文 `chosen_version_id`）、
  书名建议 `item_title_suggestions`；v37 起还有标签 `tags` / `item_tags`（任何条目都能打；标签编号由名字算出来，同名不重复建）、
  条目之间的关联 `item_relations`、文件夹成员 `collection_items`（成员是条目）。上传 PDF 自动建的条目编号就是文件的内容指纹（`item_id = file_id`）。
  **接口里的一本书（`DocumentRecord`）从视图 `library_documents` 读**，按书查、按书过滤都写在这个视图上；写的时候分别写条目、书目、
  文件。删一本书删的是条目（`DELETE FROM library_items`），书目、作者、文件、书名建议，以及挂在文件下的译文版本、文件夹成员
  都跟着外键级联删。任务、译文版本、全文索引按文件的内容指纹关联，不直接指向条目。设计见
  [书库条目模型](../../ops/planning/database-redesign/20261121-书库条目模型.md) 和 [第 5a 步的调整](../../ops/planning/database-redesign/20261121-书库条目第5a步.md)。
- 阅读页提问的问答记录（v39，见 [第 3 步：问答记录](../../ops/planning/reader-ask/20261125-第3步：问答记录.md)）：`ask_threads` 一次提问一行
  （锚点拆成列：栏、页、块、选中的字、那一块的原文译文、章节、页内位置），`ask_messages` 一条问答一行（用量整块 JSON）。挂在
  `item_files(file_id)` 上，删书级联删；不同步、没有归属列（跟着书）。比对工具在每本书的 `document` 条目里导出 `ask_threads`。
  2026-11-26 起只读保留（新的问答进 v40 的主对话）。
- 阅读页提问的主对话、副对话和记忆（v40，见 [主对话、副对话和记忆](../../ops/planning/reader-ask/20261126-主对话副对话和记忆.md)）：
  `ask_conversations`（`main` / `side`，部分唯一索引保证只有一个 `open` 的主对话；副对话 `parent_id` 级联删）、`ask_conversation_messages`
  （只追加，`seq` 从 1 起，每条记 `document_id` 和结构化出处，书删了置空）、`ask_memories`（`user` / `book` 层，书层挂 `item_files` 级联删，
  状态 active / superseded / deleted，出处的对话、消息删了置空）和它的全文索引 `ask_memories_fts`（trigram，三个触发器维护），
  以及 v41 的一行设置表 `ask_settings`（「让 AI 使用记忆」总开关，没有这一行就是默认开）。开着的主对话不能删（先归档）。全局数据，没有归属列，
  接口多用户下关闭；不同步。比对工具导出 `ask_conversation`（连同全部消息）、`ask_memory` 两类。
- `db/documents/*`：文档、搜索、回填和文档行读取。（AI 对话、AI 计算、AI 改写文档和收藏的表、模块 2026-11-20 删了，v31）
- `db/pipeline/*`：pipeline attempt、dispatch、stage、unit、event 与事务写入；读取和迁移写入不得重新揉回一个大文件。

基本规则：

- 涉及数据库时，优先通过 `Db` facade 和已有领域模块扩展，不要在 route、HTTP service 或 presentation 层直接写 SQL。
- 查询、事务写入、row decode 和兼容迁移应保持独立；跨表原子操作集中在领域 `tx` 模块。
- 新增持久化字段时，先判断它属于数据库记录、文件 manifest，还是运行时临时状态；不要把临时状态随手塞进数据库。
- 数据库里尽量保存相对路径、artifact key、job_id 和稳定元数据；真实文件路径运行时再通过 storage path resolver 解析。
- API 返回字段优先从 view/projection 层输出，不要让前端直接依赖数据库列名或 `JobSnapshot` 内部字段。
- 术语表、图书馆、artifact manifest、reader metadata 这类可被前端长期消费的数据，应优先设计成稳定表/稳定 view。

## 兼容要求

改 schema 时必须考虑：

- 旧 `jobs.db` 能否启动。
- 旧 job 能否列出、查看详情、删除。
- 旧 artifact 能否下载。
- 旧 glossary 是否还能被读取或迁移。
- 旧 document/conversation/operation/version 是否还能恢复并保持 active version 一致。
- 运行中 pipeline attempt、dispatch 和 committed unit 在进程重启后是否仍可辨认。
- 是否影响重新渲染、断点恢复或失败诊断。

不要提交本地 `data/db/jobs.db`。需要复现数据库问题时，优先提供最小 SQL、脱敏 fixture、job_id、schema 版本和复现步骤。

## 常用检查

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
cargo test --locked --workspace --manifest-path "$BACKEND_ROOT/api/Cargo.toml"
python3 "$BACKEND_ROOT/api/scripts/check_architecture.py"
```

新增数据库行为时，优先补对应 `retainpdf-data/src/db/**` 领域子模块的最小单元测试；
只有确实属于公共 façade 的能力才扩展 `db.rs`。

## PR 说明

涉及数据库的 PR 至少说明：

- 新增或修改了哪些表、列、索引或 JSON 字段。
- 对旧 job、artifact、glossary、document、conversation 和 operation 是否兼容。
- 是否需要迁移、回填、清理或一次性修复脚本。
- 已覆盖哪些数据库测试，是否用旧数据样本验证过。
