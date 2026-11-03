//! 业务逻辑按领域分成 8 个包（拆包规划第 3 节），都在 `backend/packages/retainpdf-<领域>`，这里只把它们接上，
//! rust_api 里照旧写 `crate::services::<领域>::…`。
//!
//! | 领域 | 管什么 |
//! |---|---|
//! | `accounts` | 账号、登录会话、页额度、邀请码、管理后台、平台设置 |
//! | `providers` | 模型和 OCR 服务商、凭据库、模型调用、连通性测试 |
//! | `ingest` | 上传 |
//! | `files` | 产物清单和打包、派生产物生成、下载文件名 |
//! | `jobs` | 任务：按 8 类分（见任务包 `retainpdf-jobs` 的 `lib.rs`），含质量报告、模型用量 |
//! | `library` | 书、书架、合集、全文检索、合并阅读 |
//! | `glossaries` | 术语表 |
//! | `platform` | 同步、备份、字体、健康检查 |
//!
//! 每个领域包的 `lib.rs` 是它唯一的门面：子模块私有，领域外只能用门面导出的东西。领域之间只能往下
//! 依赖，允许的方向登记在 `scripts/check_architecture.py` 的 `ALLOWED_DOMAIN_DEPENDENCIES`。

// 账号已经拆成独立的包，这里接上。
pub(crate) use retainpdf_accounts as accounts;
// 文件已经拆成独立的包，这里接上。
pub(crate) use retainpdf_files as files;
// 术语表已经拆成独立的包，这里接上，`crate::services::glossaries::…` 的写法不变。
pub(crate) use retainpdf_glossaries as glossaries;
// 入口已经拆成独立的包，这里接上。
pub(crate) use retainpdf_ingest as ingest;
// 任务已经拆成独立的包，这里接上。
pub(crate) use retainpdf_jobs as jobs;
// 书库已经拆成独立的包，这里接上。
pub(crate) use retainpdf_library as library;
// 平台已经拆成独立的包，这里接上。
pub(crate) use retainpdf_platform as platform;
// 服务商已经拆成独立的包，这里接上。
pub(crate) use retainpdf_providers as providers;
