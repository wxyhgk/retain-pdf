//! 列表接口的 `limit` 默认值和上限。都是常量，不读环境变量：以前有一组读
//! `RUST_API_MAX_*_LIMIT` 的函数，没有任何调用方，已删（2026-10-19）。要改上限就改这里。
//!
//! 越界怎么办按接口分：`/api/v1/jobs` 一族（任务列表、书的任务、译文、质量条目、数据、事件）和
//! 书库的 `/documents`、`/search`、`/documents/:id/metadata-suggestions`（2026-10-22 起）`limit`
//! 超出 1..=上限一律返回 400（规矩见 `docs/api/00-约定/03-分页.md`，校验在
//! `retainpdf_api_base::paging::checked_limit`）。AI 对话、AI 改写文档的接口和表都删了（2026-11-03、2026-11-20）；
//! 书架 `/library/books` 2026-10-22 删了。

/// Default `limit` for paginated lists when the query param is absent.
/// Centralized default — `serde(default = "default_limit")` in `models` delegates here.
pub const DEFAULT_LIST_LIMIT: u32 = 20;
/// Generic max `limit` for list endpoints (documents, jobs, translations).
pub const MAX_LIST_LIMIT: u32 = 500;

/// Max `limit` for `GET /api/v1/search` (block FTS).
pub const MAX_SEARCH_LIMIT: u32 = 100;
/// Max `limit` for `GET /api/v1/documents` — alias of `MAX_LIST_LIMIT`.
pub const MAX_DOCUMENT_LIMIT: u32 = MAX_LIST_LIMIT;
/// Max `limit` for job listings and job events (`GET /api/v1/jobs*`, `.../events`) — alias of `MAX_LIST_LIMIT`.
pub const MAX_JOB_LIMIT: u32 = MAX_LIST_LIMIT;
/// Alias for job events; kept equal to `MAX_JOB_LIMIT`.
pub const MAX_JOB_EVENT_LIMIT: u32 = MAX_JOB_LIMIT;
