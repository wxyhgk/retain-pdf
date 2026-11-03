//! Application facade for the Library domain.
//!
//! The library facade (`mod.rs`) re-exports these for routes.
//! Domain functions that already implement the API contract are re-exported
//! directly; a public entrypoint does not need an extra forwarding function.

pub use super::documents::{get_document, list_documents, patch_document};
pub use super::reading::{document_reading, document_translation_coverage};
pub use crate::merge::coverage::TranslationCoverageView;
pub use crate::merge::reading::DocumentReadingView;

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::api::CollectionRecord;
use retainpdf_jobs::JobSubmissionView;
use crate::views::{
    AddCollectionDocumentsInput, ApplyDocumentMetadataSuggestionInput, CollectionListView,
    CollectionMutationResult, CreateCollectionInput, CreateDocumentMetadataSuggestionInput,
    DocumentDeleteResultView, DocumentJobRequest, DocumentMetadataSuggestionApplyView,
    DocumentMetadataSuggestionListView, DocumentMetadataSuggestionView,
    ListDocumentMetadataSuggestionsQuery, PatchCollectionInput, SearchQuery, SearchResultView,
};
use retainpdf_jobs::JobsFacade;

use super::{
    add_collection_documents, apply_metadata_suggestion, create_collection,
    create_metadata_suggestion, delete_collection, delete_document, document_delete_job_ids,
    document_files_view, list_collections, list_metadata_suggestions, ocr_document,
    patch_collection, remove_collection_document,
    search_blocks, translate_document, LibraryDeps,
};

// --- documents ---

/// 强制删除一篇文档前要先取消的任务(名下全部任务 + `-ocr` 子任务)。
pub fn document_delete_job_ids_view(
    deps: &LibraryDeps<'_>,
    document_id: &str,
) -> Result<Vec<String>, AppError> {
    document_delete_job_ids(deps.db, document_id)
}

pub fn delete_document_view(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    force: bool,
) -> Result<DocumentDeleteResultView, AppError> {
    delete_document(deps, document_id, force)
}

/// 读原文 PDF 和规范化文档的那段放在阻塞线程里，所以是 async。
pub async fn create_document_metadata_suggestion_view(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    input: &CreateDocumentMetadataSuggestionInput,
) -> Result<DocumentMetadataSuggestionView, AppError> {
    create_metadata_suggestion(deps, document_id, input).await
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
    base_url: &str,
) -> Result<DocumentMetadataSuggestionApplyView, AppError> {
    apply_metadata_suggestion(deps, document_id, suggestion_id, input, base_url)
}

// --- media ---

pub use super::media::DocumentFilesView;
pub use retainpdf_jobs::Disposition;

pub fn document_files(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    base_url: &str,
) -> Result<DocumentFilesView, AppError> {
    document_files_view(deps, document_id, base_url)
}

// --- translate ---

pub fn translate_document_view(
    deps: &LibraryDeps<'_>,
    jobs: &JobsFacade<'_>,
    document_id: &str,
    request: DocumentJobRequest,
    base_url: &str,
) -> Result<JobSubmissionView, AppError> {
    translate_document(deps, jobs, document_id, request, base_url)
}

pub async fn ocr_document_view(
    deps: &LibraryDeps<'_>,
    jobs: &JobsFacade<'_>,
    document_id: &str,
    request: DocumentJobRequest,
    base_url: &str,
) -> Result<JobSubmissionView, AppError> {
    ocr_document(deps, jobs, document_id, request, base_url).await
}


// --- search ---

pub fn search_blocks_view(
    deps: &LibraryDeps<'_>,
    query: &SearchQuery,
    owner: Option<&str>,
) -> Result<SearchResultView, AppError> {
    search_blocks(deps, query, owner)
}

// --- collections ---

pub fn create_collection_view(
    deps: &LibraryDeps<'_>,
    payload: &CreateCollectionInput,
    owner: &str,
) -> Result<CollectionRecord, AppError> {
    let record = create_collection(deps, payload)?;
    deps.db.set_resource_owner(retainpdf_data::db::OwnedKind::Collection, &record.collection_id, owner)?;
    Ok(record)
}

pub fn list_collections_view(
    deps: &LibraryDeps<'_>,
    owner: Option<&str>,
) -> Result<CollectionListView, AppError> {
    list_collections(deps, owner)
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
