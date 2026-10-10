//! Library domain services.
//!
//! Routes talk to this domain only through `services::library::api`.

pub(crate) mod api;

mod assets;
mod books;
mod collections;
mod conversations;
mod documents;
mod media;
mod metadata_suggestions;
mod ocr;
mod reading;
mod search;
mod translate;
mod translate_plan;

use std::path::Path;

use crate::config::AssetConfig;
use crate::db::Db;

pub use assets::{load_asset, store_asset, AssetDownload};
pub use books::{delete_library_book, get_library_book, list_library_books};
pub use collections::{
    add_collection_documents, create_collection, delete_collection, list_collections,
    patch_collection, remove_collection_document,
};
pub use conversations::{
    append_message, create_conversation, delete_conversation, fork_conversation, get_conversation,
    list_conversations, patch_conversation,
};
pub use documents::delete_document;
pub use media::{document_cover, document_source_pdf, document_thumbnail, DocumentFileDownload};
pub use metadata_suggestions::{
    apply_metadata_suggestion, create_metadata_suggestion, list_metadata_suggestions,
};
pub use ocr::ocr_document;
pub use search::search_blocks;
pub use translate::translate_document;

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
    pub asset_config: &'a AssetConfig,
}
