#[path = "models/api.rs"]
pub mod api;
#[path = "models/common.rs"]
mod common;
#[path = "models/defaults.rs"]
pub mod defaults;
#[path = "models/document_operation.rs"]
mod document_operation;
#[path = "models/domain.rs"]
pub mod domain;
#[path = "models/glossary.rs"]
mod glossary;
#[path = "models/input.rs"]
mod input;
#[path = "models/job.rs"]
mod job;
#[path = "models/library.rs"]
mod library;
#[path = "models/ocr.rs"]
mod ocr;
#[path = "models/public_contract.rs"]
mod public_contract;
#[path = "models/redaction.rs"]
mod redaction;
#[path = "models/request.rs"]
pub mod request;
#[path = "models/view.rs"]
mod view;

pub use common::{
    build_job_id, now_iso, ApiResponse, JobStatusKind, UploadRecord, UploadView, WorkflowKind,
    LOG_TAIL_LIMIT,
};
pub use document_operation::{
    validate_operation_id, DocumentOperationDispatchReceipt, DocumentOperationLimits,
    DocumentOperationStatus, DocumentOperationWorkspaceManifest, DocumentOperationWorkspaceState,
    DOCUMENT_OPERATION_MANIFEST_SCHEMA, DOCUMENT_OPERATION_SCHEMA_VERSION,
    DOCUMENT_OPERATION_STATE_SCHEMA,
};
pub use glossary::{
    build_glossary_id, glossary_to_csv_export, glossary_to_detail, glossary_to_summary,
    GlossaryCsvExportView, GlossaryCsvParseInput, GlossaryCsvParseView, GlossaryDetailView,
    GlossaryListView, GlossaryRecord, GlossarySummaryView, GlossaryUpsertInput,
};
pub use input::{
    CreateJobInput, GlossaryEntryInput, JobSourceInput, OcrInput, RenderInput, ResolvedJobSpec,
    ResolvedSourceSpec, RuntimeInput, TranslationInput, DEFAULT_SOURCE_CLEANUP_STRATEGY,
    SOURCE_CLEANUP_STRATEGIES,
};
pub use job::{
    event_progress_unit, job_progress_unit, job_stage_detail, job_stage_rank, job_stage_str,
    job_user_stage, normalize_event_substage, normalize_event_user_stage, normalize_job_stage,
    public_stage_for_raw_stage, public_stage_for_substage, JobAiDiagnostic, JobArtifactRecord,
    JobArtifacts, JobFailureInfo, JobRawDiagnostic, JobRecord, JobRuntimeInfo, JobRuntimeState,
    JobSnapshot, JobStage, JobStageTiming, OcrCheckpointArtifacts, ProcessResult, RenderArtifacts,
    TranslationArtifacts,
};
pub use ocr::{
    OcrArtifactSet, OcrErrorCategory, OcrProviderArtifactLayout, OcrProviderCapabilities,
    OcrProviderCredentialSpec, OcrProviderDiagnostics, OcrProviderErrorInfo, OcrProviderKind,
    OcrProviderOptionSpec, OcrProviderPublicDefinition, OcrTaskHandle, OcrTaskState, OcrTaskStatus,
};
pub use public_contract::{
    public_request_payload, PublicOcrInput, PublicResolvedJobSpec, PublicTranslationInput,
};
pub use redaction::{redact_json_value, redact_optional_text, redact_text, sensitive_values};
pub use view::{
    build_artifact_links, build_artifact_manifest, build_job_actions, build_job_links,
    build_job_links_with_workflow, summarize_list_invocation, to_absolute_url, upload_to_response,
    ActionLinkView, AmbiguousRequestPolicy, ArtifactDisplayItemView, ArtifactDownloadQuery,
    ArtifactLinksView, BookSummaryView, DocumentDeleteResultView, DocumentJobListView,
    GlossaryUsageSummaryView, InvocationSummaryView, JobActionsView, JobArtifactItemView,
    JobArtifactManifestView, JobContractsView, JobDetailView, JobDiagnosticsView, JobEventListView,
    JobEventProgressView, JobEventRawView, JobEventRecord, JobFailureDiagnosticView, JobLinksView,
    JobListInvocationSummaryView, JobListItemView, JobListView, JobProgressView, JobResumePlanView,
    JobStageContractArtifactView, JobStageContractView, JobStageRuntimeView, JobStageSnapshotView,
    JobStageStateView, JobStagesView, JobSubmissionView, JobTimestampsView,
    LibraryBatchDeleteInput, LibraryBatchDeleteResultView, LibraryBookDetailView,
    LibraryBookListItemView, LibraryBookListView, LibraryDeleteQuery, LibraryDeleteResultView,
    ListDocumentJobsQuery, ListGlossariesQuery, ListJobEventsQuery, ListJobsQuery,
    ListTranslationItemsQuery, LiveTranslationCommitEventView, LiveTranslationEventsQuery,
    LiveTranslationItemView, LiveTranslationLayoutBlockView, LiveTranslationLayoutPageView,
    LiveTranslationLayoutView, LiveTranslationPageView, LiveTranslationTypographyView,
    MarkdownArtifactView, MarkdownDocumentView, MarkdownImageView, MarkdownQuery, MarkdownView,
    NormalizationSummaryView, OcrAmbiguityReceiptFieldView, OcrAmbiguityResolutionKind,
    OcrAmbiguityResolutionRequest, OcrAmbiguityResolutionView, OcrAmbiguityView, OcrJobSummaryView,
    PagePreviewQuery, ReaderAiChatRequest, ReaderAiChatView, ReaderAiCitationView,
    ReaderAiContextView, ReaderAiHistoryMessageView, ReaderAiRectView, ReaderAiSelectionView,
    ReaderAiUsedContextView, ReaderDocumentMetadataView, ReaderMetadataView,
    ReaderPageMetadataView, ReaderRegionBoxView, ReaderRegionItemView, ReaderRegionsView,
    ResourceLinkView, RetryStageKind, RetryStageRequest, RetryStageSubmissionView,
    StageActionsView, StageRetryActionLinkView, StageRetryActionView, TranslationDebugIndexView,
    TranslationDebugItemView, TranslationDebugListItemView, TranslationDebugListView,
    TranslationDiagnosticsView, TranslationReplayView, TranslationRequestRecoveryView,
};
