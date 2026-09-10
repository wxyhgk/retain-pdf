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
`backend/packages/retain-data/src/db.rs` 及其子模块：

- `db.rs`：`Db` facade，对外提供 job、artifact、event、document、conversation、operation 等持久化能力。
- `db/schema.rs`：建表、schema 检查和兼容初始化。
- `db/rows.rs`：共享数据库行 decode；领域专用 decode 留在对应子模块。
- `db/documents/*`：文档、收藏、搜索、回填和文档行读取。
- `db/document_operations/*`：operation、attempt、event、version、恢复与状态迁移。
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

新增数据库行为时，优先补对应 `retain-data/src/db/**` 领域子模块的最小单元测试；
只有确实属于公共 façade 的能力才扩展 `db.rs`。

## PR 说明

涉及数据库的 PR 至少说明：

- 新增或修改了哪些表、列、索引或 JSON 字段。
- 对旧 job、artifact、glossary、document、conversation 和 operation 是否兼容。
- 是否需要迁移、回填、清理或一次性修复脚本。
- 已覆盖哪些数据库测试，是否用旧数据样本验证过。
