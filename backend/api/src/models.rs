//! 模型的门面：核心包的模型，加上各领域包自己的返回类型。
//!
//! 返回类型按领域放在各自的包里（方案见 docs/ops/planning/api-reorg/20261018-返回类型按领域拆开.md），
//! 这里把它们并回 `models::api`，路由、测试照旧写 `crate::models::api::…`，不用知道类型在哪个包。

pub use retainpdf_core::models::*;

pub mod api {
    pub use retainpdf_core::models::api::*;
    pub use retainpdf_glossaries::{
        GlossaryCsvExportView, GlossaryCsvParseInput, GlossaryCsvParseView, GlossaryDetailView,
        GlossaryListView, GlossarySummaryView, GlossaryUpsertInput, ListGlossariesQuery,
    };
    pub use retainpdf_files::{
        ActionLinkView, ArtifactDisplayItemView, ArtifactLinksView, JOB_INTERNAL_FILES, JobActionsView,
        MarkdownArtifactView, ResourceLinkView, build_artifact_links, build_job_actions,
        document_file_path, job_bundle_path, job_file_path, job_files_list_path,
        job_markdown_view_path, job_ocr_images_base_path,
        job_ocr_markdown_path, job_translated_pdf_path,
    };
    pub use retainpdf_ingest::{UploadView, upload_to_response};
    pub use retainpdf_jobs::{
        AmbiguousRequestPolicy, BookSummaryView, DeleteJobQuery, DocumentJobListView,
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
    pub use retainpdf_library::{
        AddCollectionDocumentsInput, AppendMessageInput, ApplyDocumentMetadataSuggestionInput,
        CollectionListView, CollectionMutationResult, ConversationDetailView, ConversationListView,
        ConversationMutationResult, CreateCollectionInput, CreateConversationInput,
        CreateDocumentMetadataSuggestionInput, DeleteDocumentQuery, DocumentDeleteResultView,
        DocumentJobRequest, DocumentListView, DocumentMetadataEvidenceView, DocumentMetadataSuggestionApplyView,
        DocumentMetadataSuggestionListView, DocumentMetadataSuggestionView, DocumentTitleCandidateView,
        ForkConversationInput, ForkMessageInput, ListConversationsQuery,
        ListDocumentMetadataSuggestionsQuery, ListDocumentsQuery, PatchCollectionInput,
        PatchConversationInput, PatchDocumentInput, SearchQuery, SearchResultView,
    };
    pub use retainpdf_platform::{BackupItemView, BackupRestoreView, BackupStatusView};
}
