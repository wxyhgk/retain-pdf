//! Application facade for the Library domain.
//!
//! Routes must import only this module from `services::*` (see architecture check).
//! Domain functions that already implement the API contract are re-exported
//! directly; a public entrypoint does not need an extra forwarding function.

pub use super::documents::{get_document, list_documents, patch_document};
pub(crate) use super::reading::{collection_agent_workspace, document_reading, document_translation_coverage};
pub use crate::services::collection_workspace::CollectionWorkspace;
pub use crate::services::merge::coverage::TranslationCoverageView;
pub use crate::services::merge::reading::DocumentReadingView;

use crate::error::AppError;
use crate::models::api::{
    AddCollectionDocumentsInput, AppendMessageInput, ApplyDocumentMetadataSuggestionInput,
    AssetRecord, CollectionListView, CollectionMutationResult, CollectionRecord,
    ConversationDetailView, ConversationListView, ConversationMutationResult, ConversationRecord,
    CreateCollectionInput, CreateConversationInput, CreateDocumentMetadataSuggestionInput,
    DocumentDeleteResultView, DocumentMetadataSuggestionApplyView,
    DocumentMetadataSuggestionListView, DocumentMetadataSuggestionView, JobSubmissionView,
    LibraryBookDetailView,
    LibraryBookListView, LibraryDeleteResultView, ListConversationsQuery,
    ListDocumentMetadataSuggestionsQuery, ListJobsQuery, MessageRecord,
    PatchCollectionInput, PatchConversationInput, SearchQuery,
    SearchResultView,
};
use crate::models::request::CreateJobInput;
use crate::services::download_generation::DownloadGeneration;
use crate::services::jobs::JobsFacade;
use std::sync::Arc;

use super::{
    add_collection_documents, append_message, apply_metadata_suggestion,
    create_collection, create_conversation,
    create_metadata_suggestion, delete_collection, delete_conversation,
    delete_document, delete_library_book, document_cover,
    document_source_pdf, document_thumbnail, get_conversation, get_library_book, list_collections,
    list_conversations, list_library_books, list_metadata_suggestions, load_asset,
    ocr_document, patch_collection, patch_conversation, remove_collection_document,
    search_blocks, store_asset, translate_document, AssetDownload, DocumentFileDownload,
    LibraryDeps,
};

// --- books ---

pub fn list_library_books_view(
    db: &crate::db::Db,
    data_root: &std::path::Path,
    query: &ListJobsQuery,
    base_url: &str,
) -> Result<LibraryBookListView, AppError> {
    list_library_books(db, data_root, query, base_url)
}

pub fn get_library_book_view(
    db: &crate::db::Db,
    data_root: &std::path::Path,
    job_id: &str,
    base_url: &str,
) -> Result<LibraryBookDetailView, AppError> {
    get_library_book(db, data_root, job_id, base_url)
}

pub fn delete_library_book_view(
    deps: &LibraryDeps<'_>,
    job_id: &str,
    force: bool,
) -> Result<LibraryDeleteResultView, AppError> {
    delete_library_book(deps, job_id, force)
}

// --- documents ---

pub fn delete_document_view(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    force: bool,
) -> Result<DocumentDeleteResultView, AppError> {
    delete_document(deps, document_id, force)
}

pub fn create_document_metadata_suggestion_view(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    input: &CreateDocumentMetadataSuggestionInput,
) -> Result<DocumentMetadataSuggestionView, AppError> {
    create_metadata_suggestion(deps, document_id, input)
}

pub fn list_document_metadata_suggestions_view(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    query: &ListDocumentMetadataSuggestionsQuery,
) -> Result<DocumentMetadataSuggestionListView, AppError> {
    list_metadata_suggestions(deps, document_id, query)
}

pub fn apply_document_metadata_suggestion_view(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    suggestion_id: &str,
    input: &ApplyDocumentMetadataSuggestionInput,
) -> Result<DocumentMetadataSuggestionApplyView, AppError> {
    apply_metadata_suggestion(deps, document_id, suggestion_id, input)
}

// --- media ---

pub fn document_source_pdf_download(
    deps: &LibraryDeps<'_>,
    document_id: &str,
) -> Result<DocumentFileDownload, AppError> {
    document_source_pdf(deps, document_id)
}

pub async fn document_cover_download(
    deps: &LibraryDeps<'_>,
    generation: &Arc<DownloadGeneration>,
    document_id: &str,
) -> Result<DocumentFileDownload, AppError> {
    document_cover(deps, generation, document_id).await
}

pub async fn document_thumbnail_download(
    deps: &LibraryDeps<'_>,
    generation: &Arc<DownloadGeneration>,
    document_id: &str,
) -> Result<DocumentFileDownload, AppError> {
    document_thumbnail(deps, generation, document_id).await
}

// --- translate ---

pub fn translate_document_view(
    deps: &LibraryDeps<'_>,
    jobs: &JobsFacade<'_>,
    document_id: &str,
    request: CreateJobInput,
    base_url: &str,
) -> Result<JobSubmissionView, AppError> {
    translate_document(deps, jobs, document_id, request, base_url)
}

pub async fn ocr_document_view(
    deps: &LibraryDeps<'_>,
    jobs: &JobsFacade<'_>,
    document_id: &str,
    request: CreateJobInput,
    base_url: &str,
) -> Result<JobSubmissionView, AppError> {
    ocr_document(deps, jobs, document_id, request, base_url).await
}


// --- search ---

pub fn search_blocks_view(
    deps: &LibraryDeps<'_>,
    query: &SearchQuery,
) -> Result<SearchResultView, AppError> {
    search_blocks(deps, query)
}

// --- assets ---

pub fn store_asset_view(
    deps: &LibraryDeps<'_>,
    mime: &str,
    data: &[u8],
) -> Result<AssetRecord, AppError> {
    store_asset(deps, mime, data)
}

pub fn load_asset_view(deps: &LibraryDeps<'_>, asset_id: &str) -> Result<AssetDownload, AppError> {
    load_asset(deps, asset_id)
}

// --- conversations ---

pub fn create_conversation_view(
    deps: &LibraryDeps<'_>,
    payload: &CreateConversationInput,
) -> Result<ConversationRecord, AppError> {
    create_conversation(deps, payload)
}

pub fn list_conversations_view(
    deps: &LibraryDeps<'_>,
    query: &ListConversationsQuery,
) -> Result<ConversationListView, AppError> {
    list_conversations(deps, query)
}

pub fn get_conversation_view(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
) -> Result<ConversationDetailView, AppError> {
    get_conversation(deps, conversation_id)
}

pub fn delete_conversation_view(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
) -> Result<ConversationMutationResult, AppError> {
    delete_conversation(deps, conversation_id)
}

pub fn append_message_view(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
    payload: AppendMessageInput,
) -> Result<MessageRecord, AppError> {
    append_message(deps, conversation_id, payload)
}

pub fn patch_conversation_view(
    deps: &LibraryDeps<'_>,
    conversation_id: &str,
    payload: &PatchConversationInput,
) -> Result<ConversationRecord, AppError> {
    patch_conversation(deps, conversation_id, payload)
}

pub fn fork_conversation_view(
    deps: &LibraryDeps<'_>,
    payload: &crate::models::api::ForkConversationInput,
) -> Result<ConversationDetailView, AppError> {
    super::fork_conversation(deps, payload)
}

// --- collections ---

pub fn create_collection_view(
    deps: &LibraryDeps<'_>,
    payload: &CreateCollectionInput,
) -> Result<CollectionRecord, AppError> {
    create_collection(deps, payload)
}

pub fn list_collections_view(deps: &LibraryDeps<'_>) -> Result<CollectionListView, AppError> {
    list_collections(deps)
}

pub fn patch_collection_view(
    deps: &LibraryDeps<'_>,
    collection_id: &str,
    payload: &PatchCollectionInput,
) -> Result<CollectionRecord, AppError> {
    patch_collection(deps, collection_id, payload)
}

pub fn delete_collection_view(
    deps: &LibraryDeps<'_>,
    collection_id: &str,
) -> Result<CollectionMutationResult, AppError> {
    delete_collection(deps, collection_id)
}

pub fn add_collection_documents_view(
    deps: &LibraryDeps<'_>,
    collection_id: &str,
    payload: AddCollectionDocumentsInput,
) -> Result<CollectionRecord, AppError> {
    add_collection_documents(deps, collection_id, payload)
}

pub fn remove_collection_document_view(
    deps: &LibraryDeps<'_>,
    collection_id: &str,
    document_id: &str,
) -> Result<CollectionMutationResult, AppError> {
    remove_collection_document(deps, collection_id, document_id)
}
