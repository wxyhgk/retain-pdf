//! 任务的业务逻辑，和 rust_api 的 `routes/jobs/`、`app/router/jobs/` 一样按 9 类分目录（分类表见
//! `routes/jobs/mod.rs`）：
//!
//! | 目录 | 类 |
//! |---|---|
//! | `lifecycle/` | 任务：建任务、校验、发射、列表和详情、删任务 |
//! | `actions/` | 操作：取消、重跑、重试阶段、续跑计划、OCR 歧义 |
//! | `progress/` | 进度：事件流、当前阶段、边翻边看 |
//! | `files/` | 文件：列出、下载、是否就绪 |
//! | `reports/` | 报告：失败原因、翻译诊断和质检、排版、精修 |
//! | `reader/` | 阅读：区块位置、元信息、Markdown |
//! | `translations/` | 译文：逐条看、人工改、重翻一条 |
//! | `data/` | 数据：按登记表通用取数 |
//!
//! 根目录只放各类共用的：门面 `facade`、依赖 `deps`、返回视图 `presentation`、只读查询的入口
//! `query`、运行时 `runtime_gateway`、产物摘要 `summary_loaders`，以及接口的请求和返回类型 `views`
//!（2026-10-18 从核心包挪过来）。

mod actions;
mod data;
mod deps;
mod facade;
mod files;
mod lifecycle;
mod presentation;
mod progress;
mod query;
mod query_execution;
mod reader;
mod reports;
mod runtime_gateway;
mod summary_loaders;
mod support;
mod translations;
mod views;

// 门面：领域外只能用这里导出的东西，子模块都是私有的（见 BOUNDARIES.md「Domain Facades」）。
pub use data::api::{
    job_data_catalog_view, job_data_view, JobDataApiDeps, JobDataCatalogView, JobDataView,
};
pub use deps::{
    CommandJobsDeps, ControlDeps, JobSubmitDeps, QueryJobsDeps, ReplayDeps, SnapshotBuildDeps,
};
pub use facade::{build_jobs_facade, JobsFacade};
// 书的编号（先看上传记录，再查任务表），任务视图和书库视图拼封面地址都用它。
pub use presentation::book_document_id;
pub use files::{
    stored_path, StoredFile,
    job_readiness, Disposition, FileDownload, FileGroup, JobDownloads, JobFile, JobFilesView,
};
// 删一个任务（`DELETE /jobs/:job_id`）；书库的书架删除、整本删除也用这里的校验和删目录。
pub use lifecycle::deletion::{
    ensure_deletable, ensure_no_dependents, find_job, remove_path_if_exists, JobDeletion,
};
pub use lifecycle::launcher::JobLaunchDeps;
// 对外入口不许带 `runtime.job_id`：书库的建任务入口要在查书、查 OCR 之前先拒（先 400 再 404/409）。
pub use lifecycle::creation::reject_client_job_id;
pub use lifecycle::managed_credential_gc::cleanup_deleted_job_credentials;
pub use lifecycle::ocr_artifact_reuse::{reusable_ocr_coverage, validate_ocr_artifact_reuse};
pub use lifecycle::validation::{
    validate_ocr_credential_reference, validate_provider_credentials,
};
pub use lifecycle::with_dev_translation_defaults;
pub use progress::live_stage::{
    load_live_stage_snapshot, load_live_stage_snapshots, LiveStageSnapshot,
};
pub use progress::stage_view::{build_job_stage_view, terminal_completion_note};
pub use query::{job_search_text, JobQueries};
pub use query_execution::QueryExecution;
pub use reports::quality::api::{
    quality_items_view, quality_summary_view, QualityApiDeps, QualityItemsParams, QualityItemsView,
    QualitySummaryView,
};
pub use reports::usage::api::{
    all_usage_view, document_usage_view, job_usage_view, UsageApiDeps, UsageSummaryView,
};
pub use runtime_gateway::{JobDriverRegistry, JobRuntime, JobRuntimeLauncher};
pub use summary_loaders::SummaryCache;
pub use views::{
    ActionBlockReason, AmbiguousRequestPolicy, BookSummaryView, DeleteJobQuery, DocumentJobListView,
    EditorialEventListView, EditorialEventsQuery,
    EscalatedItemView, GlossaryUsageSummaryView, InvocationSummaryView, JobContractsView, JobDetailView, JobDiagnosticsView, JobEventFeedItem,
    JobEventListView, JobFailureBriefView,
    JobDeleteResultView, JobFailureDiagnosticView, JobFilesQuery, JobLinksView, JobListInvocationSummaryView,
    JobListItemView, JobListView, JobProgressView, JobReportView, JobResumePlanView,
    JobStageContractArtifactView, JobStageContractView, JobStageRuntimeView, JobStageSnapshotView,
    JobStageStateView, JobStagesView, JobSubmissionView, JobTimestampsView,
    LAST_REFINE_ESCALATED_LIMIT, LastRefineView, LayoutDocxQuery, ListDocumentJobsQuery,
    ListJobEventsQuery, ListJobEventsStart, ListJobsQuery, ListTranslationItemsQuery,
    LiveTranslationCommitEventView, LiveTranslationEventsQuery, LiveTranslationItemView,
    LiveTranslationLayoutBlockView, LiveTranslationLayoutPageView, LiveTranslationLayoutView,
    LiveTranslationPageView, LiveTranslationTypographyView, MarkdownDocumentView,
    MarkdownImageView, NormalizationSummaryView,
    OcrAmbiguityReceiptFieldView, OcrAmbiguityResolutionKind, OcrAmbiguityResolutionRequest,
    OcrAmbiguityResolutionView, OcrAmbiguityView, OcrJobSummaryView, PagePreviewQuery,
    ReaderDocumentMetadataView, ReaderMetadataView, ReaderPageMetadataView, ReaderRegionBoxView,
    ReaderRegionItemView, ReaderRegionsView, RefineRetryRequest, RetryStageKind, RetryStageRequest,
    RetryStageSubmissionView, ReviseTranslationItemRequest, StageActionsView,
    StageRetryActionLinkView, StageRetryActionView, TranslationDebugIndexView,
    TranslationDebugItemView, TranslationDebugListItemView, TranslationDebugListView,
    TranslationDiagnosticsView, TranslationReplayView, TranslationRequestRecoveryView,
    TranslationRevisionHistoryView, TranslationRevisionLivePageView,
    TranslationRevisionLivePublicationView, TranslationRevisionSource, TranslationRevisionView,
    build_job_links, build_job_links_with_workflow,
    summarize_list_invocation,
};
// 只给测试用的。
#[cfg(any(test, feature = "test-fixtures"))]
pub use actions::translation_request_recovery::{
    load_translation_request_recovery, load_translation_request_recovery_with_db,
};
#[cfg(any(test, feature = "test-fixtures"))]
pub use lifecycle::validation::validate_translation_credentials;
#[cfg(any(test, feature = "test-fixtures"))]
pub use lifecycle::{carry_dev_defaults_override, DevDefaultsGuard, DevTranslationDefaults};
#[cfg(any(test, feature = "test-fixtures"))]
pub use reports::usage::job_usage_ledger_path;
// 只给测试用的：rust_api 里要搭整个应用的建任务、查询测试，和书库对任务视图的测试。
#[cfg(all(unix, any(test, feature = "test-fixtures")))]
pub use files::downloads::fixture::{DownloadFixture, JOB_ID as DOWNLOAD_FIXTURE_JOB_ID};
#[cfg(any(test, feature = "test-fixtures"))]
pub use lifecycle::creation::{
    build_ocr_job_snapshot, build_translation_job_snapshot, relaunch_in_place, submit_job, NewJob,
    RunFence,
};
#[cfg(any(test, feature = "test-fixtures"))]
pub use presentation::{build_document_job_list_view, build_job_list_view};
#[cfg(any(test, feature = "test-fixtures"))]
pub use progress::event_feed::fixture::{event_line, jsonl_bytes_read, EventFeedFixture};
#[cfg(any(test, feature = "test-fixtures"))]
pub use query::{list_jobs_filtered, JobsPage};
