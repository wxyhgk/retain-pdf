//! Library domain services.
//!
//! Everything outside the domain goes through the facade at the bottom of this file; the
//! route-facing view functions live in `api`.

mod api;

mod ask_conversations;
mod ask_memories;
mod ask_threads;
mod ask_views;
mod book_export;
mod collection_workspace;
mod collections;
mod documents;
#[cfg(all(test, unix))]
mod jobs_view_parity_tests;
mod library_refresh;
mod media;
mod merge;
mod metadata_suggestions;
mod ocr;
mod reading;
mod search;
mod tags;
mod translate;
mod translate_plan;
mod versions;
mod views;

// 门面：领域外只能用这里导出的东西，子模块都是私有的（见 BOUNDARIES.md「Domain Facades」）。
pub use api::{
    add_collection_documents_view, apply_document_metadata_suggestion_view, create_collection_view,
    create_document_metadata_suggestion_view, delete_collection_view, delete_document_view,
    document_delete_job_ids_view, document_files, document_reading, document_translation_coverage,
    get_document, list_collections_view, list_document_metadata_suggestions_view, list_documents,
    ocr_document_view, patch_collection_view, patch_document, remove_collection_document_view,
    search_blocks_view, translate_document_view, Disposition, DocumentReadingView,
    TranslationCoverageView,
    document_translation_versions, patch_document_translation_version, set_document_translation_version,
    DocumentReadingQuery, PatchTranslationVersionInput, SetCurrentTranslationVersionInput,
    TranslationVersionView, TranslationVersionsQuery, TranslationVersionsView,
};
pub use ask_conversations::{
    append_ask_messages_view, ask_context_view, close_ask_conversation_view, create_side_ask_conversation_view,
    delete_ask_conversation_view, document_ask_messages_view, ensure_main_ask_conversation_view, get_ask_conversation_view,
    list_ask_conversations_view, list_ask_messages_view, patch_ask_conversation_view,
};
pub use ask_memories::{
    create_ask_memory_view, delete_ask_memory_view, get_ask_memory_view, list_ask_memories_view, patch_ask_memory_view,
};
/// 对话、记忆的记录就是接口返回的形状（和问答记录一样直接序列化库里的行）。
pub use retainpdf_data::db::{AskConversationMessageRecord, AskConversationRecord, AskMemoryRecord};
pub use ask_views::{
    AppendAskMessagesInput, AppendAskMessagesView, AskContextMemoriesView, AskContextParentView, AskContextQuery, AskContextView,
    AskConversationDeleteResultView, AskConversationListView, AskConversationMessageInput, AskMemoryCreatedView,
    AskMemoryListView, AskMessagePageView, AskSelectionInput, CloseAskConversationInput, CloseAskConversationView,
    CreateAskMemoryInput, CreateAskSideConversationInput, DocumentAskMessagesView, ListAskConversationsQuery,
    ListAskMemoriesQuery, ListAskMessagesQuery, PatchAskConversationInput, PatchAskMemoryInput,
};
pub use ask_threads::{
    create_ask_thread_view, delete_ask_thread_view, get_ask_thread_view, list_ask_threads_view, patch_ask_thread_view,
};
pub use book_export::export_book_folder;
pub use book_export::FolderRefreshReport;
pub use library_refresh::{spawn_library_refresh, LibraryRefreshDeps, LibraryRefreshReport, LibraryRefresher};
pub use media::{open_document_file, DocumentFile};
pub use tags::{create_tag_view, delete_tag_view, list_tags_view, patch_tag_view, set_document_tags_view};
pub use views::{
    AskAnchorInput, AskMessageInput, AskPointInput, AskThreadDeleteResultView, AskThreadListView, AskThreadView,
    CreateAskThreadInput, PatchAskThreadInput,
    AddCollectionDocumentsInput, ApplyDocumentMetadataSuggestionInput, BookFolderExportFailure,
    BookFolderExportInput, BookFolderExportView, CollectionListView,
    CollectionMutationResult, CreateCollectionInput, CreateDocumentMetadataSuggestionInput,
    DeleteDocumentQuery, DocumentDeleteResultView, DocumentJobRequest, DocumentListView,
    DocumentMetadataEvidenceView, DocumentMetadataSuggestionApplyView,
    DocumentMetadataSuggestionListView, DocumentMetadataSuggestionView, DocumentTitleCandidateView,
    ListDocumentMetadataSuggestionsQuery, ListDocumentsQuery, PatchCollectionInput,
    PatchDocumentInput, SearchQuery, SearchResultView,
    CreateTagInput, PatchTagInput, SetDocumentTagsInput, TagDeleteResultView, TagListView,
};

use std::path::Path;

use retainpdf_data::db::Db;

use collections::{
    add_collection_documents, create_collection, delete_collection, list_collections,
    patch_collection, remove_collection_document,
};
use documents::{delete_document, document_delete_job_ids};
use media::document_files_view;
use metadata_suggestions::{
    apply_metadata_suggestion, create_metadata_suggestion, list_metadata_suggestions,
};
use ocr::ocr_document;
use search::search_blocks;
use translate::translate_document;

pub struct LibraryDeps<'a> {
    pub db: &'a Db,
    pub data_root: &'a Path,
    pub output_root: &'a Path,
    pub downloads_dir: &'a Path,
    /// Used for document cover/thumbnail generation via derived_artifacts.
    pub scripts_dir: &'a Path,
    pub python_bin: &'a str,
    /// 合并阅读（多次范围翻译拼一本）要跑 pipeline 生成合并目录。
    pub pipeline_command: &'a str,
}
