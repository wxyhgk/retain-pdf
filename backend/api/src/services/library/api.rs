//! Application facade for the Library domain.
//!
//! Routes must import only this module from `services::*` (see architecture check).

use crate::error::AppError;
use crate::models::api::{
    AddCollectionDocumentsInput, AppendMessageInput, ApplyDocumentMetadataSuggestionInput,
    AssetRecord, CollectionListView, CollectionMutationResult, CollectionRecord,
    ConversationDetailView, ConversationListView, ConversationMutationResult, ConversationRecord,
    CreateCollectionInput, CreateConversationInput, CreateDocumentMetadataSuggestionInput,
    CreateFavoriteInput, DocumentDeleteResultView, DocumentJobListView, DocumentListView,
    DocumentMetadataSuggestionApplyView, DocumentMetadataSuggestionListView,
    DocumentMetadataSuggestionView, DocumentRecord, FavoriteListView, FavoriteMutationResult,
    FavoriteRecord, JobSubmissionView, LibraryBatchDeleteInput, LibraryBatchDeleteResultView,
    LibraryBookDetailView, LibraryBookListView, LibraryDeleteResultView, ListConversationsQuery,
    ListDocumentJobsQuery, ListDocumentMetadataSuggestionsQuery, ListDocumentsQuery,
    ListFavoritesQuery, ListJobsQuery, MessageRecord, PatchCollectionInput, PatchConversationInput,
    PatchDocumentInput, PatchFavoriteInput, SearchQuery, SearchResultView,
};
use crate::models::request::CreateJobInput;
use crate::services::jobs::JobsFacade;

use super::{
    add_collection_documents, append_message, apply_metadata_suggestion, create_collection,
    create_conversation, create_favorite, create_metadata_suggestion, delete_collection,
    delete_conversation, delete_document, delete_favorite, delete_library_book,
    delete_library_books, document_cover, document_source_pdf, document_thumbnail,
    get_conversation, get_document, get_library_book, list_collections, list_conversations,
    list_documents, list_favorites, list_library_books, list_metadata_suggestions, load_asset,
    ocr_document, patch_collection, patch_conversation, patch_document, patch_favorite,
    remove_collection_document, search_blocks, store_asset, translate_document, AssetDownload,
    DocumentFileDownload, LibraryDeps,
};

// --- books ---

pub fn list_library_books_view(
    deps: &LibraryDeps<'_>,
    query: &ListJobsQuery,
    base_url: &str,
) -> Result<LibraryBookListView, AppError> {
    list_library_books(deps, query, base_url)
}

pub fn get_library_book_view(
    deps: &LibraryDeps<'_>,
    job_id: &str,
    base_url: &str,
) -> Result<LibraryBookDetailView, AppError> {
    get_library_book(deps, job_id, base_url)
}

pub fn delete_library_book_view(
    deps: &LibraryDeps<'_>,
    job_id: &str,
    force: bool,
) -> Result<LibraryDeleteResultView, AppError> {
    delete_library_book(deps, job_id, force)
}

pub fn delete_library_books_view(
    deps: &LibraryDeps<'_>,
    input: &LibraryBatchDeleteInput,
) -> Result<LibraryBatchDeleteResultView, AppError> {
    delete_library_books(deps, input)
}

// --- documents ---

pub fn list_documents_view(
    deps: &LibraryDeps<'_>,
    query: &ListDocumentsQuery,
    base_url: &str,
) -> Result<DocumentListView, AppError> {
    list_documents(deps, query, base_url)
}

pub fn get_document_view(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    base_url: &str,
) -> Result<DocumentRecord, AppError> {
    get_document(deps, document_id, base_url)
}

pub fn patch_document_view(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    payload: &PatchDocumentInput,
    base_url: &str,
) -> Result<DocumentRecord, AppError> {
    patch_document(deps, document_id, payload, base_url)
}

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

pub fn list_document_jobs_view(
    deps: &LibraryDeps<'_>,
    jobs: &JobsFacade<'_>,
    document_id: &str,
    query: &ListDocumentJobsQuery,
    base_url: &str,
) -> Result<DocumentJobListView, AppError> {
    deps.db
        .get_document(document_id)
        .map_err(|_| AppError::not_found(format!("document not found: {document_id}")))?;
    jobs.document_jobs_view(base_url, document_id, query)
}

// --- media ---

pub fn document_source_pdf_download(
    deps: &LibraryDeps<'_>,
    document_id: &str,
) -> Result<DocumentFileDownload, AppError> {
    document_source_pdf(deps, document_id)
}

pub fn document_cover_download(
    deps: &LibraryDeps<'_>,
    document_id: &str,
) -> Result<DocumentFileDownload, AppError> {
    document_cover(deps, document_id)
}

pub fn document_thumbnail_download(
    deps: &LibraryDeps<'_>,
    document_id: &str,
) -> Result<DocumentFileDownload, AppError> {
    document_thumbnail(deps, document_id)
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

// --- favorites ---

pub fn create_favorite_view(
    deps: &LibraryDeps<'_>,
    payload: CreateFavoriteInput,
) -> Result<FavoriteRecord, AppError> {
    create_favorite(deps, payload)
}

pub fn list_favorites_view(
    deps: &LibraryDeps<'_>,
    query: &ListFavoritesQuery,
) -> Result<FavoriteListView, AppError> {
    list_favorites(deps, query)
}

pub fn patch_favorite_view(
    deps: &LibraryDeps<'_>,
    favorite_id: &str,
    payload: &PatchFavoriteInput,
) -> Result<FavoriteMutationResult, AppError> {
    patch_favorite(deps, favorite_id, payload)
}

pub fn delete_favorite_view(
    deps: &LibraryDeps<'_>,
    favorite_id: &str,
) -> Result<FavoriteMutationResult, AppError> {
    delete_favorite(deps, favorite_id)
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
