//! Library domain services.
//!
//! Everything outside the domain goes through the facade at the bottom of this file; the
//! route-facing view functions live in `api`.

mod api;

mod collection_workspace;
mod collections;
mod documents;
#[cfg(all(test, unix))]
mod jobs_view_parity_tests;
mod media;
mod merge;
mod metadata_suggestions;
mod ocr;
mod reading;
mod search;
mod translate;
mod translate_plan;
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
};
pub use media::{open_document_file, DocumentFile};
pub use views::{
    AddCollectionDocumentsInput, ApplyDocumentMetadataSuggestionInput, CollectionListView,
    CollectionMutationResult, CreateCollectionInput, CreateDocumentMetadataSuggestionInput,
    DeleteDocumentQuery, DocumentDeleteResultView, DocumentJobRequest, DocumentListView,
    DocumentMetadataEvidenceView, DocumentMetadataSuggestionApplyView,
    DocumentMetadataSuggestionListView, DocumentMetadataSuggestionView, DocumentTitleCandidateView,
    ListDocumentMetadataSuggestionsQuery, ListDocumentsQuery, PatchCollectionInput,
    PatchDocumentInput, SearchQuery, SearchResultView,
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
