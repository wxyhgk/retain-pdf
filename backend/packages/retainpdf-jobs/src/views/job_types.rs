use serde::{Deserialize, Serialize};
use serde_json::Value;

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::{
    JobFailureInfo, JobFailureUpstream, JobRuntimeInfo, JobStatusKind, OcrProviderDiagnostics, PublicResolvedJobSpec,
    WorkflowKind,
};

use retainpdf_files::{ArtifactDisplayItemView, ArtifactLinksView, JobActionsView};

use super::super::common::{
    JobLinksView, JobProgressView, JobStagesView, JobTimestampsView,
};

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderRegionBoxView {
    pub page: i64,
    pub bbox: Vec<f64>,
    pub unit: String,
    pub origin: String,
    pub text: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderRegionItemView {
    pub item_id: String,
    pub source: ReaderRegionBoxView,
    pub translated: ReaderRegionBoxView,
    pub markdown: Option<String>,
    pub region_type: String,
    pub status: String,
    pub asset_ids: Vec<String>,
    pub asset_urls: Vec<String>,
    /// Page-local reading order; items are emitted sorted by (source.page, reading_order).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reading_order: Option<i64>,
    /// Normalized document sub_type (body, heading, title, page_number, ...).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_type: Option<String>,
    /// Markdown heading depth for title/heading blocks; 1 is the top level.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub heading_level: Option<i64>,
    /// Shared by the blocks of one paragraph that was split across blocks or pages.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub continuation_group_id: Option<String>,
    /// Set with continuation_group_id: this block's own share of the translation,
    /// while translated.text carries the whole group's text.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub translated_block_text: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderRegionsView {
    pub items: Vec<ReaderRegionItemView>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderPageMetadataView {
    pub page: i64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderDocumentMetadataView {
    pub page_count: i64,
    pub pages: Vec<ReaderPageMetadataView>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderMetadataView {
    pub source: Option<ReaderDocumentMetadataView>,
    pub translated: Option<ReaderDocumentMetadataView>,
}

/// `GET /jobs/:id/reader/layout`：rpr_fit 引擎排的版面清单，阅读页的 HTML 页照它画（2026-11-28）。
/// 没有版面时 `available: false`、`reason` 说为什么，能补排时 `generate` 给出补排的请求。
#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderLayoutView {
    pub available: bool,
    /// `no_translated_pdf` | `not_engine_route` | `unsupported_render` | `merged_reading` | `not_kept`；有版面时 null。
    pub reason: Option<String>,
    /// 版面格式，现在是 `rpr_layout_v1`。
    pub schema: Option<String>,
    pub engine_version: Option<String>,
    pub engine_commit: Option<String>,
    pub page_count: usize,
    /// 有版面的页，按原文页号（从 0 起）排；没有译文的页不在里面。
    pub pages: Vec<ReaderLayoutPageEntryView>,
    /// 底图：译文 PDF 的底（去掉原字的原文页），只含 `pages` 里这些页、按页号从小到大排。渲染源就是原件
    /// （扫描件）时 null，用原文页做底。
    pub background: Option<ReaderLayoutBackgroundView>,
    /// 画字用的字体（按书子集化的 woff2），还没做，现在是空的。
    pub fonts: Vec<ReaderLayoutFontView>,
    /// 补排：照原样发这个请求（原地重新渲染，不调模型、不花钱），跑完版面就有了。补不了时 null。
    pub generate: Option<ReaderLayoutGenerateView>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderLayoutPageEntryView {
    /// 原文页号，从 0 起。
    pub index: u32,
    pub width: f64,
    pub height: f64,
    /// 这页版面的指纹，取一页时的 ETag 也是它。
    pub etag: String,
    pub blocks: u32,
    pub url: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderLayoutBackgroundView {
    /// PDF，支持分段读。
    pub url: String,
    /// 底图第 n 页是原文第 `pages[n]` 页（从 0 起）。
    pub pages: Vec<u32>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderLayoutFontView {
    pub key: String,
    pub family: String,
    pub weight: u32,
    pub url: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderLayoutGenerateView {
    pub method: String,
    pub url: String,
    pub body: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct JobStageContractArtifactView {
    pub artifact_key: String,
    pub required: bool,
    pub ready: bool,
    pub relative_path: Option<String>,
    pub detail: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct JobStageContractView {
    pub stage: String,
    pub ready: bool,
    pub artifacts: Vec<JobStageContractArtifactView>,
}

#[derive(Debug, Serialize)]
pub struct JobContractsView {
    pub schema_version: String,
    pub stages: Vec<JobStageContractView>,
}

#[derive(Debug, Serialize)]
pub struct JobDetailView {
    pub job_id: String,
    pub workflow: WorkflowKind,
    pub status: JobStatusKind,
    pub ocr_reused: bool,
    pub source_artifact_job_id: Option<String>,
    pub request_payload: PublicResolvedJobSpec,
    pub trace_id: Option<String>,
    pub provider_trace_id: Option<String>,
    /// 终态任务的完成说明，仅在有额外信息时出现（正常完成为 None）。
    ///
    /// 这**不是**阶段字段：`build_public_stage_snapshot` 对终态一律返回 None
    /// 是有意的（jobs_live_stage.rs 的 terminal_job_detail_uses_status_...
    /// 钉住了这条——终态该看 status，而不是把 "done" 当成一个阶段），
    /// 顶层那组 display_stage/stage/substage/lane/stage_detail/progress
    /// 也被 assert_no_legacy_top_level_stage_fields 禁止回流。
    ///
    /// 但 completion_pipeline.rs 恰恰在成功收尾时把「任务完成，但有 N 个内容块
    /// 保留原文未翻译」写进 job.stage_detail，若不另开通道就永远送不出去，
    /// 用户只会看到一个与完全成功无异的绿色「已翻译」。故用独立语义的字段承载。
    pub completion_note: Option<String>,
    pub stage_snapshot: Option<JobStageSnapshotView>,
    pub background_snapshots: Vec<JobStageSnapshotView>,
    pub stages: JobStagesView,
    pub timestamps: JobTimestampsView,
    pub links: JobLinksView,
    pub actions: JobActionsView,
    pub artifacts: ArtifactLinksView,
    pub artifacts_display: Vec<ArtifactDisplayItemView>,
    pub book_summary: BookSummaryView,
    pub contracts: JobContractsView,
    pub ocr_job: Option<OcrJobSummaryView>,
    pub ocr_provider_diagnostics: Option<OcrProviderDiagnostics>,
    pub runtime: Option<JobRuntimeInfo>,
    pub failure: Option<JobFailureInfo>,
    pub error: Option<String>,
    pub failure_diagnostic: Option<JobFailureDiagnosticView>,
    pub normalization_summary: Option<NormalizationSummaryView>,
    pub glossary_summary: Option<GlossaryUsageSummaryView>,
    pub invocation: Option<InvocationSummaryView>,
    pub translation_request_recovery: Option<TranslationRequestRecoveryView>,
    pub log_tail: Vec<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct JobStageSnapshotView {
    pub display_stage: Option<String>,
    pub stage: Option<String>,
    pub substage: Option<String>,
    pub lane: Option<String>,
    pub stage_detail: Option<String>,
    pub progress: JobProgressView,
    /// 这一阶段的请求正在等服务商限流（429/529/503 退避）时才有；等完就没了（字段不出现）。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upstream_wait: Option<UpstreamWaitView>,
}

/// 服务商限流等待：worker 在阶段观察 payload 的 `upstream_wait` 里报，这里原样带出（缺的字段为 null）。
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct UpstreamWaitView {
    /// 服务商 id：翻译 openai / anthropic / deepseek / zhipu / qwen / opencode / custom，OCR paddle / mineru / glm_ocr。
    pub provider: String,
    pub http_status: u16,
    /// rate_limited（429）、overloaded（529）、unavailable（503）。
    #[serde(default)]
    pub reason: Option<String>,
    /// 上游错误码（错误体里的 error.code / error.type），没有为 null。
    #[serde(default)]
    pub code: Option<String>,
    /// 这次打算等的秒数（Retry-After 或退避）。
    #[serde(default)]
    pub retry_after_s: Option<f64>,
    /// retry_after（照响应头）或 backoff（自己退避）。
    #[serde(default)]
    pub wait_source: Option<String>,
    #[serde(default)]
    pub attempt: Option<u32>,
    #[serde(default)]
    pub max_attempts: Option<u32>,
    #[serde(default)]
    pub started_at: Option<String>,
    /// 预计等到什么时候（UTC ISO 8601）。
    #[serde(default)]
    pub until: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BookSummaryView {
    pub title: String,
    pub authors: Option<String>,
    pub page_count: Option<i64>,
    pub source_language: Option<String>,
    pub target_language: Option<String>,
    pub source_file_name: Option<String>,
    pub cover_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub file_size_bytes: Option<u64>,
    /// 书的编号（原文 PDF 的 sha256）。原文、封面都在 `/documents/{document_id}/files/` 下；查不到书的任务是 null。
    pub document_id: Option<String>,
}

impl BookSummaryView {
    pub fn with_cover_url(mut self, cover_url: Option<String>) -> Self {
        self.cover_url = cover_url;
        self
    }

    pub fn with_thumbnail_url(mut self, thumbnail_url: Option<String>) -> Self {
        self.thumbnail_url = thumbnail_url;
        self
    }

    pub fn with_document_id(mut self, document_id: Option<&str>) -> Self {
        self.document_id = document_id.map(str::trim).filter(|id| !id.is_empty()).map(str::to_string);
        self
    }
}

#[derive(Debug, Serialize)]
pub struct JobFailureDiagnosticView {
    pub failed_stage: String,
    pub error_kind: String,
    pub summary: String,
    pub root_cause: Option<String>,
    pub retryable: bool,
    pub upstream_host: Option<String>,
    pub suggestion: Option<String>,
    pub last_log_line: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct JobDiagnosticsView {
    pub failure_code: Option<String>,
    pub failed_stage: Option<String>,
    pub failed_substage: Option<String>,
    pub summary: String,
    pub detail: Option<String>,
    pub suggestion: Option<String>,
    pub retryable: bool,
    pub resume_available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub render_diagnostics: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub translation_request_recovery: Option<TranslationRequestRecoveryView>,
    pub ocr_ambiguity: Option<OcrAmbiguityView>,
    /// 上游服务商回的是什么（同任务详情 `failure.upstream`）。不知道时整个键不出现。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upstream: Option<JobFailureUpstream>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct OcrAmbiguityReceiptFieldView {
    pub name: String,
    pub label: String,
    pub required: bool,
    pub secret: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct OcrAmbiguityView {
    pub status: String,
    pub provider: String,
    pub operation: String,
    pub resolution_revision: u64,
    pub allowed_resolutions: Vec<OcrAmbiguityResolutionKind>,
    pub receipt_fields: Vec<OcrAmbiguityReceiptFieldView>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct TranslationRequestRecoveryView {
    pub status: String,
    pub journal_ready: bool,
    pub unresolved_dispatches: u64,
    pub active_ambiguous_request_keys: u64,
    pub historical_ambiguous_request_keys: u64,
    pub requires_confirmation: bool,
    pub supported_retry_policies: Vec<String>,
    pub detail: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct JobResumePlanView {
    pub can_resume: bool,
    pub job_id: String,
    pub from_stage: Option<String>,
    pub resume_workflow: Option<WorkflowKind>,
    pub reuses_artifacts: Vec<String>,
    pub reruns_stages: Vec<String>,
    pub reason: Option<String>,
    /// `reason` 的机器可读版本，能续跑时为 null。取值见 [`ActionBlockReason`]。
    pub reason_code: Option<ActionBlockReason>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RetryStageKind {
    Ocr,
    Translation,
    Render,
    /// 精修已提交的译文（挑错 + 定点修改），然后原地重渲染一次。只支持
    /// `create_new_job=false`：不新建任务、不重翻；精修参数见 [`RefineRetryRequest`]。
    Refine,
}

/// 「任务/产物的当前状态不允许这个操作」的稳定机器可读原因。
///
/// 操作被拒时放进 409 的 `error.details.reason`；GET 里把同一个值放在
/// `disabled_code`（阶段操作）/ `reason_code`（续跑计划），文字说明另有 `disabled_reason` / `reason`。
/// 值只增不改，客户端按它分支，不要解析文字说明。
#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionBlockReason {
    /// 任务排队中或在跑，先取消。
    JobActive,
    /// 取消一个不在排队/运行的任务。
    JobNotActive,
    /// 这个阶段 / 续跑要用的产物或原始来源不在了。
    ArtifactsMissing,
    /// 精修要写回任务自己的译文目录，但这个任务渲染的是别的任务的译文。
    TranslationsNotOwned,
    /// 翻译请求的结果不确定：要用 retry-stage(translation) + `accept_duplicate_risk` 确认。
    AmbiguousTranslationRequest,
    /// OCR 派发的结果不确定：要用 resolve-ocr-ambiguity 绑定已有回执或接受重复风险，
    /// 不能拿「从翻译阶段重试」处理。
    AmbiguousOcrDispatch,
    /// 翻译请求日志损坏，接受重复风险也修不好。
    RequestJournalCorrupt,
    /// Rust 模型执行器绑定的任务不能走这条旧路径。
    ModelExecutorUnsupported,
    /// OCR 歧义处理的 revision 过期，或已被别的请求处理。
    StaleResolution,
    /// 任务没有可处理的 OCR 歧义（已不是失败态，或没有记录在案的派发）。
    NoOcrDispatch,
    /// 歧义的 OCR 派发属于不支持绑定收据的服务商/操作。
    OcrDispatchUnsupported,
    /// 这个任务已经续跑 / 重试出一个新任务，那个新任务还在排队或在跑：等它结束或先取消它。
    /// 409 的 `error.details.active_job_id` 是那个任务的编号（2026-11-24 起）。
    DerivedJobActive,
}

impl ActionBlockReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::JobActive => "job_active",
            Self::JobNotActive => "job_not_active",
            Self::ArtifactsMissing => "artifacts_missing",
            Self::TranslationsNotOwned => "translations_not_owned",
            Self::AmbiguousTranslationRequest => "ambiguous_translation_request",
            Self::AmbiguousOcrDispatch => "ambiguous_ocr_dispatch",
            Self::RequestJournalCorrupt => "request_journal_corrupt",
            Self::ModelExecutorUnsupported => "model_executor_unsupported",
            Self::StaleResolution => "stale_resolution",
            Self::NoOcrDispatch => "no_ocr_dispatch",
            Self::OcrDispatchUnsupported => "ocr_dispatch_unsupported",
            Self::DerivedJobActive => "derived_job_active",
        }
    }

    /// 409，`error.details.reason` 写这个原因。
    pub fn conflict(self, message: impl Into<String>) -> AppError {
        AppError::conflict_because(self.as_str(), message)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AmbiguousRequestPolicy {
    #[default]
    Block,
    AcceptDuplicateRisk,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OcrAmbiguityResolutionKind {
    BindExistingReceipt,
    AcceptDuplicateRisk,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OcrAmbiguityResolutionRequest {
    pub resolution: OcrAmbiguityResolutionKind,
    pub resolution_revision: u64,
    #[serde(default)]
    pub task_id: String,
    #[serde(default)]
    pub batch_id: String,
    #[serde(default)]
    pub upload_url: String,
    #[serde(default)]
    pub trace_id: String,
}

#[derive(Debug, Serialize)]
pub struct OcrAmbiguityResolutionView {
    pub resolution: OcrAmbiguityResolutionKind,
    pub provider: String,
    pub operation: String,
    pub submission: RetryStageSubmissionView,
}

#[derive(Debug, Serialize)]
pub struct StageRetryActionLinkView {
    pub method: String,
    pub url: String,
    pub body: Value,
}

#[derive(Debug, Serialize)]
pub struct StageRetryActionView {
    pub stage: RetryStageKind,
    pub label: String,
    pub can_retry: bool,
    pub reason: String,
    pub disabled_reason: String,
    /// `disabled_reason` 的机器可读版本；`disabled_reason` 为空时为 null。
    /// 翻译阶段在请求结果不确定时 `can_retry` 仍为 true，这里是 `ambiguous_translation_request`
    /// （重试要带 `ambiguous_request_policy=accept_duplicate_risk`）。
    pub disabled_code: Option<ActionBlockReason>,
    pub action: Option<StageRetryActionLinkView>,
    pub will_reuse: Vec<String>,
    pub will_rerun: Vec<String>,
    pub danger: bool,
    /// 只在精修这一项上:上次精修的结果(没精修过为空)。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_refine: Option<LastRefineView>,
}

/// 上次精修的摘要(来自 artifacts/refine_report.v1.json),给「重新处理」里显示、续跑用。
#[derive(Debug, Serialize, Default, PartialEq, Eq)]
pub struct LastRefineView {
    /// completed / stopped / failed
    pub status: String,
    pub generated_at: String,
    pub finding_count: i64,
    pub applied: i64,
    /// 审了多少块、范围内一共多少块。
    pub reviewed_item_count: i64,
    pub candidate_item_count: i64,
    /// 没审到的块数与没审到的第一页(1-based);全审到时为 0 / None。老报告没有这两项时按
    /// 「审了 / 一共」推算块数,页码为 None。
    pub unreviewed_item_count: i64,
    pub next_page: Option<i64>,
    pub stopped_reason: Option<String>,
    /// review_only / review_and_fix / editorial;老报告没有时为空串。
    pub mode: String,
    /// 编辑部留给人确认的块数(报告 editorial.escalated 的条数);其它模式为 0。
    pub escalated_count: i64,
    /// 留给人确认的块,最多 `LAST_REFINE_ESCALATED_LIMIT` 条,按书中顺序。
    pub escalated: Vec<EscalatedItemView>,
}

/// 上次精修摘要里最多带几条「留给你确认」(全部见 GET translation/refine-report)。
pub const LAST_REFINE_ESCALATED_LIMIT: usize = 50;

/// 编辑部留给人确认的一块。
#[derive(Debug, Serialize, Default, PartialEq, Eq)]
pub struct EscalatedItemView {
    pub item_id: String,
    pub page_number: i64,
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct StageActionsView {
    pub job_id: String,
    pub stages: Vec<StageRetryActionView>,
}

/// 不认识的字段一律 400（以前拼错 `create_new_job` 会悄悄按默认值处理）。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RetryStageRequest {
    pub stage: RetryStageKind,
    #[serde(default = "default_retry_stage_mode")]
    pub mode: String,
    /// 省略时按 stage 取默认：refine → false（只支持原地），其余 → true。
    /// 用 [`RetryStageRequest::creates_new_job`] 读取。
    #[serde(default)]
    pub create_new_job: Option<bool>,
    #[serde(default)]
    pub overrides: Value,
    #[serde(default)]
    pub ambiguous_request_policy: AmbiguousRequestPolicy,
    /// 只对 `stage=refine` 有意义：一次性精修覆盖，省略 = 全书 `review_and_fix`。
    /// 其余 stage 带了它会被拒绝（400），免得以为普通重渲染也会精修。
    #[serde(default)]
    pub refine: Option<RefineRetryRequest>,
}

/// `retry-stage stage=refine` 的 `refine` 对象。页码 1-based、闭区间，可省（= 全书）。
#[derive(Debug, Deserialize, Default, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RefineRetryRequest {
    /// `review_only` | `review_and_fix` | `editorial`，默认 `review_and_fix`。
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub start_page: Option<i64>,
    #[serde(default)]
    pub end_page: Option<i64>,
    /// 最多审多少块（0 = 不限）；省略 = 不限。
    #[serde(default)]
    pub max_items: Option<i64>,
    /// 最多用多少 token（0 = 不限）；省略 = 不限。
    #[serde(default)]
    pub max_tokens: Option<i64>,
}

fn default_retry_stage_mode() -> String {
    "from_stage".to_string()
}

impl RetryStageRequest {
    /// `create_new_job` 的生效值：显式给了就用，省略时 refine 原地执行、其余新建任务
    /// （与加 refine 之前「省略 = true」的行为一致）。
    pub fn creates_new_job(&self) -> bool {
        self.create_new_job
            .unwrap_or(!matches!(self.stage, RetryStageKind::Refine))
    }
}

#[derive(Debug, Serialize)]
pub struct RetryStageSubmissionView {
    pub job_id: String,
    pub source_job_id: String,
    pub status: JobStatusKind,
    pub workflow: WorkflowKind,
    pub rerun_from_stage: RetryStageKind,
    pub reused_artifacts: Vec<String>,
    pub rerun_stages: Vec<String>,
    pub ambiguous_request_policy: AmbiguousRequestPolicy,
    pub links: JobLinksView,
    pub actions: JobActionsView,
}

#[derive(Debug, Serialize)]
pub struct NormalizationSummaryView {
    pub provider: String,
    pub detected_provider: String,
    pub provider_was_explicit: bool,
    pub pages_seen: Option<i64>,
    pub blocks_seen: Option<i64>,
    pub document_defaults: usize,
    pub page_defaults: usize,
    pub block_defaults: usize,
    pub schema: String,
    pub schema_version: String,
    pub page_count: Option<i64>,
    pub block_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct GlossaryUsageSummaryView {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub glossary_id: String,
    #[serde(default)]
    pub glossary_name: String,
    #[serde(default)]
    pub entry_count: i64,
    #[serde(default)]
    pub resource_entry_count: i64,
    #[serde(default)]
    pub inline_entry_count: i64,
    #[serde(default)]
    pub overridden_entry_count: i64,
    #[serde(default)]
    pub source_hit_entry_count: i64,
    #[serde(default)]
    pub target_hit_entry_count: i64,
    #[serde(default)]
    pub unused_entry_count: i64,
    #[serde(default)]
    pub unapplied_source_hit_entry_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct InvocationSummaryView {
    #[serde(default)]
    pub stage: String,
    #[serde(default)]
    pub input_protocol: String,
    #[serde(default)]
    pub stage_spec_schema_version: String,
}

#[derive(Debug, Serialize)]
pub struct JobListItemView {
    pub job_id: String,
    pub display_name: String,
    pub workflow: WorkflowKind,
    pub status: JobStatusKind,
    /// One-based execution attempt (`retry_count + 1`).
    pub attempt: u32,
    /// Number of retries durably recorded by the job runtime.
    pub retry_count: u32,
    /// Stable timestamp of the most recently accepted retry, if any.
    pub last_retry_at: Option<String>,
    pub trace_id: Option<String>,
    /// 终态任务的完成说明，仅在有额外信息时出现（正常完成为 None）。
    ///
    /// 这**不是**阶段字段：`build_public_stage_snapshot` 对终态一律返回 None
    /// 是有意的（jobs_live_stage.rs 的 terminal_job_detail_uses_status_...
    /// 钉住了这条——终态该看 status，而不是把 "done" 当成一个阶段），
    /// 顶层那组 display_stage/stage/substage/lane/stage_detail/progress
    /// 也被 assert_no_legacy_top_level_stage_fields 禁止回流。
    ///
    /// 但 completion_pipeline.rs 恰恰在成功收尾时把「任务完成，但有 N 个内容块
    /// 保留原文未翻译」写进 job.stage_detail，若不另开通道就永远送不出去，
    /// 用户只会看到一个与完全成功无异的绿色「已翻译」。故用独立语义的字段承载。
    pub completion_note: Option<String>,
    pub stage_snapshot: Option<JobStageSnapshotView>,
    pub background_snapshots: Vec<JobStageSnapshotView>,
    pub stages: JobStagesView,
    pub page_count: Option<i64>,
    pub source_file_name: Option<String>,
    pub cover_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub output_pdf_ready: bool,
    pub markdown_ready: bool,
    pub bundle_ready: bool,
    pub invocation: Option<InvocationSummaryView>,
    pub created_at: String,
    pub updated_at: String,
    pub detail_path: String,
    pub detail_url: String,
    /// 复用了哪个任务的产物（OCR / 译文）。重新渲染、原地精修过的任务链里，顺着它能找到真正
    /// 持有译文的任务，不用再逐个打任务详情。没有复用时为 null。
    #[serde(default)]
    pub source_artifact_job_id: Option<String>,
    /// 失败时才有。成功/进行中的任务这个字段整个不出现。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failure: Option<JobFailureBriefView>,
}

/// 列表里那份**精简**失败信息。
///
/// 为什么不直接塞 `JobFailureInfo`：document jobs 列表每 2 秒轮询一次
/// （DOCUMENT_JOBS_REFRESH_INTERVAL_MS），而 JobFailureInfo 带着 raw_excerpt、
/// traceback、raw_diagnostic —— 一条 Python traceback 就是好几 KB，乘以轮询频率
/// 和列表长度（有一本书累积了 20 个任务）不划算。
///
/// 这里只放「一眼能判断该怎么办」的那几项。要看完整错误和 traceback 时，前端
/// 按需去打 job 详情端点（那边本来就带 `failure`），而不是让每一帧都驮着它。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JobFailureBriefView {
    /// 面向用户的分类：provider / translation / timeout / render / internal …
    pub category: String,
    /// 失败发生在哪一段：ocr / translation / render
    pub stage: String,
    /// 具体失败码（同任务详情 `failure.failure_code`：`auth_failed`、`upstream_model_unavailable`、
    /// `upstream_region_unsupported`……），`category` 同一类里要给不同说法时按它分（2026-11-24 加）。
    /// 没有失败码、或只有旧数据兜底出来的 `unknown` 时整个键不出现。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failure_code: Option<String>,
    /// 能不能重试。实测 17/17 的失败都是 true —— 这个字段早就有，只是从没传到前端。
    pub retryable: bool,
    /// 一句话结论。
    pub summary: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub root_cause: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
    /// 上游是谁（mineru / deepseek …），排查时第一眼要看的。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    /// 上游服务商回的是什么（同任务详情 `failure.upstream`），拿去错误码目录查条目。不知道时整个键不出现。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upstream: Option<JobFailureUpstream>,
}

impl JobFailureBriefView {
    /// 从完整的 `JobFailureInfo` 裁出来。
    ///
    /// category / stage 优先取「正式字段」（failure_category / failed_stage）——
    /// 那两个是后来加的、更准的一套，旧的 category / stage 在一部分任务上是
    /// "unknown"（实测：6 条 MinerU 失败的 category 都是 unknown，而
    /// failure_category 是 provider）。
    pub fn from_failure(failure: &JobFailureInfo) -> Self {
        let pick = |formal: &Option<String>, legacy: &str| -> String {
            formal
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty() && *value != "unknown")
                .unwrap_or(legacy)
                .to_string()
        };
        Self {
            category: pick(&failure.failure_category, &failure.category),
            stage: pick(&failure.failed_stage, &failure.stage),
            // 读库时缺失败码会拿旧的 category 兜底（常是 "unknown"），那种不带
            failure_code: failure
                .failure_code
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty() && *value != "unknown")
                .map(str::to_string),
            retryable: failure.retryable,
            summary: failure.summary.clone(),
            root_cause: failure.root_cause.clone(),
            suggestion: failure.suggestion.clone(),
            provider: failure.provider.clone(),
            upstream: failure.upstream.clone(),
        }
    }
}

#[derive(Debug, Serialize, Default)]
pub struct JobListInvocationSummaryView {
    pub stage_spec_count: usize,
    pub unknown_count: usize,
}

#[derive(Debug, Serialize)]
pub struct OcrJobSummaryView {
    pub job_id: String,
    pub status: Option<JobStatusKind>,
    pub trace_id: Option<String>,
    pub provider_trace_id: Option<String>,
    pub detail_path: String,
    pub detail_url: String,
}

#[derive(Debug, Serialize)]
pub struct JobListView {
    pub items: Vec<JobListItemView>,
    pub invocation_summary: JobListInvocationSummaryView,
    /// 实际生效的条数上限（越界是 400，不会被夹，所以总等于请求的值）。
    pub limit: u32,
    pub offset: u32,
    /// 这一页之后还有没有。
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct DocumentJobListView {
    pub items: Vec<JobListItemView>,
    pub invocation_summary: JobListInvocationSummaryView,
    pub total: u64,
    pub limit: u32,
    pub offset: u32,
    pub has_more: bool,
}

#[derive(Debug, Deserialize)]
pub struct PagePreviewQuery {
    #[serde(default = "default_preview_kind")]
    pub kind: String,
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub dpi: Option<u32>,
}

/// 保留排版的 Word 导出。`dpi` 决定每页背景位图的清晰度，也直接决定文件大小——
/// 它是缓存键的一部分，换一个值就是另一份产物。
#[derive(Debug, Deserialize)]
pub struct LayoutDocxQuery {
    #[serde(default)]
    pub dpi: Option<u32>,
}

fn default_preview_kind() -> String {
    "translated".to_string()
}
