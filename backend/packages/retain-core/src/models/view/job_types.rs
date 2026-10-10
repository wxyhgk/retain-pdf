use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::{
    JobFailureInfo, JobRuntimeInfo, JobStatusKind, OcrProviderDiagnostics, PublicResolvedJobSpec,
    WorkflowKind,
};

use super::super::common::{
    JobActionsView, JobLinksView, JobProgressView, JobStagesView, JobTimestampsView,
};

#[derive(Debug, Serialize)]
pub struct ResourceLinkView {
    pub ready: bool,
    pub path: String,
    pub url: String,
    pub method: String,
    pub content_type: String,
    pub file_name: Option<String>,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct MarkdownArtifactView {
    pub ready: bool,
    pub json_path: String,
    pub json_url: String,
    pub raw_path: String,
    pub raw_url: String,
    pub images_base_path: String,
    pub images_base_url: String,
    pub file_name: Option<String>,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ArtifactLinksView {
    pub pdf_ready: bool,
    pub markdown_ready: bool,
    pub bundle_ready: bool,
    pub schema_version: Option<String>,
    pub provider_raw_dir: Option<String>,
    pub provider_zip: Option<String>,
    pub provider_summary_json: Option<String>,
    pub pdf_url: String,
    pub markdown_url: String,
    pub markdown_images_base_url: String,
    pub bundle_url: String,
    pub normalized_document_url: String,
    pub normalization_report_url: String,
    pub manifest_path: String,
    pub manifest_url: String,
    pub actions: JobActionsView,
    pub normalized_document: ResourceLinkView,
    pub normalization_report: ResourceLinkView,
    pub pdf: ResourceLinkView,
    pub markdown: MarkdownArtifactView,
    pub bundle: ResourceLinkView,
}

#[derive(Debug, Serialize)]
pub struct JobArtifactItemView {
    pub artifact_key: String,
    pub artifact_group: String,
    pub artifact_kind: String,
    pub ready: bool,
    pub file_name: Option<String>,
    pub content_type: String,
    pub size_bytes: Option<u64>,
    pub relative_path: String,
    pub checksum: Option<String>,
    pub source_stage: Option<String>,
    pub updated_at: String,
    /// One-based durable pipeline attempt which produced this projection.
    pub attempt: u32,
    pub resource_path: Option<String>,
    pub resource_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct JobArtifactManifestView {
    pub job_id: String,
    pub items: Vec<JobArtifactItemView>,
}

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

#[derive(Debug, Serialize)]
pub struct ArtifactDisplayItemView {
    pub key: String,
    pub label: String,
    pub ready: bool,
    pub kind: String,
    pub file_name: Option<String>,
    pub size_bytes: Option<u64>,
    pub download_url: Option<String>,
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

#[derive(Debug, Deserialize)]
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
            retryable: failure.retryable,
            summary: failure.summary.clone(),
            root_cause: failure.root_cause.clone(),
            suggestion: failure.suggestion.clone(),
            provider: failure.provider.clone(),
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

#[derive(Debug, Serialize)]
pub struct LibraryBookListItemView {
    pub id: String,
    pub job_id: String,
    pub title: String,
    pub display_name: String,
    pub source_file_name: Option<String>,
    pub authors: Option<String>,
    pub page_count: Option<i64>,
    pub status: JobStatusKind,
    pub stage: Option<String>,
    pub stage_detail: Option<String>,
    pub progress: JobProgressView,
    pub cover_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub output_pdf_ready: bool,
    pub markdown_ready: bool,
    pub bundle_ready: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct LibraryBookListView {
    pub items: Vec<LibraryBookListItemView>,
}

#[derive(Debug, Serialize)]
pub struct LibraryBookDetailView {
    pub id: String,
    pub job_id: String,
    pub title: String,
    pub authors: Option<String>,
    pub source_file_name: Option<String>,
    pub page_count: Option<i64>,
    pub source_language: Option<String>,
    pub target_language: Option<String>,
    pub file_size_bytes: Option<u64>,
    pub status: JobStatusKind,
    pub stage: Option<String>,
    pub progress: JobProgressView,
    pub cover_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub artifacts: Vec<ArtifactDisplayItemView>,
}

#[derive(Debug, Deserialize)]
pub struct LibraryDeleteQuery {
    #[serde(default)]
    pub force: bool,
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

#[derive(Debug, Deserialize)]
pub struct LibraryBatchDeleteInput {
    pub ids: Vec<String>,
    #[serde(default)]
    pub force: bool,
}

#[derive(Debug, Serialize)]
pub struct LibraryDeleteResultView {
    pub deleted: bool,
    pub job_id: String,
    pub removed_paths: Vec<String>,
    pub removed_child_jobs: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct LibraryBatchDeleteResultView {
    pub items: Vec<LibraryDeleteResultView>,
}

#[derive(Debug, Serialize)]
pub struct DocumentDeleteResultView {
    pub deleted: bool,
    pub document_id: String,
    pub removed_jobs: Vec<String>,
    pub removed_paths: Vec<String>,
}

fn default_preview_kind() -> String {
    "translated".to_string()
}
